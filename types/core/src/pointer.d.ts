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
import type { MemoryFacet } from "./context-budget.js";
/**
 * **Pointer items** (Open Stitch Phase 5): a shared canvas holds only a
 * reference `{ ref, ownerId, facet?, label? }` with zero private observation
 * text. The pointer hydrates only for its owner.
 */
export declare const POINTER_MIME = "application/vnd.isocan.pointer+json";
/** Opaque pointer stored on a shared canvas referencing an owner-private observation. */
export interface MemoryPointer {
    ref: string;
    ownerId: string;
    facet?: MemoryFacet | string;
    label?: string;
}
/**
 * Encode a {@link MemoryPointer} into canonical JSON.
 *
 * Invariant: only `{ ref, ownerId, facet?, label? }` are serialized — any extra
 * fields (such as private observation text) are stripped.
 */
export declare function encodePointer(pointer: MemoryPointer): string;
/** Parse a pointer JSON blob (string or UTF-8 bytes), returning null if invalid. */
export declare function parsePointer(raw: string | Uint8Array): MemoryPointer | null;
/** Whether `actorId` (or any of `aliases`) owns the given {@link MemoryPointer}. */
export declare function isPointerOwner(pointer: Pick<MemoryPointer, "ownerId">, actorId: string | null | undefined, aliases?: readonly string[]): boolean;
