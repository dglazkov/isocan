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

import { normalizeHandle, type NodeLease } from "@isocan/core";

/**
 * **Ephemeral 30-second soft node leases** (Open Stitch Phase 2A, OS1 ADR 0274).
 *
 * Daemon-held in memory only — never written to the oplog, never persisted.
 * A soft lease advertises which `@handle` is actively editing an item so other
 * agents inspect `leasedByHandle` and avoid clobbering it; if a holder crashes,
 * the lease evaporates automatically on TTL.
 */

/** Default soft lease lifetime in milliseconds (30 seconds). */
export const DEFAULT_LEASE_TTL_MS = 30_000;

interface StoredLease {
  lease: NodeLease;
  expiresAtMs: number;
}

/** Result of attempting to acquire or renew a soft lease on an item. */
export interface LeaseAcquireResult {
  acquired: boolean;
  lease: NodeLease;
  /** Present when another handle currently holds the active lease. */
  holder?: NodeLease;
}

/** In-memory manager for per-canvas soft item leases with automatic TTL expiry. */
export class LeaseManager {
  private byCanvas = new Map<string, Map<string, StoredLease>>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  private pruneCanvas(canvasId: string): Map<string, StoredLease> | undefined {
    const room = this.byCanvas.get(canvasId);
    if (!room) return undefined;
    const t = this.now();
    for (const [itemId, entry] of room) {
      if (entry.expiresAtMs <= t) room.delete(itemId);
    }
    if (room.size === 0) {
      this.byCanvas.delete(canvasId);
      return undefined;
    }
    return room;
  }

  /**
   * Acquire or renew a soft lease on `itemId` for `handle`.
   *
   * Succeeds when no active lease exists or the same handle already holds it;
   * otherwise returns `{ acquired: false, lease: existing, holder: existing }`.
   */
  acquireLease(
    canvasId: string,
    itemId: string,
    handle: string,
    ttlMs = DEFAULT_LEASE_TTL_MS,
    actorId?: string,
  ): LeaseAcquireResult {
    const cleanHandle = normalizeHandle(handle) ?? handle.replace(/^@+/, "").trim();
    if (!cleanHandle) throw new Error("lease handle must be non-empty");
    const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.min(ttlMs, 5 * 60_000) : DEFAULT_LEASE_TTL_MS;
    const room = this.pruneCanvas(canvasId) ?? new Map<string, StoredLease>();
    const existing = room.get(itemId);
    if (existing && existing.lease.handle !== cleanHandle) {
      return { acquired: false, lease: existing.lease, holder: existing.lease };
    }
    const nowMs = this.now();
    const expiresAtMs = nowMs + effectiveTtl;
    const lease: NodeLease = {
      canvasId,
      itemId,
      handle: cleanHandle,
      ...(actorId ? { actorId } : {}),
      acquiredAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
    room.set(itemId, { lease, expiresAtMs });
    this.byCanvas.set(canvasId, room);
    return { acquired: true, lease };
  }

  /** Release a soft lease on `itemId` (optionally requiring a matching `handle`). */
  releaseLease(canvasId: string, itemId: string, handle?: string): boolean {
    const room = this.pruneCanvas(canvasId);
    if (!room) return false;
    const existing = room.get(itemId);
    if (!existing) return false;
    if (handle !== undefined) {
      const cleanHandle = normalizeHandle(handle) ?? handle.replace(/^@+/, "").trim();
      if (existing.lease.handle !== cleanHandle) return false;
    }
    room.delete(itemId);
    if (room.size === 0) this.byCanvas.delete(canvasId);
    return true;
  }

  /** Return all currently unexpired leases on `canvasId`. */
  activeLeases(canvasId: string): NodeLease[] {
    const room = this.pruneCanvas(canvasId);
    if (!room) return [];
    return [...room.values()].map((entry) => entry.lease);
  }

  /** Return the active lease for one item, or `null` if unleased or expired. */
  leaseOf(canvasId: string, itemId: string): NodeLease | null {
    const room = this.pruneCanvas(canvasId);
    return room?.get(itemId)?.lease ?? null;
  }
}
