import type { CanvasState, Item } from "./model.ts";
import type { GroupAction, GroupBox } from "./canvas-group-types.ts";
import { annotationTarget, annotationsOf } from "./annotation.ts";
import { PLACEMENT_GAP, PLACEMENT_CLEARANCE, nearestFreeSpot, overlaps } from "./placement.ts";
import { formatMoves } from "./format.ts";
import { itemChrome, tidyInPlace, type TidyUnit } from "./tidy.ts";
import { boxOf, enclosing, fail, groupFootprint, groupIn, isGroupItem, itemIn, labelHeight, mapBox, validBox } from "./canvas-group-kit.ts";
import { captureGroupExpectations, groupChildren, groupContentBox, groupFitBox, groupSelectionRoots, groupStackBox, groupTransformClosure, groupUnderStack } from "./canvas-groups.ts";

/*
 * **The arrangement acts on a group canvas: align, distribute, tidy and fit**
 * (moved here from `canvas-groups.ts` on 14 Oct 2026, unchanged).
 *
 * Every surface reaches them through a gesture that loads later — the ⌘K
 * palette, the context menu, `isocan align` / `tidy` / `fit` — so the web
 * app's first paint has no use for them. In `canvas-groups.ts`, which every
 * canvas runs, they were in the entry chunk anyway, and so were `tidy.ts` and
 * `format.ts` behind them: about 12KB of every first visit
 * (`canvas-group-kit.ts` says why a module carries what any chunk uses).
 */

/** Shared arrangement targets footprints; attached marks never receive a competing layout slot. */
export function groupArrangeAction(state: CanvasState, itemIds: readonly string[], options: { kind: "align"; edge: "left" | "right" | "top" | "bottom" | "center" | "middle" | "hcenter" | "vcenter" } | { kind: "distribute"; axis: "h" | "v" } | { kind: "tidy"; perRow?: number; gap?: number; mode?: "smart" | "grid" | "in-place"; containerId?: string; chrome?: (item: Item) => { above: number; below: number }; tolerance?: number }): Extract<GroupAction, { kind: "transform" }> {
  const roots = groupSelectionRoots(state.canvas, itemIds);
  if (!roots.length) fail("select items to arrange");
  if (options.kind === "tidy" && options.mode === "in-place") return groupTidyInPlace(state, roots, options);
  const units = roots.map((id) => ({ item: itemIn(state.canvas, id), box: groupFootprint(itemIn(state.canvas, id), state.canvas) }));
  const bounds = enclosing(units.map((unit) => unit.box));
  const moves = units.map(({ item }) => ({ itemId: item.id, x: item.x, y: item.y }));
  if (options.kind === "align") {
    units.forEach(({ item, box }, i) => {
      const dx = options.edge === "left" ? bounds.x - box.x : options.edge === "right" ? bounds.x + bounds.width - box.x - box.width : options.edge === "center" || options.edge === "hcenter" ? bounds.x + bounds.width / 2 - box.x - box.width / 2 : 0;
      const dy = options.edge === "top" ? bounds.y - box.y : options.edge === "bottom" ? bounds.y + bounds.height - box.y - box.height : options.edge === "middle" || options.edge === "vcenter" ? bounds.y + bounds.height / 2 - box.y - box.height / 2 : 0;
      moves[i] = { itemId: item.id, x: item.x + dx, y: item.y + dy };
    });
  } else if (options.kind === "distribute") {
    const horizontal = options.axis === "h";
    const ordered = [...units].sort((a, b) => (horizontal ? a.box.x - b.box.x : a.box.y - b.box.y) || a.item.id.localeCompare(b.item.id));
    const used = ordered.reduce((sum, unit) => sum + (horizontal ? unit.box.width : unit.box.height), 0);
    const gap = ordered.length > 1 ? ((horizontal ? bounds.width : bounds.height) - used) / (ordered.length - 1) : 0;
    let cursor = horizontal ? bounds.x : bounds.y;
    for (const { item, box } of ordered) { const move = moves.find((row) => row.itemId === item.id)!; if (horizontal) move.x += cursor - box.x; else move.y += cursor - box.y; cursor += (horizontal ? box.width : box.height) + gap; }
  } else {
    const perRow = options.perRow ?? Math.max(1, Math.ceil(Math.sqrt(units.length))); const gap = options.gap ?? PLACEMENT_GAP;
    if (!Number.isInteger(perRow) || perRow < 1 || !Number.isFinite(gap) || gap < PLACEMENT_CLEARANCE) fail("invalid tidy spacing");
    const formatted = formatMoves({ ...state.canvas, items: Object.fromEntries(units.map(({ item, box }) => [item.id, { ...item, ...box, properties: { ...item.properties, annotates: "" } }])) }, { perRow, gap, mode: options.mode ?? "grid" });
    const positions = new Map(formatted.map((move) => [move.itemId, move]));
    const origin = options.containerId ? groupContentBox(groupIn(state.canvas, options.containerId)) : bounds;
    const placed = units.map(({ box, item }) => ({ ...box, ...(positions.get(item.id) ?? {}) }));
    const packed = enclosing(placed);
    units.forEach(({ item, box }, i) => { const at = positions.get(item.id) ?? box; moves[i] = { itemId: item.id, x: item.x + at.x - box.x + origin.x - packed.x, y: item.y + at.y - box.y + origin.y - packed.y }; });
  }
  return { kind: "transform", moves, expected: captureGroupExpectations(state, roots) };
}

/**
 * **Tidy in place on a group canvas** — the same `tidyInPlace` the legacy
 * canvas and `isocan tidy <items...>` use, over placement units. A unit's
 * footprint is its box, the name strip above it and the marks row below
 * (`itemChrome`, at the app's zoom when it passes one), and every attached
 * mark's overhang; the label is ABOVE the item, where the canvas draws it.
 * Items outside the moved closure are obstacles; one already touching a unit
 * is left as it was.
 */
function groupTidyInPlace(state: CanvasState, roots: string[], options: { chrome?: (item: Item) => { above: number; below: number }; tolerance?: number }): Extract<GroupAction, { kind: "transform" }> {
  const chrome = options.chrome ?? ((item: Item) => itemChrome(item));
  const footOf = (item: Item, box: GroupBox): GroupBox => {
    const c = chrome(item);
    return enclosing([{ ...box, y: box.y - c.above, height: box.height + c.above + c.below }, ...annotationsOf(state.canvas, item.id).map(boxOf)]);
  };
  const units: Array<TidyUnit & { item: Item }> = roots.map((id) => { const item = itemIn(state.canvas, id); const box = groupStackBox(item) ?? boxOf(item); return { id, item, box, footprint: footOf(item, box) }; });
  const closure = new Set(groupTransformClosure(state.canvas, roots));
  const obstacles = Object.values(state.canvas.items)
    .filter((item) => !closure.has(item.id) && !groupUnderStack(state.canvas, item.id) && !(annotationTarget(item) && closure.has(annotationTarget(item)!)))
    .map((item) => footOf(item, groupStackBox(item) ?? boxOf(item)));
  const at = tidyInPlace(units, { obstacles, ...(options.tolerance !== undefined ? { tolerance: options.tolerance } : {}) });
  const moves = units.map(({ id, item, box }) => { const to = at.get(id)!; return { itemId: id, x: item.x + to.x - box.x, y: item.y + to.y - box.y }; });
  return { kind: "transform", moves, expected: captureGroupExpectations(state, roots) };
}

/** Content-fit settles only normalized targets against sibling placement units in the same scope. */
export function groupFitAction(state: CanvasState, targets: readonly { itemId: string; width?: number; height?: number }[]): Extract<GroupAction, { kind: "frame" }> {
  const roots = groupSelectionRoots(state.canvas, targets.map((target) => target.itemId));
  const excluded = new Set(groupTransformClosure(state.canvas, roots));
  const settled = new Map<string | null, Array<GroupBox & { id: string }>>();
  const fitted: Array<{ itemId: string; box?: GroupBox }> = [];
  const occupiedAt = (parent: string | null): Array<GroupBox & { id: string }> => {
    let occupied = settled.get(parent);
    if (!occupied) { occupied = groupSelectionRoots(state.canvas, groupChildren(state.canvas, parent).filter((sibling) => !excluded.has(sibling.id)).map((sibling) => sibling.id)).map((siblingId) => ({ id: siblingId, ...groupFootprint(itemIn(state.canvas, siblingId), state.canvas) })); settled.set(parent, occupied); }
    return occupied;
  };
  // What each target already touched before the fit, as `fitMoves` keeps it:
  // an overlap somebody made is not one the fit has to clear up.
  const touchedBefore = (id: string, parent: string | null): Set<string> => {
    const mine = groupFootprint(itemIn(state.canvas, id), state.canvas);
    const siblings = groupSelectionRoots(state.canvas, groupChildren(state.canvas, parent).map((sibling) => sibling.id)).filter((other) => other !== id);
    return new Set(siblings.filter((other) => overlaps(mine, groupFootprint(itemIn(state.canvas, other), state.canvas), PLACEMENT_CLEARANCE)));
  };
  // A group frame fits around fixed children first. Native siblings may move
  // clear of that resulting frame, never through it or its attached marks.
  const ordered = [...roots].sort((a, b) => Number(isGroupItem(itemIn(state.canvas, b))) - Number(isGroupItem(itemIn(state.canvas, a))) || itemIn(state.canvas, a).y - itemIn(state.canvas, b).y || itemIn(state.canvas, a).x - itemIn(state.canvas, b).x);
  for (const id of ordered) {
    const item = itemIn(state.canvas, id); const target = targets.find((row) => row.itemId === id)!;
    const frameFit = isGroupItem(item) && target.width === undefined && target.height === undefined;
    const desired = frameFit ? groupFitBox(state.canvas, id) : { ...boxOf(item), width: target.width ?? item.width, height: target.height ?? item.height }; validBox(desired);
    const occupied = occupiedAt(item.containerId ?? null);
    const footprint = enclosing([{ ...desired, height: desired.height + labelHeight(item) }, ...annotationsOf(state.canvas, id).map((mark) => mapBox(mark, item, desired))]);
    const before = isGroupItem(item) ? null : touchedBefore(id, item.containerId ?? null);
    const at = before === null ? footprint : nearestFreeSpot(footprint, occupied.filter((other) => !before.has(other.id)));
    const box = { ...desired, x: desired.x + at.x - footprint.x, y: desired.y + at.y - footprint.y };
    fitted.push({ itemId: id, ...(frameFit ? {} : { box }) }); occupied.push({ id, ...footprint, x: at.x, y: at.y });
  }
  return { kind: "frame", targets: fitted, expected: captureGroupExpectations(state, roots) };
}

