/**
 * **One rule for everything the canvas draws differently as you stand back**
 * (#203, phase 1 of `docs/research/2026-09-07-semantic-zoom.md`).
 *
 * Four things change with zoom, and they were written as four thresholds in
 * three files: a text node's words become a mark (`textIsLegible`), an item's
 * name and badge go (`hasRoomForChrome`), the row under an item abbreviates
 * (`underRowSpellsItOut`), and the galaxy ground fades. The first three are
 * the same question — *is this thing at least N pixels on YOUR screen?* — and
 * the fourth is the same question asked as a ramp. So they all ask it here,
 * which is what makes "a sheet draws its name" (phase 2) one more caller
 * rather than a fifth rule.
 *
 * **The rule has memory, and that is the fix it carries (D6: nothing pops).**
 * A cut that flips on the exact pixel flickers when somebody rests at that
 * zoom: a trackpad settling, a pinch that ends a hair either side, a resize
 * crossing the line — each wobble of a fraction of a pixel took the chrome
 * away and gave it back, and remounted an item's preview with it. With
 * hysteresis the two directions have different cuts: a thing SHOWING keeps
 * showing down to the threshold, and a thing HIDDEN comes back only once it
 * clears the threshold by a tenth. Inside that band nothing changes, whichever
 * way the wobble goes.
 *
 * The band sits ABOVE the threshold rather than around it on purpose. Every
 * threshold here is a floor somebody measured — `FULL_LABEL_ROOM` is where the
 * spelled-out row stops overflowing its item — so a thing must never be shown
 * below it. Going down is exactly today's rule; only coming back up waits.
 *
 * No history (`was` undefined — a first render) is today's rule too, so an
 * item mounted at a zoom decides exactly as it always did.
 */
/**
 * Is a thing `onScreen` pixels big enough for what `threshold` guards, given
 * what it was last time it was asked (`was`)? Callers keep `was` per thing —
 * per item, never globally (D2: rungs are per-thing, from screen size).
 *
 * The band is the `1.1`: a hidden thing comes back at 110% of its threshold,
 * so 5px words wait for 5.5 and a 56px card for 61.6. Wide enough to swallow a
 * settling trackpad; narrow enough that nobody zooming in on purpose notices
 * the wait. Written as a literal rather than a named constant because this
 * function ships in the entry chunk, which is budgeted to the byte.
 */
export declare function holdsAtZoom(onScreen: number, threshold: number, was?: boolean): boolean;
