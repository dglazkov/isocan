import type { CanvasState } from "./model.ts";
import type { Placement } from "./ops.ts";
import { OpValidationError } from "./errors.ts";

/** Gap between a new item and its anchor. */
export const PLACEMENT_GAP = 40;

/**
 * Resolve a placement to concrete world coordinates. Anchored placement puts
 * the new item neatly to the LEFT of the anchor, top-aligned. Deterministic
 * given canvas state, so it is safe to run during replay — but the daemon
 * normalizes ops to {x, y} before logging anyway.
 */
export function resolvePlacement(
  canvas: CanvasState,
  placement: Placement,
  width: number,
): { x: number; y: number } {
  if ("anchorItemId" in placement) {
    const anchor = canvas.items[placement.anchorItemId];
    if (!anchor) {
      throw new OpValidationError(
        "unknown-anchor",
        `anchor item not found: ${placement.anchorItemId}`,
      );
    }
    return { x: anchor.x - PLACEMENT_GAP - width, y: anchor.y };
  }
  return { x: placement.x, y: placement.y };
}
