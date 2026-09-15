import type { ItemVersion, CanvasState } from "./model.js";
import type { DesignArtifactRef } from "./design-partner.js";
import type { Operation, OpEnvelope } from "./ops.js";
/** Retained versions cannot contain another admission marker or recursively embed earlier request metadata. */
type DesignRetainedVersion = Omit<ItemVersion, "designRecord">;
/** Exact permitted local bytes remain roots independently of the original item's version stack. */
export interface DesignRetainedReference {
    artifact: DesignArtifactRef;
    version: DesignRetainedVersion;
}
/** Admission indexes existing JSON and flat blob roots; it never duplicates the full brief or receipt. */
export interface DesignRecordMarker {
    schemaVersion: 1;
    kind: "brief" | "receipt";
    requestId: string;
    epoch: number;
    opId: string;
    intentHash: string;
    retainedReferences: DesignRetainedReference[];
}
/** Closed materialized effects preserve existing placement/group and undo semantics, without a generic batch. */
export type DesignRecordEffect = Extract<Operation, {
    type: "item.add" | "item.edit";
}> | {
    type: "group.change";
    action: {
        kind: "apply";
        change: import("./canvas-group-types.js").GroupChange;
    };
};
/** Removing the admission marker from a retained copy prevents nested copies from claiming live authority. */
export declare function retainedDesignVersion(version: ItemVersion): DesignRetainedVersion;
/** Canonical replay validates marker shape without rereading now-pruned source items. */
export declare function validateDesignRecordVersion(version: ItemVersion, canvasId: string): void;
/** Snapshot admission also validates versions in trash and canonical group effects. */
export declare function validateDesignRecordState(state: CanvasState): void;
/** Replay admits only the one declared record; group repair may adjust geometry but cannot hide other content acts. */
export declare function validateDesignRecordEffect(state: CanvasState, envelope: OpEnvelope): void;
export {};
