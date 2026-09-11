import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readConfigFile } from "@isocan/server";
import type { AdapterSpec } from "./harnesses.ts";

/**
 * **The fence around a summoned agent** (from
 * `docs/research/2026-09-10-what-the-rc-hands-over.md`, layer 3; measured on
 * Linux 11 Sep 2026 and built the same day).
 *
 * Layer 1 stopped the rc handing over the person's whole environment and
 * every standing permission. What it could not do is stop the agent
 * *reaching*: the harness's own shell runs on the host, in the person's
 * directory, with the person's files. This module is the outside fence —
 * `@anthropic-ai/sandbox-runtime` (`srt`) wrapped around the adapter spawn,
 * so the limit holds whatever the harness does, which is the only kind that
 * works for pi (no permission system at all) and for Claude's non-Bash
 * tools (its own sandbox covers Bash only).
 *
 * **It is asked for, never assumed.** `isocan rc --sandbox`, or
 * `{"sandbox": true}` in `config.json`. And asking for a fence and not
 * getting one is a REFUSAL, not a warning: a person who wants "fence if you
 * can, otherwise run" says nothing at all, so the one word cannot also mean
 * its opposite on a machine that is missing `bwrap`.
 *
 * **Why srt and not a profile of our own.** Seatbelt and Landlock filter by
 * address and port, never by hostname, so "only the vendor's API" cannot be
 * said in either; srt bolts a proxy on to close exactly that gap, on both
 * platforms, without root. Owning a profile here would be srt with fewer
 * eyes on it — the same argument `harnesses.ts` makes about adapters, applied
 * to sandboxes.
 *
 * **The six things the spike found a wrapper has to know.** Every one of
 * these is a silent failure otherwise, and each is a comment at the line
 * that handles it:
 * 1. srt's Linux bridge needs IPv6 on the loopback interface — without it
 *    both of its inner listeners die unreported and every request is
 *    refused "after 0 ms" ({@link scanSandbox}).
 * 2. srt sets `NO_PROXY` to include `127.0.0.1`, which is the one address
 *    that MUST go through its proxy ({@link innerScript}).
 * 3. Node's `fetch` ignores the proxy variables unless told
 *    ({@link innerScript}).
 * 4. `npx` needs npm's own proxy keys, not just `HTTPS_PROXY`
 *    ({@link innerScript}).
 * 5. The harness's own config directory must be re-allowed, or sessions
 *    never resume ({@link harnessPaths}).
 * 6. srt itself must be readable INSIDE its own fence — a global install
 *    under a version manager, or an npx cache, lives under `$HOME`, and a
 *    policy that denies `$HOME` makes srt vanish mid-launch
 *    ({@link policyFor}).
 */

/** `config.json`'s hooks, the `harnessVars` posture again: a list isocan
 * derives, and a place for what it cannot. `sandboxRead`/`sandboxWrite` are
 * what a person adds for a monorepo's sibling checkout or a harness isocan
 * has never heard of, whose config directory it cannot guess. */
interface SandboxConfig {
  sandbox?: boolean;
  sandboxCommand?: string[] | string;
  sandboxDomains?: string[];
  sandboxRead?: string[];
  sandboxWrite?: string[];
}

export interface SandboxPolicy {
  network: {
    allowedDomains: string[];
    deniedDomains: string[];
    /** Left false on purpose. macOS would let the child dial loopback
     * directly with this on, but the allow-listed IP literal already
     * reaches the daemon through the proxy on both platforms, and the
     * setting has widened the boundary before (srt issue #88). One path,
     * measured. */
    allowLocalBinding: boolean;
  };
  filesystem: {
    denyRead: string[];
    allowRead: string[];
    allowWrite: string[];
    denyWrite: string[];
  };
}

export interface SandboxScan {
  /** Could an adapter be fenced on this machine? */
  can: boolean;
  /** What is missing and what fixes it — the refusal's own words. */
  why: string | null;
  /** What does the fencing, for the line a person reads. */
  engine: string;
  command: string;
  args: string[];
  /** Where srt's own files live, which the policy must re-allow (thing 6). */
  root: string | null;
}

/** Three-state, because the flags have to be able to override a standing
 * `config.json` answer in both directions. */
export async function sandboxAsked(
  home: string,
  flags: { sandbox?: boolean; unsandboxed?: boolean },
): Promise<boolean> {
  if (flags.sandbox) return true;
  if (flags.unsandboxed) return false;
  return (await readConfigFile<SandboxConfig>(home)).sandbox === true;
}

async function whichBin(bin: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, bin);
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

/** The directory of the package a binary belongs to, followed through the
 * symlink a global install leaves on the PATH. This is what thing 6 needs:
 * the real files, not the link. */
async function packageRootOf(bin: string): Promise<string | null> {
  let dir: string;
  try {
    dir = path.dirname(await fs.realpath(bin));
  } catch {
    return null;
  }
  for (let up = 0; up < 5; up++) {
    try {
      await fs.access(path.join(dir, "package.json"));
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

/**
 * What this machine can fence with, or why it cannot — read without a
 * daemon, the same way `scanHarnesses` reads harnesses.
 *
 * srt is looked for on the PATH and nowhere else. It is deliberately not a
 * dependency and deliberately not fetched: it is a 0.0.x research preview,
 * so pinning a version here would be the hand-typed pin `harnesses.ts` was
 * rewritten to delete — and `npx -y` was measured and rejected, because the
 * npx cache lives under `$HOME` and a policy that denies `$HOME` hides srt's
 * own seccomp helper from the sandbox it is building (thing 6, which a
 * global install under nvm hits too — hence `root`).
 */
export async function scanSandbox(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<SandboxScan> {
  const raw = await readConfigFile<SandboxConfig>(home);
  const declared = raw.sandboxCommand;
  const parts =
    typeof declared === "string" && declared.trim()
      ? declared.trim().split(/\s+/)
      : Array.isArray(declared) && declared.every((p) => typeof p === "string") && declared.length > 0
        ? declared
        : null;
  const engine = platform === "darwin" ? "Seatbelt" : platform === "linux" ? "bubblewrap" : platform;
  const no = (why: string): SandboxScan => ({ can: false, why, engine, command: "", args: [], root: null });

  // A declared command is believed as it stands — the same posture
  // `harnesses.ts` takes for a declared adapter. Everything below this line
  // is srt's own requirements, and a person who brought their own jail is
  // not subject to them: no ripgrep, no bubblewrap, no IPv6, and `root` is
  // theirs to name through `sandboxRead` if their jail needs it.
  if (parts) {
    return { can: true, why: null, engine: "a declared sandbox", command: parts[0]!, args: parts.slice(1), root: null };
  }
  if (platform === "win32") {
    return no(
      "srt's Windows sandbox is an alpha that needs a one-time elevated install and a dedicated local " +
        "account — isocan does not drive that yet; run the rc in WSL2, or leave it unfenced",
    );
  }
  if (platform !== "darwin" && platform !== "linux") {
    return no(`no sandbox is known for ${platform}`);
  }
  // ripgrep does srt's mandatory-deny scan on both platforms.
  const missing: string[] = [];
  for (const bin of platform === "linux" ? ["bwrap", "socat", "rg"] : ["rg"]) {
    if (!(await whichBin(bin, env))) missing.push(bin);
  }
  if (missing.length > 0) {
    return no(
      `srt needs ${missing.join(", ")} on the PATH here (${platform === "linux" ? "apt install bubblewrap socat ripgrep" : "brew install ripgrep"})`,
    );
  }
  if (platform === "linux") {
    /**
     * **Thing 1, and the only failure the spike could not have guessed.**
     * srt's Linux bridge is a `socat TCP-LISTEN` inside the sandbox
     * forwarding to the host's proxy over a Unix socket. `TCP-LISTEN` opens
     * an AF_INET6 socket; on a kernel built without IPv6 it fails with
     * "Address family not supported by protocol", and because srt sends
     * that listener's output to /dev/null the only symptom is every
     * request refused after 0 ms. Measured 11 Sep on a Firecracker guest
     * with no `/proc/sys/net/ipv6` at all. Refusing here — with the reason
     * — beats fencing an agent whose every call fails for a reason nothing
     * prints.
     */
    try {
      await fs.access("/proc/net/if_inet6");
    } catch {
      return no(
        "this kernel has no IPv6, and srt's Linux bridge listens on an IPv6 socket it cannot open — " +
          "every call from inside would be refused with nothing saying why (measured 11 Sep 2026, srt 0.0.76)",
      );
    }
  }
  const bin = await whichBin("srt", env);
  if (!bin) {
    return no(
      "srt is not on the PATH — `npm i -g @anthropic-ai/sandbox-runtime` installs it, or " +
        'config.json\'s sandboxCommand names another ({"sandboxCommand": ["cmd", "arg"]})',
    );
  }
  return { can: true, why: null, engine, command: bin, args: [], root: await packageRootOf(bin) };
}

/**
 * **Thing 5.** Where each harness keeps its own config and login. With
 * `$HOME` denied and these not re-allowed, Claude's session store lands on
 * the sandbox's tmpfs and every turn says "the stored one would not load —
 * rebuilt": the agent's memory is quietly reset by the fence. A harness
 * isocan does not know gets nothing here, and `sandboxRead`/`sandboxWrite`
 * is how a person says.
 */
function harnessPaths(harness: string, env: NodeJS.ProcessEnv): string[] {
  const home = os.homedir();
  switch (harness) {
    case "claude-code":
      return [env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, ".claude"), path.join(home, ".claude.json")];
    case "codex":
      return [env.CODEX_HOME?.trim() || path.join(home, ".codex")];
    case "pi":
      return [path.join(home, ".pi")];
    case "antigravity":
      return [path.join(home, ".gemini")];
    default:
      return [];
  }
}

/**
 * Where each harness's model lives. Measured for claude-code (a real turn
 * completed through this fence, 11 Sep); the rest are the vendors' published
 * endpoints and not yet walked, so `sandboxDomains` is the door. pi is
 * provider-agnostic — its model is the person's choice, not the harness's —
 * so it gets every vendor here rather than a guess.
 */
const VENDOR_DOMAINS: Record<string, string[]> = {
  "claude-code": ["api.anthropic.com", "claude.ai", "platform.claude.com"],
  codex: ["api.openai.com", "auth.openai.com", "chatgpt.com"],
  antigravity: [
    "generativelanguage.googleapis.com",
    "oauth2.googleapis.com",
    "cloudcode-pa.googleapis.com",
    "dl.google.com",
  ],
};

/** The daemon, as srt spells a destination. A loopback home is an IP literal
 * with its port — srt allows those as an explicit choice, which is exactly
 * what this is — and a hosted home is a hostname. */
function daemonEntries(base: string): string[] {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return [];
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const loopback = ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname);
  return loopback
    ? [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]
    : [url.port ? `${url.hostname}:${url.port}` : url.hostname];
}

const dedupe = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

export async function policyFor(options: {
  /** The enrolment's working directory — the one place the work belongs. */
  cwd: string;
  /** The isocan home: the badge, the sessions, the daemon record. */
  home: string;
  /** Where the CLI inside will talk — `ctx.client.base`. */
  daemon: string;
  harness: string;
  /** srt's own files (thing 6), from the scan. */
  sandboxRoot?: string | null;
  /** The adapter is fetched with `npx`, so npm's registry is in the path. */
  npx: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<SandboxPolicy> {
  const env = options.env ?? process.env;
  const raw = await readConfigFile<SandboxConfig>(options.home);
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];

  // The toolchain the bridges run on: `npx` is the builtin path, so the node
  // that spawned us is the node they need, and its prefix holds the rest.
  const nodeRoot = path.dirname(path.dirname(process.execPath));
  const npmCache = env.npm_config_cache?.trim() || path.join(os.homedir(), ".npm");
  const harness = harnessPaths(options.harness, env);
  // A proxy that terminates TLS hands the machine a CA to trust; hiding it
  // breaks every https call with a self-signed-certificate error.
  const caDirs = [env.NODE_EXTRA_CA_CERTS, env.SSL_CERT_FILE, env.CURL_CA_BUNDLE]
    .filter((p): p is string => Boolean(p?.trim()))
    .map((p) => path.dirname(p));

  return {
    network: {
      allowedDomains: dedupe([
        ...daemonEntries(options.daemon),
        ...(VENDOR_DOMAINS[options.harness] ?? Object.values(VENDOR_DOMAINS).flat()),
        ...(options.npx ? ["registry.npmjs.org"] : []),
        ...strings(raw.sandboxDomains),
      ]),
      deniedDomains: [],
      allowLocalBinding: false,
    },
    filesystem: {
      // The rest of the home is the point: ~/.ssh, the cloud credentials,
      // the other checkouts. srt reads allow-by-default and write
      // deny-by-default, so read needs the sweep and the carve-outs while
      // write needs only the list.
      denyRead: [os.homedir()],
      allowRead: dedupe([
        options.cwd,
        options.home,
        nodeRoot,
        npmCache,
        ...harness,
        ...caDirs,
        ...(options.sandboxRoot ? [options.sandboxRoot] : []),
        ...strings(raw.sandboxRead),
      ]),
      allowWrite: dedupe([
        options.cwd,
        options.home,
        os.tmpdir(),
        "/tmp",
        npmCache,
        ...harness,
        ...strings(raw.sandboxWrite),
      ]),
      denyWrite: [],
    },
  };
}

/** Single-quote for `sh -c`, the one place this module builds a command line
 * rather than an argv. */
function shQuote(parts: string[]): string {
  return parts.map((part) => `'${part.replaceAll("'", `'\\''`)}'`).join(" ");
}

/**
 * The script that runs inside the fence: things 2, 3 and 4, then the
 * adapter. These have to be set INSIDE, after srt's own `--setenv`, which is
 * why the fence is `sh -c` and not the adapter directly.
 */
function innerScript(inner: { command: string; args: string[] }, harness: string): string {
  const exports = [
    // **Thing 2.** srt sets NO_PROXY to include 127.0.0.1 — and inside the
    // sandbox there is no host network, so loopback is the one address that
    // MUST go through its proxy. Left as srt sets it, every call to the
    // daemon fails with ECONNREFUSED.
    "NO_PROXY= no_proxy=",
    // **Thing 3.** Node's built-in fetch ignores the proxy variables unless
    // this says otherwise (experimental in 22.x, which warns on stderr).
    "NODE_USE_ENV_PROXY=1",
  ];
  if (inner.command === "npx" || inner.command.endsWith("/npx")) {
    // **Thing 4.** npm honours its own config over HTTPS_PROXY, so a machine
    // whose npm_config_noproxy lists the registry resolves DNS directly
    // inside the sandbox and fails with EAI_AGAIN. The quotes expand at run
    // time, inside, where srt's proxy address is known.
    exports.push("npm_config_noproxy=", 'npm_config_proxy="$HTTPS_PROXY"', 'npm_config_https_proxy="$HTTPS_PROXY"');
  }
  if (harness === "claude-code") {
    // Not a fix, a tightening: telemetry and update checks would each need a
    // domain in the allow-list, and a summoned turn needs neither.
    exports.push("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1");
  }
  return `export ${exports.join(" ")}; exec ${shQuote([inner.command, ...inner.args])}`;
}

/**
 * The fenced spec. `ensure` is composed rather than dropped: `acp.ts` runs it
 * at spawn and assigns its `{command, args}` over the spec, so an unwrapped
 * return would replace the fence with the bare bridge the moment a builtin
 * refreshed itself.
 */
export function wrapSpec(
  spec: AdapterSpec,
  scan: Pick<SandboxScan, "command" | "args">,
  settingsFile: string,
): AdapterSpec {
  const fence = (inner: { command: string; args: string[] }) => ({
    command: scan.command,
    args: [...scan.args, "--settings", settingsFile, "--", "sh", "-c", innerScript(inner, spec.harness)],
  });
  return {
    harness: spec.harness,
    ...fence(spec),
    ...(spec.env ? { env: spec.env } : {}),
    ...(spec.ensure
      ? { ensure: async (narrate: (line: string) => void) => fence((await spec.ensure!(narrate)) ?? spec) }
      : {}),
  };
}

/** The policy, written where srt reads it. One file per enrolment, rewritten
 * every spawn: the working directory and the harness are the row's, and a
 * stale file would fence the wrong directory. */
export async function writeSandboxSettings(
  home: string,
  key: string,
  policy: SandboxPolicy,
): Promise<string> {
  const dir = path.join(home, "sandbox");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${key.replace(/[^A-Za-z0-9_.-]/g, "-")}.json`);
  await fs.writeFile(file, `${JSON.stringify(policy, null, 2)}\n`);
  return file;
}

/**
 * One line for the rc's start, said only when the fence is actually
 * holding. There is deliberately no line for the ordinary case: the quiet
 * start is a three-line budget kept by a test (`rc.test.ts`, "quiet start:
 * it enables, it does not list"), and an offer is not news. Whether this
 * machine COULD fence is a fact about the machine, so it is read where
 * machine facts are read — `isocan harness`.
 */
export function sandboxLine(scan: SandboxScan): string {
  return (
    `adapters run fenced — srt on ${scan.engine}: each writes only its own directory, ~/.isocan and ` +
    `/tmp, reads nothing else of your home, and reaches only this daemon and its harness's API`
  );
}

/** Why the fence a person asked for cannot be built here. Said as the thing
 * that is missing, never as "sandbox unavailable". */
export function noSandboxLine(scan: SandboxScan): string {
  return `--sandbox was asked for and cannot be honoured here: ${scan.why}`;
}
