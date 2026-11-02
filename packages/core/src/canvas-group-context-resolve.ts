import type { CanvasState } from "./model.ts";
import { sourceFaceOf, visualFaceOf } from "./model.ts";
import type { Operation } from "./ops.ts";
import { GroupConflictError, OpValidationError } from "./errors.ts";
import { annotationTarget } from "./annotation.ts";
import { retainedDesignVersion } from "./design-record.ts";
import { contextClosure, excludedInAmbient, type ContextContentPage, type ContextManifest, type ContextRequest } from "./canvas-group-context.ts";

// Fresh request resolution is separate from the browser's replay/ambient leaf,
// so loading that leaf does not eagerly retain the writer's public vocabulary.
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const bad = (message: string): never => { throw new OpValidationError("bad-op", message); };
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 100000 && value.every((id) => typeof id === "string" && id.length > 0);
const unique = (values: readonly string[]) => [...new Set(values)];

function validateRequest(value: ContextRequest): void {
  if (!object(value) || Object.keys(value).some((key) => !["rootIds", "includeExcluded", "expectedRevision"].includes(key)) || !ids(value.rootIds)) bad("context needs selected root IDs");
  if (value.includeExcluded !== undefined && typeof value.includeExcluded !== "boolean") bad("includeExcluded must be a boolean");
  if (value.expectedRevision !== undefined && (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0)) bad("context revision must be a nonnegative integer");
}

function manifest(state: CanvasState, revision: number, request: ContextRequest, ambient: boolean): ContextManifest {
  validateRequest(request);
  if (request.expectedRevision !== undefined && request.expectedRevision !== revision) throw new GroupConflictError("canvas context changed since preview; refresh the context before sending");
  const rootIds = unique(request.rootIds);
  const threads = new Map<string, string[]>();
  for (const thread of Object.values(state.canvas.threads)) if (thread.anchorItemId) threads.set(thread.anchorItemId, [...threads.get(thread.anchorItemId) ?? [], thread.id]);
  const entries: ContextManifest["entries"] = contextClosure(state.canvas, rootIds).map(({ itemId, depth }) => {
    const item = state.canvas.items[itemId];
    if (!item) return { itemId, parentId: null, depth, title: itemId, kind: "missing", excluded: false, unavailable: "item is not live at this revision", version: null, threadIds: [] };
    const current = item.versions.find((version) => version.id === item.currentVersionId);
    const version = current ? retainedDesignVersion(current) : null;
    if (version?.visual) version.visual = { ...version.visual, filename: version.visual.filename ?? version.filename, size: version.visual.size ?? version.size };
    return {
      itemId, parentId: item.containerId ?? null, depth, title: item.title,
      kind: item.properties?.kind ?? current?.mimeType ?? "unknown",
      excluded: !request.includeExcluded && (ambient ? excludedInAmbient(state.canvas, item) : item.properties?.context === "excluded"),
      ...(!version ? { unavailable: "current version is unavailable" } : {}),
      version, threadIds: [...threads.get(itemId) ?? []].sort(),
      ...(annotationTarget(item) ? { annotation: { targetId: annotationTarget(item)!, region: item.properties.region ?? null } } : {}),
    };
  });
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const entry of entries) counts[entry.excluded ? "excluded" : entry.unavailable ? "unavailable" : "included"]++;
  return { canvasId: state.project.id, revision, rootIds, expandedIds: entries.map((entry) => entry.itemId), includeExcluded: request.includeExcluded === true, ambient, entries, counts };
}

/** A preview and a writer use the same complete expansion and exclusion rules. */
export function contextManifest(state: CanvasState, revision: number, request: ContextRequest): ContextManifest {
  return manifest(state, revision, request, false);
}
/** Ambient pins remain decisions on their roots; descendants are expanded only when read. */
export function ambientContextManifest(state: CanvasState, revision: number): ContextManifest {
  return manifest(state, revision, { rootIds: Object.values(state.canvas.items).filter((item) => item.properties?.context === "pinned").map((item) => item.id) }, true);
}

/** Canonical-only metadata is refused before forwarding and idempotency lookup. */
export function rejectPublicContext(op: Operation): void {
  const value = op.type === "thread.create" || op.type === "thread.reply" ? op.comment : op.type === "comment.update" ? op : null;
  if (value && Object.prototype.hasOwnProperty.call(value, "context")) bad("frozen context is produced by the writer; send contextRequest instead");
}

/** The home resolves selection once; ordinary body edits preserve the old request's scope. */
export function resolveContextOperation(state: CanvasState, revision: number, op: Operation): Operation {
  if (op.type !== "thread.create" && op.type !== "thread.reply" && op.type !== "comment.update") return op;
  const input = op.type === "comment.update" ? op : op.comment;
  const explicit = input.contextRequest;
  if (Object.prototype.hasOwnProperty.call(input, "contextRequest")) {
    validateRequest(explicit!);
    if (state.project.groupMode !== "groups") bad("frozen context requires a group-mode canvas");
  }
  if (state.project.groupMode !== "groups") return op;
  const existing = op.type === "comment.update" ? state.canvas.threads[op.threadId]?.comments.find((comment) => comment.id === op.commentId) : undefined;
  const request = explicit ?? (!existing?.context && input.items?.some((id) => state.canvas.items[id]?.properties?.kind === "group") ? { rootIds: input.items } : undefined);
  if (!request) return existing?.context && op.type === "comment.update" ? { ...op, items: [...existing.context.expandedIds] } : op;
  const context = contextManifest(state, revision, request);
  const { contextRequest: _request, ...plain } = input;
  const resolved = { ...plain, context, items: [...context.expandedIds] };
  return op.type === "comment.update" ? resolved as Operation : { ...op, comment: resolved as import("./ops.ts").NewComment };
}

/** Produce reference pages without opening bytes or returning excluded content. */
export function contextContentPage(manifest: ContextManifest, options: { offset?: number; limit?: number; face?: "source" | "visual" } = {}): ContextContentPage {
  const offset = options.offset ?? 0, limit = options.limit ?? 50, face = options.face ?? "source";
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !["source", "visual"].includes(face)) bad("context page needs an offset and a limit between 1 and 200");
  const entries: ContextContentPage["entries"] = manifest.entries.slice(offset, offset + limit).map((entry) => {
    const base = { itemId: entry.itemId, versionId: entry.version?.id ?? null, face };
    if (entry.excluded) return { ...base, status: "excluded", reason: "content excluded for this request" };
    if (!entry.version || entry.unavailable) return { ...base, status: "unavailable", reason: entry.unavailable ?? "version unavailable" };
    const blob = face === "visual" ? visualFaceOf(entry.version) : sourceFaceOf(entry.version);
    return { ...base, status: "available", blob, url: `/api/projects/${encodeURIComponent(manifest.canvasId)}/blobs/${encodeURIComponent(blob.blobHash)}` };
  });
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const entry of entries) counts[entry.status === "available" ? "included" : entry.status]++;
  return { canvasId: manifest.canvasId, revision: manifest.revision, offset, limit, total: manifest.entries.length, nextOffset: offset + limit < manifest.entries.length ? offset + limit : null, entries, counts };
}
