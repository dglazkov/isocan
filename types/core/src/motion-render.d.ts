/**
 * **`@isocan/core/motion-render`** — what a movie of a motion is, decided once
 * for both surfaces (motion phase 1; `docs/projects/motion/design.md` §4, §6).
 *
 * The render page (`MOTION_RENDER_ROUTE` in the web app, `motionRenderUrl()`) and
 * `isocan motion render` both read these: the caps, the frame count, the
 * size, the background, and the `renderedFrom` record the video item wears.
 * The CLI asks `motionRenderPlan` BEFORE it starts a browser, so a movie past
 * its caps is refused in words in a second rather than run for minutes; the
 * page asks it again over the document it actually fetched, because the page
 * is an address anybody can open.
 *
 * A subpath of its own rather than a part of `@isocan/core/motion`: the page
 * is a lazy chunk of the web app, and `motion.ts` reaches the SVG sanitiser
 * (parse5, css-tree) the page never needs. This file reaches the engine and
 * the spec checks, and nothing else.
 */
import type { MotionSpec } from "./motion-engine.js";
export { createMotionEngine, type MotionSpec } from "./motion-engine.js";
export { validateMotionSpec } from "./motion-checks.js";
/**
 * **The caps** (design §6): 1080p, 60 fps, 60 s. A size is the frame's
 * shorter side at most 1080 and its longer at most 1920 — 1080 × 1080 and
 * 1920 × 1080 both fit, and both are what "1080p" means to somebody choosing
 * a movie. Above any of them the render is refused, never quietly lowered.
 */
export declare const MOTION_RENDER_CAPS: {
    readonly fps: 60;
    readonly seconds: 60;
    readonly short: 1080;
    readonly long: 1920;
};
/** What a movie is rendered at when nothing is said: 60 fps, 1080 × 1080, on white. */
export declare const MOTION_RENDER_DEFAULTS: {
    readonly fps: 60;
    readonly size: 1080;
    readonly background: "#ffffff";
};
/** What somebody asked for, as text off a flag or a query string. */
export interface MotionRenderAsk {
    fps?: string | number | null | undefined;
    size?: string | number | null | undefined;
    seconds?: string | number | null | undefined;
    background?: string | null | undefined;
}
/** A movie, decided: every frame `n` in `0 … frames - 1` is `render(n / fps)`. */
export interface MotionRenderPlan {
    fps: number;
    width: number;
    height: number;
    seconds: number;
    frames: number;
    background: string;
}
/**
 * **What will be rendered, or why not, in words.** `spec` is the motion's own
 * length and whether it loops. With no `seconds` the movie is the motion's
 * length — and a looping motion's length is one loop, so a loop renders once
 * and can be played on repeat by whatever shows it.
 */
export declare function motionRenderPlan(ask: MotionRenderAsk, spec: Pick<MotionSpec, "seconds" | "loop">): MotionRenderPlan;
/** The property a rendered video item wears, naming what it is a recording of. */
export declare const RENDERED_FROM = "renderedFrom";
/**
 * **`renderedFrom`, as JSON on the video item** (design §4): the motion item
 * and the version it was rendered from, and how. `size` is `WIDTHxHEIGHT`.
 * The motion's version pins its sources' versions in turn (`motionSources`),
 * so "which wheat was this" is one hop further and never a guess.
 */
export interface MotionRenderedFrom {
    item: string;
    version: string;
    fps: number;
    size: string;
    seconds: number;
    background: string;
}
/** The `renderedFrom` record for a plan of one motion version. */
export declare function motionRenderedFrom(item: string, version: string, plan: MotionRenderPlan): MotionRenderedFrom;
/**
 * **The H.264 codecs the page asks the browser for, best first** — High,
 * Main, then Constrained Baseline, each at level 5.2 so 1080p60 fits, and
 * then at 4.2 for an encoder that will not claim 5.2. The page takes the
 * first `VideoEncoder.isConfigSupported` says yes to; none, and it refuses.
 */
export declare const MOTION_H264_CODECS: readonly ["avc1.640034", "avc1.4D4034", "avc1.42E034", "avc1.64002A", "avc1.42002A"];
/**
 * **The words for a browser that cannot make an MP4** — the refusal the page
 * gives, never a silent switch to another format (motion phase 1). WebM is
 * phase 3's.
 */
export declare const MOTION_NO_H264 = "this browser cannot encode H.264 \u2014 WebM comes in motion phase 3";
/**
 * Bits a second for a frame size and rate: about 0.1 bit a pixel a frame,
 * so a 1080 × 1080 movie at 60 fps is about 7 Mbit/s — generous for flat
 * vector art, which is what a motion is, and well under any level's ceiling.
 */
export declare function motionBitrate(plan: Pick<MotionRenderPlan, "width" | "height" | "fps">): number;
