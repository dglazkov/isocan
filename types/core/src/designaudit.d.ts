import type { DesignTokens } from "./designmd.js";
import { type DesignContractPolicy } from "./design-contract.js";
/** Identifies the interpretation of a report so cached findings can be invalidated when rules change. */
export declare const DESIGN_AUDIT_VERSION = "1.1.0";
/** These token categories define the audit boundary; unrelated geometry is not a spacing decision. */
export type DesignValueKind = "colour" | "type size" | "radius" | "spacing";
/** Original-source coordinates let either editor select the same value after HTML entity decoding. */
export interface AuditPosition {
    offset: number;
    line: number;
    column: number;
}
/** UTF-16 offsets, one-based lines/columns, exclusive end; always in the original HTML. */
export interface AuditRange {
    start: AuditPosition;
    end: AuditPosition;
}
/** A replacement needs a semantic choice and sometimes CSS declarations; neither is implicit approval. */
export interface AuditRepair {
    value: string;
    token: string;
    explanation: string;
    prerequisites: string[];
    requiresReview: true;
}
/** Carries one actionable finding across CLI and browser without asking either client to infer a repair. */
export interface AuditDiagnostic {
    code: string;
    severity: "warning" | "info";
    range: AuditRange;
    actual: string;
    explanation: string;
    candidates: AuditRepair[];
    property?: string;
    kind?: DesignValueKind;
}
/** Records a static-analysis boundary so an unread value cannot impersonate a conforming one. */
export interface AuditUnexamined {
    code: string;
    range: AuditRange;
    explanation: string;
}
/** Keeps findings and coverage beside legacy counts; zero departures alone cannot establish a clean screen. */
export interface ScreenAudit {
    ruleVersion: typeof DESIGN_AUDIT_VERSION;
    diagnostics: AuditDiagnostic[];
    policy: DesignContractPolicy;
    coverage: {
        /** Completeness within the declared categories, not visual or general CSS correctness. */
        complete: boolean;
        declarations: number;
        checkedValues: number;
        omittedCategories: DesignValueKind[];
        unexamined: AuditUnexamined[];
    };
    /** Compatibility: distinct normalized off-scale values, grouped with first line and occurrence count.
     * Missing variables and unexamined regions are separate diagnostics, never off-scale literals. */
    offSystem: {
        value: string;
        kind: DesignValueKind;
        count: number;
        line: number;
    }[];
    /** Compatibility: resolved conforming value occurrences, not every syntactic var() call. */
    onSystem: number;
}
/** Parse static styling without executing scripts, fetching URLs or pretending to compute the cascade. */
export declare function auditScreen(source: string, tokens: DesignTokens): ScreenAudit;
/** Sum distinct off-scale values per screen; does not include missing references or unexamined source. */
export declare function offSystemTotal(audits: ScreenAudit[]): number;
