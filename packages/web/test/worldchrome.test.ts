import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Chrome drawn inside the zoomed world is measured in WORLD pixels.
 *
 * `.world` carries `scale(viewport.scale)`, so everything inside it is in
 * world units: a literal `2px` outline is two world pixels, which is two
 * screen pixels at 100% and — measured — **0.11** at 5%. The selection ring
 * vanished and the resize handles went from 12px to 3px, which is smaller than
 * the pointer that has to hit them.
 *
 * The titlebar never had this problem because ItemView counter-scales it with
 * `transform: scale(1 / scale)`. An outline cannot be counter-scaled that way
 * — the box has to stay in world coordinates — so the length divides by
 * `--scale` instead, which is the same idea arriving through CSS.
 *
 * This test names the selectors that live in world space and sit under the
 * pointer. A hardcoded pixel on any of them is the bug coming back.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** Declarations for a selector, comments stripped. */
function rulesFor(selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((s) => s.trim());
    if (selectors.some((s) => s.includes(selector))) out.push(rule[2] ?? "");
  }
  return out;
}

/** Lengths that decide how big a thing LOOKS or where it sits. Colour, radius
 *  and z-index are not sizes somebody has to see or hit. */
const SIZING =
  /(?:^|[;{\s])(width|height|top|right|bottom|left|outline|outline-width|outline-offset|border|border-width)\s*:\s*([^;]+)/g;

describe("chrome inside the zoomed world", () => {
  const WORLD_CHROME = [".resize-handle", ".item.selected", ".item.peeked"];

  it("has rules for every selector it claims to check", () => {
    // Without this the whole file passes vacuously the day a class is renamed.
    for (const selector of WORLD_CHROME) {
      expect(rulesFor(selector).length, `no rule found for ${selector}`).toBeGreaterThan(0);
    }
  });

  it("sizes itself in screen pixels, not world pixels", () => {
    for (const selector of WORLD_CHROME) {
      for (const body of rulesFor(selector)) {
        for (const declaration of body.matchAll(SIZING)) {
          const [, property, value] = declaration;
          if (!/\dpx/.test(value ?? "")) continue; // `auto`, `0`, a percentage
          expect(
            value,
            `${selector} { ${property}: ${value?.trim()} } is in WORLD pixels — divide by var(--scale)`,
          ).toMatch(/var\(--scale/);
        }
      }
    }
  });

  it("gives the outline a visible width at every zoom", () => {
    // 2 world px at 5% is 0.11 on screen; 2px / --scale is 2 at any zoom.
    const rules = rulesFor(".item.selected");
    expect(rules.length).toBeGreaterThan(0);
    for (const body of rules) {
      if (!/outline\s*:/.test(body)) continue;
      expect(body, "an outline in world pixels").toMatch(
        /outline:\s*calc\(\s*[\d.]+px\s*\/\s*var\(--scale/,
      );
    }
  });

  it("publishes the scale for CSS to divide by", () => {
    const viewport = readFileSync(
      fileURLToPath(new URL("../src/components/CanvasViewport.tsx", import.meta.url)),
      "utf8",
    );
    expect(viewport, "--scale must be set where the world transform is").toMatch(
      /"--scale":\s*viewport\.scale/,
    );
  });

  /**
   * The star is always on the right, whatever else is in the row.
   *
   * Hiding the name at small sizes sent it to the LEFT edge, because
   * `space-between` puts a lone child at the start — the exact swap ItemView's
   * own comment says must never happen ("a name that grows rightward from
   * there runs off the item entirely"). `margin-left: auto` pins it regardless
   * of siblings, so the rule does not depend on what else happens to render.
   */
  it("keeps the star on the right when it is the only thing in the row", () => {
    const right = rulesFor(".chrome-right").join(" ");
    expect(right, ".chrome-right must not rely on a sibling to sit right").toMatch(
      /margin-left:\s*auto/,
    );
  });
});
