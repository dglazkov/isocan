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
import type { InboxResponse } from "./inbox-api.js";
import type { Operation } from "./ops.js";
import { type SeenMarks } from "./seen.js";
/** An active agent presence waiting on a person's answer (`asked` state). */
export interface AskedAgentPresence {
    readonly canvasId: string;
    readonly canvasTitle?: string;
    readonly sessionId: string;
    readonly actorId: string;
    readonly actorName: string;
    readonly question: string;
    readonly threadId?: string | null;
    readonly createdAt: string;
}
/** Summary of waiting signals on a single canvas for the Home Inbox. */
interface HomeInboxCanvasSummary {
    readonly canvasId: string;
    readonly canvasTitle: string;
    readonly entries?: readonly InboxEntry[];
    readonly askedAgents?: readonly AskedAgentPresence[];
}
/** Category of one Home Inbox row. */
type HomeInboxItemKind = "ask" | "mention" | "thread" | "chat";
/** One prioritized item waiting on the viewer across canvases. */
export interface HomeInboxItem {
    readonly id: string;
    readonly kind: HomeInboxItemKind;
    /** Lower number = higher priority (`0` = live agent ask, `1` = unread mention, etc.). */
    readonly priority: number;
    readonly canvasId: string;
    readonly canvasTitle: string;
    readonly threadId: string | null;
    readonly authorId: string;
    readonly authorName: string;
    readonly body: string;
    readonly createdAt: string;
    /** Deep link to the canvas (`canvasPath`) or thread (`threadPath`) on its home. */
    readonly href: string;
    readonly canvasHref: string;
    readonly unread: boolean;
    readonly earlierCount: number;
}
/** Aggregated cross-canvas Home Inbox view model. */
export interface HomeInboxModel {
    readonly items: readonly HomeInboxItem[];
    readonly unreadCount: number;
    readonly askCount: number;
    readonly mentionCount: number;
}
/** Inline quick-reply dispatch payload targeting one canvas using existing `thread.reply`. */
export interface InlineReplyPayload {
    readonly canvasId: string;
    readonly op: Extract<Operation, {
        type: "thread.reply";
    }>;
}
/** Input to `buildHomeInbox`. */
interface BuildHomeInboxInput {
    readonly canvases: readonly HomeInboxCanvasSummary[];
    readonly marks?: SeenMarks;
    readonly homes?: Readonly<Record<string, string | null>>;
    /** When true, includes read mentions/threads after unread ones (default: false — waiting items only). */
    readonly includeRead?: boolean;
}
/**
 * Aggregate comment entries and active `asked` agent presence across canvases
 * into a prioritized Home Inbox list.
 */
export declare function buildHomeInbox(input: BuildHomeInboxInput): HomeInboxModel;
/**
 * Convert an authoritative `/api/inbox` response (shared with `isocan inbox`)
 * plus optional live `asked` presence into a prioritized `HomeInboxModel`.
 */
export declare function homeInboxFromResponse(response: InboxResponse, opts?: {
    askedAgents?: readonly AskedAgentPresence[];
    canvasTitles?: Readonly<Record<string, string>>;
    includeRead?: boolean;
}): HomeInboxModel;
/**
 * Build an ordinary `thread.reply` operation payload for answering a Home Inbox
 * item inline without leaving Home. Returns `null` when the reply is blank or
 * the item has no target thread.
 */
export declare function buildInlineReplyPayload(item: Pick<HomeInboxItem, "canvasId" | "threadId">, body: string, commentId?: string): InlineReplyPayload | null;
export {};
