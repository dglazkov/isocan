import type { Actor } from "@isocan/core";
import { fitMoves } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { sendOp } from "./api.ts";
import { blobUrl } from "./api.ts";
import { naturalSize } from "./measure.ts";

/**
 * Grow the selection to fit its content, and settle it so nothing overlaps.
 *
 * Items arrive capped — an image at 480 wide, an HTML screen at 420x320
 * however it was designed — so a screen sits on the canvas showing a corner of
 * itself. This is the way back.
 *
 * The sizes are measured here, in a browser, because only a browser can lay a
 * page out. The MOVES are computed by `fitMoves` in core, so the arrangement
 * this produces is the arrangement the CLI would produce.
 */
export async function fitToContent(canvasId: string, actor: Actor, itemIds: string[]): Promise<void> {
  const state = useCanvasStore.getState();
  const canvas = state.canvas;
  if (!canvas) return;

  const targets: { itemId: string; width: number; height: number }[] = [];
  for (const id of itemIds) {
    const item = canvas.items[id];
    if (!item) continue;
    const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
    if (!version) continue;
    const size = await naturalSize(blobUrl(canvasId, version.blobHash), version.mimeType);
    targets.push({ itemId: id, ...size });
  }
  if (targets.length === 0) return;

  // Re-read: measuring is asynchronous and somebody else may have moved
  // something while a page was laying itself out.
  const fresh = useCanvasStore.getState().canvas;
  if (!fresh) return;
  const { resizes, moves } = fitMoves(fresh, targets);

  for (const r of resizes) {
    await sendOp(canvasId, actor, { type: "item.resize", itemId: r.itemId, width: r.width, height: r.height });
  }
  // One op for the lot, so settling the group is one undo step rather than
  // six — the same bargain `items.delete` already makes.
  if (moves.length > 0) {
    await sendOp(canvasId, actor, { type: "items.move", moves });
  }
}
