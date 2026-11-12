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
import { type Canvas, type InboxEntry, type InboxResponse, type LogEntry } from "../../core/src/index.js";
/** The canvas's home answered 404 for it: deleted there while this machine
 * was away. Its own kind of unavailable, because the remedy is the person's
 * (`isocan canvas forget`) rather than waiting for a home to come back. */
export declare class CanvasGoneAtHomeError extends Error {
    readonly gone = true;
}
/** A home that is down costs its own rows, never the rest of the inbox.
 * Four reads at a time; cancellation stops dispatching and reaches each read. */
export declare function collectInbox(canvases: readonly Canvas[], read: (canvas: Canvas, signal: AbortSignal) => Promise<InboxResponse>, signal: AbortSignal): Promise<InboxResponse>;
/** A mark acknowledges a snapshot head. Retained comment operations let the
 * inbox distinguish later comments from the time their visit was recorded.
 * An imported or compacted comment keeps the established timestamp fallback. */
export declare function sequenceInbox(entries: readonly InboxEntry[], log: readonly LogEntry[]): InboxEntry[];
