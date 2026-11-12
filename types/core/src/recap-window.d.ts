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
import type { LogEntry } from "./ops.js";
import type { CanvasContents } from "./model.js";
/** Shared intermediate activity counts; historical fallback names are not safe inherited output. */
export interface RecapWindow {
    /** Inclusive seq span — the address of the full-resolution entries. */
    fromSeq: number;
    toSeq: number;
    /** Timestamps of the span's first and last entries. */
    fromTs: string;
    toTs: string;
    count: number;
    /** Most active first, by op count. */
    actors: Array<{
        name: string;
        ops: number;
    }>;
    /** thread.create + thread.reply — conversation is worth its own number. */
    comments: number;
    /** Items touched in this span, most touched first. Title is the item's
     * current one when it still exists, the op's own when the op carried one,
     * and null for an item that is gone and was never named in the span. */
    items: Array<{
        id: string;
        title: string | null;
        ops: number;
    }>;
}
/** Shared deterministic activity counting for full recaps and safe inherited heads. */
export declare function summarizeRecapWindow(entries: LogEntry[], canvas: CanvasContents | null | undefined): RecapWindow;
