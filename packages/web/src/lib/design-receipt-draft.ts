import type { CanvasContents, DesignArtifactRef, DesignBrief, DesignReceipt } from "@isocan/core";
import type { DesignGoverningBinding } from "@isocan/core/design-request";
import { parseDesignArtifactRef } from "@isocan/core/design-partner";

/** Editable check details retain the exact evidence chosen when the observation was recorded. */
export interface DesignCheckDraft { id: string; kind: "source" | "browser-task" | "craft"; result: "passed" | "failed" | "unavailable"; coverage: string; state: string; tool: string; toolVersion: string; width: string; height: string; evidence: DesignArtifactRef[] }
/** Receipt drafts capture every version boundary before a check is entered; refresh never retargets evidence. */
export interface DesignReceiptDraft { schemaVersion: 2; brief: DesignArtifactRef; epoch: number; fidelity: DesignBrief["fidelity"]; delivery: DesignBrief["delivery"]; output: DesignArtifactRef | null; context: DesignArtifactRef[]; governing: DesignGoverningBinding | null; repository: string; revision: string; buildId: string; runtimeUrl: string; status: "draft" | "ready"; limits: string; critical: boolean; checks: DesignCheckDraft[] }
/** A new target starts with an honest unavailable browser observation, never inherited passing checks. */
export const emptyDesignCheck = (): DesignCheckDraft => ({ id: `check_${crypto.randomUUID()}`, kind: "browser-task", result: "unavailable", coverage: "Browser inspection was unavailable for this delivery.", state: "Not inspected", tool: "Unavailable browser", toolVersion: "unavailable", width: "", height: "", evidence: [] });
/** Reject old ID-only drafts and corrupt nested values rather than assigning them current versions. */
export function readDesignReceiptDraft(raw: string | null): DesignReceiptDraft | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.schemaVersion !== 2 || ["repository", "revision", "buildId", "runtimeUrl", "limits"].some((key) => typeof value[key] !== "string") || !["draft", "ready"].includes(value.status) || !["wireframe", "designed", "implementation"].includes(value.fidelity) || !["html-node", "connected-app", "wireframe", "exploration"].includes(value.delivery) || !Number.isSafeInteger(value.epoch) || value.epoch < 1 || typeof value.critical !== "boolean" || !Array.isArray(value.context) || !Array.isArray(value.checks) || !value.checks.length || value.checks.length > 32) return null;
    const governing = value.governing;
    if (governing !== null && (!governing || typeof governing.explicitNone !== "boolean" || governing.atItemId !== null && typeof governing.atItemId !== "string")) return null;
    return { ...value, brief: parseDesignArtifactRef(value.brief), output: value.output === null ? null : parseDesignArtifactRef(value.output), context: value.context.map(parseDesignArtifactRef), governing: governing === null ? null : { atItemId: governing.atItemId, explicitNone: governing.explicitNone, artifact: governing.artifact === null ? null : parseDesignArtifactRef(governing.artifact) }, checks: value.checks.map((check: unknown) => {
      if (!check || typeof check !== "object") throw new Error("Invalid check");
      const item = check as Record<string, unknown>;
      if (["id", "coverage", "state", "tool", "toolVersion", "width", "height"].some((key) => typeof item[key] !== "string") || !["source", "browser-task", "craft"].includes(String(item.kind)) || !["passed", "failed", "unavailable"].includes(String(item.result)) || !Array.isArray(item.evidence)) throw new Error("Invalid check");
      return { ...item, evidence: item.evidence.map(parseDesignArtifactRef) } as DesignCheckDraft;
    }) };
  } catch { return null; }
}
/** Output drift requires rechecking; historical evidence only fails when its exact selected version disappears. */
export function receiptDraftChangedItems(draft: DesignReceiptDraft, canvas: CanvasContents | null, canvasId: string): string[] {
  const refs = [...(draft.output ? [draft.output] : []), ...draft.checks.flatMap((check) => check.evidence)];
  return [...new Set(refs.filter((ref) => {
    if (ref.canvasId !== canvasId) return false;
    const item = canvas?.items[ref.itemId];
    return !item || ref === draft.output && item.currentVersionId !== ref.versionId || item.versions.find((one) => one.id === ref.versionId)?.blobHash !== ref.blobHash;
  }).map((ref) => ref.itemId))];
}
/** Serialization uses only captured identities; the live canvas is deliberately not an input. */
export function receiptFromDraft(draft: DesignReceiptDraft, requestId: string, id: string): DesignReceipt {
  if (!draft.governing || draft.delivery !== "connected-app" && !draft.output) throw new Error("Choose an available output before publishing evidence.");
  return { schemaVersion: 1, kind: "receipt", id, requestId, epoch: draft.epoch, brief: draft.brief,
    output: draft.delivery === "connected-app" ? { kind: "repository", repository: draft.repository, revision: draft.revision, buildId: draft.buildId, runtimeUrl: draft.runtimeUrl } : { kind: "canvas", artifact: draft.output! },
    context: draft.context, governing: draft.governing, fidelity: draft.fidelity, status: draft.status,
    checks: draft.checks.map((check) => ({ id: check.id, kind: check.kind, result: check.result, coverage: check.coverage, state: check.state, tool: check.tool, toolVersion: check.toolVersion, viewport: check.width && check.height ? { width: Number(check.width), height: Number(check.height) } : null, evidence: check.evidence })),
    unresolved: draft.limits.split("\n").filter((line) => line.trim()).map((description) => ({ severity: draft.critical ? "critical" : "noncritical", description })) };
}
