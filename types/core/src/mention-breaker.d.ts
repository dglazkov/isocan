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
import type { Comment } from "./model.js";
/**
 * **4-hop `@mention` circuit breaker** (Open Stitch Phase 2A, OS1 ADR 0274).
 *
 * Prevents infinite `@a → @b → @a` agent-to-agent ping-pong loops in a thread:
 * after 4 consecutive agent-authored messages without an intervening human
 * message, further agent wakes on that thread are blocked until a person speaks.
 */
/** Default maximum consecutive agent-to-agent mention hops before breaking. */
export declare const MAX_AGENT_MENTION_HOPS = 4;
/** Result of evaluating the mention circuit breaker on a thread's comment history. */
interface MentionHopEvaluation {
    /** Whether waking another agent on the latest message is permitted. */
    allowed: boolean;
    /** Number of consecutive agent messages at the tail of the thread since the last human message. */
    consecutiveAgentHops: number;
    /** Configured hop limit (default {@link MAX_AGENT_MENTION_HOPS}). */
    limit: number;
    /** Human-readable explanation when `allowed === false`. */
    reason?: string;
}
/**
 * Count consecutive agent-authored comments at the tail of `comments` (ignoring
 * system and record comments) back to the most recent human comment, and trip
 * once the streak reaches `limit`.
 */
export declare function evaluateMentionBreaker(comments: readonly Pick<Comment, "author" | "mentions" | "record">[], isAgent: (actorId: string) => boolean, limit?: number): MentionHopEvaluation;
export {};
