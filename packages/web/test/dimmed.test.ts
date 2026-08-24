import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { readableInk } from "../src/lib/designview.ts";

/**
 * `opacity` is a second colour decision, taken where nobody is looking.
 *
 * A token has a measured ratio. `opacity: 0.75` on the element wearing it
 * silently replaces that ratio with a different, smaller one — and unlike a
 * colour, it never appears in `tokens.test.ts`, never appears in a palette
 * review, and reads in a diff as a taste adjustment rather than a contrast
 * change. This repo's quiet inks have almost no room for it: `--ink-soft` on
 * `--card` measures 5.15:1 in light and 5.12:1 in dark, so the whole budget is
 * the first case below — under ~0.93 and the text is no longer legible text.
 *
 * The arithmetic is derived from the tokens rather than pasted, so the guard
 * expires on its own: brighten `--ink-soft` far enough and the first case
 * fails, telling you the budget moved and the list can be revisited.
 *
 * The list itself is a ratchet, in the shape `accent.test.ts` already uses:
 * every rule that dims text is named with what it measures, and the list must
 * shrink and must never grow.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
/** Comments out, and `@keyframes` bodies out — a fade-in is not a contrast
 *  decision, and `50% { opacity: .45 }` is not a rule about text. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

function token(block: RegExp, name: string): string {
  const scope = block.exec(css);
  expect(scope, `no :root block matched ${block}`).toBeTruthy();
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(scope![1]!);
  expect(value, `--${name} is not declared there`).toBeTruthy();
  return value![1]!.trim();
}

const DARK = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s;
const LIGHT = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s;

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  return rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i]! * c, 0);
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** What the eye sees when `alpha` of `ink` is painted over `ground`. */
function composite(ink: string, ground: string, alpha: number): number {
  const [f, b] = [channels(ink), channels(ground)];
  return ratio(f.map((v, i) => v * alpha + b[i]! * (1 - alpha)) as [number, number, number], b);
}

/** The lowest opacity at which `ink` on `ground` still carries body text. */
function budget(ink: string, ground: string): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (composite(ink, ground, mid) >= 4.5) hi = mid;
    else lo = mid;
  }
  return hi;
}

describe("quiet ink has no room to be dimmed", () => {
  it("clears 4.5:1 only above ~0.93 opacity, in both themes", () => {
    for (const [theme, block] of [
      ["light", LIGHT],
      ["dark", DARK],
    ] as const) {
      const ink = token(block, "ink-soft");
      const card = token(block, "card");
      const full = composite(ink, card, 1);
      expect(full, `--ink-soft (${ink}) on --card (${card}) in ${theme}`).toBeGreaterThanOrEqual(4.5);
      const floor = budget(ink, card);
      expect(
        floor,
        `in ${theme}, --ink-soft on --card is ${full.toFixed(2)}:1 at full strength and falls under ` +
          `4.5:1 below ${floor.toFixed(3)} opacity. If that budget has genuinely widened, ` +
          "re-measure the list below rather than deleting this case.",
      ).toBeGreaterThan(0.85);
    }
  });

  /**
   * `.ds-ratio` is the number a design-system swatch prints to say how well the
   * colour carries text. `readableInk` picks black or white, whichever wins —
   * and the *worst* colour in the sRGB cube still wins at 4.58:1, which is the
   * whole headroom that number has. Any opacity at all puts the badge that
   * reports a contrast ratio under the ratio it reports.
   */
  it("leaves the swatch badge 0.08 of headroom, because black-or-white bottoms out at 4.58:1", () => {
    let worst = Infinity;
    let at = "";
    for (let r = 0; r < 256; r += 5) {
      for (let g = 0; g < 256; g += 5) {
        for (let b = 0; b < 256; b += 5) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
          const best = readableInk(hex);
          if (best && best.ratio < worst) {
            worst = best.ratio;
            at = hex;
          }
        }
      }
    }
    expect(
      worst,
      `readableInk's floor moved to ${worst.toFixed(2)}:1 (at ${at}). If it now measures against ` +
        "the document's own ground instead of black-or-white, this case has done its job — " +
        "delete it and re-measure .ds-ratio.",
    ).toBeLessThan(4.7);
    expect(worst).toBeGreaterThan(4.5);
  });
});

/** Properties that mean the rule is about words rather than a shape. */
const TEXT_PROPS =
  /(^|[;{\s])(color|font-size|font-weight|font-style|letter-spacing|text-transform|font-variant-numeric):/;

/** Every rule that fades text, with the opacity it fades it to. */
function dimsText(): { selector: string; opacity: number }[] {
  const out: { selector: string; opacity: number }[] = [];
  for (const rule of rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2] ?? "";
    const faded = /(^|[;{\s])opacity:\s*(0?\.\d+)\s*(;|$)/.exec(body);
    if (!faded || !TEXT_PROPS.test(body)) continue;
    const selector = (rule[1] ?? "").trim().replace(/\s+/g, " ");
    // SC 1.4.3 exempts an inactive control, and fading one is how this app
    // says "not now" everywhere else.
    if (/:disabled\b|\[disabled\]|\.disabled\b/.test(selector)) continue;
    out.push({ selector, opacity: Number(faded[2]) });
  }
  return out;
}

/**
 * The four rules that dim text today, each with what it actually measures.
 * Shrink this list; do not add to it. The fix is always the same: drop the
 * `opacity` and pick a token that is already the colour you wanted.
 *
 *   .ds-ratio            10px/700, the contrast number ON a swatch. The best
 *                        ink a swatch can carry is 4.58:1 (above), so 0.85
 *                        renders the printed "4.6" at 3.77:1.
 *   .ds-ref              --ink-soft on --card: 5.15:1 -> 3.12 light / 3.48 dark.
 *   .ds-section > h3 span  inherits --ink-soft from its parent rule:
 *                        5.15:1 -> 2.85 light / 3.21 dark.
 *   .cursor-chip em      --accent-ink (white) on the actor's identity colour.
 *                        Six of the seven land between 3.50 and 4.25; only
 *                        Violet (4.87) clears.
 */
const KNOWN_DIMMED_TEXT = [".ds-section > h3 span", ".ds-ratio", ".ds-ref", ".cursor-chip em"];

describe("nothing new fades text with opacity", () => {
  it("adds no rule beyond the known list", () => {
    const added = dimsText()
      .filter((r) => !KNOWN_DIMMED_TEXT.includes(r.selector))
      .map((r) => `${r.selector} (opacity ${r.opacity})`);
    expect(
      added,
      "these dim text with opacity, which is a contrast decision no colour test can see — " +
        "use a quieter token, or a smaller size, instead",
    ).toEqual([]);
  });

  it("keeps the known list honest: every entry still exists", () => {
    const found = dimsText().map((r) => r.selector);
    const stale = KNOWN_DIMMED_TEXT.filter((s) => !found.includes(s));
    expect(stale, "these were fixed or renamed — delete them from the list").toEqual([]);
  });
});
