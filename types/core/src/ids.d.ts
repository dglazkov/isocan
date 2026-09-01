export declare function newId(prefix: string): string;
/** **`prj_` is a deliberate holdout** (phase 13.5's rename): every id ever
 * minted carries it, and every share link ever pasted contains it. The
 * function says canvas; the three letters are data. */
export declare const newCanvasId: () => string;
export declare const newItemId: () => string;
export declare const newVersionId: () => string;
export declare const newThreadId: () => string;
export declare const newCommentId: () => string;
export declare const newOpId: () => string;
/** A gesture's name — see `LogEntry.group`. One per act, however many ops
 *  the act turns out to write. */
export declare const newGroupId: () => string;
/**
 * Is this something this codebase would have minted as an op id?
 *
 * Asked at the door of `POST /api/ops` because phase 10 lets a CLIENT supply
 * the envelope id as an idempotency key, and an id that goes into the oplog
 * should look like every other id in it. Shape only — an id is not a
 * credential, and the check is here to keep the log tidy and the key
 * collision-shaped, not to keep anybody out. (What a caller could do with a
 * colliding id is get its own op dropped and be handed the seq of an entry it
 * could already read from any snapshot; there is nothing behind this door to
 * take.)
 */
export declare const isOpId: (value: unknown) => value is string;
export declare const newActorId: () => string;
export declare const newClientId: () => string;
