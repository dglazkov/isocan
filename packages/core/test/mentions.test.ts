import { describe, expect, it } from "vitest";
import { actorsAnswerTo,
  collectCanvasActors,
  collectCanvasNames,
  extractMentions,
  findMentionSpans,
} from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";

const dimitri = { id: "usr_d", name: "Dimitri Glazkov" };
const kenny = { id: "usr_k", name: "Kenny" };
const kennyLabel = { id: "usr_k", name: "Kenny 🤖" };
const nico = { id: "usr_n", name: "Nico" };

describe("extractMentions", () => {
  it("matches full names and first-name tokens, case-insensitively", () => {
    expect(extractMentions("@Dimitri Glazkov please review", [dimitri, kenny])).toEqual(["usr_d"]);
    expect(extractMentions("@dimitri please review", [dimitri, kenny])).toEqual(["usr_d"]);
    expect(extractMentions("ping @KENNY about this", [dimitri, kenny])).toEqual(["usr_k"]);
  });

  it("matches presence labels and dedupes to one id", () => {
    expect(extractMentions("@Kenny 🤖 build it", [kenny, kennyLabel])).toEqual(["usr_k"]);
    expect(extractMentions("hey @Kenny and again @Kenny", [kenny, kennyLabel])).toEqual([
      "usr_k",
    ]);
  });

  it("collects multiple distinct mentions", () => {
    expect(extractMentions("@Kenny and @Dimitri: thoughts?", [dimitri, kenny])).toEqual([
      "usr_d",
      "usr_k",
    ]);
  });

  it("requires @ to start a word — emails and partial names don't mention", () => {
    expect(extractMentions("mail dimitri@example.com", [dimitri])).toEqual([]);
    expect(extractMentions("@Nicolas is someone else", [nico])).toEqual([]);
    expect(extractMentions("no at-sign Dimitri", [dimitri])).toEqual([]);
  });

  it("handles punctuation after the name", () => {
    expect(extractMentions("@Kenny, take a look.", [kenny])).toEqual(["usr_k"]);
    expect(extractMentions("(@Dimitri)", [dimitri])).toEqual(["usr_d"]);
  });
});

describe("findMentionSpans", () => {
  it("locates each mention, longest name first", () => {
    const body = "@Dimitri Glazkov: ask @Kenny 🤖 about it";
    expect(findMentionSpans(body, [dimitri, kenny, kennyLabel])).toEqual([
      { start: 0, end: 16, actorId: "usr_d", name: "Dimitri Glazkov" },
      { start: 22, end: 31, actorId: "usr_k", name: "Kenny 🤖" },
    ]);
    expect(body.slice(0, 16)).toBe("@Dimitri Glazkov");
    expect(body.slice(22, 31)).toBe("@Kenny 🤖");
  });

  it("keeps the body's own casing in the span", () => {
    expect(findMentionSpans("hey @kenny", [kenny])).toEqual([
      { start: 4, end: 10, actorId: "usr_k", name: "kenny" },
    ]);
  });

  it("skips non-mentions and never overlaps", () => {
    expect(findMentionSpans("mail dimitri@example.com", [dimitri])).toEqual([]);
    expect(findMentionSpans("@Nicolas", [nico])).toEqual([]);
    expect(findMentionSpans("@Kenny @Kenny", [kenny])).toEqual([
      { start: 0, end: 6, actorId: "usr_k", name: "Kenny" },
      { start: 7, end: 13, actorId: "usr_k", name: "Kenny" },
    ]);
  });
});

/**
 * **Two people with one name**, which this product produces on its own: agents
 * are named by their tool ("Claude", twice), and `actorsAnswerTo` deliberately
 * keeps old names alive, so a rename onto a name somebody else already has is
 * one keystroke away.
 *
 * The summons goes to exactly ONE of them and there is no sign that anybody
 * else was meant. That is a real loss and it is not fixed here — deciding
 * whether `@Claude` should reach both, or be disambiguated in the menu before
 * it is ever written, is a design question and not a test's to answer.
 *
 * What IS a test's to answer is that the answer is stable. Which one gets the
 * ping currently falls out of `Array.prototype.find` over a length sort, which
 * means it depends on sort stability and on the order the caller happened to
 * collect actors in. Pinned here so it cannot drift silently, and so the loss
 * is visible to whoever comes to fix it.
 */
describe("when two people answer to the same name", () => {
  const first = { id: "usr_a", name: "Claude" };
  const second = { id: "usr_b", name: "Claude" };

  it("summons exactly one of them, the first offered — the other is never told", () => {
    expect(extractMentions("@Claude look at this", [first, second])).toEqual(["usr_a"]);
    // KNOWN LOSS: usr_b is not in that list, and nothing in the body says so.
    expect(extractMentions("@Claude look at this", [second, first])).toEqual(["usr_b"]);
  });

  it("marks one span, not two overlapping ones", () => {
    const spans = findMentionSpans("@Claude", [first, second]);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.actorId).toBe("usr_a");
  });

  it("does the same when the collision comes from a RENAME rather than a birth", () => {
    // usr_b was "Sam" and is now "Claude" too. Both names stay resolvable —
    // old text still points at the right person — and the older claim wins.
    const sam = { id: "usr_b", name: "Sam" };
    const answers = actorsAnswerTo([first, sam], { usr_b: "Claude" });
    expect(answers).toContainEqual({ id: "usr_b", name: "Claude" });
    expect(extractMentions("@Claude look", answers)).toEqual(["usr_a"]);
    // …and Sam is still reachable under the name the canvas remembers.
    expect(extractMentions("@Sam look", answers)).toEqual(["usr_b"]);
  });
});

/**
 * Names are free-form, and the docstring says so out loud: "spaces, emoji".
 * Emoji are covered above (`Kenny 🤖`). These are the two neighbours of that
 * claim that had no case — a right-to-left name, and a name carrying an
 * invisible mark.
 */
describe("names that are not Latin text", () => {
  const dana = { id: "usr_fa", name: "دیون" };

  it("resolves a right-to-left name written as itself", () => {
    expect(extractMentions("سلام @دیون", [dana])).toEqual(["usr_fa"]);
    expect(findMentionSpans("@دیون", [dana])).toEqual([
      { start: 0, end: 1 + dana.name.length, actorId: "usr_fa", name: dana.name },
    ]);
  });

  /**
   * The two negative controls that keep `@` honest — "the @ must start a word"
   * and "the name must END on a word boundary" — existed only in ASCII
   * (`dimitri@example.com`, `@Nicolas is someone else`). `isWordChar` is
   * written `/[\p{L}\p{N}_]/u` on purpose, and replacing it with `/[A-Za-z0-9_]/`
   * left this file green: an ASCII-only boundary makes every non-Latin letter
   * a separator, so a Persian word ending in `@` becomes a mention and a name
   * with one more letter after it still resolves. Same rule, the other script.
   */
  it("does not mention anybody from mid-word, in any script", () => {
    // No space: the "@" is inside a word, exactly as in an email address.
    expect(extractMentions("سلام@دیون", [dana])).toEqual([]);
  });

  it("requires the name to END on a boundary, in any script", () => {
    // "دیونم" is a longer word that merely starts with the name — the
    // non-Latin twin of "@Nicolas is someone else".
    expect(extractMentions("@دیونم", [dana])).toEqual([]);
    expect(extractMentions("@دیون م", [dana])).toEqual(["usr_fa"]);
  });

  it("treats an invisible mark as part of the name, both ways", () => {
    // U+200F RIGHT-TO-LEFT MARK. A paste from a chat window carries these, and
    // the person typing the mention does not. It is a CHARACTER, so a name
    // carrying one is a different name — which is a defensible answer, but
    // only if it is the same answer every time.
    const marked = { id: "usr_m", name: "\u200fدیون" };
    expect(extractMentions("@\u200fدیون", [marked])).toEqual(["usr_m"]);
    expect(
      extractMentions("@دیون", [marked]),
      "an unmarked mention does not reach a marked name",
    ).toEqual([]);
    expect(
      extractMentions("@\u200fدیون", [dana]),
      "and a marked mention does not reach an unmarked name",
    ).toEqual([]);
  });
});

describe("collectCanvasActors", () => {
  it("collects item creators/editors, trashed items' actors, and comment authors", () => {
    const actors = collectCanvasActors(seedState().canvas);
    expect(actors.map((a) => a.id).sort()).toEqual(["usr_alice", "usr_bob"]);
  });
});

describe("collectCanvasNames", () => {
  it("keeps every name an actor has worked under; actors stay one entry", () => {
    // Bob comes back under a new name — both still address him.
    const renamed = { id: "usr_bob", name: "Roberta" };
    const state = apply(
      seedState(),
      { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_new", body: "back" } },
      renamed,
    )!;
    const names = collectCanvasNames(state.canvas).map((c) => `${c.id}:${c.name}`);
    expect(names).toContain("usr_bob:Bob");
    expect(names).toContain("usr_bob:Roberta");
    expect(new Set(names).size).toBe(names.length);
    expect(collectCanvasActors(state.canvas).map((a) => a.id).sort()).toEqual([
      "usr_alice",
      "usr_bob",
    ]);
  });
});

describe("a name somebody answers to now", () => {
  const stamped = [{ id: "usr_di", name: "Dion 2" }, { id: "usr_f", name: "Fable" }];
  const now = { usr_di: "Di", usr_f: "Fable" };

  it("resolves a mention by the CURRENT name", () => {
    // The bug this covers is not a missing chip. Before this, "@Di" put no id
    // on the comment, so the summons meant for her woke nobody.
    expect(extractMentions("@Di alright, grilling you", actorsAnswerTo(stamped, now))).toEqual(["usr_di"]);
  });

  it("still resolves the name that was stamped at the time", () => {
    // Text written months ago says "@Dion 2" and points at the same person.
    expect(extractMentions("@Dion 2 have a look", actorsAnswerTo(stamped, now))).toEqual(["usr_di"]);
  });

  it("adds nothing when the name has not changed", () => {
    expect(actorsAnswerTo(stamped, now).filter((a) => a.id === "usr_f")).toHaveLength(1);
  });

  it("is unchanged with no registry to consult", () => {
    expect(actorsAnswerTo(stamped, undefined)).toEqual(stamped);
  });
});
