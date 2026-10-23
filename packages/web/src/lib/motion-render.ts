import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  createMotionEngine,
  MOTION_H264_CODECS,
  MOTION_NO_H264,
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

/**
 * **A motion, frame by frame, into an MP4** (motion phase 1;
 * `docs/projects/motion/design.md` §4) — the work behind the render page.
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
 * WebCodecs' `VideoEncoder` as a `VideoFrame`. `mp4-muxer` writes the file.
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

/** The query the page was opened with, parsed: the ask, and which version and frames to keep. */
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
    ask: { fps: q.get("fps"), size: q.get("size"), seconds: q.get("seconds"), background: q.get("background") },
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

/** The first H.264 configuration this browser will encode at this size and rate, or the refusal in words. */
async function h264Config(plan: MotionRenderPlan): Promise<VideoEncoderConfig> {
  if (typeof VideoEncoder === "undefined") {
    const why = window.isSecureContext ? "it has no WebCodecs" : "this page is not a secure context (https or localhost), and WebCodecs needs one";
    throw new Error(`${MOTION_NO_H264} (${why})`);
  }
  for (const codec of MOTION_H264_CODECS) {
    const config: VideoEncoderConfig = {
      codec,
      width: plan.width,
      height: plan.height,
      framerate: plan.fps,
      bitrate: motionBitrate(plan),
      latencyMode: "quality",
      avc: { format: "avc" },
    };
    const answer = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (answer?.supported) return config;
  }
  throw new Error(MOTION_NO_H264);
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
 * frame; the returned bytes are an MP4 with `plan.frames` frames of H.264.
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
  const config = await h264Config(plan);
  tell({ plan, frames: plan.frames, codec: config.codec, renderedFrom: motionRenderedFrom(item.id, version.id, plan), title: item.title, state: "rendering" });

  // The stage fills the frame and letterboxes itself: its own
  // `preserveAspectRatio` (xMidYMid meet) centres it, as the player does.
  stage.setAttribute("width", String(plan.width));
  stage.setAttribute("height", String(plan.height));
  const engine = createMotionEngine();
  const serializer = new XMLSerializer();
  const canvas = new OffscreenCanvas(plan.width, plan.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("this browser would not give the page a 2D canvas to draw frames on");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: plan.width, height: plan.height, frameRate: plan.fps }, fastStart: "in-memory" });
  let failure = null as Error | null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)); },
  });
  encoder.configure(config);
  const keep = new Set(request.keep);
  const kept: Record<number, string> = {};
  const microseconds = (n: number) => Math.round((n * 1_000_000) / plan.fps);
  try {
    for (let n = 0; n < plan.frames; n++) {
      if (failure) throw failure;
      signal?.throwIfAborted();
      engine.render(stage, spec, n / plan.fps);
      const picture = await pictureOf(serializer.serializeToString(stage));
      ctx.fillStyle = plan.background;
      ctx.fillRect(0, 0, plan.width, plan.height);
      ctx.drawImage(picture, 0, 0, plan.width, plan.height);
      if (keep.has(n)) kept[n] = await dataUrlOf(await canvas.convertToBlob({ type: "image/png" }));
      const frame = new VideoFrame(canvas, { timestamp: microseconds(n), duration: microseconds(n + 1) - microseconds(n) });
      // A keyframe every two seconds: a scrubbing player seeks cheaply.
      encoder.encode(frame, { keyFrame: n % (plan.fps * 2) === 0 });
      frame.close();
      // Backpressure: never more than a few frames ahead of the encoder.
      while (encoder.encodeQueueSize > 4) await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
      if (n % 6 === 0 || n === plan.frames - 1) tell({ frame: n + 1 });
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  muxer.finalize();
  return { bytes: new Uint8Array(target.buffer), kept };
}
