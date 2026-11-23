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

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  FILENAME_HEADER,
  askTheDoor,
  bearerHeader,
  newCanvasId,
  newItemId,
  newVersionId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  CLIP_PROPS,
  MEDIA_EDIT_FRAMES_ROUTE,
  MEDIA_EDIT_MUX_ROUTE,
  MEDIA_EDIT_STITCH_ROUTE,
  MEDIA_EDIT_TRIM_ROUTE,
  parseClipSources,
  type ClipFramesResponse,
  type ClipOutputResponse,
} from "../src/core.ts";
import type { RunFfmpeg } from "../src/server.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-media-edit-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function boot(home: string, opts: Parameters<typeof startDaemon>[0] = {}): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    ...opts,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function mintEditor(base: string, sessionKey = "test:acme-media-edit"): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const { badge } = knocked;
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Editor" },
      op: { type: "actor.claim", sessionKey, name: "Acme Editor" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Media Edit Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

async function addMediaItem(
  base: string,
  badge: StoredBadge,
  actor: Actor,
  canvasId: string,
  opts: { title: string; filename: string; mimeType: string; bytes: Uint8Array },
): Promise<string> {
  const upRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...authHeaders(badge),
      "Content-Type": opts.mimeType,
      [FILENAME_HEADER]: opts.filename,
    },
    body: Buffer.from(opts.bytes),
  });
  expect(upRes.status).toBe(200);
  const blob = (await upRes.json()) as { blobHash: string; size: number };
  const itemId = newItemId();
  const opRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId,
      actor,
      op: {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: blob.blobHash,
          mimeType: opts.mimeType,
          filename: opts.filename,
          size: blob.size,
        },
        width: 480,
        height: 270,
        placement: { x: 0, y: 0 },
        title: opts.title,
      },
    }),
  });
  expect(opRes.status).toBe(200);
  return itemId;
}

describe("@isocan/media-edit core", () => {
  it("parses comma-separated clip sources", () => {
    expect(parseClipSources("itm_1, itm_2")).toEqual(["itm_1", "itm_2"]);
    expect(parseClipSources(undefined)).toEqual([]);
  });
});

describe("@isocan/media-edit server routes (injected runFfmpeg)", () => {
  it("runs trim, stitch, mux, and frames and lands derived items with parent provenance", async () => {
    const home = await mkHome();
    const seenCalls: Array<{ args: readonly string[]; inputNames: string[] }> = [];

    const fakeTrim = new Uint8Array([0x00, 0x00, 0x00, 0x18, 1, 1, 1]);
    const fakeStitch = new Uint8Array([0x00, 0x00, 0x00, 0x18, 2, 2, 2]);
    const fakeMux = new Uint8Array([0x00, 0x00, 0x00, 0x18, 3, 3, 3]);
    const fakeFrame1 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]);
    const fakeFrame2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 2]);

    const fakeRunFfmpeg: RunFfmpeg = async (args, inputs) => {
      seenCalls.push({ args, inputNames: inputs.map((i) => i.name) });
      const out = args.at(-1) ?? "";
      if (out.startsWith("trimmed.")) return fakeTrim;
      if (out.startsWith("stitched.")) return fakeStitch;
      if (out === "muxed.mp4") return fakeMux;
      if (out.includes("frame-")) {
        return [
          { name: "frame-001.png", bytes: fakeFrame1, mimeType: "image/png" },
          { name: "frame-002.png", bytes: fakeFrame2, mimeType: "image/png" },
        ];
      }
      throw new Error(`unexpected ffmpeg output: ${out}`);
    };

    const daemon = await boot(home, {
      modules: { "media-edit": { runFfmpeg: fakeRunFfmpeg } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const video1 = await addMediaItem(base, editor.badge, editor.actor, canvasId, {
      title: "Acme Clip One",
      filename: "acme-1.mp4",
      mimeType: "video/mp4",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    const video2 = await addMediaItem(base, editor.badge, editor.actor, canvasId, {
      title: "Acme Clip Two",
      filename: "acme-2.mp4",
      mimeType: "video/mp4",
      bytes: new Uint8Array([5, 6, 7, 8]),
    });
    const audio1 = await addMediaItem(base, editor.badge, editor.actor, canvasId, {
      title: "Acme Soundtrack",
      filename: "acme-audio.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([9, 10, 11, 12]),
    });

    // 1) Trim
    const trimRes = await fetch(`${base}${MEDIA_EDIT_TRIM_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: video1, startSec: 1, endSec: 4, actor: editor.actor }),
    });
    expect(trimRes.status).toBe(200);
    const trimmed = (await trimRes.json()) as ClipOutputResponse;
    expect(trimmed.op).toBe("trim");
    expect(trimmed.sources).toEqual([video1]);

    // 2) Stitch
    const stitchRes = await fetch(`${base}${MEDIA_EDIT_STITCH_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemIds: [video1, video2], actor: editor.actor }),
    });
    expect(stitchRes.status).toBe(200);
    const stitched = (await stitchRes.json()) as ClipOutputResponse;
    expect(stitched.op).toBe("stitch");
    expect(stitched.sources).toEqual([video1, video2]);

    // 3) Mux
    const muxRes = await fetch(`${base}${MEDIA_EDIT_MUX_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, videoItemId: video1, audioItemId: audio1, actor: editor.actor }),
    });
    expect(muxRes.status).toBe(200);
    const muxed = (await muxRes.json()) as ClipOutputResponse;
    expect(muxed.op).toBe("mux");
    expect(muxed.sources).toEqual([video1, audio1]);

    // 4) Frames
    const framesRes = await fetch(`${base}${MEDIA_EDIT_FRAMES_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: video1, fps: 2, actor: editor.actor }),
    });
    expect(framesRes.status).toBe(200);
    const frames = (await framesRes.json()) as ClipFramesResponse;
    expect(frames.op).toBe("frames");
    expect(frames.fps).toBe(2);
    expect(frames.itemIds).toHaveLength(2);

    expect(seenCalls).toHaveLength(4);

    // Verify all derived items carry `parent` + `derived-from` + `clip.op` + `clip.sources`
    const snap = await daemon.engine.getSnapshot(canvasId);
    expect(snap.canvas.items[trimmed.itemId]!.properties).toMatchObject({
      parent: video1,
      "derived-from": video1,
      [CLIP_PROPS.op]: "trim",
      [CLIP_PROPS.sources]: video1,
    });
    expect(snap.canvas.items[stitched.itemId]!.properties).toMatchObject({
      parent: video1,
      "derived-from": video1,
      [CLIP_PROPS.op]: "stitch",
      [CLIP_PROPS.sources]: `${video1},${video2}`,
    });
    expect(snap.canvas.items[muxed.itemId]!.properties).toMatchObject({
      parent: video1,
      "derived-from": video1,
      [CLIP_PROPS.op]: "mux",
      [CLIP_PROPS.sources]: `${video1},${audio1}`,
    });
    for (const fid of frames.itemIds) {
      expect(snap.canvas.items[fid]!.properties).toMatchObject({
        parent: video1,
        "derived-from": video1,
        [CLIP_PROPS.op]: "frames",
        [CLIP_PROPS.sources]: video1,
      });
    }
  });
});
