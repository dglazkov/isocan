/**
 * **Below 460px the minimap is folded by the width, and the width decides
 * nothing else** (#182 stage 0).
 *
 * The mobile note asked for the map to FOLD on a phone, and the first fix
 * stacked it above the zoom row instead, because folding meant calling the
 * setter that writes `isocan.minimap` — a width deciding a PREFERENCE, which
 * would then follow the person to their desktop as a setting they never chose.
 * The objection was right and the conclusion was not: the fold and the
 * preference were one boolean, and the answer is to make them two.
 *
 * So there are three facts, and only one is ever stored:
 *
 * - **`kept`** — what the person chose on a window wide enough for the map.
 *   Read from and written to `isocan.minimap`, as it always was.
 * - **`narrow`** — whether the window is at or below `NARROW_MINIMAP_PX` now.
 *   A measurement, re-read on every change of the media query, never stored.
 * - **`narrowOpen`** — what the person chose while the window was narrow.
 *   Starts folded, **held for this visit and never written.**
 *
 * What is drawn is `narrowOpen` on a narrow window and `kept` on a wide one.
 *
 * **Why an unfold on a phone does not persist.** It could be written — to
 * `isocan.minimap`, which is the original failure run backwards (a phone's
 * unfold turning the desktop's fold off), or to a second narrow-only key.
 * The second is defensible and still wrong for now: the phone face is going
 * to be Chat-first (decided 11 Sep), which changes what a phone shows before
 * the canvas at all, and a remembered narrow-window minimap preference would
 * be a setting minted for a layout about to be replaced. Held for the visit,
 * the person who wants the map on a phone taps once and has it until they
 * leave; the next visit starts folded, which is the width's default doing its
 * job. Nothing is stored that the phone face would have to migrate.
 *
 * Pure, so the rule can be tested without a browser, and in its own file so
 * the store and the sheet can both be held to the one number.
 */

/**
 * The width at and below which the map folds. Arithmetic rather than a phone:
 * the map's right edge is 20 + 168 = 188 and the zoom row's left edge is
 * `width - 20 - its own width`, so they meet around 405 — around, because the
 * row is as wide as the percentage it shows. 460 clears the widest reading
 * with 51 measured pixels to spare. The stylesheet's `@media (max-width:
 * 460px)` is the same number, and `minimapnarrow.test.ts` holds them together.
 */
export const NARROW_MINIMAP_PX = 460;
/** The same number as a media query — what the Minimap watches and the store
 *  reads at creation, so the width is asked one way everywhere. */
export const NARROW_MINIMAP_QUERY = `(max-width: ${NARROW_MINIMAP_PX}px)`;

/** The three facts the drawn state is derived from; only `kept` is stored. */
export interface MinimapFold {
  /** The stored preference, from a window wide enough for the map. */
  kept: boolean;
  /** Whether the window is narrow now. Measured, never stored. */
  narrow: boolean;
  /** The person's choice while narrow, for this visit. Never stored. */
  narrowOpen: boolean;
}

/** Whether the map is drawn open. */
export function minimapShown(fold: MinimapFold): boolean {
  return fold.narrow ? fold.narrowOpen : fold.kept;
}

/**
 * A person folding or unfolding the map — the handle, the fold control, ⌘K's
 * row, the drawer's row. `store` says whether it is a preference to write:
 * only on a wide window, because only there is `kept` the thing being chosen.
 */
export function chooseMinimap(fold: MinimapFold, open: boolean): { fold: MinimapFold; store: boolean } {
  return fold.narrow
    ? { fold: { ...fold, narrowOpen: open }, store: false }
    : { fold: { ...fold, kept: open }, store: true };
}

/** The window's width, as the media query reads it, where there is a window. */
export function narrowNow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(NARROW_MINIMAP_QUERY).matches
  );
}
