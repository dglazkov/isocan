import type {
  Paper, Actor, Placement } from "@isocan/core";
import {
  TEXT_FACE_PROP,
  TEXT_FILENAME,
  TEXT_MIME,
  TEXT_PROPERTIES,
  TEXT_STYLE_PROP,
  newGroupId,
  newItemId,
  newVersionId,
  textBox,
  textTitle,
  type TextFace,
  type TextStyle,
  PAPER_PROP,
  PAPER_SIZE,
  paperPatch,
} from "@isocan/core";
import { uploadBlob } from "./api.ts";
import { sendEchoed } from "../stores/canvasStore.ts";

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
  style: TextStyle = "body",
  face: TextFace = "sans",
  /** Paper, or null for a plain caption. See `core/textnode.ts`. */
  paper: Paper | null = null,
): Promise<string> {
  const blob = new Blob([body], { type: TEXT_MIME });
  const upload = await uploadBlob(canvasId, blob, TEXT_FILENAME);
  const itemId = newItemId();
  /**
   * Paper is SQUARE rather than measured, and that is the whole point of it:
   * a post-it will not hold an essay, so it holds an idea. A note sized to
   * its words is a text node with a background.
   */
  const box = paper !== null ? { width: PAPER_SIZE, height: PAPER_SIZE } : (measured ?? textBox(body, style));
  /**
   * **`sendEchoed`, so the thing you just made appears when you make it.**
   *
   * This posted with `sendOp`, which has no local echo — the node appeared
   * only when the home's broadcast came back down the socket. On a healthy
   * connection that is invisible; on a sick one the gesture does nothing at
   * all, and it was reported exactly that way: "⌘Enter and nothing is added
   * to the canvas". The node WAS created. The tab never learned.
   *
   * The blob is already uploaded by this line, so the optimistic apply
   * describes something that genuinely exists at the home. An echo of a
   * version nobody else could fetch would be a different and much worse idea.
   */
  await sendEchoed(canvasId, actor, {
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
    // The defaults are written as ABSENCE, not as "body"/"sans": a node that
    // says nothing renders the same as every node made before the ladder
    // existed, and there is exactly one spelling of the default.
    properties: {
      ...TEXT_PROPERTIES,
      ...(style === "body" ? {} : { [TEXT_STYLE_PROP]: style }),
      ...(face === "sans" ? {} : { [TEXT_FACE_PROP]: face }),
      ...(paper === null ? {} : { [PAPER_PROP]: paper }),
    },
  });
  return itemId;
}

/**
 * Re-word an existing text node: `item.addVersion`, so every wording it has
 * ever had stays on the version stack and `⌘Z` walks back through them. The
 * title moves with the words — a note is its words, so a stale title would
 * be a lie in `ls` and in every `#chip` pointing here.
 *
 * An edit is TWO ops — the words, then the title — and it used to be two undo
 * steps. The note here said so, and said the fix was "a general grouping in
 * the oplog, which would pay for itself across every multi-op gesture rather
 * than just this one" rather than a new op type invented to save one
 * keypress. That grouping exists now (`LogEntry.group`), so both ops go under
 * one id and one ⌘Z takes the edit back.
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
  style: TextStyle = "body",
  face: TextFace = "sans",
  /** The paper the words were on when they committed — the swatches sit on
   *  the composer during an edit too, so a note re-opened yellow and closed
   *  pink has to land pink, or the one control that changes how it looks
   *  works only the first time. `null` takes the paper OFF; the patch comes
   *  from core so this cannot spell the property differently from the CLI. */
  paper: Paper | null = null,
): Promise<void> {
  const onPaper = paperPatch(paper);
  // One edit, one undo: the version, the title and any resize are one act.
  const group = newGroupId();
  const blob = new Blob([body], { type: TEXT_MIME });
  const upload = await uploadBlob(canvasId, blob, TEXT_FILENAME);
  await sendEchoed(
    canvasId,
    actor,
    {
      type: "item.addVersion",
      itemId,
      version: {
        id: newVersionId(),
        blobHash: upload.blobHash,
        mimeType: TEXT_MIME,
        filename: TEXT_FILENAME,
        size: upload.size,
      },
    },
    group,
  );
  await sendEchoed(
    canvasId,
    actor,
    {
    type: "item.update",
    itemId,
    patch: {
      title: textTitle(body),
      // Restyling to a default must REMOVE the property rather than write
      // the word "body" — otherwise there are two spellings of the same node
      // and only one of them matches what the CLI writes.
      properties: {
        ...(style === "body" ? {} : { [TEXT_STYLE_PROP]: style }),
        ...(face === "sans" ? {} : { [TEXT_FACE_PROP]: face }),
        ...("properties" in onPaper ? onPaper.properties : {}),
      },
      removeProperties: [
        ...(style === "body" ? [TEXT_STYLE_PROP] : []),
        ...(face === "sans" ? [TEXT_FACE_PROP] : []),
        ...("removeProperties" in onPaper ? onPaper.removeProperties : []),
      ],
    },
    },
    group,
  );
  if (measured && grew) {
    await sendEchoed(
      canvasId,
      actor,
      { type: "item.resize", itemId, width: measured.width, height: measured.height },
      group,
    );
  }
}

/** What committing a composer should actually do. */
/* Not exported: the shape of `textCommit`'s answer, which callers read
   rather than name. */
type TextCommit =
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
