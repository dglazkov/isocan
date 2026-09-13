import type { FastifyInstance } from "fastify";
import { ambientContextManifest, contextContentPage, contextManifest, GroupConflictError, OpValidationError, type CanvasState, type ContextContentPage, type ContextManifest, type ContextRequest } from "@isocan/core";
import type { Engine } from "./engine.ts";
import type { Store } from "./store.ts";

/** Preview and send freeze omitted visual metadata from its own stored face,
 * while explicit version metadata keeps the author's chosen filename and size. */
export async function hydrateContextManifest(store: Pick<Store, "blobMeta">, state: CanvasState, manifest: ContextManifest): Promise<ContextManifest> {
  const metadata = new Map<string, ReturnType<Store["blobMeta"]>>();
  const entries = await Promise.all(manifest.entries.map(async (entry) => {
    const version = entry.version;
    const original = state.canvas.items[entry.itemId]?.versions.find((one) => one.id === version?.id);
    const visual = original?.visual;
    if (!version?.visual || !visual || visual.blobHash === original.blobHash || (visual.filename !== undefined && visual.size !== undefined)) return entry;
    let lookup = metadata.get(visual.blobHash);
    if (!lookup) { lookup = store.blobMeta(manifest.canvasId, visual.blobHash); metadata.set(visual.blobHash, lookup); }
    const meta = await lookup;
    if (!meta) throw new OpValidationError("bad-op", `visual context metadata is unavailable for ${entry.itemId}; upload its visual blob before previewing or sending this context`);
    return { ...entry, version: { ...version, visual: { ...version.visual,
      ...(visual.filename === undefined ? { filename: meta.filename } : {}),
      ...(visual.size === undefined ? { size: meta.size } : {}),
    } } };
  }));
  return { ...manifest, entries };
}

/** An index row alone cannot prove bytes survived; probe one byte through the store contract. */
export async function contextBlobAvailable(store: Pick<Store, "blobMeta" | "openBlob">, canvasId: string, hash: string): Promise<boolean> {
  const meta = await store.blobMeta(canvasId, hash);
  if (!meta) return false;
  try {
    const stream = await store.openBlob(canvasId, hash, meta.size > 0 ? { start: 0, end: 0 } : undefined);
    if (!stream) return false;
    for await (const _chunk of stream) break;
    return true;
  } catch { return false; }
}

/** Byte availability is checked at read time; retained provenance itself never changes. */
export async function availableContextPage(store: Pick<Store, "blobMeta" | "openBlob">, manifest: ContextManifest, options: { offset?: number; limit?: number; face?: "source" | "visual" }): Promise<ContextContentPage> {
  const page = contextContentPage(manifest, options);
  for (const entry of page.entries) {
    if (entry.status !== "available" || !entry.blob) continue;
    if (!(await contextBlobAvailable(store, manifest.canvasId, entry.blob.blobHash))) {
      entry.status = "unavailable";
      entry.reason = "retained blob bytes are unavailable at this home";
      delete entry.url;
      page.counts.included--; page.counts.unavailable++;
    }
  }
  return page;
}

/** All reads live under the existing canvas admission, takedown, purge and capability hook. */
export function registerCanvasGroupContext(app: FastifyInstance, engine: Engine, store: Store): void {
  const read = async (params: { id: string; threadId?: string; commentId?: string }, query: Record<string, unknown>, content: boolean) => {
    const snapshot = await engine.getSnapshot(params.id);
    if (snapshot.project.groupMode !== "groups") throw new OpValidationError("bad-op", "group context requires a group-mode canvas");
    let manifest: ContextManifest;
    if (params.threadId && params.commentId) {
      const comment = snapshot.canvas.threads[params.threadId]?.comments.find((one) => one.id === params.commentId);
      if (!comment) throw new OpValidationError("unknown-comment", `unknown comment: ${params.commentId}`);
      if (!comment.context) throw new OpValidationError("bad-op", "this comment has no frozen context");
      manifest = comment.context;
    } else {
      if (content && query.expectedRevision === undefined) throw new OpValidationError("bad-op", "live context paging requires expectedRevision from its manifest");
      const expectedRevision = query.expectedRevision === undefined ? undefined : Number(query.expectedRevision);
      if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) throw new OpValidationError("bad-op", "invalid context revision");
      if (expectedRevision !== undefined && expectedRevision !== snapshot.lastSeq) throw new GroupConflictError("canvas context changed since preview; refresh the context before reading");
      if (query.roots !== undefined && typeof query.roots !== "string") throw new OpValidationError("bad-op", "context roots must be comma-separated IDs");
      if (query.includeExcluded !== undefined && !["true", "false"].includes(String(query.includeExcluded))) throw new OpValidationError("bad-op", "includeExcluded must be true or false");
      const request: ContextRequest | undefined = query.roots === undefined ? undefined : { rootIds: String(query.roots).split(",").filter(Boolean), includeExcluded: query.includeExcluded === "true", ...(expectedRevision !== undefined ? { expectedRevision } : {}) };
      manifest = await hydrateContextManifest(store, snapshot, request ? contextManifest(snapshot, snapshot.lastSeq, request) : ambientContextManifest(snapshot, snapshot.lastSeq));
    }
    if (!content) return manifest;
    return availableContextPage(store, manifest, {
      ...(query.offset !== undefined ? { offset: Number(query.offset) } : {}),
      ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
      ...(query.face !== undefined ? { face: String(query.face) as "source" | "visual" } : {}),
    });
  };
  for (const route of ["/api/projects/:id/context", "/api/projects/:id/threads/:threadId/comments/:commentId/context"]) {
    app.get(route, async (req) => read(req.params as { id: string; threadId?: string; commentId?: string }, req.query as Record<string, unknown>, false));
    app.get(`${route}/content`, async (req) => read(req.params as { id: string; threadId?: string; commentId?: string }, req.query as Record<string, unknown>, true));
  }
}
