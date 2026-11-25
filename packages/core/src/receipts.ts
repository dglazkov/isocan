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

import type { Comment, Item } from "./model.ts";
import { OpValidationError } from "./errors.ts";

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
const PROPOSAL_KINDS = [
  "markdown_replace",
  "sticky_patch",
  "property_patch",
  "agent_instruction",
] as const;

/** One of {@link PROPOSAL_KINDS}. */
type CommentProposalKind = (typeof PROPOSAL_KINDS)[number];

const PROPOSAL_KIND_SET: ReadonlySet<string> = new Set(PROPOSAL_KINDS);

/** Structured, machine-applicable proposal attached to a comment reply. */
export interface CommentProposal {
  itemId: string;
  kind: CommentProposalKind;
  patch: string | Record<string, string>;
  summary?: string | undefined;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Validate and normalize a {@link CommentReceipt} inside the reducer. */
export function validateCommentReceipt(raw: unknown): CommentReceipt {
  if (!raw || typeof raw !== "object") {
    throw new OpValidationError("bad-op", "comment receipt must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.itemId !== "string" || !ID_RE.test(obj.itemId)) {
    throw new OpValidationError("bad-op", "comment receipt requires a valid itemId");
  }
  if (typeof obj.toVersionId !== "string" || !ID_RE.test(obj.toVersionId)) {
    throw new OpValidationError("bad-op", "comment receipt requires a valid toVersionId");
  }
  if (obj.fromVersionId !== undefined && (typeof obj.fromVersionId !== "string" || !ID_RE.test(obj.fromVersionId))) {
    throw new OpValidationError("bad-op", "comment receipt fromVersionId must be a valid version id");
  }
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    throw new OpValidationError("bad-op", "comment receipt requires a non-empty summary");
  }
  return {
    itemId: obj.itemId,
    ...(obj.fromVersionId !== undefined ? { fromVersionId: obj.fromVersionId } : {}),
    toVersionId: obj.toVersionId,
    summary: obj.summary.trim().slice(0, 280),
  };
}

/** Validate and normalize a {@link CommentProposal} inside the reducer. */
export function validateCommentProposal(raw: unknown): CommentProposal {
  if (!raw || typeof raw !== "object") {
    throw new OpValidationError("bad-op", "comment proposal must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.itemId !== "string" || !ID_RE.test(obj.itemId)) {
    throw new OpValidationError("bad-op", "comment proposal requires a valid itemId");
  }
  if (typeof obj.kind !== "string" || !PROPOSAL_KIND_SET.has(obj.kind)) {
    throw new OpValidationError("bad-op", `comment proposal kind must be one of: ${PROPOSAL_KINDS.join(", ")}`);
  }
  let patch: string | Record<string, string>;
  if (typeof obj.patch === "string") {
    if (!obj.patch.trim()) throw new OpValidationError("bad-op", "comment proposal patch cannot be empty");
    patch = obj.patch;
  } else if (obj.patch && typeof obj.patch === "object" && !Array.isArray(obj.patch)) {
    const entries = Object.entries(obj.patch as Record<string, unknown>);
    if (entries.length === 0) throw new OpValidationError("bad-op", "comment proposal patch object cannot be empty");
    const clean: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (typeof v !== "string") throw new OpValidationError("bad-op", `comment proposal patch "${k}" must be a string`);
      clean[k] = v;
    }
    patch = clean;
  } else {
    throw new OpValidationError("bad-op", "comment proposal patch must be a non-empty string or string map");
  }
  const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim().slice(0, 280) : undefined;
  return {
    itemId: obj.itemId,
    kind: obj.kind as CommentProposalKind,
    patch,
    ...(summary ? { summary } : {}),
  };
}

/** Build a {@link CommentReceipt} from an item's current (and previous) version. */
export function makeCommentReceipt(
  item: Pick<Item, "id" | "title" | "currentVersionId" | "versions">,
  summary?: string,
  fromVersionId?: string,
): CommentReceipt {
  const idx = item.versions.findIndex((v) => v.id === item.currentVersionId);
  const inferredFrom = fromVersionId ?? (idx > 0 ? item.versions[idx - 1]?.id : undefined);
  const cleanSummary = summary?.trim() || `Updated "${item.title || item.id}" to ${item.currentVersionId}.`;
  return {
    itemId: item.id,
    ...(inferredFrom ? { fromVersionId: inferredFrom } : {}),
    toVersionId: item.currentVersionId,
    summary: cleanSummary,
  };
}

/** Format a receipt as a compact single line for CLI or thread rendering. */
export function formatReceiptLine(receipt: CommentReceipt): string {
  const span = receipt.fromVersionId
    ? `${receipt.fromVersionId} → ${receipt.toVersionId}`
    : receipt.toVersionId;
  return `Receipt: ${receipt.itemId} (${span}) — ${receipt.summary}`;
}

/** Format a proposal as a compact single line for CLI or thread rendering. */
export function formatProposalLine(proposal: CommentProposal): string {
  const detail = proposal.summary ?? (typeof proposal.patch === "string" ? proposal.patch : JSON.stringify(proposal.patch));
  return `Proposal [${proposal.kind}]: ${proposal.itemId} — ${detail}`;
}

/** Read a structured receipt from a comment's metadata. */
export function readCommentReceipt(comment: Pick<Comment, "receipt">): CommentReceipt | null {
  return comment.receipt ?? null;
}

/** Read a structured proposal from a comment's metadata. */
export function readCommentProposal(comment: Pick<Comment, "proposal">): CommentProposal | null {
  return comment.proposal ?? null;
}
