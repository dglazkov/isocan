import { afterEach, expect, it } from "vitest";
import { ApiError, designDecisionPort, publishDesignComparison, readDesignComparisons, submitDesignDecision, prepareDesignDecision } from "@isocan/api";
import { designDecisionFixture } from "./design-decision-fixture.ts";

let fixture: Awaited<ReturnType<typeof designDecisionFixture>> | undefined;
afterEach(async () => { await fixture?.close(); fixture = undefined; });
async function setup(options: Parameters<typeof designDecisionFixture>[0] = {}) {
  const f = fixture = await designDecisionFixture(options), io = designDecisionPort(f.agent);
  expect(await publishDesignComparison(io, f.publication)).toMatchObject({ status: "accepted" });
  const view = (await readDesignComparisons(io, { canvasId: f.canvasId })).comparisons[0]!;
  return { f, io, view };
}

it("adopts the captured option with one undo, exact retained reads and human words separate from recommendation", async () => {
  const { f, view } = await setup({ existing: true }), io = designDecisionPort(f.person), request = f.decide(view);
  const before = await f.client.snapshot(f.canvasId);
  expect(await submitDesignDecision(io, request)).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "current" } });
  const saved = (await f.personCanvas.designComparisons()).decisions[0]!;
  expect(saved).toMatchObject({ standing: "effective", author: f.person.actor, decision: { input: { authority: { kind: "human-choice", reason: null } }, recommendationAuthor: f.agent.actor } });
  const after = await f.client.snapshot(f.canvasId);
  expect(after.lastSeq).toBe(before.lastSeq + 1);
  expect(after.canvas.items[f.target!.id]!.versions.at(-1)!.filename).toBe("receiving.html");
  expect(after.canvas.items[f.request.ref.itemId]!.currentVersionId).toBe(f.request.ref.versionId);
  const exact = await f.otherCanvas.designComparisonReference({ source: view.source, optionId: "each" });
  expect(new TextDecoder().decode(exact.bytes)).toContain("Confirm line");
  await f.client.undo(f.canvasId, f.person.actor);
  expect((await f.client.snapshot(f.canvasId)).canvas.items[f.target!.id]!.currentVersionId).toBe(f.target!.currentVersionId);
  expect((await f.personCanvas.designComparisons()).decisions[0]!.standing).toBe("undone");
  await f.client.redo(f.canvasId, f.person.actor);
  expect((await f.otherCanvas.designWorkflow()).requests[0]!.effectiveDecisions[0]!.decision.input.id).toBe(request.decision.id);
});

it("validates an already captured draft and refuses target description drift without substituting current metadata", async () => {
  const { f, view } = await setup({ existing: true }), request = f.decide(view), before = JSON.stringify(request);
  await f.agentCanvas.groups.update(f.target!.id, { patch: { description: "Changed after the choice was reviewed" } });
  expect(prepareDesignDecision(request).decision.basis.target.description).toBe("Existing receiving screen");
  expect(await submitDesignDecision(designDecisionPort(f.person), request)).toMatchObject({ status: "refused" });
  expect(JSON.stringify(request)).toBe(before);
  expect(() => prepareDesignDecision({ ...request, decision: { ...request.decision, authority: { kind: "agent-judgment", rationale: "" } } })).toThrow();
});

it("preserves accepted identity after lost ack/read failure and distinguishes canonical conflict from uncertain access failure", async () => {
  const { f, view } = await setup(), io = designDecisionPort(f.person), request = f.decide(view);
  let accepted = false;
  const lost = await submitDesignDecision({ ...io, snapshot: async (...args) => { if (accepted) throw new ApiError(403, "Synthetic read denial"); return io.snapshot(...args); }, sendDecision: async (...args) => { const result = await io.sendDecision(...args); expect(result.status).toBe("accepted"); accepted = true; return { status: "pending", reason: "Synthetic lost acknowledgement" }; } }, request);
  expect(lost).toMatchObject({ status: "pending", opId: null });
  const retry = { ...request, retry: true }, before = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(await submitDesignDecision({ ...io, sendDecision: async () => ({ status: "refused", code: "forbidden", reason: "Access refused before receipt lookup" }) }, retry)).toMatchObject({ status: "pending" });
  expect(await submitDesignDecision({ ...io, snapshot: async () => { throw new ApiError(404, "Synthetic absent consistency read"); } }, retry)).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "unavailable" } });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
  const changed = { ...retry, decision: { ...retry.decision, authority: { kind: "human-choice" as const, reason: "A changed submission" } } };
  expect(await submitDesignDecision(io, changed)).toMatchObject({ status: "refused" });
  expect(await submitDesignDecision(designDecisionPort(f.other), retry)).toMatchObject({ status: "refused" });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
});

it("reports native choice without a canvas human answer and requires explicit takeover for a different reporter", async () => {
  const { f, view } = await setup({ external: true });
  const request = f.decide(view, { kind: "external-report", externalRequestId: "native_acme_receiving", reportedOutcome: "choice", statement: "The native conversation selected continuous receiving.", reportedReason: null, rationale: "Keep the requested batch review path." });
  expect(await submitDesignDecision(designDecisionPort(f.other), request)).toMatchObject({ status: "refused" });
  expect(await submitDesignDecision(designDecisionPort(f.agent), request)).toMatchObject({ status: "accepted" });
  const read = await f.personCanvas.designWorkflow();
  expect(read.requests[0]!.questions).toEqual([]);
  expect(read.requests[0]!.effectiveDecisions[0]).toMatchObject({ author: f.agent.actor, decision: { input: { authority: { kind: "external-report", reportedOutcome: "choice", reportedReason: null } } } });
});

it("rejects unrelated same-actor receipts and changed snapshot intents, and confirms a joined original author", async () => {
  const { f, io, view } = await setup({ external: true });
  const request = f.decide(view, { kind: "external-report", externalRequestId: "native_acme_receiving", reportedOutcome: "choice", statement: "The native user chose this option.", reportedReason: null, rationale: "Retain the batch review task." });
  const unrelated = await f.client.designDecision(f.canvasId, f.agent.actor, { type: "design.compare", threadId: f.publication.threadId, commentId: f.publication.commentId, comparison: f.comparison }, f.publication.opId);
  expect(await submitDesignDecision({ ...io, sendDecision: async () => ({ status: "accepted", receipt: unrelated }) }, request)).toMatchObject({ status: "pending", opId: null });
  expect(await submitDesignDecision(io, request)).toMatchObject({ status: "accepted" });
  const changed = { ...request, retry: true, decision: { ...request.decision, authority: { ...request.decision.authority, rationale: "Different authored judgment" } } };
  expect(await submitDesignDecision({ ...io, sendDecision: async () => ({ status: "pending", reason: "Uncertain mutated submission" }) }, changed)).toMatchObject({ status: "pending", opId: null });
  await f.client.claimActor({ type: "actor.claim", sessionKey: "acme:joined-decision", name: "Acme Joined Decision Author" });
  const actor = (await f.client.actorBindings(["acme:joined-decision"]))[0]!.actor;
  await f.client.sendOp(null, actor, { type: "actor.join", from: f.agent.actor.id, into: actor.id });
  expect(await submitDesignDecision(designDecisionPort({ ...f.agent, actor }), { ...request, opId: "op_acme_joined_retry", retry: true })).toMatchObject({ status: "accepted", opId: request.opId, submittedOpId: "op_acme_joined_retry" });
  expect((await f.personCanvas.designComparisons()).decisions[0]!.author).toEqual(f.agent.actor);
});

it("supports the precise direct path without publishing a comparison and opens its exact history", async () => {
  const f = fixture = await designDecisionFixture({ existing: true });
  const { designDecisionScope } = await import("@isocan/core/design-decision");
  const snapshot = await f.client.snapshot(f.canvasId), target = snapshot.canvas.items[f.target!.id]!;
  const proposal = { ...f.comparison, mode: "direct" as const, alternatives: [f.comparison.alternatives[0]!] };
  const request = prepareDesignDecision({ canvasId: f.canvasId, threadId: f.original.threadId, commentId: "cmt_acme_direct", opId: "op_acme_direct", decision: { id: "decision_acme_direct", requestId: f.comparison.requestId, decisionKey: "workflow", source: { kind: "direct", proposal }, basis: { brief: f.request.ref, epoch: 1, alternatives: proposal.alternatives.map(one => one.artifact), target: { artifact: f.artifact(target), title: target.title, description: target.description, properties: target.properties, scope: designDecisionScope(snapshot.canvas, target) }, governing: proposal.governing }, chosenAlternativeId: "continuous", versionId: "ver_acme_direct", supersedesDecisionId: null, authority: { kind: "agent-judgment", rationale: "This precise improvement uses the established receiving pattern." } } });
  expect(await submitDesignDecision(designDecisionPort(f.agent), request)).toMatchObject({ status: "accepted" });
  const read = await f.personCanvas.designComparisons();
  expect(read.comparisons).toEqual([]);
  expect(read.decisions[0]!.decision.input.authority.kind).toBe("agent-judgment");
  const bytes = await f.personCanvas.designComparisonReference({ source: read.decisions[0]!.source, optionId: "continuous" });
  expect(new TextDecoder().decode(bytes.bytes)).toContain("Review receipt");
});

it("allows an explicitly resumed native worker to publish and decide at the new epoch", async () => {
  const { f } = await setup({ external: true });
  expect(await f.otherCanvas.designChange({ opId: "op_acme_takeover", action: { kind: "resume", brief: f.request.ref, epoch: 1, versionId: "ver_acme_takeover", reason: "Continue the same native task after the original agent session ended." } })).toMatchObject({ status: "accepted" });
  const brief = (await f.otherCanvas.designBrief({ requestId: f.comparison.requestId })).requests[0]!;
  const comparison = { ...f.comparison, id: "cmp_acme_takeover", epoch: brief.brief.epoch, brief: brief.ref, audience: { kind: "external-agent" as const, externalRequestId: "native_acme_receiving", reporterActorId: f.other.actor.id } };
  expect(await f.otherCanvas.designCompare({ threadId: f.original.threadId, commentId: "cmt_acme_takeover", opId: "op_acme_takeover_compare", comparison })).toMatchObject({ status: "accepted" });
  const view = (await f.otherCanvas.designComparisons()).comparisons.find(one => one.comparison.id === comparison.id)!;
  expect(view.allowedActions.authorities).toEqual(["external-report"]);
  const request = f.decide(view, { kind: "external-report", externalRequestId: "native_acme_receiving", reportedOutcome: "choice", statement: "The continued native conversation selected continuous receiving.", reportedReason: null, rationale: "Continue the selected receiving task with the retained facts." });
  expect(await submitDesignDecision(designDecisionPort(f.other), request)).toMatchObject({ status: "accepted" });
  const state = (await f.personCanvas.designBrief({ requestId: f.comparison.requestId })).requests[0]!;
  expect(state.questions).toEqual([]);
  expect(state.effectiveDecisions[0]!.author).toEqual(f.other.actor);
  expect(state.brief.audience).toBe("Receiving staff");
});

it("carries source policy on inherited comparison reads and refuses fresh publication or choice after governing drift", async () => {
  const f = fixture = await designDecisionFixture({ existing: true });
  const { CanvasHandle, readGoverningDesign } = await import("@isocan/api");
  const { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } = await import("@isocan/core");
  const { auditDesign } = await import("./design-audit-fixture.ts");
  const libraryId = newCanvasId();
  await f.client.sendOp(null, f.person.actor, { type: "project.create", canvasId: libraryId, title: "Acme comparison library" });
  const library = new CanvasHandle(f.agent, (await f.client.snapshot(libraryId)).project);
  const system = await library.add({ title: "Acme DESIGN.md", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties() });
  await f.agentCanvas.add({ title: "Acme comparison source", content: f.base, mime: "text/plain", properties: { ...canvasItemOf(f.base, libraryId).properties, memory: "inherit" } });
  const io = designDecisionPort(f.agent), snapshot = await f.client.snapshot(f.canvasId);
  const governing = await readGoverningDesign(io, { canvasId: f.canvasId, home: f.base, canvas: snapshot.canvas, project: snapshot.project, atId: f.target!.id });
  expect(governing.status).toBe("available");
  const comparison = { ...f.comparison, governing: { atItemId: f.target!.id, artifact: governing.artifact, explicitNone: false } };
  const reads: Array<{ url: string; policy: unknown }> = [];
  f.daemon.app.server.on("request", req => { const header = req.headers[SOURCE_POLICY_HEADER.toLowerCase()]; if (req.url?.includes(`/api/projects/${libraryId}/`)) reads.push({ url: req.url, policy: typeof header === "string" ? parseSourcePolicyHeader(header) : null }); });
  expect(await publishDesignComparison(io, { ...f.publication, comparison })).toMatchObject({ status: "accepted" });
  const view = (await f.personCanvas.designComparisons()).comparisons[0]!;
  const intent = f.decide(view);
  expect(reads.some(one => one.url.endsWith(`/blobs/${governing.artifact!.blobHash}`))).toBe(true);
  for (const read of reads) expect(read.policy).toEqual({ policy: { mode: "exclude" }, expectedHome: f.base });
  await library.edit(system.id, { content: auditDesign() + "\nChanged spacing guidance.\n" });
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(await submitDesignDecision(designDecisionPort(f.person), intent)).toMatchObject({ status: "refused", reason: expect.stringContaining("governing design changed") });
  expect(await publishDesignComparison(io, { ...f.publication, opId: "op_acme_stale_compare", commentId: "cmt_acme_stale_compare", comparison: { ...comparison, id: "cmp_acme_stale" } })).toMatchObject({ status: "refused", reason: expect.stringContaining("governing design changed") });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
  expect((await f.personCanvas.designComparisons()).comparisons[0]).toMatchObject({ status: "stale", allowedActions: { respond: false, authorities: [] } });
});
