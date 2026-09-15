import type { DesignApprovalBasis, DesignComparison, DesignComparisonResponse, DesignDecisionInput, DesignDecisionOperation } from "./design-decision.js";
/** Comparison parsing validates explicit fidelity and bounded hypotheses, never claims their rendered quality. */
export declare function parseDesignComparison(value: unknown): DesignComparison;
/** Revision/delegation outcomes are closed typed instructions; option adoption cannot be represented by a response. */
export declare function parseDesignComparisonResponse(value: unknown): DesignComparisonResponse;
/** Full target captures are shared by approval and repair without fabricating another semantic record. */
export declare function parseDesignTarget(value: unknown): DesignApprovalBasis["target"];
/** Validates a persisted approval draft without fabricating a complete decision intent. */
export declare function parseDesignApprovalBasis(value: unknown): DesignApprovalBasis;
/** Human words remain nullable; every agent authority branch requires its own explicit rationale. */
export declare function parseDesignDecisionInput(value: unknown): DesignDecisionInput;
/** Public comparison writes cannot carry a canonical comment, retained versions or a forged author. */
export declare function parseDesignCompareOperation(value: unknown): Extract<DesignDecisionOperation, {
    type: "design.compare";
}>;
/** Public response writes retain explicit typed outcome semantics without modifying adoption. */
export declare function parseDesignRespondOperation(value: unknown): Extract<DesignDecisionOperation, {
    type: "design.respond";
}>;
/** The writer, never public input, constructs the fixed adoption pair. */
export declare function parseDesignDecideOperation(value: unknown): Extract<DesignDecisionOperation, {
    type: "design.decide";
}>;
/** Explicit dispatch refuses unknown and internal acts before receipt lookup. */
export declare function parseDesignDecisionOperation(value: unknown): DesignDecisionOperation;
/** Exact accepted intent remains confirmable after joins, cancellation and history compaction. */
export declare function designDecisionIntentHash(op: DesignDecisionOperation, actorId: string): Promise<string>;
