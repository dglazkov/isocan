import { questionnaireFixture } from "./questionnaire-fixture.ts";
import { designSystemProperties } from "@isocan/core";
import { designReviewPort, type DesignReviewObligation } from "@isocan/api";
import { auditDesign } from "./design-audit-fixture.ts";

/** A real admitted synthetic task with ordinary evidence artifacts and no model, browser or external services. */
export async function designReviewFixture(repository = false) {
  const f = await questionnaireFixture();
  try {
    const system = await f.agentCanvas.add({ title: "Acme DESIGN.md", content: auditDesign(), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
    const output = await f.agentCanvas.add({ title: "Acme receiving", content: '<main style="padding:16px;color:#112233"><button>Save receipt</button></main>', mime: "text/html", filename: "receiving.html" });
    const requestId = "req_acme_review";
    const started = await f.agentCanvas.designStart({ opId: "op_acme_review_admit", action: { kind: "start", requestId, itemId: "itm_acme_review_brief", versionId: "ver_acme_review_brief", admission: "explicit", source: { entrance: "canvas-chat", threadId: f.original.threadId, commentId: f.original.commentId }, fields: { intent: "refine", fidelity: "designed", delivery: repository ? "connected-app" : "html-node", targetItemId: repository ? null : output.id, groupId: null, audience: "Receiving staff", primaryTask: "Save a corrected receipt", constraints: ["Phone and desktop"], facts: [], references: [], outstandingDecisionIds: [], outputIds: repository ? [] : [output.id] } } });
    if (started.status !== "accepted") throw new Error(JSON.stringify(started));
    const artifact = (item: typeof output) => ({ home: f.base, canvasId: f.canvasId, itemId: item.id, versionId: item.currentVersionId, blobHash: item.versions.find(v => v.id === item.currentVersionId)!.blobHash });
    const obligations: DesignReviewObligation[] = [{ id: "phone-save", kind: "browser-task", task: "Save a receipt and correct its quantity", state: "saved and corrected", viewport: { width: 390, height: 844 }, required: true }, { id: "craft", kind: "craft", task: "Review task hierarchy and error content", state: "all task states", viewport: null, required: true }];
    const start = { canvasId: f.canvasId, requestId, runId: "review_acme", itemId: "itm_acme_review_run", versionId: "ver_acme_review_run", opId: "op_acme_review_run", passId: "initial", sessionId: "synthetic-designer", output: repository ? { kind: "repository" as const, repository: "acme/local", revision: "synthetic-revision", buildId: "synthetic-build", runtimeUrl: "http://127.0.0.1:4173" } : { kind: "canvas" as const, artifact: artifact(output) }, obligations };
    return { ...f, requestId, system, output, artifact, obligations, start, io: designReviewPort(f.agent), otherIO: designReviewPort(f.other) };
  } catch (error) { await f.close(); throw error; }
}
