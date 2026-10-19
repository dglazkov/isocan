import type { TEXT_COLOURS } from "./textnode.js";
import { type CanvasTheme } from "./theme.js";
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
export declare const GROUND_INK: Record<"dark" | "light", Record<GroundInkRole, string>>;
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
export declare const GROUND_TEXT_SHADES: Record<(typeof TEXT_COLOURS)[number], string>;
/** The contrast each role must clear on a ground of its side: text at
 *  `CONTRAST_BODY` (4.5), the soft glyphs at `CONTRAST_UI` (3). */
export declare const GROUND_INK_FLOOR: Record<GroundInkRole, number>;
/**
 * **Each seeded ground's colour**: its tile's measured mean (8 Sep and 9–10
 * Oct 2026), the same values as the stylesheet's `--theme-*` tokens — which
 * is also what shows before the picture arrives — and held equal to them by
 * `web/test/groundcontrast.test.ts`. A copy because the CLI has no
 * stylesheet. Galaxy paints `--theme-space`, mountains `--theme-rock`, desert
 * `--theme-sand`; the rest share their id.
 */
export declare const GROUND_MEAN: Record<CanvasTheme, string>;
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
export declare const BRIGHTEST_PICTURE: string;
/**
 * The tone of a colour, decided by the ink sets rather than a luminance cut:
 * `dark` iff every on-dark token passes on it, else `light` iff every
 * on-light token does, else `mid`. So the tone can never say "dark" for a
 * ground the dark ink fails on — a 0.18-luminance threshold would have put
 * Ocean on the right side and still drawn `#8b929d` on it at 3.07.
 */
export declare function toneOfColour(hex: string): GroundTone;
/**
 * The colour a canvas's chrome actually stands on: a picture's sampled mean
 * under the scrim (or `BRIGHTEST_PICTURE` until it is sampled), a seeded
 * ground's `GROUND_MEAN`, or — on the dot grid — the app's own ground, so a
 * canvas with no ground behaves exactly as it always has.
 */
export declare function groundColour(canvas: {
    properties?: Record<string, string>;
} | null, app: "light" | "dark", sampled?: string): string;
/** The tone of the ground under a canvas's chrome: `toneOfColour` of
 *  `groundColour`. The one question the web's `data-ground-tone` and the
 *  CLI's description of a ground both ask. */
export declare function toneOfGround(canvas: {
    properties?: Record<string, string>;
} | null, app: "light" | "dark", sampled?: string): GroundTone;
