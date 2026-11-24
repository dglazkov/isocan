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

/**
 * **Cross-canvas Home Inbox aggregator (`@isocan/core/inbox-model`).**
 *
 * Pure, dependency-free projection over open comment threads mentioning the
 * viewer (`InboxEntry`) and active `asked` agent presence across canvases on a
 * home. Produces prioritized, collapsible items with deep links (`canvasPath`)
 * and inline reply payloads that emit ordinary `thread.reply` operations — zero
 * new ops.
 */

import { canvasPath, threadPath } from "./address.ts";
import { newCommentId } from "./ids.ts";
import type { InboxEntry } from "./inbox.ts";
import type { InboxResponse } from "./inbox-api.ts";
import type { Operation } from "./ops.ts";
import { newSince, type SeenMarks } from "./seen.ts";

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
  readonly op: Extract<Operation, { type: "thread.reply" }>;
}

/** Input to `buildHomeInbox`. */
interface BuildHomeInboxInput {
  readonly canvases: readonly HomeInboxCanvasSummary[];
  readonly marks?: SeenMarks;
  readonly homes?: Readonly<Record<string, string | null>>;
  /** When true, includes read mentions/threads after unread ones (default: false — waiting items only). */
  readonly includeRead?: boolean;
}

function resolveHref(path: string, home: string | null | undefined): string {
  if (!home) return path;
  try {
    return new URL(path, home).href;
  } catch {
    return path;
  }
}

function kindForEntry(entry: InboxEntry): HomeInboxItemKind {
  if (entry.reason === "mentioned") return "mention";
  if (entry.reason === "in-your-thread") return "thread";
  return "chat";
}

function priorityFor(kind: HomeInboxItemKind, unread: boolean): number {
  if (kind === "ask") return 0;
  if (unread) {
    if (kind === "mention") return 1;
    if (kind === "thread") return 2;
    return 3;
  }
  if (kind === "mention") return 4;
  if (kind === "thread") return 5;
  return 6;
}

function timestampOf(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Aggregate comment entries and active `asked` agent presence across canvases
 * into a prioritized Home Inbox list.
 */
export function buildHomeInbox(input: BuildHomeInboxInput): HomeInboxModel {
  const marks = input.marks ?? {};
  const homes = input.homes ?? {};
  const includeRead = input.includeRead ?? false;
  const items: HomeInboxItem[] = [];

  for (const summary of input.canvases) {
    const home = homes[summary.canvasId];
    const baseCanvasHref = resolveHref(canvasPath(summary.canvasId), home);

    // 1. Active `asked` agent presence — always highest priority.
    for (const ask of summary.askedAgents ?? []) {
      const threadId = ask.threadId ?? null;
      const targetPath = threadId ? threadPath(summary.canvasId, threadId) : canvasPath(summary.canvasId);
      items.push({
        id: `ask:${summary.canvasId}:${ask.sessionId}`,
        kind: "ask",
        priority: priorityFor("ask", true),
        canvasId: summary.canvasId,
        canvasTitle: ask.canvasTitle ?? summary.canvasTitle,
        threadId,
        authorId: ask.actorId,
        authorName: ask.actorName,
        body: ask.question,
        createdAt: ask.createdAt,
        href: resolveHref(targetPath, home),
        canvasHref: baseCanvasHref,
        unread: true,
        earlierCount: 0,
      });
    }

    // 2. Open comment threads folded by `(canvasId, threadId)`, newest comment first.
    const entries = summary.entries ?? [];
    if (entries.length === 0) continue;
    const freshIds = new Set(newSince(entries, marks).map((e) => e.comment.id));
    const sorted = [...entries].sort(
      (a, b) => timestampOf(b.comment.createdAt) - timestampOf(a.comment.createdAt),
    );
    const byThread = new Map<string, { newest: InboxEntry; earlier: number; hasUnread: boolean }>();
    for (const entry of sorted) {
      const isFresh = freshIds.has(entry.comment.id);
      const existing = byThread.get(entry.threadId);
      if (!existing) {
        byThread.set(entry.threadId, { newest: entry, earlier: 0, hasUnread: isFresh });
      } else {
        existing.earlier += 1;
        if (isFresh) existing.hasUnread = true;
      }
    }

    for (const { newest, earlier, hasUnread } of byThread.values()) {
      if (!includeRead && !hasUnread) continue;
      const kind = kindForEntry(newest);
      items.push({
        id: `thread:${summary.canvasId}:${newest.threadId}`,
        kind,
        priority: priorityFor(kind, hasUnread),
        canvasId: summary.canvasId,
        canvasTitle: newest.canvasTitle ?? summary.canvasTitle,
        threadId: newest.threadId,
        authorId: newest.comment.author.id,
        authorName: newest.comment.author.name,
        body: newest.comment.body,
        createdAt: newest.comment.createdAt,
        href: resolveHref(threadPath(summary.canvasId, newest.threadId), home),
        canvasHref: baseCanvasHref,
        unread: hasUnread,
        earlierCount: earlier,
      });
    }
  }

  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return timestampOf(b.createdAt) - timestampOf(a.createdAt);
  });

  const unreadCount = items.filter((item) => item.unread).length;
  const askCount = items.filter((item) => item.kind === "ask").length;
  const mentionCount = items.filter((item) => item.kind === "mention").length;

  return { items, unreadCount, askCount, mentionCount };
}

/**
 * Convert an authoritative `/api/inbox` response (shared with `isocan inbox`)
 * plus optional live `asked` presence into a prioritized `HomeInboxModel`.
 */
export function homeInboxFromResponse(
  response: InboxResponse,
  opts?: {
    askedAgents?: readonly AskedAgentPresence[];
    canvasTitles?: Readonly<Record<string, string>>;
    includeRead?: boolean;
  },
): HomeInboxModel {
  const byCanvas = new Map<string, { title: string; entries: InboxEntry[]; askedAgents: AskedAgentPresence[] }>();
  const ensure = (canvasId: string, title?: string) => {
    let bucket = byCanvas.get(canvasId);
    if (!bucket) {
      bucket = {
        title: title ?? opts?.canvasTitles?.[canvasId] ?? canvasId,
        entries: [],
        askedAgents: [],
      };
      byCanvas.set(canvasId, bucket);
    }
    return bucket;
  };
  for (const entry of response.entries) {
    ensure(entry.canvasId, entry.canvasTitle).entries.push(entry);
  }
  for (const ask of opts?.askedAgents ?? []) {
    ensure(ask.canvasId, ask.canvasTitle).askedAgents.push(ask);
  }
  const canvases: HomeInboxCanvasSummary[] = [...byCanvas.entries()].map(([canvasId, bucket]) => ({
    canvasId,
    canvasTitle: bucket.title,
    entries: bucket.entries,
    askedAgents: bucket.askedAgents,
  }));
  return buildHomeInbox({
    canvases,
    marks: response.marks,
    homes: response.homes,
    ...(opts?.includeRead !== undefined ? { includeRead: opts.includeRead } : {}),
  });
}

/**
 * Build an ordinary `thread.reply` operation payload for answering a Home Inbox
 * item inline without leaving Home. Returns `null` when the reply is blank or
 * the item has no target thread.
 */
export function buildInlineReplyPayload(
  item: Pick<HomeInboxItem, "canvasId" | "threadId">,
  body: string,
  commentId: string = newCommentId(),
): InlineReplyPayload | null {
  const trimmed = body.trim();
  if (!trimmed || !item.threadId) return null;
  return {
    canvasId: item.canvasId,
    op: {
      type: "thread.reply",
      threadId: item.threadId,
      comment: {
        id: commentId,
        body: trimmed,
      },
    },
  };
}
