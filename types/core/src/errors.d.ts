/**
 * **The one word for a home-scope refusal**, wherever a refusal already
 * carries a word.
 *
 * As the `reason` beside `not-admitted` at the door and on a
 * `WS_NOT_ADMITTED` close, where `withdrawn`, `taken-down` and `ended` ride:
 * the same kind of fact about the same kind of moment, and every client that
 * branches on those is already looking in the right place. As the `code` at
 * `/api/attest` and at the door's mint, where there is no admission to be
 * refused and the refusal is the whole answer. And as the `OpValidationError`
 * code at `actor.claim`, so a terminal prints the sentence and stops rather
 * than reading `name-taken` and offering a pass.
 *
 * Short, for `TAKEN_DOWN`'s reason: a WebSocket close reason is capped at 123
 * bytes and throws rather than truncating, so the word travels on the socket
 * and the sentence is fetched by whoever renders it. Kept with the other
 * wire errors so branching on it does not load refusal policy helpers.
 */
export declare const REFUSED = "refused";
type OpErrorCode = "unknown-item" | "unknown-version" | "unknown-thread" | "unknown-comment" | "unknown-anchor" | "not-in-trash" | "duplicate-id" | "empty-body" | "last-comment" | "main-exists" | "name-taken" | "unknown-actor"
/** The speaker named an actor its badge does not claim (the identity desk's
 * mechanism 5). The remedy is always the same and always available: claim
 * the actor first. */
 | "not-your-actor"
/** `actor.join` refused as a join: folding an actor into itself, closing a
 * cycle, folding one that is already folded, or a presenting badge that
 * does not speak for both actors (multi-identity phase 5). The remedy is
 * in the message; an unknown id is `unknown-actor`, as everywhere else. */
 | "bad-join" | "internal-op" | "unknown-op"
/** This daemon is no longer the writer for that canvas — another instance
 * already used the sequence number it tried to claim. Never retried by the
 * client: see `OplogFencedError`. */
 | "writer-fenced" | "group-conflict"
/** The operator of this home refused that name (operator phase 6): a
 * claim `as` an actor on the refusal list. Its own code rather than
 * `name-taken`, because the remedy differs — a pass will not help, and the
 * message is the home's sentence, with the address to write to. */
 | "refused" | "bad-op";
export declare class OpValidationError extends Error {
    readonly code: OpErrorCode;
    constructor(code: OpErrorCode, message: string);
}
/** Structural undo conflicts must not be discarded or fall through to older work. */
export declare class GroupConflictError extends OpValidationError {
    constructor(message: string);
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
export {};
