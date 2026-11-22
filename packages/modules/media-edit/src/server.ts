/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  newItemId,
  newVersionId,
  titleSlug,
  type Actor,
  type CanvasContents,
  type Item,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import {
  CLIP_PROPS,
  type ClipFramesRequest,
  type ClipFramesResponse,
  type ClipMuxRequest,
  type ClipOutputResponse,
  type ClipStitchRequest,
  type ClipTrimRequest,
} from "./core.ts";

/**
 * **Media-edit's server half: `POST /api/m/media-edit/{trim,stitch,mux,frames}`**
 * (Open Stitch phase 3).
 *
 * Local FFmpeg primitives (`spend: "none"`). Supports an injectable
 * `host.options.runFfmpeg(args, inputs)` seam so tests run deterministically
 * without requiring the `ffmpeg` binary on CI.
 */

const execFileAsync = promisify(execFile);

const MEDIA_EDIT_BAD_REQUEST = "media-edit-bad-request";
const MEDIA_EDIT_FAILED = "media-edit-failed";

export interface FfmpegInput {
  name: string;
  bytes: Uint8Array;
}

export interface FfmpegOutputFile {
  name: string;
  bytes: Uint8Array;
  mimeType?: string;
}

/** Injectable FFmpeg runner seam (`host.options.runFfmpeg`). */
export type RunFfmpeg = (
  args: readonly string[],
  inputs: readonly FfmpegInput[],
) => Promise<Uint8Array | readonly FfmpegOutputFile[]>;

function checkActor(actor: unknown): string | null {
  if (actor === undefined) return null;
  const a = actor as Partial<Actor> | null;
  if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
    return "when supplied, `actor` must carry non-empty `id` and string `name`";
  }
  return null;
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function nextClipPlacement(canvas: CanvasContents, index = 0): { x: number; y: number } {
  const items = Object.values(canvas.items);
  if (items.length === 0) return { x: index * 360, y: 0 };
  let maxRight = -Infinity;
  let minY = Infinity;
  for (const item of items) {
    const right = item.x + item.width;
    if (right > maxRight) maxRight = right;
    if (item.y < minY) minY = item.y;
  }
  return {
    x: Math.round(maxRight + 32 + index * 340),
    y: Number.isFinite(minY) ? Math.round(minY) : 0,
  };
}

function currentVersionOf(item: Item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1) ?? null;
}

function extForMime(mimeType: string, fallback = "mp4"): string {
  const base = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "video/mp4") return "mp4";
  if (base === "video/webm") return "webm";
  if (base === "audio/mpeg" || base === "audio/mp3") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mp4" || base === "audio/m4a") return "m4a";
  if (base === "image/png") return "png";
  return fallback;
}

/** Default local `ffmpeg` execution inside a temporary working directory. */
async function defaultRunFfmpeg(
  args: readonly string[],
  inputs: readonly FfmpegInput[],
): Promise<Uint8Array | readonly FfmpegOutputFile[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ffmpeg-"));
  try {
    for (const input of inputs) {
      await fs.writeFile(path.join(dir, input.name), input.bytes);
    }
    await execFileAsync("ffmpeg", ["-y", ...args], { cwd: dir, maxBuffer: 16 * 1024 * 1024 });
    const outArg = args.at(-1) ?? "out.mp4";
    if (outArg.includes("%")) {
      const files = (await fs.readdir(dir))
        .filter((f) => f.startsWith("frame-") && f.endsWith(".png"))
        .sort();
      const outputs: FfmpegOutputFile[] = [];
      for (const name of files) {
        const buf = await fs.readFile(path.join(dir, name));
        outputs.push({ name, bytes: new Uint8Array(buf), mimeType: "image/png" });
      }
      return outputs;
    }
    const buf = await fs.readFile(path.join(dir, outArg));
    return new Uint8Array(buf);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function ffmpegOf(host: ServerHost): RunFfmpeg {
  const seam = host.options.runFfmpeg;
  return typeof seam === "function" ? (seam as RunFfmpeg) : defaultRunFfmpeg;
}

function asSingleBytes(out: Uint8Array | readonly FfmpegOutputFile[]): Uint8Array {
  if (out instanceof Uint8Array) return out;
  const first = out[0];
  if (!first) throw new Error("ffmpeg produced no output bytes");
  return first.bytes;
}

function asFrameOutputs(out: Uint8Array | readonly FfmpegOutputFile[]): FfmpegOutputFile[] {
  if (out instanceof Uint8Array) {
    return [{ name: "frame-001.png", bytes: out, mimeType: "image/png" }];
  }
  return [...out];
}

function checkTrim({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ClipTrimRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: MEDIA_EDIT_BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("a trim request must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.itemId !== "string" || !body.itemId.trim()) return bad("`itemId` is required");
  if (typeof body.startSec !== "number" || !Number.isFinite(body.startSec) || body.startSec < 0) {
    return bad("`startSec` must be a non-negative number");
  }
  if (typeof body.endSec !== "number" || !Number.isFinite(body.endSec) || body.endSec <= body.startSec) {
    return bad("`endSec` must be a number greater than `startSec`");
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

function checkStitch({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ClipStitchRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: MEDIA_EDIT_BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("a stitch request must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (!Array.isArray(body.itemIds) || body.itemIds.length < 2 || body.itemIds.some((id) => typeof id !== "string" || !id.trim())) {
    return bad("`itemIds` must contain at least two item ids");
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

function checkMux({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ClipMuxRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: MEDIA_EDIT_BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("a mux request must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.videoItemId !== "string" || !body.videoItemId.trim()) return bad("`videoItemId` is required");
  if (typeof body.audioItemId !== "string" || !body.audioItemId.trim()) return bad("`audioItemId` is required");
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

function checkFrames({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ClipFramesRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: MEDIA_EDIT_BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("a frames request must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.itemId !== "string" || !body.itemId.trim()) return bad("`itemId` is required");
  if (body.fps !== undefined && (typeof body.fps !== "number" || !Number.isFinite(body.fps) || body.fps <= 0 || body.fps > 30)) {
    return bad("when supplied, `fps` must be a number between 0 and 30");
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

async function handleTrim(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ClipTrimRequest;
  const { canvasId } = req;
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "an actor is required", code: MEDIA_EDIT_BAD_REQUEST } };

  const snapshot = await host.canvas(canvasId);
  const source = snapshot.canvas.items[body.itemId.trim()];
  if (!source) return { status: 404, body: { error: `item not found: ${body.itemId}`, code: MEDIA_EDIT_BAD_REQUEST } };
  const ver = currentVersionOf(source);
  if (!ver) return { status: 400, body: { error: `item ${source.id} has no version`, code: MEDIA_EDIT_BAD_REQUEST } };
  const bytes = await host.readBlob(canvasId, ver.blobHash);
  if (!bytes) return { status: 404, body: { error: `blob missing for ${source.id}`, code: MEDIA_EDIT_BAD_REQUEST } };

  const ext = extForMime(ver.mimeType, "mp4");
  const inName = `input.${ext}`;
  const outName = `trimmed.${ext}`;
  const args = ["-i", inName, "-ss", String(body.startSec), "-to", String(body.endSec), "-c", "copy", outName];

  let outBytes: Uint8Array;
  try {
    outBytes = asSingleBytes(await ffmpegOf(host)(args, [{ name: inName, bytes }]));
  } catch (err) {
    return { status: 500, body: { error: `trim failed: ${err instanceof Error ? err.message : String(err)}`, code: MEDIA_EDIT_FAILED } };
  }

  const mimeType = ver.mimeType || "video/mp4";
  const filename = `${titleSlug(source.title, { max: 32, ascii: true }) || "clip"}-trim.${ext}`;
  const put = await host.putBlob(canvasId, outBytes, { mimeType, filename });
  const itemId = newItemId();

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
      width: source.width || 480,
      height: source.height || 270,
      placement: nextClipPlacement(snapshot.canvas),
      title: `${source.title} (${body.startSec}s–${body.endSec}s)`,
      properties: {
        parent: source.id,
        "derived-from": source.id,
        [CLIP_PROPS.op]: "trim",
        [CLIP_PROPS.sources]: source.id,
      },
    },
  });

  return {
    status: 200,
    body: { itemId, blobHash: put.blobHash, mimeType: put.mimeType, op: "trim", sources: [source.id] } satisfies ClipOutputResponse,
  };
}

async function handleStitch(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ClipStitchRequest;
  const { canvasId } = req;
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "an actor is required", code: MEDIA_EDIT_BAD_REQUEST } };

  const snapshot = await host.canvas(canvasId);
  const itemIds = body.itemIds.map((id) => id.trim());
  const inputs: FfmpegInput[] = [];
  const concatLines: string[] = [];
  let firstMime = "video/mp4";

  for (let i = 0; i < itemIds.length; i++) {
    const id = itemIds[i]!;
    const item = snapshot.canvas.items[id];
    if (!item) return { status: 404, body: { error: `item not found: ${id}`, code: MEDIA_EDIT_BAD_REQUEST } };
    const ver = currentVersionOf(item);
    if (!ver) return { status: 400, body: { error: `item ${id} has no version`, code: MEDIA_EDIT_BAD_REQUEST } };
    const bytes = await host.readBlob(canvasId, ver.blobHash);
    if (!bytes) return { status: 404, body: { error: `blob missing for ${id}`, code: MEDIA_EDIT_BAD_REQUEST } };
    if (i === 0 && ver.mimeType) firstMime = ver.mimeType;
    const ext = extForMime(ver.mimeType, "mp4");
    const name = `part-${i}.${ext}`;
    inputs.push({ name, bytes });
    concatLines.push(`file '${name}'`);
  }

  inputs.push({ name: "list.txt", bytes: new TextEncoder().encode(concatLines.join("\n") + "\n") });
  const ext = extForMime(firstMime, "mp4");
  const outName = `stitched.${ext}`;
  const args = ["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", outName];

  let outBytes: Uint8Array;
  try {
    outBytes = asSingleBytes(await ffmpegOf(host)(args, inputs));
  } catch (err) {
    return { status: 500, body: { error: `stitch failed: ${err instanceof Error ? err.message : String(err)}`, code: MEDIA_EDIT_FAILED } };
  }

  const filename = `stitched-clip.${ext}`;
  const put = await host.putBlob(canvasId, outBytes, { mimeType: firstMime, filename });
  const itemId = newItemId();
  const parentId = itemIds[0]!;

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
      width: 640,
      height: 360,
      placement: nextClipPlacement(snapshot.canvas),
      title: `Stitched (${itemIds.length} clips)`,
      properties: {
        parent: parentId,
        "derived-from": parentId,
        [CLIP_PROPS.op]: "stitch",
        [CLIP_PROPS.sources]: itemIds.join(","),
      },
    },
  });

  return {
    status: 200,
    body: { itemId, blobHash: put.blobHash, mimeType: put.mimeType, op: "stitch", sources: itemIds } satisfies ClipOutputResponse,
  };
}

async function handleMux(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ClipMuxRequest;
  const { canvasId } = req;
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "an actor is required", code: MEDIA_EDIT_BAD_REQUEST } };

  const snapshot = await host.canvas(canvasId);
  const videoItem = snapshot.canvas.items[body.videoItemId.trim()];
  const audioItem = snapshot.canvas.items[body.audioItemId.trim()];
  if (!videoItem) return { status: 404, body: { error: `video item not found: ${body.videoItemId}`, code: MEDIA_EDIT_BAD_REQUEST } };
  if (!audioItem) return { status: 404, body: { error: `audio item not found: ${body.audioItemId}`, code: MEDIA_EDIT_BAD_REQUEST } };

  const videoVer = currentVersionOf(videoItem);
  const audioVer = currentVersionOf(audioItem);
  if (!videoVer || !audioVer) {
    return { status: 400, body: { error: "both video and audio items must have a version", code: MEDIA_EDIT_BAD_REQUEST } };
  }
  const videoBytes = await host.readBlob(canvasId, videoVer.blobHash);
  const audioBytes = await host.readBlob(canvasId, audioVer.blobHash);
  if (!videoBytes || !audioBytes) {
    return { status: 404, body: { error: "source media blob missing", code: MEDIA_EDIT_BAD_REQUEST } };
  }

  const vName = `video.${extForMime(videoVer.mimeType, "mp4")}`;
  const aName = `audio.${extForMime(audioVer.mimeType, "wav")}`;
  const outName = "muxed.mp4";
  const args = ["-i", vName, "-i", aName, "-c:v", "copy", "-c:a", "aac", "-shortest", outName];

  let outBytes: Uint8Array;
  try {
    outBytes = asSingleBytes(await ffmpegOf(host)(args, [{ name: vName, bytes: videoBytes }, { name: aName, bytes: audioBytes }]));
  } catch (err) {
    return { status: 500, body: { error: `mux failed: ${err instanceof Error ? err.message : String(err)}`, code: MEDIA_EDIT_FAILED } };
  }

  const filename = "muxed-clip.mp4";
  const put = await host.putBlob(canvasId, outBytes, { mimeType: "video/mp4", filename });
  const itemId = newItemId();
  const sources = [videoItem.id, audioItem.id];

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
      width: videoItem.width || 640,
      height: videoItem.height || 360,
      placement: nextClipPlacement(snapshot.canvas),
      title: `${videoItem.title} + ${audioItem.title}`,
      properties: {
        parent: videoItem.id,
        "derived-from": videoItem.id,
        [CLIP_PROPS.op]: "mux",
        [CLIP_PROPS.sources]: sources.join(","),
      },
    },
  });

  return {
    status: 200,
    body: { itemId, blobHash: put.blobHash, mimeType: put.mimeType, op: "mux", sources } satisfies ClipOutputResponse,
  };
}

async function handleFrames(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ClipFramesRequest;
  const { canvasId } = req;
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "an actor is required", code: MEDIA_EDIT_BAD_REQUEST } };

  const snapshot = await host.canvas(canvasId);
  const source = snapshot.canvas.items[body.itemId.trim()];
  if (!source) return { status: 404, body: { error: `item not found: ${body.itemId}`, code: MEDIA_EDIT_BAD_REQUEST } };
  const ver = currentVersionOf(source);
  if (!ver) return { status: 400, body: { error: `item ${source.id} has no version`, code: MEDIA_EDIT_BAD_REQUEST } };
  const bytes = await host.readBlob(canvasId, ver.blobHash);
  if (!bytes) return { status: 404, body: { error: `blob missing for ${source.id}`, code: MEDIA_EDIT_BAD_REQUEST } };

  const fps = body.fps ?? 1;
  const inName = `input.${extForMime(ver.mimeType, "mp4")}`;
  const args = ["-i", inName, "-vf", `fps=${fps}`, "frame-%03d.png"];

  let frames: FfmpegOutputFile[];
  try {
    frames = asFrameOutputs(await ffmpegOf(host)(args, [{ name: inName, bytes }]));
  } catch (err) {
    return { status: 500, body: { error: `frames extraction failed: ${err instanceof Error ? err.message : String(err)}`, code: MEDIA_EDIT_FAILED } };
  }

  if (frames.length === 0) {
    return { status: 500, body: { error: "ffmpeg extracted zero frames", code: MEDIA_EDIT_FAILED } };
  }

  const group = `clip-frames-${newVersionId()}`;
  const itemIds: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const mimeType = frame.mimeType || "image/png";
    const filename = frame.name || `frame-${String(i + 1).padStart(3, "0")}.png`;
    const put = await host.putBlob(canvasId, frame.bytes, { mimeType, filename });
    const itemId = newItemId();
    itemIds.push(itemId);
    await host.submit({
      canvasId,
      actor,
      group,
      op: {
        type: "item.add",
        itemId,
        version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
        width: 320,
        height: 180,
        placement: nextClipPlacement(snapshot.canvas, i),
        title: `${source.title} frame ${i + 1}`,
        properties: {
          parent: source.id,
          "derived-from": source.id,
          [CLIP_PROPS.op]: "frames",
          [CLIP_PROPS.sources]: source.id,
        },
      },
    });
  }

  return {
    status: 200,
    body: { itemIds, op: "frames", sources: [source.id], fps } satisfies ClipFramesResponse,
  };
}

export const mediaEditServer: ServerModule = {
  name: "@isocan/media-edit",
  routes: [
    {
      method: "POST",
      path: "trim",
      spend: "none",
      bodyLimit: 16 * 1024,
      check: checkTrim,
      handler: handleTrim,
    },
    {
      method: "POST",
      path: "stitch",
      spend: "none",
      bodyLimit: 16 * 1024,
      check: checkStitch,
      handler: handleStitch,
    },
    {
      method: "POST",
      path: "mux",
      spend: "none",
      bodyLimit: 16 * 1024,
      check: checkMux,
      handler: handleMux,
    },
    {
      method: "POST",
      path: "frames",
      spend: "none",
      bodyLimit: 16 * 1024,
      check: checkFrames,
      handler: handleFrames,
    },
  ],
};

export default mediaEditServer;
