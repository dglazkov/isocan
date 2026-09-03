import type { Actor, Canvas, CanvasSnapshotResponse, CommentThread, Item, ItemKind, NewComment, Operation, WatchedLogEntry } from "../../core/src/index.js";
import { type ActivityEntry } from "../../core/src/index.js";
import { type Ctx } from "./ctx.js";
import { type ExplicitIdentity } from "./identity.js";
import { type DaemonRoutes } from "./routes.js";
/**
 * **`connect()` — the API's front door** (iso-api phase 2, journey 1).
 *
 * Resolves exactly as the CLI resolves, because it IS that resolution: the
 * same directory marker walk, the same session-claim identity, the same
 * `homes.json`, the same daemon auto-start — `resolveCtx`, called with two
 * differences a script forces:
 *
 * - **It never prompts.** The CLI's first-run flow asks a person at a TTY for
 *   a name; a script that reaches this door with no identity is refused with
 *   the reason and the way in, eagerly, so the refusal lands at `connect()`
 *   rather than halfway through a run.
 * - **Identity can be a stated argument.** A script that is its own actor —
 *   the board — used to build environment variables so the CLI would resolve
 *   it; `identity: { session, harness }` is that gesture as a parameter. The
 *   actor must already be claimed (the claim stays a deliberate act:
 *   `isocan identity --name … --session` under that session), so a script
 *   and a CLI presenting the same key are the same collaborator.
 *
 * The moved layer's stderr voice (phase 1's finding) is kept, deliberately:
 * staleness notes, upgrade notes and binding notes are one-time courtesies
 * addressed to whoever reads the process's transcript, and a script's stderr
 * is exactly that channel. What `connect()` removes is the interactive half —
 * nothing here ever waits on a keyboard.
 */
export interface ConnectOptions {
    /**
     * The session this script speaks as, instead of the ambient walk. The
     * resolution is what the CLI does with `ISOCAN_SESSION_ID` (and
     * `ISOCAN_HARNESS`) in its environment; the actor must already be claimed
     * under the key, and an unclaimed one is refused with the claim gesture.
     */
    identity?: ExplicitIdentity;
    /** The daemon port, when it is not `ISOCAN_PORT`/the default. */
    port?: number;
}
export declare function connect(options?: ConnectOptions): Promise<Home>;
/**
 * **A home handle, not only a directory handle** — what journey 1 forces: the
 * board cannot be written against "this directory's canvas" alone. The
 * directory's canvas is the default reach; any other opens by ref, with the
 * same matching `--canvas` uses, off the same client.
 */
export declare class Home {
    readonly ctx: Ctx;
    constructor(ctx: Ctx);
    /** Who this connection speaks as. */
    get actor(): Actor;
    /**
     * A canvas to work: no ref means the directory's canvas resolved the way
     * every CLI command resolves it (marker walk, home default, only-one); a
     * ref is an id or unique title prefix, `--canvas`'s own matching.
     */
    canvas(ref?: string): Promise<CanvasHandle>;
}
/** What add and edit take: the content itself, as a value — a string or a
 * buffer with its mime type. No file, no temp directory; a path convenience
 * can sit atop this the day a consumer reaches for one. */
export interface ContentSpec {
    content: string | Buffer;
    /** Required on `add`; `edit` inherits the current version's when omitted. */
    mime?: string;
    /** The name the bytes leave the canvas under (`isocan get`, downloads).
     * Defaults from the title and the mime's extension on `add`, and from the
     * current version on `edit`. */
    filename?: string;
}
export interface AddSpec extends ContentSpec {
    mime: string;
    title?: string;
    description?: string;
    /** World coordinates. Omitted, the item lands left of the leftmost item —
     * the CLI's own default placement. */
    at?: {
        x: number;
        y: number;
    };
    size?: {
        width: number;
        height: number;
    };
    properties?: Record<string, string>;
}
/** The metadata half of `isocan set`, sized to what a script reaches for. */
export interface SetSpec {
    properties?: Record<string, string>;
    removeProperties?: string[];
    size?: {
        width: number;
        height: number;
    };
}
/** A name in use on a canvas — from a live session or from its history. Keyed
 * by NAME, not actor: one person can have worked under several, and every one
 * of them still answers to `@Name`. */
export interface KnownName {
    name: string;
    /** Who answers to it. */
    id: string;
    /** They are on the canvas right now, under this name. */
    live: boolean;
}
/** One act on the canvas, with who did it — `isocan activity`'s row. */
export interface ActivityRow extends ActivityEntry {
    who: string;
}
/** The rows for a set of actors, newest first under one budget — the one
 * assembly behind `CanvasHandle.activity()` and `isocan activity` (which
 * also filters WHO before asking, so the shaping is shared, not copied). */
export declare function activityRows(snapshot: CanvasSnapshotResponse, actors: Actor[], limit: number): ActivityRow[];
/** An item as the reads hand it out: the record plus its derived kind, the
 * same pairing `isocan --json ls` prints. */
export type ListedItem = Item & {
    kind: ItemKind;
};
/** What `tail()` takes: where to resume, and how to stop. */
export interface TailOptions {
    /**
     * Yield entries with seq greater than this — the seq of the last entry the
     * caller handled, which every yielded entry carries as `entry.seq`. Omitted,
     * the tail starts at the canvas's current tip: entries that land after the
     * iteration begins. `since: 0` replays the whole live log.
     */
    since?: number;
    /** Ends the iteration — cleanly, no throw — when aborted, including one
     * blocked in a held poll or in a retry pause. */
    signal?: AbortSignal;
}
/** What `tail()` yields: the log entry itself (its `seq` is the cursor to
 * resume from), with the op's type flattened to the one field a reaction
 * switches on. Who wrote it is `entry.envelope.actor` — a watcher that also
 * writes skips its own. */
export interface TailEntry extends WatchedLogEntry {
    opType: Operation["type"];
}
/**
 * **One canvas, held open** — the reads a script leans on and the ops it
 * sends, each the CLI's own act without the argv. Items are named by their
 * exact id: a script holds ids because every op returns what it made; the
 * prefix-and-title matching is the CLI's affordance for a person typing.
 */
export declare class CanvasHandle {
    readonly ctx: Ctx;
    readonly record: Canvas;
    constructor(ctx: Ctx, record: Canvas);
    get id(): string;
    get title(): string;
    private snapshot;
    /** Every network act on this handle throws `ApiError` — see {@link reaching}. */
    private reach;
    /** Every live item, each carrying its derived kind — `--json ls`. */
    items(): Promise<ListedItem[]>;
    /** One item, by exact id, fresh from the store. */
    item(itemId: string): Promise<Item>;
    /** Every comment thread — `--json comment list`. */
    threads(): Promise<CommentThread[]>;
    /** Everyone who has touched this canvas, and whether they are here now —
     * `--json who --all`. */
    who(): Promise<KnownName[]>;
    /** What everyone has been doing, newest first — `--json activity`. */
    activity(limit?: number): Promise<ActivityRow[]>;
    /**
     * **The log as an iterator** (iso-api phase 3, journey 2): every entry that
     * lands on this canvas, in order, as an async iterator over the daemon's
     * long-poll — the same `watchLog` laps `isocan wait` lives on, without the
     * park row, the dispatch rules, or the self-filter. A raw tail: the caller
     * decides what an entry means.
     *
     * **The cursor stays with the caller.** `{ since }` in; each yielded entry
     * carries its `seq` out. A tail that dies resumes by handing back the last
     * seq it handled — the seq-cursor gesture every replica uses — and the
     * first entry the new tail yields is the one after it. Nothing here stores
     * anything: where "handled" is recorded is the caller's business.
     *
     * **A dropped connection is a pause, never an entry.** A daemon restart, an
     * upgrade, a laptop waking up — the poll fails at the connection level, the
     * cursor is unchanged, and the loop retries (starting the daemon again if
     * it is gone, `isocan wait`'s own gesture). Nothing is yielded for the
     * reconnect, so a consumer cannot mistake it for activity — the
     * auto-upgrade project's standing lesson, inherited. Ops written while the
     * connection was down are still in the log and arrive as themselves. The
     * daemon ANSWERING with a refusal is different: an `ApiError` means
     * somebody was there to say no, and it is thrown, not retried.
     */
    tail(options?: TailOptions): AsyncGenerator<TailEntry, void, undefined>;
    /**
     * A new item from content held in hand, returning the item the store now
     * holds — its version stack, its `blobHash`, its resolved position. The
     * call that created it is the call that hands it back, which is what lets
     * a publisher compare bytes next run without re-listing anything.
     */
    add(spec: AddSpec): Promise<Item>;
    /** The CLI's default: left of the leftmost item, origin on an empty canvas. */
    private defaultPlacement;
    /**
     * A new version of an existing item, from content in hand. Mime and
     * filename default from the version being succeeded. Returns the item with
     * its grown stack — the new version is `currentVersionId`.
     */
    edit(itemId: string, spec: ContentSpec): Promise<Item>;
    /** Properties on, properties off, a resize — the slice of `isocan set` a
     * script reaches for. Same ops, so the same undo. */
    set(itemId: string, patch: SetSpec): Promise<void>;
    /** Move an item — and what is drawn on it travels with it, the same rule
     * the CLI's `mv` and the web app's drag follow. */
    move(itemId: string, x: number, y: number): Promise<void>;
    /**
     * Start a thread on an item — `isocan comment add --item`'s act. A bot
     * with something to say every commit says it HERE, on the panel it is
     * about, not in the Chat: on 3 Sep 2026 one board's 137 build notices
     * were a third of the request corpus and had made the Chat unusable as a
     * channel — it noticed itself, mid-run, that it had posted 80 of a
     * thread's 96 messages.
     */
    comment(itemId: string, message: string): Promise<{
        threadId: string;
        commentId: string;
    }>;
    /** Reply in a thread that exists — `isocan comment reply`'s act. */
    reply(threadId: string, message: string): Promise<{
        threadId: string;
        commentId: string;
    }>;
    /**
     * Say something in the Chat — `isocan notify`'s act: the main thread gets
     * the reply, or is born from the first message, with `@Name` mentions and
     * `#Title` references resolved the way every comment resolves them.
     */
    notify(message: string): Promise<{
        threadId: string;
        commentId: string;
    }>;
    private newComment;
}
/**
 * Build a comment payload, resolving @Name mentions against everyone the
 * author can see (canvas actors plus the live presence roster, labels too)
 * and #Title references against the live items. One spelling, consumed by
 * `CanvasHandle.notify()` and every CLI comment verb — a mention that
 * resolves differently depending on which surface posted it would summon
 * nobody.
 */
export declare function buildComment(client: DaemonRoutes, canvasId: string, snapshot: CanvasSnapshotResponse, body: string): Promise<NewComment>;
