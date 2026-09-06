import { describe, expect, it } from "vitest";
import { ITEM_KINDS, kindFamily } from "../src/index.ts";
import type { ItemKind } from "../src/index.ts";

/**
 * **The coarse split, read out of the order rather than written down again.**
 *
 * The minimap colours its rects by family when a pointer is on it: at two
 * pixels a rect can carry "made or brought" and cannot carry nine hues. The
 * temptation was to list the made kinds in the stylesheet, which would have
 * been a second copy of `ITEM_KINDS` — the exact failure `kinds.ts` opens by
 * warning about, one level up. So the split is derived, and these are the
 * tests that keep the derivation honest when somebody reorders the list.
 */
describe("which side of the line a kind falls on", () => {
  it("splits the list where its own comment says — what you made, then what you brought", () => {
    expect(kindFamily("drawing")).toBe("made");
    expect(kindFamily("text")).toBe("made");
    expect(kindFamily("screen")).toBe("made");
    expect(kindFamily("image")).toBe("brought");
    expect(kindFamily("video")).toBe("brought");
    expect(kindFamily("document")).toBe("brought");
    expect(kindFamily("site")).toBe("brought");
    expect(kindFamily("canvas")).toBe("brought");
  });

  it("keeps `other` its own answer rather than folding it into either side", () => {
    // A rect whose kind we do not know should not claim to be a drawing, and
    // should not claim to be an upload. The neutral IS the honest answer.
    expect(kindFamily("other")).toBe("other");
  });

  it("places every kind in the shipped list, so no rect goes uncoloured", () => {
    for (const kind of ITEM_KINDS) {
      expect(["made", "brought", "other"], `${kind} has no family`).toContain(kindFamily(kind));
    }
  });

  it("follows the list rather than a copy of it", () => {
    // The one assertion that fails if somebody moves a kind across the divide
    // and forgets this fold: made and brought are contiguous runs, and the
    // boundary is `image`. If that stops being true, the derivation is wrong
    // and the answer is to fix `kindFamily`, not to loosen this.
    const families = ITEM_KINDS.filter((k) => k !== "other").map((k) => kindFamily(k));
    const firstBrought = families.indexOf("brought");
    expect(firstBrought, "something is brought").toBeGreaterThan(0);
    expect(families.slice(0, firstBrought).every((f) => f === "made")).toBe(true);
    expect(families.slice(firstBrought).every((f) => f === "brought")).toBe(true);
    expect(ITEM_KINDS[firstBrought]).toBe("image");
  });

  it("calls a kind it has never met `other`, not a guess", () => {
    // A module's kind resolves to `made` through `moduleKinds()` — with no
    // module loaded there is nothing to resolve, and inventing a family for a
    // string is worse than the neutral.
    expect(kindFamily("diagram" as ItemKind)).toBe("other");
  });
});
