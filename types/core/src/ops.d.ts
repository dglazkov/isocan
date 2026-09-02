import type { Actor, Comment, CommentThread, ItemVersion } from "./model.js";
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
export type Placement = {
    x: number;
    y: number;
} | {
    anchorItemId: string;
};
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
export type Operation = {
    /**
     * Naming yourself, as a mutation like any other (#57). Home-scoped:
     * `canvasId` is null, the entry lands in the home's actors log, and
     * the ENGINE applies it against the actor registry — a per-canvas
     * reducer never sees it. NOT undoable (see project.delete's precedent).
     * The envelope's `actor` is the RESULT: the daemon stamps the resolved
     * actor, which is how the caller learns who it is.
     */
    type: "actor.claim";
    /**
     * `<harness>:<session id>` — which of the PRESENTING BADGE's claims
     * this is. Durable across resume because harnesses name conversations,
     * not processes, so an agent that comes back presents the same key and
     * is handed the same actor.
     *
     * DEMOTED, and the demotion is the vocabulary change the badge makes:
     * this used to be the key of the whole claims table, and the home
     * believed it from anyone. Claims key on badge ids now, and this is a
     * discriminator INSIDE one badge's list — never trusted, only indexed.
     * A browser wears several personas under one cookie and a machine's
     * badge vouches for its human and each of its agents; both need to say
     * which claim they mean, and neither is asserting a credential by
     * doing so. The op itself is unchanged: naming yourself is the same
     * user-visible act, so it is the same one op and the same (absent)
     * undo.
     */
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
    /**
     * The canvas this claim is made FROM — the bound directory for a CLI
     * (#60), the canvas in the address bar for a browser. Recorded on the
     * binding so the registry can say which canvas an agent is of.
     *
     * It is also the ROOM this name is being taken in, and mechanism 10
     * makes that count: name uniqueness is judged against the rosters the
     * claiming badge can see, and a surface that has not been anywhere yet
     * — a browser naming itself at the identity dialog, before it has
     * fetched a thing — would otherwise be judged against nobody and walk
     * in wearing a name somebody on that very canvas already answers to.
     *
     * It widens the QUESTION, never the answer: it grants no admission and
     * carries no authority, and today it can only reach a canvas the
     * address would have admitted the asker to anyway. Absent on the very
     * first handshake in a fresh directory, whose canvas is only created
     * after the claim answers.
     */
    canvasId?: string;
} | {
    /**
     * Choosing the color you wear — cursor, face, pins, and the Pen's
     * default ink (#identity colors). Home-scoped like `actor.claim`:
     * `canvasId` is null, it lands in the home's actors log, and the
     * ENGINE applies it against the actor registry. NOT undoable, for the
     * same reason naming yourself is not.
     *
     * `color` is a literal hex; null goes back to the color the actor id
     * implies, so "unset" and "derived" are one state.
     */
    type: "actor.setColor";
    actorId: string;
    color: string | null;
} | {
    /**
     * **The mark you wear instead of your initial.**
     *
     * A face is a coloured disc with the first letter of a name in it, which
     * is fine until a canvas has a Di, a Dion and a Dimitri on it. An emoji
     * is the thing people actually reach for — presence labels have carried
     * one by convention for a while ("Kenny 🤖") — and this makes it a fact
     * rather than a habit inside a string.
     *
     * **A field and not a prefix on the name**, for the reason `mapParent`
     * is not `parent`: a name is matched on (`isocan history di` takes a
     * prefix), listed, and sorted, and a name that sometimes begins with a
     * pictograph breaks all three in ways nobody would connect to the emoji
     * they picked.
     *
     * Home-scoped and not undoable, exactly like `actor.setColor`: null puts
     * you back on your initial, so "no row" and "derived" are one state.
     */
    type: "actor.setMark";
    actorId: string;
    /** One emoji, or null to go back to the initial. */
    mark: string | null;
} | {
    /**
     * **Two actors become one person** (multi-identity phase 5).
     *
     * A person who was `Dimitri 2` on one machine for a while and then
     * became Dimitri leaves two actors behind, each with its own comments,
     * mentions and undo history. This folds `from` into `into`: the
     * registry records the join, and every reader resolves `from` through
     * it before comparing — names, colours, marks, the inbox, presence,
     * undo. Nothing in the log is rewritten; every op `from` wrote still
     * carries `from`'s id.
     *
     * Home-scoped and not undoable, like the colour and the mark. Refused
     * unless the presenting badge claims BOTH actors, when `from` equals
     * `into`, when either id is unknown to the home, or when the join would
     * close a cycle.
     */
    type: "actor.join";
    /** The actor that stops answering. */
    from: string;
    /** The actor that answers for both from now on. */
    into: string;
} | {
    type: "project.create";
    canvasId: string;
    title: string;
    description?: string;
    properties?: Record<string, string>;
} | {
    type: "project.update";
    patch: MetaPatch;
} | {
    type: "project.delete";
} | {
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
/**
 * Wear or take off ONE emoji, as the actor in the envelope.
 *
 * `on` rather than a toggle, and that is not fussiness. `invertOperation`
 * is handed the state and the op and NOT the actor, so a toggle's inverse
 * would be unknowable — while `on: !on` is exact, because undo is per-actor
 * and replays the inverse stamped with the same person. The op says what
 * should be true; who it is true of comes from the envelope, which is also
 * what makes reacting as somebody else unrepresentable.
 */
 | {
    type: "item.react";
    itemId: string;
    emoji: string;
    on: boolean;
} | {
    type: "item.move";
    itemId: string;
    x: number;
    y: number;
} | {
    type: "item.resize";
    itemId: string;
    width: number;
    height: number;
} | {
    type: "item.update";
    itemId: string;
    patch: MetaPatch;
    /** Rename the file under the CURRENT version too. Renaming an item and
     * renaming its file are one act — one op, so they are one undo — and the
     * filename is a property of the version, which is why it rides here
     * rather than in the patch (which canvases share). */
    filename?: string;
} | {
    type: "item.addVersion";
    itemId: string;
    version: NewVersion;
} | {
    type: "item.setCurrentVersion";
    itemId: string;
    versionId: string;
} | {
    type: "item.removeVersion";
    itemId: string;
    versionId: string;
    prevCurrentVersionId: string;
} | {
    type: "item.restoreVersion";
    itemId: string;
    version: ItemVersion;
} | {
    type: "item.delete";
    itemId: string;
} | {
    type: "item.restore";
    itemId: string;
} | {
    type: "items.move";
    moves: Array<{
        itemId: string;
        x: number;
        y: number;
    }>;
} | {
    type: "items.delete";
    itemIds: string[];
} | {
    type: "items.restore";
    itemIds: string[];
} | {
    type: "trash.empty";
} | {
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
} | {
    type: "thread.reply";
    threadId: string;
    comment: NewComment;
} | {
    type: "thread.setAnchor";
    threadId: string;
    anchorItemId: string | null;
    x: number;
    y: number;
} | {
    type: "thread.setMain";
    threadId: string | null;
} | {
    type: "thread.delete";
    threadId: string;
} | {
    /**
     * Rewrite a comment you wrote. An agent working takes minutes, and a
     * thread that reads "on it" / "still on it" / "found it" / "done" is
     * four comments where one would do — so a working note is ONE comment
     * that changes. Only the author may: nobody else gets to put words in
     * your mouth, and the reducer refuses rather than trusting a client.
     */
    type: "comment.update";
    threadId: string;
    commentId: string;
    body: string;
    /** Re-resolved for the new body; see NewComment. */
    mentions?: string[];
    items?: string[];
} | {
    type: "comment.remove";
    threadId: string;
    commentId: string;
} | {
    type: "comment.restore";
    threadId: string;
    comment: Comment;
} | {
    type: "thread.restore";
    thread: CommentThread;
} | {
    /**
     * Grant an actor standing to answer on this canvas. Carries the whole
     * `Actor` (not just the id) so an enrolled-but-never-spoken agent is
     * visible to every derivation that walks canvas state for actors —
     * mention candidates above all. Re-enrolling an enrolled actor updates
     * the record in place (the rules change; the standing was already
     * there).
     */
    type: "agent.enroll";
    agent: Actor;
    /**
     * The routing half, stored EXACTLY as the gesture hands it over and
     * interpreted by nobody yet — what a rule may say is phase 4's door,
     * decided where dispatch first reads one.
     */
    rules?: unknown;
} | {
    /** Take the standing back. The enrolment row goes; the log keeps the
     * whole story, which is journey 8's "history untouched". */
    type: "agent.withdraw";
    actorId: string;
};
export type OperationType = Operation["type"];
/** Ops the engine accepts directly from clients (everything non-internal). */
export declare const INTERNAL_OP_TYPES: ReadonlySet<OperationType>;
export interface OpEnvelope {
    /** Op id (nanoid). */
    id: string;
    /** null only for project.create (the canvas doesn't exist yet). */
    canvasId: string | null;
    /** Identity stamped on the mutation. */
    actor: Actor;
    /** Originating connection, for attribution in UI. */
    clientId?: string;
    /** Assigned by the daemon. */
    ts: string;
    op: Operation;
}
export interface LogEntry {
    /** Monotonic per canvas. */
    seq: number;
    /** Op normalized (placement resolved to concrete coordinates). */
    envelope: OpEnvelope;
    /** Computed from pre-state before applying; null = not undoable. */
    inverse: Operation | null;
    /** Present when this entry was produced by undo/redo of another entry. */
    cause?: {
        kind: "undo" | "redo";
        targetSeq: number;
    };
    /**
     * **One gesture, one undo.** Ops written together under the same id are
     * undone and redone together.
     *
     * Not a transaction, and the difference matters: if the fifth op of eight
     * fails, the four that landed are real, everybody can see them, and undo
     * has to handle exactly that. This says *these were one act*, and nothing
     * about whether all of them arrived. Atomicity would mean rolling back a
     * distributed write across a replica and a home, which is an enormously
     * larger promise than any gesture here needs.
     *
     * The CLIENT decides, because a group is an intent — "paste these eight",
     * "re-word this note and its title" — and no daemon can infer it. Absent
     * means a group of one, which is exactly what every entry written before
     * this existed already is, so old logs need no migration.
     *
     * `docs/research/2026-08-28-op-grouping.md` is the argument, including why
     * time-based coalescing was rejected: it guesses, and correctness that
     * varies with the speed of the writer is not correctness.
     */
    group?: string;
    /** Seq of the undo entry that reversed this one. Derived bookkeeping —
     * reconstructed from `cause` on load; never rewritten into the log file. */
    undoneBy?: number;
}
