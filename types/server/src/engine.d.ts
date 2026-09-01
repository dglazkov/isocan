import type { Actor, ActorBindingRecord, ActorClaimOp, ActorColors, ActorMarks, ActorNames, ActorSetColorOp, ActorSetMarkOp, CanvasSnapshotResponse, LogEntry, Operation, PresenceSession, Canvas, ServerMessage, SlashCommand, UploadTicket } from "../../core/src/index.js";
import type { BlobUploadRequest, Store } from "./store.js";
import type { Desk } from "./desk.js";
import type { HomeDirectory } from "./home-link.js";
import { type GcOptions, type GcReport } from "./gc.js";
export interface EngineOptions {
    /** Who is visibly on a canvas right now — presence, which lives outside
     * the engine. Claims consult it so a live face holds its name. */
    liveness?: (canvasId: string) => PresenceSession[];
}
export declare class CanvasNotFoundError extends Error {
    constructor(id: string);
}
export declare class NothingToUndoError extends Error {
    constructor(kind: "undo" | "redo", actorName?: string);
}
export interface SubmitRequest {
    canvasId: string | null;
    actor: Actor;
    clientId?: string;
    /** The client's own name for this op — the idempotency key. See
     * `PostOpRequest.opId` in core for what it is for, and `alreadyWritten`
     * below for what the engine does with it. */
    opId?: string;
    /** **One gesture, one undo** — see `LogEntry.group`. Carried through to the
     *  entry, and read by `UndoStacks` when deciding what one ⌘Z reverses. */
    group?: string;
    /**
     * **Where this canvas is being born** — meaningful for `project.create`
     * alone, and refused by the route on anything else (phase 10.3).
     *
     * See `PostOpRequest.home` in core for the whole argument. The short version
     * is that it is WRITE-ONCE and about one canvas: it establishes a row for a
     * canvas coming into existence and can never re-point one that already
     * exists, because a second create for an existing id is `duplicate-id` or a
     * replay. That bound is what makes it safe as request metadata beside `opId`
     * and `clientId` rather than a `--home` flag on every verb, which phase 7.5
     * refused and phase 10.3 goes on refusing.
     */
    home?: string;
    op: Operation;
    /**
     * The badge that presented this request — resolved by the transport and
     * handed to the engine BESIDE the request, never inside it (mechanism 5).
     *
     * It stops here. `envelope()` builds the log entry field by field and this
     * is not one of them: the oplog is shared state every replica sees, and
     * which badge issued which op is the home's private audit, not the canvas's
     * history. Same instinct as "the oplog never records grants".
     */
    badgeId: string;
}
export interface ClaimRequest {
    op: ActorClaimOp;
    clientId?: string;
    /** The badge presenting the claim. `actor.claim` is "add an actor to THIS
     * badge's claims", so the transport has to say which badge. */
    badgeId: string;
}
type EventListener = (canvasId: string, message: ServerMessage) => void;
/**
 * An entry as it arrives from a home — a `LogEntry` whose `inverse` may not be
 * known yet.
 *
 * Two shapes reach a replica for the SAME entry: the WS broadcast carries the
 * whole `LogEntry` the home built (inverse and cause included), while
 * `POST /api/ops` answers with `{ seq, envelope }` only. The second is
 * complete enough: the inverse is `invertOperation` of the op against the
 * pre-state, the reducer is the same reducer on both machines, and the entry
 * is only ever applied when the local state IS the pre-state (see
 * `applyRemoteEntry`'s contiguity guard) — so recomputing it produces the
 * bytes the home produced. That is the isomorphism contract doing work rather
 * than being admired.
 */
type IncomingEntry = Omit<LogEntry, "inverse"> & {
    inverse?: Operation | null;
};
/** What `applyRemoteEntry` did, so the caller knows whether to resync.
 * "skipped" is the ordinary case, not an error: the POST answer and the
 * broadcast are the same entry arriving twice. */
export type RemoteApply = "applied" | "skipped" | "gap";
/**
 * The single op engine. ALL mutations — from the CLI, the web app, and
 * undo/redo — funnel through one promise chain, giving single-writer
 * discipline over both the in-memory state and the files.
 *
 * Per mutation: validate → invert (from pre-state) → apply → append+fsync
 * oplog → atomically rewrite snapshots → broadcast.
 */
export declare class Engine {
    private readonly store;
    /** The desk. The engine writes the claims half through it and never
     * touches the transport's half (badges, secrets, admissions). */
    private readonly desk;
    private readonly options;
    private canvases;
    private actorsRuntime;
    private queue;
    private listeners;
    private colorListeners;
    /**
     * The homes this engine is a REPLICA of, per canvas — empty (or null) when
     * this daemon is the home of everything it holds.
     *
     * This one field is the demotion, and phase 10.3 made the demotion **per
     * canvas** rather than per daemon: for a canvas whose row names a home, the
     * engine stops being a writer — the mutation is forwarded, that home assigns
     * the seq, and what comes back is applied here VERBATIM through
     * `applyRemoteEntry`. For a canvas with no row, this daemon IS the home and
     * nothing changes at all. Both kinds of canvas can sit in one store, which
     * is the whole of the phase.
     *
     * The single-writer promise chain below is untouched and still does exactly
     * what it always did — it serializes forwarded writes and arriving entries
     * against each other instead of serializing writes against writes. There is
     * still exactly one thing mutating this daemon's state at a time; what
     * changed is who decides the order, and (now) that the answer to "who"
     * depends on which canvas.
     */
    private homes;
    constructor(store: Store, 
    /** The desk. The engine writes the claims half through it and never
     * touches the transport's half (badges, secrets, admissions). */
    desk: Desk, options?: EngineOptions);
    /**
     * Point this engine at its homes — the composition root's last wire, set in
     * `startDaemon` before the port is bound, so no request can ever see the
     * engine half-demoted.
     *
     * A setter rather than a constructor argument because the two objects need
     * each other: a home connection applies what it receives THROUGH the engine,
     * and the engine forwards what it is asked THROUGH the connection.
     * Constructing one with the other would be a cycle; one setter at the
     * composition root is the honest cut.
     *
     * It keeps its name under phase 10.3's widening from one connection to a
     * directory, because it still reads correctly — this is still where the
     * engine is told there is somewhere else to send things — and every word of
     * the reasoning above survives with `home` reading `homes`.
     */
    forwardTo(directory: HomeDirectory | null): void;
    /** Subscribe to canvas events; returns an unsubscribe function. */
    onEvent(listener: EventListener): () => void;
    private emit;
    /**
     * Resolves when everything currently on the single-writer chain has run.
     *
     * The replica needed it and the reason is worth keeping: a forwarded write
     * holds the chain across its HTTP round trip, so between "the home has
     * created this canvas" and "this daemon has written it down" there is a real
     * window — and the home connection's dial, which asks the store how far it
     * has got, was reading that store MID-WRITE. It presented `since=0` for a
     * canvas it was in the middle of creating, was correctly answered with a
     * snapshot, and adopted it over the entry that was one line from landing.
     * Waiting for the chain to drain makes the cursor a fact rather than a
     * guess, and it is the same discipline every other reader here already has
     * — it just had no name.
     */
    settled(): Promise<void>;
    /** Serialize all mutations through one chain. */
    private enqueue;
    listCanvases(): Promise<Canvas[]>;
    getSnapshot(canvasId: string): Promise<CanvasSnapshotResponse>;
    /** Chosen identity colors, actor id → hex. Everything absent is derived
     * from the id, so this map is only ever the exceptions. */
    actorColors(): Promise<ActorColors>;
    /**
     * Every slash command available here: what isocan ships with, laid under
     * whatever this home has written. The menu, the CLI, and an agent looking up
     * what `/format` means all read this one list, or they would disagree about
     * what a command does — which is the only thing a command must never do.
     */
    commands(): Promise<SlashCommand[]>;
    /** Write a command for this home. Shadowing a built-in is allowed and is
     * the point: `rm` gives ours back. */
    saveCommand(name: string, text: string): Promise<void>;
    /** Remove a home command. False when there was no file to remove. */
    deleteCommand(name: string): Promise<boolean>;
    /** The name every actor goes by now, actor id → name. What a client shows
     * instead of the name stamped on a comment when it was written. */
    actorNames(): Promise<ActorNames>;
    /** The mark each actor wears instead of an initial. */
    actorMarks(): Promise<ActorMarks>;
    /**
     * Choosing the color you wear. Home-scoped like a claim: it lands in the
     * actors log, updates the registry, and is not undoable.
     *
     * BOTH actors are checked, and they are two different assertions: `actor`
     * is who is speaking and `op.actorId` is whose face changes. A badge may
     * repaint only actors it claims — a color is the actor's own choice, and
     * choosing it for somebody else is exactly the impersonation mechanism 5
     * exists to stop.
     */
    setActorColor(request: {
        op: ActorSetColorOp;
        actor: Actor;
        clientId?: string;
        badgeId: string;
    }): Promise<LogEntry>;
    /**
     * Choosing the mark you wear instead of an initial. The colour's twin in
     * every respect — home-scoped, lands in the actors log, not undoable, both
     * actors checked because choosing a face for somebody else is exactly the
     * impersonation mechanism 5 exists to stop — and forwarded to every home
     * for the same reason: the actors log never replicates down, so a home not
     * told keeps drawing the old face forever with nothing to correct it.
     *
     * **What it does NOT do yet, said plainly:** there is no live broadcast. A
     * colour has `onColors`, which repaints open canvases the moment it
     * changes; a mark reaches other people's screens on their next read of the
     * registry — a reload, or opening a canvas. Your own screen updates at
     * once. That is a real limitation rather than a hidden one, and the fix is
     * a broadcast carrying both facts rather than a second one carrying this.
     */
    setActorMark(request: {
        op: ActorSetMarkOp;
        actor: Actor;
        clientId?: string;
        badgeId: string;
    }): Promise<LogEntry>;
    /**
     * Told when identity changes — a color chosen, or a name taken — so live
     * canvases can repaint their faces and re-letter what people said.
     *
     * The listener is told WHICH ACTOR changed, and that is mechanism 10's one
     * behavioral narrowing: a color travels with its actor (global, per actor),
     * but the BROADCAST does not. This used to flood every room on the home;
     * the transport now asks `appearances()` which of its open rooms that actor
     * is actually in, and repaints those. On a solo home that is every room it
     * was before; on a multi-tenant one it is the difference between a repaint
     * and a roster leak.
     */
    onColors(listener: (colors: ActorColors, actorId: string) => void): () => void;
    private identityChanged;
    /**
     * Which of these canvases that actor APPEARS on — the rooms a color change
     * or a rename has any business repainting (mechanism 10).
     *
     * Appearance is deliberately wider than presence. A rename has to reach the
     * comments the renamed actor wrote before it, in rooms where nobody by that
     * name is currently connected — so history counts: the canvas's authors,
     * every name the canvas remembers, and the live roster.
     */
    appearances(actorId: string, canvasIds: Iterable<string>): Promise<string[]>;
    /**
     * Mechanism 5's membership check, at the one place the claims registry
     * lives. Public because presence beats are checked too and presence does
     * not live on this chain; the op paths call it INSIDE their queued work, so
     * a claim and an op racing serialize like everything else.
     */
    requireActor(badgeId: string, actorId: string): Promise<void>;
    /**
     * **How far this canvas has actually got** — the number a tab compares its
     * own cursor against to find out it has stopped hearing (#85).
     *
     * Read from the runtime rather than counted along the broadcast path, and
     * that is the whole point: the failure this answers is broadcasts stopping
     * while the socket stays up, so a tip derived from the thing that stopped
     * would agree with the tab and confirm the freeze.
     *
     * Returns null for a canvas this home cannot produce, because a beat is not
     * the place to raise: the socket is fine, and a heartbeat that threw would
     * take down the one mechanism that is supposed to be steady.
     */
    tipSeq(canvasId: string): Promise<number | null>;
    getLog(canvasId: string, sinceSeq?: number): Promise<LogEntry[]>;
    /**
     * What `gc` compacted away, oldest first. Straight from the backing rather
     * than from the runtime — archived entries are exactly the ones the runtime
     * no longer holds. `runtime()` is still called first so an unknown canvas
     * answers "not found" here the same way it does on `getLog`, instead of an
     * empty archive.
     */
    getArchivedLog(canvasId: string): Promise<LogEntry[]>;
    submit(request: SubmitRequest): Promise<LogEntry>;
    /**
     * Where this op's write belongs: a home, or null for "this daemon".
     *
     * On the writer chain by construction (its one caller is inside `enqueue`),
     * which is what makes the row `bind` writes and the forward that follows it
     * one indivisible step. Two births of one id cannot interleave and end up
     * with a row from one and a forward from the other.
     */
    private homeFor;
    /**
     * Has this exact op already been written here? Then hand back the entry it
     * became, and append nothing.
     *
     * **A backwards scan of the live log rather than an index**, and that is a
     * measured choice rather than laziness. The live log is what compaction
     * keeps (`DEFAULT_KEEP_OPS`), a write is a human gesture rather than a
     * packet, and a scan of a few thousand strings costs microseconds — so the
     * index this does not have would be a second copy of the truth to keep in
     * step across four call sites, bought with nothing. Backwards because a
     * replay is by construction the most recent thing that could match: a queue
     * retries within seconds of the answer it lost.
     *
     * **The horizon, said out loud: compaction.** An op whose entry has been
     * compacted out of the live log is not found here and is applied again — and
     * what happens then is exactly what happened before phase 10 and is
     * therefore already safe. Every op that CREATES something carries a
     * client-minted id and the reducer refuses the second one with
     * `duplicate-id`; everything else is absolute-valued (and so idempotent by
     * shape) or refuses on the second pass. Past the horizon a replay degrades
     * from "here is your entry" to "that was refused" — a worse sentence, never
     * a duplicate item.
     *
     * `project.create` is included, and it has to be: its canvas is named in the
     * op rather than in the request, and a create is the one op whose replay
     * would otherwise meet `duplicate-id` at its most confusing — a person told
     * their canvas could not be made, about a canvas that exists.
     */
    private alreadyWritten;
    /**
     * Naming yourself, atomically (#57). A writer like any other: two agents
     * claiming at the same moment serialize on this chain, so the second is
     * refused or handed a different name by construction — never by a
     * client-side pre-check both of them can pass at once.
     */
    claim(request: ClaimRequest): Promise<LogEntry>;
    /**
     * **The pass's handoff: this badge now speaks as this actor** (phase 8).
     *
     * Small and named rather than a widening of `claim()`, because it is not a
     * claim. A claim is an assertion made by whoever is asking, judged against
     * everything the home can see — names, live faces, other claimants — and
     * `applyClaim` is where that judging lives. A handoff has already been
     * judged, by the only party in a position to: the badge that IS this actor
     * said so when it minted the pass, and the pass's own single use is the
     * receipt. Running it through `applyClaim` would mean sending `as`, and
     * `reincarnate` refuses `as` while the actor is visibly somebody — which,
     * at the exact moment Jordan redeems, it is: her tab is open on the canvas
     * she minted from. The gesture would refuse itself.
     *
     * It is on the writer chain like every other claims write. `Desk.setClaims`
     * says it is "called from the engine's chain", and it means it: a handoff
     * and a claim racing must serialize, or the loser's read-modify-write
     * erases the winner's row.
     *
     * **The name is filled in, never overwritten.** At a home the registry
     * already knows this actor (its minter claimed it there), so there is
     * nothing to write. On a replica the actor may be arriving on this machine
     * for the first time — the redemption is what tells this daemon that
     * `usr_jordan` is called Jordan, before any op she wrote has replicated —
     * and a hole in the registry means her own name renders as nothing. Filling
     * a hole is safe; overwriting is not, because the name that travels with a
     * pass is the name as of REDEMPTION and a roster arriving a second later is
     * the authority.
     */
    endowClaim(badgeId: string, actor: Actor, canvasId?: string): Promise<void>;
    /**
     * A name free in the ASKING badge's scope — what a home answers when a
     * replica asks on behalf of a claimant who supplied none. The other end of
     * `preferredName`, and the one thing above that a replica cannot work out
     * for itself.
     *
     * Built from `claimContext`, not from a second gathering that looks like it.
     * The whole point is that the answer comes out of the scope this home would
     * judge the resulting claim in; a lookalike scope here would be the same
     * mismatch again, one layer down.
     *
     * It asks with `"admissible"` reach rather than the claim's `"admitted"`,
     * and that is not a departure from the sentence above — it is what makes it
     * true. The badge asking has been NOWHERE yet; the rooms it is about to be
     * in are the rooms a grant would admit it to, which is where the claim it
     * is allocating for will land. Same reach `GET /api/projects` uses, for the
     * same reason. `claimContext` carries the argument and the disclosure
     * check.
     *
     * One name out, never the taken set. The scope's names are already visible
     * to this badge — a refusal says who holds a name — but a route that handed
     * back a roster on request is the listing `orphanedClaims` refuses to be,
     * and this one has no reason to be it.
     *
     * A read, off the writer chain, like the other reads here: an allocation is
     * advice until a claim acts on it, and the claim that acts on it is
     * serialized like everything else.
     */
    freeName(badgeId: string): Promise<string>;
    /**
     * Who the given session keys (or all of them, when omitted) speak as —
     * SCOPED TO ONE BADGE. A badge sees its own claims and nobody else's, which
     * is the re-key showing up on the wire: `sessionKey` is a client's index
     * into its own list, so an answer that crossed badges would be answering a
     * question nobody asked.
     *
     * Naming a key is also how a legacy claim is COLLECTED. A resuming client
     * asks "who is claude-code:s-1?" before it claims anything — `whoami` never
     * writes — so if adoption only happened inside `applyClaim`, every upgraded
     * agent's first command would resolve to the human instead of itself. A
     * named key is a presentation of that key, which is exactly what the shelf
     * waits for; adoption is still one-time and first-come.
     */
    actorBindings(badgeId: string, keys?: string[] | null): Promise<ActorBindingRecord[]>;
    /**
     * Claims on this home that match the given session keys but are held by a
     * DIFFERENT badge — the answer to "I have no identity here; is there an
     * actor I should be resuming?".
     *
     * Deliberately key-scoped rather than a listing of the home. A client asking
     * about `claude-code:s-1` is asking about a conversation it is already
     * inside; a client that could ask "who is on this home?" would be handed a
     * roster of actors to impersonate, and the answer would encourage exactly
     * the mistake `--as` exists to prevent. Nothing here is adopted: the claim
     * stays where it is, and coming back is a deliberate act.
     */
    orphanedClaims(badgeId: string, keys: string[]): Promise<ActorBindingRecord[]>;
    /**
     * Upload a blob. Not an Operation — but `blobs.json` is a whole-file
     * read-modify-write, and gc rewrites the same file, so an upload is a
     * writer like any other and belongs on the same chain. Off it, two clients
     * uploading at once both read the pre-upload index and the second write
     * erases the first's entry: bytes on disk that nothing can name, and a
     * permanent 404 for the item pointing at them.
     */
    putBlob(canvasId: string, data: Buffer, meta: {
        mimeType: string;
        filename: string;
    }): Promise<{
        blobHash: string;
        size: number;
        mimeType: string;
    }>;
    /**
     * **Are the bytes where the ops that name them went — and if not, send them.**
     *
     * A blob is not an Operation, so it does not replicate; `putBlob` pushes it
     * to the home by hand. Anything that makes that push not happen — the
     * routing table not yet read, a home that was down for the one second it
     * mattered, a process killed mid-upload — leaves the op replicated and the
     * bytes behind, forever, in silence. A teammate gets the item, its title
     * and its version number, and "blob not found" where the screen should be.
     *
     * It was reported exactly that way, and neither machine could answer the
     * only question that mattered — *are the bytes at the home?* — so the fix
     * was a hand re-upload and the confirmation was somebody else's reload.
     * That is not a repair, it is a guess that happened to work.
     *
     * This asks, per blob, and pushes the missing ones when told to. It is
     * deliberately NOT an Operation: nothing about the canvas changes. It is
     * two copies of the same content-addressed bytes being made to agree, which
     * is why it is safe to run at any time and safe to run twice.
     */
    reconcileBlobs(canvasId: string, options: {
        push: boolean;
    }): Promise<{
        home: string | null;
        checked: number;
        missing: string[];
        pushed: string[];
        unknown: string[];
    }>;
    /**
     * Somewhere to put bytes this daemon must not receive, or null when the
     * backing has no such thing (every file home). Deliberately NOT on the
     * single-writer chain: it reads one blob record and mints a URL, writing
     * nothing, and minting can involve a round trip to a signing API — putting
     * it on the chain would stall every op behind somebody's video.
     */
    beginUpload(canvasId: string, request: BlobUploadRequest): Promise<UploadTicket | null>;
    /**
     * Name bytes that arrived without us. ON the chain, because GC is on the
     * chain: a register that lands mid-sweep would otherwise re-name a blob the
     * sweep has just decided is garbage, and the item pointing at it would 404
     * forever.
     */
    registerBlob(canvasId: string, request: BlobUploadRequest): Promise<{
        blobHash: string;
        size: number;
        mimeType: string;
    }>;
    /**
     * Actor-scoped undo: walk THIS actor's stack. Stored inverses are applied
     * as-is when possible (stale values are accepted — undo restores what you
     * changed); inverses invalidated by other actors' ops are repaired (batch
     * ops shrink to their surviving members) or skipped entirely.
     */
    undo(canvasId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry>;
    redo(canvasId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry>;
    /**
     * Blob garbage collection: compact the oplog to an undo horizon (dropped
     * entries go to the archive), then sweep blobs unreachable from live state,
     * trash, and the retained log. Runs inside the single-writer queue, so it
     * cannot race a mutation; the mtime grace period covers uploads that have
     * not become items yet. Maintenance, not an Operation — never undoable.
     */
    gc(canvasId: string, options?: GcOptions): Promise<GcReport>;
    /**
     * One entry from the home, landed here with **the home's seq, verbatim**.
     *
     * The seq is not re-assigned and the entry does not go near
     * `applyAndPersist`'s numbering. That is not an implementation detail, it is
     * the demotion: two machines numbering one log is the disaster the whole
     * design forbids, and a replica that renumbered would make its own oplog
     * un-comparable with the home's — which is the one thing that has to stay
     * true for a seq cursor to mean anything on reconnect.
     *
     * ## The double-application guard
     *
     * A forwarded write's answer and the broadcast of that same write are the
     * SAME entry arriving twice, by two routes, in either order. **Seq is the
     * idempotence key**, and it is the natural one: the home assigns seqs
     * strictly increasing per canvas from one writer, so `seq <= lastSeq` means
     * "already have it" with no bookkeeping to keep, no dedup table to bound,
     * and nothing to get wrong after a restart — the store itself remembers.
     * Whichever route arrives first applies; the other is a no-op. (In practice
     * the broadcast usually wins, because the home broadcasts inside its own
     * write before it writes the HTTP response.)
     *
     * `gap` is the other answer: an entry past `lastSeq + 1` cannot be applied
     * on top of a state that is not its pre-state, so it is refused here and the
     * caller re-dials with the cursor it does hold. Guessing would be the only
     * way to be wrong silently.
     */
    applyRemote(canvasId: string, entry: IncomingEntry): Promise<RemoteApply>;
    /**
     * The home could not serve a tail, so it sent state instead — take it.
     *
     * The live log is emptied in the same breath, and that is the load-bearing
     * half. The entries this replica holds are a PREFIX the home has told us it
     * cannot join up to; keeping them beside a snapshot from far past their end
     * would leave `load()` replaying a tail that is not a tail, and `getLog`
     * answering a cursor question with entries from before the gap. Emptying it
     * through `compactOplog` rather than by deletion is deliberate: that method
     * archives before it forgets, so the history is preserved for audit, and a
     * backing where a seq must stay claimed forever (the cloud one) is not asked
     * to free anything.
     */
    adoptRemoteSnapshot(canvasId: string, snapshot: CanvasSnapshotResponse): Promise<void>;
    /** The home says this canvas is gone. Soft, like every delete here: the
     * directory is moved aside rather than removed, so a replica that was told
     * to forget a canvas can still be asked what it used to hold. */
    applyRemoteDelete(canvasId: string): Promise<void>;
    /**
     * Identity's public face, as the home has it — names and chosen colors.
     *
     * These ride on every `snapshot`, every `resumed` and every
     * `presence-roster` already, for the reason `protocol.ts` gives: nothing in
     * an op tail carries them, and a rename has to reach the words somebody
     * wrote before it. On a replica they are also the ONLY route by which a
     * stranger's name arrives — the actors oplog is home-scoped and `/ws` is per
     * canvas, so `isocan who` and `isocan ls` on this machine would otherwise
     * letter everyone by whatever was stamped on their oldest comment.
     *
     * A merge, never a replacement: an actor the home has not heard of yet (one
     * claimed here a second ago, whose announcement is still in flight) keeps
     * its local row instead of being erased by an answer that simply does not
     * mention it.
     *
     * ---
     *
     * **A RENAME THAT DID NOT REACH A HOME IS LOST WHEN THAT HOME COMES BACK.
     * Measured, 2026-08-24 (phase 10.3), not reasoned about.**
     *
     * The mechanism is the loop below: `at: now` is stamped on whatever a roster
     * carries and a differing name is overwritten unconditionally. The wire
     * carries `names: Record<actorId, string>` with **no timestamps**, so
     * last-writer-wins is not available here without a protocol change — the
     * only thing this code can know about a name is that a home said it just
     * now, which is exactly what makes the stale one win.
     *
     * What the measurement did: two homes, one daemon holding a canvas at each.
     * Kenny renames himself to Isaac while H2 is down. The announcement reaches
     * H1. H2 comes back on the same address. What was observed at the daemon:
     *
     * - `Isaac → Kenny`, within a couple of seconds of H2's first roster, **and
     *   it stayed Kenny.** Five seconds of sampling, one transition, no
     *   recovery. H1 went on saying Isaac and H2 went on saying Kenny, so the
     *   two homes now disagree permanently and the machine sides with the stale
     *   one.
     * - **A live relay does NOT correct it.** There was a session on H2's canvas
     *   relaying continuously throughout, which is the mechanism that was
     *   supposed to heal this (`ensureClaim`'s cache is keyed by id AND name, so
     *   a relay carrying the new name would re-claim it). It carried the name
     *   the roster had just overwritten, which is the old one, so the cache was
     *   never asked about the new one.
     * - **A WRITE does correct it — but only if the new name is still held
     *   somewhere outside this daemon.** Posting an op with `actor: {id, name:
     *   "Isaac"}` brought both the daemon and H2 back to Isaac immediately. In
     *   practice a person's CLI resolves its name FROM this registry, which by
     *   then says Kenny, so a real rename is not flapping — it is gone.
     *
     * **And it is NOT new**, which is the half the design got wrong and the half
     * that matters most for what to do about it. The control — the same rename
     * against a daemon with ONE home — flapped identically: `Kenny`, with no
     * transition away from it, from the moment the home returned. Phase 10.3 did
     * not create this seam. It made the WINDOW ordinary: before it, a daemon
     * whose home was down refused every write on the machine, so nobody carried
     * on working through an outage and nobody renamed themselves during one.
     * Now a canvas at a reachable home keeps working while another home is
     * away, so the window is a normal afternoon.
     *
     * Left as a named seam rather than fixed here, deliberately: the fix is
     * timestamps on the wire (`names: Record<actorId, {name, at}>`), which is a
     * protocol change on three message types, and this phase's Work is
     * elsewhere. What is NOT acceptable is the version of this comment that said
     * "transient and self-healing" — that was a hypothesis, and it measured
     * false.
     */
    mergeRemoteIdentity(colors: ActorColors, names: ActorNames): Promise<void>;
    /** Forward a write and land the home's answer here. Runs INSIDE the queue —
     * hence the private, unqueued `applyRemoteEntry` rather than the public
     * `applyRemote`, which would deadlock waiting on the chain it is already
     * on. */
    private forwardSubmit;
    /**
     * Apply what the home answered, and hand the caller the home's own entry.
     *
     * Applying here rather than only waiting for the socket is what makes
     * read-after-write work on a replica: `bindFresh` creates a canvas and reads
     * it straight back, `isocan add` prints the item it just made. A round trip
     * through the socket would be a race the CLI would lose often enough to be a
     * bug report. Applying twice is free — see `applyRemoteEntry`'s seq guard.
     */
    private landRemote;
    /** The unqueued core. Every caller is already on the chain. */
    private applyRemoteEntry;
    private applyClaimAndPersist;
    /**
     * Everything `applyClaim` is allowed to see, gathered at the single writer.
     *
     * The GATHERING is where mechanism 10 lives, and it lives here rather than
     * in the reducer on purpose: `claims.ts` has never heard of a badge record
     * or an admission, and judging a name against "everyone in scope" is the
     * same code whatever the scope turns out to be. What changed in phase 3 is
     * only what gets put in front of it.
     */
    private claimContext;
    /**
     * **Is this claimant allowed to be that actor, and by what?** — the
     * gathering half of mechanism 6, and the tightening that comes with it.
     *
     * Two facts, both about badges, both computed HERE because `claims.ts` has
     * never heard of a badge record and must not start:
     *
     * - `heldElsewhere` — some other badge already speaks as this actor, under a
     *   key that is not the one being presented. That is what turns `as` from an
     *   open assertion into a request that needs a vouch.
     *
     *   **Two exclusions, and both are load-bearing.** The migration SHELF is
     *   not "elsewhere": a shelved pre-badge row belongs to no holder at all,
     *   and treating it as one would lock a legacy session out of its own actor
     *   on the one hop it has to adopt it. And a row under THE SAME SESSION KEY
     *   is not "elsewhere" either, which is the shipped lost-badge recovery and
     *   the reason this tightening stops where it does — see the note on
     *   `heldElsewhere` in `claims.ts`.
     * - `vouchedBy` — the attribute this badge and a badge claiming that actor
     *   have BOTH proved. Jordan's phone and Jordan's laptop, one inbox.
     *
     * **The vouch is a membership test against the listing**, not a second
     * spelling of the rule — the same discipline kill-a-badge takes ("what you
     * may kill and what you are shown cannot drift apart"). What a surface is
     * OFFERED on `GET /api/attest` and what the reducer will ACCEPT are one
     * computation, so a person cannot be shown a button that is refused.
     */
    private vouch;
    /**
     * **Who this badge may resume, and on the strength of what** — mechanism 6's
     * "a badge attesting the same email as the badge that claimed an actor may
     * resume that actor".
     *
     * Every actor claimed by some OTHER live badge that has proved an attribute
     * this badge has also proved, minus the ones this badge already claims
     * (those need no resuming — `claimsActor` already says yes).
     *
     * **A badge with no attestations resumes nobody, in one line and with no
     * query.** That is the whole of "attestation adds a way and removes none":
     * the overwhelming majority of holders have proved nothing, and for them
     * this function is a document read and an empty array.
     *
     * The name comes from the registry as of NOW rather than from the claim row,
     * for `redeemPass`'s reason: a person who renamed herself is offered the name
     * she goes by, which is also the name her work already carries.
     */
    resumable(badgeId: string): Promise<{
        actor: Actor;
        via: string;
    }[]>;
    /**
     * Ask the home for a name, when this daemon is a replica and the claimant
     * asked for none — the ONE part of a claim that crosses the wire.
     *
     * The split is deliberate and narrow. A claim still does not forward (see
     * `claim()`), because "the process holding sessionKey `claude-code:s-1` is
     * Isaac" is a fact only this daemon can hold. But WHICH name a nameless
     * claimant is handed is not that kind of fact at all: it is a question about
     * a namespace shared with everybody else at the home, and on a replica the
     * home owns that namespace. Answering it locally is how a fresh replica
     * confidently hands out "Isaac" and is then refused by the home a
     * millisecond later — the local answer correct by its own scope, and wrong
     * where it lands.
     *
     * Three ways this stays small:
     *
     * - **Only allocation.** A supplied name is judged, not allocated, and a
     *   collision on one is still refused locally with the message it always
     *   had. A key this badge (or the shelf) already holds is a RESUMPTION,
     *   handed back the name it already has — nothing to allocate, nothing to
     *   ask.
     * - **Only a preference.** The answer arrives as `ClaimContext.preferred`
     *   and is re-checked against the local scope, so a stale answer costs a
     *   roster position rather than a wrong name.
     * - **Never load-bearing.** Any failure — an unreachable home, a home too
     *   old to know the route — falls back to local allocation, which is what a
     *   replica did before and what keeps it usable with no home in sight.
     *
     * **WHICH home is asked, under many of them** (phase 10.3), and this is the
     * one site in the table that did not simply fall out. A nameless claim is
     * not about a canvas, so `for(canvasId)` has nothing to look up; and asking
     * every home and intersecting the answers is **not available**, because
     * `freeName` returns one name out and never the taken set, on purpose (see
     * `heldNames` — a route that could return the taken set would be the home
     * listing its rosters to anyone who knocked).
     *
     * Two things make it tractable. `actor.claim` carries an optional
     * `canvasId` — phase 7's marked hole, exactly the shape needed here — so a
     * claim that names a canvas asks THAT canvas's home. A claim that names none
     * asks `birth()`: the home this machine's next canvas goes to, which is the
     * best available proxy for where this identity is heading.
     *
     * The seam left, named rather than smoothed, and **widened by exactly one
     * notch**: two replicas asking in the same instant can be handed the same
     * name, and now also a name free at one home may be taken at another. Both
     * end the same way — the second one's `announceActor` meets that home's
     * refusal exactly as it does today, with the home's own words. Closing
     * either would mean RESERVING a name at a home, and a reservation is a claim
     * — which is the thing that must not forward. So no reservation is built
     * here; the fallback below is the answer, and it is the same fallback as
     * "the home did not answer".
     */
    private preferredName;
    /**
     * Everyone the canvases IN SCOPE answer to — live faces (and their labels)
     * plus every name remembered in history, the same set an @-mention resolves
     * against. This is what `heldNames()` in the CLI used to reconstruct by
     * polling; here it is a read the single writer takes mid-claim.
     *
     * It used to walk the whole home. Mechanism 10 stops it at the claiming
     * badge's admissions: name uniqueness is a ROSTER property, so it is asked
     * of exactly the rosters that badge can see. A solo home degenerates to the
     * old walk, because a local daemon's badge is admitted to the canvases it
     * works on — the same code, with the scope emerging from the badge instead
     * of being hard-coded.
     */
    private heldNames;
    private actors;
    /** Core pipeline. Runs inside the queue. */
    private applyAndPersist;
    /**
     * A canvas is born, and with it the standing **link grant** (phase 7).
     *
     * "The status quo demoted to data": every canvas born today carries a link
     * grant, so "the address is the secret" stops being a regime and becomes one
     * revocable row. Written here rather than in the route because this is the
     * one place a canvas comes into existence under this daemon's own writership
     * — the CLI's `bindFresh`, the web app's new-canvas button and a
     * materialized marker all arrive through `project.create`, and a grant
     * written per caller would be a grant somebody forgot.
     *
     * **On a replica this method is not reached at all**, and that is correct:
     * the create FORWARDS (see `forwardSubmit`), so the canvas is born at the
     * home and the home writes the grant that governs it. What lands back here
     * is the home's entry, through `applyRemoteEntry`, which writes this
     * machine's own local row — a different sentence in a different ledger. See
     * `ensureHomeLinkGrant`.
     *
     * The grant is written AFTER the canvas exists, deliberately: a grant for a
     * canvas whose creation then failed would be a row admitting people to
     * nothing, and the desk has no transaction that spans both ledgers.
     */
    private createProject;
    private envelope;
    /**
     * Append, and if this writer has been fenced, forget what it thought it
     * knew about that canvas.
     *
     * The refusal means exactly one thing: another instance already claimed
     * this seq, so our `lastSeq` — and everything we derived from it — is
     * stale. Dropping the runtime is the "re-syncs" half of the map's sentence
     * at CANVAS granularity: the next request re-loads from the store, sees the
     * winner's ops, and numbers its own from there. Nothing was applied (the
     * append happens BEFORE `runtime.state` is touched), so there is nothing to
     * roll back — the state we are dropping is merely behind.
     *
     * Process-level fencing — a draining instance that stops serving, or
     * exits — is deliberately NOT here. It is a rollout question, it can only
     * be observed against a real rollout, and phase 5 is where a rollout
     * exists. The lever is named so nobody has to rediscover it.
     */
    private appendOrFence;
    /** The registry's fence. Home-scoped, so it drops the registry runtime
     * rather than a canvas's — same remedy, different cache. */
    private appendActorsOrFence;
    private runtime;
}
export {};
