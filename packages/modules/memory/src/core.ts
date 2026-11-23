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

import type { Actor, CanvasContents, ContextPiece, CoreModule, ModuleKind } from "@isocan/core";
import type { MemoryFacet, ReflectionDoc, ReflectionSection } from "@isocan/core/context-budget";
import { POINTER_MIME, type MemoryPointer } from "@isocan/core/pointer";

export { POINTER_MIME };

/** Pointer item kind registered with core. */
export const POINTER_KIND: ModuleKind = {
  id: "pointer",
  mimes: [POINTER_MIME],
  extensions: ["pointer"],
  label: "Memory pointers",
  noun: "memory pointer",
  icon: "document",
};

/** Item property keys owned by `@isocan/memory`. */
export const MEMORY_PROPS = {
  role: "memory.role",
  facet: "memory.facet",
  confidence: "memory.confidence",
  proofs: "memory.proofs",
  ownerId: "memory.ownerId",
  sourceCanvasId: "memory.sourceCanvasId",
  sourceItemId: "memory.sourceItemId",
  updatedAt: "memory.updatedAt",
} as const;

/** Home routes mounted by the memory server half. */
export const MEMORY_REFLECT_ROUTE = "/api/m/memory/reflect";
export const MEMORY_LEARN_ROUTE = "/api/m/memory/learn";
export const MEMORY_SEARCH_ROUTE = "/api/m/memory/search";
export const MEMORY_PLACE_ROUTE = "/api/m/memory/place";
export const MEMORY_HYDRATE_ROUTE = "/api/m/memory/hydrate";
export const MEMORY_FORGET_ROUTE = "/api/m/memory/forget";

export interface MemoryExclusion {
  canvasId: string;
  itemId: string;
  actorId: string;
  forgottenAt: string;
  reason?: string;
}

export interface MemoryForgetRequest {
  canvasId: string;
  itemId: string;
  reason?: string;
  actor?: Actor;
}

export interface MemoryForgetResponse {
  forgotten: true;
  exclusion: MemoryExclusion;
  deleted: boolean;
}

export interface MemoryReflectRequest {
  canvasId: string;
  focus?: string;
  sections?: Partial<Record<ReflectionSection, string>>;
  actor?: Actor;
}

export interface MemoryReflectResponse {
  itemId: string;
  versionId: string;
  blobHash: string;
  updatedAt: string;
  created: boolean;
  doc: ReflectionDoc;
  markdown: string;
}

export interface MemoryLearnRequest {
  canvasId: string;
  text: string;
  target?: "project" | "personal";
  facet?: MemoryFacet;
  confidence?: number;
  proofs?: number;
  personalCanvasId?: string;
  actor?: Actor;
}

export interface MemoryLearnResponse {
  target: "project" | "personal";
  canvasId: string;
  itemId: string;
  versionId: string;
  blobHash: string;
  updatedAt: string;
  facet?: MemoryFacet;
  confidence?: number;
  proofs?: number;
}

export interface MemorySearchRequest {
  canvasId: string;
  query: string;
  limit?: number;
  actor?: Actor;
}

export interface MemorySearchHit {
  canvasId: string;
  canvasTitle: string;
  itemId: string;
  title: string;
  snippet: string;
  score: number;
  ranks: { lexical: number | null; semantic: number | null; recency: number | null };
}

export interface MemorySearchResponse {
  query: string;
  hits: MemorySearchHit[];
  packedHistory: string;
  tokensUsed: number;
}

export interface MemoryPlaceRequest {
  canvasId: string;
  ref: string;
  ownerId?: string;
  facet?: MemoryFacet;
  label?: string;
  x?: number;
  y?: number;
  actor?: Actor;
}

export interface MemoryPlaceResponse {
  itemId: string;
  blobHash: string;
  pointer: MemoryPointer;
}

export interface MemoryHydrateRequest {
  canvasId: string;
  itemId: string;
  actor?: Actor;
}

export interface MemoryHydrateResponse {
  locked: false;
  pointer: MemoryPointer;
  title: string;
  text: string;
  properties: Record<string, string>;
}

/**
 * **The record both surfaces register** (Open Stitch phase 5).
 *
 * Adds the `pointer` kind, owns `memory.*` properties, and surfaces project
 * reflections and memory pointers in canvas context.
 */
export const memoryModule: CoreModule = {
  name: "@isocan/memory",
  kinds: [POINTER_KIND],
  propertyKeys: Object.values(MEMORY_PROPS),
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const pieces: ContextPiece[] = [];
    const items = Object.values(canvas.items);
    const reflection = items.find((i) => i.properties?.[MEMORY_PROPS.role] === "reflection");
    if (reflection) {
      pieces.push({
        name: "Project reflection",
        source: "canvas",
        present: true,
        size: `#${reflection.id} (${reflection.versions.length} version${reflection.versions.length === 1 ? "" : "s"})`,
        updatedAt: reflection.properties[MEMORY_PROPS.updatedAt] ?? reflection.updatedAt,
      });
    }
    const pointers = items.filter((i) => i.properties?.[MEMORY_PROPS.role] === "pointer");
    if (pointers.length > 0) {
      pieces.push({
        name: "Memory pointers",
        source: "canvas",
        present: true,
        size: `${pointers.length} pointer${pointers.length === 1 ? "" : "s"}`,
        updatedAt: pointers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!.updatedAt,
      });
    }
    return pieces;
  },
};

export default memoryModule;
