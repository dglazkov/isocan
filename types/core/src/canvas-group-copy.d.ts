import type { CanvasContents, Item } from "./model.js";
import type { GroupAction, GroupCell, GroupPlacementPolicy } from "./canvas-group-types.js";
/** Clipboard data freezes source records so edits after Copy cannot change Paste. */
interface GroupCopySource {
    canvasId: string;
    rootIds: string[];
    items: Item[];
}
/** Copy follows explicit membership and attached marks, never geometric overlap or lineage. */
export declare function groupCopySource(canvasId: string, canvas: CanvasContents, rootIds: readonly string[]): GroupCopySource;
/** Remap every internal relationship before one atomic creation and preserve deliberate overlaps. */
export declare function groupCopyAction(source: GroupCopySource, destinationCanvasId: string, options: {
    newItemId: () => string;
    newVersionId: () => string;
    containerId?: string | null;
    at?: {
        x: number;
        y: number;
    };
    cell?: GroupCell;
    groupPlacement?: GroupPlacementPolicy;
}): Extract<GroupAction, {
    kind: "copy";
}>;
/** Trash disclosure asks the same resolver that will commit restore; no second cohort algorithm. */
export declare function groupRestorePreview(state: import("./model.js").CanvasState, itemIds: string[]): {
    restoredIds: string[];
    skippedIds: string[];
    parents: Record<string, string | null>;
};
export {};
