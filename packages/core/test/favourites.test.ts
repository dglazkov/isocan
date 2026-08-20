import { describe, expect, it } from "vitest";
import { isStarred, starPatch, starredItems } from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";

describe("stars", () => {
  const star = (itemId: string, on: boolean) =>
    ({ type: "item.update", itemId, patch: starPatch(on) }) as const;

  it("turns on and off through an ordinary item.update", () => {
    let state = seedState();
    expect(isStarred(state.canvas.items.itm_1!)).toBe(false);
    state = apply(state, star("itm_1", true))!;
    expect(isStarred(state.canvas.items.itm_1!)).toBe(true);
    state = apply(state, star("itm_1", false))!;
    expect(isStarred(state.canvas.items.itm_1!)).toBe(false);
  });

  it("leaves the item's other properties alone", () => {
    const before = seedState();
    const after = apply(before, star("itm_1", true))!;
    // itm_1 carries kind=note in the seed; starring is not a replacement.
    expect(after.canvas.items.itm_1!.properties.kind).toBe("note");
    const unstarred = apply(after, star("itm_1", false))!;
    expect(unstarred.canvas.items.itm_1!.properties.kind).toBe("note");
  });

  it("undoes cleanly, because it is just a patch", () => {
    const before = seedState();
    const after = apply(before, star("itm_1", true))!;
    const back = apply(after, star("itm_1", false))!;
    expect(back.canvas.items.itm_1!.properties).toEqual(before.canvas.items.itm_1!.properties);
  });

  it("lists the shortlist, most recently touched first", () => {
    let state = seedState();
    state = apply(state, star("itm_2", true))!;
    state = apply(state, star("itm_1", true))!;
    expect(starredItems(state.canvas).map((i) => i.id)).toEqual(["itm_1", "itm_2"]);
  });

  it("is empty when nothing is starred", () => {
    expect(starredItems(seedState().canvas)).toEqual([]);
  });
});
