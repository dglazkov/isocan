import { type Canvas, type InboxEntry, type InboxResponse, type LogEntry } from "../../core/src/index.js";
/** A home that is down costs its own rows, never the rest of the inbox.
 * Four reads at a time; cancellation stops dispatching and reaches each read. */
export declare function collectInbox(canvases: readonly Canvas[], read: (canvas: Canvas, signal: AbortSignal) => Promise<InboxResponse>, signal: AbortSignal): Promise<InboxResponse>;
/** A mark acknowledges a snapshot head. Retained comment operations let the
 * inbox distinguish later comments from the time their visit was recorded.
 * An imported or compacted comment keeps the established timestamp fallback. */
export declare function sequenceInbox(entries: readonly InboxEntry[], log: readonly LogEntry[]): InboxEntry[];
