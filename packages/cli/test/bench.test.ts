import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BENCH_REACH,
  collectCanvasNames,
  extractMentions,
  type BenchRow,
  type CanvasContents,
} from "@isocan/core";
import {
  answeringFor,
  badge,
  base,
  collect,
  dimitri,
  isocan,
  post,
  rcRows,
  snapshotAgents,
  spawnCli,
  TEAM,
  until,
  useRcHome,
} from "./rc-fixture.ts";
import { withoutComments } from "../../../test/source.ts";

/**
 * **The bench reads** (`docs/projects/bench/phases.md`, phase 0 — journey 1).
 *
 * The phase's proof, walked with the real binary: from a clean home, enrol two
 * agents the ordinary way, bench each, and bench a third this machine has no
 * running row for. `isocan bench --json` then answers `ready`, `elsewhere` and
 * `unreachable` — three states, reached from three different facts, because a
 * reachability that collapses to a boolean cannot say the one thing journey 1
 * is about: that a summons into silence is not an agent that is thinking.
 *
 * And the third rule, in both directions: **a bench row confers nothing.**
 * Adding one enrols nobody; removing one withdraws nobody.
 */

useRcHome();

/** A parked `isocan rc` on one canvas — what makes an agent answerable, and
 * the only thing that can. `--canvas` because this file has two canvases and
 * the directory's binding can only name one. */
async function parkOn(canvasId: string): Promise<{ stop: () => Promise<void> }> {
  const rc = spawnCli(["--canvas", canvasId, "rc"]);
  let out = "";
  rc.stdout!.setEncoding("utf8");
  rc.stdout!.on("data", (chunk) => (out += chunk));
  rc.stderr!.setEncoding("utf8");
  rc.stderr!.on("data", (chunk) => (out += chunk));
  const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
  await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
  return {
    stop: async () => {
      rc.kill("SIGINT");
      await done;
    },
  };
}

interface StandingRecord {
  actor: { id: string; name: string };
  rules?: unknown;
  writtenBy?: { id: string };
  invitedFrom?: string;
}

/** A canvas as the daemon actually holds it — the same shape core reads, so a
 * test can ask core its own questions of it rather than re-deriving them. */
async function canvasOf(canvasId: string): Promise<CanvasContents> {
  const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
  return ((await res.json()) as { canvas: CanvasContents }).canvas;
}

const standingOn = (canvas: CanvasContents): Record<string, StandingRecord> =>
  (canvas.agents ?? {}) as unknown as Record<string, StandingRecord>;

async function agentsOn(canvasId: string): Promise<string[]> {
  return Object.values(standingOn(await canvasOf(canvasId))).map((a) => a.actor.name).sort();
}

async function bench(): Promise<BenchRow[]> {
  const read = await isocan("--json", "bench");
  expect(read.code, read.stderr).toBe(0);
  return (JSON.parse(read.stdout) as { bench: BenchRow[] }).bench;
}

describe("isocan bench", () => {
  it("answers ready, elsewhere and unreachable from three different facts, and rm takes nothing away", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Acme two" },
    });

    // A clean home has no bench and does not invent one by being asked.
    expect(await bench()).toEqual([]);

    // Two agents, enrolled from this machine the ordinary way: the home half
    // lands in canvas state, the running half in ~/.isocan/rc-agents.json.
    expect((await isocan("--canvas", "prj_1", "rc", "add", "Percy", ...TEAM)).code).toBe(0);
    expect((await isocan("--canvas", "prj_2", "rc", "add", "Sian", ...TEAM)).code).toBe(0);
    expect((await rcRows()).map((row) => row.name).sort()).toEqual(["Percy", "Sian"]);
    const percy = Object.values(await snapshotAgents()).find((a) => a.actor.name === "Percy")!.actor;

    // Benching takes the agent from what the machine already knows: no actor
    // is minted, no rc handshake happens, and nothing is enrolled anywhere.
    for (const name of ["Percy", "Sian"]) {
      const added = await isocan("bench", "add", name);
      expect(added.code, added.stderr).toBe(0);
      expect(added.stdout).toContain("grants nothing");
    }
    expect(await agentsOn("prj_1")).toEqual(["Percy"]);
    expect(await agentsOn("prj_2")).toEqual(["Sian"]);

    // An agent this machine has never run cannot be guessed at — but it can be
    // named, because a bench row is a record and a record may name an agent
    // that lives somewhere else entirely.
    const guessed = await isocan("bench", "add", "Wooly");
    expect(guessed.code).not.toBe(0);
    expect(guessed.stderr).toContain("--actor");
    expect((await isocan("bench", "add", "Wooly", "--actor", "usr_wooly", "--harness", "sheep")).code).toBe(0);

    // Nothing is parked yet, so nothing is ready — and the two agents that
    // stand somewhere are told apart from the one that does not.
    expect((await bench()).map((row) => [row.name, row.reach])).toEqual([
      ["Percy", "elsewhere"],
      ["Sian", "elsewhere"],
      ["Wooly", "unreachable"],
    ]);

    const rc = await parkOn("prj_1");
    try {
      await until(() => answeringFor("prj_1"), (ids) => ids.includes(percy.id), "the rc to hold Percy");
      const rows = await bench();
      expect(rows.map((row) => [row.name, row.reach])).toEqual([
        ["Percy", "ready"],
        ["Sian", "elsewhere"],
        ["Wooly", "unreachable"],
      ]);
      // All three values are reachable, and no code path collapses them into
      // two: the set of answers on one bench is the whole vocabulary.
      expect([...new Set(rows.map((row) => row.reach))].sort()).toEqual([...BENCH_REACH].sort());
      // The record half is the item's, and it says only what it was told.
      expect(rows[0]).toMatchObject({ actorId: percy.id, harness: "claude-code" });
      expect(rows.find((row) => row.name === "Wooly")).toMatchObject({
        harness: "sheep",
        runsAt: null,
        standing: [],
      });
      // A person's table says the same three things in words.
      const printed = await isocan("bench");
      expect(printed.stdout).toContain("ready");
      expect(printed.stdout).toContain("its machine is not here");
      expect(printed.stdout).toContain("nothing here can run it");
      expect(printed.stdout).toContain("standing on 1 canvas");
    } finally {
      await rc.stop();
    }

    // Off the bench, and NOTHING else moves: Sian still stands on prj_2, and
    // this machine still holds her running row. "A bench row confers nothing"
    // has to cut both ways or the bench is a second registry.
    const removed = await isocan("bench", "rm", "Sian");
    expect(removed.code, removed.stderr).toBe(0);
    expect((await bench()).map((row) => row.name)).toEqual(["Percy", "Wooly"]);
    expect(await agentsOn("prj_2")).toEqual(["Sian"]);
    expect((await rcRows()).map((row) => row.name).sort()).toEqual(["Percy", "Sian"]);
    // And an agent nobody benched is not on the bench to remove.
    expect((await isocan("bench", "rm", "Sian")).code).not.toBe(0);
  }, 120_000);
});

/**
 * **`isocan bench join`** (phase 1 — journey 2), walked with the real binary.
 *
 * The phase's whole point is the case the old rule does not cover: **no rc is
 * parked anywhere in this test.** Naming an agent you already own is not the
 * same act as introducing a stranger — the actor exists, its custody is
 * settled, and nothing needs to be asked of any machine — so a join must
 * succeed against a canvas whose rc is not running. A test that only covered
 * the parked case would prove nothing about this phase.
 *
 * And then the rule most likely to erode, from four sides: joining confers
 * standing HERE and nothing else. No turn, no widened `listen`, no other
 * canvas's rules touched, no second join quietly rewriting the first.
 */
describe("isocan bench join", () => {
  it("joins with nothing parked, and confers nothing but standing here", async () => {
    for (const [id, title] of [["prj_2", "Acme two"], ["prj_3", "Acme three"]]) {
      await post("/api/ops", {
        canvasId: null,
        actor: dimitri,
        op: { type: "project.create", canvasId: id, title },
      });
    }

    // Percy exists and answers on prj_1, opened to everyone there — a real
    // `listen` grant, so "joining does not alter listen grants" has something
    // to be false about.
    expect((await isocan("--canvas", "prj_1", "rc", "add", "Percy", ...TEAM)).code).toBe(0);
    expect((await isocan("bench", "add", "Percy")).code).toBe(0);
    const openedOn1 = standingOn(await canvasOf("prj_1"));
    const percy = Object.values(openedOn1).find((a) => a.actor.name === "Percy")!;
    expect(percy.rules).toBeTruthy();

    // Nothing is parked on the target. This is the phase, in one assertion:
    // everything below happens with no `isocan rc` running anywhere.
    expect(await answeringFor("prj_2")).toEqual([]);
    const threadsBefore = (await canvasOf("prj_2")).threads;

    const joined = await isocan("--canvas", "prj_2", "bench", "join", "Percy");
    expect(joined.code, joined.stderr).toBe(0);
    expect(joined.stdout).toContain("Percy answers on Acme two");
    // Said in journey 1's words, measured rather than asserted: nothing is
    // parked, so this is not `ready` however recently it was benched.
    expect(joined.stdout).toContain("its machine is not here");

    // It is in the roster the terminal prints — the phase's read-back — and
    // the record carries which bench vouched.
    const who = await isocan("--json", "--canvas", "prj_2", "who");
    expect(who.code, who.stderr).toBe(0);
    const standing = (JSON.parse(who.stdout) as { standing: Array<{ actor: { name: string }; state: string }> }).standing;
    expect(standing.map((row) => [row.actor.name, row.state])).toEqual([["Percy", "enrolled"]]);
    const after2 = await canvasOf("prj_2");
    expect(standingOn(after2)[percy.actor.id]!.invitedFrom).toMatch(/^prj_/);

    // …and `@Percy` resolves here now, which is what makes a summons possible
    // at all. Asked of the canvas the daemon actually holds, through core's
    // own resolution rather than a second reading of it.
    expect(
      extractMentions("@Percy could you look?", collectCanvasNames(after2)),
    ).toEqual([percy.actor.id]);

    // **Confers nothing else**, four ways.
    // No turn: joining wrote no comment and started no session.
    expect(after2.threads).toEqual(threadsBefore);
    expect(await answeringFor("prj_2")).toEqual([]);
    // No listen grant here: the fresh row carries no rules at all, which the
    // rc reads as owner-only.
    expect(standingOn(after2)[percy.actor.id]).not.toHaveProperty("rules");
    // Nothing moved on the canvas Percy already answered on.
    expect(standingOn(await canvasOf("prj_1"))).toEqual(openedOn1);
    // And no third canvas learned anything.
    expect(await agentsOn("prj_3")).toEqual([]);

    // The bench itself is unchanged as a record — one more canvas stood on,
    // and still nothing parked anywhere.
    const rows = await bench();
    expect(rows.map((row) => [row.name, row.reach])).toEqual([["Percy", "elsewhere"]]);
    expect(rows[0]!.standing.map((one) => one.canvasId).sort()).toEqual(["prj_1", "prj_2"]);

    // A second join is not a second grant: it says so and writes nothing new.
    const again = await isocan("--canvas", "prj_2", "bench", "join", "Percy");
    expect(again.code, again.stderr).toBe(0);
    expect(again.stdout).toContain("already answers");
    expect(standingOn(await canvasOf("prj_2"))).toEqual(standingOn(after2));

    // And an agent nobody benched cannot be joined from a bench it is not on.
    const stranger = await isocan("--canvas", "prj_2", "bench", "join", "Wooly");
    expect(stranger.code).not.toBe(0);
    expect(stranger.stderr).toContain("on your bench");
  }, 120_000);
});

/**
 * **The bench fills itself** (phase 3 — journey 1's residue: a bench that is
 * true without being curated), walked with the real binary.
 *
 * Three things, and the order matters because the first one is the failure
 * mode rather than the feature.
 *
 * **The registry must never be able to break the act it records.** Enrolment
 * is the real act and the row is a convenience, so a person with no personal
 * canvas enrols exactly as they did before — and does not come back to find
 * one has been made for them. A private canvas is a person's own gesture, and
 * `isocan agent add` is not it.
 *
 * **Then the feature**: an agent enrolled the old way is on the bench without
 * anybody touching the bench, from both verbs, and a second enrolment of the
 * same agent is not a second row.
 *
 * **Then the decision, asserted because it is the shape most likely to be
 * "tidied" later** (design.md, 15 Sep 2026): *withdrawal never touches the
 * row.* The bench is the agents you HAVE, not the agents standing somewhere.
 * Withdrawing Percy from every canvas leaves the ROW in place, reading
 * `unreachable` — honest about the dead-machine case rather than sweeping it
 * up — and `bench rm` stays the only way a row leaves.
 */
describe("enrolment writes its own bench row", () => {
  /** What `isocan context personal status` says the binding is, without
   * creating one — the read that proves nothing was made behind anybody's
   * back. */
  async function personalSource(): Promise<{ canvasId: string } | null> {
    const read = await isocan("--json", "context", "personal", "status");
    expect(read.code, read.stderr).toBe(0);
    return (JSON.parse(read.stdout) as { source: { canvasId: string } | null }).source;
  }

  it("with no bench, from both verbs, and a withdrawal leaves the row standing nowhere", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Acme two" },
    });

    // **The trap first.** No personal canvas exists, and enrolling must not
    // care: the act succeeds, and it says plainly that no row was written so
    // a missing row can never read as a missing agent.
    expect(await personalSource()).toBeNull();
    const early = await isocan("--canvas", "prj_1", "rc", "add", "Wooly", ...TEAM);
    expect(early.code, early.stderr).toBe(0);
    expect(early.stderr).toContain("no personal canvas");
    // And nothing was created on their behalf. This is the assertion the
    // phase names: the bench is a convenience, a private canvas is not.
    expect(await personalSource()).toBeNull();
    expect(await agentsOn("prj_1")).toEqual(["Wooly"]);
    expect((await rcRows()).map((row) => row.name)).toEqual(["Wooly"]);
    expect(await bench()).toEqual([]);

    // The person makes one themselves. THIS is the gesture.
    const made = await isocan("context", "personal");
    expect(made.code, made.stderr).toBe(0);
    expect(await personalSource()).not.toBeNull();

    // **Now the feature**: enrolled the old way, and on the bench without
    // anybody running a bench verb.
    expect((await isocan("--canvas", "prj_1", "rc", "add", "Percy", ...TEAM)).code).toBe(0);
    const first = await bench();
    expect(first.map((row) => row.name)).toEqual(["Percy"]);
    // What the row carries is what the enrolment knew — the harness, and an
    // opaque label for where it runs. Never a working directory.
    expect(first[0]).toMatchObject({ harness: "claude-code" });
    expect(first[0]!.runsAt).toBeTruthy();
    expect(JSON.stringify(first[0])).not.toContain("/");
    expect(first[0]!.standing.map((one) => one.canvasId)).toEqual(["prj_1"]);
    // Wooly, enrolled before there was a bench, is still not on it: the write
    // is best-effort, not eventually-consistent, and nothing goes back.
    expect(first.some((row) => row.name === "Wooly")).toBe(false);

    // The other verb, the same funnel. `agent add` refuses an explicit
    // --canvas (it enrols beside itself), so it is told where it stands the
    // way a summoned agent is.
    const added = await collect(
      spawnCli(["agent", "add", "Sian", ...TEAM], { ISOCAN_CANVAS: "prj_1" }),
    );
    expect(added.code, added.stderr).toBe(0);
    expect((await bench()).map((row) => row.name)).toEqual(["Percy", "Sian"]);

    // A second canvas for an agent already benched is not a second row:
    // identity is the actor, and one machine has one Percy.
    expect((await isocan("--canvas", "prj_2", "rc", "add", "Percy", ...TEAM)).code).toBe(0);
    const twice = await bench();
    expect(twice.map((row) => row.name)).toEqual(["Percy", "Sian"]);
    expect(twice[0]!.standing.map((one) => one.canvasId).sort()).toEqual(["prj_1", "prj_2"]);

    // **And the decision.** Withdrawn from every canvas it stood on, Percy
    // is still an agent this person HAS.
    for (const canvasId of ["prj_1", "prj_2"]) {
      const gone = await isocan("--canvas", canvasId, "rc", "remove", "Percy");
      expect(gone.code, gone.stderr).toBe(0);
    }
    expect((await rcRows()).some((row) => row.name === "Percy")).toBe(false);
    expect(await agentsOn("prj_2")).toEqual([]);
    const after = await bench();
    const percy = after.find((row) => row.name === "Percy");
    expect(percy, "withdrawal must never take a row off the bench").toBeTruthy();
    expect(percy!.standing).toEqual([]);
    // Standing nowhere and nothing here can run it — said, not swept up.
    expect(percy!.reach).toBe("unreachable");
    const printed = await isocan("bench");
    expect(printed.stdout).toContain("standing nowhere");
    expect(printed.stdout).toContain("nothing here can run it");

    // `bench rm` is still the only way a row leaves.
    expect((await isocan("bench", "rm", "Percy")).code).toBe(0);
    expect((await bench()).map((row) => row.name)).toEqual(["Sian"]);
  }, 180_000);

  /**
   * The funnel, read from the source, because a comment saying "every
   * enrolment path" is not a thing that can fail. `mintAndEnrol` is the one
   * place an actor is minted and enrolled — `agent add`, `rc add` and the rc
   * answering a web ask all reach it — so the bench write belongs there and
   * exactly there. A fourth path that wrote its own row would be phase 0's
   * drift in a new place.
   */
  it("writes the row from the one funnel, and never creates a personal canvas to do it", () => {
    const main = withoutComments(
      readFileSync(fileURLToPath(new URL("../src/main.ts", import.meta.url)), "utf8"),
    );
    expect(main.match(/noteOnBench\(/g)).toHaveLength(1);
    const funnel = main.slice(main.indexOf("async function mintAndEnrol("));
    expect(funnel.slice(0, funnel.indexOf("\n}\n"))).toContain("noteOnBench(");

    // And the write itself reads the binding rather than ensuring it. The
    // ONE `ensurePersonal` in the CLI's bench file is `bench add`'s, which is
    // a person asking for a bench in those words.
    const source = withoutComments(
      readFileSync(fileURLToPath(new URL("../src/bench.ts", import.meta.url)), "utf8"),
    );
    const write = source.slice(
      source.indexOf("export async function noteOnBench("),
      source.indexOf("export function registerBench("),
    );
    expect(write).toContain("benchCanvasId(");
    expect(write).not.toContain("ensurePersonal");
    expect(source.match(/ensurePersonal/g)).toHaveLength(1);
  });
});
