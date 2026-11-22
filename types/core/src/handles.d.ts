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
 * **Honest presence action verbs, deterministic `@handles`, and OKLCH colour
 * assignment** (Open Stitch Phase 2A, OS1 ADRs 0272 & 0273).
 *
 * Every agent gets a memorable, collision-free `@handle` from a deterministic
 * pool and an 8-colour OKLCH accent derived via FNV-1a. Presence pills report
 * an explicit verb (`@ada · writing`) instead of invented cursor wandering.
 */
/** Explicit, honest action verbs an agent session can declare on its cursor. */
export declare const AGENT_ACTION_VERBS: readonly ["thinking", "reading", "writing", "generating", "coding", "verifying", "coordinating", "idle", "done"];
/** One of {@link AGENT_ACTION_VERBS}. */
export type AgentActionVerb = (typeof AGENT_ACTION_VERBS)[number];
/** Narrow an unknown string to an {@link AgentActionVerb}. */
export declare function isAgentActionVerb(value: unknown): value is AgentActionVerb;
/** Deterministic pool of 16 readable agent handles (OS1 ADR 0272). */
export declare const HANDLE_POOL: readonly ["ada", "newton", "maya", "euler", "hopper", "noether", "turing", "curie", "lovelace", "tesla", "galileo", "darwin", "faraday", "gauss", "meitner", "ramanujan"];
/** 8-colour perceptually balanced OKLCH palette for collaborator cursors and halos. */
export declare const HANDLE_PALETTE_OKLCH: readonly ["oklch(0.62 0.19 255)", "oklch(0.62 0.19 155)", "oklch(0.64 0.19 40)", "oklch(0.60 0.20 305)", "oklch(0.63 0.17 195)", "oklch(0.66 0.18 75)", "oklch(0.61 0.20 350)", "oklch(0.60 0.17 125)"];
/**
 * Normalize a raw handle string into a lowercase, URL-safe handle of at most
 * 24 characters. Strips a leading `@`, collapses non-alphanumeric runs to `-`,
 * and rejects reserved handles such as `@all` by returning `null`.
 */
export declare function normalizeHandle(raw: string): string | null;
/**
 * Assign a deterministic handle from {@link HANDLE_POOL} for `actorId`,
 * avoiding any handle already present in `taken`. Falls back to `<base>-2`,
 * `<base>-3`, … once all 16 pool slots are occupied.
 */
export declare function handleForActor(actorId: string, taken?: ReadonlySet<string> | readonly string[]): string;
/** Pick one of the 8 OKLCH collaborator accents deterministically via FNV-1a. */
export declare function colorForHandle(handleOrActorId: string): string;
/** Render the counter-scaled cursor pill text: `@handle · verb`. */
export declare function formatAgentPill(handle: string, action: AgentActionVerb): string;
