import { designScopeStanding, itemKind, normalizeHomeUrl, parseDesign, serializeDesign, resolveActor, type Actor, type CanvasSnapshotResponse, type Operation, type PostOpResponse, type SourceClassificationRequest } from "@isocan/core";
import { parseDesignArtifactRef, type DesignArtifactRef } from "@isocan/core/design-partner";
import { readDesignDirection, withDesignDirection, type DesignDirection } from "@isocan/core/design-direction";
import { sameDesignArtifact } from "@isocan/core/design-partner-plan";
import { readGoverningDesign, type GoverningDesignRead } from "./design-governing.ts";
import { readInheritedCanvases } from "./context-reader.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignAuditReadPort } from "./design-audit-reader.ts";

/** A serialized intended location, including a proposed screen before it has an item identity. */
export type DesignSystemTarget = { kind: "canvas" } | { kind: "item"; itemId: string } | { kind: "group"; groupId: string } | { kind: "point"; x: number; y: number };
/** Direct selection retains caller authority; automatic inheritance keeps its exclusion policy. */
export type DesignSystemSource = SourceClassificationRequest & { mode: "direct" | "inherited" };
/** Governing reads and edits keep inherited source authority on each actual transport operation. */
export interface DesignSystemPort extends DesignAuditReadPort {
  actorId: string;
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  home(canvasId: string, signal?: AbortSignal): Promise<string>;
  upload(source: DesignSystemSource, text: string, filename: string, mimeType: string, signal?: AbortSignal): Promise<{ blobHash: string; size: number }>;
  edit(source: DesignSystemSource, operation: Extract<Operation, { type: "item.edit" }>, opId: string, signal?: AbortSignal): Promise<PostOpResponse>;
}
type DesignSystemReadPort = Pick<DesignSystemPort, keyof DesignAuditReadPort | "snapshot" | "home">;
/** The original bytes and captured source metadata make a working file an identifiable projection. */
export interface DesignProjection {
  schemaVersion: 1;
  kind: "design-projection";
  source: DesignArtifactRef;
  destination: { canvasId: string; home: string; target: DesignSystemTarget };
  expectedMetadata: { title: string; properties: Record<string, string> };
  filename: string;
  mimeType: string;
  baseText: string;
  baseHash: string;
  exempt: boolean;
}
/** Authored stage and actual version authorship remain separate from guarded preference decisions. */
export interface DesignSystemRead { governing: GoverningDesignRead; direction: ReturnType<typeof readDesignDirection>; author: Actor | null; standing: { standing: "fine" | "owed" | "overdue"; screenCount: number; uncoveredIds: string[]; scopeId: string | null } | null }
/** A retry retains the original projection, content and both operation/version identities. */
export interface DesignReconcileRequest { projection: DesignProjection; text: string; opId: string; versionId: string; retry?: boolean; signal?: AbortSignal }
/** Accepted content survives a later unavailable or stale consistency read. */
export type DesignReconcileResult = {
  status: "accepted" | "pending" | "refused";
  source: DesignArtifactRef;
  submittedOpId: string;
  opId: string | null;
  reason?: string;
  savedProjection?: DesignProjection;
  consistency?: { status: "current" | "stale" | "unavailable"; reasons: string[]; governing?: GoverningDesignRead };
};

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const semantic = (value: unknown): string => {
  if (Array.isArray(value)) return "[" + value.map(semantic).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => JSON.stringify(key) + ":" + semantic(entry)).join(",") + "}";
  return JSON.stringify(value);
};
const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const sourceOf = (projection: DesignProjection): DesignSystemSource => ({ canvasId: projection.source.canvasId, expectedHome: normalizeHomeUrl(projection.source.home), mode: projection.source.canvasId === projection.destination.canvasId && normalizeHomeUrl(projection.source.home) === projection.destination.home ? "direct" : "inherited" });

/** Read the real governing document and direction at one explicit canvas location. */
export async function readDesignSystem(io: DesignSystemReadPort, options: { canvasId: string; target?: DesignSystemTarget; signal?: AbortSignal }): Promise<DesignSystemRead> {
  const [snapshot, home] = await Promise.all([io.snapshot(options.canvasId, options.signal), io.home(options.canvasId, options.signal)]);
  const target = options.target ?? { kind: "canvas" };
  const linked = await readInheritedCanvases(io, snapshot.canvas, home, options.signal);
  const scope = target.kind === "item" ? (snapshot.canvas.items[target.itemId] ? { at: snapshot.canvas.items[target.itemId]! } : null) : target.kind === "group" ? { groupId: target.groupId } : target.kind === "point" ? { at: { x: target.x, y: target.y } } : {};
  const governing = await readGoverningDesign(io, { canvasId: options.canvasId, canvas: snapshot.canvas, project: snapshot.project, home, linked, ...(target.kind === "item" ? { atId: target.itemId } : target.kind === "group" ? { groupId: target.groupId } : target.kind === "point" ? { point: { x: target.x, y: target.y } } : {}), ...(options.signal ? { signal: options.signal } : {}) });
  const count = scope && designScopeStanding(snapshot.canvas, Object.values(snapshot.canvas.items).filter(item => itemKind(item) === "screen"), snapshot.project, { ...scope, linked });
  const standing = count && count.selection.status !== "unavailable" ? { standing: count.standing, screenCount: count.screenCount, uncoveredIds: count.uncoveredIds, scopeId: count.scopeId } : null;
  return { governing, direction: governing.status === "available" ? readDesignDirection(governing.document) : { status: "absent" }, author: governing.status === "available" ? governing.author : null, standing };
}

/** Capture exact permitted bytes; export never creates a second canvas system or private-byte copy. */
export async function projectDesignSystem(io: DesignSystemReadPort, options: { canvasId: string; target?: DesignSystemTarget; signal?: AbortSignal }): Promise<DesignProjection> {
  const { governing } = await readDesignSystem(io, options);
  if (governing.status !== "available") throw new Error(governing.reason);
  if (await hash(governing.text) !== governing.artifact.blobHash) throw new Error("The governing document bytes disagree with their source identity.");
  return { schemaVersion: 1, kind: "design-projection", source: governing.artifact, destination: { canvasId: options.canvasId, home: await io.home(options.canvasId, options.signal), target: options.target ?? { kind: "canvas" } }, expectedMetadata: governing.metadata, filename: governing.version.filename, mimeType: governing.version.mimeType, baseText: governing.text, baseHash: governing.artifact.blobHash, exempt: governing.exempt };
}

/** A companion manifest is untrusted input: its base identity and bytes must agree before any save. */
export async function parseDesignProjection(value: unknown): Promise<DesignProjection> {
  const v = value as DesignProjection;
  const keys = (object: unknown, allowed: string[]) => !!object && typeof object === "object" && !Array.isArray(object) && Object.keys(object).every(key => allowed.includes(key));
  if (!keys(v, ["schemaVersion", "kind", "source", "destination", "expectedMetadata", "filename", "mimeType", "baseText", "baseHash", "exempt"]) || v.schemaVersion !== 1 || v.kind !== "design-projection" || typeof v.baseText !== "string" || new TextEncoder().encode(v.baseText).length > 1024 * 1024 || typeof v.exempt !== "boolean") throw new Error("Invalid design projection manifest.");
  const source = parseDesignArtifactRef(v.source);
  if (!keys(v.destination, ["canvasId", "home", "target"]) || typeof v.destination.canvasId !== "string" || !v.destination.canvasId || typeof v.destination.home !== "string") throw new Error("The projection needs its original destination.");
  try { const url = new URL(v.destination.home); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { throw new Error("The projection destination needs an authoritative HTTP home."); }
  const target = v.destination.target;
  if (!keys(target, ["kind", ...(target?.kind === "item" ? ["itemId"] : target?.kind === "group" ? ["groupId"] : target?.kind === "point" ? ["x", "y"] : [])]) || !["canvas", "item", "group", "point"].includes(target.kind) || target.kind === "item" && (typeof target.itemId !== "string" || !target.itemId) || target.kind === "group" && (typeof target.groupId !== "string" || !target.groupId) || target.kind === "point" && (!Number.isFinite(target.x) || !Number.isFinite(target.y))) throw new Error("Invalid projection target.");
  if (!keys(v.expectedMetadata, ["title", "properties"]) || typeof v.expectedMetadata.title !== "string" || !v.expectedMetadata.properties || typeof v.expectedMetadata.properties !== "object" || Array.isArray(v.expectedMetadata.properties) || Object.values(v.expectedMetadata.properties).some(value => typeof value !== "string") || typeof v.filename !== "string" || !v.filename || typeof v.mimeType !== "string" || !v.mimeType) throw new Error("The projection needs exact source metadata.");
  if (v.baseHash !== source.blobHash || await hash(v.baseText) !== v.baseHash) throw new Error("The projection's original bytes do not match its captured hash.");
  return { ...structuredClone(v), source, destination: { ...structuredClone(v.destination), home: normalizeHomeUrl(v.destination.home) } };
}

/** Validate authored bytes and captured identity before creating a durable pending intent; this performs no transport I/O. */
export async function prepareDesignReconciliation(request: DesignReconcileRequest): Promise<DesignReconcileRequest> {
  const projection = await parseDesignProjection(request.projection);
  if (!request.opId || !request.versionId || typeof request.text !== "string") throw new Error("Reconciliation needs stable operation/version IDs and authored text.");
  if (new TextEncoder().encode(request.text).length > 1024 * 1024) throw new Error("The replacement design exceeds the 1 MiB projection limit.");
  const document = parseDesign(request.text);
  if (document.problems.length) throw new Error(`The replacement design cannot be read: ${document.problems.join("; ")}`);
  return { ...request, projection };
}

/** Reconcile one prepared source edit, preserving uncertain intent and post-save consistency separately. */
export async function reconcileDesignProjection(io: DesignSystemPort, request: DesignReconcileRequest): Promise<DesignReconcileResult> {
  request = await prepareDesignReconciliation(request);
  const { projection, signal } = request;
  const blobHash = await hash(request.text), size = new TextEncoder().encode(request.text).byteLength;
  const source = { ...projection.source, versionId: request.versionId, blobHash };
  const result: DesignReconcileResult = { status: "pending", source, submittedOpId: request.opId, opId: null };
  const operation: Extract<Operation, { type: "item.edit" }> = { type: "item.edit", itemId: source.itemId, expectedVersionId: projection.source.versionId, expectedMetadata: projection.expectedMetadata, patch: {}, version: { id: request.versionId, blobHash, size, filename: projection.filename, mimeType: projection.mimeType } };
  const read = () => readDesignSystem(io, { canvasId: projection.destination.canvasId, target: projection.destination.target, ...(signal ? { signal } : {}) });
  const sourceSnapshot = async () => {
    const source = sourceOf(projection);
    if (source.mode === "inherited") return io.sourceSnapshot(source, signal);
    if (normalizeHomeUrl(await io.home(source.canvasId, signal)) !== source.expectedHome) throw new Error("The direct source authority changed.");
    return io.snapshot(source.canvasId, signal);
  };
  const preflight = async () => {
    const [current, origin] = await Promise.all([read(), sourceSnapshot()]);
    if (normalizeHomeUrl(await io.home(projection.destination.canvasId, signal)) !== projection.destination.home) throw new Error("The destination authority changed. Retain this working draft.");
    const selected = current.governing;
    if (selected.status !== "available") throw new Error(selected.reason);
    if (!sameDesignArtifact(selected.artifact, projection.source) || selected.exempt !== projection.exempt) throw new Error("The governing selection changed. Review the current document and retain this working draft.");
    const item = origin.canvas.items[source.itemId];
    if (!item || item.currentVersionId !== projection.source.versionId || semantic({ title: item.title, properties: item.properties }) !== semantic(projection.expectedMetadata)) throw new Error("The source version or metadata changed. Retain this working draft and reconcile against the current source.");
    const version = item.versions.find(one => one.id === projection.source.versionId);
    if (!version || version.filename !== projection.filename || version.mimeType !== projection.mimeType || version.blobHash !== projection.baseHash) throw new Error("The captured source metadata disagrees with its actual version.");
    return origin;
  };
  let origin: CanvasSnapshotResponse;
  try {
    signal?.throwIfAborted();
    origin = await sourceSnapshot();
    // A recorded proposed version permits retrying the original envelope; it is not itself acceptance proof.
    const version = origin.canvas.items[source.itemId]?.versions.find(one => one.id === request.versionId);
    if (!request.retry && !version) {
      await preflight();
      const uploaded = await io.upload(sourceOf(projection), request.text, projection.filename, projection.mimeType, signal);
      if (uploaded.blobHash !== blobHash || uploaded.size !== size) throw new Error("Uploaded bytes do not match the retained reconciliation intent.");
      origin = await preflight();
    }
  } catch (error) { signal?.throwIfAborted(); return { ...result, status: request.retry ? "pending" : "refused", reason: message(error) }; }
  let receipt: PostOpResponse;
  try { receipt = await io.edit(sourceOf(projection), operation, request.opId, signal); }
  catch (error) { return { ...result, status: questionnaireFailureStatus(error), reason: message(error) }; }
  const envelope = receipt.envelope;
  const sameAuthor = envelope?.actor && resolveActor(origin.joined ?? {}, envelope.actor.id) === resolveActor(origin.joined ?? {}, io.actorId);
  if (!envelope || envelope.canvasId !== source.canvasId || !sameAuthor || semantic(envelope.op) !== semantic(operation)) return { ...result, reason: "The returned operation did not confirm this exact source edit and author. Retain the prepared intent for reconciliation." };
  const savedProjection: DesignProjection = { ...projection, source, baseText: request.text, baseHash: blobHash };
  const accepted: DesignReconcileResult = { ...result, status: "accepted", opId: envelope.id, savedProjection };
  try {
    const { governing } = await read();
    if (governing.status !== "available") return { ...accepted, consistency: { status: "unavailable", reasons: [governing.reason], governing } };
    const reasons = sameDesignArtifact(governing.artifact, source) && governing.exempt === projection.exempt ? [] : ["The source edit was accepted, but its source or governing selection has since changed."];
    return { ...accepted, consistency: { status: reasons.length ? "stale" : "current", reasons, governing } };
  } catch (error) { return { ...accepted, consistency: { status: "unavailable", reasons: [message(error)] } }; }
}

/** Direction changes edit authored DESIGN.md through the same captured conditional reconciliation path. */
export async function writeDesignDirection(io: DesignSystemPort, request: Omit<DesignReconcileRequest, "text"> & { direction: DesignDirection }): Promise<DesignReconcileResult> {
  const projection = await parseDesignProjection(request.projection);
  const document = withDesignDirection(parseDesign(projection.baseText), request.direction);
  return reconcileDesignProjection(io, { ...request, projection, text: serializeDesign(document.tokens, document.body) });
}

export { readGoverningDesign } from "./design-governing.ts";
export type { GoverningDesignRead } from "./design-governing.ts";
