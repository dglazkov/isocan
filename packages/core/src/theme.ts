import type { MetaPatch } from "./ops.ts";

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
export const THEME_PROP = "theme";

/**
 * The grounds this build can actually draw. `none` is not a member — it is the
 * absence of the property, so removing a theme leaves nothing behind.
 *
 * **Farm is deliberately not here yet**, and that is the rule rather than an
 * omission: a canvas wearing a name nothing can draw shows the dot grid with
 * no way to explain itself, and cycling through the picker would hit a step
 * that appears to do nothing. Grass and hedgerows read as DRAWN in a way
 * procedural texture does not, so farm waits for artwork — and adding it is
 * this list plus a component, with nothing else to change (#195, 6 Sep).
 */
export const THEMES = ["galaxy", "ocean", "mountains"] as const;

/** One of the seeded grounds. Not a string: a canvas wearing a name nothing
 *  can draw is a blank screen with no way to explain itself. */
export type CanvasTheme = (typeof THEMES)[number];

/**
 * **What a ground is called where a person picks it.**
 *
 * The ids are the interface — `isocan canvas background galaxy` takes one, and
 * an id is what the canvas stores — but an id is not a name, and a menu that
 * says "galaxy" is a menu showing you its variable. So the labels live here
 * beside the ids rather than in the component that happens to need them first,
 * for the reason every other label fold in this package exists: the day a
 * second surface offers this, "galaxy" must not become two different words.
 *
 * `Space Galaxy` is Dion's, 7 Sep. The other two are plain on purpose — a
 * ground is a backdrop, and a menu of poetic names is a menu you have to
 * decode before you can choose.
 */
export function themeLabel(theme: CanvasTheme): string {
  switch (theme) {
    case "galaxy":
      return "Space Galaxy";
    case "ocean":
      return "Ocean";
    case "mountains":
      return "Mountains";
  }
}

/** Is this one of the grounds this build can draw — the parse both surfaces
 *  use, so the CLI refuses exactly what the app would not render. */
export function isTheme(value: string): value is CanvasTheme {
  return (THEMES as readonly string[]).includes(value);
}

/** What this canvas is wearing, or null for the dot grid. An unknown value
 *  reads as null rather than as itself: a canvas written by a newer build
 *  than this one shows the ground it has always shown, instead of a blank. */
export function themeOf(canvas: { properties?: Record<string, string> }): CanvasTheme | null {
  const value = canvas.properties?.[THEME_PROP];
  return value !== undefined && isTheme(value) ? value : null;
}

/**
 * **Two ways for a ground to behave, and they are different pictures.**
 *
 * `world` — the ground is part of the canvas. It pans and zooms with the
 * items, so a field stays under the sheep standing in it and a pen is
 * somewhere you can come back to. This is the default and the reason the
 * layer is in world space at all.
 *
 * `window` — the ground is a backdrop behind the glass. Items travel across
 * a sky that does not move, which is the other thing people mean by a
 * background, and it is the better one for a canvas whose ground is
 * atmosphere rather than a place.
 *
 * **The dot grid comes back for `window`**, and that is the point rather than
 * a side effect: with a fixed backdrop the only thing left saying where you
 * are is the grid, so hiding it would take away the last spatial reference at
 * the exact moment the ground stopped providing one. Under `world` the ground
 * IS the reference, so the grid would be a second one arguing with it.
 *
 * Absent means `world`, so every canvas already wearing a ground keeps
 * behaving exactly as it did.
 */
export const THEME_ANCHOR_PROP = "themeAnchor";

/** Where a ground is pinned: to the canvas, or to the window. */
export type ThemeAnchor = "world" | "window";

/** How this canvas's ground behaves. Anything unrecognised reads as `world`,
 *  which is the behaviour every themed canvas has had. */
export function anchorOf(canvas: { properties?: Record<string, string> }): ThemeAnchor {
  return canvas.properties?.[THEME_ANCHOR_PROP] === "window" ? "window" : "world";
}

/** Pin it to the window, or let it travel with the canvas. `world` REMOVES
 *  the property rather than writing the default, so the common case leaves
 *  nothing behind to read. */
export function anchorPatch(anchor: ThemeAnchor): MetaPatch {
  return anchor === "window"
    ? { properties: { [THEME_ANCHOR_PROP]: "window" } }
    : { removeProperties: [THEME_ANCHOR_PROP] };
}

/** Wear one. */
export function themePatch(theme: CanvasTheme): MetaPatch {
  return { properties: { [THEME_PROP]: theme } };
}

/** Take it off — a removal, so a canvas with no theme is byte-for-byte a
 *  canvas that never had one. */
export function noThemePatch(): MetaPatch {
  return { removeProperties: [THEME_PROP] };
}


/**
 * **The cursor a ground gives everybody** — the other half of #195, and the
 * half its own title names: *"a background you can stand screens on, and a
 * cursor that belongs to it"*. Built 7 Sep, after Dion noticed it missing:
 * *"the cursors also haven't changed? Eg for space galaxy they didn't change
 * to a rocket."*
 *
 * One property still, not two. The theme IS the fact — a canvas cannot be a
 * galaxy with a sheep, because "two properties would let a canvas be a farm
 * with rockets, which is not a feature, it is a bug somebody has to explain".
 *
 * ## The shape is drawn, the colour is not
 *
 * Every path here is filled with the ACTOR'S colour by the caller, and that is
 * the constraint the issue is emphatic about: seven `IDENTITY_COLORS` also
 * land on items during remote selection, so a themed cursor that carried its
 * own colour would delete the one signal saying who is who. A fish tinted with
 * your colour is delightful; a fish that makes six people identical is a
 * regression dressed as a feature.
 *
 * ## Why not a rocket
 *
 * The issue suggests one, and it does not survive. Drawn and looked at: at 18
 * pixels a rocket silhouette IS an arrow — the fins never register, and both
 * candidates read as a slightly ragged pointer at every size up to 32. A
 * sparkle does read, instantly and at every size, and its long upper-left ray
 * is a proper pointer tip rather than a compromise. Space, and a cursor, in
 * one shape.
 *
 * The three that ship are the three that survived being looked at; `farm`
 * would want a sheep and wants the same artist its grass does.
 */
export function themeCursor(theme: CanvasTheme | null): string {
  switch (theme) {
    case "galaxy":
      // A four-point star whose upper-left ray is long enough to point with.
      return "M1.5 0.5 C6 6 7.5 7.5 13 10.5 C8.5 11.8 7.2 13 5.5 19 C4.6 13.4 3.4 11.8 0.6 10.2 C3.6 8.2 4.8 6.2 1.5 0.5 Z";
    case "ocean":
      // Nose at the hotspot, tail behind — it swims the way the pointer points.
      return "M1.5 0.5 C8 3 13 8 14.5 13.5 C10 14.5 5 12 1.8 7.5 Z M13.5 13 L17.5 12 L16 17 Z";
    case "mountains":
      // A summit flag: the pole's top is the tip, which is the one shape here
      // that was legible at 18px on the first try.
      return "M1.5 0.5 L3.1 0.9 L3.1 19 L1.5 19 Z M3.6 1.4 L13.5 4.6 L3.6 9.2 Z";
    default:
      // No ground, no costume. The arrow every cursor here has always been.
      return "M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z";
  }
}