import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs, readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { formatBadgeToken } from "@isocan/core";
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

/**
 * **A team's agent, said out loud** (owner-only summons, 11 Sep 2026). The
 * summonses in this file come from Dimitri at the test badge, and the rc is
 * Nico's — so an agent enrolled with nothing said answers Nico alone. Where a
 * test is about something other than consent, its agent is opened to everyone
 * explicitly; `dispatch.test.ts` pins what the default does.
 */
const TEAM = ["--listen", "everyone"];

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
    // …and named as the default outright: a web add's row says null, which
    // means the machine's default, and the runner's PATH must not vote.
    JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }),
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
  /**
   * **Reap first, then remove.** A test that reached its own `rc.kill` has
   * nothing here; a test that did not leaves a parked process, and removing
   * its home underneath it leaves the process running with a deleted working
   * directory — quieter than the `ENOTEMPTY` it used to cause, and worse,
   * because the noise WAS the signal that something was still alive.
   *
   * `SIGKILL` after a grace period, not just `SIGINT`: an rc mid-turn is
   * exactly the case that ignores a polite ask, and a teardown that waits
   * forever is a hang rather than a failure.
   *
   * **And then WAIT for it to be gone** (9 Sep 2026). Sending a signal is not
   * tearing down; observing the exit is. The first version fired `SIGKILL` and
   * returned, so the next test's `beforeEach` could raise a daemon while the
   * last test's rc was still in the process table — and an rc that outlives
   * its daemon by a few milliseconds reconnects to whatever is on that port
   * next and registers a park. What the innocent later test then sees is
   * *"another park adopted Sian's cursor — standing down for it"*, which is
   * precisely the line that reddened the release for `ce10535c` on CI, where
   * there is no previous RUN to leak from and so no other explanation.
   *
   * That is lesson #44 one step further than it went: it put every spawn on a
   * list the teardown drains, and draining meant asking rather than checking.
   */
  for (const child of started.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const gone = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.kill("SIGINT");
    await Promise.race([gone, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    if (child.exitCode !== null || child.signalCode !== null) continue;
    child.kill("SIGKILL");
    // Bounded, for the teardown-that-hangs reason above — but a SIGKILL that
    // has not landed within a second is a machine in trouble, not a slow rc.
    await Promise.race([gone, new Promise<void>((resolve) => setTimeout(resolve, 1000))]);
  }
  await daemon.close();
  // And the daemon an rc started for itself, which is not this file's `daemon`
  // and so survives closing that one.
  await stopDaemons(Number(new URL(base).port), home).catch(() => {});
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

/**
 * **Everything this file has started that is still alive.**
 *
 * Every test here kills its own `rc` on its last line, and that is enough
 * right up until a test fails or times out before reaching it — at which point
 * a parked rc outlives the run, and the NEXT run's rc finds it holding the
 * cursor: *"another park adopted Sian's cursor — standing down for it."* The
 * failure lands on a later, innocent test, which is why it reads as the suite
 * being unreliable rather than as one thing.
 *
 * Two of these were found alive on 8 Sep 2026, from runs 37 minutes apart,
 * with an `rc` and a `serve` each — `ps` and `lsof` said their working
 * directories were `/T/isocan-rc-*`, so they were nobody's but this file's.
 */
const started: ChildProcess[] = [];

function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  // The runner's own harness variables must not leak in: this suite asserts
  // the same person/agent split under every harness, park.test.ts's rule.
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.push(child);
  return child;
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

  /**
   * **The speaker gate, through the verbs** (sheepdog, "whom it listens
   * to"). The routing rule itself is pinned in `core/test/agents.test.ts`,
   * where it belongs — a dispatch cascade asserting a predicate is the
   * end-to-end-pretending-to-be-a-unit-test this file already learned about.
   * What these pin is the part only the CLI can get wrong: that the gate is
   * WRITTEN where every surface reads it, that one gesture reaches every
   * canvas the agent stands on, and that a person who looks can see it.
   */
  it("`--listen` writes the gate into canvas state and says so", async () => {
    // Owner-only summons: with nothing said, an agent already listens to its
    // owner alone — so the flag that means something now is a widening.
    const plain = await isocan("agent", "add", "Percy");
    expect(plain.stdout).toContain("listens only to you");
    expect(plain.stdout).toContain("isocan rc listen Percy --to <names|everyone>");

    const run = await isocan("agent", "add", "Sian", "--listen", "Dimitri");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("listens to you and Dimitri");

    const agents = await snapshotAgents();
    const row = Object.values(agents).find((a) => a.actor.name === "Sian") as
      | { rules?: { listen?: string[] }; writtenBy?: { id: string } }
      | undefined;
    // In canvas state, not a machine file: a gate a mentioner cannot see is
    // the silent gate the design refuses — stamped with who wrote it, so the
    // rc can tell its owner's widening from anybody else's.
    expect(row?.rules?.listen).toEqual([dimitri.id]);
    expect(row?.writtenBy?.id).toBe(nico.id);

    // And it is readable where somebody looks after being ignored.
    const who = await isocan("--canvas", "prj_1", "who");
    expect(who.stdout).toContain("listens to you and Dimitri");
    const rules = await isocan("--canvas", "prj_1", "agent", "rules", "Sian");
    expect(rules.stdout).toContain("listens to you and Dimitri");
  });

  it("`rc listen --to` reaches every canvas the agent stands on, in one gesture", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Q" },
    });
    await isocan("--canvas", "prj_1", "rc", "add", "Percy");
    await isocan("--canvas", "prj_2", "rc", "add", "Percy");

    // Nothing written is where every enrolment starts — and since owner-only
    // summons that means its owner alone, on both canvases.
    const before = await isocan("--json", "rc", "listen", "Percy");
    expect(JSON.parse(before.stdout).map((r: { listens: string }) => r.listens)).toEqual([
      "listens only to you",
      "listens only to you",
    ]);

    const set = await isocan("rc", "listen", "Percy", "--to", "me,Dimitri");
    expect(set.stderr).toBe("");
    expect(set.code).toBe(0);
    expect(set.stdout).toContain("on 2 canvases");

    const gateOn = async (canvasId: string) => {
      const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
      const snapshot = (await res.json()) as {
        canvas: { agents?: Record<string, { actor: { name: string }; rules?: { listen?: string[] } }> };
      };
      return Object.values(snapshot.canvas.agents ?? {}).find((a) => a.actor.name === "Percy")?.rules
        ?.listen;
    };
    // The same gate in both rooms — "listens to Nico" must not mean two
    // different things one canvas apart.
    expect(await gateOn("prj_1")).toEqual([nico.id, dimitri.id]);
    expect(await gateOn("prj_2")).toEqual([nico.id, dimitri.id]);

    // Off again, said out loud rather than by deleting the field.
    await isocan("rc", "listen", "Percy", "--to", "everyone");
    expect(await gateOn("prj_1")).toEqual(["*"]);
    const after = await isocan("--json", "rc", "listen", "Percy");
    expect(JSON.parse(after.stdout)[0].listens).toBe("everyone");
  });

  it("a gate naming somebody nobody here answers to is refused, not written half-way", async () => {
    await isocan("--canvas", "prj_1", "rc", "add", "Percy");
    const run = await isocan("rc", "listen", "Percy", "--to", "Nobody");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('answers to "Nobody"');
    const agents = await snapshotAgents();
    const row = Object.values(agents).find((a) => a.actor.name === "Percy") as
      | { rules?: { listen?: string[] } }
      | undefined;
    expect(row?.rules?.listen).toBeUndefined();
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
    // happens next, which harness an unnamed agent runs on, and no agent
    // names. (The address line was the first real user's first stumble: a
    // title with no way to get there.)
    await until(async () => out, (o) => o.includes("http"), "the address line");
    expect(out.trim().split("\n").length).toBeLessThanOrEqual(3);
    expect(out).toContain("run on claude-code");
    expect(out).toContain("/p/prj_1");

    // An enrolment created by verb, noticed by the running rc — no restart.
    await isocan("agent", "add", "Sian", ...TEAM);
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
    await until(async () => out, (o) => o.includes("Sian · summons"), "the summons narrated");
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
    await until(async () => out, (o) => o.includes("Sian · where and how supplied"), "the adoption");
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

  it("a web ask naming a template gets a working directory from a module on THIS machine (proposed: templates)", async () => {
    const rc = spawnCli(["rc"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");

    // What the design competition's Fight button sends: a name, a template
    // id and strings — never code. The template is the module's, installed
    // in this build; the rc runs it here, into a directory it chooses. Asked
    // by the rc's owner: since owner-only summons (#269) a template ask meets
    // the same gate as a plain one, and this machine is Nico's. Asked on the
    // badge this machine already holds — a test badge may not become somebody
    // live here, and the owner's own surface is what the Fight button is.
    const { auth } = JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8")) as {
      auth: Record<string, { badgeId: string; secret: string }>;
    };
    const [mine] = Object.values(auth);
    const asOwner = (body: unknown): Promise<any> =>
      fetch(`${base}/api/projects/prj_1/agents/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${formatBadgeToken(mine!.badgeId, mine!.secret)}` },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    const asked = await asOwner({
      name: "Less but Better",
      from: nico,
      template: "design-competition.fighter",
      args: { pack: "rams", bout: "itm_bout", lane: "Less but Better", canvas: "prj_1" },
    });
    expect(asked.ok).toBe(true);
    await until(async () => out, (o) => o.includes("from the template design-competition.fighter"), "the template ask narrated");
    await until(rcRows, (r) => r.some((row) => row.name === "Less but Better"), "the enrolment");
    const row = (await rcRows()).find((r) => r.name === "Less but Better")!;
    expect(await fs.realpath(row.cwd)).toBe(await fs.realpath(path.join(home, "templates", "design-competition.fighter", "prj_1", "less-but-better")));
    expect(await fs.readFile(path.join(row.cwd, "AGENTS.md"), "utf8")).toMatch(/You are Less but Better/);

    // Somebody else's template ask is refused at the door like any ask would
    // be — a template names what to write, never whose machine may be asked.
    const theirs = await post("/api/projects/prj_1/agents/ask", {
      name: "Road Signs",
      from: dimitri,
      template: "design-competition.fighter",
      args: { pack: "kare", bout: "itm_bout", lane: "Road Signs", canvas: "prj_1" },
    });
    expect(theirs).toMatchObject({ code: "not-your-rc" });
    expect(theirs.error).toContain("Nico's");

    // A template nobody installed here is refused by id, and enrols nobody.
    await asOwner({ name: "Stranger", from: nico, template: "nobody.here" });
    await until(async () => out, (o) => o.includes("no module on this machine offers the template nobody.here"), "the refusal");
    expect((await rcRows()).some((r) => r.name === "Stranger")).toBe(false);

    rc.kill("SIGINT");
    await done;
  }, 30_000);

  it("refuses at the door an ask whose template is not an id and strings", async () => {
    const res = await fetch(`${base}/api/projects/prj_1/agents/ask`, {
      method: "POST",
      headers: { ...badge.headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Sly", from: dimitri, template: "../../bin/sh" }),
    });
    expect(res.status).toBe(400);
  });

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

  it("`rc listen --to` refuses inside a harness session — widening is the owner's gesture", async () => {
    // Consent to spend somebody's tokens is not an agent's to give (owner-
    // only summons): an agent a stranger can talk to must not be the thing
    // that opens its owner's agents to strangers. Reading stays open.
    await isocan("--canvas", "prj_1", "rc", "add", "Percy");
    const widen = await collect(spawnCli(["rc", "listen", "Percy", "--to", "everyone"], { ISOCAN_SESSION_ID: "sess-1" }));
    expect(widen.code).toBe(1);
    expect(widen.stderr).toContain("the owner's gesture");
    const agents = await snapshotAgents();
    const row = Object.values(agents).find((a) => a.actor.name === "Percy") as { rules?: { listen?: string[] } } | undefined;
    expect(row?.rules?.listen).toBeUndefined();
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

describe("one rc, every canvas its rows name (phase 2)", () => {
  it("`rc --all` answers a summons on each of two canvases, one session handle per agent, one budget", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Q" },
    });
    await isocan("--canvas", "prj_1", "rc", "add", "Sian", ...TEAM);
    await isocan("--canvas", "prj_2", "rc", "add", "Sian", ...TEAM);

    const rc = spawnCli(["rc", "--all"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on 2 canvases"), "the rc to come up on both");
    // Narration names the canvas once there is more than one room.
    await until(async () => out, (o) => o.includes("[P] answering on") && o.includes("[Q] answering on"), "both rooms announced");

    const ask = (canvasId: string, n: number) =>
      post("/api/ops", {
        canvasId,
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: `th_${n}`,
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: `cmt_${n}`, body: "@Sian the spacing here looks wrong" },
        },
      });
    await ask("prj_1", 1);
    await until(async () => out, (o) => o.includes("[P] Sian · summons"), "the first summons");
    await until(async () => out, (o) => o.includes("[P] Sian · turn ended"), "the first turn");
    await ask("prj_2", 2);
    await until(async () => out, (o) => o.includes("[Q] Sian · summons"), "the second summons");
    await until(async () => out, (o) => o.includes("[Q] Sian · turn ended"), "the second turn");

    // One session handle per agent: the second room resumed what the first
    // minted (the fake adapter refuses the first load of a fresh process,
    // so the handle is rebuilt once and then carried — either way, both
    // rows end up naming one session).
    const rows = (await rcRows()).filter((r) => r.name === "Sian");
    expect(rows.map((r) => r.canvasId).sort()).toEqual(["prj_1", "prj_2"]);
    expect(rows.every((r) => r.sessionId !== null)).toBe(true);
    expect(new Set(rows.map((r) => r.sessionId)).size).toBe(1);

    rc.kill("SIGINT");
    await done;
  }, 40_000);

  it("`rc --all` with only the bound canvas is one room, untagged — nothing large happens by default", async () => {
    const rc = spawnCli(["rc", "--all"]);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    expect(out).toContain('answering on "P"');
    expect(out).not.toContain("canvases —");
    expect(out).not.toContain("[P]");
    rc.kill("SIGINT");
    await done;
  }, 20_000);
});

describe("which harness an unnamed agent runs on (decided 2026-09-04)", () => {
  // A PATH with nothing on it, so only what config.json declares is
  // runnable and the runner's own installs cannot vote.
  const bare = { PATH: path.join(home ?? os.tmpdir(), "no-such-bin") };

  it("`isocan harness` reads the machine, with no daemon in the way", async () => {
    const run = await collect(spawnCli(["--json", "harness"], bare));
    expect(run.code).toBe(0);
    const scan = JSON.parse(run.stdout) as { harnesses: Array<{ name: string; runnable: boolean; default: boolean }>; default: string | null; source: string };
    expect(scan.default).toBe("claude-code");
    expect(scan.source).toBe("config");
    expect(scan.harnesses.find((h) => h.name === "claude-code")).toMatchObject({ runnable: true, default: true });
    expect(scan.harnesses.find((h) => h.name === "pi")).toMatchObject({ runnable: false, default: false });
    const table = await collect(spawnCli(["harness"], bare));
    expect(table.stdout).toContain("HARNESS");
    expect(table.stdout).toContain("config.json's defaultHarness");
  });

  it("two runnable, none chosen, an agent that named none: a start with no terminal refuses and names the flag", async () => {
    const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp], fake: [process.execPath, fakeAcp] } }),
    );
    // Enrolled from the web: a row that says null, meaning "the machine's default".
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: { id: "usr_sian", name: "Sian" } },
    });
    const refused = await collect(spawnCli(["rc"], bare));
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain("Sian named no harness");
    expect(refused.stderr).toContain("2 harnesses here (claude-code, fake); an agent added without naming one can't run until");
    expect(refused.stderr).toContain("isocan rc --default-harness <name>");

    // The flag answers and is kept: the next bare start needs no flag.
    const rc = spawnCli(["rc", "--default-harness", "fake"], bare);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    expect(out).toContain("agents that named no harness run on fake (config.json's defaultHarness)");
    rc.kill("SIGINT");
    await done;
    expect(JSON.parse(await fs.readFile(path.join(home, "config.json"), "utf8")).defaultHarness).toBe("fake");
    const again = await collect(spawnCli(["--json", "harness"], bare));
    expect(JSON.parse(again.stdout).default).toBe("fake");

    // A flag naming what cannot run here is refused with the list.
    const wrong = await collect(spawnCli(["rc", "--default-harness", "pi"], bare));
    expect(wrong.code).not.toBe(0);
    expect(wrong.stderr).toContain("--default-harness pi: not runnable here");
    expect(wrong.stderr).toContain("runnable: claude-code, fake");
  }, 40_000);

  it("with nothing settling it and nothing needing it, the rc only says so", async () => {
    const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp], fake: [process.execPath, fakeAcp] } }),
    );
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const rc = spawnCli(["rc"], bare);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    expect(out).toContain("2 harnesses here (claude-code, fake); every agent enrolled here named its own");
    expect(out).not.toContain("--default-harness");
    // `who` says which harness a standing agent would run on.
    const who = await isocan("who");
    expect(who.stdout).toMatch(/Sian\s+fake\s+answerable/);
    rc.kill("SIGINT");
    await done;
  }, 30_000);
});

/**
 * **An agent is taken up the same way however the rc noticed it.**
 *
 * This guards a mistake I made twice in one evening while chasing the flake
 * above. Taking up an agent is TWO things — `adoptRcAgent` records where and
 * how it runs, `claimAgent` holds its cursor so dispatch reaches it — and the
 * roster reconcile did only the second. An agent picked up that way had a
 * cursor and no record, so the test above went on timing out with the "fix"
 * in place, and it was right to: the narration was missing because the RECORD
 * was, not the other way round.
 *
 * Source-shape, deliberately. The path only runs when an enrolment lands
 * inside the rc's own startup, and that window cannot be forced from outside
 * without controlling internal timing — so what is asserted is that the two
 * paths agree, which is the property that was broken.
 */
describe("both ways of taking up an agent do the same two things", () => {
  const main = readFileSync(fileURLToPath(new URL("../src/main.ts", import.meta.url)), "utf8");

  it("adopts AND claims, on the enrol entry and on the roster reconcile alike", () => {
    const adopts = main.match(/adoptRcAgent\(ctx\.home, \{/g) ?? [];
    const claims = main.match(/await claimAgent\(/g) ?? [];
    // Two adoption sites: the enrol entry and the reconcile. If a third
    // appears, it needs its own claim beside it — which is the point.
    expect(adopts.length, "every take-up adopts").toBeGreaterThanOrEqual(2);
    expect(claims.length, "and every one of them claims too").toBeGreaterThanOrEqual(adopts.length);
  });

  it("says the same sentence either way, so a reader cannot tell them apart", () => {
    // The line is how a person knows an agent was taken up at all. Two
    // wordings would make the rc's narration depend on which path noticed.
    const said = main.match(/· where and how supplied — \$\{rcCwd\}/g) ?? [];
    expect(said.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * **A withdrawal inside the rc's startup window** (sheep-harness phase 2).
 * The same window as above, from the other side, and source-shape for the
 * same reason: it cannot be forced from outside.
 */
describe("a withdrawal is reaped however the rc noticed it", () => {
  const main = readFileSync(fileURLToPath(new URL("../src/main.ts", import.meta.url)), "utf8");

  it("reaps and takes up once more after the start tip, where neither branch can see it", () => {
    // Both halves of the same window (sheep-harness phase 2): an agent
    // withdrawn between `opening` and `startTip` kept its row, and on the
    // sheep harness its sheep — found by the full file under load; and one
    // enrolled there waited for the first lap that read a roster, the end of
    // a thirty-second poll on a quiet canvas — "a web add gets its rc half"
    // failed on CI twice in three runs on it.
    const tip = main.indexOf("const startTip = ");
    const reaped = main.indexOf('await reap(settled, "as this rc started")');
    const takenUp = main.indexOf("await takeUp(settled)");
    const loop = main.indexOf("for (;;)", tip);
    expect(tip).toBeGreaterThan(-1);
    expect(reaped).toBeGreaterThan(tip);
    expect(main.slice(tip, reaped)).toContain("const settled = await rosterOf()");
    expect(takenUp).toBeGreaterThan(reaped);
    expect(takenUp).toBeLessThan(loop);
  });
});

/**
 * **The sheep harness** (sheep-harness phase 1). `sheep` is found on the
 * PATH and its home by the kennel walk, never by a config block: a fake
 * `sheep` on the PATH answers from a state file and records every call, and
 * a `.sheep/` beside the test's home names the sheep home. The rc's side of
 * journeys 1, 2, 3 and 5, as far as a fake can carry them.
 */
describe("the sheep harness (sheep-harness phase 1)", () => {
  const fakeSheep = fileURLToPath(new URL("./fake-sheep.mjs", import.meta.url));
  let env: Record<string, string>;
  let stateFile: string;

  beforeEach(async () => {
    const bin = path.join(home, "bin");
    await fs.mkdir(bin, { recursive: true });
    await fs.writeFile(path.join(bin, "sheep"), `#!/bin/sh\nexec "${process.execPath}" "${fakeSheep}" "$@"\n`, { mode: 0o755 });
    await fs.mkdir(path.join(home, ".sheep"), { recursive: true });
    await kennel({ local: true });
    stateFile = path.join(home, "sheep-state.json");
    env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, FAKE_SHEEP_STATE: stateFile };
  });

  const kennel = (config: object) => fs.writeFile(path.join(home, ".sheep", "config"), JSON.stringify(config));
  const sheepState = async () => JSON.parse(await fs.readFile(stateFile, "utf8"));
  /** The pass a sheep was minted with: its own secret, never the pasture's. */
  const sheepPass = async (id = "s_1") => (await sheepState()).sheepSecrets?.[id]?.ISOCAN_PASS as string | undefined;
  const sheepCalls = async (): Promise<Array<{ argv: string[]; cwd: string; stdin?: string }>> =>
    (await fs.readFile(`${stateFile}.calls`, "utf8").catch(() => ""))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const run = (...args: string[]) => collect(spawnCli(args, env));

  it("enrol, birth, resume: one sheep, its home on the row, the pass in no argument", async () => {
    expect((await run("rc", "add", "Percy", "--harness", "sheep")).code).toBe(0);

    const first = await run("rc", "turn", "Percy", "the", "empty", "state");
    expect(first.code, first.stderr).toBe(0);
    expect(first.stderr).toContain("birthing a sheep for Percy at the local sheep home in");
    expect(first.stderr).toContain("making pasture isocan-percy");
    expect(first.stderr).toContain("minting a pass for Percy — single-use, fifteen minutes, the sheep's own secret");
    expect(first.stderr).toContain("sheep s_1 minted — no turn spent; its first container runs setup before this summons");
    expect(first.stderr).toContain("session s_1 started");
    // The tool beat: read from the transcript, not from attach's text.
    expect(first.stderr).toContain('Percy · tool bash isocan comment reply th_1 "on it"');
    expect(first.stdout).toContain("on it");

    const row = (await rcRows()).find((r) => r.name === "Percy")!;
    expect(row.sessionId).toBe("s_1");
    expect(row.sheep).toEqual({ kennel: path.join(await fs.realpath(home), ".sheep"), home: "local" });

    // Journey 3: the pass is the sheep's own secret — at the address a
    // container reaches — and in no argument the rc ever passed.
    const pass = (await sheepPass())!;
    expect(pass).toContain("host.docker.internal");
    expect(pass).toContain("prj_1");
    const calls = await sheepCalls();
    expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
    // Every call ran where the kennel is, so sheep's own walk finds it.
    expect(new Set(calls.map((c) => c.cwd))).toEqual(new Set([await fs.realpath(home)]));

    // Journey 2: the same sheep, resumed; no second birth, no second pass.
    const second = await run("rc", "turn", "Percy", "and", "the", "heading");
    expect(second.code, second.stderr).toBe(0);
    expect(second.stderr).toContain("session s_1 resumed");
    expect(second.stderr).not.toContain("minting a pass");
    const after = await sheepCalls();
    expect(after.filter((c) => c.argv[0] === "new")).toHaveLength(1);
    expect(after.some((c) => c.argv[1] === "secret")).toBe(false);
    const summons = after.filter((c) => c.argv[0] === "attach").map((c) => c.argv.at(-1));
    expect(summons).toEqual(["the empty state", "and the heading"]);
    expect((await rcRows()).find((r) => r.name === "Percy")!.cellPass).toEqual(row.cellPass);

    // A kennel re-pointed since the birth is refused, naming both homes.
    await kennel({ home: "https://station.example", token: "t" });
    const moved = await run("rc", "turn", "Percy", "again");
    expect(moved.code).not.toBe(0);
    expect(moved.stderr).toContain("Percy's sheep live at the local sheep home in");
    expect(moved.stderr).toContain("now names https://station.example");
  }, 40_000);

  it("a sheep the row forgot is resumed from the pasture's herd, not born twice", async () => {
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        sessions: [{ id: "s_9", name: "Percy", pasture: "isocan-percy", createdAt: 0, state: "idle", task: null }],
        pastures: { "isocan-percy": { tree: {}, secrets: {} } },
        entries: {},
        next: 10,
      }),
    );
    await run("rc", "add", "Percy", "--harness", "sheep");
    const turn = await run("rc", "turn", "Percy", "hello");
    expect(turn.code, turn.stderr).toBe(0);
    expect(turn.stderr).toContain("sheep s_9 is already in pasture isocan-percy — resuming it rather than birthing a second");
    expect(turn.stderr).toContain("session s_9 resumed");
    // Minted and never asked, so nothing has run in it yet, and that is said.
    expect(turn.stderr).toContain("sheep s_9 has no transcript yet, so its first container runs setup before this summons");
    expect(turn.stderr).not.toContain("minting a pass");
    const calls = await sheepCalls();
    expect(calls.some((c) => c.argv[0] === "new")).toBe(false);
    expect(calls.some((c) => c.argv[1] === "secret")).toBe(false);
    const row = (await rcRows()).find((r) => r.name === "Percy")!;
    expect(row.sessionId).toBe("s_9");
    expect(row.cellPass).toBeUndefined();
  }, 30_000);

  it("a parked rc says where the sheep will live, and answers a summons from a cell", async () => {
    await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
    const rc = spawnCli(["rc"], env);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("Percy's sheep will live at the local sheep home in"), "the rc to say where");
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: {
        type: "thread.create",
        threadId: "th_1",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
      },
    });
    await until(async () => out, (o) => o.includes("Percy · turn ended"), "the turn from the cell");
    expect(out).toContain("Percy · making pasture isocan-percy");
    expect(out).toContain("Percy · session started at the local sheep home in");
    // The summons a sheep receives is the text a local adapter would.
    const attach = (await sheepCalls()).find((c) => c.argv[0] === "attach")!;
    expect(attach.argv.at(-1)).toContain("This is a summons");
    expect(attach.argv.at(-1)).toContain("@Percy the empty state reads wrong");
    rc.kill("SIGINT");
    await done;
    expect((await rcRows()).find((r) => r.name === "Percy")!.sheep?.home).toBe("local");
  }, 40_000);

  it("journey 5: a machine with no sheep enrols, and its rc says so and answers for everyone else", async () => {
    const bare = { PATH: path.join(home, "no-such-bin"), FAKE_SHEEP_STATE: stateFile };
    expect((await collect(spawnCli(["rc", "add", "Percy", "--harness", "sheep"], bare))).code).toBe(0);
    const rc = spawnCli(["rc"], bare);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering for everyone else"), "the rc to say so");
    expect(out).toContain("Percy names sheep, and this machine has no `sheep` on its PATH — npm install -g github:dglazkov/sheep#release");
    rc.kill("SIGINT");
    await done;
  }, 30_000);

  it("journey 5: a station asked to reach a canvas on this machine is refused at the summons, naming both", async () => {
    await kennel({ home: "https://station.example", token: "t" });
    expect((await run("rc", "add", "Percy", "--harness", "sheep")).code).toBe(0);
    const turn = await run("rc", "turn", "Percy", "hello");
    expect(turn.code).not.toBe(0);
    expect(turn.stderr).toContain("Percy's sheep live at https://station.example, a station, which cannot reach \"P\"");
    expect(turn.stderr).toContain("127.0.0.1");
    expect(turn.stderr).toContain("move the canvas to a home with an address, or make the sheep home a local one");
    expect((await sheepCalls()).length).toBe(0);
  }, 30_000);

  /**
   * **The birth without a turn** (sheep-harness phase 2.5). The first
   * summons for an agent with no sheep mints one idle — `sheep new --detach`
   * with no prompt, the pass on stdin as the sheep's own `ISOCAN_PASS` — and
   * sends the summons straight to it. No model turn is spent on the birth,
   * nothing is put in the pasture's secrets, and the summons is the only
   * prompt the sheep ever gets. A `sheep` or a home from before per-sheep
   * secrets mints the sheep and drops the secret without a word, so the rc
   * reads the new sheep's `secrets` in `sheep ls --json` and, when the name
   * is missing, gives the pass to the pasture instead and says so.
   */
  describe("the birth without a turn (sheep-harness phase 2.5)", () => {
    const summon = () =>
      post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
        },
      });

    it("a parked rc's summons mints the sheep with --detach --secret and no prompt, and is its one attach", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const rc = spawnCli(["rc"], env);
      let out = "";
      rc.stdout!.setEncoding("utf8");
      rc.stdout!.on("data", (chunk) => (out += chunk));
      const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
      await until(async () => out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await summon();
      await until(async () => out, (o) => o.includes("Percy · turn ended"), "the turn from the cell");
      expect(out).toContain("Percy · sheep s_1 minted — no turn spent; its first container runs setup before this summons");
      expect(out).not.toContain("has no transcript yet");

      const calls = await sheepCalls();
      const pass = (await sheepPass())!;
      expect(pass).toContain("prj_1");
      // The mint: exactly these words, no `--` and so no prompt, the pass
      // the one line of its stdin and in no argument anywhere.
      const births = calls.filter((c) => c.argv[0] === "new");
      expect(births.map((c) => c.argv)).toEqual([
        ["new", "--detach", "--name", "Percy", "--pasture", "isocan-percy", "--secret", "ISOCAN_PASS"],
      ]);
      expect(births[0]!.stdin).toBe(`${pass}\n`);
      expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
      // Nothing in the pasture's secrets; the name is on the sheep.
      expect(calls.some((c) => c.argv[1] === "secret")).toBe(false);
      const state = await sheepState();
      expect(state.pastures["isocan-percy"].secrets).toEqual({});
      expect(state.sessions.map((s: { id: string; secrets?: string[] }) => [s.id, s.secrets])).toEqual([["s_1", ["ISOCAN_PASS"]]]);
      // One prompt ever reached the sheep, and it is the summons: the only
      // call carrying `--` is the one attach, and the transcript opens with it.
      const prompted = calls.filter((c) => c.argv.includes("--"));
      expect(prompted.map((c) => c.argv[0])).toEqual(["attach"]);
      expect(prompted[0]!.argv.at(-1)).toContain("@Percy the empty state reads wrong");
      const transcript = state.entries.s_1 as Array<{ message: { role: string; content: unknown } }>;
      expect(transcript[0]!.message).toEqual({ role: "user", content: prompted[0]!.argv.at(-1) });
      // The brief is where the home puts it in every model call.
      expect(Object.keys(state.pastures["isocan-percy"].tree).sort()).toEqual(
        expect.arrayContaining(["BRIEF.md", "setup.sh"]),
      );
      expect(state.pastures["isocan-percy"].tree["BRIEF.md"]).toContain("You are Percy");
      const row = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(row.sessionId).toBe("s_1");
      expect(row.cellPass).toMatchObject({ canvasId: "prj_1", passId: expect.stringMatching(/^pss_/) });
      rc.kill("SIGINT");
      await done;
    }, 40_000);

    it("a `sheep` or home that drops a sheep's own secret: the pass goes to the pasture, said once, and the one sheep is used", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, noSheepSecrets: true }));
      await run("rc", "add", "Percy", "--harness", "sheep");
      const turn = await run("rc", "turn", "Percy", "the", "empty", "state");
      expect(turn.code, turn.stderr).toBe(0);
      expect(turn.stderr).toContain(
        "cannot keep a secret for one sheep (this `sheep` or its home predates it), so the pass is pasture " +
          "isocan-percy's ISOCAN_PASS secret instead, and stays there once spent",
      );
      expect(turn.stderr).toContain("sheep s_1 minted — no turn spent");

      const calls = await sheepCalls();
      // Asked for with --secret, found missing in the listing, and given to
      // the pasture — after the mint and before the one attach.
      const verbs = calls.map((c) => (c.argv[0] === "pasture" ? `pasture ${c.argv[1]}` : c.argv[0]));
      const at = (verb: string) => verbs.indexOf(verb);
      expect(verbs.filter((v) => v === "new")).toHaveLength(1);
      expect(calls.find((c) => c.argv[0] === "new")!.argv).toContain("--secret");
      expect(at("new")).toBeLessThan(at("pasture secret"));
      expect(verbs.slice(at("new") + 1, at("pasture secret"))).toEqual(["ls"]);
      expect(at("pasture secret")).toBeLessThan(at("attach"));
      const state = await sheepState();
      const pass = state.pastures["isocan-percy"].secrets.ISOCAN_PASS as string;
      expect(pass).toContain("prj_1");
      expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
      // One sheep, no opening prompt, nothing ended.
      expect(state.sessions.map((s: { id: string }) => s.id)).toEqual(["s_1"]);
      expect(calls.some((c) => c.argv[0] === "rm")).toBe(false);
      expect(calls.filter((c) => c.argv.includes("--")).map((c) => c.argv[0])).toEqual(["attach"]);
      expect((await rcRows()).find((r) => r.name === "Percy")!.cellPass).toMatchObject({ canvasId: "prj_1" });
    }, 40_000);
  });

  /**
   * **Withdrawal ends the sheep** (sheep-harness phase 2, journey 4). Every
   * path that withdraws an agent ends its sheep at the sheep home and the
   * badge its cell redeemed at the isocan home, and says each; the pasture
   * stays. The cell is played by a badge redeeming the pass the rc gave the
   * sheep as its own secret, the way the cell's `isocan setup --direct`
   * would, so there is a real badge to end.
   */
  describe("withdrawal ends the sheep (sheep-harness phase 2)", () => {
    const redeemCellPass = async (): Promise<TestBadge> => {
      const address = (await sheepPass("s_1"))!;
      const cell = await mintTestBadge(base);
      const res = await fetch(`${base}/api/passes/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cell.headers },
        body: JSON.stringify({ token: address.slice(address.indexOf("#") + 1) }),
      });
      if (!res.ok) throw new Error(`the cell could not redeem its pass: ${await res.text()}`);
      return cell;
    };
    const commentsOn = async (threadId: string): Promise<unknown[]> => {
      const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
      const snapshot = (await res.json()) as { canvas: { threads: Record<string, { comments: unknown[] }> } };
      return snapshot.canvas.threads[threadId]?.comments ?? [];
    };
    const parked = () => {
      const rc = spawnCli(["rc"], env);
      const seen = { out: "" };
      rc.stdout!.setEncoding("utf8");
      rc.stdout!.on("data", (chunk) => (seen.out += chunk));
      const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
      return { rc, seen, done };
    };

    it("journey 4: `rc remove` ends the sheep and the cell's badge, keeps the pasture; re-enrolment births anew", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      const birth = await run("rc", "turn", "Percy", "hello");
      expect(birth.code, birth.stderr).toBe(0);
      const born = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(born.cellPass).toMatchObject({ canvasId: "prj_1", passId: expect.stringMatching(/^pss_/) });
      // Until sheep#2, the brief says a cold turn is slow and a dead
      // container is to be reported, not slept on.
      const brief = (await sheepState()).pastures["isocan-percy"].tree["BRIEF.md"] as string;
      expect(brief).toContain("can take a couple of minutes");
      expect(brief).toContain("do not sleep and retry");

      // The cell redeems its pass; the rc's machine names the badge as the cell's.
      const firstPass = await sheepPass("s_1");
      const cell = await redeemCellPass();
      const listed = await run("badges");
      expect(listed.stdout).toMatch(new RegExp(`${cell.badgeId}\\s+cell \\(Percy's sheep\\)`));
      const json = JSON.parse((await run("--json", "badges")).stdout) as { badges: Array<{ badgeId: string; cell?: unknown }> };
      expect(json.badges.find((b) => b.badgeId === cell.badgeId)?.cell).toEqual({ agent: "Percy", sheep: "s_1" });

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("dismissed Percy");
      expect(removed.stdout).toContain("Percy · ending sheep s_1 at the local sheep home in");
      expect(removed.stdout).toContain("Percy · sheep s_1 ended — its container and workspace are gone");
      expect(removed.stdout).toContain("Percy · pasture isocan-percy stays — it is yours");
      expect(removed.stdout).toContain(`Percy · ended badge ${cell.badgeId} — Percy's cell can no longer speak as Percy`);

      // Ended once, beside the row's kennel; the pasture kept; the row gone;
      // the badge a badge nobody holds.
      const rms = (await sheepCalls()).filter((c) => c.argv[0] === "rm");
      expect(rms.map((c) => [c.argv, c.cwd, (c as { exit?: number }).exit])).toEqual([
        [["rm", "--json", "s_1"], await fs.realpath(home), 0],
      ]);
      const after = await sheepState();
      expect(after.sessions).toEqual([]);
      expect(Object.keys(after.pastures)).toEqual(["isocan-percy"]);
      // The pass ended with the sheep; the kept pasture holds no secret.
      expect(after.sheepSecrets.s_1).toBeUndefined();
      expect(after.pastures["isocan-percy"].secrets).toEqual({});
      expect((await rcRows()).some((r) => r.name === "Percy")).toBe(false);
      expect(await daemon.desk.badge(cell.badgeId)).toBeNull();
      expect((await run("badges")).stdout).not.toContain(cell.badgeId);

      // A week later: a new sheep in the same pasture, a new pass, and the
      // rc says the sheep does not remember the first.
      await run("rc", "add", "Percy", "--harness", "sheep");
      const again = await run("rc", "turn", "Percy", "hello again");
      expect(again.code, again.stderr).toBe(0);
      expect(again.stderr).toContain("pasture isocan-percy already exists; the sheep born into it is new and does not remember an earlier one");
      expect(again.stderr).toContain("sheep s_2 minted — no turn spent");
      const reborn = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(reborn.sessionId).toBe("s_2");
      expect(reborn.cellPass!.passId).not.toBe(born.cellPass!.passId);
      const births = (await sheepCalls()).filter((c) => c.argv[0] === "new");
      expect(births.map((c) => c.argv[c.argv.indexOf("--pasture") + 1])).toEqual(["isocan-percy", "isocan-percy"]);
      expect(births.every((c) => c.argv.includes("--secret"))).toBe(true);
      expect(await sheepPass("s_2")).toContain("prj_1");
      expect(await sheepPass("s_2")).not.toBe(firstPass);
      expect((await sheepCalls()).some((c) => c.argv[1] === "secret")).toBe(false);
    }, 60_000);

    it("mid-turn at a parked rc: the turn is aborted and reads as a withdrawal — no failure, no system voice, no retry", async () => {
      // A turn that takes a minute, so the withdrawal lands under it.
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, attachMs: 60_000 }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
        },
      });
      await until(async () => (await sheepState().catch(() => null))?.sessions?.[0]?.state, (s) => s === "busy", "the turn to be running in the cell");

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      await until(async () => seen.out, (o) => o.includes("Percy · turn stopped — Percy was withdrawn"), "the turn to read as a withdrawal");
      // Whichever of the verb and the rc reached the home first ended it,
      // and said the turn was aborted; the other found it already gone.
      expect(`${removed.stdout}${seen.out}`).toContain("the running turn was aborted first");
      const rms = (await sheepCalls()).filter((c) => c.argv[0] === "rm");
      expect(rms.filter((c) => (c as { exit?: number }).exit === 0)).toHaveLength(1);
      expect((await sheepState()).sessions).toEqual([]);

      // A lap later: nothing failed, nothing was said in the thread in the
      // system voice, and nothing was sent to the cell again.
      await new Promise((r) => setTimeout(r, 3_000));
      expect(seen.out).not.toContain("turn FAILED");
      expect(seen.out).not.toContain("turn ended");
      expect(await commentsOn("th_1")).toHaveLength(1);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "attach")).toHaveLength(1);
      expect(seen.out.match(/Percy · summons/g)).toHaveLength(1);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("mid-turn at a station too old to end a sheep: aborted, and still read as a withdrawal though the turn exits cleanly", async () => {
      // As walked on sheep-2 on 11 Sep 2026: `sheep rm` is refused, the rc
      // falls back to `sheep abort`, and the attach it stopped exits 0 —
      // which read as "turn ended — end_turn" until the dispatch the
      // withdraw branch dropped was consulted too.
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, attachMs: 60_000, oldHome: true }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy count slowly" },
        },
      });
      await until(async () => (await sheepState().catch(() => null))?.sessions?.[0]?.state, (s) => s === "busy", "the turn to be running in the cell");

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("its running turn was aborted");
      expect(removed.stdout).toContain("this home cannot end a sheep (sheep rm: not found)");
      await until(async () => seen.out, (o) => o.includes("Percy · turn stopped — Percy was withdrawn"), "the turn to read as a withdrawal");
      await new Promise((r) => setTimeout(r, 3_000));
      expect(seen.out).not.toContain("Percy · turn ended");
      expect(seen.out).not.toContain("turn FAILED");
      expect(await commentsOn("th_1")).toHaveLength(1);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "attach")).toHaveLength(1);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("the web's withdraw, seen by a parked rc, ends the sheep — reading the row before reaping it", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep live at"), "the rc to come up");
      // Past its start: only the loop narrates an adoption, so after this
      // line the withdraw op below is one the rc reads as it lands.
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.enroll", agent: { id: "usr_sian", name: "Sian" } } });
      await until(async () => seen.out, (o) => o.includes("Sian · where and how supplied"), "the rc to be parked");
      // The tray's Dismiss: the withdraw op over HTTP, no verb on this machine.
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, (o) => o.includes("Percy · pasture isocan-percy stays"), "the sheep ended");
      expect(seen.out).toContain("Dimitri dismissed Percy — no longer answering here");
      expect(seen.out).toContain("Percy · ending sheep s_1");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      // Never redeemed here, so there is no badge — and that is said.
      expect(seen.out).toMatch(/Percy · pass pss_\S+ was never redeemed, so Percy's cell holds no badge/);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "rm")).toHaveLength(1);
      expect((await rcRows()).map((r) => r.name)).toEqual(["Sian"]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("a withdrawal landing while the rc starts is ended too", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      // As early as the rc says anything about Percy, which on a loaded
      // machine is between its opening roster and its start tip, where
      // neither the reconcile nor the withdraw branch used to see it. Which
      // side of the tip it lands on is timing; the source-shape test below
      // pins the reap that covers the window, and this one that either way
      // the sheep is ended once.
      await until(async () => seen.out, (o) => o.includes("Percy's sheep live at"), "the rc to say where");
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, (o) => o.includes("Percy · pasture isocan-percy stays"), "the sheep ended");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepCalls()).filter((c) => c.argv[0] === "rm")).toHaveLength(1);
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("a withdrawal made while no rc ran is ended at the next rc's start", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      expect((await sheepState()).sessions).toHaveLength(1);

      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("answering on"), "the rc to come up");
      expect(seen.out).toContain("Percy was withdrawn while no rc ran here — ending what it left");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepState()).sessions).toEqual([]);
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("withdrawn while its sheep is being born: the summons ends the sheep it birthed, and runs no turn", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, newMs: 3_000 }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
        },
      });
      // `sheep new` has the pass and is under way: the row does not name a
      // sheep yet, so whoever reaps it has none to end.
      await until(async () => (await sheepState().catch(() => null))?.minting, (m) => m === true, "the birth to be under way");
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, (o) => o.includes("Percy · pasture isocan-percy stays"), "the born sheep ended");
      expect(seen.out).toContain("Percy · withdrawn before its turn — no turn runs");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepState()).sessions).toEqual([]);
      expect((await sheepCalls()).some((c) => c.argv[0] === "attach")).toBe(false);
      expect(seen.out).not.toContain("turn FAILED");
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("one sheep behind two canvases stays until its last row is withdrawn, and the pass goes with it", async () => {
      await post("/api/ops", {
        canvasId: null,
        actor: dimitri,
        op: { type: "project.create", canvasId: "prj_2", title: "Q" },
      });
      await run("--canvas", "prj_1", "rc", "add", "Percy", "--harness", "sheep");
      await run("--canvas", "prj_2", "rc", "add", "Percy", "--harness", "sheep");
      expect((await run("--canvas", "prj_1", "rc", "turn", "Percy", "hello")).code).toBe(0);
      // The second canvas resumes the one sheep from the pasture's herd.
      expect((await run("--canvas", "prj_2", "rc", "turn", "Percy", "hello")).stderr).toContain("session s_1 resumed");
      const cell = await redeemCellPass();

      const first = await run("--canvas", "prj_1", "rc", "remove", "Percy");
      expect(first.stdout).toContain('Percy · sheep s_1 stays — Percy still answers from it on "Q"');
      expect((await sheepCalls()).some((c) => c.argv[0] === "rm")).toBe(false);
      const survivor = (await rcRows()).find((r) => r.canvasId === "prj_2")!;
      expect(survivor.cellPass?.canvasId).toBe("prj_1");

      const last = await run("--canvas", "prj_2", "rc", "remove", "Percy");
      expect(last.stdout).toContain("Percy · sheep s_1 ended");
      expect(last.stdout).toContain(`Percy · ended badge ${cell.badgeId}`);
      expect(await daemon.desk.badge(cell.badgeId)).toBeNull();
    }, 60_000);

    it("a home too old to end a sheep: the turn is aborted, and the rc says what remains", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, oldHome: true }));
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      // Mid-turn, as far as the home is concerned.
      const state = await sheepState();
      state.sessions[0].state = "busy";
      await fs.writeFile(stateFile, JSON.stringify(state));

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("Percy · its running turn was aborted");
      expect(removed.stdout).toContain(
        "Percy · sheep s_1 is still at the local sheep home in " +
          `${await fs.realpath(home)}: this home cannot end a sheep (sheep rm: not found); \`sheep ls\` lists it`,
      );
      expect(removed.stdout).toContain("Percy · pasture isocan-percy stays — it is yours");
      const verbs = (await sheepCalls()).map((c) => c.argv[0]);
      expect(verbs.slice(verbs.indexOf("rm"))).toEqual(["rm", "ls", "abort", ...verbs.slice(verbs.indexOf("abort") + 1)]);
      expect((await sheepState()).sessions.map((s: { id: string; state: string }) => [s.id, s.state])).toEqual([["s_1", "idle"]]);
      expect(await rcRows()).toEqual([]);
    }, 40_000);

    it("a sheep already gone from its home is said as already ended, not as a failure", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      // Another withdrawal got there first.
      const state = await sheepState();
      state.sessions = [];
      await fs.writeFile(stateFile, JSON.stringify(state));

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("Percy · sheep s_1 was already ended — the local sheep home in");
      expect(removed.stdout).not.toContain("still at");
      expect((await sheepCalls()).some((c) => c.argv[0] === "abort")).toBe(false);
    }, 40_000);
  });

  it("`isocan harness` finds sheep by the scan, with the home its kennel names", async () => {
    const scan = JSON.parse((await run("--json", "harness")).stdout) as { harnesses: Array<{ name: string } & Record<string, unknown>> };
    expect(scan.harnesses.find((h) => h.name === "sheep")).toMatchObject({ installed: true, runnable: true, home: expect.stringContaining("the local sheep home in") });
    await kennel({ home: "https://station.example", token: "t" });
    const table = await run("harness");
    expect(table.stdout).toContain("HOME");
    expect(table.stdout).toContain(`https://station.example (kennel ${path.join(await fs.realpath(home), ".sheep")})`);
    const bare = await collect(spawnCli(["--json", "harness"], { PATH: path.join(home, "no-such-bin") }));
    expect(JSON.parse(bare.stdout).harnesses.find((h: { name: string }) => h.name === "sheep")).toMatchObject({ installed: false, runnable: false });
  }, 30_000);
});
