import {
  canvasIdOf, checkDesign, contextLayers, designSystem, memoryLinks,
  normalizeHomeUrl, parseCanvasAddress, parseDesign, personalMemoryLinks, sourceOf,
  type CanvasContents, type CanvasSnapshotResponse, type ContextExtras,
  type ContextLayer, type LinkedCanvas, type PersonalReadResponse,
  type RecapHeadResponse,
  type SourceClassificationRequest, type SourceClassificationResponse,
} from "@isocan/core";

/** A browser and a Node client inject transport; this module owns the shared read order. */
export interface ContextReadPort {
  classifySource(source: SourceClassificationRequest, signal?: AbortSignal): Promise<SourceClassificationResponse>;
  /** Actual source reads carry exclusion and this expected authority, not only an earlier preflight. */
  sourceSnapshot(source: SourceClassificationRequest, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  /** Optional for existing ports; missing support is reported as unavailable, never as zero activity. */
  sourceRecap?(source: SourceClassificationRequest, signal?: AbortSignal): Promise<RecapHeadResponse>;
  readPersonal(canvasId: string, request: { actorId: string; itemId: string; mode: "summary" }, signal?: AbortSignal): Promise<PersonalReadResponse>;
  designText?(canvasId: string, hash: string, signal?: AbortSignal): Promise<string>;
}

/** An automatic reader knows the destination's home and the card's disclosed target facts. */
export interface AutomaticSource {
  canvasId: string;
  home: string;
  source?: string | null;
}

/** Unknown and personal sources remain redacted, including persisted preview fallbacks. */
export type AutomaticSourceAccess =
  | { kind: "ordinary"; expectedHome: string }
  | { kind: "personal" | "unavailable"; refused: string };

function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Classify before any snapshot, presence, blob or screenshot operation on an automatic edge. */
export async function classifyAutomaticSource(
  io: Pick<ContextReadPort, "classifySource">,
  target: AutomaticSource,
  signal?: AbortSignal,
): Promise<AutomaticSourceAccess> {
  signal?.throwIfAborted();
  let home: string;
  try {
    const url = new URL(target.home);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid home");
    home = normalizeHomeUrl(target.home);
  } catch { return { kind: "unavailable", refused: "The source's authoritative home is unknown — not read from here." }; }
  if (!target.canvasId) return { kind: "unavailable", refused: "This card has no source canvas address." };
  if (target.source) {
    let address;
    try { address = parseCanvasAddress(target.source); } catch { address = null; }
    if (!address || address.canvasId !== target.canvasId) return { kind: "unavailable", refused: "This card's source address does not match its canvas." };
    if (normalizeHomeUrl(address.origin) !== home) return { kind: "unavailable", refused: `lives at ${address.origin} — not read from here` };
  }
  try {
    const answer = await io.classifySource({ canvasId: target.canvasId, expectedHome: home }, signal);
    signal?.throwIfAborted();
    if (answer.kind === "ordinary") return { kind: "ordinary", expectedHome: home };
    if (answer.kind === "personal") return { kind: "personal", refused: "Personal canvas — automatic previews and inheritance are private." };
    return { kind: "unavailable", refused: "The source's authoritative home could not classify it — not read from here." };
  } catch (error) {
    signal?.throwIfAborted();
    return { kind: "unavailable", refused: failure(error) };
  }
}

/** Ordinary inheritance alone can contribute a governing design; personal reads use their own route. */
export async function readInheritedCanvases(
  io: Pick<ContextReadPort, "classifySource" | "sourceSnapshot">,
  canvas: CanvasContents,
  home: string,
  signal?: AbortSignal,
): Promise<LinkedCanvas[]> {
  const linked: LinkedCanvas[] = [];
  for (const item of memoryLinks(canvas)) {
    signal?.throwIfAborted();
    const canvasId = canvasIdOf(item)!;
    const row = { item, canvasId, title: item.title, canvas: null };
    const access = await classifyAutomaticSource(io, { canvasId, home, source: sourceOf(item) }, signal);
    if (access.kind !== "ordinary") { linked.push({ ...row, refused: access.refused }); continue; }
    try {
      const snapshot = await io.sourceSnapshot({ canvasId, expectedHome: access.expectedHome }, signal);
      signal?.throwIfAborted();
      linked.push({ item, canvasId, title: snapshot.project.title, canvas: snapshot.canvas });
    } catch (error) {
      signal?.throwIfAborted();
      linked.push({ ...row, refused: failure(error) });
    }
  }
  return linked;
}

/** Authorized personal composition always names a selected actor; ambient callers explicitly exclude it. */
export interface LayeredContextOptions {
  canvasId: string;
  home: string;
  canvas: CanvasContents;
  personal: "exclude" | { actorId: string };
  extras?: ContextExtras;
  signal?: AbortSignal;
}

/** One current Context assembly for CLI/web/MCP, with private summaries appended after shared inheritance. */
export async function readLayeredContext(io: ContextReadPort, options: LayeredContextOptions): Promise<ContextLayer[]> {
  const { canvas, canvasId, home, signal } = options;
  signal?.throwIfAborted();
  let designProblems: number | undefined;
  let unavailable: string | undefined;
  const design = designSystem(canvas);
  const version = design?.versions.find((one) => one.id === design.currentVersionId);
  if (version && io.designText) {
    try {
      const text = await io.designText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      designProblems = checkDesign(parseDesign(text)).length;
    } catch (error) {
      signal?.throwIfAborted();
      unavailable = `Design system could not be read: ${failure(error)}`;
    }
  }
  const inherited = await readInheritedCanvases(io, canvas, home, signal);
  for (const link of inherited) {
    signal?.throwIfAborted();
    if (!link.canvas) continue;
    try {
      if (!io.sourceRecap) throw new Error("Recent work is unavailable from this connection.");
      const response = await io.sourceRecap({ canvasId: link.canvasId, expectedHome: normalizeHomeUrl(home) }, signal);
      signal?.throwIfAborted();
      let sourceHome: string | null = null;
      try {
        const parsed = new URL(response.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(response.home);
      } catch { /* An unknown home is not this source's authority. */ }
      if (response.canvasId !== link.canvasId || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Recent work returned a different source — not shown.");
      }
      link.recap = { value: response };
    } catch (error) {
      signal?.throwIfAborted();
      link.recap = { refused: failure(error) };
    }
  }
  const layers = contextLayers(canvas, inherited, { ...options.extras, ...(designProblems === undefined ? {} : { designProblems }) });
  if (unavailable) {
    const piece = layers[0]?.pieces.find((one) => one.name === "Design system");
    if (piece) piece.stale = unavailable;
  }
  if (options.personal === "exclude") return layers;
  const actorId = options.personal.actorId;
  if (!actorId) throw new Error("Personal Context requires an explicit claimed actor.");
  for (const item of personalMemoryLinks(canvas)) {
    signal?.throwIfAborted();
    const sourceCanvasId = canvasIdOf(item)!;
    try {
      const summary = await io.readPersonal(canvasId, { actorId, itemId: item.id, mode: "summary" }, signal);
      signal?.throwIfAborted();
      let sourceHome: string | null = null;
      try {
        const parsed = new URL(summary.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(summary.home);
      } catch { /* An unknown home cannot become a local success. */ }
      if (summary.kind !== "personal" || summary.mode !== "summary" || summary.itemId !== item.id || summary.sourceCanvasId !== sourceCanvasId || sourceHome === null || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Personal Context returned a different source — not shown.");
      }
      const heading = `${summary.owner.name}'s canvas`;
      layers.push({
        kind: "personal", itemId: item.id, canvasId: sourceCanvasId, owner: summary.owner, heading,
        pieces: summary.pieces.map((piece) => ({
          name: piece.kind === "design" ? "Design system" : piece.title,
          source: "canvas", present: !piece.unavailable,
          from: { canvasId: sourceCanvasId, title: heading },
          ...(piece.unavailable ? { stale: piece.unavailable } : {}),
        })),
      });
      if (summary.truncated) layers.at(-1)!.pieces.push({
        name: "More personal context", source: "canvas", present: false,
        stale: "This summary is truncated; use an explicit personal read for its current contributions.",
      });
    } catch (error) {
      signal?.throwIfAborted();
      layers.push({ kind: "personal", itemId: item.id, canvasId: sourceCanvasId, owner: null, heading: item.title, pieces: [], refused: failure(error) });
    }
  }
  return layers;
}
