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
