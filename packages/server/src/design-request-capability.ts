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

import { DESIGN_REQUESTS_REQUIRED, supportsDesignRequests, type CanvasContents, type LogEntry, type Operation } from "@isocan/core";

/** Decoder refusal cannot be repaired by credential retries or silently dropping admission metadata. */
export class DesignRequestClientError extends Error {
  readonly code = DESIGN_REQUESTS_REQUIRED;
  constructor() { super("This canvas uses admitted design requests. Update isocan and reload the app before opening it."); this.name = "DesignRequestClientError"; }
}
function marked(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.designRecord !== undefined || v.discovery !== undefined && v.kind === "questions") return true;
  return Object.values(v).some(marked);
}
/** Both canonical acts and ordinary inverses carrying new metadata require the new decoder. */
export function designRequestOperation(op: Operation): boolean { return op.type === "design.request" || op.type === "design.receipt" || marked(op); }
/** Checks current state and actual receipts/inverses, including archived retries. */
export function requireDesignRequestClient(features: unknown, canvas?: CanvasContents, entries: readonly LogEntry[] = []): void {
  if (!supportsDesignRequests(features) && (canvas && marked(canvas) || entries.some((entry) => designRequestOperation(entry.envelope.op) || entry.inverse && designRequestOperation(entry.inverse)))) throw new DesignRequestClientError();
}
