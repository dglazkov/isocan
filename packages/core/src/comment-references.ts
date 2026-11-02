import type { CanvasContents, Comment, CommentThread, Item } from "./model.ts";

/**
 * Live items explicitly linked by a message, suitable for current previews.
 * A saved request owns its roots: the writer's comment.items also contains
 * expanded descendants and must not be mistaken for additional references.
 * This neither changes frozen context nor claims that the message made an item.
 */
export function commentReferencedItemIds(canvas: CanvasContents, comment: Pick<Comment, "items" | "context">): string[] {
  const context = comment.context;
  const entries = new Map(context?.entries.map((entry) => [entry.itemId, entry]));
  return [...new Set(context ? context.rootIds : comment.items ?? [])].filter((id) => {
    if (context) {
      const entry = entries.get(id);
      if (!entry || entry.excluded || entry.unavailable || !entry.version) return false;
    }
    const item = canvas.items[id];
    return !!item?.versions.some((version) => version.id === item.currentVersionId);
  });
}

/**
 * The live item a thread is working on: its anchor item first, then any
 * explicit item ids carried on the summoning comment, then the most recent
 * comment in the thread that references a live item.
 */
export function threadTargetItem(
  canvas: CanvasContents,
  thread: CommentThread | undefined,
  extraItemIds?: readonly string[],
): Item | undefined {
  if (thread?.anchorItemId && canvas.items[thread.anchorItemId]) {
    return canvas.items[thread.anchorItemId];
  }
  if (extraItemIds) {
    for (const id of extraItemIds) {
      if (canvas.items[id]) return canvas.items[id];
    }
  }
  if (!thread) return undefined;
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i]!;
    const refs = commentReferencedItemIds(canvas, comment);
    for (const id of refs) {
      if (canvas.items[id]) return canvas.items[id];
    }
    for (const id of comment.items ?? []) {
      if (canvas.items[id]) return canvas.items[id];
    }
  }
  return undefined;
}

