import { designSystem, governingDesign, normalizeHomeUrl, parseDesign, type CanvasContents, type LinkedCanvas } from "@isocan/core";
import type { DesignArtifactRef } from "@isocan/core/design-partner";
import { readInheritedCanvases } from "./context-reader.ts";
import type { DesignAuditReadPort } from "./design-audit-reader.ts";

/** Exact governing bytes and their selection provenance, shared by creation, checks and repair. */
export type GoverningDesignRead =
  | { status: "available"; artifact: DesignArtifactRef; title: string; inherited: boolean; text: string; document: ReturnType<typeof parseDesign>; refusedSources: Array<{ canvasId: string; itemId: string; reason: string }> }
  | { status: "none" | "unavailable"; artifact: DesignArtifactRef | null; title: string | null; reason: string; refusedSources: Array<{ canvasId: string; itemId: string; reason: string }> };

/** Reuses core scope precedence and reasserts source policy when opening inherited document bytes. */
export async function readGoverningDesign(io: DesignAuditReadPort, options: { canvasId: string; home: string; canvas: CanvasContents; atId?: string; signal?: AbortSignal; linked?: LinkedCanvas[]; documents?: Map<string, Promise<{ text: string; document: ReturnType<typeof parseDesign> }>> }): Promise<GoverningDesignRead> {
  const { canvas, canvasId, home, signal } = options;
  const refusedSources: Array<{ canvasId: string; itemId: string; reason: string }> = [];
  let artifact: DesignArtifactRef | null = null;
  let title: string | null = null;
  try {
    signal?.throwIfAborted();
    const at = options.atId === undefined ? undefined : canvas.items[options.atId];
    if (options.atId !== undefined && !at) throw new Error(`No item or scope ${options.atId} on this canvas.`);
    const scope = at ? { at } : undefined;
    const linked = designSystem(canvas, scope) ? [] : options.linked ?? await readInheritedCanvases(io, canvas, home, signal);
    refusedSources.push(...linked.flatMap(link => link.refused ? [{ canvasId: link.canvasId, itemId: link.item.id, reason: link.refused }] : []));
    const governing = governingDesign(canvas, linked, scope);
    if (!governing) return { status: refusedSources.length ? "unavailable" : "none", artifact: null, title: null, reason: refusedSources.length ? "A possible governing source could not be read." : "No design system governs this location.", refusedSources };
    title = governing.item.title;
    const version = governing.item.versions.find(one => one.id === governing.item.currentVersionId);
    if (!version) throw new Error("The governing design's current version is unavailable.");
    artifact = { home: normalizeHomeUrl(home), canvasId: governing.from?.canvasId ?? canvasId, itemId: governing.item.id, versionId: version.id, blobHash: version.blobHash };
    const key = JSON.stringify([artifact.canvasId, artifact.itemId, artifact.versionId, artifact.blobHash]);
    let pending = options.documents?.get(key);
    if (!pending) {
      pending = (governing.from
        ? io.sourceBlobText({ canvasId: artifact.canvasId, expectedHome: artifact.home }, version.blobHash, signal)
        : io.blobText(canvasId, version.blobHash, signal)).then(text => ({ text, document: parseDesign(text) }));
      options.documents?.set(key, pending);
    }
    const { text, document } = await pending;
    signal?.throwIfAborted();
    if (document.problems.length) throw new Error(`The governing design document could not be parsed: ${document.problems.join("; ")}`);
    return { status: "available", artifact, title: governing.item.title, inherited: governing.from !== null, text, document, refusedSources };
  } catch (error) {
    signal?.throwIfAborted();
    return { status: "unavailable", artifact, title, reason: error instanceof Error ? error.message : String(error), refusedSources };
  }
}
