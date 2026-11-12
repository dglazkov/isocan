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
import type { InboxEntry } from "./inbox.js";
/** One person's inbox, assembled at the homes that own the canvases. A failed
 * canvas has no entries in this response and is explicitly unavailable. */
export interface InboxResponse {
    entries: InboxEntry[];
    marks: import("./seen.js").SeenMarks;
    homes: Record<string, string | null>;
    /** `gone`: the canvas's home answered that it no longer has it, so the
     * copy held here is all that is left — `isocan canvas forget` drops it. */
    unavailable: {
        canvasId: string;
        error: string;
        gone?: true;
        title?: string;
    }[];
}
/** The read-only inbox assembly; a canvas id explicitly presents its address. */
export declare const INBOX_ROUTE = "/api/inbox";
/** A named canvas is an explicit address; omission asks only for discoverable canvases. */
export declare function inboxRoute(actorId: string, options?: {
    canvasId?: string;
    label?: string;
}): string;
