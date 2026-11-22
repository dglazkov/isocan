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
  jobOf,
  jobRetryRoute,
  newCanvasId,
  newItemId,
  newVersionId,
  type Actor,
  type CanvasContents,
  type JobResponse,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import type { JobClock } from "../../../server/src/jobs.ts";
import {
  VIDEO_GENERATE_ROUTE,
  VIDEO_JOB_KIND,
  VIDEO_PROPS,
  isOmniVideoModel,
  isVeoVideoModel,
  validateVideoDuration,
  validateVideoPrompt,
  videoFilename,
  videoModule,
  type VideoGenerateResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

/** Deterministic virtual clock whose timers advance manually (instant, zero flakiness). */
class VirtualClock implements JobClock {
  private currentMs: number;
  private nextId = 1;
  private timers = new Map<number, { due: number; fn: () => void }>();

  constructor(startIso = "2026-11-19T12:00:00.000Z") {
    this.currentMs = Date.parse(startIso);
  }

  now = (): number => this.currentMs;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.set(id, { due: this.currentMs + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number);
  };

  async advance(ms: number, settle: () => Promise<void>): Promise<void> {
    const target = this.currentMs + ms;
    while (true) {
      let nextKey: number | null = null;
      let nextDue = Infinity;
      for (const [id, t] of this.timers) {
        if (t.due <= target && t.due < nextDue) {
          nextDue = t.due;
          nextKey = id;
        }
      }
      if (nextKey === null) break;
      const entry = this.timers.get(nextKey)!;
      this.timers.delete(nextKey);
      this.currentMs = entry.due;
      entry.fn();
      await settle();
    }
    this.currentMs = target;
  }
}

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-video-test-"));
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

async function mintEditor(base: string, sessionKey = "test:acme-video"): Promise<{ badge: StoredBadge; actor: Actor }> {
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
      op: { type: "project.create", canvasId, title: "Acme Video Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

async function addImageItem(
  base: string,
  badge: StoredBadge,
  actor: Actor,
  canvasId: string,
): Promise<string> {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const upRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...authHeaders(badge),
      "Content-Type": "image/png",
      [FILENAME_HEADER]: "acme-frame.png",
    },
    body: bytes,
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
          mimeType: "image/png",
          filename: "acme-frame.png",
          size: blob.size,
        },
        width: 480,
        height: 270,
        placement: { x: 0, y: 0 },
        title: "Acme Still Frame",
      },
    }),
  });
  expect(opRes.status).toBe(200);
  return itemId;
}

describe("@isocan/video core", () => {
  it("validates prompts, durations, model families, filenames, and provenance edges", () => {
    expect(validateVideoPrompt("  Acme lighthouse at dawn  ")).toEqual({ ok: true, prompt: "Acme lighthouse at dawn" });
    expect(validateVideoPrompt("   ").ok).toBe(false);
    expect(validateVideoDuration(undefined)).toEqual({ ok: true });
    expect(validateVideoDuration(6)).toEqual({ ok: true, durationSeconds: 6 });
    expect(validateVideoDuration(12).ok).toBe(false);
    expect(isVeoVideoModel("veo-3.1-fast-generate-preview")).toBe(true);
    expect(isOmniVideoModel("gemini-omni-1.1-flash")).toBe(true);
    expect(videoFilename("Acme Sunrise Over Bay!", "veo-3.1-fast")).toBe("acme-sunrise-over-bay-veo-3-1-fast.mp4");

    const canvas: CanvasContents = {
      items: {
        itm_src: {
          id: "itm_src",
          title: "Acme Frame",
          description: "",
          x: 0,
          y: 0,
          width: 400,
          height: 300,
          versions: [],
          currentVersionId: "ver_1",
          properties: {},
          reactions: {},
          createdBy: { id: "usr_acme", name: "Acme Editor" },
          updatedBy: { id: "usr_acme", name: "Acme Editor" },
          createdAt: "2026-11-19T12:00:00.000Z",
          updatedAt: "2026-11-19T12:00:00.000Z",
        },
        itm_vid: {
          id: "itm_vid",
          title: "Acme Clip",
          description: "",
          x: 500,
          y: 0,
          width: 640,
          height: 360,
          versions: [],
          currentVersionId: "ver_2",
          properties: { [VIDEO_PROPS.sourceItem]: "itm_src" },
          reactions: {},
          createdBy: { id: "usr_acme", name: "Acme Editor" },
          updatedBy: { id: "usr_acme", name: "Acme Editor" },
          createdAt: "2026-11-19T12:01:00.000Z",
          updatedAt: "2026-11-19T12:01:00.000Z",
        },
      },
      threads: {},
      trash: [],
      agents: {},
    };
    const edges = videoModule.edges?.(canvas) ?? [];
    expect(edges).toHaveLength(1);
    expect(edges[0]!.from.id).toBe("itm_src");
    expect(edges[0]!.to.id).toBe("itm_vid");
  });
});

describe("@isocan/video server route + home-polled async job runner", () => {
  it("creates placeholder immediately (202), polls predictLongRunning after simulated disconnect to land MP4, and supports retry --model", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-19T16:00:00.000Z");
    const FAKE_KEY = "acme-video-gemini-secret-KEY-5555";
    const fakeMp4Veo = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    const fakeMp4Omni = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

    let veoPolls = 0;
    let omniPolls = 0;
    const seenStarts: Array<{ url: string; body: Record<string, unknown> }> = [];

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      // 1) Veo start (predictLongRunning)
      if (method === "POST" && url.includes(":predictLongRunning")) {
        seenStarts.push({ url, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
        return new Response(
          JSON.stringify({ name: "models/veo-3.1-fast-generate-preview/operations/op_acme_1" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      // 2) Veo poll
      if (method === "GET" && url.endsWith("/operations/op_acme_1")) {
        veoPolls++;
        if (veoPolls === 1) {
          return new Response(
            JSON.stringify({ done: false, metadata: { progressPercent: 45 } }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  { video: { uri: "https://generativelanguage.googleapis.com/v1beta/files/acme-clip-1:download" } },
                ],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      // 3) MP4 download
      if (method === "GET" && url.endsWith("/files/acme-clip-1:download")) {
        return new Response(fakeMp4Veo, { status: 200, headers: { "content-type": "video/mp4" } });
      }

      // 4) Retry with Omni model (interactions)
      if (method === "POST" && url.endsWith("/v1beta/interactions")) {
        seenStarts.push({ url, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
        return new Response(
          JSON.stringify({ id: "int_acme_2", status: "in_progress" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (method === "GET" && url.endsWith("/v1beta/interactions/int_acme_2")) {
        omniPolls++;
        return new Response(
          JSON.stringify({
            id: "int_acme_2",
            status: "completed",
            outputs: [
              { type: "video", mime_type: "video/mp4", data: Buffer.from(fakeMp4Omni).toString("base64") },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`unexpected fetch: ${method} ${url}`);
    };

    const daemon = await boot(home, {
      jobs: { pollIntervalMs: 5_000, clock },
      modules: {
        video: {
          key: () => FAKE_KEY,
          fetch: fakeFetch,
        },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);
    const sourceItemId = await addImageItem(base, editor.badge, editor.actor, canvasId);

    // Start video generation with Veo model and `fromItem`.
    const startRes = await fetch(`${base}${VIDEO_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Camera glides past Acme lighthouse in morning fog",
        fromItem: sourceItemId,
        model: "veo-3.1-fast-generate-preview",
        durationSeconds: 6,
        actor: editor.actor,
      }),
    });
    expect(startRes.status).toBe(202);
    const started = (await startRes.json()) as VideoGenerateResponse;
    expect(started.itemId).toBe(started.job.itemId);
    expect(started.job.kind).toBe(VIDEO_JOB_KIND);
    expect(started.job.state).toBe("running");
    expect(started.job.model).toBe("veo-3.1-fast-generate-preview");

    // Placeholder item exists immediately with provenance properties and source image passed to Veo.
    const snap0 = await daemon.engine.getSnapshot(canvasId);
    const placeholder = snap0.canvas.items[started.itemId]!;
    expect(placeholder).toBeDefined();
    expect(placeholder.versions).toHaveLength(1);
    expect(placeholder.properties[VIDEO_PROPS.prompt]).toBe("Camera glides past Acme lighthouse in morning fog");
    expect(placeholder.properties[VIDEO_PROPS.sourceItem]).toBe(sourceItemId);
    expect(placeholder.properties["derived-from"]).toBe(sourceItemId);
    expect(placeholder.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");
    expect(seenStarts).toHaveLength(1);
    expect(seenStarts[0]!.url).toContain("veo-3.1-fast-generate-preview:predictLongRunning");
    const firstInstance = (seenStarts[0]!.body.instances as Array<{ image?: { mimeType: string } }>)[0]!;
    expect(firstInstance.image?.mimeType).toBe("image/png");

    // Simulate client disconnect: zero client requests while home polls across virtual clock ticks.
    await clock.advance(5_000, () => daemon.jobs.settled());
    const midSnap = await daemon.engine.getSnapshot(canvasId);
    expect(jobOf(midSnap.canvas.items[started.itemId])?.progress).toBe("45%");
    expect(jobOf(midSnap.canvas.items[started.itemId])?.state).toBe("running");

    // Second poll finishes, downloads MP4, and lands version 2 on the item.
    await clock.advance(5_000, () => daemon.jobs.settled());
    const doneSnap = await daemon.engine.getSnapshot(canvasId);
    const doneItem = doneSnap.canvas.items[started.itemId]!;
    expect(jobOf(doneItem)?.state).toBe("done");
    expect(doneItem.versions).toHaveLength(2);
    const v2 = doneItem.versions[1]!;
    expect(v2.mimeType).toBe("video/mp4");
    expect(v2.filename).toMatch(/\.mp4$/);

    const dlRes = await fetch(`${base}/api/projects/${canvasId}/blobs/${v2.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(new Uint8Array(await dlRes.arrayBuffer())).toEqual(fakeMp4Veo);

    // Retry with --model switching to Gemini Omni on the SAME item -> stacks version 3!
    const retryRes = await fetch(`${base}${jobRetryRoute(canvasId, started.job.id)}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ model: "gemini-omni-1.1-flash", actor: editor.actor }),
    });
    expect(retryRes.status).toBe(200);
    const retried = ((await retryRes.json()) as JobResponse).job;
    expect(retried.itemId).toBe(started.itemId);
    expect(retried.model).toBe("gemini-omni-1.1-flash");
    expect(retried.state).toBe("running");

    await clock.advance(5_000, () => daemon.jobs.settled());
    expect(omniPolls).toBe(1);

    const retrySnap = await daemon.engine.getSnapshot(canvasId);
    const retriedItem = retrySnap.canvas.items[started.itemId]!;
    expect(retriedItem.versions).toHaveLength(3);
    expect(jobOf(retriedItem)).toMatchObject({
      id: retried.id,
      state: "done",
      model: "gemini-omni-1.1-flash",
    });
    const v3 = retriedItem.versions[2]!;
    expect(v3.mimeType).toBe("video/mp4");
    const dlRes3 = await fetch(`${base}/api/projects/${canvasId}/blobs/${v3.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(new Uint8Array(await dlRes3.arrayBuffer())).toEqual(fakeMp4Omni);
  });

  it("scrubs key material when a video poll fails", async () => {
    const home = await mkHome();
    const clock = new VirtualClock("2026-11-19T17:00:00.000Z");
    const SECRET_KEY = "acme-video-SECRET-DO-NOT-LEAK";

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes(":predictLongRunning")) {
        return new Response(JSON.stringify({ name: "operations/op_acme_fail" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ error: { message: `bad credential ${SECRET_KEY}` } }),
        { status: 403 },
      );
    };

    const daemon = await boot(home, {
      jobs: { pollIntervalMs: 1_000, clock },
      modules: { video: { key: () => SECRET_KEY, fetch: fakeFetch } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base, "test:acme-video-fail");
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const startRes = await fetch(`${base}${VIDEO_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Acme storm cloud",
        model: "veo-3.1-fast-generate-preview",
        actor: editor.actor,
      }),
    });
    expect(startRes.status).toBe(202);
    const started = (await startRes.json()) as VideoGenerateResponse;

    await clock.advance(1_000, () => daemon.jobs.settled());
    const snap = await daemon.engine.getSnapshot(canvasId);
    const failedJob = jobOf(snap.canvas.items[started.itemId]);
    expect(failedJob?.state).toBe("failed");
    expect(failedJob?.error).toContain("[key]");
    expect(failedJob?.error).not.toContain(SECRET_KEY);
  });
});
