import type { Actor, Item } from "@isocan/core";
import {
  copyProperties,
  duplicatePlacements,
  newGroupId,
  newItemId,
  newVersionId,
} from "@isocan/core";
import { readBlob, uploadBlob } from "./api.ts";
import { sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";

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
  let skipped = 0;
  for (const { item, x, y } of placements) {
    const version = item.versions.find((v) => v.id === item.currentVersionId);
    if (!version) continue;
    let blobHash = version.blobHash;
    if (!sameCanvas) {
      /**
       * A blob is addressed per canvas, so the bytes have to be put where
       * the new item will look for them. Read through the app origin's
       * badged route — this is a chrome read, not a frame, so it goes the
       * way every other chrome read goes (content-origin invariant 3).
       *
       * Skipping an item whose bytes are gone is still the right answer, and
       * still not a reason to fail the other four. What was wrong is that it
       * used to be SILENT, and that a lost badge took the same branch: a
       * cross-canvas paste on a tab with a cleared cookie skipped every item
       * and looked like a paste of nothing. `readBlob` knocks first, so a
       * skip now means the source really is gone — and the count below says
       * so out loud either way.
       */
      const bytes = await readBlob(clipboard.canvasId, version.blobHash).catch(() => null);
      if (bytes === null) {
        skipped++;
        continue;
      }
      const up = await uploadBlob(canvasId, bytes, version.filename);
      blobHash = up.blobHash;
    }
    const itemId = newItemId();
    await sendEchoed(
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
      // A paste AT a point (the menu, at the pointer) is a chosen spot and
      // stays put; a paste beside the originals is a computed one and may
      // be tidied. See `Placement.chosen`.
      placement: { x, y, ...(want ? { chosen: true } : {}) },
      title: item.title,
      ...(item.description ? { description: item.description } : {}),
      properties: copyProperties(item, { sameCanvas }),
      },
      group,
    );
    made.push(itemId);
  }
  if (skipped > 0) {
    setNotice(
      `${skipped} item${skipped === 1 ? "" : "s"} could not be pasted — the copied bytes could not be read.`,
    );
  }
  return made;
}
