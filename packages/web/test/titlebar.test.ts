import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The title row does not move when you select an item.
 *
 * It used to. The row's SIZE is screen-measured — ItemView counter-scales both
 * ends with `transform: scale(1 / scale)` — but its OFFSET was world-measured
 * (`top: -20px`, `padding: 0 3px`). Measured: the gap above the card was 3.6
 * screen px at 100% zoom and half a pixel at 13%. Selecting then added a flat,
 * screen-measured nudge to clear the corner handles, so the title and the star
 * hopped 7px up and 7px in the instant you clicked — a jump that got starker
 * the further out you were zoomed, because the position it jumped FROM kept
 * collapsing while the one it jumped TO did not.
 *
 * Two measuring systems meeting at the selection boundary is the whole of that
 * bug, and the fix is one position measured the way the row itself is. The
 * handles are 12 screen px centred on each corner, so they reach 6px above the
 * item's top edge: a row whose bottom sits 7px above it clears them always,
 * and a row that clears them vertically needs no horizontal step-in at all.
 *
 * So this file asserts the two halves of "one position": the base rule is
 * screen-measured, and no selected-state rule moves the row.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** Every rule whose selector list mentions the title row, comments stripped.
 *  `\b`-anchored rather than `includes`, so `.item-titlebar-row` is a
 *  different class and not this one wearing a suffix. */
function titlebarRules(): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const selector of (rule[1] ?? "").split(",").map((s) => s.trim())) {
      if (/\.item-titlebar(?![-\w])/.test(selector)) out.push({ selector, body: rule[2] ?? "" });
    }
  }
  return out;
}

/** The rule for exactly `.item-titlebar` — the one that PLACES the row, as
 *  opposed to the six that colour it, reveal it or reach through it. */
function ownRule(): string | null {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((one) => one.trim());
    if (selectors.includes(".item-titlebar")) return rule[2] ?? "";
  }
  return null;
}

/** What would move the row or change the room it gives the name. */
const PLACEMENT = /(?:^|[;{\s])(top|right|bottom|left|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:\s*([^;]+)/g;

describe("the item title row", () => {
  /**
   * The vacuity check, and it took two goes.
   *
   * `titlebarRules().length > 0` was the first version and it could not say
   * no. Six other rules mention this class — `.item.peeked .item-titlebar`,
   * `.item.selected .item-titlebar`, `.canvas-viewport.pen .item-titlebar`
   * and so on — so DELETING the rule that actually places the row left the
   * list non-empty, gave the two checks below nothing to look at, and this
   * file passed 3/3 with the title row unpositioned. Renaming it to
   * `.item-titlebar-row` passed too, because a class name is a substring of
   * its own superstring.
   *
   * So: the row's OWN rule has to exist, and it has to place the row. That is
   * the thing the rest of this file is about, and a check that any relative
   * can satisfy answers a different question (lessons.md #16).
   */
  it("has the rule that places the row, under that exact name", () => {
    const own = ownRule();
    expect(own, "no `.item-titlebar` rule of its own — renamed, or deleted").not.toBeNull();
    expect(
      own,
      "`.item-titlebar` does not place the row in screen pixels, so there is nothing here to guard",
    ).toMatch(/(top|bottom):\s*calc\([^;]*var\(--scale/);
  });

  it("has every rule that mentions the row", () => {
    // The six that colour it, reveal it and reach through it are what the
    // selection check below sweeps; if the parser stops finding them it stops
    // being able to fail.
    expect(titlebarRules().length, "the parser found no rules — it is wrong").toBeGreaterThan(3);
  });

  it("is placed in screen pixels, like the label it holds", () => {
    for (const { selector, body } of titlebarRules()) {
      for (const declaration of body.matchAll(PLACEMENT)) {
        const [, property, raw] = declaration;
        const value = (raw ?? "").trim();
        if (!/\dpx/.test(value)) continue; // `auto`, `0`, a bare percentage
        expect(
          value,
          `${selector} { ${property}: ${value} } is in WORLD pixels — divide by var(--scale), ` +
            `or the row drifts away from the screen-sized label sitting in it`,
        ).toMatch(/var\(--scale/);
      }
    }
  });

  it("is not moved by selection", () => {
    // A selected item wears corner handles; the row clears them by sitting
    // above them, not by stepping around them when they appear. Anything here
    // that sets a placement property is the jump coming back.
    const moved = titlebarRules().filter(
      ({ selector, body }) =>
        /\.item[^ ]*\.selected/.test(selector) && [...body.matchAll(PLACEMENT)].length > 0,
    );
    expect(
      moved.map((r) => `${r.selector} {${r.body.trim()}}`),
      "selection must not move the title row — it is the same place either way",
    ).toEqual([]);
  });
});
