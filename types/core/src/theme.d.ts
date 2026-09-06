import type { MetaPatch } from "./ops.js";
/**
 * **A canvas about sheep can look like a farm** (#195).
 *
 * A background under the work, so screens read as objects standing ON
 * something rather than floating on a dot grid — and you can group them into
 * pens, which is the actual request and the thing that decides the design.
 *
 * ## One property, not two
 *
 * A theme names both the ground and the cursor, and it is a single value
 * because "farm" is the fact. Two properties would let a canvas be a farm
 * with rockets, which is not a feature — it is a bug somebody has to explain.
 *
 * Like the post-it's `paper` and the archive's `shelved`, this is a property
 * on `project.update`'s `MetaPatch` rather than a new operation. The
 * vocabulary is a ratcheted bound (`op-types`, `at most: 33`) and a canvas
 * without the property is the dot grid, which is what every canvas is today —
 * so there is no migration and nothing to undo.
 *
 * ## Why these four, and why galaxy first
 *
 * Seeded rather than open so the picker has something in it on day one, and
 * so the art is a known set somebody can actually draw. **Galaxy is the one
 * to build first**: a starfield is GENERATED, so it tiles infinitely by
 * construction, costs no download, looks right at any zoom, and needs no
 * artist. It proves the mechanism the painted ones then follow.
 *
 * ## What a theme must not do
 *
 * Two bounds this project already measures, and a background is the obvious
 * way to break both:
 *
 * - **Legibility.** `contrast-failures` and `a11y-failures` are held on the
 *   front door and mean the same thing here: a markdown item over a grass
 *   field must still be readable, which is why every theme owes a scrim under
 *   content rather than only a picture.
 * - **The frame budget.** A ground that repaints on every pan spends exactly
 *   the frames the canvas needs to feel like a canvas.
 *
 * And one thing it must not take: the seven `IDENTITY_COLORS` are how you
 * tell people apart, and they land on items during remote selection. A themed
 * cursor wears the person's colour still. A sheep tinted with your colour is
 * delightful; a sheep that makes six people identical has deleted the only
 * signal that says who is who.
 */
export declare const THEME_PROP = "theme";
/** The seeded set. `none` is not a member — it is the absence of the
 *  property, so removing a theme leaves nothing behind. */
export declare const THEMES: readonly ["galaxy", "farm", "mountains", "ocean"];
/** One of the seeded grounds. Not a string: a canvas wearing a name nothing
 *  can draw is a blank screen with no way to explain itself. */
export type CanvasTheme = (typeof THEMES)[number];
/** Is this one of the grounds this build can draw — the parse both surfaces
 *  use, so the CLI refuses exactly what the app would not render. */
export declare function isTheme(value: string): value is CanvasTheme;
/** What this canvas is wearing, or null for the dot grid. An unknown value
 *  reads as null rather than as itself: a canvas written by a newer build
 *  than this one shows the ground it has always shown, instead of a blank. */
export declare function themeOf(canvas: {
    properties?: Record<string, string>;
}): CanvasTheme | null;
/** Wear one. */
export declare function themePatch(theme: CanvasTheme): MetaPatch;
/** Take it off — a removal, so a canvas with no theme is byte-for-byte a
 *  canvas that never had one. */
export declare function noThemePatch(): MetaPatch;
/** The next one along, for the control that flips through them. Wraps, and
 *  passing `null` starts at the first — so one button can go
 *  none → galaxy → farm → mountains → ocean → none. */
export declare function nextTheme(current: CanvasTheme | null): CanvasTheme | null;
