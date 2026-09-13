import type { Actor, CanvasContents, CanvasState, Item } from "./model.js";
import type { GroupAction, GroupAnchor, GroupBox, GroupCell, GroupChange, GroupExpectation, GroupOperation, GroupPlacementPolicy, GroupStamp } from "./canvas-group-types.js";
import type { Operation } from "./ops.js";
/** Empty frames have one shared initial size on the CLI and browser shelf. */
export declare const GROUP_DEFAULT_SIZE: {
    width: number;
    height: number;
};
/** Kind is explicit: visual overlap never turns an ordinary card into a container. */
export declare function isGroupItem(item: Item): boolean;
/** Direct membership, with null addressing the canvas root instead of an enclosing frame. */
export declare function groupChildren(canvas: CanvasContents, groupId: string | null): Item[];
/** Breadcrumb order starts at the immediate parent and ends at the canvas root. */
export declare function groupAncestors(canvas: CanvasContents, itemId: string): Item[];
/** Root-scope clicks reach the outermost group; inside a group they reach direct children. */
export declare function groupScopedRoot(canvas: CanvasContents, itemId: string, activeGroupId: string | null): string | null;
/** The same direct-child boundary drives marquee selection and the group navigator. */
export declare function groupScopeRoots(canvas: CanvasContents, activeGroupId: string | null): Item[];
/** Wrapping normalizes selected roots; the writer assigns their lowest common parent. */
export declare function groupWrapAction(canvas: CanvasContents, creation: import("./canvas-group-types.js").GroupCreation, itemIds: readonly string[]): Extract<GroupAction, {
    kind: "create";
}>;
/** Each selected root leaves one level, even when roots start under different parents. */
export declare function groupRemoveAction(canvas: CanvasContents, itemIds: readonly string[], toRoot?: boolean): Extract<GroupAction, {
    kind: "remove";
}>;
/** Deterministic subtree order gives clients the same recursive selection and context. */
export declare function groupDescendants(canvas: CanvasContents, groupId: string): Item[];
/** Membership roots and target-owned marks form placement units. */
export declare function groupSelectionRoots(canvas: CanvasContents, ids: readonly string[]): string[];
/** Include descendants and target-owned ink once, even when both are explicitly selected. */
export declare function groupTransformClosure(canvas: CanvasContents, ids: readonly string[]): string[];
/** Pure model validation, including generic writes and replica snapshot adoption. */
export declare function validateGroupForest(state: CanvasState): void;
/** Layout and resize share saved header/inset reservations, independent of browser fonts. */
export declare function groupContentBox(item: Item): GroupBox;
/** Historical dense grids stay readable; both surfaces can disclose that full spacing needs a larger frame. */
export declare function groupGridNeedsRoom(item: Item): boolean;
/** A cell's usable box excludes saved row/column gutters and inter-cell clearance. */
export declare function groupCellBox(group: Item, row: number, column: number): GroupBox;
/** Deterministic insertion considers complete placement units and never spills out of a named cell. */
export declare function groupPlacement(canvas: CanvasContents, groupId: string, footprint: {
    width: number;
    height: number;
}, options?: {
    at?: {
        x: number;
        y: number;
    };
    cell?: GroupCell;
    policy?: GroupPlacementPolicy;
    ignoreIds?: readonly string[];
}): {
    x: number;
    y: number;
};
/** Deepest eligible frame wins; a header hit is offered clear content placement, never membership by overlap. */
export declare function groupDropTarget(canvas: CanvasContents, point: {
    x: number;
    y: number;
}, movingIds: readonly string[]): Item | null;
/** Header drops request a clear content slot; a content drop preserves the deliberate world position. */
export declare function groupDropPolicy(group: Item, point: {
    x: number;
    y: number;
}): "auto" | "preserve";
/** Shared arrangement targets footprints; attached marks never receive a competing layout slot. */
export declare function groupArrangeAction(state: CanvasState, itemIds: readonly string[], options: {
    kind: "align";
    edge: "left" | "right" | "top" | "bottom" | "center" | "middle" | "hcenter" | "vcenter";
} | {
    kind: "distribute";
    axis: "h" | "v";
} | {
    kind: "tidy";
    perRow?: number;
    gap?: number;
    mode?: "smart" | "grid";
    containerId?: string;
}): Extract<GroupAction, {
    kind: "transform";
}>;
/** Content-fit settles only normalized targets against sibling placement units in the same scope. */
export declare function groupFitAction(state: CanvasState, targets: readonly {
    itemId: string;
    width?: number;
    height?: number;
}[]): Extract<GroupAction, {
    kind: "frame";
}>;
/** Preview the same resolved whole act, including ancestor frame repair and any drop transfer. */
export declare function groupPreviewBoxes(state: CanvasState, action: Exclude<GroupAction, {
    kind: "apply";
}>): Map<string, GroupBox>;
/** Fit includes labels and attached-ink overhang; growth preserves room already reserved. */
export declare function groupFitBox(canvas: CanvasContents, groupId: string, growOnly?: boolean): GroupBox;
/** Corner denotes the FIXED corner, shared by CLI, pointer handles and tests. */
export declare function groupResizeBox(item: GroupBox, size: {
    width: number;
    height: number;
}, anchor?: GroupAnchor): GroupBox;
/** Aspect-preserving handles clamp one scale against the same recursive minima as the writer. */
export declare function groupResizeMinimum(canvas: CanvasContents, itemId: string): {
    width: number;
    height: number;
};
/** Immutable geometry only. Final constraints and arithmetic are preview arithmetic. */
export declare function groupTransform(canvas: CanvasContents, action: Extract<GroupAction, {
    kind: "transform";
}>): Map<string, GroupBox>;
/** Capture structural dependencies before sending intent, so stale retries cannot move twice. */
export declare function captureGroupExpectations(state: CanvasState, itemIds: readonly string[]): GroupExpectation[];
/** Validates all writes before publishing a new state. No dynamic placement on replay. */
export declare function applyGroupChange(state: CanvasState, change: GroupChange, actor: Actor, ts: string): CanvasState;
/** Captured field inverses preserve unrelated content/metadata and trash authorship. */
export declare function invertGroupChange(state: CanvasState, change: GroupChange): GroupChange;
/** Authoritative intent resolution. Requests never contain replacement canvas snapshots. */
export declare function resolveGroupOperation(state: CanvasState, op: GroupOperation, stamp: GroupStamp): GroupOperation;
/** History and presence use actual writes, including fitted ancestors and attached marks. */
export declare function groupChangeItemIds(op: GroupOperation): string[];
/** New raw requests share group semantics; historical logged operations do not. */
export declare function resolveCanvasGroupRequest(state: CanvasState, op: Operation, stamp: GroupStamp): Operation;
