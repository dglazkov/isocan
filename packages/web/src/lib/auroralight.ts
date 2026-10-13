/**
 * **Aurora's answer to a cursor, as arithmetic a test can hold** (living
 * grounds phase 4).
 *
 * > "ribbons of light over a dark landscape that lean toward the cursor"
 * > (design.md, the proposed grounds)
 *
 * Each pointer carries an energy that rises while it moves and ebbs once it
 * stops; the ribbons over a screen column lean and brighten by `leanAt`, the
 * sum of those energies under a gaussian in x. The shader reads the same
 * energies as uniforms, so this is the picture's own number, not a second
 * guess at it — and an item under a lit column catches a faint cool light,
 * `itemLight`, written through Night's `glowWrite` (only on a change).
 *
 * The energy is not ambient motion: it is the cursor's reaction, so it runs
 * under Calm too, and it ebbs to nothing within the sleep cap, so an aurora
 * nobody touches settles exactly as any ground does.
 */

/** How wide a cursor's lean reaches across the sky, screen px (one sigma). */
export const LEAN_SIGMA = 160;
/** How fast a moving pointer's energy rises, per second… */
const RISE_RATE = 4;
/** …and how fast it ebbs once the pointer stops: under 0.01 in about 2.3 s,
 *  inside the host's 3 s settle cap. */
export const EBB_RATE = 2;
/** The brightest light an item catches. */
const LIGHT_MAX = 0.5;

/** A pointer's energy one frame on: toward its weight while it moved in the
 *  last `ACTIVE_MS` (`recent`), toward 0 otherwise; under 0.01 it is gone. */
export function easeEnergy(e: number, recent: boolean, weight: number, dt: number): number {
  const target = recent ? weight : 0;
  const rate = target > e ? RISE_RATE : EBB_RATE;
  const next = e + (target - e) * (1 - Math.exp(-dt * rate));
  return next < 0.01 && target === 0 ? 0 : next;
}

/** One pointer's reach on screen: its column and its energy. */
export interface Lean {
  x: number;
  e: number;
}

/** How much the ribbons over screen column `x` lean and brighten, 0..~1. */
export function leanAt(x: number, leans: readonly Lean[]): number {
  let g = 0;
  for (const l of leans) {
    const d = x - l.x;
    g += l.e * Math.exp(-(d * d) / (2 * LEAN_SIGMA * LEAN_SIGMA));
  }
  return g;
}

/** The cool light an item's screen rect catches from the lit ribbons above
 *  it: the lean over the nearest point of its span, so a wide card under a
 *  cursor catches it even when its centre is a way off. */
export function itemLight(x: number, w: number, leans: readonly Lean[]): number {
  let best = 0;
  for (const l of leans) {
    const nx = Math.min(Math.max(l.x, x), x + w);
    best = Math.max(best, leanAt(nx, leans));
  }
  return Math.min(LIGHT_MAX, best * 0.45);
}
