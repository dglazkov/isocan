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

import { validatePreparedDesignReviewWrite, type PreparedDesignReviewWrite, type DesignReviewSubmission } from "@isocan/api/design-review";

/** An addressed request has its own durable delivery state; it cannot masquerade as performed inspection. */
export interface DesignReviewHandoffDraft {
  schemaVersion: 1; canvasId: string; actorId: string; requestId: string;
  prepared: PreparedDesignReviewWrite;
  state: "pending" | "refused" | "accepted";
  result: DesignReviewSubmission | null;
}

/** Recovery remains reachable by the original owner even when its run or offer later disappears. */
export function designReviewHandoffKey(canvasId: string, actorId: string, requestId: string): string {
  return `isocan.design.review-handoff.v1:${JSON.stringify([canvasId, actorId, requestId])}`;
}

/** Validate the actual saved operation before a recovered request may be retried. */
export async function readDesignReviewHandoffDraft(raw: string, canvasId: string, actorId: string, requestId: string): Promise<DesignReviewHandoffDraft> {
  const value = JSON.parse(raw) as DesignReviewHandoffDraft;
  if (!value || value.schemaVersion !== 1 || value.canvasId !== canvasId || value.actorId !== actorId || value.requestId !== requestId || !["pending", "refused", "accepted"].includes(value.state)) throw new Error("This saved review request is malformed or belongs to another owner.");
  const prepared = await validatePreparedDesignReviewWrite(value.prepared);
  if (prepared.canvasId !== canvasId || prepared.actorId !== actorId || (prepared.operation.type !== "thread.reply" && prepared.operation.type !== "thread.create")) throw new Error("The saved review request has a different operation or owner.");
  const result = value.result;
  if (result !== null && (!result || result.submittedOpId !== prepared.opId || result.status !== value.state || (result.reason !== undefined && typeof result.reason !== "string") || result.opId !== null && typeof result.opId !== "string")) throw new Error("The saved handoff result is malformed.");
  if (value.state !== "pending" && result === null) throw new Error("A settled review request is missing its acknowledgement.");
  if (result?.consistency && (!["current", "stale", "unavailable"].includes(result.consistency.status) || !Array.isArray(result.consistency.reasons) || !result.consistency.reasons.every(one => typeof one === "string"))) throw new Error("The saved handoff consistency is malformed.");
  return { schemaVersion: 1, canvasId, actorId, requestId, prepared, state: value.state, result };
}

/** Every send, including retry, requires the same immutable journal to be durable first. */
export function keepDesignReviewHandoff(storage: Pick<Storage, "setItem">, key: string, value: DesignReviewHandoffDraft): void {
  storage.setItem(key, JSON.stringify(value));
}
