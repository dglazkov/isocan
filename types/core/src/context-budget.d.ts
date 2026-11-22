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
/**
 * **Context budgets and memory packing** (Open Stitch Phase 5, ADR 0035 / 0139 / 0223).
 *
 * Three strict token ceilings keep agent prompts bounded across turns:
 * - `project`: 1,800 tokens (explicit project guidance first, then reflection sections)
 * - `personal`: 1,200 tokens (private observations from the person's "About you" canvas)
 * - `history`: 1,200 tokens (Tier-2 search passages across admitted canvases)
 */
/** Strict token ceilings for project, personal, and history memory tiers. */
export declare const CONTEXT_BUDGETS: {
    readonly project: 1800;
    readonly personal: 1200;
    readonly history: 1200;
};
type MemoryTier = keyof typeof CONTEXT_BUDGETS;
/** Five facets for personal observations on a person's private "About you" canvas. */
export declare const MEMORY_FACETS: readonly ["identity_and_domains", "problem_solving_and_cognition", "quality_and_taste_bar", "workflow_and_modality_patterns", "collaboration_intuition"];
/** Union of the five personal memory facet keys. */
export type MemoryFacet = (typeof MEMORY_FACETS)[number];
/** Fixed section order of a project reflection document (`role: reflection`). */
export declare const REFLECTION_SECTIONS: readonly ["Your project guidance", "Current intent", "Goals", "Themes & meaning", "Canvas state", "Decisions and constraints", "Open threads", "Mode corrections"];
/** Union of canonical reflection document section headings. */
export type ReflectionSection = (typeof REFLECTION_SECTIONS)[number];
/** Parsed structure of a versioned canvas reflection document. */
export interface ReflectionDoc {
    title?: string;
    updatedAt?: string;
    sections: Partial<Record<ReflectionSection, string>>;
    extraSections?: Array<{
        heading: string;
        body: string;
    }>;
}
interface PersonalObservationInput {
    id?: string;
    facet?: MemoryFacet | string;
    text: string;
    confidence?: number;
    proofs?: number;
}
interface HistoryPassageInput {
    id?: string;
    canvasId?: string;
    itemId?: string;
    title?: string;
    text: string;
    score?: number;
}
interface PackMemoryContextInput {
    projectGuidance?: string | readonly string[];
    reflection?: ReflectionDoc | string;
    personalObservations?: readonly PersonalObservationInput[];
    historyPassages?: readonly HistoryPassageInput[];
    budgets?: Partial<Record<MemoryTier, number>>;
}
interface PackedMemoryContext {
    project: string;
    personal: string;
    history: string;
    tokens: {
        project: number;
        personal: number;
        history: number;
        total: number;
    };
    included: {
        guidanceCount: number;
        reflectionSections: string[];
        personalCount: number;
        historyCount: number;
    };
    truncated: {
        project: boolean;
        personal: boolean;
        history: boolean;
    };
}
/** Deterministic token estimate (~4 characters per token). */
export declare function estimateTokens(text: string): number;
/** Render a structured {@link ReflectionDoc} into canonical markdown. */
export declare function renderReflectionDoc(doc: ReflectionDoc): string;
/** Parse canonical reflection markdown back into a {@link ReflectionDoc}. */
export declare function parseReflectionDoc(markdown: string): ReflectionDoc;
/**
 * Pack Tier-1 (project guidance + reflection, personal) and Tier-2 (history)
 * memory context within strict per-tier token budgets.
 *
 * Explicit project guidance is ALWAYS packed first in the project tier before
 * reflection sections.
 */
export declare function packMemoryContext(input: PackMemoryContextInput): PackedMemoryContext;
export {};
