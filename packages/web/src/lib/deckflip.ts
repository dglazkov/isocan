import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

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
 * The outgoing slide leaves as a view-transition snapshot — a painted image —
 * which is the only honest way to animate it: a slide is a live iframe, and
 * keeping a second one mounted to cross-fade would run its scripts twice and
 * reload it in view. `data-flip` on the root tells the CSS which way this
 * transition runs (styles.css, "the deck flip"), and is removed when the
 * transition settles.
 *
 * It cuts instead when the browser has no view transitions (the flip still
 * works, minus the motion), when the person asked for reduced motion, or
 * within CUT_WITHIN_MS of the previous flip — see that constant.
 */
export function flipTo(navigate: NavigateFunction, path: string, dir: "next" | "prev"): void {
  const rapid = Date.now() - lastFlip < CUT_WITHIN_MS;
  lastFlip = Date.now();
  if (
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
