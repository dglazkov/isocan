import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  createMotionEngine,
  MOTION_GIF,
  MOTION_H264_CODECS,
  MOTION_NO_H264,
  MOTION_NO_VP9,
  MOTION_VP9_CODECS,
  motionBitrate,
  motionRenderedFrom,
  motionRenderPlan,
  validateMotionSpec,
  type MotionRenderAsk,
  type MotionRenderedFrom,
  type MotionRenderPlan,
  type MotionSpec,
} from "@isocan/core/motion-render";
import { getSnapshot, readBlobText } from "./api.ts";
import { GifWriter } from "./motion-gif.ts";
import { WebmWriter } from "./motion-webm.ts";

/**
 * **A motion, frame by frame, into an MP4, a WebM or a GIF** (motion phases 1
 * and 3; `docs/projects/motion/design.md` §4) — the work behind the render page.
 *
 * **No pixel comes from the motion's own frame, and none of its code runs.**
 * The motion document is an HTML item: anybody with edit rights can put a new
 * version on it, so its markup is a collaborator's, and the place it runs is
 * the sandboxed content origin — whose pixels this origin cannot read anyway.
 * So the page fetches the document's bytes, parses them with `DOMParser`
 * into an INERT document (no script runs, nothing loads, nothing is laid
 * out), takes out the stage `<svg id="stage">` and the spec, and drives the
 * frames with core's own `createMotionEngine()` — imported here, never the
 * copy the document carries. The stage is never put into this page's DOM:
 * each frame is serialised, drawn as an SVG `<img>` (which runs no script and
 * fetches nothing), composited over the background on a canvas, and handed to
 * the format's sink: WebCodecs' `VideoEncoder` as a `VideoFrame` — H.264 into
 * `mp4-muxer` for an MP4, VP9 into our own `motion-webm.ts` for a WebM — or,
 * for a GIF, the canvas's pixels into `motion-gif.ts`. The same frames go into
 * all three; only the last step differs.
 *
 * Every frame `n` is `render(n / fps)` — the engine is pure in `t`, so this
 * is the frame the player showed at that time, by construction.
 */

/** What the page reports while it works, and what a reader of `window` sees. */
export interface MotionRenderStatus {
  state: "loading" | "rendering" | "done" | "error";
  frame: number;
  frames: number;
  error: string | null;
  plan: MotionRenderPlan | null;
  codec: string | null;
  renderedFrom: MotionRenderedFrom | null;
  title: string | null;
}

/** The query the page was opened with, parsed: the ask (its format among it), and which version and frames to keep. */
export interface MotionRenderRequest {
  canvasId: string;
  itemId: string;
  version: string | null;
  ask: MotionRenderAsk;
  keep: number[];
}

/** What a finished render hands back: the file, and the pre-encode pictures it was asked to keep. */
export interface MotionRenderResult {
  bytes: Uint8Array;
  kept: Record<number, string>;
}

/** Read the page's query into a request. */
export function motionRenderRequest(canvasId: string, itemId: string, search: string): MotionRenderRequest {
  const q = new URLSearchParams(search);
  const keep = (q.get("keep") ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  return {
    canvasId,
    itemId,
    version: q.get("version"),
    ask: { format: q.get("format"), fps: q.get("fps"), size: q.get("size"), seconds: q.get("seconds"), background: q.get("background") },
    keep,
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** The stage and the spec out of a motion document, or why not — never by running it. */
function readMotionDocument(html: string): { stage: SVGSVGElement; spec: MotionSpec } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const stage = doc.getElementById("stage");
  if (!stage || stage.namespaceURI !== SVG_NS || stage.localName !== "svg") throw new Error("this document has no motion stage (<svg id=\"stage\">) — is it a motion?");
  const json = doc.getElementById("motion-spec")?.textContent;
  if (!json) throw new Error("this document has no motion spec (<script id=\"motion-spec\">) — is it a motion?");
  let spec: MotionSpec;
  try {
    spec = JSON.parse(json) as MotionSpec;
  } catch {
    throw new Error("this motion's spec is not JSON");
  }
  validateMotionSpec(spec);
  return { stage: stage as unknown as SVGSVGElement, spec };
}

const noWebCodecs = (refusal: string) => {
  const why = window.isSecureContext ? "it has no WebCodecs" : "this page is not a secure context (https or localhost), and WebCodecs needs one";
  return new Error(`${refusal} (${why})`);
};

/** The first configuration of these codecs this browser will encode at this size and rate, or the refusal in words. */
async function videoConfig(plan: MotionRenderPlan, codecs: readonly string[], refusal: string, extra: Partial<VideoEncoderConfig>): Promise<VideoEncoderConfig> {
  if (typeof VideoEncoder === "undefined") throw noWebCodecs(refusal);
  for (const codec of codecs) {
    const config: VideoEncoderConfig = {
      codec,
      width: plan.width,
      height: plan.height,
      framerate: plan.fps,
      bitrate: motionBitrate(plan),
      latencyMode: "quality",
      ...extra,
    };
    const answer = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (answer?.supported) return config;
  }
  throw new Error(refusal);
}

/**
 * **Where the frames go.** One per format: `frame` takes the canvas once it
 * holds frame `n` (and may wait, for backpressure); `finish` returns the
 * file. `codec` is what the status reports — the WebCodecs codec, or `gif`.
 */
interface Sink {
  codec: string;
  frame: (canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D, n: number) => Promise<void>;
  finish: () => Promise<Uint8Array>;
  close: () => void;
}

/** A `VideoEncoder` sink, H.264 or VP9, handing each chunk to a muxer. */
function encoderSink(plan: MotionRenderPlan, config: VideoEncoderConfig, mux: { chunk: (c: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void; finish: () => Uint8Array }): Sink {
  let failure = null as Error | null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => mux.chunk(chunk, meta),
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)); },
  });
  encoder.configure(config);
  const microseconds = (n: number) => Math.round((n * 1_000_000) / plan.fps);
  return {
    codec: config.codec,
    async frame(canvas, _ctx, n) {
      if (failure) throw failure;
      const frame = new VideoFrame(canvas, { timestamp: microseconds(n), duration: microseconds(n + 1) - microseconds(n) });
      // A keyframe every two seconds: a scrubbing player seeks cheaply.
      encoder.encode(frame, { keyFrame: n % (plan.fps * 2) === 0 });
      frame.close();
      // Backpressure: never more than a few frames ahead of the encoder.
      while (encoder.encodeQueueSize > 4) await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
    },
    async finish() {
      await encoder.flush();
      if (failure) throw failure;
      return mux.finish();
    },
    close() {
      if (encoder.state !== "closed") encoder.close();
    },
  };
}

/** An MP4: H.264 into `mp4-muxer`. */
async function mp4Sink(plan: MotionRenderPlan): Promise<Sink> {
  const config = await videoConfig(plan, MOTION_H264_CODECS, MOTION_NO_H264, { avc: { format: "avc" } });
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: plan.width, height: plan.height, frameRate: plan.fps }, fastStart: "in-memory" });
  return encoderSink(plan, config, {
    chunk: (c, meta) => muxer.addVideoChunk(c, meta),
    finish: () => {
      muxer.finalize();
      return new Uint8Array(target.buffer);
    },
  });
}

/** A WebM: VP9 into `motion-webm.ts`. */
async function webmSink(plan: MotionRenderPlan): Promise<Sink> {
  const config = await videoConfig(plan, MOTION_VP9_CODECS, MOTION_NO_VP9, {});
  const writer = new WebmWriter({ width: plan.width, height: plan.height, fps: plan.fps });
  return encoderSink(plan, config, {
    chunk: (c) => {
      const data = new Uint8Array(c.byteLength);
      c.copyTo(data);
      writer.add({ data, timestamp: c.timestamp, key: c.type === "key" });
    },
    finish: () => writer.finish(plan.seconds),
  });
}

/**
 * A GIF: each frame's pixels into `motion-gif.ts`, its delay the share of
 * hundredths of a second that keeps the whole on the clock (3, 3, 4, … at
 * 30 fps). Held to `MOTION_GIF.bytes` as it grows — the plan refused what its
 * estimate said would not fit, and this catches a drawing that packs worse.
 */
function gifSink(plan: MotionRenderPlan): Sink {
  const writer = new GifWriter(plan.width, plan.height);
  const cs = (n: number) => Math.round((n * 100) / plan.fps);
  return {
    codec: "gif",
    async frame(_canvas, ctx, n) {
      writer.add(ctx.getImageData(0, 0, plan.width, plan.height).data, cs(n + 1) - cs(n));
      if (writer.bytes > MOTION_GIF.bytes) {
        throw new Error(`this GIF passed ${Math.round(MOTION_GIF.bytes / 1e5) / 10} MB by frame ${n + 1} of ${plan.frames} — fewer seconds, fewer fps or a smaller size, or an MP4 or a WebM`);
      }
      // A breath between frames: the page stays responsive to whoever polls it.
      if (n % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    },
    finish: async () => writer.finish(),
    close: () => {},
  };
}

/** One picture of an SVG, decoded off the serialised markup — as an `<img>`, so nothing in it runs. */
async function pictureOf(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const dataUrlOf = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error("could not read a kept frame"));
  reader.readAsDataURL(blob);
});

/**
 * **Render the movie.** `onProgress` hears every state change and every
 * frame; the returned bytes are the file — an MP4, a WebM or a GIF, as the
 * plan's `format` says — with `plan.frames` frames.
 * `signal` stops it between frames — a page that unmounts (or StrictMode's
 * second mount) must not leave a render running beside the one it shows.
 */
export async function renderMotion(request: MotionRenderRequest, onProgress: (status: MotionRenderStatus) => void, signal?: AbortSignal): Promise<MotionRenderResult> {
  const status: MotionRenderStatus = { state: "loading", frame: 0, frames: 0, error: null, plan: null, codec: null, renderedFrom: null, title: null };
  const tell = (patch: Partial<MotionRenderStatus>) => {
    Object.assign(status, patch);
    onProgress({ ...status });
  };
  tell({});
  // The reads a person's own tab would make, with this browser's own badge:
  // the home answers with exactly the access it gives them to the item.
  const snapshot = await getSnapshot(request.canvasId);
  const item = snapshot.canvas.items[request.itemId];
  if (!item) throw new Error(`there is no item ${request.itemId} on this canvas`);
  if (item.properties.motion !== "true") throw new Error(`${item.title} is not a motion — render makes movies of motion items (isocan motion new)`);
  const versionId = request.version ?? item.currentVersionId;
  const version = item.versions.find((v) => v.id === versionId);
  if (!version) throw new Error(`${item.title} has no version ${versionId}`);
  const { stage, spec } = readMotionDocument(await readBlobText(request.canvasId, version.blobHash));
  const plan = motionRenderPlan(request.ask, spec);
  const sink = plan.format === "gif" ? gifSink(plan) : plan.format === "webm" ? await webmSink(plan) : await mp4Sink(plan);
  tell({ plan, frames: plan.frames, codec: sink.codec, renderedFrom: motionRenderedFrom(item.id, version.id, plan), title: item.title, state: "rendering" });

  // The stage fills the frame and letterboxes itself: its own
  // `preserveAspectRatio` (xMidYMid meet) centres it, as the player does.
  stage.setAttribute("width", String(plan.width));
  stage.setAttribute("height", String(plan.height));
  const engine = createMotionEngine();
  const serializer = new XMLSerializer();
  const canvas = new OffscreenCanvas(plan.width, plan.height);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: plan.format === "gif" });
  if (!ctx) throw new Error("this browser would not give the page a 2D canvas to draw frames on");

  const keep = new Set(request.keep);
  const kept: Record<number, string> = {};
  try {
    for (let n = 0; n < plan.frames; n++) {
      signal?.throwIfAborted();
      engine.render(stage, spec, n / plan.fps);
      const picture = await pictureOf(serializer.serializeToString(stage));
      ctx.fillStyle = plan.background;
      ctx.fillRect(0, 0, plan.width, plan.height);
      ctx.drawImage(picture, 0, 0, plan.width, plan.height);
      if (keep.has(n)) kept[n] = await dataUrlOf(await canvas.convertToBlob({ type: "image/png" }));
      await sink.frame(canvas, ctx, n);
      if (n % 6 === 0 || n === plan.frames - 1) tell({ frame: n + 1 });
    }
    return { bytes: await sink.finish(), kept };
  } finally {
    sink.close();
  }
}
