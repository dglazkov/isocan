import { atLeast, type CanvasSnapshotResponse } from "@isocan/core";

/**
 * **What a destination has to be before anything is written to it**, in one
 * browser-safe place, because two acts now need the same answer: ordinary
 * canvas-group editing and the deliberate pin-from-source copy.
 *
 * The legacy sentence matters more than it looks. This product does not
 * silently migrate a canvas — a conversion changes how every existing item is
 * addressed, and doing that as a side effect of "copy a note here" would be a
 * structural rewrite somebody did not ask for. So an old canvas is told what
 * to run, **before** any source is read or any byte is uploaded.
 */
const LEGACY_CANVAS_GUIDANCE = "canvas groups are not enabled on this legacy canvas; preview conversion with `isocan canvas group migrate --dry-run`, then apply it with `isocan canvas group migrate`. Existing areas remain readable with `isocan area ls`.";

/** One sentence for a read-only destination, so every writing act refuses alike. */
const NEEDS_EDIT_GUIDANCE = "editing this canvas requires edit access; groups can still be listed and inspected";

/** Refuse a legacy or read-only destination with the guidance above. */
export function assertGroupDestination(state: CanvasSnapshotResponse, edit: boolean): CanvasSnapshotResponse {
  if (state.project.groupMode !== "groups") throw new Error(LEGACY_CANVAS_GUIDANCE);
  if (edit && state.capability && !atLeast(state.capability, "edit")) throw new Error(NEEDS_EDIT_GUIDANCE);
  return state;
}
