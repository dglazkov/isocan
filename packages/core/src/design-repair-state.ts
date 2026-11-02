import type { LogEntry, OpEnvelope } from "./ops.ts";
import type { DesignArtifactRef } from "./design-partner.ts";
import type { DesignRepairInput, DesignRepairOperation } from "./design-repair.ts";
import { parseDesignRepairInput } from "./design-repair-parse.ts";
import { object, hash } from "./design-partner-values.ts";
import { sameDesignValue } from "./design-decision-state.ts";
import { validateDesignRetainedReferences } from "./design-retention.ts";
import { OpValidationError } from "./errors.ts";

/** A canonical repair edge remains attributed to its original act; history causes determine activity. */
export interface DesignRepairTransition { id: string; request: NonNullable<DesignRepairInput["request"]>; target: DesignRepairInput["target"]; adopted: DesignArtifactRef }
/** Replay validates the one exact edit and its flat evidence without resolving now-changed live policy. */
export function validateDesignRepairCanonical(envelope: OpEnvelope): void {
  const op = envelope.op; if (op.type !== "design.repair") return;
  const fail = (): never => { throw new OpValidationError("bad-op", "canonical repair differs from its captured intent"); };
  object(op, ["type", "repair", "effect", "canonical"]); const repair = parseDesignRepairInput(op.repair), effect = op.effect, canonical = op.canonical;
  if (!effect || !canonical || envelope.canvasId !== repair.target.artifact.canvasId) return fail();
  object(canonical, ["intentHash", "retainedReferences"]); hash(canonical.intentHash);
  object(effect, ["type", "itemId", "expectedVersionId", "expectedMetadata", "patch", "version"]);
  const ref = repair.target.artifact, required = [ref, ...(repair.request ? [repair.request.brief] : []), ...(repair.review ? [repair.review.run] : []), ...(repair.governing.artifact ? [repair.governing.artifact] : [])].filter((r) => r.home === ref.home && r.canvasId === ref.canvasId);
  validateDesignRetainedReferences(canonical.retainedReferences, ref.canvasId, required, 4096);
  const before = canonical.retainedReferences.find((r) => sameDesignValue(r.artifact, ref))!.version;
  if (before.mimeType !== "text/html" || effect.type !== "item.edit" || effect.itemId !== ref.itemId || effect.expectedVersionId !== ref.versionId || !sameDesignValue(effect.expectedMetadata, { title: repair.target.title, properties: repair.target.properties }) || !sameDesignValue(effect.patch, {}) || !sameDesignValue(effect.version, { ...repair.version, mimeType: "text/html", filename: before.filename })) fail();
}
/** Original acceptance is active unless the latest recorded Undo/Redo cause disables it; hashes alone never restore authority. */
export function activeDesignRepairEntries(history: readonly LogEntry[]): LogEntry[] {
  const causes = new Map<number, LogEntry>();
  for (const row of history) if (row.cause && (!causes.has(row.cause.targetSeq) || causes.get(row.cause.targetSeq)!.seq < row.seq)) causes.set(row.cause.targetSeq, row);
  return history.filter((row) => row.envelope.op.type === "design.repair" && !row.cause && causes.get(row.seq)?.cause?.kind !== "undo");
}
/** Current request context combines these accepted repair edges with live adoption edges, without recapturing its original input. */
export function designRepairTransitions(history: readonly LogEntry[]): DesignRepairTransition[] {
  return activeDesignRepairEntries(history).flatMap((row) => {
    validateDesignRepairCanonical(row.envelope);
    const op = row.envelope.op as DesignRepairOperation, r = op.repair;
    return r.request ? [{ id: row.envelope.id, request: r.request, target: r.target, adopted: { ...r.target.artifact, versionId: r.version.id, blobHash: r.version.blobHash } }] : [];
  });
}
