import type { CanvasContents, Comment, CommentThread, Item } from "./model.js";
/**
 * Live items explicitly linked by a message, suitable for current previews.
 * A saved request owns its roots: the writer's comment.items also contains
 * expanded descendants and must not be mistaken for additional references.
 * This neither changes frozen context nor claims that the message made an item.
 */
export declare function commentReferencedItemIds(canvas: CanvasContents, comment: Pick<Comment, "items" | "context">): string[];
/**
 * The live item a thread is working on: its anchor item first, then any
 * explicit item ids carried on the summoning comment, then the most recent
 * comment in the thread that references a live item.
 */
export declare function threadTargetItem(canvas: CanvasContents, thread: CommentThread | undefined, extraItemIds?: readonly string[]): Item | undefined;
