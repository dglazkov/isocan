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
 * **Plain-language failures** (Open Stitch Phase 2A, OS1 ADR 0017).
 *
 * One pure function turns any typed or untyped failure — precondition conflict,
 * provider rate limit, auth error, timeout, validation refusal — into the same
 * `{ headline, why, next, actions, retryable }` shape for CLI stderr, job
 * cards, and the context graph so people and agents talk about a failure in
 * the same words. Raw API keys and bearer tokens are always scrubbed.
 */
/** One concrete recovery action offered beside a failure. */
interface FailureAction {
    /** Machine-readable identifier (`retry`, `reread`, `keys`, `switch-model`). */
    id: string;
    /** Short human label for a button or bullet. */
    label: string;
    /** Optional CLI command that performs the recovery action. */
    command?: string;
}
/** Input fields accepted by {@link describeFailure}. */
interface FailureInput {
    /** Semantic failure category (e.g. `precondition-conflict`, `rate-limit`, `auth`, `timeout`). */
    kind?: string | undefined;
    /** Wire or domain error code (e.g. `edit-conflict`, `unknown-item`, `429`). */
    code?: string | undefined;
    /** HTTP status code, when the failure came over HTTP. */
    status?: number | undefined;
    /** Raw error message; always scrubbed of secrets before surfacing. */
    message?: string | undefined;
    /** Optional model identifier for generation/provider errors. */
    model?: string | undefined;
    /** Optional provider name (e.g. `gemini`, `openai`, `anthropic`). */
    provider?: string | undefined;
}
/** Shared plain-language failure object rendered by CLI, jobs, and context graph. */
export interface PlainFailure {
    /** Short title naming what failed (e.g. `Edit conflict`, `Gemini rate limit`). */
    headline: string;
    /** Plain-English explanation of why it failed, free of raw secrets. */
    why: string;
    /** Concrete next step a person or agent should take. */
    next: string;
    /** Actionable recovery options. */
    actions: FailureAction[];
    /** Whether retrying the same or refreshed request is reasonable. */
    retryable: boolean;
}
/** Scrub raw API keys, bearer tokens, and credential query values from text. */
export declare function scrubSecrets(text: string): string;
/**
 * Translate a typed or untyped failure into one plain-language object shared
 * across CLI stderr, job error metadata, and the context graph.
 */
export declare function describeFailure(input: FailureInput): PlainFailure;
/** One-line failure annotation embedded inside the context graph. */
export declare function formatFailureForGraph(failure: PlainFailure): string;
/** Multi-line human-readable rendering for CLI stderr. */
export declare function formatFailureForCli(failure: PlainFailure): string;
export {};
