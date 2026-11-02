/**
 * The zoom rule as a ramp — the fourth of the four (#203, phase 1).
 *
 * `holdsAtZoom` in `zoomrule.ts` answers "is this big enough on screen?" with
 * a memory, because a yes/no that flips on the exact pixel flickers. A fade
 * has no edge to sit on, so it needs no memory — but it is the same idea, the
 * canvas going quiet as you stand back, and it lives in core beside the rule
 * so that "what changes with zoom" is one place to look. A separate file only
 * so the bundler can leave it in the theme chunk that uses it.
 */

/** 0 at or below `gone`, 1 at or above `full`, linear between. */
export function zoomFade(scale: number, gone: number, full: number): number {
  return Math.max(0, Math.min(1, (scale - gone) / (full - gone)));
}
