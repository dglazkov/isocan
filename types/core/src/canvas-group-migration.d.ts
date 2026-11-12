/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
