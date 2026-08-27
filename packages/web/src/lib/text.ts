import type { Actor, Placement } from "@isocan/core";
import {
  TEXT_FILENAME,
  TEXT_MIME,
  TEXT_PROPERTIES,
  newItemId,
  newVersionId,
  textBox,
  textTitle,
} from "@isocan/core";
import { sendOp, uploadBlob } from "./api.ts";

/**
 * Words typed onto the canvas, committed the same way ink is
 * (`addDrawing` above it in spirit): the body becomes a markdown blob and an
 * ordinary `item.add`. No op type belongs to the Text tool — see
 * `core/textnode.ts` for why that is the whole design rather than a
 * convenience — so `isocan text` from a terminal and typing on the canvas
 * land the SAME item, and neither surface can make one the other cannot.
 */
export async function addTextNode(
  canvasId: string,
  actor: Actor,
  body: string,
  placement: Placement,
  /** What the composer actually measured, when it had a box to measure. The
   *  estimate in `textBox` exists for the CLI, which has nothing to measure
   *  with; the app should not use a guess when it has the real thing. */
  measured?: { width: number; height: number },
): Promise<string> {
  const blob = new Blob([body], { type: TEXT_MIME });
  const upload = await uploadBlob(canvasId, blob, TEXT_FILENAME);
  const itemId = newItemId();
  const box = measured ?? textBox(body);
  await sendOp(canvasId, actor, {
    type: "item.add",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: TEXT_MIME,
      filename: TEXT_FILENAME,
      size: upload.size,
    },
    width: box.width,
    height: box.height,
    placement,
    title: textTitle(body),
    properties: TEXT_PROPERTIES,
  });
  return itemId;
}

/**
 * Re-word an existing text node: `item.addVersion`, so every wording it has
 * ever had stays on the version stack and `⌘Z` walks back through them. The
 * title moves with the words — a note is its words, so a stale title would
 * be a lie in `ls` and in every `#chip` pointing here.
 *
 * The honest cost, named rather than hidden: an edit is TWO ops, so it is two
 * undo steps. There is no compound op in the vocabulary and this is not
 * reason enough to invent one — a new op type is a new thing both surfaces
 * must know, forever, to save one keypress. If edits ever want to be atomic,
 * the fix is a general grouping in the oplog, which would pay for itself
 * across every multi-op gesture rather than just this one.
 *
 * The box is only corrected when the words actually outgrew it. A note that
 * gets a word shorter does not need the canvas rearranging under it, and
 * `⇧F` re-fits deliberately whenever somebody wants that.
 */
export async function reviseTextNode(
  canvasId: string,
  actor: Actor,
  itemId: string,
  body: string,
  measured?: { width: number; height: number },
  /** True when the composer measured taller than the item currently is. */
  grew = false,
): Promise<void> {
  const blob = new Blob([body], { type: TEXT_MIME });
  const upload = await uploadBlob(canvasId, blob, TEXT_FILENAME);
  await sendOp(canvasId, actor, {
    type: "item.addVersion",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: TEXT_MIME,
      filename: TEXT_FILENAME,
      size: upload.size,
    },
  });
  await sendOp(canvasId, actor, {
    type: "item.update",
    itemId,
    patch: { title: textTitle(body) },
  });
  if (measured && grew) {
    await sendOp(canvasId, actor, {
      type: "item.resize",
      itemId,
      width: measured.width,
      height: measured.height,
    });
  }
}

/** What committing a composer should actually do. */
export type TextCommit =
  | { do: "nothing"; why: "empty" | "unchanged" }
  | { do: "create"; body: string }
  | { do: "revise"; body: string };

/**
 * The three rules a composer closes by — lifted out of the component because
 * they are rules, not rendering, and because each one is a decision somebody
 * could reasonably get wrong later.
 *
 * 1. **Empty words are not a node.** Opening the tool, thinking better of it,
 *    and clicking away must leave nothing behind.
 * 2. **Emptying an existing node is not a delete.** Somebody who selects all
 *    and hits backspace has not asked for the item to go; the words they can
 *    still see are the ones that stay. Deleting is a delete.
 * 3. **Unchanged words are not a new version.** Double-clicking a note to
 *    read it and clicking away must not push a version onto its stack, or
 *    the history stops meaning anything.
 */
export function textCommit(typed: string, before: string, existing: boolean): TextCommit {
  const body = typed.trim();
  if (!body) return { do: "nothing", why: "empty" };
  if (body === before.trim()) return { do: "nothing", why: "unchanged" };
  return existing ? { do: "revise", body } : { do: "create", body };
}
