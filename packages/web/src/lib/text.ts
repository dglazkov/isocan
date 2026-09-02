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
    patch: { title: textTitle(body), ...lookPatch(style, face, paper) },
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

/**
 * The patch that gives a text node its look — step, face and paper — in the
 * one spelling both surfaces write.
 *
 * Restyling to a default must REMOVE the property rather than write the word
 * "body": otherwise there are two spellings of the same node and only one of
 * them matches what the CLI writes. Paper comes from core's `paperPatch` for
 * the same reason, and `null` takes it off.
 */
function lookPatch(
  style: TextStyle,
  face: TextFace,
  paper: Paper | null,
): { properties: Record<string, string>; removeProperties: string[] } {
  const onPaper = paperPatch(paper);
  return {
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
  };
}

/**
 * **Change how an existing node looks, and land it now.**
 *
 * The step, face and paper buttons sit on the composer, and for a node that
 * already exists they used to be held until the words committed — which
 * they never did when the words had not changed, because "unchanged words
 * are not a new version" is a rule about VERSIONS and was being asked about
 * a colour. Double-click a caption, pick yellow, click away: nothing saved.
 * Reported exactly so.
 *
 * A look is not a wording. It is `item.update`, it lands the moment it is
 * chosen, and it is one undo step of its own — the same shape a resize or a
 * move has. The words, if they change, are a separate step when they commit.
 *
 * `box` is for the one restyle that changes the node's SHAPE: a caption
 * putting paper on becomes a square, because a 320×40 post-it is a caption
 * with a background (`core/textnode.ts`). It rides in the same group, so
 * "make it a note" is still one ⌘Z.
 */
export async function restyleTextNode(
  canvasId: string,
  actor: Actor,
  itemId: string,
  style: TextStyle,
  face: TextFace,
  paper: Paper | null,
  box?: { width: number; height: number } | null,
): Promise<void> {
  const group = newGroupId();
  await sendEchoed(canvasId, actor, { type: "item.update", itemId, patch: lookPatch(style, face, paper) }, group);
  if (box) {
    await sendEchoed(canvasId, actor, { type: "item.resize", itemId, width: box.width, height: box.height }, group);
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
