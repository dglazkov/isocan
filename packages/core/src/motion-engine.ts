/**
 * **The motion engine: one clock, pure functions of time** (motion phase 0;
 * `docs/projects/motion/design.md` §1).
 *
 * Every value here is a function of `t` — seconds since the scene's start —
 * and the spec, and of nothing else: no `requestAnimationFrame` state, no
 * accumulated velocity. Frame 212 at 60 fps is `render(212 / 60)` whether it
 * is played, scrubbed or exported, and that is what lets a movie equal its
 * preview.
 *
 * The vocabulary — `track`, `flow`, `seg`, `wave`, `loop`, `bell`, `seeded`
 * and one table of easings on one shared clock — is after
 * rossark0/rossark-motion-skill (MIT, https://github.com/rossark0/rossark-motion-skill),
 * whose engine targets React Native and SwiftUI. This is our own engine
 * written to those shapes and principles; none of its code is ported.
 *
 * ## One source, two places it runs
 *
 * The engine is ONE function, `createMotionEngine`, whose body closes over
 * nothing outside itself. Node calls it (`motionEngine` below) to validate a
 * spec, to check its principles, and in the tests; the motion document
 * carries `createMotionEngine.toString()` inline (`motionEngineSource`) and
 * calls it there to play. There is no second copy to keep in step: whatever
 * the transpiler made of this function — tsx in a checkout, esbuild in the
 * released CLI, vite in the tests — is exactly the text the document runs.
 *
 * Two rules follow, and `packages/core/test/motion.test.ts` holds both by
 * evaluating the source in a bare `vm` context and comparing every function
 * against Node's copy: the body may reference no import and no module-level
 * binding (types are erased, so they are free), and it may not use syntax a
 * transpiler lowers into a helper call. The one helper that appears anyway is
 * tsx's `__name` (it transpiles with `keepNames`), and the source supplies an
 * identity for it.
 */

/** The named curves, one table: `ease` in a key names one of these. */
export type MotionEase = "linear" | "in" | "out" | "inOut" | "outBack" | "outQuart" | "inOutSine";

/** One timed value in a `track`; `ease` shapes the approach to THIS key. */
export interface MotionKey {
  t: number;
  v: number;
  ease?: MotionEase;
}

/**
 * Idle motion added on top of a channel: `amp · sin(2π((t − from)/period + phase))`
 * from `from` on. It starts at zero, so switching it on never jumps.
 */
export interface MotionWave {
  period: number;
  amp: number;
  phase?: number;
  from?: number;
}

/** A pulse added on top of a channel — emphasis, a bounce: `amp` at `at`, gone a few `width`s either side. */
export interface MotionBell {
  at: number;
  width: number;
  amp: number;
}

/** How one property of a target moves: a track of keys, plus idle waves and pulses on top. */
export interface MotionChannel {
  keys?: MotionKey[];
  wave?: MotionWave;
  bells?: MotionBell[];
}

/**
 * What a channel moves. `x`/`y` translate and `pivot` sits in the target's own
 * SVG units; `rotate` is degrees; `draw` is how much of each stroke is drawn
 * on, 0 to 1 (the document gives those shapes `pathLength="1"`).
 */
export type MotionChannelName = "x" | "y" | "rotate" | "scale" | "opacity" | "draw";

/**
 * The point a target turns and scales about, in its own SVG units, and the
 * name it was given — `base`, `center`, `top`, `left`, `right` or `point`.
 * The name is what the principle check reads: a part turning on its own
 * centre is a warning unless `at` is `center`, which says it was meant.
 */
export interface MotionPivot {
  x: number;
  y: number;
  at: string;
}

/**
 * One target and how it moves. `target` is a layer id (`wheat`) or a layer
 * and one of its named `<g id>` groups (`wheat/stalk`). `follows` names the
 * target this one should trail by a beat, which the checks hold it to.
 */
export interface MotionMove {
  target: string;
  pivot?: MotionPivot;
  follows?: string;
  channels: Partial<Record<MotionChannelName, MotionChannel>>;
}

/** A rectangle: stage coordinates for a layer's place, SVG units for a viewBox or a part. */
export interface MotionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One selected SVG as a layer of the stage. `box` is where its canvas item
 * sat, relative to the stage's top-left; `viewBox` is its own coordinate
 * system; `parts` are its named `<g id>` groups with a coarse bounding box
 * each (from control points and arc radii, in the group's own units); `ink`
 * says whether everything in it is stroke with no fill, which is what the
 * `assemble` recipe draws on rather than fades in.
 */
export interface MotionLayer {
  id: string;
  item: string;
  version: string;
  title: string;
  box: MotionBox;
  viewBox: MotionBox;
  parts: Record<string, MotionBox>;
  ink: "outline" | "filled";
}

/**
 * **The motion spec** — the JSON a motion document carries and an agent may
 * write: the stage, its layers back to front, and what moves. `version` is
 * the shape's version, not the item's.
 */
export interface MotionSpec {
  version: 1;
  seconds: number;
  loop: boolean;
  stage: { width: number; height: number };
  layers: MotionLayer[];
  moves: MotionMove[];
  recipe?: string;
}

/** Every channel's value for one target at one time. */
export interface MotionState {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  draw: number;
}

/**
 * The narrowest DOM `render` needs — the engine runs in Node too, and core's
 * types carry no DOM. A browser `Element` and `Document` satisfy these.
 */
export interface MotionElement {
  setAttribute(name: string, value: string): void;
}

/** A root `render` can search: the stage `<svg>`, or the document. */
export interface MotionRoot {
  querySelectorAll(selector: string): ArrayLike<MotionElement>;
}

/**
 * **The engine, as one self-contained function.** See the file's comment for
 * why it closes over nothing: its text is what the motion document runs.
 */
export function createMotionEngine() {
  const TAU = Math.PI * 2;
  const clamp01 = (p: number): number => (p < 0 ? 0 : p > 1 ? 1 : p);
  const EASINGS: Record<MotionEase, (p: number) => number> = {
    linear: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - (1 - p) * (1 - p) * (1 - p),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outBack: (p) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  const DEFAULTS: MotionState = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, draw: 1 };
  const NAMES: MotionChannelName[] = ["x", "y", "rotate", "scale", "opacity", "draw"];

  /** A named curve at progress `p`, clamped to 0..1; an unknown name is `inOut`. */
  const ease = (name: MotionEase | undefined, p: number): number => (EASINGS[name ?? "inOut"] ?? EASINGS.inOut)(clamp01(p));

  /** 0 → 1 across `[from, to]`, eased — for one-shot beats. */
  const seg = (t: number, from: number, to: number, curve?: MotionEase): number =>
    to <= from ? (t >= to ? 1 : 0) : ease(curve ?? "linear", (t - from) / (to - from));

  /** A value through timed keys: the first key's value before it, the last's after. */
  const track = (t: number, keys: readonly MotionKey[]): number => {
    const first = keys[0];
    if (!first) return NaN;
    if (t <= first.t) return first.v;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1]!;
      const b = keys[i]!;
      if (t <= b.t) return b.t <= a.t ? b.v : a.v + (b.v - a.v) * ease(b.ease, (t - a.t) / (b.t - a.t));
    }
    return keys[keys.length - 1]!.v;
  };

  /**
   * Smooth movement through key poses: each field passes through every pose's
   * value, with Catmull-Rom tangents, so velocity carries through a pose
   * instead of stopping at it the way an eased `track` does.
   */
  const flow = (t: number, poses: ReadonlyArray<{ t: number; [field: string]: number }>): Record<string, number> => {
    const out: Record<string, number> = {};
    const first = poses[0];
    if (!first) return out;
    const fields = Object.keys(first).filter((k) => k !== "t");
    const last = poses[poses.length - 1]!;
    let i = 1;
    while (i < poses.length - 1 && t > poses[i]!.t) i++;
    const p1 = poses[i - 1] ?? first;
    const p2 = poses[i] ?? last;
    const p0 = poses[i - 2] ?? p1;
    const p3 = poses[i + 1] ?? p2;
    const span = p2.t - p1.t;
    const u = t <= first.t ? 0 : t >= last.t ? 1 : span <= 0 ? 1 : clamp01((t - p1.t) / span);
    const at = t <= first.t ? first : t >= last.t ? last : null;
    for (const f of fields) {
      if (at) {
        out[f] = at[f] ?? 0;
        continue;
      }
      const v0 = p0[f] ?? 0, v1 = p1[f] ?? 0, v2 = p2[f] ?? 0, v3 = p3[f] ?? 0;
      const m1 = p2.t - p0.t > 0 ? ((v2 - v0) / (p2.t - p0.t)) * span : 0;
      const m2 = p3.t - p1.t > 0 ? ((v3 - v1) / (p3.t - p1.t)) * span : 0;
      const u2 = u * u, u3 = u2 * u;
      out[f] = (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
    }
    return out;
  };

  /** Idle motion: `amp · sin(2π(t/period + phase))`. */
  const wave = (t: number, period: number, amp: number, phase = 0): number => amp * Math.sin(TAU * (t / period + phase));

  /** Time folded into one period: `loop(5, 2)` is 1. */
  const loop = (t: number, period: number): number => (period > 0 ? ((t % period) + period) % period : 0);

  /** A pulse: 1 at `at`, falling away as a bell curve `width` seconds wide. */
  const bell = (t: number, at: number, width: number): number => (width > 0 ? Math.exp(-0.5 * Math.pow((t - at) / width, 2)) : t === at ? 1 : 0);

  /**
   * Stable "randomness": `seeded(seed)(n)` is the same number in 0..1 for the
   * same seed and `n`, on every render, in every browser — a hash, not a
   * generator, so asking out of order changes nothing.
   */
  const seeded = (seed: number) => (n: number): number => {
    let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul((n | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };

  /** One channel's value at `t`: its track (or the resting value), plus wave and pulses. */
  const channel = (name: MotionChannelName, ch: MotionChannel | undefined, t: number): number => {
    if (!ch) return DEFAULTS[name];
    let v = ch.keys && ch.keys.length > 0 ? track(t, ch.keys) : DEFAULTS[name];
    const w = ch.wave;
    if (w && w.period > 0) {
      const from = w.from ?? 0;
      if (t >= from) v += wave(t - from, w.period, w.amp, w.phase ?? 0);
    }
    for (const b of ch.bells ?? []) v += b.amp * bell(t, b.at, b.width);
    return v;
  };

  /** The scene's own time for a clock reading: folded when it loops, held at the ends when it does not. */
  const sceneTime = (spec: Pick<MotionSpec, "seconds" | "loop">, t: number): number =>
    spec.loop ? loop(t, spec.seconds) : t < 0 ? 0 : t > spec.seconds ? spec.seconds : t;

  /** Every target's state at `t`, keyed by target. Pure: the same `t` is the same answer. */
  const evaluate = (spec: MotionSpec, t: number): Record<string, MotionState> => {
    const time = sceneTime(spec, t);
    const out: Record<string, MotionState> = {};
    for (const move of spec.moves) {
      const state = { ...DEFAULTS };
      for (const name of NAMES) state[name] = channel(name, move.channels[name], time);
      out[move.target] = state;
    }
    return out;
  };

  const round = (v: number): string => String(Math.round(v * 10000) / 10000);

  /**
   * The SVG `transform` for a state: translate, then rotate and scale about
   * the pivot. Without a pivot only translation is meaningful — the checks
   * refuse a rotation or a scale that names none.
   */
  const transformOf = (s: MotionState, pivot: MotionPivot | undefined): string => {
    const px = pivot ? pivot.x : 0;
    const py = pivot ? pivot.y : 0;
    return `translate(${round(s.x)} ${round(s.y)}) rotate(${round(s.rotate)} ${round(px)} ${round(py)}) ` +
      `translate(${round(px)} ${round(py)}) scale(${round(s.scale)}) translate(${round(-px)} ${round(-py)})`;
  };

  /**
   * **`render(t)`**: set every moving target's `transform` and `opacity`,
   * and every drawn stroke's `stroke-dashoffset` (and its dash, solid once
   * drawn), for time `t` — and nothing else. Every attribute it owns is
   * written on every call, so the order of calls cannot matter.
   */
  const render = (root: MotionRoot, spec: MotionSpec, t: number): void => {
    const frame = evaluate(spec, t);
    for (const move of spec.moves) {
      const s = frame[move.target]!;
      const groups = root.querySelectorAll(`[data-motion="${move.target}"]`);
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i]!;
        g.setAttribute("transform", transformOf(s, move.pivot));
        g.setAttribute("opacity", round(s.opacity < 0 ? 0 : s.opacity > 1 ? 1 : s.opacity));
      }
      // A fully drawn stroke goes solid: a dash that covers a closed shape
      // still meets itself in a hairline seam — seen in Chrome on the logo's
      // circle at its last frame.
      const drawn = clamp01(s.draw);
      const strokes = root.querySelectorAll(`[data-motion-draw="${move.target}"]`);
      for (let i = 0; i < strokes.length; i++) {
        strokes[i]!.setAttribute("stroke-dasharray", drawn >= 1 ? "none" : "1 1");
        strokes[i]!.setAttribute("stroke-dashoffset", round(1 - drawn));
      }
    }
  };

  return { EASINGS, ease, seg, track, flow, wave, loop, bell, seeded, channel, sceneTime, evaluate, transformOf, render };
}

/** The engine as Node holds it — the same function the document calls, called here. */
export const motionEngine = createMotionEngine();

/** What `createMotionEngine()` returns, for code that is handed an engine. */
export type MotionEngine = ReturnType<typeof createMotionEngine>;

/**
 * **The engine as text, for the motion document to inline.** An expression
 * that evaluates to the engine: the factory's own source, called, with an
 * identity for the `__name` helper a `keepNames` transpile inserts.
 */
export function motionEngineSource(): string {
  return `(function () { var __name = function (f) { return f; }; return (${createMotionEngine.toString()})(); })()`;
}
