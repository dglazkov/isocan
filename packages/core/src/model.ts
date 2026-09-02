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

/**
 * **The system voice** (agents-on-demand phase 5, decided 2026-08-30 by
 * Dimitri): isocan itself can talk. A machinery fact that must land where
 * people are looking — "Sian couldn't answer", "the ceiling held this turn"
 * — is a comment authored by THIS actor, never words in a dead agent's
 * mouth and never a person's name on sentences no person wrote.
 *
 * It is a voice, not a participant: no registry row, no face, no roster
 * presence, unmentionable (`mentions.ts` skips it), and the engine accepts
 * it for COMMENT ops only — machinery reports, it does not edit the canvas.
 * Any badge may speak as it, deliberately: a system message carries no
 * person's authority, so there is no authority to steal; what it says is
 * trusted exactly as far as the machinery that said it, like presence.
 */
export const SYSTEM_ACTOR: Actor = { id: "sys_isocan", name: "isocan" };

/** The system voice, and anything shaped like it — one prefix, so a second
 * system voice never needs a second special case. */
export function isSystemActor(actorId: string): boolean {
  return actorId.startsWith("sys_");
}

export interface Canvas {
  id: string;
  title: string;
  description: string;
  properties: Record<string, string>;
  createdAt: string;
  createdBy: Actor;
  /**
   * **When anything last happened here, and who did it.**
   *
   * These used to move only when the TITLE or DESCRIPTION changed, because the
   * reducer's `withCanvas` returns the project untouched and every item
   * operation goes through it. So a canvas worked on all week reported the day
   * somebody last renamed it — the Lake House card read "17 Aug, Admiral One"
   * while the last actual operation was twelve days later by somebody else.
   *
   * That was not a display bug. The word "updated" on a canvas means the
   * canvas changed, and adding an item changes the canvas; the home screen was
   * showing the only number it had and labelling it as the one it wanted.
   */
  updatedAt: string;
  updatedBy: Actor;
  /**
   * The type of that last operation — `item.add`, `thread.create`, and so on.
   *
   * Stored rather than derived because the alternative is reading every
   * canvas's log to draw a list of canvases: one metadata file per canvas is
   * what `listCanvases` costs today, and a tail read per canvas would make the
   * home screen O(canvases) log reads — cheap on a laptop, and the wrong shape
   * on a store where each read is a request.
   *
   * Absent on canvases last touched before this existed, and on a canvas whose
   * only event is its own creation. Renderers say something sensible without
   * it rather than treating it as required.
   */
  lastOp?: string;
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
  /**
   * Where a reaction was PLACED on the item, when it was — emoji → actor id
   * → a point as fractions of the item's box (0..1 each), so it lands on the
   * same part of the sketch at every zoom and every size. A heat map is
   * dots on the parts people liked, not a count under the card
   * (`docs/research/2026-09-01-design-sprint.md`, "a vote that is also a
   * picture"). Absent for a reaction worn without a point, which is every
   * reaction made before this existed and every chip click since; the
   * point is carried by `item.react`'s `at`, and removed with the reaction.
   */
  reactionPoints?: Record<string, Record<string, { x: number; y: number }>>;
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

/**
 * An agent with standing to answer on this canvas — the enrolment record's
 * home half (agents-on-demand phase 2). A record, not a process: the row
 * exists whether or not anything runs, and "answerable" is a DERIVATION
 * (enrolment + a live `rc` claiming it), never a field here — a record
 * cannot know its rc died. The rc half (harness, cwd, sessionId) is a
 * machine fact and lives with the rc's machine, never in canvas state.
 */
export interface EnrolledAgent {
  /** The whole actor, so an enrolled-but-never-spoken agent reaches every
   * derivation that walks canvas state — mention candidates above all. */
  actor: Actor;
  /** Opaque until phase 4 defines the vocabulary; stored as handed over. */
  rules?: unknown;
}

export interface CanvasContents {
  items: Record<string, Item>;
  threads: Record<string, CommentThread>;
  trash: TrashEntry[];
  /** Standing agents by actor id. Optional because snapshots older than the
   * field exist on disk; read it through `?? {}`. */
  agents?: Record<string, EnrolledAgent>;
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
  return { items: {}, threads: {}, trash: [], agents: {} };
}

/** The designated main thread, if the canvas has one. */
export function mainThread(canvas: CanvasContents): CommentThread | null {
  return Object.values(canvas.threads).find((thread) => thread.main) ?? null;
}
