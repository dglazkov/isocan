import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { rcAgentsFile, type RcAgentRow } from "../src/rc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

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
 * money — except under ISOCAN_REAL_ACP=1, which runs one true turn.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
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
    JSON.stringify({ acpAdapters: { fake: [process.execPath, fakeAcp] } }),
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
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  return spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function collect(child: ChildProcess): Promise<Run> {
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
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
    expect(run.stderr).toContain("stopReason end_turn");
    // The scripted agent echoes its environment: the harness/session pair
    // the CLI inside would present — exactly the mint claim's key.
    expect(run.stdout).toContain("env:agent:Sian");
    expect(run.stdout).toContain("echo:say hello");
    // The permission flow ran, and the client chose the allow option.
    expect(run.stdout).toContain("permission:yes");
    // …and the proof that matters: a CLI run the way a shell INSIDE the
    // agent's session runs it — the injected environment, nothing else —
    // resolves as the enrolled Sian.
    const inside = await collect(
      spawnCli(["whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Sian" }),
    );
    expect(inside.stdout).toContain("Sian");
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
    // for the default harness this row will carry (null → claude-code).
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ acpAdapters: { "claude-code": [process.execPath, fakeAcp] } }),
    );
    const run = await isocan("rc", "turn", "Percy", "hi");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("env:agent:Percy");
    const rows = await rcRows();
    expect(rows[0]).toMatchObject({ actorId: "usr_percy", sessionId: rows[0]!.sessionId });
    // The machine badge now answers for Percy under the injected key: a
    // CLI run the way the agent's shells run it speaks as Percy — the one
    // rebinding a web-enrolled agent needed, made by the turn.
    const inside = await collect(
      spawnCli(["whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy" }),
    );
    expect(inside.stdout).toContain("Percy");
  }, 30_000);

  it("`rc turn` is a person's verb — a harness session is refused", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const run = await collect(spawnCli(["rc", "turn", "Sian", "hi"], { ISOCAN_SESSION_ID: "s1" }));
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("person's verb");
  });

  it.runIf(process.env.ISOCAN_REAL_ACP === "1")(
    "the real adapter completes one turn (opt-in: ISOCAN_REAL_ACP=1)",
    async () => {
      await isocan("rc", "add", "Real", "--harness", "claude-code");
      const run = await isocan("rc", "turn", "Real", "Reply with exactly: ok");
      expect(run.code).toBe(0);
      expect(run.stderr).toContain("stopReason end_turn");
    },
    300_000,
  );
});
