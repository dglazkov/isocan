import {
  designSystem, governingDesign, inCanvasScope, itemKind, normalizeHomeUrl, parseDesign, sourceFaceOf,
  type CanvasContents, type LinkedCanvas, type SourceClassificationRequest,
} from "@isocan/core";
import type { ScreenAudit } from "@isocan/core/design-audit";
import { readInheritedCanvases, type ContextReadPort } from "./context-reader.ts";

/** Both transports enforce automatic-source policy on the actual inherited blob read. */
export interface DesignAuditReadPort extends Pick<ContextReadPort, "classifySource" | "sourceSnapshot"> {
  blobText(canvasId: string, hash: string, signal?: AbortSignal): Promise<string>;
  sourceBlobText(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<string>;
}

/** Select current HTML sources by exact identity, optionally within one canvas scope. */
export interface DesignAuditOptions {
  /** Exact ids; reference resolution belongs to the caller. Omission selects all screens. */
  itemIds?: string[];
  scopeId?: string;
  signal?: AbortSignal;
}

/** The governing document's immutable source identity, including its original canvas. */
export interface DesignAuditProvenance {
  canvasId: string;
  itemId: string;
  versionId: string;
  blobHash: string;
  title: string;
  name: string;
  inherited: boolean;
}

interface ItemAuditIdentity {
  canvasId: string;
  itemId: string;
  title: string;
  versionId: string;
  blobHash: string | null;
}

/** Unavailable source or policy reads remain explicit instead of yielding a conforming audit. */
export type ItemDesignAudit = ItemAuditIdentity & (
  | (ScreenAudit & { status: "audited"; governing: DesignAuditProvenance })
  | { status: "unavailable"; reason: string; governing: DesignAuditProvenance | null }
);

/** Per-screen findings and read failures, with compatibility totals for existing audit consumers. */
export interface CanvasDesignAudit {
  canvasId: string;
  ruleVersion: string;
  /** Compatibility label: the single effective system's name, else "Multiple design systems". */
  system: string | null;
  screens: number;
  offSystem: number;
  audited: number;
  unavailable: number;
  items: ItemDesignAudit[];
  /** A refused inheritance edge is visible even when another source can supply a system. */
  refusedSources: { canvasId: string; itemId: string; reason: string }[];
}

/** Browser-safe orchestration. Reports are derived from the supplied snapshot and immutable blobs. */
export async function readCanvasDesignAudit(
  io: DesignAuditReadPort,
  options: DesignAuditOptions & { canvasId: string; home: string; canvas: CanvasContents },
): Promise<CanvasDesignAudit> {
  const { canvas, canvasId, signal } = options;
  signal?.throwIfAborted();
  const scope = options.scopeId === undefined ? null : canvas.items[options.scopeId];
  if (options.scopeId !== undefined && !scope) throw new Error(`No scope ${options.scopeId} on this canvas.`);
  const chosen = options.itemIds === undefined ? Object.values(canvas.items).filter(item => itemKind(item) === "screen") : options.itemIds.map(id => {
    const item = canvas.items[id];
    if (!item) throw new Error(`No item ${id} on this canvas.`);
    if (itemKind(item) !== "screen") throw new Error(`${item.title} is not an HTML screen.`);
    return item;
  });
  const screens = [...new Map(chosen.filter(item => !scope || inCanvasScope(canvas, scope, item)).map(item => [item.id, item])).values()];
  const linked: LinkedCanvas[] = screens.some(item => !designSystem(canvas, { at: item }))
    ? await readInheritedCanvases(io, canvas, options.home, signal) : [];
  signal?.throwIfAborted();
  // An explicit lazy entry keeps HTML/CSS parsers out of the browser's initial graph.
  const { auditScreen, DESIGN_AUDIT_VERSION, offSystemTotal } = await import("@isocan/core/design-audit");
  const documents = new Map<string, Promise<ReturnType<typeof parseDesign>>>();
  const items: ItemDesignAudit[] = [];
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  for (const item of screens) {
    signal?.throwIfAborted();
    const version = item.versions.find(one => one.id === item.currentVersionId);
    const identity: ItemAuditIdentity = { canvasId, itemId: item.id, title: item.title, versionId: item.currentVersionId, blobHash: version?.blobHash ?? null };
    let provenance: DesignAuditProvenance | null = null;
    try {
      if (!version) throw new Error("The screen's current version is unavailable.");
      if (sourceFaceOf(version).mimeType !== "text/html") throw new Error("Only an HTML source face can be audited.");
      const governing = governingDesign(canvas, linked, { at: item });
      if (!governing) throw new Error("No readable design system governs this screen.");
      const system = governing.item;
      const systemVersion = system.versions.find(one => one.id === system.currentVersionId);
      if (!systemVersion) throw new Error(`The current version of ${system.title} is unavailable.`);
      const sourceCanvasId = governing.from?.canvasId ?? canvasId;
      provenance = { canvasId: sourceCanvasId, itemId: system.id, versionId: systemVersion.id, blobHash: systemVersion.blobHash, title: system.title, name: system.title, inherited: governing.from !== null };
      const key = JSON.stringify([sourceCanvasId, system.id, systemVersion.id, systemVersion.blobHash]);
      let pending = documents.get(key);
      if (!pending) {
        pending = (governing.from
          ? io.sourceBlobText({ canvasId: sourceCanvasId, expectedHome: normalizeHomeUrl(options.home) }, systemVersion.blobHash, signal)
          : io.blobText(canvasId, systemVersion.blobHash, signal)).then(parseDesign);
        documents.set(key, pending);
      }
      const doc = await pending;
      signal?.throwIfAborted();
      if (doc.problems.length) throw new Error(`The governing design document could not be parsed: ${doc.problems.join("; ")}`);
      provenance.name = doc.tokens.name ?? system.title;
      const source = await io.blobText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      items.push({ ...identity, status: "audited", governing: provenance, ...auditScreen(source, doc.tokens) });
    } catch (error) {
      signal?.throwIfAborted();
      items.push({ ...identity, status: "unavailable", governing: provenance, reason: errorText(error) });
    }
  }
  const audited = items.filter((item): item is Extract<ItemDesignAudit, { status: "audited" }> => item.status === "audited");
  const systems = new Map(audited.map(item => [JSON.stringify([item.governing.canvasId, item.governing.itemId]), item.governing.name]));
  return {
    canvasId, ruleVersion: DESIGN_AUDIT_VERSION,
    system: systems.size > 1 ? "Multiple design systems" : [...systems.values()][0] ?? null,
    screens: items.length, offSystem: offSystemTotal(audited), audited: audited.length,
    unavailable: items.length - audited.length, items,
    refusedSources: linked.filter(link => link.refused).map(link => ({ canvasId: link.canvasId, itemId: link.item.id, reason: link.refused! })),
  };
}
