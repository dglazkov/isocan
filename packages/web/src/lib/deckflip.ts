import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

/** Bare keys that flip the deck (#87). Forward and back each answer to three
 * keys because a presenter's clicker sends Page Up/Down, and because "left/
 * right (and up/down)" is how the ask was written: the deck is LINEAR, in
 * reading order, so both axes flip rather than up/down meaning something
 * spatial that would strand a presenter at the end of a row.
 *
 * Here rather than in `FullScreen`, because `Viewer` held a copy "kept in
 * step with it" by nothing (cleanup DU-1, 27 Sep 2026): the two faces of one
 * deck answer the same keys and rest on the same beat, so they read one. */
export const FLIP_NEXT: ReadonlySet<string> = new Set(["ArrowRight", "ArrowDown", "PageDown"]);
/** Back, the same three ways — see `FLIP_NEXT`. */
export const FLIP_PREV: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

/** Still for this long and the deck's chrome bows out, on both faces. Long
 *  enough that reading a slide does not dismiss it by accident, short enough
 *  to be gone by the second slide of a talk. */
export const REST_AFTER_MS = 2500;

/** A flip this soon after the last one is a cut, not a push. Somebody
 *  hammering → to reach slide 14 wants slide 14, not seven animations; the
 *  next press seconds later, mid-talk, gets the motion back. This one rule is
 *  what keeps the push from wearing out its welcome. */
const CUT_WITHIN_MS = 300;

/** Module-level rather than per-surface: there is one keyboard, and a flip is
 *  a flip whichever face of the deck answered it. */
let lastFlip = 0;

/**
 * Navigate to the next slide with a directional PUSH rather than a cut: the
 * new slide slides in from the side the key named, so the motion itself
 * answers "which way did I go". Shared by `FullScreen` and `Viewer` — the two
 * faces of the same deck (#87, #88) must flip the same way.
 *
 * The outgoing slide leaves as a view-transition snapshot — a painted image.
 * `data-flip` on the root tells the CSS which way this transition runs
 * (styles.css, "the deck flip"), and is removed when the transition settles.
 *
 * **A frame cannot be photographed, so a frame is never animated.** This is
 * the `framed` argument, and it is the whole reason it exists. A screen and a
 * site are sandboxed cross-origin iframes; a view transition captures the
 * page as an image, and what it captures THERE is a blank rectangle. Pushing
 * that across the screen is a white flash on every flip — reported from a
 * presentation, and unfixable by any amount of caching, because the frame was
 * loaded the whole time. It simply cannot be photographed. So a deck of
 * screens cuts, and a deck of images and text — which snapshot perfectly
 * well — still pushes.
 *
 * It also cuts when the browser has no view transitions (the flip still
 * works, minus the motion), when the person asked for reduced motion, or
 * within CUT_WITHIN_MS of the previous flip — see that constant.
 */
export function flipTo(
  navigate: NavigateFunction,
  path: string,
  dir: "next" | "prev",
  framed = false,
): void {
  const rapid = Date.now() - lastFlip < CUT_WITHIN_MS;
  lastFlip = Date.now();
  if (
    framed ||
    rapid ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigate(path);
    return;
  }
  document.documentElement.dataset.flip = dir;
  const push = document.startViewTransition(() => {
    // Synchronously, so the browser's before/after pair is old slide → new
    // slide rather than old slide → old slide.
    flushSync(() => navigate(path));
  });
  void push.finished.finally(() => {
    delete document.documentElement.dataset.flip;
  });
}
