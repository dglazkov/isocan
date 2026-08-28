import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  DESIGN_SYSTEM_AFTER,
  designSystemProperties,
  needsDesignSystem,
} from "../src/designsystem.ts";

/**
 * **The canvas noticing that it has designs and no written style.**
 *
 * "Read the design system before you build a screen" has been in the agent
 * guide all along, and a norm in a document is a rule somebody has to
 * remember — nothing ever said it at the moment it mattered.
 *
 * What is guarded here is the THRESHOLD, because the number carries the
 * argument. Not one: a single screen has nothing to be consistent with, and
 * a system written before anything exists is made of adjectives. Two is
 * where a choice becomes a convention — screen two either copied screen one,
 * so the system exists unwritten, or it did not, and the drift has started.
 */

const item = (properties: Record<string, string> = {}): Item =>
  ({ id: "itm_x", properties, updatedAt: "2026-01-01T00:00:00.000Z" }) as unknown as Item;

const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i, n) => [`itm_${n}`, { ...i, id: `itm_${n}` }])) }) as
    unknown as CanvasContents;

describe("when a canvas should have written its style down", () => {
  it("says nothing about the first screen", () => {
    // One screen has nothing to be consistent WITH. Asking here would be
    // asking for adjectives.
    expect(needsDesignSystem(canvas([]), 1)).toBe(false);
    expect(needsDesignSystem(canvas([]), 0)).toBe(false);
  });

  it("notices from the second, where a choice becomes a convention", () => {
    expect(DESIGN_SYSTEM_AFTER).toBe(2);
    expect(needsDesignSystem(canvas([]), 2)).toBe(true);
    expect(needsDesignSystem(canvas([]), 7)).toBe(true);
  });

  it("goes quiet once the canvas has one", () => {
    // And it must go quiet on BOTH surfaces from the same answer, or one of
    // them nags after the work is done.
    const withSystem = canvas([item(designSystemProperties())]);
    expect(needsDesignSystem(withSystem, 7)).toBe(false);
  });

  it("counts the system by its role, not by looking like a document", () => {
    // An ordinary markdown item is not a design system, however many there
    // are — the role property is what makes one.
    expect(needsDesignSystem(canvas([item({}), item({})]), 3)).toBe(true);
  });
});
