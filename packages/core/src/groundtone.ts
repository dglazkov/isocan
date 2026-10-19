import { CONTRAST_BODY, CONTRAST_UI, contrastRatio, luminance, parseHex } from "./contrast.ts";
import type { TEXT_COLOURS } from "./textnode.ts";
import { TEXT_SURFACES } from "./textsurfaces.ts";
import { type CanvasTheme, GROUND_SCRIM, groundOf, themeOf } from "./theme.ts";

/**
 * **Smart contrast: what the ink on the ground has to be** (19 Oct 2026).
 *
 * Chrome drawn straight onto the canvas (an item's name, a kind icon, the
 * words of a chromeless note, the selection ring) took its ink from the APP's
 * theme, and a canvas's ground does not follow the app's theme. Measured on
 * the day: the dark app's muted name is 3.07 on Ocean and 2.70 on the
 * brightest picture, and in dark mode on Snow a chromeless note's words are
 * 1.19. The web's `lib/groundtoken.ts` fixed this shape for one element, the
 * top fade, on 8 Sep; this is the same fix for everything else, decided once
 * here so the web and the CLI cannot disagree about it.
 *
 * Derived, never stored: no property, no op. Choosing a ground is still one
 * `project.update` and one undo, and the tone follows in every client.
 */

/** Which ink family reads on a ground: the on-dark set, the on-light set, or
 *  neither (`mid`, where chrome stands on a plate of app glass instead). */
export type GroundTone = "dark" | "light" | "mid";

/** The four jobs ink does on the ground, in `GROUND_INK`'s order. */
export type GroundInkRole = "ink" | "muted" | "soft" | "accent";

/**
 * **The ink families for things drawn on the ground**, and what decides the
 * tone, so they live here rather than only in the stylesheet: the CSS tier
 * (`--ground-ink*`, `--ground-accent`) is held equal to this the way
 * `TEXT_COLOUR_SHADES` is held to `--text-*`.
 *
 * Each value is the nearest to today's ink that passes on the WORST ground of
 * its side. On-dark is bound by the brightest picture, `#4d4d4d`: muted
 * `#b8bec8` 4.52, accent `#b4c4ff` 4.94, where today's `#8b929d` is 2.70 and
 * `#8fa8ff` 3.71. On-light is bound by Zen,
 * `#b5ac9a`: muted `#383d44` 4.86, accent `#18288a` 5.46. One lifted accent on
 * every dark ground, rather than a plate on some, so "selected" looks the
 * same from one dark ground to the next. `soft` is non-text (kind icons,
 * quiet glyphs) and its floor is `CONTRAST_UI`.
 */
export const GROUND_INK: Record<"dark" | "light", Record<GroundInkRole, string>> = {
  dark: { ink: "#e7e9ec", muted: "#b8bec8", soft: "#b8bec8", accent: "#b4c4ff" },
  light: { ink: "#23262b", muted: "#383d44", soft: "#383d44", accent: "#18288a" },
};

/**
 * **A named text colour on a chromeless note, on a dark ground** (smart
 * contrast phase 2). The dark theme's shades (`TEXT_COLOUR_SHADES.dark`),
 * except where one had to lift: on a ground of its own a named colour is held
 * at 3:1, WCAG's large-text floor, because no hue reaches 4.5 on the brightest
 * picture and still says its name. Here and not in the app's shades, so the
 * dot grid keeps exactly the colours it had. On a light ground a note takes
 * the paper shades, which already clear 3:1 there.
 *
 * - red `#f2707a` → `#f2727c`: 2.97 → 3.01 on the brightest picture.
 * - brown stays `#c76300`, and is excused on Ocean (2.39) and the brightest
 *   picture (2.10): no brown reaches 3:1 there without turning ochre, which
 *   `spokenColour` would not call brown (`web/test/groundcontrast.test.ts`).
 *
 * The stylesheet carries these as `--ground-dark-text-<name>`, held equal.
 */
export const GROUND_TEXT_SHADES: Record<(typeof TEXT_COLOURS)[number], string> = {
  red: "#f2727c",
  orange: "#f59042",
  yellow: "#e8c547",
  green: "#5cc672",
  blue: "#6ea8f0",
  purple: "#b98ce8",
  pink: "#ec7fbd",
  brown: "#c76300",
  grey: "#9aa0a8",
};

/** The contrast each role must clear on a ground of its side: text at
 *  `CONTRAST_BODY` (4.5), the soft glyphs at `CONTRAST_UI` (3). */
export const GROUND_INK_FLOOR: Record<GroundInkRole, number> = {
  ink: CONTRAST_BODY,
  muted: CONTRAST_BODY,
  soft: CONTRAST_UI,
  accent: CONTRAST_BODY,
};

/**
 * **Each seeded ground's colour**: its tile's measured mean (8 Sep and 9–10
 * Oct 2026), the same values as the stylesheet's `--theme-*` tokens — which
 * is also what shows before the picture arrives — and held equal to them by
 * `web/test/groundcontrast.test.ts`. A copy because the CLI has no
 * stylesheet. Galaxy paints `--theme-space`, mountains `--theme-rock`, desert
 * `--theme-sand`; the rest share their id.
 */
export const GROUND_MEAN: Record<CanvasTheme, string> = {
  galaxy: "#05060c",
  ocean: "#314852",
  mountains: "#2f2e28",
  farm: "#353423",
  desert: "#ab703b",
  meadow: "#223112",
  night: "#0a0d10",
  snow: "#cdd7ec",
  aurora: "#071214",
  pond: "#102625",
  zen: "#b5ac9a",
};

/**
 * **The brightest a picture can be**: a white image under `GROUND_SCRIM`'s
 * black, `255 × (1 − 0.7)` → `#4d4d4d`. Derived rather than written, so a
 * lighter scrim one day moves this with it. A picture's tone falls back to it
 * until the picture has been sampled, which is the worst case the scrim
 * guarantees anyway.
 *
 * `@__PURE__` because core sits in the entry chunk: a bare call at the top of
 * a module is a side effect the bundler must keep, and keeping it kept this
 * whole module and `textcolour.ts` behind it — 3,959 entry bytes measured on
 * 19 Oct, for a build that did not yet call any of it. Annotated, it is 0.
 */
export const BRIGHTEST_PICTURE: string = /* @__PURE__ */ brightest();

/** `BRIGHTEST_PICTURE`, worked out. */
function brightest(): string {
  return `#${Math.round(255 * (1 - GROUND_SCRIM)).toString(16).padStart(2, "0").repeat(3)}`;
}

/** Does every token of one ink family clear its floor on `ground`? */
function readsOn(ground: string, set: Record<GroundInkRole, string>): boolean {
  return (Object.keys(GROUND_INK_FLOOR) as GroundInkRole[]).every(
    (role) => (contrastRatio(set[role], ground) ?? 0) >= GROUND_INK_FLOOR[role],
  );
}

/**
 * The tone of a colour, decided by the ink sets rather than a luminance cut:
 * `dark` iff every on-dark token passes on it, else `light` iff every
 * on-light token does, else `mid`. So the tone can never say "dark" for a
 * ground the dark ink fails on — a 0.18-luminance threshold would have put
 * Ocean on the right side and still drawn `#8b929d` on it at 3.07.
 */
export function toneOfColour(hex: string): GroundTone {
  if (readsOn(hex, GROUND_INK.dark)) return "dark";
  if (readsOn(hex, GROUND_INK.light)) return "light";
  return "mid";
}

/**
 * The colour a canvas's chrome actually stands on: a picture's sampled mean
 * under the scrim (or `BRIGHTEST_PICTURE` until it is sampled), a seeded
 * ground's `GROUND_MEAN`, or — on the dot grid — the app's own ground, so a
 * canvas with no ground behaves exactly as it always has.
 */
export function groundColour(
  canvas: { properties?: Record<string, string> } | null,
  app: "light" | "dark",
  sampled?: string,
): string {
  if (canvas && groundOf(canvas) !== null) return sampled ?? BRIGHTEST_PICTURE;
  const theme = canvas ? themeOf(canvas) : null;
  return theme ? GROUND_MEAN[theme] : TEXT_SURFACES[app].ground;
}

/** The tone of the ground under a canvas's chrome: `toneOfColour` of
 *  `groundColour`. The one question the web's `data-ground-tone` and the
 *  CLI's description of a ground both ask. */
export function toneOfGround(
  canvas: { properties?: Record<string, string> } | null,
  app: "light" | "dark",
  sampled?: string,
): GroundTone {
  return toneOfColour(groundColour(canvas, app, sampled));
}

/** `#rrggbb` from three 0–255 channels. */
const hexOf = (rgb: number[]): string => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/**
 * **The ink that reads best on a ground no ink family holds** (smart
 * contrast phase 3, design §3) — what a `mid` ground draws where a plate
 * cannot go: a chromeless note's words, and the ring around a card.
 *
 * The candidates are the two sets' ink for the role, and for words pure white
 * and black too, because the decision on 19 Oct was "the higher ink", and on
 * Desert that is black: `#000000` 5.11, `#ffffff` 4.11, `#23262b` 3.70,
 * `#e7e9ec` 3.38. If even the best misses `floor`, it is walked toward the
 * pole on its own side until it clears — the nearest colour that does, rather
 * than one that does not. Desert's ring is the case: the light accent
 * `#18288a` measures 2.99 there, one hundredth short of `CONTRAST_UI`.
 */
export function bestInk(ground: string, role: GroundInkRole, floor: number = GROUND_INK_FLOOR[role]): string {
  const ratio = (c: string) => contrastRatio(c, ground) ?? 0;
  const candidates = [GROUND_INK.dark[role], GROUND_INK.light[role], ...(role === "ink" ? ["#ffffff", "#000000"] : [])];
  const best = candidates.reduce((a, b) => (ratio(b) > ratio(a) ? b : a));
  if (ratio(best) >= floor) return best;
  const pole = (luminance(best) ?? 0) > (luminance(ground) ?? 0) ? 255 : 0;
  const from = parseHex(best)!;
  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    const c = hexOf([from.r, from.g, from.b].map((v) => v + (pole - v) * t));
    if (ratio(c) >= floor) return c;
  }
  return hexOf([pole, pole, pole]);
}

/** The one-pixel halo behind `bestInk`'s words: the pole opposite the ink,
 *  white behind dark words and black behind light ones. WCAG does not count
 *  a halo; it is there for the busy patches of a ground, not for the ratio. */
export function haloOf(ink: string): string {
  return (luminance(ink) ?? 0) > 0.18 ? "#000000" : "#ffffff";
}
