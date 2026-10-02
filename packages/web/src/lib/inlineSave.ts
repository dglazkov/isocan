import type { Actor, Item } from "@isocan/core";
import type { CopyEdit } from "@isocan/core/copy-deck";
import { modules } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { fetchBlobText } from "./blobtext.ts";
import { webHostFor } from "./modulehost.ts";
import { isAttrEdit, type InPlaceEdit } from "./textEdits.ts";
import { applyEdits } from "./textPatch.ts";
import { addVersionFromFile } from "./upload.ts";

/**
 * **Saving the stage's in-place edits** — fetched when somebody saves (or
 * opens a wireframe to edit), never at first paint.
 *
 * Plain HTML is spliced by position (`textPatch.ts`) and lands as a version,
 * as it always has. A WIREFRAME's words are not its HTML's: they are the
 * spec embedded in the file, and every re-render (a restyle, `wire flesh`, a
 * prototype rebuild) draws from that spec — so a splice alone was silently
 * taken back by the next one. On a wire screen the wireframe module names
 * each edited node's word path (`WebModule.copy.at`) and its writer
 * (`WebModule.copy.apply`) writes the spec and the file as one version in
 * one op group: one undo.
 */

/** What every rendered or spec-carrying wire screen says (the wireframe module's `WIRE_MARKER`). */
const WIRE_MARKER = "<!-- isocan:wireframe -->";

/** The module that writes a wire screen's words, once its lazy half has loaded (a canvas with wires on it loads it). */
const wireWriter = () => {
  const copy = modules().find((m) => m.copy?.kind === "wire")?.copy;
  return copy?.at && copy.apply ? { at: copy.at, apply: copy.apply } : undefined;
};

/** Where a text node sits on a wire screen — its section, its nearest `data-wf`, what it says: what `WebModule.copy.at` reads. */
function placeOf(node: Text): { slot?: string; wf?: string; text: string } {
  const el = node.parentElement;
  const slot = el?.closest("[data-sec]")?.getAttribute("data-sec");
  const wf = el?.closest("[data-wf]")?.getAttribute("data-wf");
  return { ...(slot != null ? { slot } : {}), ...(wf != null ? { wf } : {}), text: node.data };
}

/**
 * The nth text node of a file, counted as the frame and `textPatch.ts` count
 * them — parsed by the browser, which builds the tree the frame shows.
 */
function textNodeAt(source: string, ordinal: number): Text | null {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  for (let seen = 0; walker.nextNode(); seen++) if (seen === ordinal) return walker.currentNode as Text;
  return null;
}

/** Why this node cannot be edited in place on a wire screen, or null when it can (or when that cannot be told yet: the save asks again). */
export async function wireRefusal(source: string, node: Text): Promise<string | null> {
  const at = await wireWriter()?.at(source, placeOf(node));
  return !at || at.ok ? null : at.reason;
}

/** Save the pending edits as the item's next version; the refusal in words, or null when it landed. */
export async function saveInPlace(canvasId: string, actor: Actor, item: Item, source: string, pending: readonly InPlaceEdit[]): Promise<string | null> {
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  const patched = await applyEdits(source, pending);
  if (!patched.ok) return patched.reason;
  const real = pending.filter((edit) => edit.from !== edit.to);
  const texts = real.filter((edit) => !isAttrEdit(edit));
  // The renderer's marker, by string: core's `embeddedWire` would bring the diff and the parser as two more chunks.
  if (texts.length === 0 || !source.includes(WIRE_MARKER)) {
    await addVersionFromFile(canvasId, actor, item.id, new File([patched.source], current.filename, { type: current.mimeType }));
    return null;
  }
  if (texts.length !== real.length) {
    return "On a wireframe, save the words and the properties separately — the words go to its spec, the properties to its file.";
  }
  const writer = wireWriter();
  if (!writer) return "The wireframe module has not loaded yet, so this screen's words cannot be written — try again in a moment.";
  const edits: CopyEdit[] = [];
  for (const edit of texts) {
    const node = textNodeAt(source, edit.ordinal);
    if (!node) return "that text is no longer in the file — reload and try again";
    const at = await writer.at(source, placeOf(node));
    if (!at.ok) return at.reason;
    edits.push({ address: at.address, text: at.text, to: edit.to as string });
  }
  try {
    await writer.apply(
      { ...webHostFor(canvasId, actor), readText: (hash) => fetchBlobText(canvasId, hash), getCanvas: () => useCanvasStore.getState().canvas! },
      canvasId,
      item.id,
      edits,
      { by: actor.name, html: patched.source },
    );
  } catch (error) {
    return (error as Error).message;
  }
  return null;
}
