import { execFile } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { builtinHarnesses } from "@isocan/api";
import { readConfigFile, updateConfigFile } from "@isocan/server";

/**
 * **Which harness runs an agent that named none** (decided 2026-09-04).
 *
 * An enrolment's rc half carries a harness, or null for "not yet said". Two
 * of the three doors leave it null — the web dialog cannot know, and a plain
 * terminal's `rc add` has no harness of its own — so null used to mean
 * claude-code, which made a pi user's every web-added agent a Claude Code
 * agent, or a boot failure, with nothing saying why.
 *
 * Null now means **the machine's default**, and the machine answers that
 * question by looking, not by being told: a scan of what is installed here
 * against what the rc can bridge. One runnable harness needs no decision.
 * Two need one, asked once at `isocan rc` start (a TTY) and persisted as
 * `defaultHarness` in config.json, or given as `isocan rc --default-harness <name>`
 * (which is also how a launchd start answers). The scan itself is never
 * persisted, so the day a second harness is installed, the rc notices and
 * asks. `isocan harness` prints the same scan for a person or an agent.
 */

/** `config.json`'s hooks: `{"acpAdapters": {"my-harness": ["cmd", "arg"]}}`
 * (the same posture as `harnessVars`: a harness isocan has never heard of
 * works the day it ships) and `{"defaultHarness": "pi"}`. */
interface HarnessConfig {
  acpAdapters?: Record<string, string[] | string>;
  harnessVars?: Record<string, string>;
  defaultHarness?: string;
}

export interface AdapterSpec {
  harness: string;
  command: string;
  args: string[];
  /** Variables the bridge itself needs, laid over the person's environment
   * at spawn — a builtin's knowledge of its own harness, never a person's
   * setting. */
  env?: Record<string, string>;
  /** Make sure the bridge is here before spawning — a builtin fetched on
   * first use rather than shipped. Narrates through the callback. */
  ensure?: (narrate: (line: string) => void) => Promise<void>;
}

/**
 * **Google's ACP server for Antigravity** (2026-09-04): official, listed in
 * the ACP registry, and distributed as a per-platform zip from
 * dl.google.com rather than npm — so it is the one builtin that is fetched
 * into the isocan home on first use instead of by `npx`. The registry's
 * `antigravity-acp/agent.json` is the source of these URLs and of the
 * Linux `--uid=` quirk. It authenticates by `GEMINI_API_KEY` (its
 * `gemini-api-key` method; `acp.ts` answers the login refusal with it) —
 * the Google-account method needs a browser and an eligible account, and
 * refused the first account it was tried with (research/2026-09-04).
 */
export const ANTIGRAVITY = {
  version: "1.1.1",
  archives: {
    "darwin-arm64": {
      url: "https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-agy_acp_server_1.1.1-darwin-arm64.zip",
      cmd: "agy_acp_server.par",
      args: [] as string[],
    },
    "linux-x64": {
      url: "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-agy_acp_server_1.1.1-linux-x86_64.zip",
      cmd: "agy_acp_server.par",
      args: ["--uid="],
    },
    "linux-arm64": {
      url: "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-agy_acp_server_1.1.1-linux-arm64.zip",
      cmd: "agy_acp_server.par",
      args: ["--uid="],
    },
    "win32-x64": {
      url: "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-agy_acp_server_1.1.1-windows-x86_64.zip",
      cmd: "agy_acp_server.exe",
      args: [] as string[],
    },
    "win32-arm64": {
      url: "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-agy_acp_server_1.1.1-windows-arm64.zip",
      cmd: "agy_acp_server.exe",
      args: [] as string[],
    },
  } as Record<string, { url: string; cmd: string; args: string[] }>,
};

const platformKey = () => `${process.platform}-${process.arch}`;

export const antigravityDir = (home: string) => path.join(home, "adapters", "antigravity", ANTIGRAVITY.version);

/** The server's executable, if this platform has one; null where Google
 * ships none. */
function antigravityArchive(): { url: string; cmd: string; args: string[] } | null {
  return ANTIGRAVITY.archives[platformKey()] ?? null;
}

export async function antigravityInstalled(home: string): Promise<boolean> {
  const archive = antigravityArchive();
  if (!archive) return false;
  try {
    await fs.access(path.join(antigravityDir(home), archive.cmd), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch and unpack the server into the isocan home, once. `unzip` does the
 * unpacking (the archive is 300 MB; a pure-JS unzip of that is not worth
 * owning). The zip lands beside the result and is removed after, so a
 * failed fetch leaves no half-server that `antigravityInstalled` believes.
 */
export async function ensureAntigravityServer(
  home: string,
  narrate: (line: string) => void,
  options: { url?: string } = {},
): Promise<void> {
  if (await antigravityInstalled(home)) return;
  const archive = antigravityArchive();
  if (!archive) throw new Error(`Google ships no Antigravity ACP server for ${platformKey()}`);
  const dir = antigravityDir(home);
  await fs.mkdir(dir, { recursive: true });
  const url = options.url ?? archive.url;
  narrate(`fetching Google's Antigravity ACP server ${ANTIGRAVITY.version} (about 300 MB, once) → ${dir}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetching ${url}: HTTP ${res.status}`);
  const zip = path.join(dir, "server.zip");
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(zip));
  try {
    await promisify(execFile)("unzip", ["-o", "-q", zip, "-d", dir]);
  } catch (err) {
    throw new Error(`unpacking the Antigravity server needs \`unzip\` on the PATH — ${(err as Error).message}`);
  } finally {
    await fs.rm(zip, { force: true });
  }
  await fs.chmod(path.join(dir, archive.cmd), 0o755).catch(() => {});
  if (!(await antigravityInstalled(home))) {
    throw new Error(`the Antigravity server archive did not contain ${archive.cmd}`);
  }
  narrate(`Antigravity ACP server ${ANTIGRAVITY.version} ready`);
}

/** Adapters isocan knows without being told. `npx -y` so the adapter is
 * fetched on first use rather than shipped — isocan must not own a copy of
 * somebody's harness bridge. Antigravity's is fetched too, from Google
 * rather than npm (`builtinAdapter`). */
const BUILTIN_ADAPTERS: Record<string, Omit<AdapterSpec, "harness">> = {
  "claude-code": { command: "npx", args: ["-y", "@zed-industries/claude-code-acp"] },
  // `pi-acp` bridges ACP to `pi --mode rpc`; it needs `pi` on the PATH
  // (`PI_ACP_PI_COMMAND` points it elsewhere). Verified 2026-09-04 against
  // pi-acp 0.0.33 / pi 0.84.2 — see acp.ts's module comment.
  pi: { command: "npx", args: ["-y", "pi-acp"] },
  // `@agentclientprotocol/codex-acp` bundles its own codex and reads the
  // ChatGPT login from `~/.codex`. Verified 2026-09-04 against 1.10.0 /
  // codex 0.147.0. Its default sandbox refuses LOOPBACK network — the CLI
  // inside could not reach the daemon (curl exit 7 with it up) — so the
  // bridge runs in full-access mode: the same provisional trust the rc
  // already extends by auto-allowing every permission (acp.ts). NO_BROWSER
  // because a summoned session has nobody to finish a browser login.
  codex: {
    command: "npx",
    args: ["-y", "@agentclientprotocol/codex-acp"],
    env: { INITIAL_AGENT_MODE: "agent-full-access", NO_BROWSER: "1" },
  },
};

/** The builtin for a harness, or null. A function because Antigravity's
 * command is a path inside the home. */
function builtinAdapter(home: string, name: string): Omit<AdapterSpec, "harness"> | null {
  if (name === "antigravity") {
    const archive = antigravityArchive();
    if (!archive) return null;
    return {
      command: path.join(antigravityDir(home), archive.cmd),
      args: archive.args,
      ensure: (narrate) => ensureAntigravityServer(home, narrate),
    };
  }
  return BUILTIN_ADAPTERS[name] ?? null;
}

/** What "installed" means per harness: the harness's own executable on the
 * PATH. The bridge is fetched on first use, so it is never what is looked
 * for. Absent here means the scan cannot tell (an IDE, a declared adapter). */
const HARNESS_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  pi: "pi",
  codex: "codex",
};

/** Antigravity is the exception: neither `agy` on the PATH nor the IDE
 * implies the ACP server, which is its own download with its own login.
 * Installed means the server is in the home. */
async function installedProbe(home: string, name: string, env: NodeJS.ProcessEnv): Promise<boolean | null> {
  if (name === "antigravity") return antigravityInstalled(home);
  const bin = HARNESS_BINARIES[name];
  return bin ? onPath(bin, env) : null;
}

export interface HarnessRow {
  name: string;
  /** The harness's executable is on the PATH; null when there is nothing to
   * look for. */
  installed: boolean | null;
  /** Where the rc would get its bridge from, or null: known but unrunnable. */
  adapter: "builtin" | "config" | null;
  /** Could run here: a declared adapter (deliberate, so believed as is), or
   * a builtin one whose harness is not known to be absent. */
  runnable: boolean;
  /** The one an agent that named no harness runs on. */
  default: boolean;
}

export interface HarnessScan {
  rows: HarnessRow[];
  default: HarnessRow | null;
  /** How the default was settled: persisted, or the only choice. */
  source: "config" | "only" | null;
  /** A persisted default the scan could not honour — named, so the person
   * hears that their choice was set aside rather than silently replaced. */
  ignored: string | null;
}

async function onPath(bin: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    try {
      await fs.access(path.join(dir, bin), fs.constants.X_OK);
      return true;
    } catch {
      // not here
    }
  }
  return false;
}

function declaredAdapter(
  raw: HarnessConfig,
  name: string,
): Omit<AdapterSpec, "harness"> | null {
  const declared = raw.acpAdapters?.[name];
  if (typeof declared === "string" && declared.trim()) {
    const [command, ...args] = declared.trim().split(/\s+/);
    return { command: command!, args };
  }
  if (Array.isArray(declared) && declared.length > 0 && declared.every((p) => typeof p === "string")) {
    return { command: declared[0]!, args: declared.slice(1) };
  }
  return null;
}

/** Everything this machine could run, and which one it runs by default.
 * A fact about the machine — no daemon is consulted. `env` is a parameter
 * so a test can hand it a PATH. */
export async function scanHarnesses(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HarnessScan> {
  const raw = await readConfigFile<HarnessConfig>(home);
  const names = new Set<string>([
    ...builtinHarnesses,
    ...Object.keys(raw.acpAdapters ?? {}),
    ...Object.keys(raw.harnessVars ?? {}),
  ]);
  const rows: HarnessRow[] = [];
  for (const name of names) {
    const installed = await installedProbe(home, name, env);
    const adapter = declaredAdapter(raw, name) ? "config" : builtinAdapter(home, name) ? "builtin" : null;
    const runnable = adapter === "config" || (adapter === "builtin" && installed !== false);
    rows.push({ name, installed, adapter, runnable, default: false });
  }
  const runnable = rows.filter((r) => r.runnable);
  const wanted = typeof raw.defaultHarness === "string" ? raw.defaultHarness.trim() : "";
  const chosen = wanted ? runnable.find((r) => r.name === wanted) ?? null : null;
  const settled = chosen ?? (runnable.length === 1 ? runnable[0]! : null);
  if (settled) settled.default = true;
  return {
    rows,
    default: settled,
    source: chosen ? "config" : settled ? "only" : null,
    ignored: wanted && !chosen ? wanted : null,
  };
}

/** `isocan rc --default-harness <name>`'s write: the answer, kept. */
export async function setDefaultHarness(home: string, name: string): Promise<void> {
  await updateConfigFile<HarnessConfig>(home, { defaultHarness: name });
}

/** The adapter for a harness — config first, then builtin — or, for a null
 * harness ("not yet said"), the machine's default. Null when nothing can
 * answer; the caller owes a refusal, and `noDefaultLine` words the null
 * case. */
export async function adapterFor(
  home: string,
  harness: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdapterSpec | null> {
  const wanted = harness ?? (await scanHarnesses(home, env)).default?.name ?? null;
  if (!wanted) return null;
  const raw = await readConfigFile<HarnessConfig>(home);
  const spec = declaredAdapter(raw, wanted) ?? builtinAdapter(home, wanted) ?? null;
  return spec ? { harness: wanted, ...spec } : null;
}

/** One line for the rc's start, saying what an unnamed harness means here. */
export function defaultLine(scan: HarnessScan): string {
  if (scan.default && scan.source === "config") {
    return `agents that named no harness run on ${scan.default.name} (config.json's defaultHarness)`;
  }
  if (scan.default) {
    return `${scan.default.name} is the only harness here — agents that named no harness run on it`;
  }
  return noDefaultLine(scan);
}

/** Why an agent that named no harness cannot run here — said as what it
 * is for, never as "no default", which names a config key and nothing a
 * person can see — and what settles it. */
export function noDefaultLine(scan: HarnessScan): string {
  const runnable = scan.rows.filter((r) => r.runnable).map((r) => r.name);
  const ignored = scan.ignored ? `config.json's defaultHarness "${scan.ignored}" is not runnable here; ` : "";
  if (runnable.length === 0) {
    return (
      `${ignored}no harness found on this machine — install pi (npm i -g @earendil-works/pi-coding-agent) ` +
      `or Claude Code, or declare an adapter in ~/.isocan/config.json ` +
      `({"acpAdapters": {"<harness>": ["cmd", "arg"]}})`
    );
  }
  return (
    `${ignored}${runnable.length} harnesses here (${runnable.join(", ")}); an agent added without naming one ` +
    `can't run until \`isocan rc --default-harness <name>\` picks which`
  );
}

/** The start line when two could run, none is picked, and nothing needs
 * it yet: the fact, without the flag — that belongs in the refusal, where
 * it is the next thing to type. */
export function noNeedLine(scan: HarnessScan): string {
  const runnable = scan.rows.filter((r) => r.runnable).map((r) => r.name);
  const ignored = scan.ignored ? `config.json's defaultHarness "${scan.ignored}" is not runnable here; ` : "";
  return `${ignored}${runnable.length} harnesses here (${runnable.join(", ")}); every agent enrolled here named its own`;
}
