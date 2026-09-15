import type { CanvasContents, Comment, Item } from "./model.js";
import type { Operation } from "./ops.js";
import type { DesignApprovalBasis, DesignComparisonState, DesignScopeBasis } from "./design-decision.js";
import { OpValidationError } from "./errors.js";
/** A paired history conflict must retain its candidate; neither half may be silently skipped. */
export declare class DesignRestoreConflict extends OpValidationError {
    constructor(message: string);
}
/** Key-order-independent equality is shared by canonical replay and exact metadata fences. */
export declare function sameDesignValue(a: unknown, b: unknown): boolean;
/** Both clients and the writer compare current membership rather than an older supplied item copy. */
export declare function currentDesignScope(canvas: CanvasContents, item: Item): DesignScopeBasis;
/** Full approval fencing includes description and scope, beyond the older item.edit metadata guard. */
export declare function designTargetMatches(canvas: CanvasContents, basis: DesignApprovalBasis["target"]): boolean;
/** Generated prose is a view; typed authority is read from the immutable canonical comment metadata. */
export declare function designDecisionMarkdown(record: NonNullable<Comment["designDecision"]>["record"]): string;
/** Canonical comments validate on replay and snapshot admission without rereading pruned live source versions. */
export declare function validateDesignDecisionComment(comment: Comment, canvasId: string): void;
/** Ordinary writes cannot forge new typed comments; only internal canonical restoration may carry them. */
export declare function rejectDesignDecisionMetadata(op: Operation): void;
/** Source identity and exact generated text, not unrelated replies, establish comparison eligibility. */
export declare function designComparisonStates(canvas: CanvasContents): DesignComparisonState[];
/** Exact still-present adoption edges may bridge a captured input; arbitrary later edits never do. */
export declare function designInputTransition(canvas: CanvasContents, briefItemId: string, requestId: string, epoch: number, input: import("./design-partner.js").DesignArtifactRef): boolean;
