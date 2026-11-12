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
import type { ContextContentPage } from "../../core/src/index.js";
import { type ContextPageOptions, type DaemonRoutes } from "./routes.js";
/** Declared beside the route it shapes, so `routes.ts` reaches nothing in this
 * package (`isocan/rc` hands that file to hosts with no Node); re-exported
 * here, where the rest of the context reader's options live. */
export type { ContextPageOptions };
export interface ContextReadOptions {
    /** Group ID or unique reference; combined with explicit item roots. */
    in?: string | undefined;
    rootIds?: readonly string[] | undefined;
    includeExcluded?: boolean | undefined;
    expectedRevision?: number | undefined;
}
export interface CommentContextOptions extends ContextReadOptions {
    /** Additional item references, combined with #references in the message. */
    items?: readonly string[] | undefined;
}
export interface ContextBytesOptions {
    face?: "source" | "visual" | undefined;
    /** Byte offset, not characters. Binary and split UTF-8 chunks use base64. */
    offset?: number | undefined;
    limit?: number | undefined;
}
export type ContextItemContent = ContextContentPage["entries"][number] & {
    canvasId: string;
    revision: number;
    offset: number;
    bytesRead: number;
    totalBytes?: number | undefined;
    nextOffset: number | null;
    encoding?: "utf8" | "base64" | undefined;
    data?: string | undefined;
};
/** Read one saved version, even after the original item no longer exists.
 * The page and blob both pass through the home's ordinary admission gates. */
export declare function readContextItem(client: DaemonRoutes, canvasId: string, threadId: string, commentId: string, itemId: string, options?: ContextBytesOptions): Promise<ContextItemContent>;
