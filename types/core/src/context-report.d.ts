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
import type { ContextSource } from "./context-source.js";
/** One sentence naming a copy's origin, for the terminal and the MCP summary —
 *  here rather than beside the record itself for the reason this whole module
 *  exists: local Context assembles a copied piece on every canvas, and a
 *  formatter only a reader in a terminal wants has no business in first paint. */
export declare function formatContextSource(source: ContextSource): string;
import type { ContextPiece } from "./context.js";
/** Terminal formatting lives apart from eager piece assembly so browser previews
 * do not acquire the whole recap computation through the runtime core namespace. */
export declare function contextReport(pieces: ContextPiece[], nowMs?: number): string;
