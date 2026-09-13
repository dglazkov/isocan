import type { Actor } from "@isocan/core";
import { groupFitAction, isGroupItem, fitMoves } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";

import { changeCanvasGroup, groupsEnabled } from "./canvasgroups.ts";
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
  if (state.canvasId !== canvasId) return;
  const canvas = state.canvas;
  if (!canvas) return;

  const targets: { itemId: string; width: number; height: number }[] = [];
  for (const id of itemIds) {
    const item = canvas.items[id];
    if (!item || (groupsEnabled() && isGroupItem(item))) continue;
    const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
    if (!version) continue;
    const size = await naturalSize(canvasId, version.blobHash, version.mimeType);
    targets.push({ itemId: id, ...size });
  }
  if (useCanvasStore.getState().canvasId !== canvasId) return;
  if (groupsEnabled()) {
    const frames = itemIds.filter((id) => canvas.items[id] && isGroupItem(canvas.items[id]!)).map((itemId) => ({ itemId }));
    if (frames.length || targets.length) await changeCanvasGroup(canvasId, actor, groupFitAction({ project: state.project!, canvas }, [...frames, ...targets]));
    return;
  }
  if (targets.length === 0) return;

  // Re-read: measuring is asynchronous and somebody else may have moved
  // something while a page was laying itself out.
  const fresh = useCanvasStore.getState().canvas;
  if (!fresh) return;
  const { resizes, moves } = fitMoves(fresh, targets);

  for (const r of resizes) {
    await sendEchoed(canvasId, actor, { type: "item.resize", itemId: r.itemId, width: r.width, height: r.height });
  }
  // One op for the lot, so settling the group is one undo step rather than
  // six — the same bargain `items.delete` already makes.
  if (moves.length > 0) {
    await sendEchoed(canvasId, actor, { type: "items.move", moves });
  }
}
