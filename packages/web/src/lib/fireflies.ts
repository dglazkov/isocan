/**
 * **Night's fireflies, as arithmetic a test can hold** (living grounds
 * phase 3, journey.md scene 4).
 *
 * > "Where it passes, a few more fireflies lift out of the grass, drift up
 * > and wander off, blinking, then fade after a while."
 *
 * The swarm is the one piece of a living ground that is real CPU state, so it
 * lives here as plain functions: spawning along a pointer's path, drifting and
 * ageing, how bright one is this frame, and how much warm light an item
 * catches. `night.ts` only calls these and draws what they say.
 *
 * Time here is the ground's EASED time: `night.ts` advances the swarm by
 * `dt × ambient`, so as the host settles and ambient eases to zero the swarm
 * slows to a stop and fades rather than freezing mid-flight — and once it is
 * dark the swarm is dropped, so a sleeping canvas holds no hidden state.
 * Ported from the bench (`prototype/index.html`), numbers unchanged.
 */

/** One woken firefly, in ground space. */
export interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived (eased time), and how many it gets: 5–10. */
  age: number;
  life: number;
  /** Blink phase and rate, and a seed for its wander. */
  ph: number;
  rate: number;
  seed: number;
}

/** A moving pointer wakes a chance at one firefly every this many SCREEN
 *  pixels it travels — felt on screen, so zoom does not change the swarm. */
export const SPAWN_PX = 16;
/** The chance each of those wakes one. */
const SPAWN_CHANCE = 0.6;
/** The most woken fireflies at once (the bench's ×1 density). */
export const FLY_CAP = 120;
/** A firefly's life, seconds: 5 plus up to 5 more. */
export const LIFE_MIN = 5;
/** How much longer than LIFE_MIN a firefly may live, seconds (drawn at random). */
export const LIFE_SPAN = 5;
/** Fade in and out, seconds. */
const FADE_IN = 0.4;
const FADE_OUT = 1.8;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * A pointer moved from `from` to `to` (ground space), `distPx` screen pixels.
 * Wakes fireflies along the segment out of the grass just below it, into
 * `flies`, and returns the leftover distance to carry to the next frame.
 */
export function wake(
  flies: Fly[],
  carried: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  distPx: number,
  scale: number,
  rand: () => number = Math.random,
  cap = FLY_CAP,
): number {
  let a = carried + Math.max(0, distPx);
  while (a > SPAWN_PX) {
    a -= SPAWN_PX;
    if (rand() < SPAWN_CHANCE && flies.length < cap) {
      const k = rand();
      flies.push({
        x: from.x + (to.x - from.x) * k + ((rand() - 0.5) * 34) / scale,
        y: from.y + (to.y - from.y) * k + (8 + rand() * 16) / scale,
        vx: ((rand() - 0.5) * 20) / scale,
        vy: (-14 - rand() * 18) / scale,
        age: 0,
        life: LIFE_MIN + rand() * LIFE_SPAN,
        ph: rand() * 6.28,
        rate: 1.1 + rand() * 1.3,
        seed: rand() * 100,
      });
    }
  }
  return a;
}

/**
 * Advance the swarm by `dt` seconds of eased time: each one ages, wanders
 * (drifting up on the whole) and, past its life, is gone. Returns the
 * survivors; mutates the ones it keeps.
 */
export function drift(flies: readonly Fly[], dt: number, scale: number): Fly[] {
  const out: Fly[] = [];
  for (const q of flies) {
    q.age += dt;
    if (q.age >= q.life) continue;
    const wx = Math.sin(q.age * 0.9 + q.seed) * 22;
    const wy = Math.cos(q.age * 0.7 + q.seed * 1.7) * 10 - 12;
    q.vx += (wx / scale - q.vx) * Math.min(1, dt * 1.2);
    q.vy += (wy / scale - q.vy) * Math.min(1, dt * 1.2);
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    out.push(q);
  }
  return out;
}

/** How bright one firefly is now, 0..1: faded in, blinking, faded out near
 *  the end of its life, and all of it times the ground's ambient. */
export function flyLight(q: Fly, ambient: number): number {
  const life = smooth(q.age / FADE_IN) * (1 - smooth((q.age - (q.life - FADE_OUT)) / FADE_OUT));
  const blink = 0.18 + 0.82 * Math.max(0, Math.sin(q.age * q.rate + q.ph)) ** 6;
  return life * blink * ambient;
}

/** A pointer's own firefly: dim at rest, brighter the faster it goes. The
 *  target a ground eases toward. */
export function pointerGlowTarget(speedPx: number): number {
  return 0.32 + 0.68 * Math.min(1, Math.max(0, speedPx / 520));
}

/** A light on screen: CSS px, and its intensity. */
export interface Light {
  x: number;
  y: number;
  i: number;
}

/** How far (screen px) a light can reach an item at all; past it the glow is
 *  under a hundredth and an item is not even looked at. */
export const GLOW_REACH_PX = 300;
/** The brightest an item gets. */
const GLOW_MAX = 0.55;

/** The warm light an item's screen rect `[x, y, w, h]` catches from `lights`:
 *  0 when every light is out of reach. */
export function itemGlow(x: number, y: number, w: number, h: number, lights: readonly Light[]): number {
  let g = 0;
  for (const l of lights) {
    const dx = Math.max(x - l.x, 0, l.x - (x + w));
    const dy = Math.max(y - l.y, 0, l.y - (y + h));
    const d = Math.hypot(dx, dy);
    if (d > GLOW_REACH_PX) continue;
    g += l.i * Math.exp(-d / 70);
  }
  return Math.min(GLOW_MAX, g * 0.3);
}

/** A glow is written to the item only when it moves by more than this. */
export const GLOW_STEP = 0.02;

/**
 * **Only on change.** What to write to an item whose last written glow was
 * `prev`, now that it is `next`: `null` to write nothing. A glow under
 * `GLOW_STEP` is 0, and 0 is written exactly once (as a removal), so an item a
 * firefly left is cleared and an item none came near is never touched.
 */
export function glowWrite(prev: number, next: number): number | null {
  const n = next < GLOW_STEP ? 0 : Math.round(next * 100) / 100;
  if (n === 0) return prev === 0 ? null : 0;
  return Math.abs(n - prev) > GLOW_STEP ? n : null;
}
