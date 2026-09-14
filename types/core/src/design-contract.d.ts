import type { AuditRange } from "./designaudit.js";
import type { DesignTokens } from "./designmd.js";
/** A supported recipe separates fixed visual declarations from documented caller controls. */
export interface DesignRecipeContract {
    owns: Record<string, string>;
    allow: string[];
    treatments: Record<string, Record<string, string>>;
}
/** Exceptions require a named recipe, explicit owned properties and a visible reason. */
export interface DesignContractException {
    recipe: string;
    properties: string[];
    reason: string;
}
/** The normalized version-one contract retains authored token references for both clients to display. */
export interface EffectiveDesignContract {
    version: 1;
    literals: "allow" | "require-references";
    recipes: Record<string, DesignRecipeContract>;
    exceptions: Record<string, DesignContractException>;
}
/** Invalid or unsupported policy data stays attributable to its path in the governing document. */
export interface DesignPolicyProblem {
    code: string;
    path: string;
    message: string;
}
/** Policy evidence travels with the actual HTML report, while governing document identity stays in its envelope. */
export interface DesignContractPolicy {
    status: "default" | "supported" | "partial" | "unsupported";
    original: unknown | null;
    effective: EffectiveDesignContract | null;
    problems: DesignPolicyProblem[];
    boundary: string;
    appliedTreatments: {
        recipe: string;
        name: string;
        range: AuditRange;
    }[];
    appliedExceptions: {
        recipe: string;
        name: string;
        properties: string[];
        reason: string;
        range: AuditRange;
    }[];
}
/** Resolve scalar DESIGN.md references recursively; cycles and structured tokens cannot become CSS rules. */
export declare function resolveContractValue(tokens: DesignTokens, value: string, seen?: string[]): string | null;
/** Expand supported physical shorthands so longhand overrides cannot evade an owned family. */
export declare function contractLonghands(property: string): string[];
/** Validate the declarative boundary without importing HTML/CSS parsers into normal document operations. */
export declare function compileDesignContract(tokens: DesignTokens): DesignContractPolicy;
