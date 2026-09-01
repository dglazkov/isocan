import type { Actor, CanvasContents, Operation, PresenceActivity, PresenceSession } from "../../core/src/index.js";
export declare const SESSION_TTL_MS: number;
export declare class PresenceHub {
    private readonly ttlMs;
    private rooms;
    private listeners;
    private sweeper;
    constructor(ttlMs?: number);
    close(): void;
    onChange(listener: (canvasId: string) => void): void;
    private emit;
    private room;
    createSession(canvasId: string, actor: Actor, kind: PresenceSession["kind"], options?: {
        label?: string;
        sessionId?: string;
        harness?: string;
    }): PresenceSession;
    /** Update + heartbeat. Returns false if the session is gone (expired). */
    touch(canvasId: string, sessionId: string, patch?: {
        /** Who is holding this session now. Presence is client-asserted on every
         * beat, so renaming yourself — or becoming someone else entirely —
         * lands on every other screen without dropping the socket. */
        actor?: Actor;
        cursor?: {
            x: number;
            y: number;
        } | null;
        selection?: string[];
        status?: string | null;
        statusSource?: "explicit" | "lifecycle" | "inferred";
        activity?: PresenceActivity | null;
        onThread?: string | null;
    }): boolean;
    endSession(canvasId: string, sessionId: string): void;
    /**
     * Every session an actor holds, ended at once — on every canvas. The
     * client's session pointer is a cache; this is the truth. A pointer lost
     * to a crash or a migration must not leave a face blinking on a canvas
     * after its agent has left. `kind` narrows the sweep so a CLI leaving
     * cannot take down the same person's live browser tabs.
     */
    endActorSessions(actorId: string, kind?: PresenceSession["kind"]): number;
    /** Who this canvas sees: everyone actually on it — this daemon's own
     * clients and every face mirrored in from a connection. */
    roster(canvasId: string): PresenceSession[];
    /**
     * Every face in every room, as `[canvasId, session]` pairs.
     *
     * Presence rides on the PER-CANVAS socket, which is the right shape for a
     * canvas and the wrong shape for a question about a person: the lens shows
     * one agent across twelve canvases and holds a socket to none of them.
     * Opening twelve to draw twelve dots would be absurd, so the cross-canvas
     * question is a read.
     *
     * Unfiltered on purpose — this is daemon memory, and the caller applies the
     * admission test, because only the route knows whose badge is asking.
     */
    everywhere(): Array<{
        canvasId: string;
        session: PresenceSession;
    }>;
    /**
     * This daemon's OWN faces on a canvas — what a home connection relays up.
     *
     * The narrowing is the loop guard: relaying `roster()` would send the home
     * back the faces it just sent us, and every roster either end published
     * would provoke another.
     */
    localRoster(canvasId: string): PresenceSession[];
    /**
     * Take a roster somebody else is authoritative about and hold it here.
     *
     * Used in BOTH directions, which is why it is one method: the home stores a
     * replica's relayed faces under that socket, and the replica stores the
     * home's roster under its home connection. `sessions` REPLACES everything
     * previously mirrored under `origin` on this canvas — a full set rather than
     * a diff, because the sender already computes the full set and a diff
     * protocol is a second thing to get wrong.
     *
     * Sessions keep their ids verbatim. That is what lets the sender recognize
     * (and drop) its own faces when the merged roster comes back, and what makes
     * a face the same face on every screen it reaches.
     *
     * Presence is still never written down: this is daemon memory and WS fan-out
     * exactly as before, and nothing here reaches a store or an oplog.
     */
    mirror(canvasId: string, origin: string, sessions: readonly PresenceSession[]): void;
    /** Every face mirrored in from this origin, gone — on every canvas. What a
     * dropped home connection (or a closed relaying socket) means: nobody on the
     * other side of it is visibly here any more. */
    dropMirror(origin: string): void;
    /** What this session says it is answering, and since when. */
    onThreadOf(canvasId: string, sessionId: string): {
        threadId: string;
        since: string | null;
    } | null;
    /** Op piggyback: an op whose clientId matches a session moves that
     * session's cursor to the op's locus — presence traces the real work.
     * A CLI session that expired mid-task (ids are "ses_…") is auto-revived
     * from the op's own actor: working makes you visible again. */
    opApplied(canvasId: string, clientId: string | undefined, actor: Actor, op: Operation, canvas: CanvasContents): void;
    private sweep;
}
/** Where on the canvas an op "happened", given post-apply state. */
export declare function opLocus(op: Operation, canvas: CanvasContents): {
    x: number;
    y: number;
} | null;
