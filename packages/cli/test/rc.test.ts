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
  // Phase 4: a summons DISPATCHES now. The scripted adapter answers for
  // every harness this suite enrols, so no test can reach for a real one.
  const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
  await fs.writeFile(
    path.join(home, "config.json"),
    JSON.stringify({ acpAdapters: { "claude-code": [process.execPath, fakeAcp] } }),
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

/**
 * **A deadline under the test's own, and a message that says what it saw.**
 *
 * This was ten seconds flat, and `vitest.config.ts` already records what that
 * costs: *"a hard 5s line straight through the middle of the distribution —
 * so a test passed alone, passed on a fast laptop, and failed on a shared
 * runner, which is the most expensive kind of failure there is because it
 * teaches people to re-run."* Same shape, one level down. These tests start
 * an rc, an ACP adapter and a daemon; on a two-core CI box that is seconds
 * before anything is asked. "a web add gets its rc half from the parked rc"
 * failed twice on CI at 10.9s, on two unrelated commits, passing 3/3 locally
 * each time.
 *
 * Twenty seconds sits under the 30s the tests declare, so a genuinely wedged
 * wait still fails HERE — with the name of what it was waiting for — rather
 * than as vitest's anonymous timeout.
 *
 * And it says what it last saw. "timed out waiting for the adoption" tells you
 * nothing about whether the adoption half-happened; the tail does, and this is
 * the same fix `dispatch.test.ts` got for the same reason.
 */
async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 20_000;
  let last: T | undefined;
  for (;;) {
    const value = await fn();
    last = value;
    if (ok(value)) return value;
    if (Date.now() > deadline) {
      const saw = typeof last === "string" ? last : JSON.stringify(last);
      throw new Error(
        `timed out waiting for ${what} after 20s. What it saw:\n${String(saw).slice(-1200)}`,
      );
    }
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
    // Quiet start: it enables, it does not list — where this is, what
    // happens next, and no agent names. (The address line was the first
    // real user's first stumble: a title with no way to get there.)
    await until(async () => out, (o) => o.includes("http"), "the address line");
    expect(out.trim().split("\n").length).toBeLessThanOrEqual(2);
    expect(out).toContain("/p/prj_1");

    // An enrolment created by verb, noticed by the running rc — no restart.
    await isocan("agent", "add", "Sian");
    await until(async () => out, (o) => o.includes("enrolled Sian"), "the enrolment narrated");

    // A summons is recognized, narrated — and since phase 4, ANSWERED: the
    // narration accounts for the whole turn.
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
    expect(out).toContain("starting a session");
    await until(async () => out, (o) => o.includes("turn ended"), "the turn narrated");

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

describe("the web doors' mechanics (phase 2.5)", () => {
  const sessions = async (): Promise<Array<{ kind: string }>> => {
    const res = await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers });
    return (await res.json()) as Array<{ kind: string }>;
  };

  it("a parked rc announces itself on the presence plane, and stands down on Ctrl-C", async () => {
    const rc = spawnCli(["rc"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    // The announcement the add dialog's footer reads: kind "rc", no cursor.
    await until(sessions, (list) => list.some((s) => s.kind === "rc"), "the announcement");

    rc.kill("SIGINT");
    await done;
    // Ended deliberately, not left to the TTL: the dialog must stop saying
    // "an rc is parked here" the moment nobody is.
    await until(sessions, (list) => !list.some((s) => s.kind === "rc"), "the announcement gone");
  }, 30_000);

  it("a web add (the same enroll op) gets its rc half from the parked rc", async () => {
    const rc = spawnCli(["rc"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");

    // The dialog's exact record write: agent.enroll over HTTP. No CLI verb
    // ran on this machine, so no rc half exists — the rc supplies it.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: { id: "usr_sian", name: "Sian" } },
    });
    await until(async () => out, (o) => o.includes("supplying where and how for Sian"), "the adoption");
    const rows = await rcRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      canvasId: "prj_1",
      actorId: "usr_sian",
      harness: null,
      cwd: await fs.realpath(home),
      sessionId: null,
    });

    // The tray's Dismiss — the same withdraw op — reaps the rc half too.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.withdraw", actorId: "usr_sian" },
    });
    await until(rcRows, (r) => r.length === 0, "the rc half reaped");

    rc.kill("SIGINT");
    await done;
  }, 30_000);

  it("an rc that starts late reconciles the enrolments it missed", async () => {
    // Enrolled from the web while NO rc ran — the record works with nothing
    // running; the rc supplies where and how at its next start.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: { id: "usr_percy", name: "Percy" } },
    });
    expect(await rcRows()).toEqual([]);

    const rc = spawnCli(["rc"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    await until(rcRows, (r) => r.length === 1, "the missed enrolment reconciled");
    expect(rows0(await rcRows())).toMatchObject({ actorId: "usr_percy", harness: null });

    rc.kill("SIGINT");
    await done;
  }, 30_000);
});

function rows0<T>(rows: T[]): T {
  return rows[0]!;
}

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

/**
 * **One agent, one name, one machine, many canvases** (standing agents,
 * phase 1). The enrolment key used to be `agent:<canvasId>:<name>`, so Percy
 * enrolled on a second canvas from the same machine was a second session key
 * on the same badge asking for a worn name — refused by the desk, the gate
 * #89 hit. The key is the name now: the same claim on any canvas resumes the
 * one Percy.
 */
describe("one agent, one name, one machine, many canvases", () => {
  it("enrolling a name this machine answers for, on a second canvas, is the same actor", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Q" },
    });
    const first = await isocan("--json", "--canvas", "prj_1", "rc", "add", "Percy");
    const second = await isocan("--json", "--canvas", "prj_2", "rc", "add", "Percy");
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const a = JSON.parse(first.stdout).enrolled as { id: string; name: string };
    const b = JSON.parse(second.stdout).enrolled as { id: string; name: string };
    expect(b.id).toBe(a.id);

    // Both canvases carry the one actor; the machine holds one row per canvas.
    const rosterOf = async (canvasId: string) => {
      const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
      const snapshot = (await res.json()) as { canvas: { agents?: Record<string, { actor: { id: string } }> } };
      return Object.values(snapshot.canvas.agents ?? {}).map((row) => row.actor.id);
    };
    expect(await rosterOf("prj_1")).toEqual([a.id]);
    expect(await rosterOf("prj_2")).toEqual([a.id]);
    const rows = await rcRows();
    expect(rows.map((r) => r.canvasId).sort()).toEqual(["prj_1", "prj_2"]);
    expect(new Set(rows.map((r) => r.actorId)).size).toBe(1);

    // A CLI run the way a summons on prj_2 runs it — the injected environment,
    // nothing else, in an unbound directory — speaks as Percy AND acts on
    // prj_2: `ISOCAN_CANVAS` is read like `--canvas`.
    const inside = await collect(
      spawnCli(["--json", "whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy", ISOCAN_CANVAS: "prj_2" }),
    );
    expect(JSON.parse(inside.stdout).id).toBe(a.id);
    const typed = await collect(
      spawnCli(["text", "standing", "here"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy", ISOCAN_CANVAS: "prj_2" }),
    );
    expect(typed.code).toBe(0);
    const itemsOf = async (canvasId: string) => {
      const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
      const snapshot = (await res.json()) as { canvas: { items: Record<string, unknown> } };
      return Object.keys(snapshot.canvas.items);
    };
    expect((await itemsOf("prj_2")).length).toBe(1);
    expect((await itemsOf("prj_1")).length).toBe(0);

    // The containment still holds for the agent's spelling: an explicit
    // pointer is refused, but the environment a summons runs in is not one.
    const pointed = await collect(
      spawnCli(["--canvas", "prj_1", "agent", "add", "Sian"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy", ISOCAN_CANVAS: "prj_2" }),
    );
    expect(pointed.code).toBe(1);
    expect(pointed.stderr).toContain("beside itself");
    const beside = await collect(
      spawnCli(["--json", "agent", "add", "Sian"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy", ISOCAN_CANVAS: "prj_2" }),
    );
    expect(beside.code).toBe(0);
    expect(JSON.parse(beside.stdout).canvasId).toBe("prj_2");
  }, 30_000);
});
