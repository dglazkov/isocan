export type OpErrorCode = "unknown-item" | "unknown-version" | "unknown-thread" | "unknown-comment" | "unknown-anchor" | "not-in-trash" | "duplicate-id" | "empty-body" | "last-comment" | "main-exists" | "name-taken" | "unknown-actor"
/** The speaker named an actor its badge does not claim (the identity desk's
 * mechanism 5). The remedy is always the same and always available: claim
 * the actor first. */
 | "not-your-actor" | "internal-op" | "unknown-op"
/** This daemon is no longer the writer for that canvas — another instance
 * already used the sequence number it tried to claim. Never retried by the
 * client: see `OplogFencedError`. */
 | "writer-fenced" | "bad-op";
export declare class OpValidationError extends Error {
    readonly code: OpErrorCode;
    constructor(code: OpErrorCode, message: string);
}
/**
 * Two writers reached for one sequence number and this one lost.
 *
 * A DISTINCT error, not an `OpValidationError`, because the one thing that
 * must never happen to it is a retry: a `bad-op` is something the caller can
 * fix and try again, and this is the opposite — the op was refused because
 * this process is writing behind another one, and trying again with the same
 * belief about `lastSeq` refuses again. The remedy is on the daemon's side
 * (drop the canvas's runtime, re-load from the store, re-submit), which is
 * why the wire code is its own word.
 *
 * On a `FileStore` home this cannot happen — one process owns the directory.
 * It exists because the cloud backing's oplog is create-only per seq, so the
 * SCHEMA refuses the second writer rather than a lock doing it, and a deploy
 * that overlaps two instances is a normal Tuesday rather than a disaster.
 */
export declare class OplogFencedError extends Error {
    /** Which canvas — a fence is per-canvas, not per-process. */
    readonly canvasId: string;
    /** The seq this writer believed was next, and which was already taken. */
    readonly seq: number;
    readonly code: "writer-fenced";
    constructor(
    /** Which canvas — a fence is per-canvas, not per-process. */
    canvasId: string, 
    /** The seq this writer believed was next, and which was already taken. */
    seq: number, message?: string);
}
/**
 * Exhaustiveness guard for the op switches. `op: never` makes an unhandled
 * variant a compile error; at runtime it rejects an op this build predates —
 * a stale daemon meeting a newer CLI. Without it the switch falls through and
 * returns undefined, which the engine would log as an inverse-less entry and
 * assign as canvas state.
 */
export declare function unknownOperation(op: never): never;
