import type { CanvasContents, Item } from "./model.js";
import type { GroupBox } from "./canvas-group-types.js";
/** The `kind` property that makes an item a canvas group. */
export declare const GROUP_KIND = "group";
/** Six decimal places: what the group writer persists, so replays agree. */
export declare const round: (n: number) => number;
/** Every refusal the group writer raises reads "canvas group: …". */
export declare function fail(message: string): never;
/** A plain object — not null, not an array. */
export declare const record: (value: unknown) => value is Record<string, unknown>;
/** The box of anything with one, without its other fields. */
export declare function boxOf(item: GroupBox): GroupBox;
/** Finite coordinates and positive dimensions, or a refusal. */
export declare function validBox(box: unknown): asserts box is GroupBox;
/** A live item by id, or the `unknown-item` refusal. */
export declare function itemIn(canvas: CanvasContents, id: string): Item;
/** A live canvas group by id, or a refusal saying it is not one. */
export declare function groupIn(canvas: CanvasContents, id: string): Item;
/** Kind is explicit: visual overlap never turns an ordinary card into a container. */
export declare function isGroupItem(item: Item): boolean;
/** The name strip a native item reserves under its box; groups, marks, text and ink have none. */
export declare function labelHeight(item: Item): number;
/** A placement unit reserves native labels and every attached mark's overhang. */
export declare function groupFootprint(item: Item, canvas?: CanvasContents): GroupBox;
/** A box carried from one frame to another, scaled with it. */
export declare function mapBox(box: GroupBox, before: GroupBox, after: GroupBox): GroupBox;
/** The smallest box holding all of these. */
export declare function enclosing(boxes: GroupBox[]): GroupBox;
