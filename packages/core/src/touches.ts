/**
 * Which items an operation touches, and whether an op type matches a filter.
 *
 * An agent parked on a canvas should be able to say what it cares about —
 * "this item", "new versions" — instead of waking on every drag anyone makes
 * and spending a turn deciding it does not care. A turn is the scarce thing.
 *
 * It lives in core because both clients ask the same question: the CLI's
 * `wait --item/--op` filters here, and the web app has the same question to
 * answer whenever it highlights what just changed.
 */

import type { CanvasContents, Item } from "./model.ts";
import type { Operation, OperationType } from "./ops.ts";

/**
 * Every item id this op is about. Comment ops count: a comment ON an item is
 * something happening to that item, which is exactly what a watcher means.
 * Thread ops need the canvas to resolve a thread back to what it is pinned to;
 * without one they contribute nothing rather than guessing.
 */
export function itemsTouchedBy(op: Operation, canvas?: CanvasContents | null): string[] {
  const anchorOf = (threadId: string): string[] => {
    const anchor = canvas?.threads[threadId]?.anchorItemId;
    return anchor ? [anchor] : [];
  };

  switch (op.type) {
    case "item.add":
    case "item.move":
    case "item.resize":
    case "item.update":
    case "item.addVersion":
    case "item.setCurrentVersion":
    case "item.removeVersion":
    case "item.restoreVersion":
    case "item.delete":
    case "item.restore":
      return [op.itemId];
    case "items.move":
      return op.moves.map((move) => move.itemId);
    case "items.delete":
    case "items.restore":
      return [...op.itemIds];
    case "thread.create":
    case "thread.setAnchor":
      return op.anchorItemId ? [op.anchorItemId] : [];
    case "thread.reply":
    case "thread.delete":
    case "comment.remove":
    case "comment.restore":
      return anchorOf(op.threadId);
    case "thread.restore":
      return op.thread.anchorItemId ? [op.thread.anchorItemId] : [];
    default:
      // Home-scoped and canvas-wide ops (actor.*, project.*, trash.empty,
      // thread.setMain) are about no item in particular.
      return [];
  }
}

/**
 * Does this op type match one of the wanted patterns? A pattern is a type
 * (`item.addVersion`) or a family (`item.*`) — the two ways a person actually
 * thinks about it. An empty list means "no filter", not "nothing".
 */
export function opTypeMatches(type: OperationType, wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true;
  return wanted.some((pattern) => {
    if (pattern === type) return true;
    if (pattern.endsWith(".*")) return type.startsWith(pattern.slice(0, -1));
    if (pattern.endsWith("*")) return type.startsWith(pattern.slice(0, -1));
    return false;
  });
}

/**
 * **Does this op happen inside one of these areas?** (`wait --in`, 11 Sep
 * 2026 — asked for by the sprint journey's Scene 4, and by a design
 * competition's fighter parked on its own lane.) Geometry, like area
 * membership everywhere: an item it touches whose centre is in the area, or a
 * thread pinned to such an item, or a freestanding thread pinned inside it.
 *
 * Judged on the canvas as it is AFTER the op, which is the only canvas a
 * waiter holds: a move out of the area reads by where the item went, and an
 * item already gone is in no area. Both are the honest reading of "in".
 */
export function opTouchesAreas(op: Operation, areaIds: readonly string[], canvas?: CanvasContents | null): boolean {
  if (!canvas || areaIds.length === 0) return false;
  const areas = areaIds.map((id) => canvas.items[id]).filter((a): a is Item => a !== undefined);
  if (areas.length === 0) return false;
  const inside = (x: number, y: number) =>
    areas.some((a) => x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height);
  for (const id of itemsTouchedBy(op, canvas)) {
    const item = canvas.items[id];
    if (item && !areaIds.includes(item.id) && inside(item.x + item.width / 2, item.y + item.height / 2)) return true;
  }
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas.threads[op.threadId];
    if (thread && thread.anchorItemId === null && inside(thread.x, thread.y)) return true;
  }
  return false;
}

/** Does this op pass both filters? Items and types narrow independently: an op
 * has to touch one of the items AND be one of the types, when each is given. */
export function opMatchesFilters(
  op: Operation,
  filters: { items?: readonly string[]; types?: readonly string[] },
  canvas?: CanvasContents | null,
): boolean {
  if (!opTypeMatches(op.type, filters.types ?? [])) return false;
  const items = filters.items ?? [];
  if (items.length === 0) return true;
  const touched = itemsTouchedBy(op, canvas);
  return touched.some((id) => items.includes(id));
}
