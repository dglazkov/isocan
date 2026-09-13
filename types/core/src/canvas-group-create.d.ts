import type { GroupAction, GroupOperation } from "./canvas-group-types.js";
/**
 * Insert a prepared forest through the native bounded creation resolver.
 * Records have fresh IDs and explicit parents; this does not claim an existing
 * source artifact. The current canvas ID governs external annotation handling.
 * The writer stamps all records and logs one create change, with one inverse.
 */
export declare function preparedGroupCreation(canvasId: string, items: Extract<GroupAction, {
    kind: "copy";
}>["items"], at: {
    x: number;
    y: number;
}): GroupOperation;
