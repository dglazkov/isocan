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

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { promises as fs, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  newCanvasId,
  newItemId,
  newVersionId,
  type Actor,
  type BadgeStore,
  type StoredBadge,
} from "@isocan/core";
import { CanvasGroups, DaemonRoutes } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import type { Ctx } from "../src/ctx.ts";
import { registerCanvasGroups } from "../src/canvas-groups.ts";
import {
  applyTitleSourceOption,
  moveWithMakeRoomGroup,
  resolveActualSize,
} from "../src/physics.ts";

/**
 * **Phase 1B CLI physics flags** (`--actual-size`, `--source`, `--make-room`,
 * `canvas group wrap/layout --infer`) verified in-process against a real
 * `startDaemon` and `DaemonRoutes` client.
 */

function memoryBadges(): BadgeStore {
  let stored: StoredBadge | null = null;
  return {
    async read() {
      return stored;
    },
    async keep(badge) {
      stored = badge;
    },
  };
}

/** Minimal valid PNG header carrying exact width × height in IHDR. */
function makePngBytes(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write("IHDR", 12, 4, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 6; // RGBA
  return buf;
}

let home: string;
let daemon: Daemon;
let client: DaemonRoutes;
let actor: Actor;
let canvasId: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cli-physics-"));
  daemon = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
  });
  const badges = memoryBadges();
  const port = (daemon.app.server.address() as AddressInfo).port;
  client = new DaemonRoutes(`http://127.0.0.1:${port}`, badges);
  const claimed = await client.sendOp(null, { id: "", name: "Acme Physics" }, {
    type: "actor.claim",
    sessionKey: "test:cli-physics",
    name: "Acme Physics",
  });
  actor = claimed.envelope.actor;

  canvasId = newCanvasId();
  await client.sendOp(null, actor, {
    type: "project.create",
    canvasId,
    title: "Acme Physics Board",
  });
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function addItem(opts: {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes?: Buffer;
  mimeType?: string;
  filename?: string;
  properties?: Record<string, string>;
}): Promise<string> {
  const bytes = opts.bytes ?? Buffer.from(`# ${opts.title}\n`, "utf8");
  const mimeType = opts.mimeType ?? "text/markdown";
  const filename = opts.filename ?? `${opts.title.toLowerCase().replace(/\s+/g, "-")}.md`;
  const uploaded = await client.uploadBlob(canvasId, bytes, mimeType, filename);
  const id = newItemId();
  await client.sendOp(canvasId, actor, {
    type: "item.add",
    itemId: id,
    title: opts.title,
    description: "",
    width: opts.width,
    height: opts.height,
    placement: { x: opts.x, y: opts.y, chosen: true },
    properties: opts.properties ?? {},
    version: {
      id: newVersionId(),
      blobHash: uploaded.blobHash,
      mimeType,
      filename,
      size: uploaded.size,
    },
  });
  return id;
}

async function runGroupCmd(...args: string[]): Promise<{ out: string; err: string; code: number }> {
  const outputs: string[] = [];
  const errors: string[] = [];
  vi.spyOn(console, "log").mockImplementation((val) => outputs.push(String(val)));
  vi.spyOn(console, "error").mockImplementation((val) => errors.push(String(val)));

  const program = new Command().option("--json");
  const canvas = program.command("canvas");
  registerCanvasGroups(canvas, async (cmd) => {
    const opts = cmd.optsWithGlobals() as { json?: boolean };
    return {
      client,
      actor,
      canvasRef: canvasId,
      json: Boolean(opts.json),
    } as unknown as Ctx;
  });

  await program.parseAsync(["node", "isocan", ...args]);
  return {
    out: outputs.join("\n"),
    err: errors.join("\n"),
    code: Number(process.exitCode ?? 0),
  };
}

describe("Phase 1B CLI flags", () => {
  it("registers --make-room on mv and --actual-size / --source on set in main.ts", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const mainSource = readFileSync(path.resolve(here, "../src/main.ts"), "utf8");
    expect(mainSource).toContain('.option("--make-room"');
    expect(mainSource).toContain('.option("--actual-size"');
    expect(mainSource).toContain('.option("--source <source>"');
  });

  it("resolves --actual-size from a real uploaded PNG blob header", async () => {
    const imgId = await addItem({
      title: "Acme Photo",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      bytes: makePngBytes(1600, 900),
      mimeType: "image/png",
      filename: "acme-photo.png",
    });

    const snap = await client.snapshot(canvasId);
    const size = await resolveActualSize({ client }, canvasId, snap.canvas.items[imgId]!);
    expect(size).toEqual({ width: 1600, height: 900 });

    await new CanvasGroups(client, canvasId, () => actor).resize(imgId, size);
    const after = await client.snapshot(canvasId);
    expect(after.canvas.items[imgId]).toMatchObject({ width: 1600, height: 900 });
  });

  it("enforces --source <user|agent|auto> CAS precedence without clobbering human names", async () => {
    const id = await addItem({ title: "Untitled", x: 0, y: 1200, width: 200, height: 120 });
    const groups = new CanvasGroups(client, canvasId, () => actor);

    // Auto sets titleSource=auto on an unsourced item.
    const snap0 = await client.snapshot(canvasId);
    const patchAuto: { title?: string; properties?: Record<string, string> } = { title: "Auto Draft" };
    expect(applyTitleSourceOption(snap0.canvas.items[id]!, { title: "Auto Draft", source: "auto" }, patchAuto).blocked).toBe(false);
    await groups.update(id, { patch: patchAuto });

    // User overwrites auto and stamps titleSource=user.
    const snap1 = await client.snapshot(canvasId);
    const patchUser: { title?: string; properties?: Record<string, string> } = { title: "Human Title" };
    expect(applyTitleSourceOption(snap1.canvas.items[id]!, { title: "Human Title", source: "user" }, patchUser).blocked).toBe(false);
    await groups.update(id, { patch: patchUser });

    // Agent and Auto are both blocked from overwriting a user-authored title.
    const snap2 = await client.snapshot(canvasId);
    const patchAgent: { title?: string; properties?: Record<string, string> } = { title: "Agent Suggestion" };
    const casAgent = applyTitleSourceOption(snap2.canvas.items[id]!, { title: "Agent Suggestion", source: "agent" }, patchAgent);
    expect(casAgent).toMatchObject({ blocked: true, currentSource: "user", incoming: "agent" });
    expect(patchAgent.title).toBeUndefined();

    expect(() => applyTitleSourceOption(snap2.canvas.items[id]!, { title: "X", source: "bogus" }, {})).toThrow(/--source expects/);
    expect(() => applyTitleSourceOption(snap2.canvas.items[id]!, { source: "auto" }, {})).toThrow(/--source requires --title/);
  });

  it("pushes colliding neighbours cleanly in one atomic op via mv --make-room", async () => {
    const mover = await addItem({ title: "Acme Mover", x: 0, y: 2000, width: 100, height: 100 });
    const neighbour = await addItem({ title: "Acme Neighbour", x: 200, y: 2000, width: 100, height: 100 });
    const pinned = await addItem({
      title: "Acme Pinned",
      x: 200,
      y: 2060,
      width: 100,
      height: 100,
      properties: { pinned: "true" },
    });

    const before = await client.snapshot(canvasId);
    const result = await moveWithMakeRoomGroup(
      { client, actor },
      canvasId,
      before.canvas,
      before.canvas.items[mover]!,
      { x: 160, y: 2000 },
      {},
    );
    expect(result.seq).toBeDefined();

    const after = await client.snapshot(canvasId);
    expect(after.canvas.items[mover]).toMatchObject({ x: 160, y: 2000 });
    expect(after.canvas.items[neighbour]!.x).toBeGreaterThanOrEqual(284);
    // Pinned item never moved.
    expect(after.canvas.items[pinned]).toMatchObject({ x: 200, y: 2060 });
  });

  it("infers layout cleanly via `isocan canvas group wrap --infer` and `canvas group layout --infer`", async () => {
    const a = await addItem({ title: "Row A", x: 0, y: 3000, width: 120, height: 80 });
    const b = await addItem({ title: "Row B", x: 155, y: 3009, width: 120, height: 80 });
    const c = await addItem({ title: "Row C", x: 305, y: 2994, width: 120, height: 80 });

    const wrapped = await runGroupCmd(
      "--json",
      "canvas",
      "group",
      "wrap",
      a,
      b,
      c,
      "--title",
      "Acme Row",
      "--infer",
    );
    expect(wrapped.code, wrapped.err).toBe(0);
    const parsedWrap = JSON.parse(wrapped.out) as { inferred: { layout: string; gap: number }; itemId: string };
    expect(parsedWrap.inferred.layout).toBe("horizontal");
    expect(parsedWrap.inferred.gap).toBe(24);

    const afterWrap = await client.snapshot(canvasId);
    expect(afterWrap.canvas.items[a]!.y).toBe(afterWrap.canvas.items[b]!.y);
    expect(afterWrap.canvas.items[b]!.y).toBe(afterWrap.canvas.items[c]!.y);
    expect(afterWrap.canvas.items[b]!.x - (afterWrap.canvas.items[a]!.x + 120)).toBe(24);

    // Re-running `canvas group layout <group> --infer` works on the existing group too.
    const relaid = await runGroupCmd("--json", "canvas", "group", "layout", parsedWrap.itemId, "--infer");
    expect(relaid.code, relaid.err).toBe(0);
    const parsedLayout = JSON.parse(relaid.out) as { inferred: { layout: string } };
    expect(parsedLayout.inferred.layout).toBe("horizontal");
  });
});
