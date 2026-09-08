import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rules, selectorsOf } from "./cssrules.ts";

/**
 * **A ground covers the dot grid, and this is the only thing that says so.**
 *
 * `THEME_ANCHOR_PROP`'s comment in `core/theme.ts` claimed the opposite for a
 * day: that a `window`-anchored ground let the grid come back, and that the
 * grid was therefore "the last spatial reference" under a pinned backdrop.
 * It was never true. `.canvas-viewport.themed { background-image: none }` is
 * correctly skipped for a pinned ground — and skips nothing you can see,
 * because `.canvas-theme` is an opaque `inset: 0` CHILD of the viewport and a
 * child paints over its parent's background. Measured 7 Sep 2026 on a pinned
 * galaxy: the dots are drawn and then hidden, for every ground.
 *
 * That is the behaviour we want — the grid over a starfield reads as more
 * stars, and over a photograph as a screen of noise; both were rendered
 * before the comment was rewritten. But it is behaviour that emerges from
 * *stacking* rather than from any line declaring it, and nothing in the suite
 * touched it. That is exactly how a comment gets to assert a rendered
 * behaviour the app does not have, for a day, with the whole suite green.
 *
 * So this file holds the accident still. Break any part of it — a ground that
 * stops filling the viewport, a ground that goes translucent, a second layer
 * that paints the grid above the ground — and the ground stops covering the
 * grid, which is a design change, and the comment in `core/theme.ts` has to
 * be rewritten with it. Failing here is the reminder.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const viewportSrc = readFileSync(
  path.join(here, "..", "src", "components", "CanvasViewport.tsx"),
  "utf8",
);

/** The concrete grounds — every `.canvas-theme-*` the layer can render. */
const GROUNDS = ["galaxy", "ocean", "mountains", "custom"] as const;

/** `--theme-space` and friends, as written in the first `:root` block. */
function tokens(): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of rules()) {
    if (!rule.selector.startsWith(":root")) continue;
    for (const decl of rule.body.split(";")) {
      const m = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/.exec(decl);
      // `m[1]`/`m[2]` are the groups of a regex that matched, so they exist —
      // `noUncheckedIndexedAccess` cannot see that and `npm test` cannot see
      // `noUncheckedIndexedAccess`, which is how this file landed on main
      // green and red at the same time.
      if (m && !out.has(m[1]!)) out.set(m[1]!, m[2]!);
    }
  }
  return out;
}

/** The declaration a rule ends up with, last-wins within its own body. */
function decl(selector: string, prop: string): string | null {
  let found: string | null = null;
  for (const rule of rules()) {
    if (rule.at.length > 0) continue;
    if (!selectorsOf(rule).includes(selector)) continue;
    for (const one of rule.body.split(";")) {
      const m = new RegExp(`^\\s*${prop}\\s*:\\s*(.+?)\\s*$`).exec(one);
      if (m) found = m[1]!;
    }
  }
  return found;
}

describe("the ground covers the dot grid", () => {
  it("draws the grid on the viewport itself", () => {
    // The premise. If the dots ever move off `.canvas-viewport`'s own
    // `background-image`, every claim below is about a different picture.
    expect(decl(".canvas-viewport", "background-image")).toMatch(
      /radial-gradient\(circle,\s*var\(--dot\)/,
    );
  });

  it("hangs every ground inside the viewport, after nothing that could cover it", () => {
    // The stacking fact in one sentence: `CanvasThemeLayer` renders inside the
    // `.canvas-viewport` element, so its `inset: 0` box is the viewport's box.
    const open = viewportSrc.indexOf("className={`canvas-viewport");
    const layer = viewportSrc.indexOf("<CanvasThemeLayer");
    expect(open, "the viewport element").toBeGreaterThan(-1);
    expect(layer, "the ground layer").toBeGreaterThan(open);
  });

  it("fills the viewport with the ground", () => {
    // Full-bleed and absolute: anything less and the grid shows in a band,
    // which is the half-true version of the claim this file replaced.
    expect(decl(".canvas-theme", "position")).toBe("absolute");
    expect(decl(".canvas-theme", "inset")).toBe("0");
  });

  it("gives every ground an opaque fill", () => {
    // A translucent ground would let the grid through as a ghost — the dots
    // over a starfield, at low contrast, which is the worst of both.
    const t = tokens();
    for (const ground of GROUNDS) {
      const value = decl(`.canvas-theme-${ground}`, "background-color");
      expect(value, `.canvas-theme-${ground} has no background-color`).toBeTruthy();
      const name = /^var\((--[\w-]+)\)$/.exec(value!)?.[1];
      expect(name, `.canvas-theme-${ground} paints ${value} rather than a token`).toBeTruthy();
      const colour = t.get(name!);
      expect(colour, `${name} has no value in :root`).toBeTruthy();
      // Six hex digits, or eight ending in `ff`. Anything else is see-through.
      expect(colour, `${name} is ${colour}, which the grid would show through`).toMatch(
        /^#[0-9a-f]{6}$|^#[0-9a-f]{6}ff$/i,
      );
    }
  });

  it("paints the grid nowhere above the ground", () => {
    // `.cursor-glow` is the one other element carrying the dot gradient, and
    // it IS above the ground — a decorative spotlight at opacity 0 until the
    // pointer moves, not a reference. A third would be a grid layer somebody
    // added to make the old comment true; it should fail here first.
    const carriers = rules()
      .filter((r) => /radial-gradient\(\s*circle,\s*var\(--dot/.test(r.body))
      .flatMap(selectorsOf);
    expect(new Set(carriers)).toEqual(new Set([".canvas-viewport", ".cursor-glow"]));
  });

  it("keeps `.themed` turning the grid off for a ground that travels", () => {
    // Still right for `world`, and still load-bearing there: this is the
    // declaration that hides the grid under a ground which pans with it. It
    // reads as dead code — pinned grounds do not need it and world grounds
    // would cover the dots anyway — and deleting it would take the ONE place
    // the intent is written down along with it.
    expect(
      decl(".canvas-viewport.themed", "background-image"),
      "the grid is no longer turned off for a world-anchored ground; " +
        "THEME_ANCHOR_PROP in core/theme.ts explains this rule and has to change with it",
    ).toBe("none");
  });
});
