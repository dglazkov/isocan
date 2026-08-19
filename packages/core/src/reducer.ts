import type {
  Actor,
  CanvasState,
  Comment,
  Item,
  ItemVersion,
  Project,
  ProjectState,
} from "./model.ts";
import { emptyCanvas, mainThread } from "./model.ts";
import type { MetaPatch, NewComment, NewVersion, OpEnvelope } from "./ops.ts";
import { OpValidationError, unknownOperation } from "./errors.ts";
import { resolvePlacement } from "./placement.ts";

/**
 * The shared pure reducer. The daemon runs it authoritatively; the web client
 * runs the identical function against its replica for every broadcast op.
 *
 * - `project.create` requires `state === null` and returns a fresh ProjectState.
 * - `project.delete` returns null (the engine moves the directory aside; the
 *   replica handles the separate "project-deleted" message).
 * - Every mutation stamps `updatedAt`/`updatedBy` from the envelope. Undo
 *   restores content, not these stamps — the undoer did mutate the item.
 */
export function applyOperation(
  state: ProjectState | null,
  envelope: OpEnvelope,
): ProjectState | null {
  const { op, actor, ts } = envelope;

  if (op.type === "project.create") {
    if (state !== null) {
      throw new OpValidationError("bad-op", "project.create on existing project");
    }
    const project: Project = {
      id: op.projectId,
      title: op.title,
      description: op.description ?? "",
      properties: { ...op.properties },
      createdAt: ts,
      createdBy: actor,
      updatedAt: ts,
      updatedBy: actor,
    };
    return { project, canvas: emptyCanvas() };
  }

  if (state === null) {
    throw new OpValidationError("bad-op", `${op.type} on missing project`);
  }

  if (op.type === "project.delete") {
    return null;
  }

  const stamp = { updatedAt: ts, updatedBy: actor };
  const { project, canvas } = state;

  const withCanvas = (next: CanvasState): ProjectState => ({ project, canvas: next });

  const getItem = (itemId: string): Item => {
    const item = canvas.items[itemId];
    if (!item) throw new OpValidationError("unknown-item", `unknown item: ${itemId}`);
    return item;
  };

  const putItem = (item: Item): ProjectState =>
    withCanvas({ ...canvas, items: { ...canvas.items, [item.id]: item } });

  const getThread = (threadId: string) => {
    const thread = canvas.threads[threadId];
    if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${threadId}`);
    return thread;
  };

  switch (op.type) {
    case "actor.claim":
    case "actor.setColor":
      // Home-scoped: the engine applies these against the actor registry and
      // never routes them here. The cases exist for exhaustiveness.
      throw new OpValidationError("bad-op", `${op.type} is not a canvas operation`);

    case "project.update":
      return {
        project: { ...project, ...applyMetaPatch(project, op.patch), ...stamp },
        canvas,
      };

    case "item.add": {
      if (canvas.items[op.itemId] || canvas.trash.some((t) => t.item.id === op.itemId)) {
        throw new OpValidationError("duplicate-id", `item id already exists: ${op.itemId}`);
      }
      const { x, y } = resolvePlacement(canvas, op.placement, op.width);
      const item: Item = {
        id: op.itemId,
        x,
        y,
        width: op.width,
        height: op.height,
        title: op.title ?? op.version.filename,
        description: op.description ?? "",
        properties: { ...op.properties },
        versions: [toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        createdAt: ts,
        createdBy: actor,
        ...stamp,
      };
      return putItem(item);
    }

    case "item.move":
      return putItem({ ...getItem(op.itemId), x: op.x, y: op.y, ...stamp });

    case "item.resize":
      return putItem({ ...getItem(op.itemId), width: op.width, height: op.height, ...stamp });

    case "item.update": {
      const item = getItem(op.itemId);
      const renamed =
        op.filename === undefined
          ? item.versions
          : item.versions.map((version) =>
              version.id === item.currentVersionId ? { ...version, filename: op.filename! } : version,
            );
      return putItem({
        ...item,
        ...applyMetaPatch(item, op.patch),
        versions: renamed,
        ...stamp,
      });
    }

    case "item.addVersion": {
      const item = getItem(op.itemId);
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        versions: [...item.versions, toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        ...stamp,
      });
    }

    case "item.setCurrentVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      return putItem({ ...item, currentVersionId: op.versionId, ...stamp });
    }

    case "item.removeVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      const versions = item.versions.filter((v) => v.id !== op.versionId);
      if (versions.length === 0) {
        throw new OpValidationError("bad-op", "cannot remove the only version");
      }
      if (!versions.some((v) => v.id === op.prevCurrentVersionId)) {
        throw new OpValidationError(
          "unknown-version",
          `prevCurrentVersionId not among remaining versions: ${op.prevCurrentVersionId}`,
        );
      }
      return putItem({ ...item, versions, currentVersionId: op.prevCurrentVersionId, ...stamp });
    }

    case "item.restoreVersion": {
      const item = getItem(op.itemId);
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        versions: [...item.versions, op.version],
        currentVersionId: op.version.id,
        ...stamp,
      });
    }

    case "item.delete": {
      const item = getItem(op.itemId);
      const items = { ...canvas.items };
      delete items[op.itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [...canvas.trash, { item, deletedAt: ts, deletedBy: actor }],
      });
    }

    case "item.restore": {
      const entry = canvas.trash.find((t) => t.item.id === op.itemId);
      if (!entry) throw new OpValidationError("not-in-trash", `item not in trash: ${op.itemId}`);
      return withCanvas({
        ...canvas,
        items: { ...canvas.items, [op.itemId]: entry.item },
        trash: canvas.trash.filter((t) => t.item.id !== op.itemId),
      });
    }

    case "items.move": {
      requireUniqueIds(op.moves.map((m) => m.itemId));
      for (const move of op.moves) getItem(move.itemId); // validate all before applying any
      const items = { ...canvas.items };
      for (const move of op.moves) {
        items[move.itemId] = { ...items[move.itemId]!, x: move.x, y: move.y, ...stamp };
      }
      return withCanvas({ ...canvas, items });
    }

    case "items.delete": {
      requireUniqueIds(op.itemIds);
      const deleted = op.itemIds.map(getItem);
      const items = { ...canvas.items };
      for (const itemId of op.itemIds) delete items[itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [
          ...canvas.trash,
          ...deleted.map((item) => ({ item, deletedAt: ts, deletedBy: actor })),
        ],
      });
    }

    case "items.restore": {
      requireUniqueIds(op.itemIds);
      const wanted = new Set(op.itemIds);
      const entries = canvas.trash.filter((t) => wanted.has(t.item.id));
      if (entries.length !== op.itemIds.length) {
        const found = new Set(entries.map((t) => t.item.id));
        const missing = op.itemIds.find((id) => !found.has(id));
        throw new OpValidationError("not-in-trash", `item not in trash: ${missing}`);
      }
      const items = { ...canvas.items };
      for (const entry of entries) items[entry.item.id] = entry.item;
      return withCanvas({
        ...canvas,
        items,
        trash: canvas.trash.filter((t) => !wanted.has(t.item.id)),
      });
    }

    case "trash.empty":
      return withCanvas({ ...canvas, trash: [] });

    case "thread.create": {
      if (canvas.threads[op.threadId]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.threadId}`);
      }
      requireBody(op.comment.body);
      if (op.anchorItemId !== null) getItem(op.anchorItemId);
      // Strict, not takeover: a race between two clients birthing a main
      // thread must not leave one silently demoted — the loser errors and
      // replies to the winner's thread instead. Keeps undo exact, too.
      if (op.main && mainThread(canvas)) {
        throw new OpValidationError("main-exists", "canvas already has a main thread");
      }
      const thread = {
        id: op.threadId,
        x: op.x,
        y: op.y,
        anchorItemId: op.anchorItemId,
        comments: [toComment(op.comment, actor, ts)],
        ...(op.main ? { main: true } : {}),
        createdAt: ts,
        createdBy: actor,
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [thread.id]: thread } });
    }

    case "thread.reply": {
      const thread = getThread(op.threadId);
      requireBody(op.comment.body);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, toComment(op.comment, actor, ts)] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "thread.setMain": {
      const prev = mainThread(canvas);
      const next = op.threadId === null ? null : getThread(op.threadId);
      if (prev?.id === next?.id) return withCanvas(canvas); // no-op, but keep the entry
      const threads = { ...canvas.threads };
      if (prev) {
        const demoted = { ...prev };
        delete demoted.main;
        threads[prev.id] = demoted;
      }
      if (next) threads[next.id] = { ...next, main: true };
      return withCanvas({ ...canvas, threads });
    }

    case "thread.setAnchor": {
      const thread = getThread(op.threadId);
      // A trashed item is a valid anchor (rendered dangling, like after
      // item.delete) — undoing a re-anchor must restore a dangling anchor.
      if (
        op.anchorItemId !== null &&
        !canvas.items[op.anchorItemId] &&
        !canvas.trash.some((t) => t.item.id === op.anchorItemId)
      ) {
        throw new OpValidationError("unknown-item", `unknown item: ${op.anchorItemId}`);
      }
      const next = { ...thread, anchorItemId: op.anchorItemId, x: op.x, y: op.y };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.update": {
      const thread = getThread(op.threadId);
      const existing = thread.comments.find((c) => c.id === op.commentId);
      if (!existing) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      // Your own words only. The single writer is the one place this can be
      // enforced, so it is enforced here rather than asked of every client.
      if (existing.author.id !== actor.id) {
        throw new OpValidationError(
          "bad-op",
          `a comment belongs to its author: ${op.commentId} is ${existing.author.name}'s`,
        );
      }
      // Mentions and item refs are re-resolved for the new body, so an edit
      // that drops a name drops the mention with it.
      const { mentions: _wasMentions, items: _wasItems, ...bare } = existing;
      const edited: Comment = {
        ...bare,
        body: op.body,
        ...(op.mentions ? { mentions: op.mentions } : {}),
        ...(op.items ? { items: op.items } : {}),
        editedAt: ts,
      };
      const next = {
        ...thread,
        comments: thread.comments.map((c) => (c.id === op.commentId ? edited : c)),
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.remove": {
      const thread = getThread(op.threadId);
      if (!thread.comments.some((c) => c.id === op.commentId)) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      if (thread.comments.length === 1) {
        throw new OpValidationError("last-comment", "cannot remove the last comment of a thread");
      }
      const next = { ...thread, comments: thread.comments.filter((c) => c.id !== op.commentId) };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "comment.restore": {
      const thread = getThread(op.threadId);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, op.comment] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }

    case "thread.delete": {
      getThread(op.threadId);
      const threads = { ...canvas.threads };
      delete threads[op.threadId];
      return withCanvas({ ...canvas, threads });
    }

    case "thread.restore": {
      if (canvas.threads[op.thread.id]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.thread.id}`);
      }
      // The carried thread may have been main when deleted; if another thread
      // has become main since, the restored one yields — at most one main.
      const { main: wasMain, ...bare } = op.thread;
      const thread = wasMain && !mainThread(canvas) ? { ...bare, main: true } : bare;
      return withCanvas({
        ...canvas,
        threads: { ...canvas.threads, [op.thread.id]: thread },
      });
    }

    default:
      return unknownOperation(op);
  }
}

function applyMetaPatch(
  target: { title: string; description: string; properties: Record<string, string> },
  patch: MetaPatch,
): { title: string; description: string; properties: Record<string, string> } {
  const properties = { ...target.properties, ...patch.properties };
  for (const key of patch.removeProperties ?? []) delete properties[key];
  return {
    title: patch.title ?? target.title,
    description: patch.description ?? target.description,
    properties,
  };
}

function toItemVersion(v: NewVersion, actor: Actor, ts: string): ItemVersion {
  return { ...v, createdAt: ts, createdBy: actor };
}

function toComment(c: NewComment, actor: Actor, ts: string): Comment {
  const comment: Comment = { id: c.id, author: actor, body: c.body, createdAt: ts };
  if (c.mentions && c.mentions.length > 0) comment.mentions = [...c.mentions];
  if (c.items && c.items.length > 0) comment.items = [...c.items];
  return comment;
}

function requireUniqueIds(ids: string[]): void {
  if (ids.length === 0) {
    throw new OpValidationError("bad-op", "batch op requires at least one item");
  }
  if (new Set(ids).size !== ids.length) {
    throw new OpValidationError("duplicate-id", "batch op lists an item twice");
  }
}

function requireVersion(item: Item, versionId: string): void {
  if (!item.versions.some((v) => v.id === versionId)) {
    throw new OpValidationError("unknown-version", `unknown version: ${versionId}`);
  }
}

function requireBody(body: string): void {
  if (body.trim().length === 0) {
    throw new OpValidationError("empty-body", "comment body cannot be empty");
  }
}
