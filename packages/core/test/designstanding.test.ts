import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  DESIGN_SYSTEM_AFTER,
  DESIGN_SYSTEM_LIMIT,
  designSkipPatch,
  designSkipped,
  designStanding,
  designSystemProperties,
  designUnskipPatch,
  needsDesignSystem,
} from "../src/designsystem.ts";

/**
 * **A note that has been ignored twenty-four times is not a note.**
 *
 * `DESIGN_SYSTEM_AFTER` printed a courtesy line on both surfaces from the day
 * the feature landed. Measured on 8 Sep 2026 across six live canvases: **37 of
 * 61 screens sit on a canvas with no design system**, one canvas at 24 screens
 * and another at 7. The rule was right and nothing enforced it, which is this
 * repo's oldest recurring shape — a bound nothing enforces is a comment.
 *
 * So there are three states now rather than two, in the size gate's own shape:
 * a creep asks, a jump blocks. What this file holds is the BOUNDARIES, because
 * an off-by-one here is either a gate that never fires or a gate that fires on
 * a canvas with one screen — and neither announces itself.
 */

function item(properties: Record<string, string>): Item {
  return {
    id: `itm_${Math.random().toString(36).slice(2, 10)}`,
    title: "x",
    properties,
    versions: [],
    currentVersionId: "",
    updatedAt: "2026-09-08T00:00:00.000Z",
  } as unknown as Item;
}

function canvas(items: Item[]): CanvasContents {
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: {},
    trash: [],
  } as unknown as CanvasContents;
}

const SKIPPED = { properties: { design: "none" } };

describe("where a canvas stands on having written its style down", () => {
  it("asks for nothing until a choice has become a convention", () => {
    /* One screen has nothing to be consistent WITH. The second is where a
       choice becomes a convention, which is the argument DESIGN_SYSTEM_AFTER
       already carries — this only checks the boundary is where it says. */
    expect(designStanding(canvas([]), 0)).toBe("fine");
    expect(designStanding(canvas([]), DESIGN_SYSTEM_AFTER - 1)).toBe("fine");
    expect(designStanding(canvas([]), DESIGN_SYSTEM_AFTER)).toBe("owed");
  });

  it("stops asking and starts refusing at three times that", () => {
    expect(designStanding(canvas([]), DESIGN_SYSTEM_LIMIT - 1)).toBe("owed");
    expect(designStanding(canvas([]), DESIGN_SYSTEM_LIMIT)).toBe("overdue");
    expect(designStanding(canvas([]), 24)).toBe("overdue");
  });

  it("keeps the ratio it borrowed", () => {
    /* Three, from `review-queue`'s rule that a question asked a third time
       needs a guard rather than a fourth mention. Written as the arithmetic
       rather than as 6, so moving one moves the other and the borrowed
       argument stays true. */
    expect(DESIGN_SYSTEM_LIMIT).toBe(DESIGN_SYSTEM_AFTER * 3);
  });

  it("asks nothing of a canvas that has one, however many screens", () => {
    const withSystem = canvas([item(designSystemProperties())]);
    expect(designStanding(withSystem, 2)).toBe("fine");
    expect(designStanding(withSystem, 200)).toBe("fine");
  });

  it("asks nothing of a canvas that said no, and asks again when it takes that back", () => {
    /**
     * The escape hatch has to actually work, or the gate is a wall. And it has
     * to be reversible, or "no" is a decision nobody can revisit — which is
     * the thing that makes people avoid making it.
     */
    expect(designStanding(canvas([]), 24, SKIPPED)).toBe("fine");
    expect(designStanding(canvas([]), 24, { properties: {} })).toBe("overdue");
    expect(designSkipped({ properties: designSkipPatch().properties ?? {} })).toBe(true);
    expect(designUnskipPatch().removeProperties).toContain("design");
    expect(designSkipped({ properties: {} })).toBe(false);
  });

  it("reports the safe answer when the caller cannot see the properties", () => {
    /**
     * The two halves live on two objects — the system is an item, the opt-out
     * is a canvas property — so a caller can hold one and not the other. The
     * default has to be the side that over-asks: asking a canvas that opted
     * out is a wasted line, silently skipping one that did not is the bug this
     * whole file exists to prevent.
     */
    expect(designStanding(canvas([]), 24)).toBe("overdue");
    expect(designStanding(canvas([]), 24, undefined)).toBe("overdue");
  });

  it("keeps the old question answerable, and agreeing with the new one", () => {
    /* `needsDesignSystem` is what both surfaces' nudges call. It is now one
       reading of `designStanding`, so the note and the gate cannot come to
       different conclusions about the same canvas. */
    for (const screens of [0, 1, 2, 5, 6, 24]) {
      expect(needsDesignSystem(canvas([]), screens)).toBe(
        designStanding(canvas([]), screens) !== "fine",
      );
    }
    expect(needsDesignSystem(canvas([]), 24, SKIPPED)).toBe(false);
  });
});
