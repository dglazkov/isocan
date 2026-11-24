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
import { Command } from "commander";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  FILENAME_HEADER,
  askTheDoor,
  bearerHeader,
  itemKind,
  mimeFromName,
  newCanvasId,
  newItemId,
  newVersionId,
  registerModule,
  unregisterModule,
  type Actor,
  type CanvasContents,
  type Item,
  type StoredBadge,
} from "@isocan/core";
import { DaemonRoutes } from "../../../api/src/routes.ts";
import type { CliHost } from "../../../cli/src/modulehost.ts";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  GLB_BIN_CHUNK_TYPE,
  GLB_JSON_CHUNK_TYPE,
  GLB_MAGIC,
  GLB_MIME,
  MODEL3D_PROPS,
  formatCameraPose,
  model3dModule,
  parseCameraPose,
  parseGlbHeader,
} from "../src/core.ts";
import { model3dCli } from "../src/cli.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  unregisterModule(model3dModule.name);
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

/** Build a synthetic 4-byte aligned GLB 2.0 binary container from JSON + optional BIN bytes. */
function makeGlb(scene: Record<string, unknown>, bin?: Uint8Array, overrides?: { magic?: number; version?: number }): Uint8Array {
  const rawJson = new TextEncoder().encode(JSON.stringify(scene));
  const jsonPad = (4 - (rawJson.byteLength % 4)) % 4;
  const jsonChunkLen = rawJson.byteLength + jsonPad;

  const binPad = bin ? (4 - (bin.byteLength % 4)) % 4 : 0;
  const binChunkLen = bin ? bin.byteLength + binPad : 0;
  const totalLen = 12 + 8 + jsonChunkLen + (bin ? 8 + binChunkLen : 0);

  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);
  view.setUint32(0, overrides?.magic ?? GLB_MAGIC, true);
  view.setUint32(4, overrides?.version ?? 2, true);
  view.setUint32(8, totalLen, true);

  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, GLB_JSON_CHUNK_TYPE, true);
  out.set(rawJson, 20);
  out.fill(0x20, 20 + rawJson.byteLength, 20 + jsonChunkLen);

  if (bin) {
    const binOffset = 20 + jsonChunkLen;
    view.setUint32(binOffset, binChunkLen, true);
    view.setUint32(binOffset + 4, GLB_BIN_CHUNK_TYPE, true);
    out.set(bin, binOffset + 8);
  }

  return out;
}

function fakeGlbItem(): Item {
  return {
    id: "itm_acme_glb",
    title: "Acme Chair",
    description: "",
    x: 0,
    y: 0,
    width: 420,
    height: 320,
    versions: [
      {
        id: "ver_1",
        blobHash: "sha256_glb",
        mimeType: GLB_MIME,
        filename: "acme-chair.glb",
        size: 64,
        createdAt: "2026-11-20T00:00:00.000Z",
        createdBy: { id: "usr_acme", name: "Acme Editor" },
      },
    ],
    currentVersionId: "ver_1",
    properties: {},
    reactions: {},
    createdBy: { id: "usr_acme", name: "Acme Editor" },
    updatedBy: { id: "usr_acme", name: "Acme Editor" },
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  };
}

describe("@isocan/model3d core", () => {
  it("validates a self-contained synthetic GLB 2.0 buffer with embedded BIN chunk and data URI", () => {
    const bin = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const glb = makeGlb(
      {
        asset: { version: "2.0", generator: "Acme Synthetic" },
        buffers: [{ byteLength: bin.byteLength }],
        images: [{ uri: "data:image/png;base64,iVBORw0KGgo=" }],
        meshes: [{ name: "AcmeBox", primitives: [] }],
        nodes: [{ name: "Root", mesh: 0 }],
        extras: { uri: "https://acme.example/ignored-in-extras" },
      },
      bin,
    );

    const res = parseGlbHeader(glb);
    expect(res).toEqual({
      valid: true,
      version: 2,
      byteLength: glb.byteLength,
      jsonByteLength: expect.any(Number),
      binByteLength: 8,
      meshCount: 1,
      nodeCount: 1,
      hasExternalRefs: false,
    });
  });

  it("rejects invalid magic bytes, unsupported versions, and malformed lengths", () => {
    const badMagic = makeGlb({ asset: { version: "2.0" } }, undefined, { magic: 0xdeadbeef });
    const magicRes = parseGlbHeader(badMagic);
    expect(magicRes.valid).toBe(false);
    expect(magicRes.error).toContain("invalid GLB magic");

    const badVersion = makeGlb({ asset: { version: "2.0" } }, undefined, { version: 1 });
    const verRes = parseGlbHeader(badVersion);
    expect(verRes.valid).toBe(false);
    expect(verRes.error).toContain("unsupported GLB version");

    const tooShort = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
    expect(parseGlbHeader(tooShort).valid).toBe(false);
  });

  it("rejects GLB files containing external URI references", () => {
    const externalBuf = makeGlb({
      asset: { version: "2.0" },
      buffers: [{ byteLength: 16, uri: "https://acme.example/external.bin" }],
    });
    const res1 = parseGlbHeader(externalBuf);
    expect(res1.valid).toBe(false);
    expect(res1.hasExternalRefs).toBe(true);
    expect(res1.error).toContain("external URI");

    const relativeTex = makeGlb({
      asset: { version: "2.0" },
      images: [{ uri: "textures/acme-albedo.png" }],
    });
    const res2 = parseGlbHeader(relativeTex);
    expect(res2.valid).toBe(false);
    expect(res2.hasExternalRefs).toBe(true);
  });

  it("registers the model3d kind for model/gltf-binary and .glb, and parses camera poses", () => {
    expect(itemKind(fakeGlbItem())).toBe("other");

    registerModule(model3dModule);
    expect(itemKind(fakeGlbItem())).toBe("model3d");
    expect(mimeFromName("acme-chair.glb")).toBe(GLB_MIME);

    unregisterModule(model3dModule.name);
    expect(itemKind(fakeGlbItem())).toBe("other");

    expect(parseCameraPose("45, 22.5, 4")).toEqual({ azimuth: 45, elevation: 22.5, distance: 4 });
    expect(formatCameraPose({ azimuth: 45.126, elevation: 20, distance: 3 })).toBe("45.13,20,3");
    expect(parseCameraPose("45,20,0")).toBeNull();
    expect(parseCameraPose("not-a-pose")).toBeNull();

    const model = fakeGlbItem();
    const poster: Item = { ...fakeGlbItem(), id: "itm_acme_poster", title: "Acme Poster" };
    model.properties[MODEL3D_PROPS.posterItem] = poster.id;
    const canvas: CanvasContents = { items: { [model.id]: model, [poster.id]: poster }, threads: {}, trash: [], agents: {} };
    expect(model3dModule.edges?.(canvas)).toEqual([{ from: model, to: poster }]);
  });
});

describe("@isocan/model3d CLI", () => {
  it("inspects a GLB item and captures a camera pose + poster snapshot against a live daemon", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-model3d-test-"));
    cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

    const daemon: Daemon = await startDaemon({
      home: dir,
      port: 0,
      contentPort: "off",
      gcIntervalMs: 0,
      blobCheckIntervalMs: 0,
    });
    cleanup.push(() => daemon.close());

    const base = `http://127.0.0.1:${(daemon.app.server.address() as AddressInfo).port}`;
    const knocked = await askTheDoor(base);
    if (!("badge" in knocked)) throw new Error(knocked.refused.error);
    const badge: StoredBadge = knocked.badge;
    const headers = (json = false): Record<string, string> => ({
      ...bearerHeader(badge),
      [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
      ...(json ? { "Content-Type": "application/json" } : {}),
    });

    const claimRes = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        canvasId: null,
        actor: { id: "", name: "Acme 3D Editor" },
        op: { type: "actor.claim", sessionKey: "test:acme-3d", name: "Acme 3D Editor" },
      }),
    });
    const actor = ((await claimRes.json()) as { envelope: { actor: Actor } }).envelope.actor;

    const canvasId = newCanvasId();
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        canvasId: null,
        actor,
        op: { type: "project.create", canvasId, title: "Acme 3D Canvas" },
      }),
    });

    const glbBytes = makeGlb({
      asset: { version: "2.0" },
      meshes: [{ name: "AcmeMesh", primitives: [] }],
    });
    const upRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": GLB_MIME,
        [FILENAME_HEADER]: encodeURIComponent("acme-sculpture.glb"),
      },
      body: new Uint8Array(glbBytes),
    });
    expect(upRes.status).toBe(200);
    const blob = (await upRes.json()) as { blobHash: string; size: number };

    const itemId = newItemId();
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        canvasId,
        actor,
        op: {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: blob.blobHash,
            mimeType: GLB_MIME,
            filename: "acme-sculpture.glb",
            size: blob.size,
          },
          width: 420,
          height: 320,
          placement: { x: 0, y: 0 },
          title: "Acme Sculpture",
        },
      }),
    });

    const client = new DaemonRoutes(base, {
      read: async () => badge,
      keep: async () => {},
    });
    const printed: unknown[] = [];

    const program = new Command();
    program.exitOverride();
    const host = {
      program,
      run: (fn: (...args: unknown[]) => Promise<void>) => fn,
      ctxOf: async () => ({ client, actor, json: true }),
      resolveCanvas: async () => ({ id: canvasId, title: "Acme 3D Canvas" }),
      resolveItem: (snap: { canvas: CanvasContents }, ref: string) => {
        const found = snap.canvas.items[ref];
        if (!found) throw new Error(`missing ${ref}`);
        return found;
      },
      sendOp: async (_ctx: unknown, cid: string | null, op: Parameters<DaemonRoutes["sendOp"]>[2], group?: string) =>
        client.sendOp(cid, actor, op, undefined, undefined, group),
      printJson: (val: unknown) => {
        printed.push(val);
      },
    } as unknown as CliHost;

    model3dCli.register(host);

    // 1) Run `model3d inspect <item>`
    await program.parseAsync(["node", "isocan", "model3d", "inspect", itemId]);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatchObject({
      itemId,
      title: "Acme Sculpture",
      mimeType: GLB_MIME,
      valid: true,
      version: 2,
      byteLength: glbBytes.byteLength,
      meshCount: 1,
      hasExternalRefs: false,
      camera: null,
      posterItem: null,
    });

    // 2) Run `model3d capture-view <item> --pose 60,15,2.5 --poster <file>`
    const posterPath = path.join(dir, "acme-poster.png");
    await fs.writeFile(posterPath, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await program.parseAsync([
      "node",
      "isocan",
      "model3d",
      "capture-view",
      itemId,
      "--pose",
      "60,15,2.5",
      "--poster",
      posterPath,
    ]);
    expect(printed).toHaveLength(2);
    const captureOut = printed[1] as { itemId: string; camera: string; posterItem: string };
    expect(captureOut.itemId).toBe(itemId);
    expect(captureOut.camera).toBe("60,15,2.5");
    expect(captureOut.posterItem).toMatch(/^itm_/);

    const snapAfter = await daemon.engine.getSnapshot(canvasId);
    expect(snapAfter.canvas.items[itemId]!.properties[MODEL3D_PROPS.camera]).toBe("60,15,2.5");
    expect(snapAfter.canvas.items[itemId]!.properties[MODEL3D_PROPS.posterItem]).toBe(captureOut.posterItem);
    const posterItem = snapAfter.canvas.items[captureOut.posterItem]!;
    expect(posterItem.properties["derived-from"]).toBe(itemId);
    expect(posterItem.versions[0]!.mimeType).toBe("image/png");
  });
});
