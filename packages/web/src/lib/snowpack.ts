/**
 * **Snow's memory, as arithmetic a test can hold** (living grounds phase 4).
 *
 * > "fresh snow the cursor leaves footprints in; flakes fall slowly, swirling
 * > around a fast-moving cursor" (design.md, the proposed grounds)
 *
 * Snow is the first ground whose trail outlives the host's. The host's trail
 * fades in about 1.4 s (Meadow's grass lifting back up); a footprint in snow
 * does not lift — it fills back in, slowly, and only while the ground is
 * awake. So `snow.ts` keeps a pack texture of its own beside the host's trail:
 * each frame it takes the deepest of what it held and what the trail just
 * pressed, and fills back in by `FILL_RATE`. Asleep, nothing runs and nothing
 * fills, so a trail walked an hour ago is still there the next time anybody
 * moves — and gone after about 20 s of awake time in all.
 *
 * The pack is an 8-bit texture (any WebGL2 can render into one; a float one
 * needs an extension), and at 60 fps a frame's fill is a fifth of one 8-bit
 * step — it would round to nothing, and the snow would never fill. So the
 * fill is accumulated here and handed to the shader in whole steps.
 */

/** How fast a trodden trail fills back in, depth (0..1) per AWAKE second: a
 *  fresh print is gone after about 20 s of the ground being awake. */
export const FILL_RATE = 0.05;
/** One step of the 8-bit pack. */
export const PACK_STEP = 1 / 255;

/**
 * This frame's fill, in whole pack steps, and the remainder to carry: the
 * fill a frame of `dt` seconds owes is added to `carry`, and only whole steps
 * leave it, so a slow fill is exact over time at any frame rate.
 */
export function fillSteps(carry: number, dt: number, rate = FILL_RATE): { fill: number; carry: number } {
  const owed = carry + Math.max(0, dt) * rate;
  const steps = Math.floor(owed / PACK_STEP + 1e-9);
  return { fill: steps * PACK_STEP, carry: owed - steps * PACK_STEP };
}

/** How deep a fresh host trail value presses the pack: the host's stamp is a
 *  soft disc 40 px across its edge, and a footprint is narrower and firmer,
 *  so only its core counts. Mirrors the pack shader's `smoothstep`. */
export function pressOf(trail: number): number {
  const t = Math.min(1, Math.max(0, (trail - 0.3) / (0.75 - 0.3)));
  return t * t * (3 - 2 * t);
}

/** The pack after one frame at one texel: filled back by `fill`, then pressed
 *  to at least what the trail says now. */
export function packNext(prev: number, trail: number, fill: number): number {
  return Math.max(Math.max(prev - fill, 0), pressOf(trail));
}

/** A cursor moving faster than this (screen px/s) stirs the falling flakes at all… */
const GUST_FROM = 250;
/** …and at this speed stirs them fully. */
const GUST_FULL = 1400;
/** How fast a gust eases toward its target, per second — about a second to settle. */
const GUST_RATE = 2.5;

/** The gust a pointer stirs: 0 until it moves fast, 1 at `GUST_FULL`, and 0
 *  once it has not moved for `ACTIVE_MS` (passed as `recent`). */
export function gustTarget(speedPx: number, recent: boolean): number {
  if (!recent) return 0;
  return Math.min(1, Math.max(0, (speedPx - GUST_FROM) / (GUST_FULL - GUST_FROM)));
}

/** One frame of a gust easing toward `target`; under 0.01 it is over. */
export function easeGust(gust: number, target: number, dt: number): number {
  const g = gust + (target - gust) * (1 - Math.exp(-dt * GUST_RATE));
  return g < 0.01 && target === 0 ? 0 : g;
}
