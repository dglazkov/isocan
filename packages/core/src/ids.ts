import { nanoid } from "nanoid";

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(10)}`;
}

export const newProjectId = () => newId("prj");
export const newItemId = () => newId("itm");
export const newVersionId = () => newId("ver");
export const newThreadId = () => newId("thr");
export const newCommentId = () => newId("cmt");
export const newOpId = () => newId("op");
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
export const isOpId = (value: unknown): value is string =>
  typeof value === "string" && /^op_[A-Za-z0-9_-]{6,32}$/.test(value);
export const newActorId = () => newId("usr");
export const newClientId = () => newId("cli");
