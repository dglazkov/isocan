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
 * **House Agent contract & structured comment metadata** (Open Stitch Phase 2B,
 * OS1 ADRs 0020, 0177, 0269).
 *
 * Pure, dependency-free vocabulary shared across `@isocan/core`,
 * `@isocan/house-agent`, `@isocan/cli`, and `@isocan/web`:
 * - Canonical `@house` handle, role, and session key.
 * - Deterministic 0 ms first-person future-tense `instantAck` (never `"Thinking…"`).
 * - `HouseCommentMeta` (`thoughtTrace`, `plan`, `goal`, `ack`) with pure
 *   `encodeHouseMeta` / `parseHouseMeta` helpers so any agent (house or BYO)
 *   writing this metadata into a comment gets the same rich UI.
 */
/** Canonical handle claimed by the house agent (or a BYO agent taking its role). */
export declare const HOUSE_HANDLE = "house";
/** Canonical role label for the house agent's station and presence. */
export declare const HOUSE_ROLE = "house";
/** Deterministic session key used by the house agent. */
export declare const HOUSE_SESSION_KEY = "agent:house";
/** Step status inside a structured {@link HousePlanMeta}. */
export type HousePlanStepState = "pending" | "active" | "done" | "failed";
/** One step in an agent's structured plan rendered by `PlanView`. */
interface HousePlanStep {
    id: string;
    label: string;
    state: HousePlanStepState;
}
/** Structured plan attached to a comment via {@link HouseCommentMeta}. */
export interface HousePlanMeta {
    title: string;
    steps: HousePlanStep[];
}
/** Lifecycle status of an agent's goal rendered by `GoalStatus`. */
type HouseGoalState = "drafting" | "running" | "waiting" | "done" | "stalled";
/** Goal status badge metadata attached to a comment via {@link HouseCommentMeta}. */
export interface HouseGoalMeta {
    state: HouseGoalState;
    wave?: number | undefined;
}
/**
 * Structured metadata carried in an agent comment so `ThoughtTrace`, `PlanView`,
 * and `GoalStatus` render identically whether posted by the house agent or a
 * BYO agent.
 */
export interface HouseCommentMeta {
    ack?: string | undefined;
    thoughtTrace?: string[] | undefined;
    plan?: HousePlanMeta | undefined;
    goal?: HouseGoalMeta | undefined;
}
/**
 * Deterministic 0 ms first-person future-tense acknowledgement for a prompt.
 * Always begins with `"I'll "` and never emits `"Thinking…"`.
 */
export declare function instantAck(prompt: string): string;
/**
 * Encode {@link HouseCommentMeta} into a comment body as an HTML metadata
 * block so any agent writing via `thread.reply` or `comment.update` gets the
 * same rich UI without new ops.
 */
export declare function encodeHouseMeta(body: string, meta: HouseCommentMeta): string;
/**
 * Extract {@link HouseCommentMeta} from a comment body, returning the clean
 * prose `body` and the parsed `meta` (or `null` when absent or malformed).
 */
export declare function parseHouseMeta(rawBody: string): {
    body: string;
    meta: HouseCommentMeta | null;
};
export {};
