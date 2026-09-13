import type { GroupBox, Operation } from "../../core/src/index.js";
/** Read creation geometry from the writer receipt, including atomic group insertion. */
export declare function insertedItemBox(op: Operation, itemId: string): GroupBox;
