import type { GroupAction, GroupOperation } from "./canvas-group-types.ts";

/**
 * Insert a prepared forest through the native bounded creation resolver.
 * Records have fresh IDs and explicit parents; this does not claim an existing
 * source artifact. The current canvas ID governs external annotation handling.
 * The writer stamps all records and logs one create change, with one inverse.
 */
export function preparedGroupCreation(canvasId: string, items: Extract<GroupAction, { kind: "copy" }>["items"], at: { x: number; y: number }): GroupOperation {
  const ids = new Set(items.map((item) => item.id));
  return { type: "group.change", action: {
    kind: "copy", sourceCanvasId: canvasId, items,
    rootIds: items.filter((item) => !item.containerId || !ids.has(item.containerId)).map((item) => item.id),
    at, groupPlacement: "preserve",
  } };
}
