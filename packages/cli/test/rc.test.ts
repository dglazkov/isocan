import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { rcAgentsFile, type RcAgentRow } from "../src/rc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`isocan rc` and the enrolment records** (agents-on-demand phase 2).
 * The phase's proofs:
 *
 * - the record's two halves: `agent.enroll` writes the home half into
 *   canvas state, the verb writes the rc half (harness, cwd, sessionId)
 *   into the machine-local file
 * - add and withdrawal work as records — with nothing running — and both
 *   survive a daemon restart, because the oplog does
 * - a running rc NARRATES (asserted, not assumed): an enrolment, a
 *   withdrawal, and a summons for an enrolled agent — recognized and
 *   named, never answered ("no way to start a session yet")
 * - killing the rc leaves the enrolments standing
 * - the vocabulary divide holds mechanically: bare `isocan rc` refuses
 *   inside a harness session, and `isocan agent add` refuses --canvas —
 *   the syntax is the containment
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
const dimitri = { id: "usr_dimitri", name: "Dimitri" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
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

async function snapshotAgents(): Promise<Record<string, { actor: { id: string; name: string } }>> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  const snapshot = (await res.json()) as { canvas: { agents?: Record<string, any> } };
  return snapshot.canvas.agents ?? {};
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  // The runner's own harness variables must not leak in: this suite asserts
  // the same person/agent split under every harness, park.test.ts's rule.
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

function isocan(...args: string[]): Promise<Run> {
  return collect(spawnCli(args));
}

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function rcRows(): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}

describe("the enrolment record, in two halves", () => {
  it("`isocan agent add` writes both halves — and the actor exists before any session", async () => {
    const run = await isocan("agent", "add", "Sian");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("enrolled Sian");

    const agents = await snapshotAgents();
    const row = Object.values(agents).find((a) => a.actor.name === "Sian");
    expect(row).toBeDefined();

    const rc = await rcRows();
    expect(rc).toHaveLength(1);
    expect(rc[0]).toMatchObject({
      canvasId: "prj_1",
      actorId: row!.actor.id,
      name: "Sian",
      // realpath: the spawned CLI resolves the macOS /var → /private/var link.
      cwd: await fs.realpath(home),
      sessionId: null,
    });
  });

  it("withdrawal takes both halves back and leaves the history", async () => {
    await isocan("agent", "add", "Sian");
    const run = await isocan("agent", "remove", "Sian");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("dismissed Sian");

    expect(await snapshotAgents()).toEqual({});
    expect(await rcRows()).toEqual([]);

    // The standing went; the story stayed — journey 8's acceptance.
    const tail = await isocan("--canvas", "prj_1", "tail", "-n", "50");
    expect(tail.stdout).toContain("enrolled Sian");
    expect(tail.stdout).toContain("no longer answering here");
  });

  it("the records survive a daemon restart — enrolment is a record, not a process", async () => {
    await isocan("agent", "add", "Sian");
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);

    const agents = await snapshotAgents();
    expect(Object.values(agents).map((a) => a.actor.name)).toEqual(["Sian"]);
    expect(await rcRows()).toHaveLength(1);
  });

  it("re-enrolling after a withdrawal hands the same actor back", async () => {
    await isocan("agent", "add", "Sian");
    const before = Object.keys(await snapshotAgents())[0]!;
    await isocan("agent", "remove", "Sian");
    await isocan("agent", "add", "Sian");
    expect(Object.keys(await snapshotAgents())).toEqual([before]);
  });
});

describe("the running rc — quiet start, events narrated", () => {
  it("narrates an enrolment, a summons, and a withdrawal; killing it leaves the records", async () => {
    const rc = spawnCli(["rc"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));

    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    // Quiet start: it enables, it does not list — one line, no roster.
    expect(out.trim().split("\n")).toHaveLength(1);

    // An enrolment created by verb, noticed by the running rc — no restart.
    await isocan("agent", "add", "Sian");
    await until(async () => out, (o) => o.includes("enrolled Sian"), "the enrolment narrated");

    // A summons is recognized and narrated, never answered: `reasonFor` is
    // importable today; dispatch is phase 4's.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: {
        type: "thread.create",
        threadId: "th_1",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_1", body: "@Sian this spacing looks wrong" },
      },
    });
    await until(async () => out, (o) => o.includes("summons for Sian"), "the summons narrated");
    expect(out).toContain("no way to start a session yet");

    await isocan("agent", "remove", "Sian");
    await until(async () => out, (o) => o.includes("dismissed Sian"), "the withdrawal narrated");

    // Kill the rc; the enrolments (Percy's, made after the withdrawal)
    // survive to its next start.
    await isocan("agent", "add", "Percy");
    rc.kill("SIGINT");
    await done;
    expect(Object.values(await snapshotAgents()).map((a) => a.actor.name)).toEqual(["Percy"]);
  }, 30_000);
});

describe("the vocabulary divide, enforced", () => {
  it("bare `isocan rc` refuses inside a harness session and names the right verb", async () => {
    const run = await collect(spawnCli(["rc"], { ISOCAN_SESSION_ID: "sess-1" }));
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("isocan agent");
  });

  it("`isocan agent add` refuses --canvas — the syntax is the containment", async () => {
    const run = await isocan("--canvas", "prj_1", "agent", "add", "Sian");
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("beside itself");
    expect(await snapshotAgents()).toEqual({});
  });
});
