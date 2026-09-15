import { isOpId } from "@isocan/core";
import { parseDesignRepairBasis, validatePreparedDesignRepair, type DesignRepairBasis, type DesignRepairSubmission, type PreparedDesignRepair } from "@isocan/api/design-repair";

/** A repair capture outlives editor polling; pending bytes and their owner never follow a newer draft. */
export interface DesignRepairDraft {
  schemaVersion: 1; canvasId: string; actorId: string; itemId: string;
  basis: DesignRepairBasis; editorBaseVersionId: string;
  pending: { prepared: PreparedDesignRepair; refused: boolean } | null;
  accepted: DesignRepairSubmission | null;
}

/** Actor and target scope are part of the durable key, including after source removal or Undo. */
export function designRepairDraftKey(canvasId: string, actorId: string, itemId: string): string {
  return `isocan.design.repair.v1:${JSON.stringify([canvasId, actorId, itemId])}`;
}

/** Validate every nested source and submission before a recovered draft can be used or rendered. */
export async function readDesignRepairDraft(raw: string, canvasId: string, actorId: string, itemId: string): Promise<DesignRepairDraft> {
  const value = JSON.parse(raw) as DesignRepairDraft;
  const object = (one: unknown): one is Record<string, unknown> => !!one && typeof one === "object" && !Array.isArray(one);
  if (!object(value) || value.schemaVersion !== 1 || value.canvasId !== canvasId || value.actorId !== actorId || value.itemId !== itemId || typeof value.editorBaseVersionId !== "string") throw new Error("The saved repair is malformed or belongs to another actor or target.");
  const basis = parseDesignRepairBasis(value.basis);
  if (basis.canvasId !== canvasId || basis.repair.target.artifact.itemId !== itemId) throw new Error("The saved repair capture names a different target.");
  let pending: DesignRepairDraft["pending"] = null;
  if (value.pending !== null) {
    if (!object(value.pending) || typeof value.pending.refused !== "boolean") throw new Error("The saved repair retry is malformed.");
    const prepared = await validatePreparedDesignRepair(value.pending.prepared);
    if (prepared.canvasId !== canvasId || prepared.actorId !== actorId || prepared.operation.repair.target.artifact.itemId !== itemId) throw new Error("The saved retry belongs to another repair owner.");
    const repair = prepared.operation.repair;
    const retryBasis = parseDesignRepairBasis({ canvasId, filename: prepared.filename, repair: { request: repair.request, review: repair.review, target: repair.target, governing: repair.governing, ruleVersion: repair.ruleVersion } });
    if (JSON.stringify(retryBasis) !== JSON.stringify(basis)) throw new Error("The saved retry disagrees with its displayed original capture.");
    pending = { prepared, refused: value.pending.refused };
  }
  const accepted = value.accepted;
  if (accepted !== null && (!object(accepted) || accepted.status !== "accepted" || !isOpId(accepted.submittedOpId) || accepted.opId !== null && !isOpId(accepted.opId) || accepted.itemId !== itemId || typeof accepted.versionId !== "string" || typeof accepted.blobHash !== "string")) throw new Error("The saved repair acknowledgement is malformed.");
  if (accepted?.consistency && (!["current", "stale", "unavailable"].includes(accepted.consistency.status) || !Array.isArray(accepted.consistency.reasons) || !accepted.consistency.reasons.every(reason => typeof reason === "string"))) throw new Error("The saved repair consistency is malformed.");
  if (pending && accepted) throw new Error("A repair cannot be both pending and accepted.");
  return { schemaVersion: 1, canvasId, actorId, itemId, basis, editorBaseVersionId: value.editorBaseVersionId, pending, accepted };
}

/** A failed persistence attempt blocks sending; changing memory alone cannot establish a retry journal. */
export function keepDesignRepairDraft(storage: Pick<Storage, "setItem">, key: string, draft: DesignRepairDraft): void {
  storage.setItem(key, JSON.stringify(draft));
}

/** Refused drafts are archived before an explicit new capture; uncertainty never allows this reset. */
export function archiveDesignRepairDraft(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, key: string, draft: DesignRepairDraft | null): void {
  if (draft?.pending && !draft.pending.refused) throw new Error("This repair is still awaiting confirmation. Retry its original intent before starting another repair.");
  const raw = storage.getItem(key);
  if (raw !== null) storage.setItem(`${key}:archive:${Date.now()}`, raw);
  storage.removeItem(key);
}
