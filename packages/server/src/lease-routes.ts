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

import type { FastifyInstance } from "fastify";
import type { Engine } from "./engine.ts";
import { DEFAULT_LEASE_TTL_MS, LeaseManager } from "./leases.ts";
import type { PresenceHub } from "./presence.ts";

/**
 * Ephemeral 30-second soft node leases & paint acks (Open Stitch Phase 2A —
 * ephemeral coordination state, never canvas ops).
 */
export function registerLeaseRoutes(
  app: FastifyInstance,
  engine: Engine,
  presence: PresenceHub,
  leases: LeaseManager,
): void {
  app.get("/api/projects/:id/leases", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    return { leases: leases.activeLeases(id) };
  });

  app.post("/api/projects/:id/leases", async (req, reply) => {
    const { id } = req.params as { id: string };
    const snap = await engine.getSnapshot(id);
    const body = (req.body ?? {}) as {
      itemId?: string;
      handle?: string;
      ttlMs?: number;
      actorId?: string;
      release?: boolean;
    };
    if (!body.itemId || typeof body.itemId !== "string") {
      return reply.status(400).send({ error: "itemId is required", code: "bad-request" });
    }
    if (!snap.canvas.items[body.itemId]) {
      return reply.status(404).send({ error: `unknown item: ${body.itemId}`, code: "unknown-item" });
    }
    if (body.release) {
      const released = leases.releaseLease(id, body.itemId, body.handle);
      return { released };
    }
    if (!body.handle || typeof body.handle !== "string") {
      return reply.status(400).send({ error: "handle is required", code: "bad-request" });
    }
    return leases.acquireLease(id, body.itemId, body.handle, body.ttlMs ?? DEFAULT_LEASE_TTL_MS, body.actorId);
  });

  app.delete("/api/projects/:id/leases/:itemId", async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const { handle } = req.query as { handle?: string };
    await engine.getSnapshot(id);
    return { released: leases.releaseLease(id, itemId, handle) };
  });

  app.get("/api/projects/:id/paint-ack", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const query = req.query as { seq?: string; waitMs?: string };
    const paintedSeq = presence.lastPaintedSeq(id);
    if (query.seq !== undefined) {
      const targetSeq = Number(query.seq);
      const waitMs = query.waitMs !== undefined ? Number(query.waitMs) : 0;
      if (Number.isInteger(targetSeq) && targetSeq >= 0) {
        return presence.waitForPaint(id, targetSeq, Number.isFinite(waitMs) ? waitMs : 0);
      }
    }
    return { canvasId: id, paintedSeq };
  });

  app.post("/api/projects/:id/paint-ack", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const body = (req.body ?? {}) as { seq?: number };
    if (typeof body.seq !== "number" || !Number.isInteger(body.seq) || body.seq < 0) {
      return reply.status(400).send({ error: "seq must be a non-negative integer", code: "bad-request" });
    }
    const paintedSeq = presence.recordPaintAck(id, body.seq);
    return { ok: true, canvasId: id, paintedSeq };
  });
}
