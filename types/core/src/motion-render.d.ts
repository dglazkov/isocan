/**
 * **`@isocan/core/motion-render`** — what a movie of a motion is, decided once
 * for both surfaces (motion phase 1; `docs/projects/motion/design.md` §4, §6).
 *
 * The render page (`MOTION_RENDER_ROUTE` in the web app, `motionRenderUrl()`) and
 * `isocan motion render` both read these: the caps, the frame count, the
 * size, the background, and the `renderedFrom` record the video item wears.
 * The CLI asks `motionRenderPlan` BEFORE it starts a browser, so a movie past
 * its caps — or a GIF past its weight — is refused in words in a second
 * rather than run for minutes; the
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
/** What a movie is rendered at when nothing is said: an MP4 at 60 fps, 1080 × 1080, on white. */
export declare const MOTION_RENDER_DEFAULTS: {
    readonly format: "mp4";
    readonly fps: 60;
    readonly size: 1080;
    readonly background: "#ffffff";
};
/**
 * **The formats a motion records to** (motion phases 1 and 3): an H.264 MP4,
 * a VP9 WebM, or an animated GIF — the same frames into each.
 */
export declare const MOTION_FORMATS: readonly ["mp4", "webm", "gif"];
/** One of `MOTION_FORMATS`. */
export type MotionFormat = (typeof MOTION_FORMATS)[number];
/** Is this a format a motion records to? */
export declare function isMotionFormat(name: string): name is MotionFormat;
/** What each format is called, its file's type and extension. */
export declare const MOTION_FORMAT_FACTS: Record<MotionFormat, {
    label: string;
    mimeType: string;
    extension: string;
}>;
/**
 * **A GIF's own limits.** Its frames are big — every one a full picture,
 * palette-quantised and LZW-packed, with nothing like a video codec's motion
 * prediction — so a GIF defaults to 30 fps rather than 60. And a GIF's frame
 * delay is counted in hundredths of a second, and browsers slow any delay
 * under two hundredths to a tenth, so a GIF is at most 50 fps: past that it
 * would play slower, not smoother, and is refused instead.
 *
 * `bytes` is the most a GIF may weigh — 64 MB. A GIF is refused BEFORE a
 * frame is drawn when its estimate passes that: every pixel of every frame
 * at `bytesPerPixel` (`motionGifEstimate`). Scene 1's logo measured 0.004 a
 * pixel on 22 Oct 2026 (1080², 72 frames, 0.35 MB) — mostly white that never
 * changes, which the encoder writes once — so the estimate allows twelve
 * times that, for a drawing that fills the frame and moves all over it. At
 * 1080² and 30 fps that is about 36 s of GIF; past it, a WebM. The page
 * holds the real bytes to the same cap as it encodes, in case a drawing
 * packs worse than even the estimate.
 */
export declare const MOTION_GIF: {
    readonly fps: 30;
    readonly maxFps: 50;
    readonly bytes: 64000000;
    readonly bytesPerPixel: 0.05;
};
/** About how many bytes a GIF of this plan will be, before encoding it. */
export declare function motionGifEstimate(plan: Pick<MotionRenderPlan, "width" | "height" | "frames">): number;
/** What somebody asked for, as text off a flag or a query string. */
export interface MotionRenderAsk {
    format?: string | null | undefined;
    fps?: string | number | null | undefined;
    size?: string | number | null | undefined;
    seconds?: string | number | null | undefined;
    background?: string | null | undefined;
}
/** A movie, decided: every frame `n` in `0 … frames - 1` is `render(n / fps)`. */
export interface MotionRenderPlan {
    format: MotionFormat;
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
 * and the version it was rendered from, and how. `size` is `WIDTHxHEIGHT`;
 * `format` is `mp4`, `webm` or `gif` (since motion phase 3 — a record with
 * none is an MP4, the only format before it).
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
    format?: MotionFormat;
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
 * **The VP9 codecs the page asks for a WebM, best first** — profile 0, 8-bit,
 * at level 4.1 (1080p60), then 4.0 and 3.1 for an encoder that will not
 * claim it. The first `isConfigSupported` says yes to wins; none, and it
 * refuses.
 */
export declare const MOTION_VP9_CODECS: readonly ["vp09.00.41.08", "vp09.00.40.08", "vp09.00.31.08"];
/**
 * **The words for a browser that cannot make the format asked for** — the
 * refusal the page gives, never a silent switch to another format. Each says
 * which formats remain.
 */
export declare const MOTION_NO_H264 = "this browser cannot encode H.264 for an MP4 \u2014 try a WebM or a GIF";
/** As `MOTION_NO_H264`, for a WebM. */
export declare const MOTION_NO_VP9 = "this browser cannot encode VP9 for a WebM \u2014 try an MP4 or a GIF";
/**
 * Bits a second for a frame size and rate: about 0.1 bit a pixel a frame,
 * so a 1080 × 1080 movie at 60 fps is about 7 Mbit/s — generous for flat
 * vector art, which is what a motion is, and well under any level's ceiling.
 */
export declare function motionBitrate(plan: Pick<MotionRenderPlan, "width" | "height" | "fps">): number;
