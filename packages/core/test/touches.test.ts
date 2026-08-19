import { describe, expect, it } from "vitest";
import { itemsTouchedBy, opMatchesFilters, opTypeMatches } from "../src/index.ts";
import { nv, seedState } from "./helpers.ts";

const canvas = seedState().canvas;

describe("itemsTouchedBy", () => {
  it("reads the item off the ops that name one", () => {
    expect(itemsTouchedBy({ type: "item.move", itemId: "itm_1", x: 0, y: 0 })).toEqual(["itm_1"]);
    expect(itemsTouchedBy({ type: "item.addVersion", itemId: "itm_1", version: nv("v") })).toEqual([
      "itm_1",
    ]);
  });

  it("unpacks the batch ops, which are one gesture over many items", () => {
    expect(
      itemsTouchedBy({
        type: "items.move",
        moves: [
          { itemId: "itm_1", x: 0, y: 0 },
          { itemId: "itm_2", x: 0, y: 0 },
        ],
      }),
    ).toEqual(["itm_1", "itm_2"]);
    expect(itemsTouchedBy({ type: "items.delete", itemIds: ["itm_1", "itm_2"] })).toEqual([
      "itm_1",
      "itm_2",
    ]);
  });

  it("counts a comment ON an item as touching it", () => {
    expect(
      itemsTouchedBy({
        type: "thread.create",
        threadId: "thr_x",
        x: 1,
        y: 1,
        anchorItemId: "itm_2",
        comment: { id: "cmt_x", body: "here" },
      }),
    ).toEqual(["itm_2"]);
  });

  it("follows a reply back to the item its thread is pinned to", () => {
    const reply = {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_x", body: "more" },
    } as const;
    // thr_1 is anchored to itm_1 in the seed.
    expect(itemsTouchedBy(reply, canvas)).toEqual(["itm_1"]);
    // Without the canvas there is nothing to follow, and it says so rather
    // than guessing.
    expect(itemsTouchedBy(reply)).toEqual([]);
  });

  it("says nothing for a freestanding thread or a canvas-wide op", () => {
    expect(
      itemsTouchedBy({
        type: "thread.create",
        threadId: "thr_y",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_y", body: "anywhere" },
      }),
    ).toEqual([]);
    expect(itemsTouchedBy({ type: "trash.empty" })).toEqual([]);
    expect(itemsTouchedBy({ type: "project.update", patch: { title: "x" } })).toEqual([]);
  });
});

describe("opTypeMatches", () => {
  it("matches nothing in particular when nothing was asked for", () => {
    expect(opTypeMatches("item.move", [])).toBe(true);
  });

  it("matches an exact type", () => {
    expect(opTypeMatches("item.addVersion", ["item.addVersion"])).toBe(true);
    expect(opTypeMatches("item.move", ["item.addVersion"])).toBe(false);
  });

  it("matches a family, which is how people think about it", () => {
    expect(opTypeMatches("item.addVersion", ["item.*"])).toBe(true);
    expect(opTypeMatches("thread.reply", ["item.*"])).toBe(false);
    expect(opTypeMatches("thread.reply", ["thread.*", "item.addVersion"])).toBe(true);
  });
});

describe("opMatchesFilters", () => {
  const bump = { type: "item.addVersion", itemId: "itm_1", version: nv("v2") } as const;

  it("narrows on both axes at once", () => {
    expect(opMatchesFilters(bump, { items: ["itm_1"], types: ["item.addVersion"] })).toBe(true);
    expect(opMatchesFilters(bump, { items: ["itm_2"], types: ["item.addVersion"] })).toBe(false);
    expect(opMatchesFilters(bump, { items: ["itm_1"], types: ["item.move"] })).toBe(false);
  });

  it("passes everything when no filter is given", () => {
    expect(opMatchesFilters(bump, {})).toBe(true);
  });

  it("uses the canvas to judge a reply against an item filter", () => {
    const reply = {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_z", body: "look" },
    } as const;
    expect(opMatchesFilters(reply, { items: ["itm_1"] }, canvas)).toBe(true);
    expect(opMatchesFilters(reply, { items: ["itm_2"] }, canvas)).toBe(false);
  });
});
