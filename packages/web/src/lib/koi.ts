/**
 * **The Pond's koi, as arithmetic a test can hold** (living grounds phase 4).
 *
 * > "the cursor drags ripples across still water, and a few koi drift away
 * > from it" — design.md, "Proposed next".
 *
 * A handful of fish is the one piece of the Pond that is real CPU state, so
 * it lives here as plain functions, like Night's fireflies. Two motions, kept
 * apart because the Motion setting treats them differently:
 *
 * - **Cruising** is ambient: each fish drifts and wanders at `ambient` × its
 *   speed, so under Calm (ambient 0) the koi hold still until somebody comes
 *   near, and as the ground settles they slow to a stop.
 * - **Fleeing** is the cursor's: a pointer that moved recently within
 *   `FLEE_PX` turns a fish away and gives it a burst of speed that dies away
 *   in a second or two. It holds under every Motion setting, and `stirred`
 *   says when it has died away, which is what lets the ground sleep.
 *
 * Everything is in ground space (world units); distances a person feels —
 * how near is "near" — are screen pixels, taken through the view's scale.
 */

/** One koi, in ground space. */
export interface Koi {
  x: number;
  y: number;
  /** Radians, 0 = +x; the direction the fish is facing and swimming. */
  heading: number;
  /** 0..1: how hard it is fleeing right now. */
  flee: number;
  /** Body length in world units. */
  size: number;
  /** Tail phase (radians), advanced faster the faster it swims. */
  tail: number;
  /** 0..1: which koi this is — its markings and its wander. */
  seed: number;
}

/** A pond holds this many. */
export const KOI_COUNT = 6;
/** Cruising speed at full ambient, world units per second. */
export const CRUISE = 22;
/** Top speed while fleeing, world units per second. */
export const DART = 150;
/** A cursor this near, in screen pixels, turns a fish away. */
export const FLEE_PX = 150;
/** A pointer counts as near only if it moved this recently (ms): a cursor
 *  parked over the pond is a rock the koi have got used to. */
export const FRESH_MS = 400;
/** How fast a fish's fright dies away, per second (exponential). */
const CALM_RATE = 2.4;
/** Below this the fright is over. */
const STIRRED = 0.02;

/** Something that may scare a koi: where, and whether it just moved. */
export interface Stir {
  x: number;
  y: number;
  fresh: boolean;
}

/** A rectangle in ground space. */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A small deterministic generator, so the same pond spawns the same koi. */
function lcg(seed: number): () => number {
  let s = (Math.floor(seed * 2147483646) % 2147483646) + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** `n` koi scattered across `bounds`, each its own size and markings. */
export function spawnKoi(n: number, bounds: Bounds, seed = 0.37): Koi[] {
  const r = lcg(seed);
  const out: Koi[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: bounds.x + bounds.w * (0.12 + 0.76 * r()),
      y: bounds.y + bounds.h * (0.12 + 0.76 * r()),
      heading: r() * Math.PI * 2,
      flee: 0,
      size: 30 + 22 * r(),
      tail: r() * Math.PI * 2,
      seed: (i + r()) / n,
    });
  }
  return out;
}

/** The signed smallest turn from `a` to `b`, in (−π, π]. */
export function turn(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Move every koi on by `dt` seconds. `clock` is the pond's eased ambient
 * clock (it drives the wander), `scale` the view's (screen px per world
 * unit), `bounds` the view in ground space — a fish that strays outside it
 * steers back, and one that has been left far behind by a pan is put back
 * at the edge, swimming in. `items` is packed x, y, w, h: stones the koi
 * swim round.
 */
export function swim(
  koi: Koi[],
  dt: number,
  ambient: number,
  clock: number,
  stirs: readonly Stir[],
  items: Float32Array,
  bounds: Bounds,
  scale: number,
): void {
  if (dt <= 0) return;
  const reach = FLEE_PX / Math.max(scale, 1e-6);
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const far = Math.hypot(bounds.w, bounds.h);
  for (const k of koi) {
    // Left far behind by a pan: back in at the nearest edge, facing in.
    if (Math.hypot(k.x - cx, k.y - cy) > far) {
      const a = Math.atan2(k.y - cy, k.x - cx);
      k.x = cx + Math.cos(a) * bounds.w * 0.55;
      k.y = cy + Math.sin(a) * bounds.h * 0.55;
      k.heading = a + Math.PI;
      k.flee = 0;
    }
    let steer = 0;
    // Wander: a slow weave, each fish its own — ambient, so none under Calm.
    steer += Math.sin(clock * (0.35 + 0.3 * k.seed) + k.seed * 17) * 0.55 * ambient;
    // Fright: away from every fresh cursor within reach, harder the nearer.
    for (const s of stirs) {
      if (!s.fresh) continue;
      const d = Math.hypot(k.x - s.x, k.y - s.y);
      if (d >= reach) continue;
      const u = 1 - d / reach;
      k.flee = Math.max(k.flee, u);
      steer += turn(k.heading, Math.atan2(k.y - s.y, k.x - s.x)) * 6 * u;
    }
    // Stones: round them, not through them — while it is swimming at all.
    const going = Math.max(ambient, k.flee);
    for (let i = 0; i + 3 < items.length; i += 4) {
      const x = items[i]!, y = items[i + 1]!, w = items[i + 2]!, h = items[i + 3]!;
      const m = k.size * 0.8;
      if (k.x < x - m || k.x > x + w + m || k.y < y - m || k.y > y + h + m) continue;
      steer += turn(k.heading, Math.atan2(k.y - (y + h / 2), k.x - (x + w / 2))) * 2.5 * going;
    }
    // Strayed out of view: home toward the middle, gently.
    const out = k.x < bounds.x || k.x > bounds.x + bounds.w || k.y < bounds.y || k.y > bounds.y + bounds.h;
    if (out) steer += turn(k.heading, Math.atan2(cy - k.y, cx - k.x)) * 1.2 * going;

    // A startled fish turns on the spot; a cruising one weaves.
    const most = 3 + 7 * k.flee;
    k.heading += Math.max(-most, Math.min(most, steer)) * dt;
    const speed = CRUISE * ambient + DART * k.flee;
    k.x += Math.cos(k.heading) * speed * dt;
    k.y += Math.sin(k.heading) * speed * dt;
    k.tail += dt * (1.5 * ambient + speed * 0.12);
    k.flee *= Math.exp(-dt * CALM_RATE);
    if (k.flee < STIRRED * 0.5) k.flee = 0;
  }
}

/** Is any koi still fleeing — the cursor's half of the pond still moving? */
export function stirred(koi: readonly Koi[]): boolean {
  return koi.some((k) => k.flee >= STIRRED);
}
