import type { CanvasContents, Item } from "./model.ts";
import type { GroupAction, GroupCell, GroupPlacementPolicy } from "./canvas-group-types.ts";
import { groupSelectionRoots, groupTransformClosure, resolveGroupOperation } from "./canvas-groups.ts";
import { copyProperties } from "./duplicate.ts";
import { modules } from "./modules.ts";
import { OpValidationError } from "./errors.ts";

/** Clipboard data freezes source records so edits after Copy cannot change Paste. */
interface GroupCopySource { canvasId: string; rootIds: string[]; items: Item[] }

/** Copy follows explicit membership and attached marks, never geometric overlap or lineage. */
export function groupCopySource(canvasId: string, canvas: CanvasContents, rootIds: readonly string[]): GroupCopySource {
  const roots = groupSelectionRoots(canvas, rootIds);
  return { canvasId, rootIds: roots, items: groupTransformClosure(canvas, roots).map((id) => structuredClone(canvas.items[id]!)) };
}

/** Remap every internal relationship before one atomic creation and preserve deliberate overlaps. */
export function groupCopyAction(source: GroupCopySource, destinationCanvasId: string, options: {
  newItemId: () => string; newVersionId: () => string;
  containerId?: string | null; at?: { x: number; y: number }; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy;
  /** A deliberate copy may re-decorate each copied item AFTER remapping — the
   *  pin-from-source act rides this rather than a second write, so one undo
   *  takes back the copy and everything the copy decided about itself. */
  decorate?: (properties: Record<string, string>, source: Item, isRoot: boolean) => Record<string, string>;
}): Extract<GroupAction, { kind: "copy" }> {
  const remap = new Map(source.items.map((item) => [item.id, options.newItemId()]));
  if (new Set(remap.values()).size !== remap.size) throw new OpValidationError("bad-op", "copy needs distinct new item IDs");
  const references = new Set(["parent", "annotates", "noteFor", ...modules().flatMap((module) => module.itemReferenceProperties ?? [])]);
  const families = new Set(modules().flatMap((module) => module.groupIdentityProperties ?? []));
  const familyIds = new Map<string, string>();
  const sameCanvas = source.canvasId === destinationCanvasId;
  const items = source.items.map((item) => {
    const current = item.versions.find((version) => version.id === item.currentVersionId);
    if (!current) throw new OpValidationError("bad-op", `copy cannot read the current version of ${item.id}`);
    const properties = copyProperties(item, { sameCanvas });
    for (const [key, value] of Object.entries(properties)) {
      // copyProperties deliberately records a same-canvas copy's ORIGINAL
      // as its lineage parent; remapping that generated edge would point at itself.
      if (key === "parent" && sameCanvas && value === item.id) continue;
      if (references.has(key) && remap.has(value)) properties[key] = remap.get(value)!;
      else if (families.has(key)) {
        const identity = `${key}:${value}`;
        if (!familyIds.has(identity)) familyIds.set(identity, options.newItemId());
        properties[key] = familyIds.get(identity)!;
      } else if (!sameCanvas && references.has(key)) delete properties[key];
    }
    if (!properties.annotates) delete properties.region;
    const decorated = options.decorate ? options.decorate(properties, item, source.rootIds.includes(item.id)) : properties;
    return {
      id: remap.get(item.id)!, title: item.title, description: item.description, properties: decorated,
      box: { x: item.x, y: item.y, width: item.width, height: item.height },
      ...(item.containerId && remap.has(item.containerId) ? { containerId: remap.get(item.containerId)! } : {}),
      ...(item.groupLayout ? { layout: structuredClone(item.groupLayout) } : {}),
      version: { id: options.newVersionId(), blobHash: current.blobHash, mimeType: current.mimeType, filename: current.filename, size: current.size, ...(current.visual ? { visual: structuredClone(current.visual) } : {}) },
    };
  });
  return { kind: "copy", sourceCanvasId: source.canvasId, rootIds: source.rootIds.map((id) => remap.get(id)!), items,
    ...(options.containerId !== undefined ? { containerId: options.containerId } : {}), ...(options.at ? { at: options.at } : {}), ...(options.cell ? { cell: options.cell } : {}), ...(options.groupPlacement ? { groupPlacement: options.groupPlacement } : {}) };
}

/** Trash disclosure asks the same resolver that will commit restore; no second cohort algorithm. */
export function groupRestorePreview(state: import("./model.ts").CanvasState, itemIds: string[]): { restoredIds: string[]; skippedIds: string[]; parents: Record<string, string | null> } {
  const op = resolveGroupOperation(state, { type: "group.change", action: { kind: "restore", itemIds } }, { actor: { id: "preview", name: "Preview" }, ts: "preview", opId: "preview" });
  if (op.action.kind !== "apply") throw new Error("restore was not resolved");
  const restored = op.action.change.writes.filter((write) => write.kind === "restore");
  return { restoredIds: restored.map((write) => write.itemId), skippedIds: op.action.change.skippedIds ?? [], parents: Object.fromEntries(restored.map((write) => [write.itemId, write.containerId])) };
}
