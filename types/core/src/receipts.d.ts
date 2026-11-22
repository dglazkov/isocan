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
import type { Comment, Item } from "./model.js";
/**
 * **Agent receipts & proposals in comment replies** (Open Stitch Phase 2A,
 * OS1 ADR 0301).
 *
 * An agent reply carries structured metadata describing either a completed,
 * revertable edit (`receipt`) or a machine-applicable patch (`proposal`) on
 * ordinary `thread.reply` / `thread.create` comments — zero new ops.
 */
/** Structured receipt recording a completed item edit in a comment reply. */
export interface CommentReceipt {
    itemId: string;
    fromVersionId?: string | undefined;
    toVersionId: string;
    summary: string;
}
/** Supported machine-applicable patch kinds for a {@link CommentProposal}. */
declare const PROPOSAL_KINDS: readonly ["markdown_replace", "sticky_patch", "property_patch", "agent_instruction"];
/** One of {@link PROPOSAL_KINDS}. */
type CommentProposalKind = (typeof PROPOSAL_KINDS)[number];
/** Structured, machine-applicable proposal attached to a comment reply. */
export interface CommentProposal {
    itemId: string;
    kind: CommentProposalKind;
    patch: string | Record<string, string>;
    summary?: string | undefined;
}
/** Validate and normalize a {@link CommentReceipt} inside the reducer. */
export declare function validateCommentReceipt(raw: unknown): CommentReceipt;
/** Validate and normalize a {@link CommentProposal} inside the reducer. */
export declare function validateCommentProposal(raw: unknown): CommentProposal;
/** Build a {@link CommentReceipt} from an item's current (and previous) version. */
export declare function makeCommentReceipt(item: Pick<Item, "id" | "title" | "currentVersionId" | "versions">, summary?: string, fromVersionId?: string): CommentReceipt;
/** Format a receipt as a compact single line for CLI or thread rendering. */
export declare function formatReceiptLine(receipt: CommentReceipt): string;
/** Format a proposal as a compact single line for CLI or thread rendering. */
export declare function formatProposalLine(proposal: CommentProposal): string;
/** Read a structured receipt from a comment's metadata. */
export declare function readCommentReceipt(comment: Pick<Comment, "receipt">): CommentReceipt | null;
/** Read a structured proposal from a comment's metadata. */
export declare function readCommentProposal(comment: Pick<Comment, "proposal">): CommentProposal | null;
export {};
