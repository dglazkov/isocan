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
function lengths(property: RegExp, text: string = outside): number[] {
  const out: number[] = [];
  for (const declaration of text.matchAll(property)) {
    const value = declaration[declaration.length - 1] ?? "";
    if (/var\(--/.test(value)) continue;
    for (const px of value.matchAll(/(\d*\.?\d+)px/g)) out.push(parseFloat(px[1]!));
  }
  return out;
}

const SPACING = /(?:^|[;{\s])(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block|start|end))?\s*:\s*([^;{}]+)/g;
const RADIUS = /(?:^|[;{\s])border(?:-[a-z]+)?-radius\s*:\s*([^;{}]+)/g;
const FONT_SIZE = /(?:^|[;{\s])font-size\s*:\s*([^;{}]+)/g;

/**
 * **Two surfaces, two scales, two measurements.**
 *
 * This file was measured against the app — the canvas, its panels, its chrome
 * — and every number in it was right for that. Then the front page arrived and
 * pushed all three counts over at once, and the first instinct (tokenize the
 * page's steps) was wrong twice over: the page was redesigned again within the
 * hour, so the tokens were obsolete before they were pushed, and a landing
 * page squeezed into 12/14/16 would read like a settings dialog anyway.
 *
 * Measured rather than argued: partitioning the stylesheet gives the APP
 * spacing 25, radii 14, type 17 — exactly this file's original numbers. The
 * front page was the whole of the excess. So the split costs the app's guard
 * nothing and keeps it at full strength on the surface it was written for.
 *
 * The front page gets its own counts rather than an exemption. It is younger
 * and still being designed, so its numbers are expected to move — but
 * deliberately, in a diff, which is the entire point of counting.
 */
function partition(): { app: string; front: string } {
  const app: string[] = [];
  const front: string[] = [];
  for (const rule of outside.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    (/\.front[-\b]/.test(rule[1] ?? "") ? front : app).push(rule[0]);
  }
  return { app: app.join("\n"), front: front.join("\n") };
}
const { app: APP_CSS, front: FRONT_CSS } = partition();

const spacing = lengths(SPACING, APP_CSS);
const radii = lengths(RADIUS, APP_CSS);
const frontSpacing = lengths(SPACING, FRONT_CSS);
const frontRadii = lengths(RADIUS, FRONT_CSS);
/**
 * Font sizes, skipping any value that names a token — for the same reason
 * `lengths` skips them, which this originally did not.
 *
 * A size behind a custom property is not a step being invented; it is one
 * being DECLARED, which is the second half of this file's own instruction
 * ("reuse one of these, or add a token"). Counting `var(--front-title)` as a
 * distinct size made that instruction impossible to follow: taking the token
 * route failed the test that asked for it, and the only way to green was to
 * inline the literal the test was written to discourage.
 */
const typeIn = (text: string) =>
  [...text.matchAll(FONT_SIZE)]
    .map((m) => (m[1] ?? "").trim())
    .filter((value) => !/var\(--/.test(value));
const sizes = typeIn(APP_CSS);
const frontSizes = typeIn(FRONT_CSS);

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

/**
 * The front page's own scale.
 *
 * Counted apart from the app for the reason argued at `partition`: it is a
 * marketing column read at arm's length, not a panel read at working distance,
 * and holding it to the app's steps would be this file imposing a taste it
 * explicitly disclaims. What it is held to is the same weak, useful claim —
 * do not invent a 18th step by eyeball — measured on 2026-08-24 against the
 * page as redesigned that afternoon.
 *
 * These numbers are expected to move while the page is being designed. Moving
 * them in a diff, with a reason, is the whole point; discovering afterwards
 * that a page grew four type sizes nobody chose is what this prevents.
 */
describe("the front page's scale", () => {
  it("is actually being measured — the parser has to find it", () => {
    // Same reason as every other counter here: a parser that stopped matching
    // reports zero and passes (lessons.md #8, #14).
    expect(FRONT_CSS.length, "no front-page rules found — renamed?").toBeGreaterThan(500);
    expect(distinct(frontSpacing).length).toBeGreaterThan(5);
  });

  it("invents no new spacing step", () => {
    expect(
      distinct(frontSpacing).length,
      `front-page spacing: ${distinct(frontSpacing).join(", ")}. Reuse one, or add a token.`,
    ).toBe(17);
  });

  it("keeps to one corner radius that is not the token", () => {
    // 12 — a card corner larger than `--radius`, which the page uses for the
    // wide panels the app has no equivalent of.
    expect(
      distinct(frontRadii),
      `front-page radii: ${distinct(frontRadii).join(", ")}`,
    ).toEqual([12]);
  });

  it("invents no new type size", () => {
    const distinctSizes = [...new Set(frontSizes)];
    expect(
      distinctSizes.length,
      `front-page type: ${distinctSizes.sort().join(", ")}. Reuse one.`,
    ).toBe(9);
  });

  it("uses fluid type only for the two display lines", () => {
    // `clamp()` is right for a headline that has to hold from a phone to a
    // desktop and wrong for body copy, where it makes a size nobody can name.
    const fluid = frontSizes.filter((one) => one.startsWith("clamp("));
    expect(fluid.length, `fluid sizes: ${fluid.join(" | ")}`).toBe(2);
  });
});
