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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import {
  ApiError,
  CURRENT_CLIENT_FEATURES,
  bearerHeader,
  dispatchReason,
  namesFor,
  newCanvasId,
  newItemId,
  newThreadId,
  newVersionId,
  type Actor,
  type BadgeStore,
  type StoredBadge,
} from "@isocan/core";
import { DaemonRoutes } from "@isocan/api";
import { startDaemon, type Daemon } from "../src/daemon.ts";

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
let badges: BadgeStore;
let port: number;
let actorAda: Actor;
let actorNewton: Actor;
let actorHuman: Actor;
let canvasId: string;
let itemId: string;
let firstVersionId: string;
let nowMs = 1_700_000_000_000;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-srv-agent-semantics-"));
  daemon = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    leasesNow: () => nowMs,
  });
  port = (daemon.app.server.address() as AddressInfo).port;
  badges = memoryBadges();
  client = new DaemonRoutes(`http://127.0.0.1:${port}`, badges);

  actorAda = (
    await client.sendOp(null, { id: "", name: "Ada" }, {
      type: "actor.claim",
      sessionKey: "agent:ada",
      name: "Ada",
    })
  ).envelope.actor;
  actorNewton = (
    await client.sendOp(null, { id: "", name: "Newton" }, {
      type: "actor.claim",
      sessionKey: "agent:newton",
      name: "Newton",
    })
  ).envelope.actor;
  actorHuman = (
    await client.sendOp(null, { id: "", name: "Acme Person" }, {
      type: "actor.claim",
      sessionKey: "human:acme",
      name: "Acme Person",
    })
  ).envelope.actor;

  canvasId = newCanvasId();
  await client.sendOp(null, actorHuman, {
    type: "project.create",
    canvasId,
    title: "Acme Semantics Board",
  });

  const blob = await client.uploadBlob(canvasId, Buffer.from("# Acme V1\n"), "text/markdown", "spec.md");
  itemId = newItemId();
  firstVersionId = newVersionId();
  await client.sendOp(canvasId, actorHuman, {
    type: "item.add",
    itemId,
    title: "Acme Spec",
    width: 480,
    height: 320,
    placement: { x: 0, y: 0, chosen: true },
    version: {
      id: firstVersionId,
      blobHash: blob.blobHash,
      mimeType: "text/markdown",
      filename: "spec.md",
      size: blob.size,
    },
  });
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("server agent semantics (Phase 2A)", () => {
  it("manages 30s soft node leases via HTTP routes and auto-expires on TTL", async () => {
    const res1 = await client.acquireLease(canvasId, {
      itemId,
      handle: "ada",
      actorId: actorAda.id,
      ttlMs: 30_000,
    });
    expect(res1.acquired).toBe(true);
    expect(res1.lease.handle).toBe("ada");

    // Second handle sees contention while lease is active
    const res2 = await client.acquireLease(canvasId, {
      itemId,
      handle: "newton",
      actorId: actorNewton.id,
      ttlMs: 30_000,
    });
    expect(res2.acquired).toBe(false);
    expect(res2.holder?.handle).toBe("ada");

    const listed = await client.leases(canvasId);
    expect(listed.leases).toHaveLength(1);
    expect(listed.leases[0]!.itemId).toBe(itemId);

    // Advance virtual clock past 30s TTL -> lease expires automatically
    nowMs += 31_000;
    const afterExpiry = await client.leases(canvasId);
    expect(afterExpiry.leases).toEqual([]);

    const res3 = await client.acquireLease(canvasId, {
      itemId,
      handle: "newton",
      actorId: actorNewton.id,
    });
    expect(res3.acquired).toBe(true);
    expect(res3.lease.handle).toBe("newton");

    // Explicit release
    const released = await client.releaseLease(canvasId, itemId, "newton");
    expect(released.released).toBe(true);
    expect((await client.leases(canvasId)).leases).toEqual([]);
  });

  it("tracks ephemeral paint acks over WS and HTTP to distinguish applied vs rendered", async () => {
    const snap = await client.snapshot(canvasId);
    const targetSeq = snap.lastSeq;

    // Before any client paints -> waitForPaint times out quickly as "applied"
    const before = await daemon.presence.waitForPaint(canvasId, targetSeq, 40);
    expect(before.status).toBe("applied");
    expect(before.paintedSeq).toBe(0);

    // Open a real WebSocket and send an ephemeral paint.ack message
    const badge = await badges.read();
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?canvasId=${encodeURIComponent(canvasId)}&features=${encodeURIComponent(CURRENT_CLIENT_FEATURES)}`,
      { headers: badge ? bearerHeader(badge) : {} },
    );
    await new Promise<void>((resolve, reject) => {
      ws.once("message", () => resolve());
      ws.once("error", reject);
      ws.once("close", (code, reason) => reject(new Error(`ws closed early: ${code} ${reason.toString()}`)));
    });

    const waiting = daemon.presence.waitForPaint(canvasId, targetSeq, 2000);
    ws.send(JSON.stringify({ type: "paint.ack", canvasId, seq: targetSeq }));

    const after = await waiting;
    expect(after.status).toBe("rendered");
    expect(after.paintedSeq).toBeGreaterThanOrEqual(targetSeq);

    // Also readable over HTTP paint-ack route
    const httpAck = await client.paintAckStatus(canvasId, { seq: targetSeq, waitMs: 50 });
    expect("status" in httpAck ? httpAck.status : null).toBe("rendered");

    ws.close();
  });

  it("returns HTTP 409 precondition-conflict on concurrent edits with stale expect", async () => {
    // First edit succeeds with matching expect.versionId
    const blob2 = await client.uploadBlob(canvasId, Buffer.from("# Acme V2\n"), "text/markdown", "spec.md");
    const ver2 = newVersionId();
    await client.sendOp(canvasId, actorAda, {
      type: "item.addVersion",
      itemId,
      expect: { versionId: firstVersionId },
      version: {
        id: ver2,
        blobHash: blob2.blobHash,
        mimeType: "text/markdown",
        filename: "spec.md",
        size: blob2.size,
      },
    });

    // Concurrent agent still expecting firstVersionId gets HTTP 409 precondition-conflict
    const blob3 = await client.uploadBlob(canvasId, Buffer.from("# Acme Stale\n"), "text/markdown", "spec.md");
    let caught: unknown;
    try {
      await client.sendOp(canvasId, actorNewton, {
        type: "item.addVersion",
        itemId,
        expect: { versionId: firstVersionId },
        version: {
          id: newVersionId(),
          blobHash: blob3.blobHash,
          mimeType: "text/markdown",
          filename: "spec.md",
          size: blob3.size,
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
    expect((caught as ApiError).code).toBe("precondition-conflict");
  });

  it("enforces the 4-hop mention circuit breaker in wait routing against live canvas state", async () => {
    const threadId = newThreadId();
    await client.sendOp(canvasId, actorHuman, {
      type: "thread.create",
      threadId,
      x: 10,
      y: 10,
      anchorItemId: itemId,
      comment: { id: "cmt_h0", body: "@Ada please coordinate with @Newton", mentions: [actorAda.id, actorNewton.id] },
    });

    // 4 consecutive agent-to-agent replies
    const replies: Array<[Actor, Actor, string]> = [
      [actorAda, actorNewton, "hop 1"],
      [actorNewton, actorAda, "hop 2"],
      [actorAda, actorNewton, "hop 3"],
      [actorNewton, actorAda, "hop 4"],
    ];
    let lastOp: Extract<import("@isocan/core").Operation, { type: "thread.reply" }> | null = null;
    for (let i = 0; i < replies.length; i++) {
      const [from, to, text] = replies[i]!;
      lastOp = {
        type: "thread.reply",
        threadId,
        comment: { id: `cmt_hop_${i + 1}`, body: `@${to.name} ${text}`, mentions: [to.id] },
      };
      await client.sendOp(canvasId, from, lastOp);
    }

    const snap = await client.snapshot(canvasId);
    const agentIds = new Set([actorAda.id, actorNewton.id]);
    const isAgent = (id: string) => agentIds.has(id);

    // 4th hop must NOT wake Ada
    expect(
      dispatchReason(lastOp!, actorNewton.id, { actorId: actorAda.id, names: namesFor(actorAda), isAgent }, snap.canvas),
    ).toBeNull();

    // Human message resets the breaker
    await client.sendOp(canvasId, actorHuman, {
      type: "thread.reply",
      threadId,
      comment: { id: "cmt_h_reset", body: "@Ada continue please", mentions: [actorAda.id] },
    });
    const nextOp = {
      type: "thread.reply" as const,
      threadId,
      comment: { id: "cmt_hop_after", body: "@Ada back on track", mentions: [actorAda.id] },
    };
    const snapAfter = await client.snapshot(canvasId);
    expect(
      dispatchReason(nextOp, actorNewton.id, { actorId: actorAda.id, names: namesFor(actorAda), isAgent }, snapAfter.canvas),
    ).toBe("mentioned");
  });
});
