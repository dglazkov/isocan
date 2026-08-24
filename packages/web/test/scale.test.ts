import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The measures this stylesheet is written in.
 *
 * Colour has had a guard since the first design review (`tokens.test.ts`), and
 * it works: **zero** literal colours outside the token blocks. The other two
 * axes a design system is made of — how far apart things sit, and how round
 * their corners are — have had none, and three consecutive design reviews have
 * measured the same drift and written the same paragraph. A finding on its
 * third run does not need a fourth paragraph.
 *
 * This is deliberately NOT a scale. Nobody has chosen 4px-and-multiples for
 * this app, and a test that imposed one would be my taste wearing a green
 * check. What it holds is the weaker claim that is entirely the repo's own:
 * **do not invent a new step.** Reuse one of the values already here, or add a
 * token — either is fine, and inventing a 26th spacing value because 13 looked
 * right in one place is the thing `slop.ts` calls "spacing by eyeball" and the
 * thing nobody can name when the screen reads as sloppy.
 *
 * So every count below is an EQUALITY, not a ceiling, and the number is the
 * measurement taken on 2026-08-24. Adding a rule that reuses an existing step
 * changes nothing. Inventing a step fails. Removing the last use of one also
 * fails — and the fix for that is to lower the number here, which is how the
 * improvement gets recorded instead of quietly becoming the new slack.
 *
 * Values in `calc(… / var(--scale))` are skipped throughout: those are screen
 * pixels inside the zoomed world, they are guarded by `worldchrome.test.ts`,
 * and they are not steps in this scale.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
/** Comments discuss measurements at length; they do not set them. */
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
/** The `:root` blocks are where a step is DECLARED. Everything else uses one. */
const outside = bare.replace(/:root[^{]*\{[^}]*\}/gs, "");

/**
 * Pixel lengths in one family of properties.
 *
 * A value that references a custom property is skipped whole, because it is
 * not a step being invented: `calc(6px / var(--scale))` is a screen pixel
 * inside the zoomed world (`worldchrome.test.ts` owns those), and
 * `calc(var(--radius) - 1px)` is the token minus a border — the `1px` there is
 * the hairline it sits inside, and counting it as a 15th radius step is how the
 * first draft of this test failed.
 */
function lengths(property: RegExp): number[] {
  const out: number[] = [];
  for (const declaration of outside.matchAll(property)) {
    const value = declaration[declaration.length - 1] ?? "";
    if (/var\(--/.test(value)) continue;
    for (const px of value.matchAll(/(\d*\.?\d+)px/g)) out.push(parseFloat(px[1]!));
  }
  return out;
}

const SPACING = /(?:^|[;{\s])(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block|start|end))?\s*:\s*([^;{}]+)/g;
const RADIUS = /(?:^|[;{\s])border(?:-[a-z]+)?-radius\s*:\s*([^;{}]+)/g;
const FONT_SIZE = /(?:^|[;{\s])font-size\s*:\s*([^;{}]+)/g;

const spacing = lengths(SPACING);
const radii = lengths(RADIUS);
const sizes = [...outside.matchAll(FONT_SIZE)].map((m) => (m[1] ?? "").trim());

const distinct = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

/**
 * Every check here counts things, and a counter that has stopped counting
 * reports zero and passes (lessons.md #8, #14). So the parser is asserted
 * first, against floors far below today's numbers: if a regex stops matching,
 * these fail with "the parser" in the message rather than the rest of the file
 * turning green.
 */
describe("the parser can still see the stylesheet", () => {
  it("finds the declarations it is about to count", () => {
    expect(spacing.length, "no spacing lengths found — the regex broke").toBeGreaterThan(300);
    expect(radii.length, "no radius lengths found — the regex broke").toBeGreaterThan(80);
    expect(sizes.length, "no font-sizes found — the regex broke").toBeGreaterThan(100);
  });

  it("strips the token blocks, where a step is declared rather than used", () => {
    // `--radius: 8px` lives in :root and must not be counted as a use of 8.
    expect(outside).not.toMatch(/--radius:/);
    expect(bare.length - outside.length).toBeGreaterThan(400);
  });
});

/**
 * 25 distinct spacing values across 407 declarations, measured 2026-08-24.
 * The long tail is the tell: 13px appears once, 28px once, 34px twice, 40px
 * once, 96px once. Those are eyeballed, and each one is a step somebody else
 * now has to decide whether to match.
 */
describe("spacing", () => {
  const SPACING_STEPS = 25;

  it("invents no new step", () => {
    expect(
      distinct(spacing).length,
      `spacing steps: ${distinct(spacing).join(", ")}. Reuse one of these, or add a token. ` +
        "If you REMOVED one, lower the number in this test — that is the record of the fix.",
    ).toBe(SPACING_STEPS);
  });

  it("keeps the count honest by naming the declaration total too", () => {
    // A refactor that halves the file while keeping all 25 steps is not caught
    // by the count above, and should not be — but a jump in declarations with
    // no jump in steps is exactly the shape of healthy growth, so it is worth
    // being able to see. Generous bounds; this is a trip-wire, not a budget.
    expect(spacing.length).toBeGreaterThan(SPACING_STEPS * 4);
    expect(spacing.length).toBeLessThan(900);
  });
});

/**
 * `--radius` is the only size token this file has, it is `8px`, and it is used
 * ten times against 106 literal radii in 14 distinct values.
 *
 * The listed rules below write `border-radius: 8px` — not a different rounding
 * decision, the token's own value spelled out. That is not a taste call: they
 * are eight places that will not follow if `--radius` ever moves. The fix is
 * `var(--radius)` and it is a no-op today.
 */
describe("corner radii", () => {
  const RADIUS_STEPS = 14;

  const RESTATES_THE_TOKEN = [
    ".share-link-row",
    ".terminal-command",
    ".theme-switch",
    ".item-peek .item-thumb",
    ".beacon-row",
    ".onit",
    ".ds-component",
    ".ds-problems",
  ];

  /** Every rule whose body writes the token's own value as a literal. */
  function restatements(): string[] {
    const out: string[] = [];
    for (const rule of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (rule[1] ?? "").trim().replace(/\s+/g, " ");
      for (const declaration of (rule[2] ?? "").matchAll(RADIUS)) {
        if (/^\s*8px\s*$/.test(declaration[1] ?? "")) out.push(selector);
      }
    }
    return out;
  }

  it("declares --radius as the value these rules are restating", () => {
    // Without this the list below is eight strings about nothing: if --radius
    // were re-valued to 10px, `8px` would stop being a restatement and start
    // being a real (if unexplained) decision.
    expect(css).toMatch(/--radius:\s*8px;/);
  });

  it("invents no new step", () => {
    expect(
      distinct(radii).length,
      `radius steps: ${distinct(radii).join(", ")}. Reuse one, or reach for var(--radius).`,
    ).toBe(RADIUS_STEPS);
  });

  it("adds no new rule that spells out --radius instead of using it", () => {
    const added = restatements().filter((one) => !RESTATES_THE_TOKEN.includes(one));
    expect(
      added,
      "these write `border-radius: 8px`, which IS var(--radius) — use the token",
    ).toEqual([]);
  });

  it("keeps the known list honest: every entry still restates it", () => {
    const found = restatements();
    const stale = RESTATES_THE_TOKEN.filter((one) => !found.includes(one));
    expect(stale, "these were fixed or renamed — delete them from the list").toEqual([]);
  });
});

/**
 * 17 distinct font-sizes, five of them on a half pixel: 9.5, 10.5, 11.5, 12.5,
 * 13.5, together 70 of the 170 declarations. `slop.ts` calls "more than six
 * distinct sizes on one page" the tell; this is a whole app rather than one
 * page, so the count alone proves less — but a half-pixel size lands between
 * device pixels at 1x, and five of them is a scale being nudged rather than
 * chosen.
 */
describe("type sizes", () => {
  const TYPE_STEPS = 17;
  const HALF_PIXEL = [9.5, 10.5, 11.5, 12.5, 13.5];

  it("invents no new size", () => {
    expect(
      [...new Set(sizes)].length,
      `font-sizes: ${[...new Set(sizes)].sort().join(", ")}. Reuse one.`,
    ).toBe(TYPE_STEPS);
  });

  it("adds no sixth half-pixel size", () => {
    const halves = distinct(
      sizes.flatMap((v) => [...v.matchAll(/(\d*\.?\d+)px/g)].map((m) => parseFloat(m[1]!))),
    ).filter((v) => !Number.isInteger(v));
    expect(halves, "a half-pixel size does not land on a device pixel at 1x").toEqual(HALF_PIXEL);
  });
});
