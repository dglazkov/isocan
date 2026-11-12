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
