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
import type { CanvasState } from "./model.js";
import type { Operation } from "./ops.js";
import { type ContextContentPage, type ContextManifest, type ContextRequest } from "./canvas-group-context.js";
/** A preview and a writer use the same complete expansion and exclusion rules. */
export declare function contextManifest(state: CanvasState, revision: number, request: ContextRequest): ContextManifest;
/** Ambient pins remain decisions on their roots; descendants are expanded only when read. */
export declare function ambientContextManifest(state: CanvasState, revision: number): ContextManifest;
/** Canonical-only metadata is refused before forwarding and idempotency lookup. */
export declare function rejectPublicContext(op: Operation): void;
/** The home resolves selection once; ordinary body edits preserve the old request's scope. */
export declare function resolveContextOperation(state: CanvasState, revision: number, op: Operation): Operation;
/** Produce reference pages without opening bytes or returning excluded content. */
export declare function contextContentPage(manifest: ContextManifest, options?: {
    offset?: number;
    limit?: number;
    face?: "source" | "visual";
}): ContextContentPage;
