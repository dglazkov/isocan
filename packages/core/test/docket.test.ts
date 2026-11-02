import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { DOCKET_CLAIM, DOCKET_MARKS, docketAnswer, docketSlug, docketVerdict } from "../src/docket.ts";
import { reactOp } from "../src/reactions.ts";

/**
 * **Answering a docket question is the chip clicks, from anywhere** (#206 D7).
 *
 * A finding on the board is answered by a mark. The web answers by clicking a
 * chip; `isocan docket answer` answers by sending the clicks a person would
 * make — so the ops below are always `reactOp`s, never a new shape.
 *
 * Synthetic: an Acme question and made-up actors.
 */
const item = (reactions: Record<string, string[]> = {}, props: Record<string, string> = { docket: "q-acme-chunk" }): Item =>
  ({ id: "itm_q", title: "Acme chunk", properties: props, reactions, versions: [], currentVersionId: "" }) as unknown as Item;

describe("what the marks say", () => {
  it("reads one verdict, both as contested, and none as open", () => {
    expect(docketVerdict(item({ "✅": ["usr_a"] }))).toBe("accepted");
    expect(docketVerdict(item({ "❌": ["usr_a"] }))).toBe("rejected");
    // Two people disagreeing is not a tie for a tool to break.
    expect(docketVerdict(item({ "✅": ["usr_a"], "❌": ["usr_b"] }))).toBe("contested");
    expect(docketVerdict(item({ [DOCKET_CLAIM]: ["usr_a"] })), "a claim is not a verdict").toBeNull();
    expect(docketVerdict(item({ "✅": [] })), "an emptied mark is no mark").toBeNull();
  });

  it("knows a docket item by its slug, and nothing else as one", () => {
    expect(docketSlug(item())).toBe("q-acme-chunk");
    expect(docketSlug(item({}, { board: "build" }))).toBeNull();
    expect(docketSlug({ reactions: {} })).toBeNull();
  });
});

describe("answering", () => {
  it("is one chip click when you have said nothing yet", () => {
    const q = item();
    expect(docketAnswer(q, "accepted", "usr_a")).toEqual([reactOp(q, DOCKET_MARKS.accepted, "usr_a")]);
    expect(docketAnswer(q, "accepted", "usr_a")).toEqual([
      { type: "item.react", itemId: "itm_q", emoji: "✅", on: true },
    ]);
  });

  it("takes your other verdict off first, so the item never reads contested between the two", () => {
    const q = item({ "✅": ["usr_a"] });
    expect(docketAnswer(q, "rejected", "usr_a")).toEqual([
      { type: "item.react", itemId: "itm_q", emoji: "✅", on: false },
      { type: "item.react", itemId: "itm_q", emoji: "❌", on: true },
    ]);
  });

  it("sends nothing when you already say it, and leaves other people's marks alone", () => {
    expect(docketAnswer(item({ "✅": ["usr_a"] }), "accepted", "usr_a")).toEqual([]);
    // Somebody else's ❌ is theirs: answering yours does not touch it.
    expect(docketAnswer(item({ "❌": ["usr_b"] }), "accepted", "usr_a")).toEqual([
      { type: "item.react", itemId: "itm_q", emoji: "✅", on: true },
    ]);
  });
});
