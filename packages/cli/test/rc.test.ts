import { CANVAS_GROUPS_FEATURE, CLIENT_FEATURES_HEADER, formatBadgeToken } from "@isocan/core";
import { adoptRcAgent, type RcAgentRow } from "../src/rc.ts";
import { describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  answeringFor,
  badge,
  base,
  collect,
  dimitri,
  daemon,
  holdOnThisMachine,
  home,
  isocan,
  nico,
  post,
  rcRows,
  restartDaemon,
  snapshotAgents,
  spawnCli,
  TEAM,
  until,
  useRcHome,
} from "./rc-fixture.ts";

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
 *
 * The sheep harness's half of the same machinery is `rc-sheep.test.ts`, and
 * `rc-fixture.ts` holds the home, the daemon and the helpers they share.
 */

useRcHome();

describe("the enrolment record, in two halves", () => {
  it("publishes enrolment only after the rc can read its working directory", async () => {
    const submit = daemon.engine.submit.bind(daemon.engine);
    let observed: RcAgentRow[] = [];
    let adopted: boolean | undefined;
    const gate = vi.spyOn(daemon.engine, "submit").mockImplementation(async (request) => {
      if (request.op.type === "agent.enroll") {
        // This intercepts the writer BEFORE it can publish an op or wake an
        // actor. No timer decides whether the configuration was ready.
        observed = await rcRows();
        adopted = await adoptRcAgent(home, { canvasId: "prj_1", actorId: request.op.agent.id, name: request.op.agent.name, cwd: "/wrong-default", harness: null, sessionId: null });
      }
      return submit(request);
    });
    try {
      const run = await isocan("agent", "add", "Acme builder");
      expect(run.code, run.stderr).toBe(0);
      expect(observed).toMatchObject([{ name: "Acme builder", cwd: await fs.realpath(home) }]);
      expect(adopted).toBe(false);
    } finally { gate.mockRestore(); }
  });

  it("a receipt dropped after acceptance leaves the prepared rc configuration intact", async () => {
    let response: ServerResponse | undefined;
    const capture = (request: IncomingMessage, reply: ServerResponse) => {
      if (request.method === "POST" && request.url === "/api/ops") response = reply;
    };
    daemon.app.server.prependListener("request", capture);
    const submit = daemon.engine.submit.bind(daemon.engine);
    const gate = vi.spyOn(daemon.engine, "submit").mockImplementation(async (request) => {
      const accepted = await submit(request);
      if (request.op.type === "agent.enroll") response!.destroy();
      return accepted;
    });
    try {
      const run = await isocan("agent", "add", "Acme lost receipt");
      expect(run.code).not.toBe(0);
      const agent = Object.values(await snapshotAgents()).find((a) => a.actor.name === "Acme lost receipt");
      expect(agent).toBeDefined();
      expect(await rcRows()).toMatchObject([{ actorId: agent!.actor.id, cwd: await fs.realpath(home) }]);
    } finally {
      gate.mockRestore();
      daemon.app.server.removeListener("request", capture);
    }
  });

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

  it("`--until` writes how long as an entry beside the name (#272 phase 3)", async () => {
    await isocan("--canvas", "prj_1", "rc", "add", "Percy");
    const set = await isocan("rc", "listen", "Percy", "--to", "Dimitri", "--until", "7d");
    expect(set.code).toBe(0);
    expect(set.stdout).toContain("listens to you and Dimitri for 7d");

    const agents = await snapshotAgents();
    const row = Object.values(agents).find((a) => a.actor.name === "Percy") as
      | { rules?: { listen?: unknown[] } }
      | undefined;
    // An entry, not a name with a date packed into it: a reader that has
    // never heard of expiry keeps only strings in this list, so it drops
    // this whole and admits nobody — the direction a gate must fail.
    expect(row?.rules?.listen).toHaveLength(1);
    expect(row?.rules?.listen?.[0]).toMatchObject({ id: dimitri.id });
    expect((row?.rules?.listen?.[0] as { until: string }).until).toMatch(/^\d{4}-/);

    // And it is readable — a timed grant nobody can see is the silent gate
    // in slower motion.
    const read = await isocan("--json", "rc", "listen", "Percy");
    expect(JSON.parse(read.stdout)[0].until).toMatch(/Dimitri for 7d/);

    // `--until` without a `--to` is not a gesture: it says how long a grant
    // lasts, and there is no grant.
    const alone = await isocan("rc", "listen", "Percy", "--until", "7d");
    expect(alone.code).not.toBe(0);
    expect(alone.stderr).toContain("wants a `--to` to grant");

    // Without `--until`, a grant is the bare id it has always been — so a
    // gate that gains no expiry never changes shape, and nothing stored
    // before today is rewritten.
    await isocan("rc", "listen", "Percy", "--to", "Dimitri");
    const plain = Object.values(await snapshotAgents()).find((a) => a.actor.name === "Percy") as
      | { rules?: { listen?: unknown[] } }
      | undefined;
    expect(plain?.rules?.listen).toEqual([dimitri.id]);
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
    await restartDaemon();

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
    // ran on this machine, so no rc half exists — the rc supplies it. The
    // actor is this machine's, as the ask makes it: an orphan is inert.
    await holdOnThisMachine({ id: "usr_sian", name: "Sian" });
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

    const parked = () => until(async () => {
      const response = await fetch(`${base}/api/projects/prj_1/rc`, { headers: badge.headers });
      return response.json() as Promise<{ parked?: boolean }>;
    }, (state) => state.parked === true, "the rc's live park");
    await parked();

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
        headers: { [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE, "Content-Type": "application/json", Authorization: `Bearer ${formatBadgeToken(mine!.badgeId, mine!.secret)}` },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    const asked = await asOwner({
      name: "Less but Better",
      from: nico,
      template: "design-competition.fighter",
      args: { pack: "rams", bout: "itm_bout", lane: "Less but Better", canvas: "prj_1" },
    });
    expect(asked.ok, JSON.stringify(asked)).toBe(true);
    await until(async () => out, (o) => o.includes("from the template design-competition.fighter"), "the template ask narrated");
    await until(rcRows, (r) => r.some((row) => row.name === "Less but Better"), "the enrolment");
    const row = (await rcRows()).find((r) => r.name === "Less but Better")!;
    expect(await fs.realpath(row.cwd)).toBe(await fs.realpath(path.join(home, "templates", "design-competition.fighter", "prj_1", "less-but-better")));
    expect(await fs.readFile(path.join(row.cwd, "AGENTS.md"), "utf8")).toMatch(/You are Less but Better/);

    // Somebody else's template ask is refused at the door like any ask would
    // be — a template names what to write, never whose machine may be asked.
    await parked();
    const theirs = await post("/api/projects/prj_1/agents/ask", {
      name: "Road Signs",
      from: dimitri,
      template: "design-competition.fighter",
      args: { pack: "kare", bout: "itm_bout", lane: "Road Signs", canvas: "prj_1" },
    });
    expect(theirs).toMatchObject({ code: "not-your-rc" });
    expect(theirs.error).toContain("Nico's");

    // A template nobody installed here is refused by id, and enrols nobody.
    await parked();
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
    // running; the rc supplies where and how at its next start. The actor is
    // this machine's, as the ask makes it: an orphan is inert.
    await holdOnThisMachine({ id: "usr_percy", name: "Percy" });
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
  const bare = () => ({ PATH: path.join(home, "no-such-bin") });

  it("`isocan harness` reads the machine, with no daemon in the way", async () => {
    const run = await collect(spawnCli(["--json", "harness"], bare()));
    expect(run.code).toBe(0);
    const scan = JSON.parse(run.stdout) as { harnesses: Array<{ name: string; runnable: boolean; default: boolean }>; default: string | null; source: string };
    expect(scan.default).toBe("claude-code");
    expect(scan.source).toBe("config");
    expect(scan.harnesses.find((h) => h.name === "claude-code")).toMatchObject({ runnable: true, default: true });
    expect(scan.harnesses.find((h) => h.name === "pi")).toMatchObject({ runnable: false, default: false });
    const table = await collect(spawnCli(["harness"], bare()));
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
    const refused = await collect(spawnCli(["rc"], bare()));
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain("Sian named no harness");
    expect(refused.stderr).toContain("2 harnesses here (claude-code, fake); an agent added without naming one can't run until");
    expect(refused.stderr).toContain("isocan rc --default-harness <name>");

    // The flag answers and is kept: the next bare start needs no flag.
    const rc = spawnCli(["rc", "--default-harness", "fake"], bare());
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    expect(out).toContain("agents that named no harness run on fake (config.json's defaultHarness)");
    rc.kill("SIGINT");
    await done;
    expect(JSON.parse(await fs.readFile(path.join(home, "config.json"), "utf8")).defaultHarness).toBe("fake");
    const again = await collect(spawnCli(["--json", "harness"], bare()));
    expect(JSON.parse(again.stdout).default).toBe("fake");

    // A flag naming what cannot run here is refused with the list.
    const wrong = await collect(spawnCli(["rc", "--default-harness", "pi"], bare()));
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
    const { actorId } = (await rcRows()).find((r) => r.name === "Sian")!;
    const rc = spawnCli(["rc"], bare());
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
    expect(out).toContain("2 harnesses here (claude-code, fake); every agent enrolled here named its own");
    expect(out).not.toContain("--default-harness");
    /**
     * `who` says which harness a standing agent would run on — and calls it
     * `answerable` only while a live rc holds its cursor, which the rc
     * claims several round trips AFTER it says "answering on". Asking once
     * on that sentinel is the race that reddened the release for
     * `ca307057` on 10 Sep 2026 with *expected 'WHO KIND STATE …' to match
     * /Sian\s+fake\s+answerable/*: the table was printed, Sian's row simply
     * still said `enrolled`. So wait for the claim itself — the fact the
     * column renders — and then read the table once.
     */
    await until(answeringFor, (ids) => ids.includes(actorId), "the rc to claim Sian's cursor");
    const who = await isocan("who");
    expect(who.stdout).toMatch(/Sian\s+fake\s+answerable/);
    rc.kill("SIGINT");
    await done;
  }, 30_000);
});

/**
 * **Two rcs answer one canvas** (room phase 3; journey 2). Two machines on one
 * daemon, each with a badge of its own: this home is Nico's, `machine2` is
 * Wren's. Each adds an agent, each runs `isocan rc`, and each roster names
 * both. The cursor and hold routes require the actor, and the room parks
 * before it does anything else for an agent, so each rc says the other's
 * agent once and leaves it alone. Without the route check the second rc parks
 * Percy and the two trade his cursor; without the room's rule it reads the
 * refusal as a cursor it could not hold, every lap.
 */
describe("two rcs, one canvas (room phase 3)", () => {
  it("each answers its own agent, says the other's once, and neither takes the other's cursor", async () => {
    const machine2 = path.join(home, "machine2");
    await fs.mkdir(machine2);
    await fs.writeFile(
      path.join(machine2, "identity.json"),
      JSON.stringify({ id: "usr_wren", name: "Wren", createdAt: new Date().toISOString() }),
    );
    await fs.copyFile(path.join(home, "config.json"), path.join(machine2, "config.json"));
    const wren = { ISOCAN_HOME: machine2 };
    expect((await isocan("rc", "add", "Percy", ...TEAM)).code).toBe(0);
    expect((await collect(spawnCli(["--canvas", "prj_1", "rc", "add", "Wendy", ...TEAM], wren))).code).toBe(0);
    const ids = Object.fromEntries(Object.values(await snapshotAgents()).map((a) => [a.actor.name, a.actor.id]));
    const percy = ids["Percy"]!;
    const wendy = ids["Wendy"]!;

    const started = (args: string[], env: Record<string, string> = {}) => {
      const child = spawnCli(args, env);
      const seen = { out: "" };
      child.stdout!.setEncoding("utf8");
      child.stdout!.on("data", (chunk) => (seen.out += chunk));
      child.stderr!.setEncoding("utf8");
      child.stderr!.on("data", (chunk) => (seen.out += chunk));
      return { child, seen, done: new Promise<void>((resolve) => child.on("close", () => resolve())) };
    };
    const one = started(["rc"]);
    await until(answeringFor, (a) => a.includes(percy), "the first rc to hold Percy");
    const two = started(["--canvas", "prj_1", "rc"], wren);
    // The second rc's hold names Wendy only after its start has said what it
    // has to say, so this is the end of its start.
    await until(answeringFor, (a) => a.includes(percy) && a.includes(wendy), "both agents answerable");

    const summon = (threadId: string, body: string) =>
      post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: `cmt_${threadId}`, body } },
      });
    // Both outputs, so a wait that times out shows what each machine said.
    const both = async () => `=== first\n${one.seen.out}\n=== second\n${two.seen.out}`;
    const second = (o: string) => o.slice(o.indexOf("=== second"));
    await summon("th_percy", "@Percy the spacing looks wrong");
    await until(both, (o) => o.slice(0, o.indexOf("=== second")).includes("Percy · turn ended"), "the first machine to answer Percy");
    await summon("th_wendy", "@Wendy and the heading");
    await until(both, (o) => second(o).includes("Wendy · turn ended"), "the second machine to answer Wendy");
    // Long enough for a lap and a hold on each side after both turns.
    await new Promise((r) => setTimeout(r, 3_000));

    const threads = ((await (await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })).json()) as {
      canvas: { threads: Record<string, { comments: { author: { name: string } }[] }> };
    }).canvas.threads;
    for (const [out, mine, theirs] of [
      [one.seen.out, "Percy", "Wendy"],
      [two.seen.out, "Wendy", "Percy"],
    ] as const) {
      expect(out).toContain(`${theirs} is not held by this machine — a pass minted for ${theirs} hands it over, or re-add it here`);
      expect(out.split(`${theirs} is not held by this machine`).length - 1).toBe(1);
      expect(out).not.toContain(`${theirs} ·`);
      expect(out).not.toContain(`${mine} is not held by this machine`);
      expect(out).not.toContain("another park adopted");
      expect(out).not.toContain("could not hold");
      expect(out).not.toContain("turn FAILED");
    }
    for (const threadId of ["th_percy", "th_wendy"]) {
      expect(threads[threadId]!.comments.map((c) => c.author.name)).not.toContain("isocan");
    }
    expect(await answeringFor()).toEqual(expect.arrayContaining([percy, wendy]));

    one.child.kill("SIGINT");
    two.child.kill("SIGINT");
    await Promise.all([one.done, two.done]);
  }, 60_000);
});
