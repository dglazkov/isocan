import type { CanvasContents, Item } from "./model.js";
import { type DesignScopeOptions } from "./designsystem.js";
import { type LinkedCanvas } from "./memory.js";
/** Actual screen membership determines coverage; a new lane never inherits another lane's missing-system count. */
export declare function designScopeStanding(canvas: CanvasContents, screenItems: readonly Item[], project?: {
    properties?: Record<string, string>;
}, opts?: DesignScopeOptions & {
    linked?: LinkedCanvas[];
}): {
    standing: "fine" | "owed" | "overdue";
    screenCount: number;
    uncoveredIds: string[];
    scopeId: string | null;
    selection: import("./memory.js").GoverningDesignSelection;
};
