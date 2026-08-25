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

export interface Canvas {
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
  /**
   * Who reacted with what: emoji → the actors wearing it, in the order they
   * arrived. Absent on items nobody has reacted to, which is most of them.
   *
   * **A set of actors, deliberately, and not a count.** A number would have to
   * be incremented, and two people reacting in the same instant would each
   * read it, add one, and write the same value — one reaction lost, silently
   * and permanently. A set is idempotent and commutative: both ids land, in
   * either order, and the count is `length`. It is also the only shape that
   * can answer "did I already?" and "who liked this?", which are the two
   * questions anybody actually asks of a reaction.
   *
   * Ids rather than names, for the reason mentions are: a stamped name is a
   * log entry, not an identity, and a rename has to reach what somebody did
   * before it.
   */
  reactions?: Record<string, string[]>;
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

export interface CanvasContents {
  items: Record<string, Item>;
  threads: Record<string, CommentThread>;
  trash: TrashEntry[];
}

/**
 * Everything the reducer operates on for one canvas.
 *
 * **The two field names are deliberate holdouts** (phase 13.5's rename).
 * `project` and `canvas` are the field names `CanvasSnapshotResponse` and the
 * `snapshot` websocket message put on the wire, and `canvas` is what
 * `canvas.json` on disk holds; renaming either would break an installed CLI
 * quietly rather than loudly, because `canvas` would keep parsing and start
 * meaning the other thing. `project` is the canvas RECORD (title, properties,
 * who touched it last); `canvas` is what is ON the canvas.
 */
export interface CanvasState {
  project: Canvas;
  canvas: CanvasContents;
}

export function emptyCanvas(): CanvasContents {
  return { items: {}, threads: {}, trash: [] };
}

/** The designated main thread, if the canvas has one. */
export function mainThread(canvas: CanvasContents): CommentThread | null {
  return Object.values(canvas.threads).find((thread) => thread.main) ?? null;
}
