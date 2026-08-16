import type { ProjectState } from "./model.ts";
import type { MetaPatch, NewVersion, Operation } from "./ops.ts";
import { OpValidationError, unknownOperation } from "./errors.ts";

/**
 * Compute the inverse of an operation against the state it is ABOUT to be
 * applied to. The daemon runs this before applying and stores the result in
 * the LogEntry — inverses are never re-derived later.
 *
 * Returns null for operations that are not undoable (trash.empty,
 * project.delete). Both are confirmation-gated at the client.
 */
export function invertOperation(
  stateBefore: ProjectState | null,
  op: Operation,
): Operation | null {
  if (op.type === "project.create") {
    // Not undoable: its inverse would be project.delete, and project deletion
    // must never be reachable through a casual ⌘Z — it stays confirmation-gated.
    return null;
  }
  if (stateBefore === null) {
    throw new OpValidationError("bad-op", `${op.type} on missing project`);
  }
  const { project, canvas } = stateBefore;

  const getItem = (itemId: string) => {
    const item = canvas.items[itemId];
    if (!item) throw new OpValidationError("unknown-item", `unknown item: ${itemId}`);
    return item;
  };

  switch (op.type) {
    case "project.update":
      return { type: "project.update", patch: invertMetaPatch(project, op.patch) };

    case "project.delete":
      return null;

    case "item.add":
      return { type: "item.delete", itemId: op.itemId };

    case "item.move": {
      const { x, y } = getItem(op.itemId);
      return { type: "item.move", itemId: op.itemId, x, y };
    }

    case "item.resize": {
      const { width, height } = getItem(op.itemId);
      return { type: "item.resize", itemId: op.itemId, width, height };
    }

    case "item.update":
      return {
        type: "item.update",
        itemId: op.itemId,
        patch: invertMetaPatch(getItem(op.itemId), op.patch),
      };

    case "item.addVersion":
      return {
        type: "item.removeVersion",
        itemId: op.itemId,
        versionId: op.version.id,
        prevCurrentVersionId: getItem(op.itemId).currentVersionId,
      };

    case "item.setCurrentVersion":
      return {
        type: "item.setCurrentVersion",
        itemId: op.itemId,
        versionId: getItem(op.itemId).currentVersionId,
      };

    case "item.removeVersion": {
      const item = getItem(op.itemId);
      const version = item.versions.find((v) => v.id === op.versionId);
      if (!version) {
        throw new OpValidationError("unknown-version", `unknown version: ${op.versionId}`);
      }
      return { type: "item.restoreVersion", itemId: op.itemId, version };
    }

    case "item.restoreVersion":
      return {
        type: "item.removeVersion",
        itemId: op.itemId,
        versionId: op.version.id,
        prevCurrentVersionId: getItem(op.itemId).currentVersionId,
      };

    case "item.delete":
      return { type: "item.restore", itemId: op.itemId };

    case "item.restore":
      return { type: "item.delete", itemId: op.itemId };

    case "items.move":
      return {
        type: "items.move",
        moves: op.moves.map((move) => {
          const { x, y } = getItem(move.itemId);
          return { itemId: move.itemId, x, y };
        }),
      };

    case "items.delete":
      return { type: "items.restore", itemIds: op.itemIds };

    case "items.restore":
      return { type: "items.delete", itemIds: op.itemIds };

    case "trash.empty":
      return null;

    case "thread.create":
      return { type: "thread.delete", threadId: op.threadId };

    case "thread.reply":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.comment.id };

    case "thread.setMain": {
      if (op.threadId !== null && !canvas.threads[op.threadId]) {
        throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      }
      const prev = Object.values(canvas.threads).find((t) => t.main);
      return { type: "thread.setMain", threadId: prev?.id ?? null };
    }

    case "thread.setAnchor": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      return {
        type: "thread.setAnchor",
        threadId: op.threadId,
        anchorItemId: thread.anchorItemId,
        x: thread.x,
        y: thread.y,
      };
    }

    case "comment.remove": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      const comment = thread.comments.find((c) => c.id === op.commentId);
      if (!comment) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      return { type: "comment.restore", threadId: op.threadId, comment };
    }

    case "comment.restore":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.comment.id };

    case "thread.delete": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      return { type: "thread.restore", thread };
    }

    case "thread.restore":
      return { type: "thread.delete", threadId: op.thread.id };

    default:
      return unknownOperation(op);
  }
}

function invertMetaPatch(
  prev: { title: string; description: string; properties: Record<string, string> },
  patch: MetaPatch,
): MetaPatch {
  const inverse: MetaPatch = {};
  if (patch.title !== undefined) inverse.title = prev.title;
  if (patch.description !== undefined) inverse.description = prev.description;

  const restore: Record<string, string> = {};
  const removeAdded: string[] = [];
  for (const key of Object.keys(patch.properties ?? {})) {
    const prevValue = prev.properties[key];
    if (prevValue !== undefined) restore[key] = prevValue;
    else removeAdded.push(key);
  }
  for (const key of patch.removeProperties ?? []) {
    const prevValue = prev.properties[key];
    if (prevValue !== undefined) restore[key] = prevValue;
  }
  if (Object.keys(restore).length > 0) inverse.properties = restore;
  if (removeAdded.length > 0) inverse.removeProperties = removeAdded;
  return inverse;
}

/** Strip server-assigned fields from a stored ItemVersion back to the wire shape. */
export function toNewVersion(v: {
  id: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  size: number;
}): NewVersion {
  return { id: v.id, blobHash: v.blobHash, mimeType: v.mimeType, filename: v.filename, size: v.size };
}
