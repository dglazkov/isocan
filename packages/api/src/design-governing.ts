import { selectDesignSystem, selectGoverningDesign, normalizeHomeUrl, parseDesign, designSkipped, type Actor, type CanvasContents, type LinkedCanvas, type ItemVersion, type GoverningDesignSelection } from "@isocan/core";
import type { DesignArtifactRef } from "@isocan/core/design-partner";
import { readInheritedCanvases } from "./context-reader.ts";
import type { DesignAuditReadPort } from "./design-audit-reader.ts";

type Selection = Pick<GoverningDesignSelection, "level" | "scopeId" | "scopeDepth" | "reason"> & { candidates: Array<{ artifact: DesignArtifactRef; title: string; updatedAt: string }> };
type Common = { exempt: boolean; selection: Selection; refusedSources: Array<{ canvasId: string; itemId: string; reason: string }> };
/** Exact governing bytes and their selection provenance, shared by creation, checks and repair. */
export type GoverningDesignRead = Common & (
  | { status: "available"; artifact: DesignArtifactRef; title: string; inherited: boolean; text: string; document: ReturnType<typeof parseDesign>; version: ItemVersion; versions: number; author: Actor; metadata: { title: string; properties: Record<string, string> } }
  | { status: "none" | "unavailable"; artifact: DesignArtifactRef | null; title: string | null; reason: string });

/** Reuses core scope precedence and reasserts source policy when opening inherited document bytes. */
export async function readGoverningDesign(io: DesignAuditReadPort, options: { canvasId: string; home: string; canvas: CanvasContents; project?: { properties?: Record<string, string> }; atId?: string; groupId?: string | null; point?: { x: number; y: number }; signal?: AbortSignal; linked?: LinkedCanvas[]; documents?: Map<string, Promise<{ text: string; document: ReturnType<typeof parseDesign> }>> }): Promise<GoverningDesignRead> {
  const { canvas, canvasId, home, signal } = options;
  let common: Common = { exempt: designSkipped(options.project ?? {}), selection: { level: "none", scopeId: null, scopeDepth: null, reason: "The governing selection could not be read.", candidates: [] }, refusedSources: [] };
  let artifact: DesignArtifactRef | null = null, title: string | null = null;
  try {
    signal?.throwIfAborted();
    const at = options.atId === undefined ? options.point : canvas.items[options.atId];
    if (options.atId !== undefined && !at) throw new Error(`No item or scope ${options.atId} on this canvas.`);
    const scope = { ...(at ? { at } : {}), ...(options.groupId !== undefined ? { groupId: options.groupId } : {}) };
    const local = selectDesignSystem(canvas, scope);
    const linked = local.status !== "none" ? [] : options.linked ?? await readInheritedCanvases(io, canvas, home, signal);
    const governing = selectGoverningDesign(canvas, linked, { ...scope, ...(options.project ? { project: options.project } : {}) });
    const sourceCanvasId = governing.from?.canvasId ?? canvasId;
    const ref = (itemId: string, version: ItemVersion): DesignArtifactRef => ({ home: normalizeHomeUrl(home), canvasId: sourceCanvasId, itemId, versionId: version.id, blobHash: version.blobHash });
    common = { exempt: governing.exempt, refusedSources: governing.refusedSources, selection: { level: governing.level, scopeId: governing.scopeId, scopeDepth: governing.scopeDepth, reason: governing.reason, candidates: governing.candidates.flatMap(item => { const version = item.versions.find(one => one.id === item.currentVersionId); return version ? [{ artifact: ref(item.id, version), title: item.title, updatedAt: item.updatedAt }] : []; }) } };
    if (!governing.item) return { ...common, status: governing.status === "unavailable" ? "unavailable" : "none", artifact: null, title: null, reason: governing.reason };
    const item = governing.item;
    title = item.title;
    const version = item.versions.find(one => one.id === item.currentVersionId);
    if (!version) throw new Error("The governing design's current version is unavailable.");
    artifact = ref(item.id, version);
    const key = JSON.stringify([artifact.home, artifact.canvasId, artifact.itemId, artifact.versionId, artifact.blobHash]);
    let pending = options.documents?.get(key);
    if (!pending) {
      pending = (governing.from ? io.sourceBlobText({ canvasId: artifact.canvasId, expectedHome: artifact.home }, version.blobHash, signal) : io.blobText(canvasId, version.blobHash, signal)).then(text => ({ text, document: parseDesign(text) }));
      options.documents?.set(key, pending);
    }
    const { text, document } = await pending;
    signal?.throwIfAborted();
    if (document.problems.length) throw new Error(`The governing design document could not be parsed: ${document.problems.join("; ")}`);
    return { ...common, status: "available", artifact, title, inherited: governing.from !== null, text, document, version, versions: item.versions.length, author: version.createdBy, metadata: { title, properties: item.properties } };
  } catch (error) {
    signal?.throwIfAborted();
    return { ...common, status: "unavailable", artifact, title, reason: error instanceof Error ? error.message : String(error) };
  }
}
