import type { CanvasContents, Comment } from "./model.js";
/**
 * Live items explicitly linked by a message, suitable for current previews.
 * A saved request owns its roots: the writer's comment.items also contains
 * expanded descendants and must not be mistaken for additional references.
 * This neither changes frozen context nor claims that the message made an item.
 */
export declare function commentReferencedItemIds(canvas: CanvasContents, comment: Pick<Comment, "items" | "context">): string[];
