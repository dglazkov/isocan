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

/** Every rule whose selector list mentions the title row, comments stripped. */
function titlebarRules(): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const selector of (rule[1] ?? "").split(",").map((s) => s.trim())) {
      if (selector.includes(".item-titlebar")) out.push({ selector, body: rule[2] ?? "" });
    }
  }
  return out;
}

/** What would move the row or change the room it gives the name. */
const PLACEMENT = /(?:^|[;{\s])(top|right|bottom|left|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:\s*([^;]+)/g;

describe("the item title row", () => {
  it("has rules to check", () => {
    // Without this the file passes vacuously the day the class is renamed.
    expect(titlebarRules().length).toBeGreaterThan(0);
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
