import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A hovered name reaches into the empty space beside it.**
 *
 * The label is clipped to the card, so anything longer reads as "White Lot…"
 * and a canvas of screens becomes a canvas of things whose names you have to
 * click to learn. The room to the right is usually empty; this uses it, and
 * stops where something is actually in the way.
 */
const src = readFileSync(
  fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
  "utf8",
);
const bare = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("a hovered name reaches", () => {
  it("measures the room with core, not with a rule of thumb here", () => {
    /* Geometry that is wrong in one direction at one zoom level is exactly
       what a browser is a poor place to discover. */
    expect(bare).toContain("titleRoom(");
  });

  it("reaches on hover or ONE selection, and never on many", () => {
    /**
     * The reason to exclude selection was never selection, it was MANY: a
     * marquee over nine items would have nine names reaching over each other,
     * unreadable exactly when you asked to see them. One selected item has
     * the same one-name-at-a-time property that makes hover safe — and
     * hover-only made clicking a hovered item snap its name back to the card,
     * the reach appearing and vanishing on one gesture.
     */
    expect(bare).toMatch(/!renaming && !manySelected && \(hovered \|\| selected\)/);
    expect(bare).toMatch(/selectedItemIds\.length > 1/);
  });

  it("treats a selected neighbour as occupying its own name's row", () => {
    /* Cards that do not overlap, names that would — the collision a person is
       most likely to be looking at. */
    expect(bare).toMatch(/titled: chosen\.includes\(other\.id\)/);
  });

  it("says 'no limit' as none, rather than as a very large number", () => {
    /* The first version returned MAX_SAFE_INTEGER from core to spare callers
       a branch, and the branch turned up here anyway: multiplied by the zoom
       scale it wrote `max-width: 3.35544e+07px` into the DOM. */
    expect(bare).toContain('Number.isFinite(reach)');
    expect(bare).not.toMatch(/MAX_SAFE_INTEGER/);
  });

  it("keeps one hovered id in the store rather than a flag per item", () => {
    /* Moving a pointer across a canvas must re-render the two items whose
       state changed, not every item on screen. */
    expect(bare).toContain("setHoveredItem(item.id)");
  });
});

describe("the stylesheet lets the row outgrow its card", () => {
  const sheet = rules(withoutComments());

  it("frees the row's right edge from a class, not from :hover or .selected", () => {
    /**
     * `.item-titlebar` is `left: 0; right: 0`, which pins the row to the
     * card's width — widening the name alone does nothing until the row may
     * be wider than the thing it names.
     *
     * The state that permits it is decided in the component, because it is a
     * judgement (hover, or exactly one selected) with an argument behind it.
     * And `titlebar.test.ts` forbids this row's placement varying with
     * `.selected` — a rule that remembers it jumping when corner handles
     * appeared. Spelling `:not(.selected)` here would have been arguing with
     * that guard rather than obeying the invariant it protects.
     */
    const freed = sheet.filter((r) => /right:\s*auto/.test(r.body) && /item-titlebar/.test(r.selector));
    expect(freed.length, "no rule frees the row's right edge").toBeGreaterThan(0);
    for (const r of freed) {
      expect(r.selector, "the state belongs in the component").toContain(".reaching");
      expect(r.selector, "must not key off selection").not.toMatch(/\.selected/);
    }
  });
});
