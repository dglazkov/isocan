import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { readKeyFile, writeKey } from "@isocan/core/keystore";
import { agentKeyEnv } from "@isocan/core/keys";
import { AcpAgentProcess, adapterEnv } from "../src/acp.ts";
import { adapterFor } from "../src/harnesses.ts";
import { agentSessionOf, machineAgentKey } from "../src/agent-key.ts";
import { rcAgentsFile, type RcAgentRow } from "../src/rc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { cliEnv, collect, spawnCli as startCli } from "./cli.ts";

/**
 * **The ACP client in the rc** (agents-on-demand phase 3), driven end to end
 * against a scripted adapter that speaks the wire shapes the phase's spike
 * verified on the real `claude-code-acp` (see the spike record in
 * design.md): ndjson JSON-RPC, protocolVersion 1, session/new and
 * session/load, a permission request mid-turn, `stopReason: "end_turn"`.
 *
 * What these pin:
 * - a turn completes and its stopReason is read (the phase's outcome)
 * - the session survives the process: the resume handle lands in the rc
 *   half, and the second turn goes through session/load
 * - a load that fails transiently (the violent-death shape the spike
 *   caught) is retried, not surrendered to
 * - identity travels by injection: the environment inside the adapter
 *   presents exactly the enrolment's claim key, so the CLI inside speaks
 *   as the enrolled actor — asserted against the daemon's actor bindings
 * - a web-enrolled agent (home half only) gets its rc half and its
 *   machine-badge binding from the turn itself
 *
 * The REAL adapter is not spawned here — it needs credentials and spends
 * money — except under ISOCAN_REAL_ACP=1 (claude-code) or
 * ISOCAN_REAL_ACP=pi|codex, which runs one true turn in that harness.
 */

const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
const dimitri = { id: "usr_dimitri", name: "Dimitri" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-acp-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  // The adapter hook, pointed at the scripted agent — the same config.json
  // door any unknown harness uses.
  await fs.writeFile(
    path.join(home, "config.json"),
    JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { fake: [process.execPath, fakeAcp] } }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(dimitri);
  await post("/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "project.create", canvasId: "prj_1", title: "P" },
  });
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  return startCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv }) });
}

const isocan = (...args: string[]) => collect(spawnCli(args));

async function rcRows(): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}

describe("a turn in a named agent (phase 3)", () => {
  it("completes a turn, reads end_turn, and the injected identity is the enrolment key", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const run = await isocan("rc", "turn", "Sian", "say", "hello");
    expect(run.code).toBe(0);
    expect(run.stderr).toContain("turn ended — end_turn");
    // The scripted agent echoes its environment: the harness/session pair
    // the CLI inside would present — exactly the mint claim's key, which
    // this machine's agent secret derives and the name alone does not.
    const key = await machineAgentKey(home, "Sian");
    expect(run.stdout).toContain(`env:${key} `);
    expect(run.stdout).not.toContain("env:agent:Sian");
    expect(run.stdout).toContain("echo:say hello");
    // The permission flow ran, and the client chose the allow option.
    expect(run.stdout).toContain("permission:yes");
    // …and the proof that matters: a CLI run the way a shell INSIDE the
    // agent's session runs it — the injected environment, nothing else —
    // resolves as the enrolled Sian.
    const inside = await collect(
      spawnCli(["whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: agentSessionOf(key) }),
    );
    expect(inside.stdout).toContain("Sian");
  }, 30_000);

  it("a permission is granted for this call only — never by index, never a mode switch", async () => {
    // The Claude adapter's plan-exit prompt: every option allow_always
    // and each one a mode switch, bypass among them. The old answer (the
    // first option matching /allow/) chose one. The answer is by kind:
    // no allow_once here, so the agent's own reject — and the narration
    // says what was offered and why it was refused.
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hello"], { FAKE_ACP_PERMISSION: "plan-exit" }));
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("permission:reject");
    expect(run.stderr).toContain("refused: no allow-once option (offered: exit-plan-auto, exit-plan-bypass, exit-plan-default, reject)");
    // …and the everyday prompt, reject listed first, still gets its yes:
    // kind chooses, not position (the first test above pins this too).
    const plain = await isocan("rc", "turn", "Sian", "again");
    expect(plain.stdout).toContain("permission:yes");
  }, 40_000);

  it("a native Codex fence refuses even allow-once escalation", async () => {
    const agent = await AcpAgentProcess.spawn({ harness: "codex", command: process.execPath, args: [fakeAcp], nativeCodexSandbox: true, sessionDirectories: [home] }, { cwd: home, env: { ...process.env, FAKE_ACP_VERSION: "1.11.0", FAKE_ACP_EXPECT_ROOT: home } });
    try {
      const session = await agent.ensureSession(home, null);
      await agent.ensureSession(home, session.sessionId);
      const events: string[] = [];
      const answer = await agent.prompt(session.sessionId, "hello", (event) => events.push(event.detail ?? ""));
      expect(events.join("\n")).toContain("sandbox cannot be escalated");
      expect(answer.text).toContain("permission:deny");
    } finally { agent.close(); }
  });

  it("the adapter's environment is a list, not the shell: needs pass, accidents do not, the hook adds", () => {
    const shell: NodeJS.ProcessEnv = {
      PATH: "/usr/bin",
      HOME: "/Users/nico",
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy:3128",
      ISOCAN_HOME_URL: "https://isocan.io",
      ANTHROPIC_API_KEY: "sk-ant",
      OPENAI_API_KEY: "sk-oai",
      GEMINI_API_KEY: "g",
      CLAUDE_CONFIG_DIR: "/Users/nico/.claude-work",
      npm_config_cache: "/tmp/npm",
      // The accidents: exported for something else, never for an agent.
      AWS_SECRET_ACCESS_KEY: "aws",
      GITHUB_TOKEN: "gh",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
      DATABASE_URL: "postgres://",
      // A harness variable, and the nested-session guard's tripwire.
      CLAUDE_CODE_SESSION_ID: "stale",
      CLAUDECODE: "1",
      // What the hook names: one exact, one by prefix.
      MY_HARNESS_TOKEN: "t",
      FAKE_ACP_CRASH: "no",
      FAKE_OTHER: "x",
    };
    const env = adapterEnv("prj_1", "Sian", { source: shell, pass: ["MY_HARNESS_TOKEN", "FAKE_ACP_*"] });
    expect(env).toMatchObject({
      PATH: "/usr/bin",
      HOME: "/Users/nico",
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy:3128",
      ISOCAN_HOME_URL: "https://isocan.io",
      ANTHROPIC_API_KEY: "sk-ant",
      OPENAI_API_KEY: "sk-oai",
      GEMINI_API_KEY: "g",
      CLAUDE_CONFIG_DIR: "/Users/nico/.claude-work",
      npm_config_cache: "/tmp/npm",
      MY_HARNESS_TOKEN: "t",
      FAKE_ACP_CRASH: "no",
      ISOCAN_HARNESS: "agent",
      ISOCAN_SESSION_ID: "Sian",
      ISOCAN_CANVAS: "prj_1",
    });
    for (const name of ["AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN", "SSH_AUTH_SOCK", "DATABASE_URL", "CLAUDE_CODE_SESSION_ID", "CLAUDECODE", "FAKE_OTHER"]) {
      expect(env).not.toHaveProperty(name);
    }
    // Without the hook, the hook's names stay behind too.
    expect(adapterEnv("prj_1", "Sian", { source: shell })).not.toHaveProperty("MY_HARNESS_TOKEN");
  });

  it("a fence asked for and not buildable is refused, not quietly run open", async () => {
    // The rule the module's comment states: one word cannot also mean its
    // opposite. On a machine that cannot fence, `--sandbox` fails and names
    // what is missing — it does not start the agent with the person's reach.
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const refused = await isocan("rc", "turn", "--sandbox", "Sian", "hello");
    expect(refused.code).toBe(1);
    // This runner may be able to fence; only assert the shape it takes when
    // it cannot, which is the half that must never be silent.
    if (refused.stderr.includes("--sandbox was asked for")) {
      expect(refused.stderr).toMatch(/srt is not on the PATH|bwrap|IPv6|ripgrep/);
      expect(refused.stderr).not.toContain("turn ended");
    }
  }, 30_000);

  /**
   * **The fence, for real** — opt-in, because it needs a working srt and,
   * on Linux, bubblewrap. `ISOCAN_REAL_SANDBOX=<srt command>` names one
   * (a path, or a command line), and it is declared through
   * `config.json`'s `sandboxCommand`, so this runs on a machine whose srt
   * needs a wrapper — which is how it was first run: the 11 Sep spike's
   * host has no IPv6, so its srt is a patched one the scan rightly refuses.
   *
   * What it pins is the pair of facts the whole layer rests on, in ONE
   * turn: the daemon is still reachable from inside, and the person's home
   * is not.
   */
  it.runIf(process.env.ISOCAN_REAL_SANDBOX)(
    "a fenced adapter reaches the daemon, and cannot read the person's home",
    async () => {
      const canary = path.join(os.homedir(), ".isocan-fence-canary");
      await fs.writeFile(canary, "the person's own file");
      try {
        await fs.writeFile(
          path.join(home, "config.json"),
          JSON.stringify({
            acpAdapters: { fake: [process.execPath, fakeAcp] },
            sandboxCommand: process.env.ISOCAN_REAL_SANDBOX!.trim().split(/\s+/),
            // The scripted adapter and the CLI it runs live in the
            // checkout, which is nobody's working directory — the hook
            // doing exactly the job it exists for.
            sandboxRead: [fileURLToPath(new URL("../../..", import.meta.url))],
            adapterEnv: ["FAKE_ACP_*"],
          }),
        );
        await isocan("rc", "add", "Sian", "--harness", "fake");
        const run = await collect(
          spawnCli(["rc", "turn", "--sandbox", "Sian", "hello"], {
            FAKE_ACP_PROBE: canary,
            FAKE_ACP_REPLY: "0",
          }),
        );
        expect(run.stderr).toContain("fenced");
        expect(run.stderr).toContain("turn ended — end_turn");
        // Reachable: the adapter ran and the injected identity arrived, so
        // the fence did not break the one connection the agent needs.
        expect(run.stdout).toContain(`env:${await machineAgentKey(home, "Sian")} `);
        // Fenced: the person's own file is not readable from inside, and
        // the refusal is the filesystem's, not a guess.
        expect(run.stdout).toMatch(/probe:refused:ENOENT|probe:refused:EACCES/);
        expect(run.stdout).not.toContain("the person's own file");
      } finally {
        await fs.rm(canary, { force: true });
      }
    },
    120_000,
  );

  it("pi ships known: `--harness pi` resolves to the pi-acp adapter without config", async () => {
    // The registry's current pi-acp, pinned to the version the index names.
    expect(await adapterFor(home, "pi")).toMatchObject({
      harness: "pi",
      command: "npx",
      args: ["-y", expect.stringMatching(/^pi-acp@\d/)],
    });
    // The config hook still wins over the builtin, as it does for claude-code.
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { pi: ["pi-acp", "--flag"], fake: [process.execPath, fakeAcp] } }),
    );
    expect(await adapterFor(home, "pi")).toEqual({ harness: "pi", command: "pi-acp", args: ["--flag"] });
  });

  it("codex ships known, and its bridge carries the sandbox mode the CLI inside needs", async () => {
    const spec = await adapterFor(home, "codex");
    expect(spec).toMatchObject({
      harness: "codex",
      command: "npx",
      args: ["-y", expect.stringMatching(/^@agentclientprotocol\/codex-acp@\d/)],
    });
    expect(spec?.env).toEqual({ INITIAL_AGENT_MODE: "agent-full-access", NO_BROWSER: "1" });
    // …and a spec's env reaches the spawned bridge: the scripted adapter
    // told to die at boot through its environment, dies at boot.
    await expect(
      AcpAgentProcess.spawn(
        { harness: "fake", command: process.execPath, args: [fakeAcp], env: { FAKE_ACP_CRASH: "boot" } },
        { cwd: home, env: adapterEnv("prj_1", "Sian") },
      ),
    ).rejects.toThrow(/exited \(code 1\)/);
  });

  it("an adapter that wants a login gets it from the environment, or says which variable would", async () => {
    // Google's Antigravity server, scripted: session verbs refuse with
    // "Authentication required" until `authenticate` names gemini-api-key,
    // which the server itself answers from GEMINI_API_KEY.
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const wants = { FAKE_ACP_AUTH: "gemini-api-key", GEMINI_API_KEY: "" };
    const refused = await collect(spawnCli(["rc", "turn", "Sian", "hello"], wants));
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("Fake wants a login before a session (methods: gemini-api-key)");
    expect(refused.stderr).toContain("export GEMINI_API_KEY for gemini-api-key");
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hello"], { ...wants, GEMINI_API_KEY: "k" }));
    expect(run.code).toBe(0);
    expect(run.stderr).toContain("turn ended — end_turn");
    // …and the login is answered on load too, so the second turn resumes.
    const again = await collect(spawnCli(["rc", "turn", "Sian", "again"], { ...wants, GEMINI_API_KEY: "k" }));
    expect(again.code).toBe(0);
    expect(again.stderr).toContain("resumed");
  }, 40_000);

  it("a summoned agent is handed this machine's stored keys only once the owner opts in, the environment's winning, and nothing prints one", async () => {
    // Keys phase 4. Synthetic keys, each with distinct last four.
    const gemini = "fake-gemini-acme-STORED-DO-NOT-PRINT-g3m1";
    const anthropic = "sk-ant-fake-STORED-DO-NOT-PRINT-an7h";
    const envAnthropic = "sk-ant-fake-ENV-DO-NOT-PRINT-3nvk";
    await writeKey(home, "gemini", gemini);
    await writeKey(home, "anthropic", anthropic);
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const shell = { FAKE_ACP_KEYS: "GEMINI_API_KEY,ANTHROPIC_API_KEY,OPENAI_API_KEY", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" };
    // Off by default: a harness handed a key may bill it instead of the
    // person's login, so nothing is handed over until they ask.
    const off = await collect(spawnCli(["rc", "turn", "Sian", "first"], shell));
    expect(off.code, off.stderr).toBe(0);
    expect(off.stdout).toContain("keys:GEMINI_API_KEY=-,ANTHROPIC_API_KEY=-,OPENAI_API_KEY=- ");
    const turnedOn = await isocan("keys", "agents", "on");
    expect(turnedOn.code, turnedOn.stderr).toBe(0);
    expect(turnedOn.stdout).toContain("billed per call");
    // The keys are kept beside the switch.
    expect(await readKeyFile(home)).toMatchObject({ agents: true, share: false, keys: { gemini: { key: gemini } } });
    // Now the adapter that wants GEMINI_API_KEY to log in, with none in the
    // rc's env: the stored key is what lets the turn start at all.
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hello"], { ...shell, FAKE_ACP_AUTH: "gemini-api-key" }));
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain("keys:GEMINI_API_KEY=g3m1,ANTHROPIC_API_KEY=an7h,OPENAI_API_KEY=- ");
    // The environment wins where it sets the variable.
    const again = await collect(spawnCli(["rc", "turn", "Sian", "again"], { ...shell, FAKE_ACP_AUTH: "gemini-api-key", ANTHROPIC_API_KEY: envAnthropic }));
    expect(again.code, again.stderr).toBe(0);
    expect(again.stdout).toContain("keys:GEMINI_API_KEY=g3m1,ANTHROPIC_API_KEY=3nvk,OPENAI_API_KEY=- ");
    // A key set after the switch keeps it on; `ls --json` says so.
    await writeKey(home, "openai", "sk-acme-STORED-DO-NOT-PRINT-0pen");
    const listed = await isocan("keys", "ls", "--json");
    expect(JSON.parse(listed.stdout)).toMatchObject({ agents: true, share: false });
    for (const out of [off.stdout, off.stderr, run.stdout, run.stderr, again.stdout, again.stderr, listed.stdout, listed.stderr]) {
      for (const secret of [gemini, anthropic, envAnthropic]) expect(out).not.toContain(secret);
    }
  }, 40_000);

  it("adapterEnv adds a stored key only under its harness's variable, and only where the environment has none", () => {
    const stored = {
      anthropic: { key: "sk-ant-stored", addedAt: "" },
      openai: { key: "sk-oai-stored", addedAt: "" },
      gemini: { key: "g-stored", addedAt: "" },
      typesafe: { key: "tsk-stored", addedAt: "" },
    };
    const env = adapterEnv("prj_1", "Sian", { source: { PATH: "/usr/bin", OPENAI_API_KEY: "sk-oai-env", GEMINI_API_KEY: "  " }, keys: (passed) => agentKeyEnv(stored, passed) });
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-stored");
    expect(env.OPENAI_API_KEY).toBe("sk-oai-env");
    // A blank variable is no key: the stored one fills it.
    expect(env.GEMINI_API_KEY).toBe("g-stored");
    // The judge's key is isocan's, never an agent's.
    expect(Object.values(env)).not.toContain("tsk-stored");
    expect(adapterEnv("prj_1", "Sian", { source: { PATH: "/usr/bin" } })).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("an adapter's stderr reaches ours, minus absl's INFO and WARNING chatter", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hello"], { FAKE_ACP_STDERR: "absl" }));
    expect(run.code).toBe(0);
    expect(run.stderr).not.toContain("RAW WS MSG");
    expect(run.stderr).not.toContain("No business auth manager");
    expect(run.stderr).toContain("Onboarding failed with terminal error");
    expect(run.stderr).toContain("fake-acp: a plain complaint");
    // …and all of it on request.
    const loud = await collect(spawnCli(["rc", "turn", "Sian", "hello"], { FAKE_ACP_STDERR: "absl", ISOCAN_ADAPTER_STDERR: "all" }));
    expect(loud.stderr).toContain("RAW WS MSG");
  }, 40_000);

  it("inside a summoned pi, the injected key beats pi's own: whoami and --session both resume the agent", async () => {
    await isocan("rc", "add", "Sian", "--harness", "pi");
    // pi's shells carry PI_SESSION_ID (a fresh uuid) beside the rc's
    // injection — the shape the 2026-09-04 spike measured. Reads pick the
    // bound key; a claim must pick the deliberate one, or the guide's first
    // step (`identity --session`) mints a stranger on pi's key.
    const piShell = { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: agentSessionOf(await machineAgentKey(home, "Sian")), PI_SESSION_ID: "0199-uuid" };
    const who = await collect(spawnCli(["whoami"], piShell));
    expect(who.stdout).toContain("Sian");
    const claim = await collect(spawnCli(["identity", "--session"], piShell));
    expect(claim.code).toBe(0);
    expect(claim.stdout).toContain("identity saved: Sian");
    expect(claim.stdout).toContain("(agent session)");
    const again = await collect(spawnCli(["whoami"], piShell));
    expect(again.stdout).toContain("Sian");
  }, 30_000);

  it("the session outlives the process: stored handle, then session/load", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const first = await isocan("rc", "turn", "Sian", "one");
    expect(first.code).toBe(0);
    expect(first.stdout).toContain("resumed:false");
    const stored = (await rcRows())[0]!.sessionId;
    expect(stored).toMatch(/^sess_fake_/);

    const second = await isocan("rc", "turn", "Sian", "two");
    expect(second.code).toBe(0);
    expect(second.stderr).toContain(`session ${stored} resumed`);
    expect(second.stdout).toContain("resumed:true");
  }, 30_000);

  it("a load that fails once is retried — the violent-death shape, survived", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    await isocan("rc", "turn", "Sian", "one");
    const child = spawnCli(["rc", "turn", "Sian", "two"], { FAKE_ACP_FAIL_FIRST_LOAD: "1" });
    const run = await collect(child);
    expect(run.code).toBe(0);
    expect(run.stderr).toContain("resumed");
    expect(run.stdout).toContain("resumed:true");
  }, 30_000);

  it("a web-enrolled agent gets its rc half and its binding from the turn itself", async () => {
    // The web dialog's exact record: home half only, minted on another badge.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: { id: "usr_percy", name: "Percy" } },
    });
    // No rc half — the turn adopts, but the fake adapter must be declared
    // for the machine's default harness, which this row's null means —
    // said outright, since the runner may have pi or claude installed too.
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }),
    );
    const run = await isocan("rc", "turn", "Percy", "hi");
    expect(run.code).toBe(0);
    const key = await machineAgentKey(home, "Percy");
    expect(run.stdout).toContain(`env:${key} `);
    const rows = await rcRows();
    expect(rows[0]).toMatchObject({ actorId: "usr_percy", sessionId: rows[0]!.sessionId });
    // The machine badge now answers for Percy under the injected key: a
    // CLI run the way the agent's shells run it speaks as Percy — the one
    // rebinding a web-enrolled agent needed, made by the turn.
    const inside = await collect(
      spawnCli(["whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: agentSessionOf(key) }),
    );
    expect(inside.stdout).toContain("Percy");
  }, 30_000);

  it("a model pinned at enrolment rides the row into the adapter, and an unpinned one gets no template (jetski phase 1)", async () => {
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { fake: [process.execPath, fakeAcp, "--model", "{model}"] } }),
    );
    const add = await isocan("--json", "rc", "add", "Sian", "--harness", "fake", "--model", "acme-pro");
    expect(add.code, add.stderr).toBe(0);
    expect(JSON.parse(add.stdout)).toMatchObject({ model: "acme-pro" });
    expect((await rcRows()).find((row) => row.name === "Sian")?.model).toBe("acme-pro");
    // A person's own ISOCAN_MODEL is blanked so only the pin can speak.
    const pinned = await collect(spawnCli(["rc", "turn", "Sian", "which", "model"], { ISOCAN_MODEL: "" }));
    expect(pinned.code, pinned.stderr).toBe(0);
    expect(pinned.stdout).toContain("model:acme-pro:acme-pro ");

    // The same declaration, nothing pinned: the flag goes with its template,
    // so the harness is never handed the literal text `{model}`.
    expect((await isocan("rc", "add", "Rowan", "--harness", "fake")).code).toBe(0);
    expect((await rcRows()).find((row) => row.name === "Rowan")?.model ?? null).toBeNull();
    const plain = await collect(spawnCli(["rc", "turn", "Rowan", "hello"], { ISOCAN_MODEL: "" }));
    expect(plain.code, plain.stderr).toBe(0);
    expect(plain.stdout).toContain("echo:hello");
    expect(plain.stdout).not.toContain("model:");
  }, 40_000);

  it("`rc turn` is a person's verb — a harness session is refused", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hi"], { ISOCAN_SESSION_ID: "s1" }));
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("person's verb");
  });

  // `1` runs claude-code; a harness name (`pi`, `codex`) runs that one's adapter.
  const realHarness =
    process.env.ISOCAN_REAL_ACP === "1" ? "claude-code" : process.env.ISOCAN_REAL_ACP;
  it.runIf(Boolean(realHarness))(
    `the real ${realHarness ?? "claude-code"} adapter completes one turn (opt-in: ISOCAN_REAL_ACP=1|<harness>)`,
    async () => {
      await isocan("rc", "add", "Real", "--harness", realHarness!);
      const run = await isocan("rc", "turn", "Real", "Reply with exactly: ok");
      expect(run.code).toBe(0);
      expect(run.stderr).toContain("turn ended — end_turn");
    },
    300_000,
  );
});
