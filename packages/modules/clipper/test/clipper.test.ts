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
import { existsSync, readFileSync, promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  newCanvasId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  CLIPPER_CAPTURE_ROUTE,
  CLIPPER_PROPS,
  clipperModule,
  validateClipPayload,
  type ClipCaptureResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    await cleanup.pop()!();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-clipper-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  return `http://127.0.0.1:${(d.app.server.address() as AddressInfo).port}`;
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

function authHeaders(badge: StoredBadge): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    "Content-Type": "application/json",
  };
}

async function mintEditor(base: string): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(knocked.badge),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Clipper" },
      op: { type: "actor.claim", sessionKey: "test:acme-clip", name: "Acme Clipper" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge: knocked.badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Clipper Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("@isocan/clipper core & MV3 extension", () => {
  it("rejects javascript:/file: URLs and oversized payloads", () => {
    expect(validateClipPayload({ canvasId: "prj_1", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateClipPayload({ canvasId: "prj_1", url: "file:///etc/passwd" }).ok).toBe(false);
    expect(
      validateClipPayload({ canvasId: "prj_1", url: "https://acme.example", selection: "x".repeat(200) }, 64).ok,
    ).toBe(false);

    const ok = validateClipPayload({
      canvasId: "prj_1",
      url: "https://acme.example/blog",
      title: "Acme Post",
      selection: "Key quote.",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.payload.kind).toBe("document");
  });

  it("ships a valid Chrome MV3 extension bundle", () => {
    const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../extension");
    expect(existsSync(path.join(extDir, "manifest.json"))).toBe(true);
    expect(existsSync(path.join(extDir, "popup.html"))).toBe(true);
    expect(existsSync(path.join(extDir, "background.js"))).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(extDir, "manifest.json"), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe("background.js");
  });
});

describe("@isocan/clipper server route", () => {
  it("ingests document, site, and image clips stamped with clipper.* properties", async () => {
    const home = await mkHome();
    const daemon = await boot(home, {
      modules: {
        clipper: { now: () => Date.parse("2026-11-21T12:00:00.000Z") },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // Reject javascript: URL with 400
    const badRes = await fetch(`${base}${CLIPPER_CAPTURE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({ canvasId, url: "javascript:void(0)", actor: editor.actor }),
    });
    expect(badRes.status).toBe(400);

    // 1) Document selection clip
    const docRes = await fetch(`${base}${CLIPPER_CAPTURE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        url: "https://acme.example/article",
        title: "Acme Article",
        selection: "Important excerpt from Acme.",
        actor: editor.actor,
      }),
    });
    expect(docRes.status).toBe(200);
    const doc = (await docRes.json()) as ClipCaptureResponse;
    expect(doc.kind).toBe("document");
    expect(doc.mimeType).toBe("text/markdown");

    // 2) HTML site clip
    const siteRes = await fetch(`${base}${CLIPPER_CAPTURE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        url: "https://acme.example/pricing",
        title: "Acme Pricing",
        html: "<!doctype html><html><body><h1>Pricing</h1></body></html>",
        actor: editor.actor,
      }),
    });
    expect(siteRes.status).toBe(200);
    const site = (await siteRes.json()) as ClipCaptureResponse;
    expect(site.kind).toBe("site");
    expect(site.mimeType).toBe("text/html");

    // 3) Image clip
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    const imgRes = await fetch(`${base}${CLIPPER_CAPTURE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        url: "https://acme.example/hero",
        title: "Acme Hero Shot",
        imageBase64: pngBase64,
        mimeType: "image/png",
        actor: editor.actor,
      }),
    });
    expect(imgRes.status).toBe(200);
    const img = (await imgRes.json()) as ClipCaptureResponse;
    expect(img.kind).toBe("image");
    expect(img.mimeType).toBe("image/png");

    const snap = await daemon.engine.getSnapshot(canvasId);
    expect(snap.canvas.items[doc.itemId]!.properties[CLIPPER_PROPS.sourceUrl]).toBe("https://acme.example/article");
    expect(snap.canvas.items[doc.itemId]!.properties[CLIPPER_PROPS.capturedAt]).toBe("2026-11-21T12:00:00.000Z");
    expect(clipperModule.contextPieces?.(snap.canvas)[0]?.size).toContain("3 clips");
  });
});
