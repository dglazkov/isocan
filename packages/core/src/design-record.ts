import type { ItemVersion, CanvasState } from "./model.ts";
import type { DesignArtifactRef } from "./design-partner.ts";
import type { Operation, OpEnvelope } from "./ops.ts";
import { OpValidationError } from "./errors.ts";

/** Retained versions cannot contain another admission marker or recursively embed earlier request metadata. */
type DesignRetainedVersion = Omit<ItemVersion, "designRecord">;
/** Exact permitted local bytes remain roots independently of the original item's version stack. */
export interface DesignRetainedReference { artifact: DesignArtifactRef; version: DesignRetainedVersion }
/** Admission indexes existing JSON and flat blob roots; it never duplicates the full brief or receipt. */
export interface DesignRecordMarker { schemaVersion: 1; kind: "brief" | "receipt"; requestId: string; epoch: number; opId: string; intentHash: string; retainedReferences: DesignRetainedReference[] }
/** Closed materialized effects preserve existing placement/group and undo semantics, without a generic batch. */
export type DesignRecordEffect = Extract<Operation, { type: "item.add" | "item.edit" }> | { type: "group.change"; action: { kind: "apply"; change: import("./canvas-group-types.ts").GroupChange } };
/** Removing the admission marker from a retained copy prevents nested copies from claiming live authority. */
export function retainedDesignVersion(version: ItemVersion): DesignRetainedVersion {
  const { designRecord: _marker, ...plain } = version;
  // Existing actor bindings may carry local lookup fields. Retained evidence
  // records the public original author, never a copy of harness/session data.
  return structuredClone({ ...plain, createdBy: { id: version.createdBy.id, name: version.createdBy.name } });
}
/** Canonical replay validates marker shape without rereading now-pruned source items. */
export function validateDesignRecordVersion(version: ItemVersion, canvasId: string): void {
  const marker = version.designRecord;
  if (marker === undefined) return;
  const fail = (): never => { throw new OpValidationError("bad-op", "invalid canonical design record metadata"); };
  const text = (value: unknown) => typeof value === "string" && value.length > 0;
  const keys = (value: unknown, allowed: string[]) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
  const identities = new Set<string>();
  if (!marker || Object.keys(marker).some((key) => !["schemaVersion", "kind", "requestId", "epoch", "opId", "intentHash", "retainedReferences"].includes(key)) || marker.schemaVersion !== 1 || !["brief", "receipt"].includes(marker.kind) || !text(marker.requestId) || !text(marker.opId) || !/^[a-f0-9]{64}$/.test(marker.intentHash) || !Number.isSafeInteger(marker.epoch) || marker.epoch < 1 || version.mimeType !== "application/json" || !Array.isArray(marker.retainedReferences) || marker.retainedReferences.length > 4096) fail();
  for (const row of marker.retainedReferences) {
    if (!keys(row, ["artifact", "version"]) || !keys(row.artifact, ["home", "canvasId", "itemId", "versionId", "blobHash"]) || !keys(row.version, ["id", "blobHash", "mimeType", "filename", "size", "visual", "createdAt", "createdBy"]) || !keys(row.version.createdBy, ["id", "name"]) || !text(row.version.createdBy.id) || !text(row.version.createdBy.name) || !text(row.version.createdAt) || row.artifact.canvasId !== canvasId || row.artifact.versionId !== row.version.id || row.artifact.blobHash !== row.version.blobHash || !/^[a-f0-9]{64}$/.test(row.version.blobHash) || !text(row.artifact.home) || !text(row.artifact.itemId) || !text(row.version.mimeType) || !text(row.version.filename) || !Number.isSafeInteger(row.version.size) || row.version.size < 0) fail();
    const identity = JSON.stringify([row.artifact.home, row.artifact.canvasId, row.artifact.itemId, row.artifact.versionId, row.artifact.blobHash]); if (identities.has(identity)) fail(); identities.add(identity);
    if (row.version.visual && (!keys(row.version.visual, ["blobHash", "mimeType", "filename", "size"]) || !/^[a-f0-9]{64}$/.test(row.version.visual.blobHash) || !text(row.version.visual.mimeType) || !text(row.version.visual.filename) || !Number.isSafeInteger(row.version.visual.size) || row.version.visual.size! < 0)) fail();
  }
}
/** Snapshot admission also validates versions in trash and canonical group effects. */
export function validateDesignRecordState(state: CanvasState): void {
  for (const thread of Object.values(state.canvas.threads)) for (const comment of thread.comments) {
    const versions = [...comment.context?.entries.flatMap((e) => e.version ? [e.version] : []) ?? [], ...comment.designReferences?.map((r) => r.version) ?? []];
    if (versions.some((v) => v.designRecord !== undefined)) throw new OpValidationError("bad-op", "retained comment context cannot contain nested design admission");
  }
  for (const item of [...Object.values(state.canvas.items), ...state.canvas.trash.map((row) => row.item)]) for (const version of item.versions) validateDesignRecordVersion(version, state.project.id);
}

/** Replay admits only the one declared record; group repair may adjust geometry but cannot hide other content acts. */
export function validateDesignRecordEffect(state: CanvasState, envelope: OpEnvelope): void {
  const op = envelope.op; if (op.type !== "design.request" && op.type !== "design.receipt") return;
  const fail = (): never => { throw new OpValidationError("bad-op", "design act disagrees with its canonical writer effect"); };
  const effect = op.effect; if (!effect) return fail();
  const update = op.type === "design.request" && op.action.kind !== "start";
  const itemId = op.type === "design.receipt" ? op.itemId : op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId;
  const versionId = op.type === "design.receipt" ? op.versionId : op.action.versionId;
  let version: import("./ops.ts").NewVersion | undefined;
  if (effect.type === "group.change") {
    const change = effect.action.change;
    if (update || change.intent !== "insert" || change.canvasId !== state.project.id || change.migration || change.cohorts || change.writes.some((w) => w.kind !== "create" && (w.kind !== "patch" || w.content))) return fail();
    const creates = change.writes.filter((w) => w.kind === "create");
    if (creates.length !== 1 || creates[0]!.item.id !== itemId || creates[0]!.item.versions.length !== 1 || creates[0]!.item.currentVersionId !== versionId) return fail();
    version = creates[0]!.item.versions[0];
  } else {
    if (effect.itemId !== itemId || effect.type !== (update ? "item.edit" : "item.add")) return fail();
    if (effect.type === "item.edit" && (Object.keys(effect.patch).length || op.type !== "design.request" || op.action.kind === "start" || effect.expectedVersionId !== op.action.brief.versionId)) return fail();
    version = effect.version;
  }
  const marker = version?.designRecord;
  const priorVersionId = op.type === "design.request" && op.action.kind !== "start" ? op.action.brief.versionId : undefined;
  const requestId = op.type === "design.receipt" ? op.receipt.requestId : op.action.kind === "start" ? op.action.requestId : state.canvas.items[itemId]?.versions.find((v) => v.id === priorVersionId)?.designRecord?.requestId;
  const epoch = op.type === "design.receipt" ? op.receipt.epoch : op.action.kind === "start" ? 1 : op.action.epoch + (op.action.kind === "resume" ? 1 : 0);
  if (!version || version.id !== versionId || !marker || marker.kind !== (op.type === "design.receipt" ? "receipt" : "brief") || marker.requestId !== requestId || marker.epoch !== epoch || marker.opId !== envelope.id) fail();
}
