import { describe, expect, it } from "vitest";
import { faceMark, isFaceMark } from "../src/identity.ts";

/**
 * A face is a coloured disc with a letter in it, which is fine until a canvas
 * has a Di, a Dion and a Dimitri on it. The mark is the thing people reach
 * for — presence labels have carried one by convention for a while — and this
 * makes it a fact rather than a habit inside a string.
 */
describe("what counts as a face mark", () => {
  it("takes one emoji", () => {
    for (const ok of ["🐢", "🎯", "🔥", "✅"]) expect(isFaceMark(ok), ok).toBe(true);
  });

  it("counts a joined emoji as the one thing a reader sees", () => {
    /* A family or a profession is several code points welded with zero-width
       joiners. `Intl.Segmenter` counts graphemes, which is the count that
       matches what fits in a 22px disc. */
    expect(isFaceMark("👩‍🚀")).toBe(true);
    expect(isFaceMark("👨‍👩‍👧")).toBe(true);
  });

  it("refuses letters, words and several marks", () => {
    /* The failure being prevented is a NAME where a single mark has to fit. */
    for (const no of ["D", "Di", "Dion", "🐢🐢", "🇬🇧🇺🇸", "", "  "]) {
      expect(isFaceMark(no), JSON.stringify(no)).toBe(false);
    }
  });

  it("is not a whitelist, so next year's emoji still works", () => {
    /* Shape rather than membership: one grapheme and pictographic. */
    expect(isFaceMark("🫩")).toBe(true);
  });
});

describe("what goes in the disc", () => {
  const di = { id: "usr_di", name: "Dion" };

  it("is the mark when there is one", () => {
    expect(faceMark({ usr_di: "🐢" }, di)).toBe("🐢");
  });

  it("falls back to the initial, which is what it always was", () => {
    expect(faceMark({}, di)).toBe("D");
    expect(faceMark(undefined, di)).toBe("D");
  });

  it("takes the name it is SHOWN under, not the one stamped on the op", () => {
    /* Every surface here reads through `actorNameIn` first — an actor
       renamed to Di must not keep drawing a D from a stale "Dion". */
    expect(faceMark({}, { id: "usr_x", name: "Dion" }, "Ada")).toBe("A");
  });

  it("does not break on a name that is only spaces", () => {
    expect(faceMark({}, { id: "usr_x", name: "   " })).toBe("");
  });
});
