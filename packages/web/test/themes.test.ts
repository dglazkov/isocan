import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IDENTITY_COLORS } from "@isocan/core";

/**
 * Two themes, and the ways a colour decision escapes them.
 *
 * `tokens.test.ts` holds the line inside `styles.css`: every colour is a
 * token, every token has a value in both blocks. This file covers the two
 * places a colour can still be theme-blind after that check is green.
 *
 * **A colour that cannot be a token at all.** An actor's identity colour is
 * one literal, shared by every client, stamped into SVG drawings — it cannot
 * be re-valued per theme, so it is the same value on vellum and on graphite.
 * The palette is chosen so all seven read as a DISC on both grounds, which is
 * a 3:1 bar. As a WORD the bar is 4.5:1 and the palette does not clear it on
 * either ground unaided: on graphite Violet measured 2.75:1, and on vellum
 * every one of the seven measured 3.11–4.22:1 inside a `.mention-me` chip,
 * because that chip's background is a 24% wash of the very colour written on
 * it. The stylesheet answers with `--identity-mix`: the ink is the colour
 * pulled toward `--ink`, by a different amount per theme. This file is the
 * arithmetic behind those two percentages, so re-valuing either one — or
 * adding a colour to the palette — fails here rather than shipping.
 *
 * **A colour outside the stylesheet.** An SVG presentation attribute takes no
 * `var()`, so `fill="#c6c9c0"` in a component is a colour no theme can move,
 * and no test that reads `styles.css` can see. The minimap carried three of
 * them: items drawn in a light grey that measured 1.67:1 on the white panel
 * and 10.51:1 on the graphite one, a viewport rectangle in the LIGHT accent at
 * 2.25:1 on graphite, and a `#fff` ring that was the panel in one theme and a
 * halo in the other.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src");
const css = readFileSync(path.join(src, "styles.css"), "utf8");

const LIGHT = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s;
const DARK = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s;

function token(block: RegExp, name: string): string {
  const scope = block.exec(css);
  expect(scope, `no :root block matched ${block}`).toBeTruthy();
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(scope![1]!);
  expect(value, `--${name} is not declared there`).toBeTruthy();
  return value![1]!.trim();
}

type Rgb = [number, number, number];

function channels(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance(c: Rgb): number {
  return c
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i]! * v, 0);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `color-mix(in srgb, a p%, b)`, which is what the stylesheet actually does. */
function mix(a: Rgb, b: Rgb, p: number): Rgb {
  return a.map((v, i) => v * p + b[i]! * (1 - p)) as Rgb;
}

/**
 * The tightest bed an identity colour lands on in either theme.
 *
 * `.mention-me` writes the actor's name on a 24% wash of that same colour over
 * the card — ink and ground one hue apart by construction, which is why it is
 * the worst case and why measuring the colour against the card alone missed
 * it for as long as it did.
 */
function mentionMe(colour: Rgb, card: Rgb, ink: Rgb, mixPercent: number): number {
  return ratio(mix(colour, ink, mixPercent), mix(colour, card, 0.24));
}

describe("an identity colour, written as a word, reads in both themes", () => {
  const themes = [
    { name: "light", block: LIGHT },
    { name: "dark", block: DARK },
  ] as const;

  it("declares --identity-mix in both themes", () => {
    for (const { name, block } of themes) {
      expect(token(block, "identity-mix"), `${name} has no --identity-mix`).toMatch(/^\d+%$/);
    }
  });

  for (const { name, block } of themes) {
    it(`clears 4.5:1 for every colour in the palette — ${name}`, () => {
      const p = parseInt(token(block, "identity-mix"), 10) / 100;
      const card = channels(token(block, "card"));
      const ground = channels(token(block, "ground"));
      const ink = channels(token(block, "ink"));
      for (const { name: colour, value } of IDENTITY_COLORS) {
        const c = channels(value);
        const beds: Array<[string, number]> = [
          [".who on --card", ratio(mix(c, ink, p), card)],
          [".who on --ground", ratio(mix(c, ink, p), ground)],
          [".mention on --card", ratio(mix(c, ink, p), mix(c, card, 0.13))],
          [".mention-me on --card", mentionMe(c, card, ink, p)],
          [".mention-me on --ground", mentionMe(c, ground, ink, p)],
        ];
        for (const [bed, r] of beds) {
          expect(
            +r.toFixed(2),
            `${colour} (${value}) at --identity-mix ${p * 100}% reads ${r.toFixed(2)}:1 — ${bed}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  /**
   * The other half of the choice, and the reason neither percentage is simply
   * as low as it will go: every point of mix is a point of the actor's own
   * colour spent, and identity is what the colour is FOR. So the two are
   * calibrated against each other rather than against the 4.5 line — 65% on
   * vellum and 55% on graphite both land the palette's worst case at ~4.9:1,
   * a small deliberate margin over the floor. Move one theme and this fails
   * until the other moves with it, which is the property worth guarding: the
   * two themes are meant to be equally readable, not merely both passing.
   */
  it("lands both themes at the same floor, so neither drifts alone", () => {
    const floors = themes.map(({ name, block }) => {
      const p = parseInt(token(block, "identity-mix"), 10) / 100;
      const card = channels(token(block, "card"));
      const ink = channels(token(block, "ink"));
      const worst = Math.min(
        ...IDENTITY_COLORS.map(({ value }) => mentionMe(channels(value), card, ink, p)),
      );
      return { name, worst: +worst.toFixed(2) };
    });
    for (const { name, worst } of floors) {
      expect(worst, `${name}'s worst identity ink is ${worst}:1`).toBeGreaterThanOrEqual(4.75);
      expect(
        worst,
        `${name}'s worst identity ink is ${worst}:1 — that much margin is colour spent for ` +
          "contrast nobody asked for; lower the mix and give the actor their hue back",
      ).toBeLessThanOrEqual(5.25);
    }
    const [a, b] = floors;
    expect(
      Math.abs(a!.worst - b!.worst),
      `light floors at ${a!.worst}:1 and dark at ${b!.worst}:1 — one theme has drifted`,
    ).toBeLessThan(0.5);
  });
});

/**
 * Colour literals in the components, where no theme and no token test reaches.
 *
 * Only where a literal PAINTS: an attribute or a style property that puts the
 * colour on the screen. A hex compared against or computed with is arithmetic,
 * not paint, and reads the same in both themes because it never reaches a
 * pixel — which is why `DesignSystemView` naming `#ffffff` in a tooltip does
 * not appear here.
 *
 * One file is exempt and the exemption is the argument: `lib/designview.ts`
 * picks black-or-white ink for a swatch in SOMEBODY ELSE'S design system, so
 * its two literals are the answer it computes, not a colour this app wears.
 */
describe("no component paints a colour the theme cannot move", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });
  }

  /** `fill="#c6c9c0"`, `style={{ color: "#fff" }}`, and the rest of the family. */
  const PAINTS =
    /\b(fill|stroke|stopColor|floodColor|lightingColor|color|background|backgroundColor|borderColor|outlineColor|boxShadow|textShadow|caretColor)\s*[:=]\s*[{("'`][^"'`\n]*?(#[0-9a-fA-F]{3,8}\b|\brgba?\()/g;

  it("finds the source at all", () => {
    expect(walk(src).length).toBeGreaterThan(20);
  });

  /** Ink chosen for a foreign palette, not paint on ours. See above. */
  const ALLOWED = new Set(["lib/designview.ts"]);

  it("declares no hex or rgb() literal where it paints", () => {
    const offenders: string[] = [];
    for (const file of walk(src)) {
      const rel = path.relative(src, file).split(path.sep).join("/");
      if (ALLOWED.has(rel)) continue;
      // Comments blanked to their own newlines, so a line number still points
      // at the real line — the same trick tokens.test.ts uses on the CSS.
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
        m.replace(/[^\n]/g, " "),
      );
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(PAINTS)) offenders.push(`${rel}:${i + 1} ${m[0].trim()}`);
      });
    }
    expect(
      offenders,
      "a literal here cannot move with the theme — SVG presentation attributes " +
        "take no var(), so give the element a class and colour it in styles.css",
    ).toEqual([]);
  });
});
