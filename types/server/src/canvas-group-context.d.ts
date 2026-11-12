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
import { type CanvasState, type ContextContentPage, type ContextManifest } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
import type { Store } from "./store.js";
/** Preview and send freeze omitted visual metadata from its own stored face,
 * while explicit version metadata keeps the author's chosen filename and size. */
export declare function hydrateContextManifest(store: Pick<Store, "blobMeta">, state: CanvasState, manifest: ContextManifest): Promise<ContextManifest>;
/** An index row alone cannot prove bytes survived; probe one byte through the store contract. */
export declare function contextBlobAvailable(store: Pick<Store, "blobMeta" | "openBlob">, canvasId: string, hash: string): Promise<boolean>;
/** Byte availability is checked at read time; retained provenance itself never changes. */
export declare function availableContextPage(store: Pick<Store, "blobMeta" | "openBlob">, manifest: ContextManifest, options: {
    offset?: number;
    limit?: number;
    face?: "source" | "visual";
}): Promise<ContextContentPage>;
/** All reads live under the existing canvas admission, takedown, purge and capability hook. */
export declare function registerCanvasGroupContext(app: FastifyInstance, engine: Engine, store: Store): void;
