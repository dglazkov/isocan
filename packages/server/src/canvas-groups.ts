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
  return op.type === "group.change" || (op.type === "project.create" && op.groupMode === "groups");
}

/** Snapshot mode and log contents are separate evidence. Check either before
 * serving state, including archived group operations after a mode rollback. */
export function requireGroupClient(features: unknown, canvas?: Canvas, entries: readonly LogEntry[] = []): void {
  if (!supportsCanvasGroups(features) &&
      (canvas?.groupMode === "groups" || entries.some((entry) => groupOperation(entry.envelope.op)))) {
    throw new CanvasGroupsClientError();
  }
}
