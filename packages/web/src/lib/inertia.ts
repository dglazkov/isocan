/**
 * **Pan inertia** (`docs/research/2026-08-28-motion.md`, recommendation 1).
 *
 * Dragging with the Hand tool or the middle button used to stop dead on
 * release. Every canvas people arrive from coasts, and on an infinite
 * canvas the alternative is drag-lift-drag-lift across open space. Trackpad
 * users already had momentum for free — the OS sends decaying wheel events
 * — so the people paying were mouse users and anyone on the Hand tool.
 *
 * The note's three conditions, each one a number here:
 * - **Gentle, and short.** The coast decays with a time constant of
 *   `DECAY_MS`, so it ends in a few hundred milliseconds and never carries
 *   across screens; a slow release below `MIN_FLICK` does not coast at all,
 *   because a hand that stopped meant to stop.
 * - **Interruptible.** The loop lives in the viewport, which cancels it on
 *   the next press or wheel; this file only does the arithmetic.
 * - **Reduced motion turns it off** — the caller checks the media query
 *   before starting one, and the note says why that is the honest cost.
 *
 * Pure functions, so the numbers can be tested without a browser.
 */

export interface Sample {
  t: number;
  x: number;
  y: number;
}

/** How far back the release looks to read the hand's speed. Older samples
 *  describe where the drag has been, not where it was going. */
export const FLICK_WINDOW_MS = 80;
/** Below this, px/ms, a release is a stop, not a flick. */
export const MIN_FLICK = 0.35;
/** Fastest coast honoured, px/ms — a wild throw still lands nearby. */
export const MAX_FLICK = 3;
/** Exponential decay's time constant: speed halves every ~0.7·DECAY_MS. */
export const DECAY_MS = 110;
/** The coast ends when it is slower than this, px/ms. */
export const REST = 0.02;

/**
 * The velocity at release, px/ms, from the last `FLICK_WINDOW_MS` of
 * samples — null when the hand was not moving fast enough to coast.
 */
export function flickVelocity(samples: readonly Sample[], now: number): { vx: number; vy: number } | null {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1]!;
  // A pointer that rested before lifting is a stop, however fast it was
  // earlier: the newest sample must be recent.
  if (now - last.t > FLICK_WINDOW_MS) return null;
  const first = samples.find((s) => last.t - s.t <= FLICK_WINDOW_MS) ?? samples[0]!;
  const dt = last.t - first.t;
  if (dt <= 0) return null;
  let vx = (last.x - first.x) / dt;
  let vy = (last.y - first.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed < MIN_FLICK) return null;
  if (speed > MAX_FLICK) {
    vx *= MAX_FLICK / speed;
    vy *= MAX_FLICK / speed;
  }
  return { vx, vy };
}

/**
 * One frame of coasting: how far to move over `dtMs`, and the velocity
 * left afterwards. Integrates the exponential exactly, so a slow frame
 * (a busy tab) covers the same ground as several quick ones.
 */
export function coastFrame(
  v: { vx: number; vy: number },
  dtMs: number,
): { dx: number; dy: number; next: { vx: number; vy: number }; done: boolean } {
  const k = Math.exp(-dtMs / DECAY_MS);
  // ∫ v·e^(-t/τ) dt from 0 to dt = v·τ·(1 − e^(−dt/τ))
  const travel = DECAY_MS * (1 - k);
  const next = { vx: v.vx * k, vy: v.vy * k };
  return { dx: v.vx * travel, dy: v.vy * travel, next, done: Math.hypot(next.vx, next.vy) < REST };
}

/** The whole distance a flick will travel, for a reader deciding whether
 *  a number is gentle: v·τ. At MAX_FLICK that is 330px. */
export function coastDistance(speed: number): number {
  return speed * DECAY_MS;
}
