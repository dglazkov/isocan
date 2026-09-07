import type { CanvasState } from "./model.js";
/**
 * Every blob hash named by a canvas's properties, or by an item's.
 *
 * Takes the whole `CanvasState` rather than `CanvasContents`, and that is the
 * point: a canvas's own properties live on the RECORD (`state.project`), not
 * on its contents, which is where a background tile would sit. A signature
 * that took only the contents could not see the thing this file exists for.
 */
export declare function blobsInProperties(state: CanvasState): Set<string>;
