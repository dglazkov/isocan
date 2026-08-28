import type { Actor, Item } from "@isocan/core";
import {
  copyProperties,
  duplicatePlacements,
  newGroupId,
  newItemId,
  newVersionId,
} from "@isocan/core";
import { blobUrl, sendOp, uploadBlob } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **Copy and paste, including into a different canvas.**
 *
 * The clipboard here is the app's own, not the system's, and that is the
 * decision worth explaining. `lib/copy.ts` records what this repo learned the
 * hard way: `navigator.clipboard` is permissioned, a refusal is
 * indistinguishable from having no clipboard at all, and **Chrome blocks it
 * outright while the tab is `hidden`**. A ⌘C that silently did nothing under
 * conditions nobody can see is not a feature. So the copy lands somewhere
 * this app controls, and the system clipboard is a courtesy on top.
 *
 * It holds the item RECORDS, not their ids. Ids would be unresolvable the
 * moment you navigate to another canvas — which is exactly the case this is
 * for — and would also mean editing an original after copying silently
 * changed what you were about to paste.
 */
export interface Clipboard {
  /** Where these came from: paste is a different act within it and outside it. */
  canvasId: string;
  items: Item[];
}

/**
 * Paste into `canvasId`, at `want` or on clear ground beside the originals.
 *
 * Returns the new item ids in the order they were made.
 */
export async function pasteInto(
  clipboard: Clipboard,
  canvasId: string,
  actor: Actor,
  want?: { x: number; y: number },
): Promise<string[]> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return [];
  const sameCanvas = clipboard.canvasId === canvasId;
  // One paste is one act, so one ⌘Z takes it back — however many items it
  // turns out to be. See `LogEntry.group`.
  const group = newGroupId();
  // The arrangement is placed against the canvas being pasted INTO — the
  // group keeps its shape, and finds ground that is clear here.
  const placements = duplicatePlacements(canvas, clipboard.items, want);
  const made: string[] = [];
  for (const { item, x, y } of placements) {
    const version = item.versions.find((v) => v.id === item.currentVersionId);
    if (!version) continue;
    let blobHash = version.blobHash;
    if (!sameCanvas) {
      /**
       * A blob is addressed per canvas, so the bytes have to be put where
       * the new item will look for them. Read through the app origin's
       * badged route — this is a chrome read, not a frame, so it uses the
       * same URL every other chrome read uses (content-origin invariant 3).
       */
      const res = await fetch(blobUrl(clipboard.canvasId, version.blobHash), {
        credentials: "include",
      });
      if (!res.ok) continue; // the source is gone; skip it rather than fail the paste
      const bytes = await res.blob();
      const up = await uploadBlob(canvasId, bytes, version.filename);
      blobHash = up.blobHash;
    }
    const itemId = newItemId();
    await sendOp(
      canvasId,
      actor,
      {
      type: "item.add",
      itemId,
      version: {
        id: newVersionId(),
        blobHash,
        mimeType: version.mimeType,
        filename: version.filename,
        size: version.size,
      },
      width: item.width,
      height: item.height,
      placement: { x, y },
      title: item.title,
      ...(item.description ? { description: item.description } : {}),
      properties: copyProperties(item, { sameCanvas }),
      },
      group,
    );
    made.push(itemId);
  }
  return made;
}
