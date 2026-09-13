import type { CanvasContents, Comment } from "./model.ts";

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
