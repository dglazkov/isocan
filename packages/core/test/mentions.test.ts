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
