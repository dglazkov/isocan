import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AGENT_KIND,
  BENCH_REACH,
  benchAgentOf,
  benchAgents,
  benchItemOf,
  benchRows,
  benchStandingWords,
  benchWords,
  benchWriteFor,
  emptyCanvas,
  type BenchCanvas,
  type CanvasContents,
  type Item,
  type PresenceSession,
} from "../src/index.ts";
import { withoutComments } from "../../../test/source.ts";

/**
 * **The bench reads, and it reads three things** (`docs/projects/bench`,
 * phase 0).
 *
 * The project's second rule is the one this file exists for: *no phase may
 * reduce reachability to a boolean. Three states, always, even when only two
 * are reachable in practice.* A build that collapsed `elsewhere` into
 * `unreachable` would type check, pass a test that only asserted "ready or
 * not", and paint journey 4 — the agent that answers at three in the morning
 * from a cell — out of the product. So every state is reached here from
 * inputs that differ only in the fact that distinguishes it.
 */

const NOW = Date.parse("2026-09-15T12:00:00Z");
const actor = (id: string, name: string) => ({ id, name });

function agentItem(id: string, name: string, props: Record<string, string>): Item {
  return {
    id,
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    title: name,
    description: "",
    properties: { kind: AGENT_KIND, ...props },
    createdAt: "2026-09-15T00:00:00Z",
    createdBy: actor("usr_dion", "Dion"),
    updatedAt: "2026-09-15T00:00:00Z",
    updatedBy: actor("usr_dion", "Dion"),
    versions: [],
    currentVersionId: null,
  } as unknown as Item;
}

/** A canvas somebody's agent stands on — the enrolment half, which is canvas
 * state and therefore travels to every machine that can read the canvas. */
function standingOn(canvasId: string, title: string, enrolled: Array<{ id: string; name: string }>): CanvasContents {
  const canvas = emptyCanvas();
  for (const one of enrolled) canvas.agents![one.id] = { actor: one } as never;
  void canvasId;
  void title;
  return canvas;
}

/** A parked `isocan rc` session, as presence carries it: `wait`'s own
 * lifecycle signature, which is what `roster()` reads as `parked`. */
function parkedSession(who: { id: string; name: string }): PresenceSession {
  return {
    sessionId: `ses_${who.id}`,
    actor: who,
    kind: "cli",
    harness: "claude-code",
    label: null,
    cursor: null,
    selection: [],
    status: "waiting",
    statusSource: "lifecycle",
    activity: null,
    lastSeen: new Date(NOW).toISOString(),
  } as unknown as PresenceSession;
}

const percy = actor("usr_percy", "Percy");
const sian = actor("usr_sian", "Sian");
const wooly = actor("usr_wooly", "Wooly");

function bench(): CanvasContents {
  const canvas = emptyCanvas();
  for (const [id, who, harness] of [
    ["itm_percy", percy, "claude-code"],
    ["itm_sian", sian, "codex"],
    ["itm_wooly", wooly, "sheep"],
  ] as const) {
    canvas.items[id] = agentItem(id, who.name, { actorId: who.id, harness, runsAt: "laptop" });
  }
  return canvas;
}

describe("the bench, read off a personal canvas", () => {
  it("reads the agent an item records, and ignores everything that is not one", () => {
    const canvas = bench();
    canvas.items.itm_note = agentItem("itm_note", "A note", {});
    canvas.items.itm_note.properties = { kind: "text" };
    // A row that names no actor is not a bench row: nothing can be measured
    // against it, and a row nothing can measure is a claim.
    canvas.items.itm_nameless = agentItem("itm_nameless", "Nobody", {});
    expect(benchAgents(canvas).map((row) => row.name)).toEqual(["Percy", "Sian", "Wooly"]);
    expect(benchAgentOf(canvas.items.itm_nameless!)).toBeNull();
    expect(benchAgentOf(canvas.items.itm_note!)).toBeNull();
    expect(benchAgentOf(canvas.items.itm_percy!)).toMatchObject({
      actorId: percy.id,
      harness: "claude-code",
      runsAt: "laptop",
    });
  });

  it("writes a row the reader above can read back, and says nothing it was not told", () => {
    const card = benchItemOf("Percy", { actorId: percy.id, harness: "claude-code" });
    expect(card.properties).toEqual({ kind: AGENT_KIND, actorId: percy.id, harness: "claude-code" });
    // `runsAt` unsaid is absent, not "unknown": an empty property would be a
    // reader's problem forever.
    expect(card.properties.runsAt).toBeUndefined();
    const canvas = emptyCanvas();
    canvas.items.itm_x = agentItem("itm_x", "Percy", card.properties);
    expect(benchAgentOf(canvas.items.itm_x!)).toMatchObject({ name: "Percy", runsAt: null });
    // The blob is the row written out, so the card is readable on the canvas
    // itself rather than being a blank rectangle.
    expect(card.blob).toContain(percy.id);
    expect(card.blob).toContain("grants no standing");
  });

  /**
   * **The proof's three rows.** Percy has a parked rc answering for it, Sian
   * stands on a canvas with nothing parked, Wooly is a row this machine has
   * no running record for and no enrolment anywhere.
   */
  it("gives one row per state, from inputs that differ only in what distinguishes them", () => {
    const canvases: BenchCanvas[] = [
      {
        canvasId: "prj_1",
        canvasTitle: "Acme one",
        canvas: standingOn("prj_1", "Acme one", [percy]),
        sessions: [parkedSession(percy)],
      },
      {
        canvasId: "prj_2",
        canvasTitle: "Acme two",
        canvas: standingOn("prj_2", "Acme two", [sian]),
        sessions: [],
      },
    ];
    const rows = benchRows(benchAgents(bench()), canvases, new Set([percy.id, sian.id]), NOW);
    expect(rows.map((row) => [row.name, row.reach])).toEqual([
      ["Percy", "ready"],
      ["Sian", "elsewhere"],
      ["Wooly", "unreachable"],
    ]);
    // Three states, and all three of them reached: a build that collapsed the
    // middle one would have two distinct values here and still pass a test
    // that only asked "ready or not".
    expect(new Set(rows.map((row) => row.reach)).size).toBe(BENCH_REACH.length);
    expect(BENCH_REACH.length).toBe(3);
    expect([...new Set(rows.map((row) => row.reach))].sort()).toEqual([...BENCH_REACH].sort());
    // And each says something different out loud — three states that print
    // one sentence between them are two states wearing a third's name.
    expect(new Set(rows.map(benchWords)).size).toBe(3);
    expect(rows.map(benchStandingWords)).toEqual([
      "standing on 1 canvas",
      "standing on 1 canvas",
      "standing nowhere",
    ]);
  });

  it("reads `ready` from the daemon's rc holds too, which is all a browser can see", () => {
    // The app has no per-canvas session list for a canvas it is not looking
    // at, so its `ready` rests on `roster()`'s fourth argument — the
    // connection-bound holds. Same function, fewer inputs, same answer.
    const canvases: BenchCanvas[] = [
      {
        canvasId: "prj_1",
        canvasTitle: "Acme one",
        canvas: standingOn("prj_1", "Acme one", [percy, sian]),
        sessions: [],
        answerable: new Set([percy.id]),
      },
    ];
    const rows = benchRows(benchAgents(bench()), canvases, new Set(), NOW);
    expect(rows.map((row) => [row.name, row.reach])).toEqual([
      ["Percy", "ready"],
      ["Sian", "elsewhere"],
      ["Wooly", "unreachable"],
    ]);
  });

  it("a machine that holds a running row says `elsewhere`, never `unreachable`", () => {
    // The difference journey 1 is about: "its machine is not here" is said
    // plainly rather than inferred by a reader from a missing ring. With no
    // enrolment anywhere, the rc row on this machine is the whole of the
    // evidence, and it is enough to know the agent exists.
    const [alone] = benchRows(
      benchAgents(bench()).filter((row) => row.actorId === wooly.id),
      [],
      new Set([wooly.id]),
      NOW,
    );
    expect(alone!.reach).toBe("elsewhere");
    const [nothing] = benchRows(
      benchAgents(bench()).filter((row) => row.actorId === wooly.id),
      [],
      new Set(),
      NOW,
    );
    expect(nothing!.reach).toBe("unreachable");
  });

  it("a hold somewhere else outranks this machine knowing nothing about it", () => {
    // Journey 4, kept open: Percy is answered by a cell this laptop has never
    // heard of. A derivation that asked "is there an rc row here?" FIRST would
    // print `unreachable` over the top of an agent that is answering.
    const [row] = benchRows(
      benchAgents(bench()).filter((one) => one.actorId === percy.id),
      [
        {
          canvasId: "prj_1",
          canvasTitle: "Acme one",
          canvas: standingOn("prj_1", "Acme one", [percy]),
          sessions: [],
          answerable: new Set([percy.id]),
        },
      ],
      new Set(),
      NOW,
    );
    expect(row!.reach).toBe("ready");
  });

  /**
   * The bench must be a fourth CALLER of `roster()`, never a fourth
   * derivation — `isocan who`, the agent tray and the workbench are the other
   * three, and they agree because there is one answer rather than three
   * written to agree. Read from the source, because a comment saying so is
   * not a thing that can fail.
   */
  it("is a caller of roster(), not a second reading of presence", () => {
    const source = withoutComments(
      readFileSync(fileURLToPath(new URL("../src/bench.ts", import.meta.url)), "utf8"),
    );
    expect(source).toContain("roster(");
    expect(source).toMatch(/import \{ roster.*\} from "\.\/roster\.ts"/);
    // The two facts `roster()` owns must be asked of it, not recomputed here.
    expect(source).not.toContain("statusSource");
    expect(source).not.toContain("lastSeen");
  });
});

/**
 * **What an enrolment asks of a bench** (phase 3 — the registry fills itself).
 *
 * `isocan bench add` is no longer the only thing that writes a row: every
 * enrolment this machine makes writes or updates one, so the decision *is
 * this actor already here, and where does a new card go* is asked from three
 * places and has to have exactly one answer. The two rules that will be
 * "tidied" later, asserted here rather than left to a comment: identity is
 * the ACTOR, never the name, and a row's existing answers are never
 * overwritten by whichever machine enrolled last.
 */
describe("benchWriteFor", () => {
  const laid = { actorId: percy.id, harness: "claude-code", runsAt: "laptop" };

  it("places a new card in rows of four, counting the rows already there", () => {
    expect(benchWriteFor(emptyCanvas(), { actorId: "usr_new" })).toEqual({ kind: "add", x: 0, y: 0 });
    // Three rows already, so the fourth card sits beside them and the fifth
    // starts the next line — a pile at the origin is not a list.
    expect(benchWriteFor(bench(), { actorId: "usr_new" })).toEqual({ kind: "add", x: 3 * 360, y: 0 });
    const four = bench();
    four.items.itm_four = agentItem("itm_four", "Ada", { actorId: "usr_four" });
    expect(benchWriteFor(four, { actorId: "usr_new" })).toEqual({ kind: "add", x: 0, y: 220 });
  });

  it("knows a row by its actor, not by what somebody called it", () => {
    const renamed = bench();
    renamed.items.itm_percy!.title = "Percival";
    // The same agent under a new title is one row, not two: a registry that
    // counted names would double an agent the day its person renamed it.
    expect(benchWriteFor(renamed, laid)).toEqual({ kind: "already", itemId: "itm_percy" });
    // …and a different actor wearing a name already on the bench is a second
    // agent, because the name is what a person calls it and the actor is what
    // a summons, an enrolment and a parked rc all name.
    expect(benchWriteFor(renamed, { actorId: "usr_other", harness: "codex" }).kind).toBe("add");
  });

  it("fills a silence and overwrites nothing", () => {
    const quiet = emptyCanvas();
    quiet.items.itm_quiet = agentItem("itm_quiet", "Percy", { actorId: percy.id });
    // A row benched by hand with nothing but an actor learns what the
    // enrolment knows — that is the whole of "a registry kept by hand goes
    // stale", fixed without a second table.
    expect(benchWriteFor(quiet, laid)).toEqual({
      kind: "fill",
      itemId: "itm_quiet",
      properties: { harness: "claude-code", runsAt: "laptop" },
    });
    // Only the halves that were silent.
    const half = emptyCanvas();
    half.items.itm_half = agentItem("itm_half", "Percy", { actorId: percy.id, harness: "codex" });
    expect(benchWriteFor(half, laid)).toEqual({
      kind: "fill",
      itemId: "itm_half",
      properties: { runsAt: "laptop" },
    });
    // And a row that already answers is left alone, however different the
    // answer: the bench is a person's own record, and a `runsAt` rewritten by
    // whichever machine enrolled last would flip between two machines'
    // opinions, one op per enrolment, forever.
    expect(benchWriteFor(bench(), { actorId: percy.id, harness: "codex", runsAt: "sheep-2" })).toEqual({
      kind: "already",
      itemId: "itm_percy",
    });
  });

  it("asks nothing of an agent that said nothing", () => {
    const quiet = emptyCanvas();
    quiet.items.itm_quiet = agentItem("itm_quiet", "Percy", { actorId: percy.id });
    // An enrolment with no harness named writes no op at all rather than an
    // empty patch: a registry that touched the canvas on every enrolment
    // would fill somebody's history with nothing.
    expect(benchWriteFor(quiet, { actorId: percy.id, harness: null, runsAt: null })).toEqual({
      kind: "already",
      itemId: "itm_quiet",
    });
  });
});
