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

import type { Operation, OperationType } from "./ops.ts";

/*
 * **Which act a write was, for counting** (moved out of `opwords.ts` on
 * 14 Oct 2026, unchanged; `opwords.ts` re-exports it).
 *
 * The group writer every canvas runs asks it, so it is in the web app's first
 * paint. The words for each act — `OP_WORDS`, a phrase for every operation —
 * are read by the timeline, the canvas list and the CLI, and while they shared
 * a file with this question they were in every first visit too, because a
 * module in the entry chunk carries every export any chunk uses.
 */

/**
 * The act behind a canonical write, for activity summaries on both surfaces.
 * Group-mode insertion is still adding an item; the writer wraps it so its
 * placement and ancestor repairs are atomic. Explicit group creation stays a
 * group change. Undo keeps the original intent, so only actual creation
 * effects count as adding — an inverse insertion must not claim it added.
 */
export function activityOpType(op: Operation): OperationType {
  if (op.type === "group.change") {
    if (op.action.kind === "insert") return "item.add";
    if (
      op.action.kind === "apply" && op.action.change.intent === "insert" &&
      op.action.change.writes.some((write) => write.kind === "create")
    ) return "item.add";
  }
  return op.type;
}
