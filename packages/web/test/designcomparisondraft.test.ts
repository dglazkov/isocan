import { describe, expect, it } from "vitest";
import type { DesignComparisonView } from "@isocan/api/design-decision";
import { designComparisonDraftChanged, designComparisonDraftKey, newDesignComparisonDraft, readDesignComparisonDraft } from "../src/lib/design-comparison-draft.ts";

const ref = (id: string) => ({ home: "http://localhost:3000", canvasId: "prj_acme", itemId: `itm_${id}`, versionId: `ver_${id}`, blobHash: id.charAt(0).repeat(64) });
const brief = ref("brief"), a = ref("aaaa"), b = ref("bbbb"), target = ref("cccc");
const governing = { atItemId: target.itemId, artifact: null, explicitNone: false };
const comparison = { schemaVersion: 1 as const, kind: "comparison" as const, id: "cmp_acme", revision: 1, requestId: "req_acme", epoch: 1, brief, decisionKey: "receiving", audience: { kind: "human" as const, respondentActorId: "act_maya" }, mode: "comparison" as const, uncertainty: "structure" as const, scenario: "Receive the same delivery.", fidelity: "wireframe" as const, alternatives: [a, b].map((artifact, n) => ({ id: n ? "each" : "continuous", title: n ? "Confirm each line" : "Continuous receipt", hypothesis: "Try the receiving task.", tradeoff: "Speed versus confirmation.", artifact })), recommendedAlternativeId: "continuous", recommendation: "Reduce repeated confirmations.", target: { itemId: target.itemId, groupId: null }, governing, supersedes: null, correctsDecisionId: null, followsResponseId: null };
const source = { threadId: "thr_acme", commentId: "cmt_acme", payloadId: comparison.id, revision: 1 };
function row(): Pick<DesignComparisonView, "source" | "comparison" | "approvalBases"> {
  const basis = { brief, epoch: 1, alternatives: [a, b], target: { artifact: target, title: "Receiving", description: "Review before posting stock.", properties: { surface: "warehouse", language: "en" }, scope: { containerId: null, scopeIds: [] } }, governing };
  return structuredClone({ source, comparison, approvalBases: comparison.alternatives.map((one) => ({ alternativeId: one.id, basis })) });
}
const draft = () => newDesignComparisonDraft("prj_acme", "act_maya", row());
describe("comparison approval draft", () => {
  it("captures all options and target metadata before radio choice without retaining live objects", () => {
    const live = row(), saved = newDesignComparisonDraft("prj_acme", "act_maya", live);
    live.approvalBases[0]!.basis!.target.description = "A teammate changed only the description.";
    live.comparison.alternatives[1]!.artifact.versionId = "ver_rejected_new";
    expect(saved.bases[0]!.basis!.target.description).toBe("Review before posting stock.");
    expect(saved.bases[0]!.basis!.alternatives[1]!.versionId).toBe(b.versionId);
    expect(designComparisonDraftChanged(saved, live)).toBe(true);
  });
  it("detects metadata-only and rejected-option drift, while property key order is immaterial", () => {
    for (const edit of [(r: ReturnType<typeof row>) => { r.approvalBases[0]!.basis!.target.description = "Changed"; }, (r: ReturnType<typeof row>) => { r.approvalBases[1]!.basis!.alternatives[1]!.blobHash = "d".repeat(64); }, (r: ReturnType<typeof row>) => { r.approvalBases[0]!.basis!.target.scope.containerId = "itm_newgroup"; }]) {
      const next = row(); edit(next); expect(designComparisonDraftChanged(draft(), next)).toBe(true);
    }
    const reordered = row(); for (const one of reordered.approvalBases) one.basis!.target.properties = { language: "en", surface: "warehouse" };
    expect(designComparisonDraftChanged(draft(), reordered)).toBe(false);
  });
  it("round trips unfinished prose while rejecting another actor/canvas and nested corruption", () => {
    const saved = { ...draft(), reason: "Keep review close to scan.", choice: "continuous", instruction: "Still considering" };
    expect(readDesignComparisonDraft(JSON.stringify(saved), "prj_acme", "act_maya")).toEqual(saved);
    expect(() => readDesignComparisonDraft(JSON.stringify(saved), "prj_acme", "act_other")).toThrow();
    expect(() => readDesignComparisonDraft(JSON.stringify(saved), "prj_other", "act_maya")).toThrow();
    for (const bad of [{ bases: [null, null] }, { parts: [null] }, { bases: saved.bases.map((one) => ({ ...one, basis: { ...one.basis, target: null } })) }, { pending: { kind: "decide", request: null } }, { accepted: { opId: 99 } }]) expect(() => readDesignComparisonDraft(JSON.stringify({ ...saved, ...bad }), "prj_acme", "act_maya")).toThrow();
  });
  it("preserves a prepared retry's exact null reason and refuses a foreign source", () => {
    const saved = draft(); saved.pending = { kind: "decide", refused: false, request: { canvasId: "prj_acme", threadId: source.threadId, commentId: "cmt_decision", opId: "op_acme_decision", decision: { id: "dec_acme", requestId: comparison.requestId, decisionKey: comparison.decisionKey, source: { kind: "comparison", source }, basis: saved.bases[0]!.basis!, chosenAlternativeId: "continuous", versionId: "ver_adopted", supersedesDecisionId: null, authority: { kind: "human-choice", reason: null } } } };
    const restored = readDesignComparisonDraft(JSON.stringify(saved), "prj_acme", "act_maya");
    expect(restored.pending).toEqual(saved.pending);
    saved.pending.request.decision.source = { kind: "comparison", source: { ...source, commentId: "cmt_other" } };
    expect(() => readDesignComparisonDraft(JSON.stringify(saved), "prj_acme", "act_maya")).toThrow(/another comparison/);
    expect(designComparisonDraftKey("prj_acme", "act_maya", source)).not.toBe(designComparisonDraftKey("prj_acme", "act_other", source));
  });
});
