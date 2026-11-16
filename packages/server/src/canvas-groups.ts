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

import {
  CANVAS_GROUPS_REQUIRED,
  supportsCanvasGroups,
  type Canvas,
  type LogEntry,
  type Operation,
} from "@isocan/core";

/** A protocol refusal must stop reads and queued writes before group state
 * reaches a reducer which does not understand it. It is not an ACL failure. */
export class CanvasGroupsClientError extends Error {
  readonly code = CANVAS_GROUPS_REQUIRED;
  constructor() {
    super("This canvas uses groups. Update isocan and reload the app before opening it.");
    this.name = "CanvasGroupsClientError";
  }
}

/** Log reads and socket broadcasts also inspect the record itself: a group
 * creation can be the first event an already-connected legacy client sees. */
export function groupOperation(op: Operation): boolean {
  if (op.type === "design.request" || op.type === "design.receipt") return op.effect !== undefined && groupOperation(op.effect);
  if (op.type === "questionnaire.ask") return op.context !== undefined || op.contextRequest !== undefined;
  if (op.type === "questionnaire.answer") return op.context !== undefined;
  if (op.type === "thread.create" || op.type === "thread.reply") return op.comment.context !== undefined || op.comment.contextRequest !== undefined;
  if (op.type === "comment.update") return op.context !== undefined || op.contextRequest !== undefined;
  if (op.type === "comment.restore") return op.comment.context !== undefined;
  if (op.type === "thread.restore") return op.thread.comments.some((comment) => comment.context !== undefined);
  return op.type === "group.change" || (op.type === "project.create" && op.groupMode === "groups");
}

/** Snapshot mode and log contents are separate evidence. Check either before
 * serving state, including archived group operations after a mode rollback. */
export function requireGroupClient(features: unknown, canvas?: Canvas, entries: readonly LogEntry[] = []): void {
  if (!supportsCanvasGroups(features) &&
      (canvas?.groupMode === "groups" || entries.some((entry) => groupOperation(entry.envelope.op) || entry.inverse !== null && entry.inverse !== undefined && groupOperation(entry.inverse)))) {
    throw new CanvasGroupsClientError();
  }
}
