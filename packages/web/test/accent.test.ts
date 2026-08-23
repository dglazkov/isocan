import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The accent has two jobs, and only one of them is readable.
 *
 * On vellum the cobalt that FILLS a primary button is also the cobalt you can
 * read as a link — one value does both, so nothing forces the distinction.
 * On graphite it does not: `--accent` was brightened so a filled button still
 * reads as selected, and at that value it is a 2.5–3.3:1 ink. The stylesheet
 * already knows this — it declares `--accent-text` and says so in a comment —
 * and then paints fourteen glyphs, labels and counts with `--accent` anyway,
 * which is invisible-ish text on every dark surface in the app.
 *
 * This is not a taste argument, it is arithmetic, so the arithmetic is here:
 * the first two cases derive the ratios from the tokens themselves. If someone
 * re-values `--accent` to something that reads, those cases fail and the rule
 * below can be deleted — which is the point. A guard should expire when the
 * thing it guards becomes impossible.
 *
 * The third case is a ratchet. The fourteen rules that predate it are listed;
 * the list must shrink and must never grow. Every entry is removed the same
 * way: `var(--accent)` -> `var(--accent-text)`. That substitution is a no-op
 * in light mode, where the two tokens hold the identical value.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** A token's value inside one `:root` block. */
function token(block: RegExp, name: string): string {
  const scope = block.exec(css);
  expect(scope, `no :root block matched ${block}`).toBeTruthy();
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(scope![1]!);
  expect(value, `--${name} is not declared there`).toBeTruthy();
  return value![1]!.trim();
}

const DARK = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s;
const LIGHT = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s;

function ratio(a: string, b: string): number {
  const channels = (hex: string) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const lum = (hex: string) =>
    channels(hex)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i]! * c, 0);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every opaque surface a word can land on in dark mode. */
const SURFACES = ["ground", "card", "chip"];

describe("the accent is a fill, not an ink", () => {
  it("cannot be read as text on any dark surface — which is why --accent-text exists", () => {
    const accent = token(DARK, "accent");
    const failing = SURFACES.map((s) => [s, +ratio(accent, token(DARK, s)).toFixed(2)] as const);
    for (const [surface, r] of failing) {
      expect(
        r,
        `--accent (${accent}) now reads at ${r}:1 on --${surface}. If that is deliberate, ` +
          "delete this file — the rule below exists only because it did not.",
      ).toBeLessThan(4.5);
    }
  });

  it("has an ink that does clear 4.5:1 on all of them", () => {
    const ink = token(DARK, "accent-text");
    for (const surface of SURFACES) {
      const r = +ratio(ink, token(DARK, surface)).toFixed(2);
      expect(r, `--accent-text (${ink}) on --${surface} is ${r}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is the same value as its ink in light, so the substitution is free there", () => {
    expect(token(LIGHT, "accent-text")).toBe(token(LIGHT, "accent"));
  });
});

/**
 * The one background the fill accent is legible on is the ink it was designed
 * to carry — `--accent-ink` is white in both themes, and cobalt on white is
 * 5.9:1 in dark and 7.8:1 in light. Anything else, including the 14%-alpha
 * `--accent-wash`, resolves to the surface underneath it.
 */
function paintsAccentText(): string[] {
  const out: string[] = [];
  for (const rule of rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2] ?? "";
    if (!/(^|[;{\s])color:\s*var\(--accent\)\s*(;|$)/.test(body)) continue;
    if (/(^|[;{\s])background(-color)?:\s*var\(--accent-ink\)/.test(body)) continue;
    out.push((rule[1] ?? "").trim().replace(/\s+/g, " "));
  }
  return out;
}

/**
 * Fourteen rules, measured at 2.5–2.9:1 in dark. Shrink this list; do not add
 * to it. `var(--accent)` -> `var(--accent-text)` is the whole fix.
 */
const KNOWN_UNREADABLE_IN_DARK = [
  ".item.selected .item-titlebar",
  ".star-btn.on",
  ".thread-popover .thread-actions button.promote",
  ".main-glyph, .main-pill-glyph",
  ".mt-glyph",
  ".mention-dot.command-dot",
  ".command-card b",
  ".favourites-glyph",
  ".favourite-name b",
  ".files-glyph",
  ".files-row.active .files-kind",
  ".files-size em",
  ".shelf-glyph",
  ".drop-overlay",
];

describe("nothing new is painted in the fill accent", () => {
  it("adds no rule beyond the known list", () => {
    const added = paintsAccentText().filter((s) => !KNOWN_UNREADABLE_IN_DARK.includes(s));
    expect(
      added,
      "these paint text in --accent, which is 2.5:1 on graphite — use var(--accent-text)",
    ).toEqual([]);
  });

  it("keeps the known list honest: every entry still exists", () => {
    const found = paintsAccentText();
    const stale = KNOWN_UNREADABLE_IN_DARK.filter((s) => !found.includes(s));
    expect(stale, "these were fixed or renamed — delete them from the list").toEqual([]);
  });
});
