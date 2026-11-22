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
  type CanvasContents,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP, USER_KEYS_ROUTE } from "@isocan/core/keys";
import { modelFor } from "@isocan/core/models";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  AGENT_DESCRIPTION_PROP,
  DESCRIBE_ROUTE,
  buildDescribePrompt,
  describeModule,
  isDescribableKind,
  type DescribeItemResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-describe-test-"));
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

async function mintEditor(base: string, sessionKey = "test:acme-describe"): Promise<{ badge: StoredBadge; actor: Actor }> {
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
      op: { type: "project.create", canvasId, title: "Acme Describe Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

async function addItem(
  base: string,
  badge: StoredBadge,
  actor: Actor,
  canvasId: string,
  opts: { bytes: Uint8Array; mimeType: string; filename: string; title: string },
): Promise<string> {
  const upRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...authHeaders(badge),
      "Content-Type": opts.mimeType,
      [FILENAME_HEADER]: encodeURIComponent(opts.filename),
    },
    body: new Uint8Array(opts.bytes),
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
        height: 320,
        placement: { x: 0, y: 0 },
        title: opts.title,
      },
    }),
  });
  expect(opRes.status).toBe(200);
  return itemId;
}

describe("@isocan/describe core", () => {
  it("recognizes describable kinds and builds caption-first prompts", () => {
    expect(isDescribableKind("image")).toBe(true);
    expect(isDescribableKind("video")).toBe(true);
    expect(isDescribableKind("document")).toBe(true);
    expect(isDescribableKind("screen")).toBe(true);
    expect(isDescribableKind("area")).toBe(false);

    const imgPrompt = buildDescribePrompt("image", "Acme Hero");
    expect(imgPrompt).toContain("Begin with a caption");
    expect(imgPrompt).toContain("Style/medium:");
    expect(imgPrompt).toContain("Acme Hero");

    const screenPrompt = buildDescribePrompt("screen", "Acme Checkout");
    expect(screenPrompt).toContain("Begin with a caption");
    expect(screenPrompt).toContain("UI screen");
  });

  it("exposes items carrying agentDescription in contextPieces", () => {
    const empty: CanvasContents = { items: {}, threads: {}, trash: [], agents: {} };
    expect(describeModule.contextPieces?.(empty)).toEqual([]);

    const canvas: CanvasContents = {
      items: {
        itm_acme1: {
          id: "itm_acme1",
          title: "Acme Fox",
          description: "",
          x: 0,
          y: 0,
          width: 400,
          height: 300,
          versions: [],
          currentVersionId: "ver_1",
          properties: {
            [AGENT_DESCRIPTION_PROP]: "Red fox asleep in fresh snow. Warm daylight casts soft blue shadows.",
          },
          reactions: {},
          createdBy: { id: "usr_acme", name: "Acme Editor" },
          updatedBy: { id: "usr_acme", name: "Acme Editor" },
          createdAt: "2026-11-19T12:00:00.000Z",
          updatedAt: "2026-11-19T12:05:00.000Z",
        },
      },
      threads: {},
      trash: [],
      agents: {},
    };
    const pieces = describeModule.contextPieces?.(canvas) ?? [];
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({
      name: "Agent descriptions",
      source: "canvas",
      present: true,
    });
    expect(pieces[0]!.size).toContain("Acme Fox: Red fox asleep in fresh snow.");
  });
});

describe("@isocan/describe server route", () => {
  it("reads the item blob, calls Gemini with modelFor('utility'), writes agentDescription + credentialRef via item.update, and honors BYOK", async () => {
    const home = await mkHome();
    const FAKE_ENV_KEY = "acme-gemini-secret-ENV-9876543210";
    const FAKE_USER_KEY = "acme-gemini-secret-BYOK-1234567890";
    const expectedModel = modelFor("utility").id;
    const calls: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = [];

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, key: headers.get("x-goog-api-key"), body });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "internal scratch thought", thought: true },
                  {
                    text: "Minimalist Acme poster with warm terracotta geometric arches.\nStyle/medium: Flat vector poster.\nPalette: Terracotta, cream, charcoal.\nLighting: Even studio illumination.",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const daemon = await boot(home, {
      modules: {
        describe: {
          key: () => FAKE_ENV_KEY,
          fetch: fakeFetch,
        },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // 1) Image item described with env key -> sends inlineData base64 + modelFor("utility").
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const imageItemId = await addItem(base, editor.badge, editor.actor, canvasId, {
      bytes: pngBytes,
      mimeType: "image/png",
      filename: "acme-poster.png",
      title: "Acme Poster",
    });

    const res = await fetch(`${base}${DESCRIBE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: imageItemId, actor: editor.actor }),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as DescribeItemResponse;
    expect(payload.itemId).toBe(imageItemId);
    expect(payload.model).toBe(expectedModel);
    expect(payload.credentialRef).toBe("env:gemini");
    expect(payload.agentDescription).toContain("Minimalist Acme poster");
    expect(payload.agentDescription).not.toContain("internal scratch thought");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(`/models/${encodeURIComponent(expectedModel)}:generateContent`);
    expect(calls[0]!.key).toBe(FAKE_ENV_KEY);
    const sentParts = ((calls[0]!.body.contents as Array<{ parts: Array<Record<string, unknown>> }>)[0]!.parts);
    expect(sentParts[1]).toEqual({
      inlineData: {
        mimeType: "image/png",
        data: Buffer.from(pngBytes).toString("base64"),
      },
    });

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const updatedImg = snap1.canvas.items[imageItemId]!;
    expect(updatedImg.properties[AGENT_DESCRIPTION_PROP]).toBe(payload.agentDescription);
    expect(updatedImg.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    // 2) Store per-user BYOK key and describe a screen item with omitted `actor` -> uses BYOK + defaultActor.
    const putKeyRes = await fetch(`${base}${USER_KEYS_ROUTE}/gemini`, {
      method: "PUT",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ key: FAKE_USER_KEY }),
    });
    expect(putKeyRes.status).toBe(200);

    const screenItemId = await addItem(base, editor.badge, editor.actor, canvasId, {
      bytes: new TextEncoder().encode("<!doctype html><main><h1>Acme Checkout</h1><button>Pay $12</button></main>"),
      mimeType: "text/html",
      filename: "acme-checkout.html",
      title: "Acme Checkout",
    });

    const res2 = await fetch(`${base}${DESCRIBE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: screenItemId }),
    });
    expect(res2.status).toBe(200);
    const payload2 = (await res2.json()) as DescribeItemResponse;
    expect(payload2.credentialRef).toBe(`user:${editor.actor.id}:gemini:v1`);
    expect(calls[1]!.key).toBe(FAKE_USER_KEY);
    const screenParts = ((calls[1]!.body.contents as Array<{ parts: Array<{ text?: string }> }>)[0]!.parts);
    expect(screenParts[1]!.text).toContain("Acme Checkout");

    const snap2 = await daemon.engine.getSnapshot(canvasId);
    expect(snap2.canvas.items[screenItemId]!.properties[CREDENTIAL_REF_PROP]).toBe(`user:${editor.actor.id}:gemini:v1`);
    expect(describeModule.contextPieces?.(snap2.canvas)[0]?.size).toContain("2 items");
  });

  it("never leaks API key material on upstream HTTP errors or network failures", async () => {
    const home = await mkHome();
    const SECRET_KEY = "acme-SUPER-SECRET-GEMINI-KEY-DO-NOT-LEAK";
    let mode: "http-error" | "throw" = "http-error";

    const fakeFetch: typeof fetch = async () => {
      if (mode === "http-error") {
        return new Response(
          JSON.stringify({ error: { message: `API key ${SECRET_KEY} rejected by quota guard` } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`socket reset while sending key=${SECRET_KEY}`);
    };

    const daemon = await boot(home, {
      modules: {
        describe: {
          key: () => SECRET_KEY,
          fetch: fakeFetch,
        },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base, "test:acme-describe-errors");
    const canvasId = await createCanvas(base, editor.badge, editor.actor);
    const docId = await addItem(base, editor.badge, editor.actor, canvasId, {
      bytes: new TextEncoder().encode("# Acme Notes\nShort test note."),
      mimeType: "text/markdown",
      filename: "acme-notes.md",
      title: "Acme Notes",
    });

    const err1 = await fetch(`${base}${DESCRIBE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: docId, actor: editor.actor }),
    });
    expect(err1.status).toBe(502);
    const body1 = await err1.text();
    expect(body1).not.toContain(SECRET_KEY);
    expect(body1).toContain("[key]");

    mode = "throw";
    const err2 = await fetch(`${base}${DESCRIBE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, itemId: docId, actor: editor.actor }),
    });
    expect(err2.status).toBe(502);
    const body2 = await err2.text();
    expect(body2).not.toContain(SECRET_KEY);
    expect(body2).toContain("[key]");
  });
});
