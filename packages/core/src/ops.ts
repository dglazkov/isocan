import type { Actor, Comment, CommentThread, ItemVersion } from "./model.ts";

/**
 * The operation vocabulary — the isomorphism contract. Every mutation the web
 * app or the CLI can perform is one of these, sent to the daemon's single
 * POST /api/ops endpoint and applied by the shared reducer.
 *
 * Ops marked "internal" are valid vocabulary (the reducer applies them) but
 * clients never issue them directly; they exist so every user-facing op has a
 * first-class inverse.
 */

export interface NewVersion {
  id: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  size: number;
}

/**
 * Where to put a new item. Clients may pass an anchor (their locally selected
 * item); the daemon resolves it to concrete coordinates (left of the anchor)
 * before logging, so the oplog never depends on ephemeral client state.
 */
export type Placement = { x: number; y: number } | { anchorItemId: string };

export interface NewComment {
  id: string;
  body: string;
  /** Resolved @-mentions (actor ids); see Comment.mentions. */
  mentions?: string[];
  /** Resolved #item-references (item ids); see Comment.items. */
  items?: string[];
}

export interface MetaPatch {
  title?: string;
  description?: string;
  /** Merged into existing properties. */
  properties?: Record<string, string>;
  removeProperties?: string[];
}

export type Operation =
  // ---- actors ----
  | {
      /**
       * Naming yourself, as a mutation like any other (#57). Home-scoped:
       * `projectId` is null, the entry lands in the home's actors log, and
       * the ENGINE applies it against the actor registry — a per-project
       * reducer never sees it. NOT undoable (see project.delete's precedent).
       * The envelope's `actor` is the RESULT: the daemon stamps the resolved
       * actor, which is how the caller learns who it is.
       */
      type: "actor.claim";
      /** `<harness>:<session id>` — the one key one agent holds, durable
       * across resume because harnesses name conversations, not processes. */
      sessionKey: string;
      /** The name asked for. Omitted: the daemon allocates the next free
       * isocan name — ask, receive. */
      name?: string;
      /** Reincarnate deliberately as this existing actor id — a returning
       * agent whose conversation (and so session id) is truly gone. */
      as?: string;
      /** Mint a NEW actor even if the name is worn: a second Kenny on
       * purpose, not a collision. */
      fresh?: boolean;
      /** The canvas of the directory this claim was made from, when that
       * directory was already bound (#60). Informational scope — recorded on
       * the binding so the registry can say which project an agent is of; it
       * gates nothing. Absent on the very first handshake in a fresh
       * directory, whose project is only created after the claim answers. */
      projectId?: string;
    }
  | {
      /**
       * Choosing the color you wear — cursor, face, pins, and the Pen's
       * default ink (#identity colors). Home-scoped like `actor.claim`:
       * `projectId` is null, it lands in the home's actors log, and the
       * ENGINE applies it against the actor registry. NOT undoable, for the
       * same reason naming yourself is not.
       *
       * `color` is a literal hex; null goes back to the color the actor id
       * implies, so "unset" and "derived" are one state.
       */
      type: "actor.setColor";
      actorId: string;
      color: string | null;
    }
  // ---- projects ----
  | {
      type: "project.create";
      projectId: string;
      title: string;
      description?: string;
      properties?: Record<string, string>;
    }
  | { type: "project.update"; patch: MetaPatch }
  | { type: "project.delete" } // soft: dir moved aside; NOT undoable
  // ---- items ----
  | {
      type: "item.add";
      itemId: string;
      version: NewVersion;
      width: number;
      height: number;
      placement: Placement;
      title?: string;
      description?: string;
      properties?: Record<string, string>;
    }
  | { type: "item.move"; itemId: string; x: number; y: number }
  | { type: "item.resize"; itemId: string; width: number; height: number }
  | {
      type: "item.update";
      itemId: string;
      patch: MetaPatch;
      /** Rename the file under the CURRENT version too. Renaming an item and
       * renaming its file are one act — one op, so they are one undo — and the
       * filename is a property of the version, which is why it rides here
       * rather than in the patch (which projects share). */
      filename?: string;
    }
  | { type: "item.addVersion"; itemId: string; version: NewVersion }
  | { type: "item.setCurrentVersion"; itemId: string; versionId: string }
  | {
      // internal: inverse of item.addVersion only
      type: "item.removeVersion";
      itemId: string;
      versionId: string;
      prevCurrentVersionId: string;
    }
  | {
      // internal: inverse of item.removeVersion (redo of addVersion) — carries
      // the full ItemVersion so original authorship survives undo→redo
      type: "item.restoreVersion";
      itemId: string;
      version: ItemVersion;
    }
  | { type: "item.delete"; itemId: string } // → trash, all versions travel with it
  | { type: "item.restore"; itemId: string } // ← trash
  // Batch variants exist so a multi-select gesture is ONE op and therefore
  // ONE undo step. They add no new capability over their singular forms.
  | { type: "items.move"; moves: Array<{ itemId: string; x: number; y: number }> }
  | { type: "items.delete"; itemIds: string[] }
  | { type: "items.restore"; itemIds: string[] }
  | { type: "trash.empty" } // NOT undoable; confirmation-gated
  // ---- comments ----
  | {
      type: "thread.create";
      threadId: string;
      x: number;
      y: number;
      anchorItemId: string | null;
      comment: NewComment;
      /** Born as the canvas's main thread (the docked agent↔user channel).
       * Only valid while no main thread exists — the panel creates its
       * thread lazily on first message; promotion of an existing thread is
       * thread.setMain. One op so the first message is one undo step. */
      main?: boolean;
    }
  | { type: "thread.reply"; threadId: string; comment: NewComment }
  | {
      // Re-pin a thread: to an item (x,y become an offset from its top-left)
      // or freestanding (x,y become world coordinates). Lets a thread that
      // started before its item existed be anchored to it after the fact.
      type: "thread.setAnchor";
      threadId: string;
      anchorItemId: string | null;
      x: number;
      y: number;
    }
  | {
      // Designate a thread as the canvas's main thread (null demotes the
      // current one). The reducer keeps the at-most-one invariant; the
      // inverse is thread.setMain with the previously-main thread id.
      type: "thread.setMain";
      threadId: string | null;
    }
  | { type: "thread.delete"; threadId: string }
  | {
      // internal: inverse of thread.reply
      type: "comment.remove";
      threadId: string;
      commentId: string;
    }
  | {
      // internal: inverse of comment.remove — carries the full Comment so
      // original authorship survives undo→redo
      type: "comment.restore";
      threadId: string;
      comment: Comment;
    }
  | {
      // internal: inverse of thread.delete
      type: "thread.restore";
      thread: CommentThread;
    };

export type OperationType = Operation["type"];

/** Ops the engine accepts directly from clients (everything non-internal). */
export const INTERNAL_OP_TYPES: ReadonlySet<OperationType> = new Set([
  "item.removeVersion",
  "item.restoreVersion",
  "comment.remove",
  "comment.restore",
  "thread.restore",
]);

export interface OpEnvelope {
  /** Op id (nanoid). */
  id: string;
  /** null only for project.create (the project doesn't exist yet). */
  projectId: string | null;
  /** Identity stamped on the mutation. */
  actor: Actor;
  /** Originating connection, for attribution in UI. */
  clientId?: string;
  /** Assigned by the daemon. */
  ts: string;
  op: Operation;
}

export interface LogEntry {
  /** Monotonic per project. */
  seq: number;
  /** Op normalized (placement resolved to concrete coordinates). */
  envelope: OpEnvelope;
  /** Computed from pre-state before applying; null = not undoable. */
  inverse: Operation | null;
  /** Present when this entry was produced by undo/redo of another entry. */
  cause?: { kind: "undo" | "redo"; targetSeq: number };
  /** Seq of the undo entry that reversed this one. Derived bookkeeping —
   * reconstructed from `cause` on load; never rewritten into the log file. */
  undoneBy?: number;
}
