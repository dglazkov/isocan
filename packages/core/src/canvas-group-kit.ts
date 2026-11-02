import type { CanvasContents, Item } from "./model.ts";
import type { GroupBox } from "./canvas-group-types.ts";
import { annotationTarget, annotationsOf } from "./annotation.ts";
import { OpValidationError } from "./errors.ts";

/*
 * **The small pieces `canvas-groups.ts` and `canvas-group-arrange.ts` share**
 * (14 Oct 2026), in a file of their own so both can read them and the barrel
 * does not: these were private to `canvas-groups.ts`, and they are not API.
 *
 * Why two files at all: every canvas runs the group writer, so
 * `canvas-groups.ts` is in the web app's first paint, and a module in the
 * entry chunk carries every export ANY chunk uses. The arrangement acts
 * (align, distribute, tidy, fit) are only reached from the ⌘K and context
 * menus, which load later, but while they lived in `canvas-groups.ts` they
 * and everything they import — `tidy.ts` and `format.ts` — were in every
 * first visit. The `arrow.ts` / `context-source.ts` lesson
 * (`scripts/bundle-ceiling.mjs`): the eager half of a feature has to be a
 * separate file from the lazy half.
 */

/** The `kind` property that makes an item a canvas group. */
export const GROUP_KIND = "group";
const GROUP_LABEL_HEIGHT = 24;
/** Six decimal places: what the group writer persists, so replays agree. */
export const round = (n: number): number => Math.round(n * 1e6) / 1e6;
/** Every refusal the group writer raises reads "canvas group: …". */
export function fail(message: string): never { throw new OpValidationError("bad-op", `canvas group: ${message}`); }
/** A plain object — not null, not an array. */
export const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
/** The box of anything with one, without its other fields. */
export function boxOf(item: GroupBox): GroupBox { return { x: item.x, y: item.y, width: item.width, height: item.height }; }
/** Finite coordinates and positive dimensions, or a refusal. */
export function validBox(box: unknown): asserts box is GroupBox {
  if (!record(box) || ["x", "y", "width", "height"].some((key) => typeof box[key] !== "number" || !Number.isFinite(box[key])) || Number(box.width) <= 0 || Number(box.height) <= 0) fail("a box needs finite coordinates and positive dimensions");
}
/** A live item by id, or the `unknown-item` refusal. */
export function itemIn(canvas: CanvasContents, id: string): Item {
  const item = canvas.items[id];
  if (!item) throw new OpValidationError("unknown-item", `unknown item: ${id}`);
  return item;
}
/** A live canvas group by id, or a refusal saying it is not one. */
export function groupIn(canvas: CanvasContents, id: string): Item {
  const item = itemIn(canvas, id);
  if (!isGroupItem(item)) fail(`${id} is not a canvas group`);
  return item;
}
/** Kind is explicit: visual overlap never turns an ordinary card into a container. */
export function isGroupItem(item: Item): boolean { return item.properties.kind === GROUP_KIND; }
/** The name strip a native item reserves under its box; groups, marks, text and ink have none. */
export function labelHeight(item: Item): number {
  return isGroupItem(item) || annotationTarget(item) || ["text", "drawing"].includes(item.properties.kind ?? "") ? 0 : GROUP_LABEL_HEIGHT;
}
/** A placement unit reserves native labels and every attached mark's overhang. */
export function groupFootprint(item: Item, canvas?: CanvasContents): GroupBox {
  const ownBox = { ...boxOf(item), height: item.height + labelHeight(item) };
  const marks = canvas ? annotationsOf(canvas, item.id).map(boxOf) : [];
  return enclosing([ownBox, ...marks]);
}
/** A box carried from one frame to another, scaled with it. */
export function mapBox(box: GroupBox, before: GroupBox, after: GroupBox): GroupBox {
  validBox(before); validBox(after);
  const sx = after.width / before.width; const sy = after.height / before.height;
  return { x: round(after.x + (box.x - before.x) * sx), y: round(after.y + (box.y - before.y) * sy), width: round(box.width * sx), height: round(box.height * sy) };
}
/** The smallest box holding all of these. */
export function enclosing(boxes: GroupBox[]): GroupBox {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y };
}
