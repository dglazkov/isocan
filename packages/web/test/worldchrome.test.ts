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

/** Every rule in the file, as (selector list, body), comments stripped. */
function allRules(): Array<{ selectors: string[]; body: string }> {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selectors: string[]; body: string }> = [];
  for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    out.push({
      selectors: (rule[1] ?? "").split(",").map((one) => one.trim()),
      body: rule[2] ?? "",
    });
  }
  return out;
}

/**
 * Does this selector text MENTION that class, as that class?
 *
 * `includes` was the first version and it could not say no. `.item.peeked`
 * is a substring of `.item.peeked-x`, and `.resize-handle` of
 * `.resize-handle-nw` — so renaming a rule to a superstring of its own name
 * left every check here satisfied by rules that are not the rule. A class name
 * ends where an identifier character stops.
 */
function mentions(selector: string, text: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(selector, from);
    if (at < 0) return false;
    const after = text[at + selector.length] ?? " ";
    if (!/[-\w]/.test(after)) return true;
    from = at + 1;
  }
}

/** Declarations for every rule that mentions this class, variants included —
 *  `.item.selected` picks up `.item.selected:hover`, which draws the same
 *  ring and can regress on its own. */
function rulesFor(selector: string): string[] {
  return allRules()
    .filter((rule) => rule.selectors.some((one) => mentions(selector, one)))
    .map((rule) => rule.body);
}

/**
 * The rule for exactly this class and nothing else — the one that gives it its
 * size.
 *
 * `rulesFor` cannot tell "the ring is drawn in world pixels" from "there is no
 * ring any more", because a DESCENDANT rule keeps the list non-empty:
 * deleting `.item.peeked { outline: … }` outright left
 * `.item.peeked .item-titlebar { opacity: 1 }` behind, the existence check
 * passed, the sizing sweep then had no lengths to look at, and the whole web
 * suite stayed green with the peek ring gone.
 */
function ownRule(selector: string): string | null {
  const found = allRules().filter((rule) => rule.selectors.includes(selector));
  return found.length === 0 ? null : found.map((rule) => rule.body).join(";");
}

/**
 * Lengths that decide how big a thing LOOKS or where it sits. Colour, radius
 * and z-index are not sizes somebody has to see or hit.
 *
 * `padding` is here because the title row's inset is one: ItemView subtracts
 * `CHROME_INSET` screen pixels from the name's width, so the padding that
 * produces that inset has to BE screen pixels. `font-size` is deliberately
 * NOT here — the row's two ends carry their own counter-scale, so their type
 * is already screen-sized and a literal `11px` is right.
 */
const SIZING =
  /(?:^|[;{\s])(width|height|top|right|bottom|left|outline|outline-width|outline-offset|border|border-width|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:\s*([^;]+)/g;

describe("chrome inside the zoomed world", () => {
  /**
   * Everything drawn inside `.world` that somebody has to see or hit.
   *
   * The four corner handles are named one by one rather than as
   * `.resize-handle`, because each carries its OWN offset: the shared rule
   * gives them their size and four separate rules give them their positions,
   * and a rule with four copies gets its regression in one of them
   * (lessons.md #10).
   *
   * `.item-titlebar` was NOT on this list, and the very next commit found the
   * bug it would have caught: the row's SIZE was screen-measured (ItemView
   * counter-scales both ends) while its OFFSET and INSET were world lengths,
   * so the gap above the card was 3.6 screen px at 100% and half a pixel at
   * 13%, and selecting an item made the row hop.
   */
  const WORLD_CHROME = [
    ".resize-handle",
    ".resize-handle-nw",
    ".resize-handle-ne",
    ".resize-handle-sw",
    ".resize-handle-se",
    ".item.selected",
    ".item.peeked",
    ".item-titlebar",
  ];

  it("has rules for every selector it claims to check", () => {
    // Without this the whole file passes vacuously the day a class is renamed.
    for (const selector of WORLD_CHROME) {
      expect(rulesFor(selector).length, `no rule found for ${selector}`).toBeGreaterThan(0);
    }
  });

  /**
   * The existence check above is not enough on its own and this is the half
   * that makes it mean something.
   *
   * Two mutations walked past it. Deleting `.item.peeked`'s ring entirely left
   * `.item.peeked .item-titlebar` to satisfy "a rule was found", and with no
   * lengths left there was nothing for the sizing sweep to reject — the web
   * suite stayed green, 226/226, with the peek ring gone. Renaming
   * `.resize-handle` to `.resize-handle-base` did the same through the four
   * corner rules, taking every handle's size and border with it.
   *
   * So each of these must have a rule of its OWN, and that rule must carry at
   * least one length that divides by `--scale`. That is what "this is world
   * chrome and it holds its screen size" MEANS; a rule with no such length is
   * either gone or was never world chrome.
   */
  it("gives each one a rule of its own that holds a screen-measured length", () => {
    for (const selector of WORLD_CHROME) {
      const own = ownRule(selector);
      expect(own, `${selector} has no rule of its own — renamed, or deleted`).not.toBeNull();
      expect(
        own,
        `${selector} carries no length divided by --scale, so it is not holding its screen size`,
      ).toMatch(/calc\([^)]*var\(--scale/);
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
