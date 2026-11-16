/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { nanoid } from "nanoid";

/**
 * `<prefix>_` and ten nanoid characters. The prefix is what lets a person — or a log
 * line — tell an item id from a thread id at a glance; every minter below goes through here.
 */
export function newId(prefix: string): string {
  return `${prefix}_${nanoid(10)}`;
}

/** **`prj_` is a deliberate holdout** (phase 13.5's rename): every id ever
 * minted carries it, and every share link ever pasted contains it. The
 * function says canvas; the three letters are data. */
export const newCanvasId = () => newId("prj");
export const newItemId = () => newId("itm");
export const newVersionId = () => newId("ver");
export const newThreadId = () => newId("thr");
export const newCommentId = () => newId("cmt");
/** `op_` — an operation envelope's id; `isOpId` below is the shape a client's own must match. */
export const newOpId = () => newId("op");
/** A gesture's name — see `LogEntry.group`. One per act, however many ops
 *  the act turns out to write. */
export const newGroupId = () => newId("grp");
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
/** `usr_` — an actor, person or agent alike. */
export const newActorId = () => newId("usr");
/** `cli_` — one browser tab, so it can recognise its own ops when they are broadcast back. */
export const newClientId = () => newId("cli");
