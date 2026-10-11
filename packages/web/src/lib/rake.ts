import type { Viewport } from "./viewport.ts";

/**
 * **A ground that remembers where it was touched** (living grounds phase 4:
 * Pond and Zen garden), as arithmetic a test can hold.
 *
 * Pond's ripples and the Zen garden's rake lines are state the GPU keeps in a
 * square texture laid over the ground around the view. Two questions decide
 * whether that state survives a pan and whether a raked line looks raked, and
 * both are answered here in plain numbers; `pond.ts` and `zen.ts` say the
 * same thing in GLSL.
 */

/**
 * **Where a ground's state texture sits in ground space** — centred on the
 * view, at least `margin` times its larger side, `n` texels a side, with a
 * texel size that is a power of two and an origin snapped to whole texels.
 * The trail's rule (`trailRect`), with its own resolution: panning moves the
 * texture by whole texels, so a ripple or a raked line is copied across a pan
 * exactly rather than blurred, and only a zoom across a power of two
 * resamples it.
 */
export function simRect(view: Viewport, screenW: number, screenH: number, n: number, margin = 1.2): { x: number; y: number; size: number; texel: number } {
  const span = (Math.max(screenW, screenH, 1) / view.scale) * margin;
  const texel = 2 ** Math.ceil(Math.log2(Math.max(span / n, 1e-6)));
  const size = texel * n;
  const cx = (screenW / 2 - view.tx) / view.scale;
  const cy = (screenH / 2 - view.ty) / view.scale;
  return {
    x: Math.floor((cx - size / 2) / texel) * texel,
    y: Math.floor((cy - size / 2) / texel) * texel,
    size,
    texel,
  };
}

/** World units between two tines of the rake — and between the lines of the
 *  garden's base pattern, so a raked patch and an unraked one are the same
 *  sand at the same grain. Divides the Zen garden's `TILE`. */
export const TINE = 8;
/** Half the rake's width, in world units: seven tines. */
export const RAKE_R = 28;
/** How long a raked line takes to soften back into the base pattern, in
 *  seconds of AWAKE time (the host's eased envelope). Asleep, nothing softens
 *  — so the softening never keeps a ground awake, and a canvas left alone
 *  keeps its lines until somebody comes back. */
export const SOFTEN_S = 20;

/**
 * **Where a point sits across one stroke of the rake** — its signed distance
 * from the segment `a → b`, + on the left of the direction of travel, or
 * `null` when the stroke does not own the point: farther than `RAKE_R`, or
 * BEHIND `a`. The tines draw lines at a constant offset, so a groove is the
 * set of points at one offset; owning only what is level with or ahead of
 * `a` is what keeps each new short segment of a path from stamping a fan of
 * rings round its starting point over the lines the last one drew. Ahead of
 * `b` it owns a half-disc (the offset is the distance from `b`, signed by
 * side): the end of a stroke, where the rake was lifted, is rounded, and on
 * the outside of a turn the next segment continues the same fan.
 */
export function rakeOffset(px: number, py: number, ax: number, ay: number, bx: number, by: number, r = RAKE_R): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return null;
  const qx = px - ax;
  const qy = py - ay;
  const along = qx * dx + qy * dy;
  if (along < 0) return null;
  const h = Math.min(1, along / l2);
  const ex = qx - dx * h;
  const ey = qy - dy * h;
  const dist = Math.hypot(ex, ey);
  if (dist >= r) return null;
  const side = dx * qy - dy * qx >= 0 ? 1 : -1;
  return side * dist;
}

/** How raked a line still is, 1 → 0, `age` seconds of awake time after the
 *  rake passed — linear, so "about 20 s" is exactly 20 s. */
export function rakeStrength(age: number): number {
  return Math.min(1, Math.max(0, 1 - age / SOFTEN_S));
}

/** The outer tines press lighter: the rake's mark fades over its last
 *  quarter, so a stroke's edge is a soft shoulder rather than a cut. */
export function rakeEdge(offset: number, r = RAKE_R): number {
  const t = Math.min(1, Math.max(0, (Math.abs(offset) - 0.75 * r) / (0.25 * r)));
  return 1 - t * t * (3 - 2 * t);
}
