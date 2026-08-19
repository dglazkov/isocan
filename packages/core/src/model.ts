/**
 * The shared state model. Both the daemon (authoritative) and the web client
 * (live replica) hold this shape; the CLI reads it through queries.
 *
 * Every mutation is stamped with the Actor that performed it. Actor is minted
 * locally today (name prompt); authenticated identity later only changes how
 * an Actor is created, not this model.
 */

export interface Actor {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  properties: Record<string, string>;
  createdAt: string;
  createdBy: Actor;
  updatedAt: string;
  updatedBy: Actor;
}

export interface ItemVersion {
  id: string;
  /** sha256 of content; stored at blobs/<hash>.<ext> */
  blobHash: string;
  mimeType: string;
  filename: string;
  size: number;
  createdAt: string;
  createdBy: Actor;
}

export interface Item {
  id: string;
  /** World coordinates, top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  description: string;
  properties: Record<string, string>;
  /** Append-only, creation order. The visible "top of stack" is currentVersionId. */
  versions: ItemVersion[];
  currentVersionId: string;
  createdAt: string;
  createdBy: Actor;
  updatedAt: string;
  updatedBy: Actor;
}

export interface Comment {
  id: string;
  author: Actor;
  body: string;
  /** Actor ids @-mentioned in the body, resolved at authoring time against
   * the actors the author could see. Absent on older comments. */
  mentions?: string[];
  /** Item ids #-referenced in the body, resolved at authoring time against
   * the live items the author could see. Absent on older comments. */
  items?: string[];
  createdAt: string;
  /** When the author last rewrote it, if they did. This is what makes a
   * working note possible: one comment that says "on it", then what it found,
   * then what it did — instead of three comments saying so. It is also the
   * honest source for how long that took, since both ends are daemon
   * timestamps rather than something the author typed. */
  editedAt?: string;
}

export interface CommentThread {
  id: string;
  /** Freestanding: world coordinates of the pin. Anchored: offset from the
   * anchor item's top-left corner, so the pin follows the item. */
  x: number;
  y: number;
  /** null = freestanding. If the anchor item is in the trash or missing,
   * renderers fall back to treating (x, y) as world coordinates. */
  anchorItemId: string | null;
  /** Always at least one comment. */
  comments: Comment[];
  /** At most one thread on a canvas is "main": the designated agent↔user
   * channel. It renders as a docked chat panel instead of a canvas pin, and
   * agents always wake on comments landing in it. Its (x, y) are kept so
   * demoting it puts the pin back where the thread lived. */
  main?: boolean;
  createdAt: string;
  createdBy: Actor;
}

export interface TrashEntry {
  item: Item;
  deletedAt: string;
  deletedBy: Actor;
}

export interface CanvasState {
  items: Record<string, Item>;
  threads: Record<string, CommentThread>;
  trash: TrashEntry[];
}

/** Everything the reducer operates on for one project. */
export interface ProjectState {
  project: Project;
  canvas: CanvasState;
}

export function emptyCanvas(): CanvasState {
  return { items: {}, threads: {}, trash: [] };
}

/** The designated main thread, if the canvas has one. */
export function mainThread(canvas: CanvasState): CommentThread | null {
  return Object.values(canvas.threads).find((thread) => thread.main) ?? null;
}
