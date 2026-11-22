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
import { type NodeLease } from "../../core/src/index.js";
/**
 * **Ephemeral 30-second soft node leases** (Open Stitch Phase 2A, OS1 ADR 0274).
 *
 * Daemon-held in memory only — never written to the oplog, never persisted.
 * A soft lease advertises which `@handle` is actively editing an item so other
 * agents inspect `leasedByHandle` and avoid clobbering it; if a holder crashes,
 * the lease evaporates automatically on TTL.
 */
/** Default soft lease lifetime in milliseconds (30 seconds). */
export declare const DEFAULT_LEASE_TTL_MS = 30000;
/** Result of attempting to acquire or renew a soft lease on an item. */
export interface LeaseAcquireResult {
    acquired: boolean;
    lease: NodeLease;
    /** Present when another handle currently holds the active lease. */
    holder?: NodeLease;
}
/** In-memory manager for per-canvas soft item leases with automatic TTL expiry. */
export declare class LeaseManager {
    private byCanvas;
    private readonly now;
    constructor(options?: {
        now?: () => number;
    });
    private pruneCanvas;
    /**
     * Acquire or renew a soft lease on `itemId` for `handle`.
     *
     * Succeeds when no active lease exists or the same handle already holds it;
     * otherwise returns `{ acquired: false, lease: existing, holder: existing }`.
     */
    acquireLease(canvasId: string, itemId: string, handle: string, ttlMs?: number, actorId?: string): LeaseAcquireResult;
    /** Release a soft lease on `itemId` (optionally requiring a matching `handle`). */
    releaseLease(canvasId: string, itemId: string, handle?: string): boolean;
    /** Return all currently unexpired leases on `canvasId`. */
    activeLeases(canvasId: string): NodeLease[];
    /** Return the active lease for one item, or `null` if unleased or expired. */
    leaseOf(canvasId: string, itemId: string): NodeLease | null;
}
