import { afterEach, expect, it } from "vitest";
import { ApiError, CanvasHandle, changeDesignRequest, designRequestPort, readDesignRequests, startDesignRequest } from "@isocan/api";
import { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import type { DesignBriefFields, DesignRequestAction } from "@isocan/core/design-request";
import type { DesignReceipt } from "@isocan/core/design-partner";
import { questionnaireFixture } from "./questionnaire-fixture.ts";
import { auditDesign } from "./design-audit-fixture.ts";

let fixture: Awaited<ReturnType<typeof questionnaireFixture>> | undefined;
afterEach(async () => { await fixture?.close(); fixture = undefined; });
const fields = (): DesignBriefFields => ({ intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: null, primaryTask: null, constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [] });
function start(f: Awaited<ReturnType<typeof questionnaireFixture>>, external = false): Extract<DesignRequestAction, { kind: "start" }> {
  return { kind: "start", requestId: "req_admitted_acme", itemId: "itm_admitted_acme", versionId: "ver_admitted_acme", source: external ? { entrance: "external-agent", externalRequestId: "external_acme_1" } : { entrance: "canvas-chat", threadId: f.original.threadId, commentId: f.original.commentId }, fields: fields(), admission: "explicit" };
}

it("admits the actual source, exposes missing facts, refuses automatic enrollment while off and ignores uploaded JSON", async () => {
  const f = fixture = await questionnaireFixture();
  expect(await f.agentCanvas.designBrief()).toMatchObject({ requests: [] });
  const action = start(f);
  expect(await f.agentCanvas.designStart({ opId: "op_auto_refused", action: { ...action, admission: "automatic" } })).toMatchObject({ status: "refused" });
  const before = await f.client.snapshot(f.canvasId);
  const accepted = await f.agentCanvas.designStart({ opId: "op_admitted_acme", action });
  expect(accepted).toMatchObject({ status: "accepted", opId: "op_admitted_acme", confirmedBy: "receipt" });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before.lastSeq + 1);
  const read = await f.otherCanvas.designWorkflow({ threadId: f.original.threadId, commentId: f.original.commentId });
  expect(read.policy).toBe("off");
  expect(read.procedure).toContain("zero to three");
  expect(read.requests).toMatchObject([{ nextAction: "clarify", missingFactIds: ["audience", "primaryTask"], remainingInitialQuestions: 3, brief: { requestingActorId: f.person.actor.id, source: action.source }, author: f.agent.actor }]);
  await expect(f.agentCanvas.edit(action.itemId, { content: JSON.stringify(f.brief) })).rejects.toThrow();
});

it("recovers lost acknowledgements only for the same intent and canonical actor, including a joined author's retry", async () => {
  const f = fixture = await questionnaireFixture(), action = start(f, true), io = designRequestPort(f.agent);
  const request = { canvasId: f.canvasId, opId: "op_lost_start", action };
  const accepted = await startDesignRequest({ ...io, send: async (...args) => {
    expect((await io.send(...args)).status).toBe("accepted");
    return { status: "pending", reason: "Synthetic lost acknowledgement." };
  } }, request);
  expect(accepted).toMatchObject({ status: "accepted", opId: request.opId, confirmedBy: "snapshot" });
  const changed = { ...request, action: { ...action, fields: { ...action.fields, audience: "A different task" } } };
  expect(await startDesignRequest({ ...io, send: async (...args) => {
    expect((await io.send(...args)).status).toBe("refused");
    return { status: "pending", reason: "The refusal acknowledgement was lost." };
  } }, changed)).toMatchObject({ status: "pending", opId: null });
  await f.client.claimActor({ type: "actor.claim", sessionKey: "acme:joined-designer", name: "Acme Joined Designer" });
  const actor = (await f.client.actorBindings(["acme:joined-designer"]))[0]!.actor;
  await f.client.sendOp(null, actor, { type: "actor.join", from: f.agent.actor.id, into: actor.id });
  const joined = new CanvasHandle({ ...f.agent, actor }, f.agentCanvas.record);
  expect(await joined.designStart({ opId: "op_new_retry_id", action })).toMatchObject({ status: "accepted", opId: request.opId, submittedOpId: "op_new_retry_id" });
  const read = await joined.designBrief({ requestId: action.requestId });
  expect(read.requests[0]!.brief.requestingActorId).toBe(f.agent.actor.id);
  expect(read.requests[0]!.author.id).toBe(f.agent.actor.id);
});

it("refuses mismatched receipts and keeps native supplied facts agent-reported across another entrance", async () => {
  const f = fixture = await questionnaireFixture();
  const action = start(f, true);
  action.fields = { ...fields(), audience: "Warehouse staff", primaryTask: "Receive stock" };
  expect((await f.agentCanvas.designStart({ opId: "op_native", action })).status).toBe("accepted");
  const read = (await f.personCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect(read.nextAction).toBe("build");
  expect(read.brief.continuation?.factProvenance).toEqual(expect.arrayContaining([{ field: "audience", actorId: f.agent.actor.id, kind: "reported" }, { field: "primaryTask", actorId: f.agent.actor.id, kind: "reported" }]));
  const io = designRequestPort(f.other), update = { canvasId: f.canvasId, opId: "op_false_update", action: { kind: "update" as const, brief: read.ref, epoch: read.brief.epoch, versionId: "ver_false_update", patch: { audience: "Dispatch staff" } } };
  const unrelated = await f.client.designRecord(f.canvasId, f.agent.actor, { type: "design.request", action }, "op_native");
  expect(await changeDesignRequest({ ...io, send: async () => ({ status: "accepted", receipt: unrelated }) }, update)).toMatchObject({ status: "pending", opId: null });
  expect((await f.otherCanvas.designBrief({ requestId: action.requestId })).requests[0]!.brief.audience).toBe("Warehouse staff");
});

it("preserves settled answer identity across reconciliation and explicit resume without a new initial allowance", async () => {
  const f = fixture = await questionnaireFixture(), action = start(f);
  expect((await f.agentCanvas.designStart({ opId: "op_question_request", action })).status).toBe("accepted");
  const initial = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  const questions = { ...f.questions, id: "qset_admitted_acme", requestId: action.requestId, brief: initial.ref, discovery: { purpose: "initial" as const, factBindings: [{ questionId: "workflow", factId: "primaryTask" }] } };
  expect((await f.agentCanvas.designAsk({ opId: "op_admitted_question", commentId: "cmt_admitted_question", threadId: f.original.threadId, questions })).status).toBe("accepted");
  const source = (await f.personCanvas.designQuestions({ requestId: action.requestId }))[0]!.source;
  expect((await f.personCanvas.designAnswer({ opId: "op_admitted_answer", commentId: "cmt_admitted_answer", threadId: source.threadId, response: { schemaVersion: 1, kind: "response", id: "answer_admitted_acme", requestId: action.requestId, epoch: 1, question: source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["batch"] } }], supersedesResponseId: null } })).status).toBe("accepted");
  const answered = (await f.otherCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  // The initial allowance is one batch, not a balance to spend on another interview.
  expect(answered).toMatchObject({ nextAction: "reconcile", remainingInitialQuestions: 0 });
  expect((await f.personCanvas.designAnswer({ opId: "op_corrected_answer", commentId: "cmt_corrected_answer", threadId: source.threadId, response: { schemaVersion: 1, kind: "response", id: "answer_corrected_acme", requestId: action.requestId, epoch: 1, question: source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["item"] } }], supersedesResponseId: "answer_admitted_acme" } })).status).toBe("accepted");
  expect((await f.otherCanvas.designChange({ opId: "op_ordinary_correction", action: { kind: "update", brief: answered.ref, epoch: 1, versionId: "ver_ordinary_correction", patch: { constraints: ["Large controls"] } } })).status).toBe("accepted");
  const corrected = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect(corrected.questions[0]!.status).toBe("stale");
  expect(corrected.nextAction).toBe("reconcile");
  expect(corrected.reconciliation).toEqual([{ question: source, responseId: "answer_corrected_acme" }]);
  const reconciliation = await f.otherCanvas.designChange({ opId: "op_reconcile", action: { kind: "update", brief: corrected.ref, epoch: 1, versionId: "ver_reconciled", patch: { primaryTask: "Receive stock with item review", audience: "Warehouse staff" }, acceptedResponses: corrected.reconciliation } });
  expect(reconciliation.status).toBe("accepted");
  const reconciled = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect(reconciled).toMatchObject({ nextAction: "build", reconciliation: [], remainingInitialQuestions: 0, brief: { continuation: { acceptedResponses: [{ responseId: "answer_corrected_acme" }] } } });
  expect((await f.agentCanvas.designChange({ opId: "op_resume", action: { kind: "resume", brief: reconciled.ref, epoch: 1, versionId: "ver_resumed", reason: "Continue the same receiving task through another agent." } })).status).toBe("accepted");
  expect((await f.personCanvas.designBrief({ requestId: action.requestId })).requests[0]).toMatchObject({ remainingInitialQuestions: 0, brief: { epoch: 2, primaryTask: "Receive stock with item review", continuation: { acceptedResponses: [{ responseId: "answer_corrected_acme" }] } } });
});

it("reads a completed receipt without confusing governing drift with reported browser failure", async () => {
  const f = fixture = await questionnaireFixture();
  const system = await f.agentCanvas.add({ title: "Acme DESIGN.md", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties() });
  const output = await f.agentCanvas.add({ title: "Acme receiving", content: "<main>Acme receiving fixture</main>", mime: "text/html" });
  const evidence = await f.agentCanvas.add({ title: "Synthetic task evidence", content: "Synthetic transcript: receiving and correction were exercised.", mime: "text/plain" });
  const artifact = (item: typeof output) => ({ home: f.base, canvasId: f.canvasId, itemId: item.id, versionId: item.currentVersionId, blobHash: item.versions.find(v => v.id === item.currentVersionId)!.blobHash });
  const action = start(f); action.fields = { ...fields(), audience: "Warehouse staff", primaryTask: "Receive stock", targetItemId: output.id };
  expect((await f.agentCanvas.designStart({ opId: "op_receipt_start", action })).status).toBe("accepted");
  const initial = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_complete", action: { kind: "complete", brief: initial.ref, epoch: 1, versionId: "ver_complete", patch: { outputIds: [output.id] } } })).status).toBe("accepted");
  const completed = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  const receipt: DesignReceipt = { schemaVersion: 1, kind: "receipt", requestId: action.requestId, epoch: 1, id: "receipt_acme", brief: completed.ref, output: { kind: "canvas", artifact: artifact(output) }, context: [], governing: { atItemId: output.id, artifact: artifact(system), explicitNone: false }, fidelity: "designed", status: "ready", checks: [{ id: "browser", kind: "browser-task", tool: "synthetic-transcript", toolVersion: "1", result: "passed", coverage: "Receiving and correction", state: "saved", viewport: { width: 390, height: 844 }, evidence: [artifact(evidence)] }, { id: "source", kind: "source", tool: "synthetic-source-audit", toolVersion: "1", result: "passed", coverage: "Control treatment", state: "source", viewport: null, evidence: [] }], unresolved: [] };
  expect((await f.agentCanvas.designPublishReceipt({ opId: "op_receipt", itemId: "itm_receipt", versionId: "ver_receipt", receipt })).status).toBe("accepted");
  expect((await f.agentCanvas.designReceipt({ outputItemId: output.id })).receipts[0]).toMatchObject({ status: "current", receipt: { status: "ready" }, runtimeFreshness: "not-applicable" });
  await f.otherCanvas.reply(f.original.threadId, "An unrelated progress note.");
  expect((await f.agentCanvas.designReceipt({ outputItemId: output.id })).receipts[0]!.status).toBe("current");
  await f.agentCanvas.edit(system.id, { content: auditDesign("Acme revised", "24px") });
  const stale = (await f.personCanvas.designReceipt({ outputItemId: output.id })).receipts[0]!;
  expect(stale.status).toBe("stale");
  expect(stale.receipt.checks.find(check => check.id === "browser")!.result).toBe("passed");
  expect(stale.checkFreshness.find(check => check.checkId === "browser")!.status).toBe("current");
  expect(stale.checkFreshness.find(check => check.checkId === "source")!.status).toBe("stale");
  const bytes = await f.agentCanvas.designRequestReference({ requestId: action.requestId, artifact: artifact(evidence) });
  expect(new TextDecoder().decode(bytes.bytes)).toContain("Synthetic transcript");
});

it("opens a live inherited governing reference before receipt publication and keeps historical evidence exact through source edits", async () => {
  const f = fixture = await questionnaireFixture(), libraryId = newCanvasId();
  await f.client.sendOp(null, f.person.actor, { type: "project.create", canvasId: libraryId, title: "Acme design library" });
  const library = new CanvasHandle(f.agent, (await f.client.snapshot(libraryId)).project);
  const system = await library.add({ title: "Acme inherited DESIGN.md", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties() });
  const evidence = await library.add({ title: "Acme synthetic browser transcript", content: "Synthetic receiving walkthrough version one.", mime: "text/plain" });
  const artifact = (item: typeof system) => ({ home: f.base, canvasId: libraryId, itemId: item.id, versionId: item.currentVersionId, blobHash: item.versions.find(one => one.id === item.currentVersionId)!.blobHash });
  const link = canvasItemOf(f.base, libraryId);
  await f.agentCanvas.add({ title: "Acme inherited library", content: f.base, mime: "text/plain", properties: { ...link.properties, memory: "inherit" } });
  const action = start(f, true); action.fields = { ...fields(), audience: "Warehouse staff", primaryTask: "Receive stock", references: [{ id: "ref_old_evidence", state: "fetched", artifact: artifact(evidence) }], facts: [{ id: "fact_receiving", name: "Receiving", value: "Historical task example", origin: "context", sources: [artifact(evidence)] }] };
  expect((await f.agentCanvas.designStart({ opId: "op_inherited_start", action })).status).toBe("accepted");
  const read = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect(read.governing).toMatchObject({ status: "available", inherited: true, artifact: artifact(system) });
  const reads: Array<{ url: string; policy: ReturnType<typeof parseSourcePolicyHeader> | null }> = [];
  f.daemon.app.server.on("request", req => { const header = req.headers[SOURCE_POLICY_HEADER.toLowerCase()]; reads.push({ url: req.url!, policy: typeof header === "string" ? parseSourcePolicyHeader(header) : null }); });
  const opened = await f.agentCanvas.designRequestReference({ requestId: action.requestId, artifact: artifact(system) });
  expect(new TextDecoder().decode(opened.bytes)).toBe(auditDesign());
  const sourceReads = reads.filter(one => one.url.includes(`/api/projects/${libraryId}/`));
  expect(sourceReads.some(one => one.url.endsWith(`/blobs/${artifact(system).blobHash}`))).toBe(true);
  for (const one of sourceReads) expect(one.policy).toEqual({ policy: { mode: "exclude" }, expectedHome: f.base });
  await library.edit(evidence.id, { content: "Synthetic receiving walkthrough version two." });
  reads.length = 0;
  expect((await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!.status).toBe("current");
  expect(reads.filter(one => one.url === `/api/projects/${libraryId}/canvas`)).toHaveLength(1);
  expect(reads.filter(one => one.url.endsWith(`/blobs/${artifact(evidence).blobHash}`))).toHaveLength(1);
  expect(new TextDecoder().decode((await f.agentCanvas.designRequestReference({ requestId: action.requestId, artifact: artifact(evidence) })).bytes)).toBe("Synthetic receiving walkthrough version one.");
  const io = designRequestPort(f.agent);
  let refusedReads = 0;
  const unavailable = await readDesignRequests({ ...io, sourceBlobBytes: async (source, hash, signal) => {
    if (hash === artifact(evidence).blobHash) { refusedReads++; throw new ApiError(403, "Synthetic permission refusal at the source-byte boundary"); }
    return io.sourceBlobBytes(source, hash, signal);
  } }, { canvasId: f.canvasId, filter: { requestId: action.requestId } });
  expect(refusedReads).toBe(1);
  expect(unavailable.requests[0]).toMatchObject({ status: "stale", nextAction: "resume", allowedActions: ["resume", "cancel"], brief: { references: action.fields.references, facts: action.fields.facts } });
  expect(unavailable.requests[0]!.reasons.join(" ")).toContain("Synthetic permission refusal");
  expect(unavailable.requests[0]!.marker.retainedReferences.some(one => one.artifact.canvasId === libraryId)).toBe(false);
  const privateSource = (await f.client.ensurePersonal(f.person.actor.id)).source!;
  const privateCard = canvasItemOf(f.base, privateSource.canvasId);
  await f.agentCanvas.add({ title: "Acme personal source", content: f.base, mime: "text/plain", properties: { ...privateCard.properties, memory: "inherit" } });
  reads.length = 0;
  const withPrivate = (await f.agentCanvas.designBrief({ requestId: action.requestId })).requests[0]!;
  expect(withPrivate.governing.refusedSources).toEqual(expect.arrayContaining([expect.objectContaining({ canvasId: privateSource.canvasId, reason: expect.stringContaining("Personal canvas") })]));
  expect(reads.filter(one => one.url.includes(`/api/projects/${privateSource.canvasId}/`))).toEqual([]);
});
