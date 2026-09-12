import type { CanvasContents, Item } from "./model.ts";
import type { ItemGuard, ItemScope, Operation } from "./ops.ts";
import { OpValidationError } from "./errors.ts";

/** Bound reducer work and inverse size per atomic publication. */
export const MAX_ITEM_CHANGES = 1000;
const types = new Set([
  "item.add", "item.edit", "item.update", "item.delete", "item.restore",
  "item.removeVersion", "item.restoreVersion",
]);

/** Content guards deliberately ignore geometry, reactions and discussion. */
export function guardItem(item: Item, location: "live" | "trash" = "live"): ItemGuard {
  return { itemId: item.id, location, versionId: item.currentVersionId,
    title: item.title, properties: { ...item.properties } };
}

/** Match membership using version history so damaged current files still count. */
function itemsInScope(canvas: CanvasContents, scope: ItemScope): string[] {
  return Object.values(canvas.items).filter(item =>
    item.properties[scope.property] === scope.value &&
    (!scope.mimeTypes?.length || item.versions.some(v => scope.mimeTypes!.includes(v.mimeType))),
  ).map(item => item.id).sort();
}

const equalProperties = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => a[key] === b[key]);

/** Validate shape before walking child ops: even untyped callers cannot nest. */
export function validateItemChanges(
  canvas: CanvasContents,
  op: Extract<Operation, { type: "items.change" }>,
): void {
  if (!Array.isArray(op.changes) || !op.changes.length || op.changes.length > MAX_ITEM_CHANGES ||
      op.changes.some(change => !change || !types.has(change.type))) {
    throw new OpValidationError("bad-op", `items.change requires 1–${MAX_ITEM_CHANGES} flat item changes`);
  }
  if (op.guards !== undefined && (!Array.isArray(op.guards) || op.guards.length > MAX_ITEM_CHANGES * 2))
    throw new OpValidationError("bad-op", "Invalid item guards");
  for (const guard of op.guards ?? []) {
    if (!guard || typeof guard.itemId !== "string" || !["live", "trash", "absent"].includes(guard.location) ||
        (guard.location !== "absent" && (!guard.properties || typeof guard.properties !== "object" ||
          typeof guard.title !== "string" || typeof guard.versionId !== "string")))
      throw new OpValidationError("bad-op", "Invalid item guard");
    const live = canvas.items[guard.itemId];
    const trash = canvas.trash.find(entry => entry.item.id === guard.itemId)?.item;
    const item = guard.location === "live" ? live : trash;
    const matches = guard.location === "absent" ? !live && !trash :
      item && item.currentVersionId === guard.versionId && item.title === guard.title &&
        equalProperties(item.properties, guard.properties);
    if (!matches) throw new OpValidationError("edit-conflict", `Item ${guard.itemId} changed since review; review again`);
  }
  if (op.scope) {
    const scope = op.scope;
    if (typeof scope.property !== "string" || typeof scope.value !== "string" ||
        !Array.isArray(scope.itemIds) || scope.itemIds.some(id => typeof id !== "string") ||
        (scope.mimeTypes !== undefined && (!Array.isArray(scope.mimeTypes) || scope.mimeTypes.some(m => typeof m !== "string"))))
      throw new OpValidationError("bad-op", "Invalid item scope");
    if (JSON.stringify(itemsInScope(canvas, scope)) !== JSON.stringify([...scope.itemIds].sort()))
      throw new OpValidationError("edit-conflict", "Graph membership changed since review; review again");
  }
}
