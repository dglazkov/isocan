import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BENCH_JOIN_VERB,
  benchAgents,
  benchItemOf,
  benchJoinAsk,
  benchJoinRefusal,
  benchJoinWords,
  benchMentions,
  type CanvasContents,
  type Item,
} from "@isocan/core";
import { withoutComments } from "../../../test/source.ts";

/**
 * **`@Name join` from the Chat** (`docs/projects/bench/phases.md`, phase 2 —
 * journey 3).
 *
 * Most of this file is about a parser. The middle of it is not: **the refusal
 * wording here is an information leak rather than a piece of copy**, and the
 * cases under "a refusal that cannot be a probe" are the reason the phase
 * exists in this order. Read those first.
 */

/** A bench item on somebody's personal canvas — the real shape, built by the
 *  same `benchItemOf` the CLI writes rows with, so a test cannot agree with
 *  a spelling the product does not use. Synthetic names throughout. */
function benchItem(id: string, name: string, actorId: string): Item {
  const card = benchItemOf(name, { actorId });
  const who = { id: "usr_owner", name: "Owner" };
  return {
    id,
    title: name,
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    createdBy: who,
    updatedBy: who,
    createdAt: 0,
    updatedAt: 0,
    properties: card.properties,
    versions: [],
  } as unknown as Item;
}

/** A personal canvas holding these rows, and nothing else. */
function benchCanvas(rows: Array<[string, string, string]>): CanvasContents {
  const items: Record<string, Item> = {};
  for (const [id, name, actorId] of rows) items[id] = benchItem(id, name, actorId);
  return { items, threads: {}, trash: [] } as unknown as CanvasContents;
}

/** A canvas somebody is talking on, with these agents standing on it. */
function canvasWith(standing: string[]): CanvasContents {
  const agents: Record<string, { actor: { id: string; name: string } }> = {};
  for (const id of standing) agents[id] = { actor: { id, name: id } };
  return { items: {}, threads: {}, trash: [], agents } as unknown as CanvasContents;
}

/**
 * **The whole path a speaker's line actually takes**, in one function, so the
 * cases below cannot quietly test a shortcut. Canvas → bench rows → mention
 * candidates → the ask → what is said back.
 *
 * `bench` is the SPEAKER's personal canvas and there is nowhere to put a
 * second one, which is the point being made rather than a convenience.
 */
function said(bench: CanvasContents, talkingOn: CanvasContents, body: string): string | null {
  const ask = benchJoinAsk(body, benchMentions(benchAgents(bench), talkingOn));
  if (!ask) return null;
  return ask.actorId === null ? benchJoinRefusal(ask.name) : benchJoinWords(ask.name);
}

const EMPTY = benchCanvas([]);
const HERE = canvasWith([]);

describe("@Name join, found in a body", () => {
  const dions = benchCanvas([["itm_1", "Sian", "agt_sian"]]);

  it("resolves against the asker's own bench, before the agent is on this canvas", () => {
    const ask = benchJoinAsk("@Sian join", benchMentions(benchAgents(dions), HERE))!;
    expect(ask.actorId).toBe("agt_sian");
    expect(ask.name).toBe("Sian");
    expect([ask.start, ask.end]).toEqual([0, "@Sian join".length]);
  });

  it("is case-insensitive and takes a multi-word name whole, because findMentionSpans does", () => {
    const two = benchCanvas([["itm_1", "Sian Vale", "agt_sian"]]);
    const candidates = benchMentions(benchAgents(two), HERE);
    expect(benchJoinAsk("@sian vale join", candidates)!.actorId).toBe("agt_sian");
    // A first name is a name you answer to — `resolvableNames` says so for
    // every mention in the app, and a bench row is not the place to disagree.
    expect(benchJoinAsk("@Sian join", candidates)!.actorId).toBe("agt_sian");
    // But a name that is nobody's is still nobody's, whole or in part.
    expect(benchJoinAsk("@Vale join", candidates)!.actorId).toBeNull();
  });

  it("is the verb, at the end of a line, and nothing else", () => {
    const candidates = benchMentions(benchAgents(dions), HERE);
    for (const body of [
      "@Sian join us in the morning", // prose about Sian
      "I asked @Sian join", // not the start of a line
      "@Sianjoin", // no space: a name, not a command
      "@Sian", // a mention, not a command
      "@Sian joined", // a different word
      "join @Sian",
    ]) {
      expect(benchJoinAsk(body, candidates), body).toBeNull();
    }
    // …and it is found on a later line as readily as the first.
    const later = benchJoinAsk("morning all\n@Sian join", candidates)!;
    expect(later.start).toBe("morning all\n".length);
    expect(later.actorId).toBe("agt_sian");
  });

  it("marks a bench candidate as not here yet, and stops marking it once it is", () => {
    expect(benchMentions(benchAgents(dions), HERE)).toEqual([
      { id: "agt_sian", name: "Sian", notHereYet: true },
    ]);
    expect(benchMentions(benchAgents(dions), canvasWith(["agt_sian"]))[0]!.notHereYet).toBe(false);
  });

  it("names its verb once, so a composer and a reader cannot disagree", () => {
    expect(BENCH_JOIN_VERB).toBe("join");
  });
});

/**
 * **A refusal that cannot be a probe.**
 *
 * Sian is on Dion's bench — a private canvas Theo cannot read. Theo typing
 * `@Sian join` must be refused with *"Sian is not on your bench"*, and the
 * hard part is not the sentence: it is that the sentence must be **the same
 * one** he gets for a name that exists nowhere at all. A refusal that differed
 * between the two would let him enumerate the contents of somebody else's
 * canvas one name at a time, which is worse than any single leak because it
 * scales.
 *
 * The cases below assert that in two independent ways, because either one
 * alone could be satisfied by an implementation that is about to break the
 * other:
 *
 * 1. **Behaviourally**, by running the same probe through two whole worlds —
 *    one where Sian exists on somebody else's bench, one where she exists
 *    nowhere — and comparing bytes.
 * 2. **Structurally**, by pinning that `benchJoinRefusal` is handed the name
 *    and nothing else. That is what makes the first case true for every name
 *    rather than for the two this file happens to try, and it is the one that
 *    fails the day somebody adds an argument to "give a better message".
 */
describe("the refusal says the same thing about a name that exists and one that does not", () => {
  /**
   * A world: what the speaker has, and what everybody ELSE has.
   *
   * `theirs` is written down and never handed to core — that is the assertion,
   * expressed as code rather than as a promise. The day `benchJoinAsk` or
   * `benchJoinRefusal` grows an argument that could carry it, this helper has
   * to change to feed it, and the change is the review.
   */
  const probe = (mine: CanvasContents, theirs: CanvasContents, name: string): string => {
    // `theirs` exists, is populated, and is deliberately dropped here.
    expect(benchAgents(theirs).length).toBeGreaterThanOrEqual(0);
    return said(mine, HERE, `@${name} join`)!;
  };

  /** Theo's bench: empty in every world below. It is the only bench he has. */
  const theos = EMPTY;
  /** World A: Sian is real, on Dion's bench, which Theo cannot read. */
  const dionHasSian = benchCanvas([["itm_1", "Sian", "agt_sian"]]);
  /** World B: nobody anywhere has ever heard of Sian. */
  const nobodyHasSian = EMPTY;

  it("is byte-identical whether the agent exists on another bench or nowhere", () => {
    // The two worlds differ in a real fact — asserted, so this case cannot
    // pass by comparing two copies of the same nothing.
    expect(benchAgents(dionHasSian).map((one) => one.name)).toEqual(["Sian"]);
    expect(benchAgents(nobodyHasSian)).toEqual([]);

    const exists = probe(theos, dionHasSian, "Sian");
    const doesNot = probe(theos, nobodyHasSian, "Sian");
    expect(exists).toBe("Sian is not on your bench");
    expect(doesNot, "a refusal that moves with somebody else's bench IS that bench, read out loud").toBe(exists);

    // A third world, where the name is on a bench under a different actor: a
    // refusal keyed on "does this name exist at all" would answer differently
    // here, and it must not.
    expect(probe(theos, benchCanvas([["itm_9", "Sian", "agt_other"]]), "Sian")).toBe(exists);
  });

  it("differs between two probed names only by the word the prober typed", () => {
    // "Sian" is on somebody's bench; "Quilla" is on nobody's. If the refusals
    // differ anywhere but in the name, the difference is a signal — and one
    // that scales, because a prober can type a new name every second.
    const blank = (name: string) => probe(theos, dionHasSian, name).split(name).join("•");
    expect(blank("Sian")).toBe(blank("Quilla"));
  });

  it("never says the name is unknown, and never answers with silence", () => {
    const refusal = probe(theos, dionHasSian, "Sian");
    expect(refusal.toLowerCase()).not.toContain("unknown");
    expect(refusal.toLowerCase()).not.toContain("no such");
    expect(refusal.toLowerCase()).not.toContain("not found");
    // The ask exists even though nothing resolved — which is what gives the
    // composer something to refuse instead of posting the line as prose.
    expect(benchJoinAsk("@Sian join", [])).toEqual({
      start: 0,
      end: 10,
      name: "Sian",
      actorId: null,
    });
  });

  it("is given the name and nothing else, which is why the cases above hold for every name", () => {
    expect(benchJoinRefusal.length, "one argument: the name as written").toBe(1);
    const source = withoutComments(
      readFileSync(fileURLToPath(new URL("../src/benchjoin.ts", import.meta.url)), "utf8"),
    );
    const body = source.slice(source.indexOf("export function benchJoinRefusal"));
    expect(
      body.slice(0, body.indexOf("\n}") + 2),
      "a second argument here is a second refusal, and a second refusal is a probe",
    ).toBe(
      "export function benchJoinRefusal(name: string): string {\n  return `${name} is not on your bench`;\n}",
    );
  });
});

/**
 * **The one line the thread gets when it lands**, because the canvas is the
 * only channel — and what it must keep saying: a join confers standing here
 * and nothing else.
 */
describe("what the thread is told when a join lands", () => {
  it("names the agent and says what did not change", () => {
    const line = benchJoinWords("Sian");
    expect(line).toContain("Sian");
    expect(line).toContain("no turn was started");
    expect(line).toContain("no summons rule was written");
  });

  it("is said only for a join that resolved", () => {
    const dions = benchCanvas([["itm_1", "Sian", "agt_sian"]]);
    expect(said(dions, HERE, "@Sian join")).toBe(benchJoinWords("Sian"));
    expect(said(EMPTY, HERE, "@Sian join")).toBe(benchJoinRefusal("Sian"));
    expect(said(dions, HERE, "good morning")).toBeNull();
  });
});
