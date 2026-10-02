import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lengthPx, readableInk } from "../src/lib/designview.ts";
import { sheets } from "./cssrules.ts";

/**
 * Colours come from tokens, so both themes work by construction.
 *
 * The bug this exists to prevent is quiet: a literal that happens to read on
 * one ground and vanishes on the other. It shipped as black-on-graphite text
 * in a card, and it was not even a colour declaration — it was a <button> with
 * no `color`, taking the UA's black.
 *
 * Two literals are allowed and both are argued for in the file: an alpha mask
 * (where #000 means "keep this pixel"), and the white behind an iframe showing
 * somebody else's page.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** The :root blocks are where literal colour belongs, and comments discuss
 * colours by name without setting them. */
const declarationsOf = (text: string) =>
  text.replace(/:root[^{]*\{[^}]*\}/gs, "").replace(/\/\*.*?\*\//gs, "");

const ALLOWED = [
  // An alpha mask: black keeps the pixel, transparent drops it.
  /mask-image:[^;]*#000/g,
  // A real page assumes a white canvas; see the note in the file. The two
  // design frames are the same argument: each is an <iframe> of a page that
  // was designed on white (BC-6, 27 Sep 2026, when this began reading them).
  /\.(html|browser)-view\s*\{[^}]*#fff/g,
  /\.(design-comparison-frame|design-recipe-preview)\s*\{[^}]*background: white/g,
];

/**
 * The modules' sheets bring their own look, and some of it is literal — the
 * anatomy map's category inks, the wireframe's blueprint blue, the talk mic's
 * pulse. Counted rather
 * than excused (BC-6, 27 Sep 2026): each number may only go down, and a new
 * literal in any other sheet fails the case below.
 */
const MODULE_LITERALS: Record<string, number> = {
  "packages/modules/anatomy/src/style.css": 14,
  "packages/modules/wireframe/assets/styles.css": 7,
  // The mic's pulse, a blue no theme moves.
  "packages/modules/talk/src/web.tsx": 3,
};

function literalsIn(text: string): string[] {
  let t = declarationsOf(text);
  for (const allowed of ALLOWED) t = t.replace(allowed, "");
  return t.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|:\s*(white|black)\b/g) ?? [];
}

describe("colours come from tokens", () => {
  it("declares no literal colour outside the token blocks", () => {
    // Every stylesheet the page loads, not `styles.css` alone (BC-6): the
    // sheets beside the components were read by no guard at all.
    const found = sheets
      .flatMap((s) => literalsIn(s.text).map((l) => `${s.file}: ${l}`))
      .filter((l) => !Object.keys(MODULE_LITERALS).some((f) => l.startsWith(`${f}: `)));
    expect(
      found,
      "use a token, or add a token — a literal reads on one ground and vanishes on the other",
    ).toEqual([]);
  });

  it("lets no module sheet grow a literal colour, and keeps its count honest", () => {
    const counts = Object.fromEntries(
      Object.keys(MODULE_LITERALS).map((f) => [f, literalsIn(sheets.find((s) => s.file === f)!.text).length]),
    );
    expect(counts, "fewer is the point — lower the number; more is a new literal").toEqual(MODULE_LITERALS);
  });

  it("gives every token a value in both themes", () => {
    const names = (block: string) => new Set([...block.matchAll(/--([a-z-]+):/g)].map((m) => m[1]!));
    const light = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s.exec(css);
    const dark = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s.exec(css);
    expect(light && dark).toBeTruthy();
    const missing = [...names(light![1]!)].filter((n) => !names(dark![1]!).has(n));
    // Sizes, radii and insets are theme-independent; colours are not. Named by
    // the CONVENTION rather than one by one — `--radius` and the `--r-*`
    // ladder are all lengths, and a rule that has to be edited for each new
    // radius is a rule that will one day be edited to silence a colour.
    //
    // `--edge` and `--topbar` joined them when the header dissolved: the
    // distance chrome keeps from a window edge, and the space the header
    // occupies. A canvas does not change shape in the dark.
    //
    // By VALUE, not by name, and not by a list.
    //
    // This was a list — `radius`, then `edge`, then `topbar` — and it wanted a
    // fourth entry within the hour, which is the fate the comment above
    // predicted for it. The real rule was never "these particular names": it
    // is that A PLAIN LENGTH HAS NO DARK VARIANT. A canvas does not change
    // shape in the dark.
    //
    // Reading the value rather than the name is also what keeps it safe. A
    // colour cannot be smuggled past by being called `--edge-2`, because the
    // exemption is granted to `20px` and never to `#1f3fd0`.
    const valueOf = (name: string) =>
      new RegExp(`--${name}:\\s*([^;]+)`).exec(light![1]!)?.[1]?.trim() ?? "";
    const colourish = missing.filter((n) => !/^-?[\d.]+(px|rem|em)$/.test(valueOf(n)));
    expect(colourish, "these tokens have no dark value").toEqual([]);
  });

  it("makes buttons inherit their colour", () => {
    // The actual bug: a <button> with a background and no colour paints the
    // UA's buttontext. Black on white looks deliberate; black on graphite is
    // an empty card.
    expect(css).toMatch(/button[^{]*\{[^}]*color:\s*inherit/);
  });
});

/**
 * The two pure decisions behind the design-system view. Both exist because a
 * design system has to be shown as the thing it describes: a colour that can
 * carry words says so on the swatch, and a spacing step is drawn to scale
 * rather than listed, because the rhythm is what a table of numbers hides.
 */
describe("drawing a design system", () => {
  it("picks the ink a swatch can actually carry, with the ratio", () => {
    expect(readableInk("#000000")).toEqual({ color: "#ffffff", ratio: 21 });
    expect(readableInk("#ffffff")).toEqual({ color: "#000000", ratio: 21 });
    const cobalt = readableInk("#1f3fd0");
    expect(cobalt?.color).toBe("#ffffff");
    expect(cobalt!.ratio).toBeGreaterThan(4.5);
  });

  it("says nothing rather than inventing a number it cannot compute", () => {
    expect(readableInk("not a colour")).toBeNull();
    expect(readableInk("var(--accent)")).toBeNull();
  });

  it("reads the lengths it can draw to scale", () => {
    expect(lengthPx(16)).toBe(16);
    expect(lengthPx("16px")).toBe(16);
    expect(lengthPx("1.5rem")).toBe(24);
    expect(lengthPx("0")).toBe(0);
  });

  it("refuses the ones it cannot", () => {
    for (const v of ["50%", "clamp(1rem, 2vw, 3rem)", "auto", "", undefined]) {
      expect(lengthPx(v), String(v)).toBeNull();
    }
  });
});

/**
 * Every `var(--x)` names a token something defines.
 *
 * `var()` on an undefined property with no fallback does not warn, does not
 * throw, and does not fall back to anything — the declaration is simply
 * DROPPED. So a one-character typo in a token name is invisible: the rule
 * still parses, the build is clean, the tests pass, and the element renders
 * with whatever it would have had anyway.
 *
 * Caught the day full screen was built. `.fullscreen` asked for `var(--bg)`,
 * which this stylesheet has never had — the palette calls it `--ground` — so
 * an element whose entire job was to COVER the canvas was transparent, and the
 * canvas showed through the thing hiding it. Same shape as lessons.md #39: a
 * bad value that never threw.
 */
describe("every token used is a token defined", () => {
  /**
   * Every stylesheet the app page loads, each with its prose blanked out —
   * what the browser actually parses. Comments are replaced by their own
   * newlines rather than removed, so the line number in a failure still
   * points at the real line.
   *
   * Needed because the rule has to be explainable: the comment on `.fullscreen`
   * names `var(--nope)` to say what an undefined token does, and a check that
   * reads its own rationale as a violation is a check nobody can document.
   *
   * EVERY sheet, not `styles.css` (BC-6/BC-4, 27 Sep 2026). This read one file
   * while twenty more loaded beside it, and those asked for `--page`,
   * `--muted` and `--radius-lg` — none defined anywhere, each declaration
   * dropped. Tokens are defined once, in `styles.css`, and read everywhere, so
   * `defined` is the union and `used` names the file each use is in.
   */
  const blank = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const all = sheets.map((s) => ({ file: s.file, rules: blank(s.text) }));
  const rules = all.map((s) => s.rules).join("\n");

  /** Names defined anywhere — `:root`, a theme block, or on an element. */
  function defined(text: string): Set<string> {
    return new Set([...text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]!));
  }

  /** Names USED, with the fallback arm of `var(--a, var(--b))` counted too. */
  function used(text: string, file = "styles.css"): Array<{ name: string; line: number; file: string }> {
    const out: Array<{ name: string; line: number; file: string }> = [];
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
        out.push({ name: m[1]!, line: i + 1, file });
      }
    });
    return out;
  }

  it("finds tokens at all — the parser has to work for this to mean anything", () => {
    expect(defined(rules).size).toBeGreaterThan(20);
    expect(used(rules).length).toBeGreaterThan(50);
  });

  it("reads every sheet the page loads, not only styles.css", () => {
    // The finding was a guard that read one file of twenty-odd. Named so a
    // `sheets` that quietly shrinks back to one fails here, not nowhere.
    const files = all.map((s) => s.file);
    expect(files[0]).toBe("packages/web/src/styles.css");
    for (const f of [
      "packages/web/src/components/phone.css",
      "packages/web/src/components/yourbench.css",
      "packages/web/src/components/design-systems.css",
      "packages/modules/talk/src/web.tsx",
    ]) {
      expect(files, f).toContain(f);
    }
    expect(files.length).toBeGreaterThan(20);
  });

  it("defines every token the stylesheet reads", () => {
    // `--scale` and `--work-color` are set inline by React (ItemView, the
    // viewport), never in this file, so they are named here as the
    // deliberate exceptions rather than being silently tolerated by the regex.
    //
    // `--text-size` and `--text-face` join them: a text node's ladder step
    // and face are ITEM PROPERTIES, so their values come from the canvas and
    // cannot be declared in a stylesheet. Both are read with a fallback —
    // `var(--text-size, 16px)` — which is what an older node carrying neither
    // property renders with, so the declaration never drops.
    const setInJs = new Set([
      "--scale",
      "--work-color",
      "--who",
      "--mention-color",
      "--text-size",
      "--text-face",
      // `--text-ink` is a node's colour (`textInkOf`): a `--text-*` token for
      // a name, a hex for a hex, and read as `var(--text-ink, var(--ink))`
      // so a node that names none keeps the theme's ink.
      "--text-ink",
      // `--swatch` is the colour a text-colour button stands for, the same
      // `textInk` value, set on each button (`TextComposer`).
      "--swatch",
      // `--mark` is the kind mark's size, computed per item from its box and
      // the zoom (`textMarkSize`) — a number no stylesheet can know, for the
      // same reason `--scale` is not in one.
      "--mark",
      // `--canvas-ground` is the colour THIS canvas is standing on, which is a
      // canvas property (`lib/groundtone.ts`) rather than anything a
      // stylesheet knows. Read as `var(--canvas-ground, var(--ground))`, so a
      // canvas with no ground of its own falls back to the app's page ground
      // and the declaration never drops.
      "--canvas-ground",
      // `--tint` is a stacked group's member colour (`GroupStack.tsx`
      // `tintOf`): always a token by name — a paper or a kind family — set on
      // the card that reads it, and read with a fallback.
      "--tint",
      // The modules' own, set on the element that reads them, from numbers a
      // stylesheet cannot know: the anatomy workspace's pane sizes as the
      // person drags them (`workspace.tsx`), and a wireframe arrow label's
      // run and a margin tag's width and need (`arrows.tsx`,
      // `behind-marks.tsx`, `maybe-marks.tsx`).
      "--anatomy-tree-width",
      "--anatomy-inspector-width",
      "--anatomy-inspector-height",
      "--run",
      "--w",
      "--need",
    ]);
    const known = defined(rules);
    const missing = all
      .flatMap((s) => used(s.rules, s.file))
      .filter((u) => !known.has(u.name) && !setInJs.has(u.name));
    expect(
      missing.map((m) => `${m.name} (${m.file}:${m.line})`),
      "these tokens are read but never defined — var() drops the declaration silently",
    ).toEqual([]);
  });
});
