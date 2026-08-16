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
  createdAt: string;
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
