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
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  IMAGE_GENERATE_ROUTE,
  IMAGE_PROPS,
  imageFilename,
  validateImagePrompt,
  type ImageGenerateResponse,
} from "../src/core.ts";
import { clearImageIdempotencyCache } from "../src/server.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  clearImageIdempotencyCache();
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-image-test-"));
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

async function mintEditor(base: string, sessionKey = "test:acme-image"): Promise<{ badge: StoredBadge; actor: Actor }> {
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
      op: { type: "project.create", canvasId, title: "Acme Image Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

async function addSeedImage(base: string, badge: StoredBadge, actor: Actor, canvasId: string): Promise<string> {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const upRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...authHeaders(badge),
      "Content-Type": "image/png",
      [FILENAME_HEADER]: "acme-seed.png",
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
          filename: "acme-seed.png",
          size: blob.size,
        },
        width: 512,
        height: 512,
        placement: { x: 0, y: 0 },
        title: "Acme Seed Image",
      },
    }),
  });
  expect(opRes.status).toBe(200);
  return itemId;
}

describe("@isocan/image core", () => {
  it("validates prompts and derives safe image filenames", () => {
    expect(validateImagePrompt("  Acme ceramic mug  ")).toEqual({ ok: true, prompt: "Acme ceramic mug" });
    expect(validateImagePrompt("   ").ok).toBe(false);
    expect(imageFilename("Acme Studio Lamp!", "image/png")).toBe("acme-studio-lamp.png");
    expect(imageFilename("Acme Sunset", "image/jpeg")).toBe("acme-sunset.jpg");
  });
});

describe("@isocan/image server route", () => {
  it("generates an image, serves idempotent retries from cache, and stacks edits with derived-from + credentialRef", async () => {
    const home = await mkHome();
    const FAKE_KEY = "acme-image-secret-KEY-1234";
    const pngGen = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 10, 20, 30]);
    const pngEdit = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 40, 50, 60]);

    let calls = 0;
    const seenBodies: Array<Record<string, unknown>> = [];

    const fakeFetch: typeof fetch = async (input, init) => {
      calls++;
      const url = String(input);
      expect(url).toContain(":generateContent");
      const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      seenBodies.push(parsed);
      const isEdit = ((parsed.contents as Array<{ parts?: unknown[] }>)?.[0]?.parts?.length ?? 0) > 1;
      const bytes = isEdit ? pngEdit : pngGen;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from(bytes).toString("base64") } }],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const daemon = await boot(home, {
      modules: { image: { key: () => FAKE_KEY, fetch: fakeFetch } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // 1) Sync generation with idempotencyKey
    const genRes = await fetch(`${base}${IMAGE_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Acme porcelain vase in morning light",
        idempotencyKey: "acme-req-001",
        actor: editor.actor,
      }),
    });
    expect(genRes.status).toBe(200);
    const first = (await genRes.json()) as ImageGenerateResponse;
    expect(first.itemId).toBeTruthy();
    expect(first.versionId).toBeTruthy();
    expect(first.credentialRef).toBe("env:gemini");
    expect(calls).toBe(1);

    // 2) Duplicate idempotencyKey hits in-memory cache without calling upstream
    const dupRes = await fetch(`${base}${IMAGE_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Acme porcelain vase in morning light",
        idempotencyKey: "acme-req-001",
        actor: editor.actor,
      }),
    });
    expect(dupRes.status).toBe(200);
    const cached = (await dupRes.json()) as ImageGenerateResponse;
    expect(cached.itemId).toBe(first.itemId);
    expect(cached.versionId).toBe(first.versionId);
    expect(cached.cached).toBe(true);
    expect(calls).toBe(1);

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const genItem = snap1.canvas.items[first.itemId]!;
    expect(genItem.properties[IMAGE_PROPS.prompt]).toBe("Acme porcelain vase in morning light");
    expect(genItem.properties[IMAGE_PROPS.idempotencyKey]).toBe("acme-req-001");
    expect(genItem.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    // 3) Edit existing item stacks a new version and stamps parent + derived-from + credentialRef
    const seedId = await addSeedImage(base, editor.badge, editor.actor, canvasId);
    const editRes = await fetch(`${base}${IMAGE_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Add warm brass rim lighting",
        editItem: seedId,
        actor: editor.actor,
      }),
    });
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as ImageGenerateResponse;
    expect(edited.itemId).toBe(seedId);
    expect(calls).toBe(2);

    const snap2 = await daemon.engine.getSnapshot(canvasId);
    const editedItem = snap2.canvas.items[seedId]!;
    expect(editedItem.versions).toHaveLength(2);
    expect(editedItem.currentVersionId).toBe(edited.versionId);
    expect(editedItem.properties.parent).toBe(seedId);
    expect(editedItem.properties["derived-from"]).toBe(seedId);
    expect(editedItem.properties[IMAGE_PROPS.sourceItem]).toBe(seedId);
    expect(editedItem.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    const dlEdit = await fetch(`${base}/api/projects/${canvasId}/blobs/${edited.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(new Uint8Array(await dlEdit.arrayBuffer())).toEqual(pngEdit);
  });

  it("scrubs key material when upstream image generation fails", async () => {
    const home = await mkHome();
    const SECRET_KEY = "acme-image-SECRET-DO-NOT-LEAK";

    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: { message: `invalid key ${SECRET_KEY} for image request` } }),
        { status: 403, headers: { "content-type": "application/json" } },
      );

    const daemon = await boot(home, {
      modules: { image: { key: () => SECRET_KEY, fetch: fakeFetch } },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base, "test:acme-image-fail");
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const res = await fetch(`${base}${IMAGE_GENERATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Acme storm cloud",
        actor: editor.actor,
      }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("[key]");
    expect(body.error).not.toContain(SECRET_KEY);
  });
});
