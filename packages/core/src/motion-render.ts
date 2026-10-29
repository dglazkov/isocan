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
import type { MotionSpec } from "./motion-engine.ts";

export { createMotionEngine, type MotionSpec } from "./motion-engine.ts";
export { validateMotionSpec } from "./motion-checks.ts";

/**
 * **The caps** (design §6): 1080p, 60 fps, 60 s. A size is the frame's
 * shorter side at most 1080 and its longer at most 1920 — 1080 × 1080 and
 * 1920 × 1080 both fit, and both are what "1080p" means to somebody choosing
 * a movie. Above any of them the render is refused, never quietly lowered.
 */
export const MOTION_RENDER_CAPS = { fps: 60, seconds: 60, short: 1080, long: 1920 } as const;

/** What a movie is rendered at when nothing is said: an MP4 at 60 fps, 1080 × 1080, on white. */
export const MOTION_RENDER_DEFAULTS = { format: "mp4", fps: 60, size: 1080, background: "#ffffff" } as const;

/**
 * **The formats a motion records to** (motion phases 1 and 3): an H.264 MP4,
 * a VP9 WebM, or an animated GIF — the same frames into each.
 */
export const MOTION_FORMATS = ["mp4", "webm", "gif"] as const;

/** One of `MOTION_FORMATS`. */
export type MotionFormat = (typeof MOTION_FORMATS)[number];

/** Is this a format a motion records to? */
export function isMotionFormat(name: string): name is MotionFormat {
  return (MOTION_FORMATS as readonly string[]).includes(name);
}

/** What each format is called, its file's type and extension. */
export const MOTION_FORMAT_FACTS: Record<MotionFormat, { label: string; mimeType: string; extension: string }> = {
  mp4: { label: "MP4", mimeType: "video/mp4", extension: "mp4" },
  webm: { label: "WebM", mimeType: "video/webm", extension: "webm" },
  gif: { label: "GIF", mimeType: "image/gif", extension: "gif" },
};

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
export const MOTION_GIF = { fps: 30, maxFps: 50, bytes: 64_000_000, bytesPerPixel: 0.05 } as const;

/** About how many bytes a GIF of this plan will be, before encoding it. */
export function motionGifEstimate(plan: Pick<MotionRenderPlan, "width" | "height" | "frames">): number {
  return Math.round(plan.width * plan.height * plan.frames * MOTION_GIF.bytesPerPixel);
}

const mb = (bytes: number) => `${Math.round(bytes / 1e5) / 10} MB`;

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

const number = (value: string | number, what: string): number => {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new Error(`${what} is a number, not "${String(value)}"`);
  return n;
};

/**
 * `1080` (a square) or `1920x1080`. Even sides only: H.264's and VP9's 4:2:0
 * frames are built from 2 × 2 blocks, and an odd side is cropped by some
 * encoders and refused by others — so it is refused here, the same everywhere,
 * a GIF included, so a size that renders in one format renders in all three.
 */
function sizeOf(value: string | number): { width: number; height: number } {
  const text = String(value).trim().toLowerCase();
  const m = /^(\d+)(?:x(\d+))?$/.exec(text);
  if (!m) throw new Error(`--size is one number for a square (1080) or WIDTHxHEIGHT (1920x1080), not "${String(value)}"`);
  const width = Number(m[1]);
  const height = m[2] === undefined ? width : Number(m[2]);
  if (width < 16 || height < 16) throw new Error(`--size is at least 16 on a side, not ${width}x${height}`);
  if (width % 2 !== 0 || height % 2 !== 0) throw new Error(`--size needs even sides (a video frame is built from 2 × 2 blocks), not ${width}x${height}`);
  const short = Math.min(width, height), long = Math.max(width, height);
  if (short > MOTION_RENDER_CAPS.short || long > MOTION_RENDER_CAPS.long) {
    throw new Error(`a movie is at most 1080p — ${MOTION_RENDER_CAPS.short} on its shorter side and ${MOTION_RENDER_CAPS.long} on its longer — not ${width}x${height}`);
  }
  return { width, height };
}

/**
 * **What will be rendered, or why not, in words.** `spec` is the motion's own
 * length and whether it loops. With no `seconds` the movie is the motion's
 * length — and a looping motion's length is one loop, so a loop renders once
 * and can be played on repeat by whatever shows it.
 */
export function motionRenderPlan(ask: MotionRenderAsk, spec: Pick<MotionSpec, "seconds" | "loop">): MotionRenderPlan {
  const given = (v: string | number | null | undefined): v is string | number => v !== undefined && v !== null && String(v).trim() !== "";
  const format = given(ask.format) ? String(ask.format).trim().toLowerCase() : MOTION_RENDER_DEFAULTS.format;
  if (!isMotionFormat(format)) throw new Error(`a movie is ${MOTION_FORMATS.join(", ")}, not "${String(ask.format)}"`);
  const gif = format === "gif";
  const fps = given(ask.fps) ? number(ask.fps, "--fps") : gif ? MOTION_GIF.fps : MOTION_RENDER_DEFAULTS.fps;
  if (!Number.isInteger(fps) || fps < 1) throw new Error(`--fps is a whole number of frames a second, not ${fps}`);
  if (fps > MOTION_RENDER_CAPS.fps) throw new Error(`a movie is at most ${MOTION_RENDER_CAPS.fps} fps, not ${fps}`);
  if (gif && fps > MOTION_GIF.maxFps) {
    throw new Error(`a GIF is at most ${MOTION_GIF.maxFps} fps, not ${fps} — its frame delay is in hundredths of a second, and browsers slow anything shorter than two to a tenth`);
  }
  const seconds = given(ask.seconds) ? number(ask.seconds, "--seconds") : spec.seconds;
  if (!(seconds > 0)) throw new Error(`--seconds is more than 0, not ${seconds}`);
  if (seconds > MOTION_RENDER_CAPS.seconds) throw new Error(`a movie is at most ${MOTION_RENDER_CAPS.seconds} seconds, not ${seconds}`);
  const { width, height } = sizeOf(given(ask.size) ? ask.size : MOTION_RENDER_DEFAULTS.size);
  const background = given(ask.background) ? String(ask.background).trim().toLowerCase() : MOTION_RENDER_DEFAULTS.background;
  if (!/^#[0-9a-f]{6}$/.test(background)) throw new Error(`--background is a colour as #rrggbb, not "${String(ask.background)}"`);
  const frames = Math.round(seconds * fps);
  if (frames < 1) throw new Error(`${seconds} s at ${fps} fps is no frames at all`);
  const plan: MotionRenderPlan = { format, fps, width, height, seconds, frames, background };
  if (gif) {
    const estimate = motionGifEstimate(plan);
    if (estimate > MOTION_GIF.bytes) {
      throw new Error(`a GIF of ${frames} frames at ${width}x${height} would be about ${mb(estimate)}, past a GIF's ${mb(MOTION_GIF.bytes)} — fewer seconds, fewer fps or a smaller size, or --mp4 / --webm`);
    }
  }
  return plan;
}

/** The property a rendered video item wears, naming what it is a recording of. */
export const RENDERED_FROM = "renderedFrom";

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
export function motionRenderedFrom(item: string, version: string, plan: MotionRenderPlan): MotionRenderedFrom {
  return { item, version, fps: plan.fps, size: `${plan.width}x${plan.height}`, seconds: plan.seconds, background: plan.background, format: plan.format };
}

/**
 * **The H.264 codecs the page asks the browser for, best first** — High,
 * Main, then Constrained Baseline, each at level 5.2 so 1080p60 fits, and
 * then at 4.2 for an encoder that will not claim 5.2. The page takes the
 * first `VideoEncoder.isConfigSupported` says yes to; none, and it refuses.
 */
export const MOTION_H264_CODECS = ["avc1.640034", "avc1.4D4034", "avc1.42E034", "avc1.64002A", "avc1.42002A"] as const;

/**
 * **The VP9 codecs the page asks for a WebM, best first** — profile 0, 8-bit,
 * at level 4.1 (1080p60), then 4.0 and 3.1 for an encoder that will not
 * claim it. The first `isConfigSupported` says yes to wins; none, and it
 * refuses.
 */
export const MOTION_VP9_CODECS = ["vp09.00.41.08", "vp09.00.40.08", "vp09.00.31.08"] as const;

/**
 * **The words for a browser that cannot make the format asked for** — the
 * refusal the page gives, never a silent switch to another format. Each says
 * which formats remain.
 */
export const MOTION_NO_H264 = "this browser cannot encode H.264 for an MP4 — try a WebM or a GIF";

/** As `MOTION_NO_H264`, for a WebM. */
export const MOTION_NO_VP9 = "this browser cannot encode VP9 for a WebM — try an MP4 or a GIF";

/**
 * Bits a second for a frame size and rate: about 0.1 bit a pixel a frame,
 * so a 1080 × 1080 movie at 60 fps is about 7 Mbit/s — generous for flat
 * vector art, which is what a motion is, and well under any level's ceiling.
 */
export function motionBitrate(plan: Pick<MotionRenderPlan, "width" | "height" | "fps">): number {
  return Math.max(1_000_000, Math.round(plan.width * plan.height * plan.fps * 0.1));
}
