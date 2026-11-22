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
import type { CanvasContents } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * **Work-visible contract** (Open Stitch Phase 2A, OS1 ADR 0018).
 *
 * Every user-visible op derives exactly one first-person past-tense summary
 * reused across CLI confirmation, presence, cards, and voice — and paint acks
 * let callers distinguish *applied* (in the oplog) from *rendered* (painted on
 * a connected canvas surface).
 */
/** Optional context used to name items cleanly in {@link summarizeOp}. */
interface OpSummaryContext {
    canvas?: CanvasContents | null | undefined;
    itemTitle?: string | undefined;
}
/** Whether an op has only landed in the daemon log or has been painted by a client. */
type PaintAckStatus = "rendered" | "applied";
/** Result of waiting for a client paint acknowledgement at a target sequence number. */
export interface PaintAckResult {
    seq: number;
    status: PaintAckStatus;
    paintedSeq: number;
    waitedMs: number;
}
/**
 * Generate one first-person past-tense summary sentence for a user-visible
 * canvas operation (OS1 ADR 0018).
 */
export declare function summarizeOp(op: Operation, context?: OpSummaryContext): string;
export {};
