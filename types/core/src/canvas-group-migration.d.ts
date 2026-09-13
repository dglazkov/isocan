import type { GroupAction, GroupBox, GroupMigrationBoundary, GroupOperation, GroupStamp } from "./canvas-group-types.js";
import type { CanvasState } from "./model.js";
/** Every existing record is shown, including unchanged root items and legacy trash. */
interface MigrationItemRow {
    itemId: string;
    title: string;
    kindBefore: string | null;
    kindAfter: string | null;
    parentBefore: string | null;
    parentAfter: string | null;
    boxBefore: GroupBox;
    boxAfter: GroupBox;
    /** Only legacy trash gets this policy; no historical subtree is invented. */
    restorePolicy?: "frame-only" | "root";
}
/** One authoritative read describes the complete conversion before anyone confirms it. */
export interface CanvasGroupMigrationPreview {
    canvasId: string;
    revision: number;
    migrationVersion: 1;
    status: "ready" | "already-groups";
    fromMode: "legacy" | "groups";
    toMode: "groups";
    boundary: GroupMigrationBoundary | null;
    live: MigrationItemRow[];
    trash: MigrationItemRow[];
    ambiguities: Array<{
        itemId: string;
        candidateIds: string[];
        chosenId: string;
    }>;
    danglingAnnotations: string[];
    repairs: Array<{
        itemId: string;
        location: "live" | "trash";
        boxBefore: GroupBox;
        boxAfter: GroupBox;
        reasons: string[];
    }>;
    history: {
        undoBoundarySeq: number | null;
        explanation: string;
    };
}
/** The writer and both clients inspect the same complete deterministic conversion. */
export declare function canvasGroupMigrationPreview(state: CanvasState, revision: number): CanvasGroupMigrationPreview;
/** Only a fresh authoritative revision can produce the bounded conversion record. */
export declare function resolveCanvasGroupMigration(state: CanvasState, revision: number, action: Extract<GroupAction, {
    kind: "migrate";
}>, stamp: GroupStamp): GroupOperation;
export {};
