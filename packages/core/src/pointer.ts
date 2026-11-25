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

import type { MemoryFacet } from "./context-budget.ts";

/**
 * **Pointer items** (Open Stitch Phase 5): a shared canvas holds only a
 * reference `{ ref, ownerId, facet?, label? }` with zero private observation
 * text. The pointer hydrates only for its owner.
 */
export const POINTER_MIME = "application/vnd.isocan.pointer+json";

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
export function encodePointer(pointer: MemoryPointer): string {
  const ref = pointer.ref?.trim();
  const ownerId = pointer.ownerId?.trim();
  if (!ref) throw new Error("memory pointer requires a non-empty `ref`");
  if (!ownerId) throw new Error("memory pointer requires a non-empty `ownerId`");
  const out: MemoryPointer = {
    ref,
    ownerId,
    ...(pointer.facet?.trim() ? { facet: pointer.facet.trim() } : {}),
    ...(pointer.label?.trim() ? { label: pointer.label.trim() } : {}),
  };
  return JSON.stringify(out);
}

/** Parse a pointer JSON blob (string or UTF-8 bytes), returning null if invalid. */
export function parsePointer(raw: string | Uint8Array): MemoryPointer | null {
  try {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.ref !== "string" || !parsed.ref.trim()) return null;
    if (typeof parsed.ownerId !== "string" || !parsed.ownerId.trim()) return null;
    const facet = typeof parsed.facet === "string" && parsed.facet.trim() ? parsed.facet.trim() : undefined;
    const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : undefined;
    return {
      ref: parsed.ref.trim(),
      ownerId: parsed.ownerId.trim(),
      ...(facet ? { facet } : {}),
      ...(label ? { label } : {}),
    };
  } catch {
    return null;
  }
}

/** Whether `actorId` (or any of `aliases`) owns the given {@link MemoryPointer}. */
export function isPointerOwner(
  pointer: Pick<MemoryPointer, "ownerId">,
  actorId: string | null | undefined,
  aliases: readonly string[] = [],
): boolean {
  if (!actorId && aliases.length === 0) return false;
  if (actorId && pointer.ownerId === actorId) return true;
  return aliases.includes(pointer.ownerId);
}
