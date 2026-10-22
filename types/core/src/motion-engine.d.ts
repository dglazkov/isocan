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
    stage: {
        width: number;
        height: number;
    };
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
export declare function createMotionEngine(): {
    EASINGS: Record<MotionEase, (p: number) => number>;
    ease: (name: MotionEase | undefined, p: number) => number;
    seg: (t: number, from: number, to: number, curve?: MotionEase) => number;
    track: (t: number, keys: readonly MotionKey[]) => number;
    flow: (t: number, poses: ReadonlyArray<{
        t: number;
        [field: string]: number;
    }>) => Record<string, number>;
    wave: (t: number, period: number, amp: number, phase?: number) => number;
    loop: (t: number, period: number) => number;
    bell: (t: number, at: number, width: number) => number;
    seeded: (seed: number) => (n: number) => number;
    channel: (name: MotionChannelName, ch: MotionChannel | undefined, t: number) => number;
    sceneTime: (spec: Pick<MotionSpec, "seconds" | "loop">, t: number) => number;
    evaluate: (spec: MotionSpec, t: number) => Record<string, MotionState>;
    transformOf: (s: MotionState, pivot: MotionPivot | undefined) => string;
    render: (root: MotionRoot, spec: MotionSpec, t: number) => void;
};
/** The engine as Node holds it — the same function the document calls, called here. */
export declare const motionEngine: {
    EASINGS: Record<MotionEase, (p: number) => number>;
    ease: (name: MotionEase | undefined, p: number) => number;
    seg: (t: number, from: number, to: number, curve?: MotionEase) => number;
    track: (t: number, keys: readonly MotionKey[]) => number;
    flow: (t: number, poses: ReadonlyArray<{
        t: number;
        [field: string]: number;
    }>) => Record<string, number>;
    wave: (t: number, period: number, amp: number, phase?: number) => number;
    loop: (t: number, period: number) => number;
    bell: (t: number, at: number, width: number) => number;
    seeded: (seed: number) => (n: number) => number;
    channel: (name: MotionChannelName, ch: MotionChannel | undefined, t: number) => number;
    sceneTime: (spec: Pick<MotionSpec, "seconds" | "loop">, t: number) => number;
    evaluate: (spec: MotionSpec, t: number) => Record<string, MotionState>;
    transformOf: (s: MotionState, pivot: MotionPivot | undefined) => string;
    render: (root: MotionRoot, spec: MotionSpec, t: number) => void;
};
/** What `createMotionEngine()` returns, for code that is handed an engine. */
export type MotionEngine = ReturnType<typeof createMotionEngine>;
/**
 * **The engine as text, for the motion document to inline.** An expression
 * that evaluates to the engine: the factory's own source, called, with an
 * identity for the `__name` helper a `keepNames` transpile inserts.
 */
export declare function motionEngineSource(): string;
