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
import {
  handleForActor,
  isAgentStation,
  isAgentTrace,
  newCanvasId,
  newItemId,
  newThreadId,
  newVersionId,
  readCommentReceipt,
  type Actor,
  type BadgeStore,
  type StoredBadge,
} from "@isocan/core";
import { DaemonRoutes } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import {
  awaitPointPaintAck,
  buildReplyReceipt,
  ensureAgentStation,
  handlePreconditionConflict,
  parseDoingVerb,
  parseExpectFlag,
  runContextGraph,
  runContextView,
} from "../src/agent-semantics.ts";

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

let home: string;
let daemon: Daemon;
let client: DaemonRoutes;
let actor: Actor;
let canvasId: string;
let itemId: string;
let initialVersionId: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cli-agent-semantics-"));
  daemon = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
  });
  const port = (daemon.app.server.address() as AddressInfo).port;
  client = new DaemonRoutes(`http://127.0.0.1:${port}`, memoryBadges());
  actor = (
    await client.sendOp(null, { id: "", name: "Acme Builder" }, {
      type: "actor.claim",
      sessionKey: "test:cli-agent-semantics",
      name: "Acme Builder",
    })
  ).envelope.actor;

  canvasId = newCanvasId();
  await client.sendOp(null, actor, {
    type: "project.create",
    canvasId,
    title: "Acme Semantics Canvas",
  });

  const uploaded = await client.uploadBlob(canvasId, Buffer.from("# Acme Brief\n"), "text/markdown", "brief.md");
  itemId = newItemId();
  initialVersionId = newVersionId();
  await client.sendOp(canvasId, actor, {
    type: "item.add",
    itemId,
    title: "Acme Brief",
    width: 480,
    height: 320,
    placement: { x: 40, y: 40, chosen: true },
    properties: { agentDescription: "Primary brief for Acme launch" },
    version: {
      id: initialVersionId,
      blobHash: uploaded.blobHash,
      mimeType: "text/markdown",
      filename: "brief.md",
      size: uploaded.size,
    },
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

describe("Phase 2A CLI agent semantics", () => {
  it("wires all Phase 2A flags in main.ts", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const mainSource = readFileSync(path.resolve(here, "../src/main.ts"), "utf8");
    expect(mainSource).toContain('.option("--doing <verb>"');
    expect(mainSource).toContain('.option("--station"');
    expect(mainSource).toContain('.option("--role <role>"');
    expect(mainSource).toContain('.option("--ack"');
    expect(mainSource).toContain('.option("--expect <ver>"');
    expect(mainSource).toContain('.option("--receipt <item>"');
    expect(mainSource).toContain('.option("--graph"');
    expect(mainSource).toContain('.option("--nav"');
    expect(mainSource).toContain('.option("--view"');
  });

  it("creates an agent station with --station --role and reuses it on restart", async () => {
    const first = await ensureAgentStation({ client, actor }, canvasId, { role: "builder" });
    expect(first.created).toBe(true);
    expect(first.role).toBe("builder");
    expect(first.traceItemId).toBeTruthy();

    const snap = await client.snapshot(canvasId);
    const station = snap.canvas.items[first.stationItemId]!;
    const trace = snap.canvas.items[first.traceItemId!]!;
    expect(isAgentStation(station)).toBe(true);
    expect(station.title).toBe(`@${first.handle} · builder`);
    expect(isAgentTrace(trace)).toBe(true);

    // Calling again refreshes rather than duplicating
    const second = await ensureAgentStation({ client, actor }, canvasId, { role: "reviewer" });
    expect(second.created).toBe(false);
    expect(second.stationItemId).toBe(first.stationItemId);
  });

  it("updates session with explicit --doing verb and reports applied vs rendered on --ack", async () => {
    const verb = parseDoingVerb("writing");
    expect(verb).toBe("writing");
    expect(() => parseDoingVerb("flying")).toThrow(/--doing expects one of/);

    const handle = handleForActor(actor.id);
    const created = await client.createSession(canvasId, actor, "Acme Builder", undefined, undefined, handle);
    await client.updateSession(canvasId, created.sessionId, {
      action: verb,
      handle,
      cursor: { x: 100, y: 100 },
      viewport: { x: 0, y: 0, width: 600, height: 500, zoom: 1 },
    });

    const sessions = await client.listSessions(canvasId);
    const live = sessions.find((s) => s.sessionId === created.sessionId)!;
    expect(live.action).toBe("writing");
    expect(live.handle).toBe(handle);
    expect(live.viewport?.zoom).toBe(1);

    // Paint ack: applied before ack, rendered after ack
    const before = await awaitPointPaintAck({ client, actor }, canvasId, 20);
    expect(before.status).toBe("applied");

    const snap = await client.snapshot(canvasId);
    await client.recordPaintAck(canvasId, snap.lastSeq);
    const after = await awaitPointPaintAck({ client, actor }, canvasId, 50);
    expect(after.status).toBe("rendered");
  });

  it("renders context --graph, --nav, and --view against live canvas state", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((v) => out.push(String(v)));

    await runContextGraph({ client, actor, json: false }, canvasId, { nav: false });
    const fullText = out.join("\n");
    expect(fullText).toContain("# CONTEXT GRAPH:");
    expect(fullText).toContain("Primary brief for Acme launch");
    expect(fullText).toContain("## Active Agent Stations");
    expect(fullText).toContain("## Suggested Free Regions");

    out.length = 0;
    await runContextGraph({ client, actor, json: false }, canvasId, { nav: true });
    const navText = out.join("\n");
    expect(navText).toContain("# NAV INDEX:");
    expect(navText).not.toContain("Primary brief for Acme launch");

    out.length = 0;
    await runContextView({ client, actor, json: false }, canvasId);
    const viewText = out.join("\n");
    expect(viewText).toContain("viewport:");
    expect(viewText).toContain(itemId);
  });

  it("enforces edit --expect and formats 409 conflicts with exit code 4", async () => {
    expect(parseExpectFlag("ver_123")).toEqual({ versionId: "ver_123" });
    expect(parseExpectFlag("hash:abc123")).toEqual({ contentHash: "abc123" });

    // Matching expect succeeds
    const v2Blob = await client.uploadBlob(canvasId, Buffer.from("# Acme V2\n"), "text/markdown", "brief.md");
    const v2Id = newVersionId();
    await client.sendOp(canvasId, actor, {
      type: "item.addVersion",
      itemId,
      expect: parseExpectFlag(initialVersionId),
      version: {
        id: v2Id,
        blobHash: v2Blob.blobHash,
        mimeType: "text/markdown",
        filename: "brief.md",
        size: v2Blob.size,
      },
    });

    // Stale expect fails with 409 and handlePreconditionConflict sets exitCode 4
    const errs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((v) => errs.push(String(v)));
    let handled = false;
    try {
      await client.sendOp(canvasId, actor, {
        type: "item.addVersion",
        itemId,
        expect: parseExpectFlag(initialVersionId),
        version: {
          id: newVersionId(),
          blobHash: v2Blob.blobHash,
          mimeType: "text/markdown",
          filename: "brief.md",
          size: v2Blob.size,
        },
      });
    } catch (err) {
      handled = handlePreconditionConflict({ json: false }, err);
    }
    expect(handled).toBe(true);
    expect(process.exitCode).toBe(4);
    expect(errs.join("\n")).toContain("Edit conflict");

    // Structured receipt on comment reply
    const snap = await client.snapshot(canvasId);
    const receipt = buildReplyReceipt(snap, itemId, "Updated the Acme brief.");
    const threadId = newThreadId();
    await client.sendOp(canvasId, actor, {
      type: "thread.create",
      threadId,
      x: 10,
      y: 10,
      anchorItemId: itemId,
      comment: { id: "cmt_r1", body: "Please update" },
    });
    await client.sendOp(canvasId, actor, {
      type: "thread.reply",
      threadId,
      comment: { id: "cmt_r2", body: "Updated the Acme brief.", receipt },
    });
    const afterReply = await client.snapshot(canvasId);
    const saved = afterReply.canvas.threads[threadId]!.comments.find((c) => c.id === "cmt_r2")!;
    expect(readCommentReceipt(saved)).toEqual(
      expect.objectContaining({ itemId, fromVersionId: initialVersionId, toVersionId: v2Id }),
    );
  });
});
