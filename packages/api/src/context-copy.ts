import type { Actor, CanvasSnapshotResponse, GroupAction, PostOpResponse, SourceClassificationRequest, SourceClassificationResponse } from "@isocan/core";
import { atLeast, canvasIdOf, contextCopyAction, contextCopyPieces, groupCopySource, memoryLinks, newItemId, newOpId, newVersionId, normalizeHomeUrl, resolveGroupOperation, sourceOf } from "@isocan/core";
import { classifyAutomaticSource } from "./context-reader.ts";
import { transferCopyFaces } from "./copy-transfer.ts";

/** Browser and Node transports retain caller policy and cancellation on every actual request. */
export interface ContextCopyPort {
  destinationSnapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  classifySource(source: SourceClassificationRequest, signal?: AbortSignal): Promise<SourceClassificationResponse>;
  /** The actual snapshot must carry automatic exclusion and the asserted authoritative home. */
  sourceSnapshot(source: SourceClassificationRequest, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  /** Raw byte requests carry the same exclusion, expected home, and cancellation as snapshots. */
  sourceBlob(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
  uploadBlob(canvasId: string, bytes: Uint8Array, mimeType: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string }>;
  commitCopy(canvasId: string, actor: Actor, action: Extract<GroupAction, { kind: "copy" }>, opId: string, signal?: AbortSignal): Promise<PostOpResponse>;
}

/** A picker names a concrete visible inheritance edge and its current contributions. */
export interface ContextCopyChoices {
  linkId: string;
  source: { canvasId: string; home: string; title: string };
  pieces: Array<{ itemId: string; title: string; kind: "design" | "pin"; versionId: string | null; itemCount: number; refused?: string }>;
}

/** Listing and committing resolve only among this destination's visible inheritance links. */
export interface ContextCopyOptions {
  canvasId: string;
  home: string;
  sourceRef: string;
  signal?: AbortSignal;
}

/** The accepted native receipt identifies the independent local copy and its immediate source. */
export interface ContextCopyResult {
  source: ContextCopyChoices["source"];
  sourceItemId: string;
  itemId: string;
  itemIds: string[];
  receipt: PostOpResponse;
}

function select<T>(rows: T[], ref: string, exact: (row: T) => string[], titles: (row: T) => string[], noun: string): T {
  const precise = rows.filter((row) => exact(row).includes(ref));
  const needle = ref.trim().toLowerCase();
  const matches = precise.length ? precise : needle ? rows.filter((row) => [...exact(row), ...titles(row)].some((value) => value.toLowerCase().startsWith(needle))) : [];
  if (matches.length === 1) return matches[0]!;
  const candidates = (matches.length ? matches : rows).map((row) => `  ${exact(row).join(" / ")}  ${titles(row).join(" / ")}`).join("\n");
  throw new Error(`${matches.length ? "ambiguous" : "no visible"} ${noun} ${JSON.stringify(ref)}${candidates ? `; choose one of:\n${candidates}` : ""}`);
}

function destination(state: CanvasSnapshotResponse, canvasId: string): void {
  if (state.project.id !== canvasId) throw new Error("the destination returned a different canvas");
  if (state.project.groupMode !== "groups") throw new Error("canvas groups are not enabled on this legacy canvas; preview conversion with `isocan canvas group migrate --dry-run`, then apply it with `isocan canvas group migrate`.");
  if (!atLeast(state.capability ?? "edit", "edit")) throw new Error("copying a Context piece requires edit access to the destination canvas");
}

async function choices(io: ContextCopyPort, options: ContextCopyOptions, expectedLinkId?: string) {
  const { canvasId, signal } = options;
  signal?.throwIfAborted();
  const state = await io.destinationSnapshot(canvasId, signal);
  signal?.throwIfAborted(); destination(state, canvasId);
  const links = memoryLinks(state.canvas);
  const exactCard = links.find((item) => item.id === options.sourceRef);
  const exactSource = links.find((item) => canvasIdOf(item) === options.sourceRef);
  // Duplicate cards do not make a known source ambiguous. Bind the first
  // visible card now; later validation must never silently choose its twin.
  const needle = options.sourceRef.trim().toLowerCase();
  const candidates = links.filter((item) => needle && [item.id, canvasIdOf(item)!, item.title].some((text) => text.toLowerCase().startsWith(needle)));
  const sources = new Set(candidates.map((item) => canvasIdOf(item)));
  const link = exactCard ?? exactSource ?? (sources.size === 1 ? candidates[0]! : select(links, options.sourceRef, (item) => [item.id, canvasIdOf(item)!], (item) => [item.title], "inherited source"));
  if (expectedLinkId !== undefined && link.id !== expectedLinkId) throw new Error("the chosen inheritance link changed; choose the source again");
  const sourceCanvasId = canvasIdOf(link)!;
  const access = await classifyAutomaticSource(io, { canvasId: sourceCanvasId, home: options.home, source: sourceOf(link) }, signal);
  if (access.kind !== "ordinary") throw new Error(access.refused);
  const address = { canvasId: sourceCanvasId, expectedHome: access.expectedHome };
  const snapshot = await io.sourceSnapshot(address, signal);
  signal?.throwIfAborted();
  if (snapshot.project.id !== sourceCanvasId) throw new Error("the source returned a different canvas");
  if (!atLeast(snapshot.capability ?? "edit", "read")) throw new Error("copying a Context piece requires read access to its source canvas");
  const listing: ContextCopyChoices = { linkId: link.id, source: { canvasId: sourceCanvasId, home: access.expectedHome, title: snapshot.project.title }, pieces: contextCopyPieces(sourceCanvasId, snapshot.canvas) };
  return { state, snapshot, address, listing };
}

/** Read current eligible choices only after destination, edge, home and private classification checks. */
export async function listContextCopyPieces(io: ContextCopyPort, options: ContextCopyOptions): Promise<ContextCopyChoices> {
  return (await choices(io, options)).listing;
}

/** Transfer a fresh captured piece, recheck its exact edge, then submit one native copy-and-pin. */
export async function copyContextPiece(io: ContextCopyPort, options: ContextCopyOptions & {
  itemRef: string; actor: Actor; expectedLinkId?: string;
}): Promise<ContextCopyResult> {
  const actor = { ...options.actor };
  const { signal, canvasId } = options;
  const current = await choices(io, options, options.expectedLinkId);
  const { listing, snapshot, address } = current;
  const selected = select(listing.pieces, options.itemRef, (piece) => [piece.itemId], (piece) => [piece.title], "current Context piece");
  if (selected.refused) throw new Error(selected.refused);
  const source = groupCopySource(listing.source.canvasId, snapshot.canvas, [selected.itemId]);
  const action = contextCopyAction(source, canvasId, { home: listing.source.home, canvasTitle: listing.source.title }, { newItemId, newVersionId });
  const opId = newOpId();
  // Validate with the same resolver before any uploads; final placement still belongs to the writer.
  resolveGroupOperation(current.state, { type: "group.change", action }, { actor, opId, ts: new Date().toISOString() });
  await transferCopyFaces(source.items, {
    read: (hash, abort) => io.sourceBlob(address, hash, abort),
    upload: (bytes, mime, filename, abort) => io.uploadBlob(canvasId, bytes, mime, filename, abort),
  }, signal);
  const latest = await io.destinationSnapshot(canvasId, signal);
  signal?.throwIfAborted(); destination(latest, canvasId);
  const edge = memoryLinks(latest.canvas).find((item) => item.id === listing.linkId && canvasIdOf(item) === listing.source.canvasId);
  if (!edge) throw new Error("the inheritance link was removed or excluded while the copy was loading");
  const still = await classifyAutomaticSource(io, { canvasId: listing.source.canvasId, home: listing.source.home, source: sourceOf(edge) }, signal);
  if (still.kind !== "ordinary" || normalizeHomeUrl(still.expectedHome) !== listing.source.home) throw new Error(still.kind === "ordinary" ? "the source home changed while the copy was loading" : still.refused);
  signal?.throwIfAborted();
  const receipt = await io.commitCopy(canvasId, actor, action, opId, signal);
  return { source: listing.source, sourceItemId: selected.itemId, itemId: action.rootIds[0]!, itemIds: action.items.map((item) => item.id), receipt };
}
