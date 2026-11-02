import type { CanvasContents, Item, ItemVersion } from "./model.ts";
import { OpValidationError } from "./errors.ts";
import { annotationTarget } from "./annotation.ts";

/** A caller chooses scope; only the writer chooses membership and version metadata. */
export interface ContextRequest {
  rootIds: string[];
  includeExcluded?: boolean;
  expectedRevision?: number;
}
/** One hierarchy row, retained even when its content is excluded or unavailable. */
interface ContextEntry {
  itemId: string;
  parentId: string | null;
  depth: number;
  title: string;
  kind: string;
  excluded: boolean;
  unavailable?: string;
  version: ItemVersion | null;
  threadIds: string[];
  /** Ink keeps its target and normalized region even after the original items are gone. */
  annotation?: { targetId: string; region: string | null };
}
/** The exact scope of a message at one writer revision, independent of later item edits. */
export interface ContextManifest {
  canvasId: string;
  revision: number;
  rootIds: string[];
  expandedIds: string[];
  includeExcluded: boolean;
  ambient: boolean;
  entries: ContextEntry[];
  counts: { included: number; excluded: number; unavailable: number };
}
/** Paged references keep a complete manifest separate from the content actually retrieved. */
export interface ContextContentPage {
  canvasId: string;
  revision: number;
  offset: number;
  limit: number;
  total: number;
  nextOffset: number | null;
  entries: Array<{
    itemId: string;
    versionId: string | null;
    face: "source" | "visual";
    status: "available" | "excluded" | "unavailable";
    reason?: string;
    blob?: { blobHash: string; mimeType: string; filename: string; size: number };
    url?: string;
  }>;
  /** Counts describe this page; the manifest counts describe its entire scope. */
  counts: { included: number; excluded: number; unavailable: number };
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const bad = (message: string): never => { throw new OpValidationError("bad-op", message); };
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 100000 && value.every((id) => typeof id === "string" && id.length > 0);
const unique = (values: readonly string[]) => [...new Set(values)];

/** Deterministic hierarchy traversal; attachment targets and unrelated links are never followed. */
export function contextClosure(canvas: CanvasContents, rootIds: readonly string[]): Array<{ itemId: string; depth: number }> {
  const children = new Map<string, Item[]>();
  const annotations = new Map<string, Item[]>();
  const append = (index: Map<string, Item[]>, key: string, item: Item): void => {
    const rows = index.get(key); if (rows) rows.push(item); else index.set(key, [item]);
  };
  for (const item of Object.values(canvas.items)) {
    if (item.containerId) append(children, item.containerId, item);
    const target = annotationTarget(item);
    if (target) append(annotations, target, item);
  }
  const order = (items: Item[]) => items.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const rows of [...children.values(), ...annotations.values()]) order(rows);
  const seen = new Set<string>();
  const result: Array<{ itemId: string; depth: number }> = [];
  const visit = (id: string, depth: number): void => {
    if (seen.has(id)) return;
    seen.add(id); result.push({ itemId: id, depth });
    const item = canvas.items[id]; if (!item) return;
    // Marks are siblings of their target in the membership forest, including
    // marks on a group frame. Their depth never depends on visitation order.
    for (const mark of annotations.get(id) ?? []) visit(mark.id, depth);
    if (item.properties?.kind === "group") for (const child of children.get(id) ?? []) visit(child.id, depth + 1);
  };
  // Keep the original roots in provenance, but walk enclosing selected groups
  // first so selecting [child, group] describes the same hierarchy as [group].
  const selected = new Set(rootIds);
  const covered = (id: string): boolean => {
    const item = canvas.items[id]; if (!item) return false;
    const target = annotationTarget(item);
    if (target && target !== id && selected.has(target)) return true;
    let parent = item.containerId;
    const visited = new Set<string>([id]);
    while (parent && !visited.has(parent)) {
      if (selected.has(parent)) return true;
      visited.add(parent); parent = canvas.items[parent]?.containerId;
    }
    return false;
  };
  for (const id of unique(rootIds).filter((id) => !covered(id))) visit(id, 0);
  return result;
}

/** Shared with fresh manifest resolution so ambient exclusion has one ancestor rule. */
export function excludedInAmbient(canvas: CanvasContents, item: Item): boolean {
  const visited = new Set<string>();
  let current: Item | undefined = item;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.properties?.context === "excluded") return true;
    current = current.containerId ? canvas.items[current.containerId] : undefined;
  }
  return false;
}

/** Pins name roots, while group exclusions govern the whole ambient subtree. */
export function ambientContextItems(canvas: CanvasContents): Item[] {
  const roots = Object.values(canvas.items).filter((item) => item.properties?.context === "pinned").map((item) => item.id);
  return contextClosure(canvas, roots).flatMap(({ itemId }) => {
    const item = canvas.items[itemId];
    return item && !excludedInAmbient(canvas, item) ? [item] : [];
  });
}

/** Replay validates retained metadata without consulting live items which may be long gone. */
export function validateContextManifest(value: ContextManifest, canvasId: string): void {
  if (!object(value) || value.canvasId !== canvasId || !Number.isSafeInteger(value.revision) || value.revision < 0 || !ids(value.rootIds) || !ids(value.expandedIds) || !Array.isArray(value.entries) || value.entries.length !== value.expandedIds.length || typeof value.includeExcluded !== "boolean" || typeof value.ambient !== "boolean") bad("invalid frozen context manifest");
  if (unique(value.expandedIds).length !== value.expandedIds.length) bad("context repeats an expanded item");
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const [index, entry] of value.entries.entries()) {
    if (!object(entry) || entry.itemId !== value.expandedIds[index] || typeof entry.title !== "string" || typeof entry.kind !== "string" || typeof entry.excluded !== "boolean" || !Number.isInteger(entry.depth) || entry.depth < 0 || (entry.parentId !== null && typeof entry.parentId !== "string") || !ids(entry.threadIds) || (entry.unavailable !== undefined && typeof entry.unavailable !== "string")) bad("invalid context entry");
    if (entry.version !== null) {
      const version = entry.version;
      if (!object(version) || typeof version.id !== "string" || typeof version.blobHash !== "string" || typeof version.mimeType !== "string" || typeof version.filename !== "string" || !Number.isFinite(version.size) || version.size < 0) bad("invalid retained context version");
      if (version.visual !== undefined && (!object(version.visual) || typeof version.visual.blobHash !== "string" || typeof version.visual.mimeType !== "string" || typeof version.visual.filename !== "string" || !Number.isFinite(version.visual.size) || version.visual.size! < 0)) bad("invalid retained visual face");
    }
    if (entry.annotation !== undefined && (!object(entry.annotation) || typeof entry.annotation.targetId !== "string" || (entry.annotation.region !== null && typeof entry.annotation.region !== "string"))) bad("invalid retained annotation reference");
    counts[entry.excluded ? "excluded" : entry.unavailable ? "unavailable" : "included"]++;
  }
  if (!object(value.counts) || Object.keys(counts).some((key) => value.counts[key as keyof typeof counts] !== counts[key as keyof typeof counts])) bad("invalid context counts");
}

/** Shared protected route spelling for complete live context and its paged references. */
export function canvasContextRoute(canvasId: string): string { return `/api/projects/${encodeURIComponent(canvasId)}/context`; }
/** A saved request is addressed by its comment, never by re-resolving its former roots. */
export function commentContextRoute(canvasId: string, threadId: string, commentId: string): string {
  return `/api/projects/${encodeURIComponent(canvasId)}/threads/${encodeURIComponent(threadId)}/comments/${encodeURIComponent(commentId)}/context`;
}
