import {
  anchorOffset,
  itemThread,
  newCommentId,
  newThreadId,
  type CanvasContents,
  type CommentThread,
  type FocusSubtarget,
  type Item,
  type NewComment,
  type Operation,
} from "@isocan/core";

const SUBTARGET_PREFIX_RE = /^\[focus:\s*([a-z0-9_-]+):([^\s\]—]+)\s*—\s*([^\]]+)\]\r?\n/i;

/**
 * Format a `FocusSubtarget` as a structured prefix line at the top of a
 * comment body so both agents reading `isocan wait` and the web drawer can see
 * the exact sub-element (`wf-slot`, `ds-token`, `dom-element`, `image-region`)
 * the user is pointing at (`docs/projects/node-focus/design.md` §6.2).
 */
export function formatSubtargetPrefix(subtarget: FocusSubtarget): string {
  const cleanKind = subtarget.kind.replace(/[\]\r\n]/g, "").trim() || "target";
  const cleanId = subtarget.id.replace(/[\s\]\r\n]/g, "").trim() || "item";
  const cleanLabel = subtarget.label.replace(/[\]\r\n]/g, "").trim() || cleanId;
  return `[focus: ${cleanKind}:${cleanId} — ${cleanLabel}]`;
}

/**
 * Extract a leading `[focus: kind:id — label]` header from a comment body, if
 * present, returning the parsed `FocusSubtarget` and the remaining markdown.
 */
export function parseSubtargetPrefix(body: string): {
  subtarget: FocusSubtarget | null;
  rest: string;
} {
  const match = SUBTARGET_PREFIX_RE.exec(body);
  if (!match) return { subtarget: null, rest: body };
  return {
    subtarget: {
      kind: match[1]!,
      id: match[2]!,
      label: match[3]!.trim(),
    },
    rest: body.slice(match[0].length),
  };
}

/** Combine a comment body with an optional `FocusSubtarget` prefix. */
function buildNodeChatCommentBody(body: string, subtarget: FocusSubtarget | null): string {
  const trimmed = body.trim();
  if (!subtarget) return trimmed;
  return `${formatSubtargetPrefix(subtarget)}\n${trimmed}`;
}

/**
 * All threads anchored to `itemId` (`thread.anchorItemId === itemId` and not
 * the canvas-wide main thread), ordered with the primary item conversation
 * (`itemThread`) first and remaining anchored discussions chronologically.
 */
export function itemThreadsFor(canvas: CanvasContents | null, itemId: string): CommentThread[] {
  if (!canvas) return [];
  const primary = itemThread(canvas, itemId);
  const all = Object.values(canvas.threads)
    .filter((t) => !t.main && t.anchorItemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!primary) return all;
  return [primary, ...all.filter((t) => t.id !== primary.id)];
}

/**
 * Build the `thread.reply` or `thread.create` operation for sending a message
 * from the Node-Anchored Chat Drawer (`docs/projects/node-focus/design.md` §6).
 *
 * - Always anchors to `item.id` (`anchorItemId: item.id` on creation, or
 *   replies to an existing thread whose `anchorItemId === item.id`).
 * - Always attaches `item.id` in `comment.items` so any woken agent receives
 *   the focused node in its context.
 * - Carries any active `FocusSubtarget` in the comment body.
 */
export function buildNodeAnchoredMessageOp({
  canvas,
  item,
  body,
  subtarget = null,
  threadId = null,
  makeComment = (text) => ({ id: newCommentId(), body: text }),
  contextRequest,
}: {
  canvas: CanvasContents | null;
  item: Item;
  body: string;
  subtarget?: FocusSubtarget | null;
  /** Explicit anchored thread to reply to, or `"new"` to force a new anchored thread. */
  threadId?: string | "new" | null;
  makeComment?: (body: string) => NewComment;
  contextRequest?: NewComment["contextRequest"];
}): Extract<Operation, { type: "thread.create" | "thread.reply" }> {
  const fullBody = buildNodeChatCommentBody(body, subtarget);
  const baseComment = makeComment(fullBody);
  const items = [...new Set([item.id, ...(baseComment.items ?? [])])];
  const comment: NewComment = {
    ...baseComment,
    items,
    ...(contextRequest ? { contextRequest } : {}),
  };

  const existing =
    threadId === "new"
      ? null
      : threadId && canvas?.threads[threadId]?.anchorItemId === item.id
        ? canvas.threads[threadId]!
        : canvas
          ? itemThread(canvas, item.id)
          : null;

  if (existing) {
    return {
      type: "thread.reply",
      threadId: existing.id,
      comment,
    };
  }

  const offset = anchorOffset(item);
  return {
    type: "thread.create",
    threadId: newThreadId(),
    x: offset.x,
    y: offset.y,
    anchorItemId: item.id,
    main: false,
    comment,
  };
}
