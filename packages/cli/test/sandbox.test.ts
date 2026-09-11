import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  noSandboxLine,
  policyFor,
  sandboxAsked,
  sandboxLine,
  scanSandbox,
  wrapSpec,
  writeSandboxSettings,
} from "../src/sandbox.ts";

/**
 * **The fence around a summoned agent** (`sandbox.ts`), tested as what it
 * is: a policy derived from an enrolment, and a command line that carries
 * the six things the 11 Sep spike found a wrapper has to know
 * (`docs/research/2026-09-10-what-the-rc-hands-over.md`).
 *
 * Every one of those six is a SILENT failure in the field — a bridge whose
 * listeners die into /dev/null, a `NO_PROXY` that excludes the only
 * reachable address, a session that quietly stops resuming — so each gets
 * an assertion here rather than a comment. The end-to-end proof (a real
 * adapter, really fenced) is `acp.test.ts`'s opt-in pair, because it needs
 * bubblewrap and a login.
 */

let home: string;
let cwd: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-fence-home-"));
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-fence-proj-"));
});

afterEach(async () => {
  for (const dir of [home, cwd]) {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

const config = (value: object) => fs.writeFile(path.join(home, "config.json"), JSON.stringify(value));

const policy = (over: Partial<Parameters<typeof policyFor>[0]> = {}) =>
  policyFor({
    cwd,
    home,
    daemon: "http://127.0.0.1:4711",
    harness: "claude-code",
    npx: true,
    ...over,
  });

describe("what the policy allows, and what it does not", () => {
  it("writes the work, the home and /tmp — and nothing else of the person's", async () => {
    const p = await policy();
    expect(p.filesystem.allowWrite).toContain(cwd);
    expect(p.filesystem.allowWrite).toContain(home);
    expect(p.filesystem.allowWrite).toContain("/tmp");
    // The sweep that makes the carve-outs mean something: without this
    // line, "allowRead" is decoration — srt reads allow-by-default.
    expect(p.filesystem.denyRead).toEqual([os.homedir()]);
    for (const secret of [path.join(os.homedir(), ".ssh"), path.join(os.homedir(), ".aws")]) {
      expect(p.filesystem.allowRead).not.toContain(secret);
      expect(p.filesystem.allowWrite).not.toContain(secret);
    }
  });

  it("re-allows the harness's own directory, or sessions stop resuming (thing 5)", async () => {
    // Measured: with ~ denied and this missing, Claude's session store
    // lands on the sandbox's tmpfs and every turn says "the stored one
    // would not load — rebuilt" — the agent's memory reset by the fence.
    const claude = await policy({ harness: "claude-code" });
    expect(claude.filesystem.allowRead).toContain(path.join(os.homedir(), ".claude"));
    expect(claude.filesystem.allowWrite).toContain(path.join(os.homedir(), ".claude"));
    expect(claude.filesystem.allowWrite).toContain(path.join(os.homedir(), ".claude.json"));
    // Each harness keeps its own somewhere else, and the variable that
    // relocates it is honoured — a person with CLAUDE_CONFIG_DIR set would
    // otherwise be fenced away from their own login.
    const moved = await policy({ env: { ...process.env, CLAUDE_CONFIG_DIR: "/opt/claude-work" } });
    expect(moved.filesystem.allowWrite).toContain("/opt/claude-work");
    expect((await policy({ harness: "codex" })).filesystem.allowWrite).toContain(path.join(os.homedir(), ".codex"));
    expect((await policy({ harness: "pi" })).filesystem.allowWrite).toContain(path.join(os.homedir(), ".pi"));
    // A harness isocan has never heard of gets no guess — and the hook is
    // how a person says, which is the whole `harnessVars` posture.
    const unknown = await policy({ harness: "my-harness" });
    expect(unknown.filesystem.allowWrite).toEqual([
      ...new Set([cwd, home, os.tmpdir(), "/tmp", path.join(os.homedir(), ".npm")]),
    ]);
  });

  it("re-allows the sandbox's own files, which would otherwise vanish mid-launch (thing 6)", async () => {
    // The spike's sharpest surprise: srt installed globally under a version
    // manager, or cached by npx, lives under $HOME — so a policy denying
    // $HOME hides srt's own seccomp helper from the sandbox srt is building,
    // and the launch dies with "No such file or directory" naming a path
    // that is plainly there.
    const p = await policy({ sandboxRoot: "/root/.nvm/versions/node/v22/lib/node_modules/@anthropic-ai/sandbox-runtime" });
    expect(p.filesystem.allowRead).toContain(
      "/root/.nvm/versions/node/v22/lib/node_modules/@anthropic-ai/sandbox-runtime",
    );
  });

  it("reaches this daemon and the harness's API, by literal and by name", async () => {
    const loopback = await policy();
    // srt allows an IP literal as an explicit choice, which is exactly what
    // a local daemon is. Both spellings, because a client may use either.
    expect(loopback.network.allowedDomains).toContain("127.0.0.1:4711");
    expect(loopback.network.allowedDomains).toContain("localhost:4711");
    expect(loopback.network.allowedDomains).toContain("api.anthropic.com");
    // npx is in the path for a builtin bridge, so the registry is too —
    // and only then.
    expect(loopback.network.allowedDomains).toContain("registry.npmjs.org");
    expect((await policy({ npx: false })).network.allowedDomains).not.toContain("registry.npmjs.org");
    // A hosted home is a hostname, not a literal.
    const hosted = await policy({ daemon: "https://isocan.io" });
    expect(hosted.network.allowedDomains).toContain("isocan.io");
    expect(hosted.network.allowedDomains).not.toContain("127.0.0.1:4711");
    // Nothing else: the allow-list is the whole network.
    expect(loopback.network.allowedDomains).not.toContain("github.com");
    // pi's model is the person's choice, so pi gets every vendor rather
    // than a guess at one.
    const pi = await policy({ harness: "pi" });
    expect(pi.network.allowedDomains).toContain("api.anthropic.com");
    expect(pi.network.allowedDomains).toContain("api.openai.com");
    // Left off deliberately (srt issue #88, and the literal already works).
    expect(loopback.network.allowLocalBinding).toBe(false);
  });

  it("takes what config.json adds, and ignores what it malforms", async () => {
    await config({
      sandboxDomains: ["models.example.com", "", 7],
      sandboxRead: ["/work/shared"],
      sandboxWrite: ["/work/shared/out"],
    });
    const p = await policy();
    expect(p.network.allowedDomains).toContain("models.example.com");
    expect(p.network.allowedDomains).not.toContain("");
    expect(p.filesystem.allowRead).toContain("/work/shared");
    expect(p.filesystem.allowWrite).toContain("/work/shared/out");
  });
});

describe("the command line the fence builds", () => {
  const spec = { harness: "claude-code", command: "npx", args: ["-y", "@agentclientprotocol/claude-agent-acp@0.76.0"] };
  const scan = { command: "/usr/local/bin/srt", args: [] };

  it("carries the three variables that have to be set INSIDE (things 2, 3 and 4)", () => {
    const wrapped = wrapSpec(spec, scan, "/home/n/.isocan/sandbox/prj-usr.json");
    expect(wrapped.command).toBe("/usr/local/bin/srt");
    expect(wrapped.args.slice(0, 3)).toEqual(["--settings", "/home/n/.isocan/sandbox/prj-usr.json", "--"]);
    // `sh -c` and not the adapter directly, because these have to land
    // AFTER srt's own --setenv.
    expect(wrapped.args[3]).toBe("sh");
    expect(wrapped.args[4]).toBe("-c");
    const script = wrapped.args[5]!;
    // Thing 2: srt sets NO_PROXY to include 127.0.0.1 — the one address
    // that must go through its proxy, since the sandbox has no host network.
    expect(script).toContain("NO_PROXY= no_proxy=");
    // Thing 3: Node's fetch ignores the proxy variables unless told.
    expect(script).toContain("NODE_USE_ENV_PROXY=1");
    // Thing 4: npm honours its own config over HTTPS_PROXY, and expands
    // the address at run time, inside.
    expect(script).toContain('npm_config_proxy="$HTTPS_PROXY"');
    expect(script).toContain("npm_config_noproxy=");
    // The adapter itself, quoted, and exec'd so no shell lingers between
    // the fence and the bridge whose stdio the rc is speaking.
    expect(script).toContain("exec 'npx' '-y' '@agentclientprotocol/claude-agent-acp@0.76.0'");
  });

  it("asks npm for nothing when the bridge is not an npx one", () => {
    const binary = { harness: "antigravity", command: "/home/n/.isocan/adapters/a/1/agy_acp_server.par", args: ["--uid="] };
    const script = wrapSpec(binary, scan, "/f.json").args[5]!;
    expect(script).not.toContain("npm_config");
    expect(script).toContain("exec '/home/n/.isocan/adapters/a/1/agy_acp_server.par' '--uid='");
  });

  it("keeps the bridge's own environment, and re-fences whatever `ensure` returns", async () => {
    // `acp.ts` runs `ensure` at spawn and assigns its {command, args} over
    // the spec. An unwrapped return would replace the fence with the bare
    // bridge exactly when a builtin refreshed itself — the fence would be
    // there in tests and gone on the day the registry moved.
    const refreshing = {
      ...spec,
      env: { INITIAL_AGENT_MODE: "agent-full-access" },
      ensure: async () => ({ command: "npx", args: ["-y", "@agentclientprotocol/claude-agent-acp@0.77.0"] }),
    };
    const wrapped = wrapSpec(refreshing, scan, "/f.json");
    expect(wrapped.env).toEqual({ INITIAL_AGENT_MODE: "agent-full-access" });
    const fresh = await wrapped.ensure!(() => {});
    expect(fresh?.command).toBe("/usr/local/bin/srt");
    expect(fresh?.args.at(-1)).toContain("@agentclientprotocol/claude-agent-acp@0.77.0");
    expect(fresh?.args.at(-1)).toContain("NODE_USE_ENV_PROXY=1");
  });

  it("writes the policy where srt reads it, one file per enrolment", async () => {
    const file = await writeSandboxSettings(home, "prj_1/usr_2", await policy());
    // The key is a pair of ids and lands as one safe filename.
    expect(file).toBe(path.join(home, "sandbox", "prj_1-usr_2.json"));
    expect(JSON.parse(await fs.readFile(file, "utf8")).filesystem.allowWrite).toContain(cwd);
  });
});

describe("asking for a fence, and being told why there is none", () => {
  it("is off unless asked, and the flags outrank the standing answer", async () => {
    expect(await sandboxAsked(home, {})).toBe(false);
    expect(await sandboxAsked(home, { sandbox: true })).toBe(true);
    await config({ sandbox: true });
    expect(await sandboxAsked(home, {})).toBe(true);
    expect(await sandboxAsked(home, { unsandboxed: true })).toBe(false);
  });

  it("refuses a kernel with no IPv6, because srt's bridge would fail silently (thing 1)", async () => {
    // The failure nothing prints: srt's inner `socat TCP-LISTEN` opens an
    // AF_INET6 socket, and on a kernel without IPv6 both listeners exit
    // into /dev/null, leaving every call refused "after 0 ms". Measured on
    // a Firecracker guest, 11 Sep 2026, srt 0.0.76. A machine like that is
    // told, not fenced.
    const scan = await scanSandbox(home, { PATH: "/nowhere" }, "linux");
    expect(scan.can).toBe(false);
    // …though on this runner the missing binaries are named first, which is
    // the same contract: say the thing that is missing.
    expect(scan.why).toMatch(/bwrap|IPv6/);
    expect(noSandboxLine(scan)).toContain("--sandbox was asked for and cannot be honoured here");
  });

  it("names what is missing and what installs it, per platform", async () => {
    const linux = await scanSandbox(home, { PATH: "/nowhere" }, "linux");
    expect(linux.why).toContain("apt install bubblewrap socat ripgrep");
    const mac = await scanSandbox(home, { PATH: "/nowhere" }, "darwin");
    expect(mac.engine).toBe("Seatbelt");
    expect(mac.why).toContain("brew install ripgrep");
    // Windows is srt's alpha and wants an elevated install — said as that,
    // with the way round it, rather than as a bare refusal.
    const windows = await scanSandbox(home, {}, "win32");
    expect(windows.can).toBe(false);
    expect(windows.why).toContain("WSL2");
  });

  it("takes a declared sandbox command, so a machine can bring its own", async () => {
    // Believed as it stands, and NOT held to srt's requirements: a person
    // who declared a jail is not missing ripgrep. Asserted on a PATH with
    // nothing on it at all, and on the platform srt itself refuses.
    await config({ sandboxCommand: ["my-jail", "--strict"] });
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const scan = await scanSandbox(home, { PATH: "/nowhere" }, platform);
      expect(scan).toMatchObject({ can: true, command: "my-jail", args: ["--strict"], engine: "a declared sandbox" });
    }
    // The string spelling too, the way acpAdapters takes one.
    await config({ sandboxCommand: "my-jail --strict" });
    expect(await scanSandbox(home, { PATH: "/nowhere" }, "linux")).toMatchObject({
      can: true,
      command: "my-jail",
      args: ["--strict"],
    });
  });

  it("says what the fence holds, in one line, and only when it holds", async () => {
    // The rc's quiet start is a three-line budget kept by a test of its
    // own, so there is no line for the ordinary case and no offer at every
    // start — `isocan harness` answers "could this machine fence?".
    const can = { can: true, why: null, engine: "bubblewrap", command: "srt", args: [], root: null };
    const line = sandboxLine(can);
    expect(line).toContain("fenced — srt on bubblewrap");
    expect(line).toContain("writes only its own directory");
    expect(line.split("\n")).toHaveLength(1);
  });
});
