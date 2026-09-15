import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { CanvasHandle, checkDesignCraft, checkDesignCraftDirectory, designDecisionPort, designRequestPort, exportDesignCraft, inspectDesignCraftPackage, parseDesignCraftPacket, publishDesignComparison, readDesignComparisons, readDesignCraft, readDesignRequestReference, submitDesignDecision } from "@isocan/api";
import { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { craftBytes, craftFile, craftHash, craftSemantic, craftContextFiles } from "../src/design-craft-packet.ts";
import { designReviewFixture } from "./design-review-fixture.ts";
import { designDecisionFixture } from "./design-decision-fixture.ts";
import { auditDesign } from "./design-audit-fixture.ts";
let fixture: { close(): Promise<void> } | undefined;
afterEach(async () => { await fixture?.close(); fixture = undefined; });
const text = (packet: Awaited<ReturnType<typeof readDesignCraft>>, name: string) => new TextDecoder().decode(craftBytes(packet.files.find(file => file.path === name)!));
const rehash = async (packet: Awaited<ReturnType<typeof readDesignCraft>>) => { const { packetId: _, ...body } = packet; return { ...body, packetId: await craftHash(craftSemantic(body)) }; };

it("returns identical canonical packets across actual actors, exports original bytes and preserves local proposals", async () => {
  const f = await designReviewFixture(); fixture = f;
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  const packet = await f.agentCanvas.designCraft(f.requestId, "new-work");
  expect(packet.status).toBe("current");
  expect(await readDesignCraft(designRequestPort(f.person), { canvasId: f.canvasId, requestId: f.requestId, stage: "new-work" })).toEqual(packet);
  expect(await f.otherCanvas.designCraft(f.requestId, "new-work")).toEqual(packet);
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq);
  expect(packet.questions).toEqual([]); expect(text(packet, "GUIDANCE.md")).toContain("dense operational tables");
  expect(text(packet, "DESIGN.md")).toBe(auditDesign());
  const out = path.join(f.work, "craft"); await exportDesignCraft(out, packet);
  await expect(exportDesignCraft(out, packet)).rejects.toThrow();
  expect(await checkDesignCraftDirectory(f.io, { canvasId: f.canvasId, requestId: f.requestId, directory: out })).toMatchObject({ status: "current" });
  await fs.appendFile(path.join(out, "PRODUCT.md"), "\nProposed narrower audience.\n");
  const before = await fs.readFile(path.join(out, "CRAFT.manifest.json"), "utf8");
  const checked = await checkDesignCraftDirectory(f.io, { canvasId: f.canvasId, requestId: f.requestId, directory: out });
  expect(checked.status).toBe("current"); expect(checked.files.find(file => file.path === "PRODUCT.md")?.status).toBe("modified");
  expect(await fs.readFile(path.join(out, "CRAFT.manifest.json"), "utf8")).toBe(before);
  const row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_craft_complete", action: { kind: "complete", brief: row.ref, epoch: row.brief.epoch, versionId: "ver_craft_complete" } })).status).toBe("accepted");
  expect(await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).toMatchObject({ status: "current" });
  await f.otherCanvas.edit(f.output.id, { content: "<main>A newer output</main>" });
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).status).toBe("stale");
});

it("keeps original field authors across another actor's completion but refuses a completion patch", async () => {
  const f = await designReviewFixture(); fixture = f;
  let row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.personCanvas.designChange({ opId: "op_craft_human_context", action: { kind: "update", brief: row.ref, epoch: 1, versionId: "ver_craft_human_context", patch: { audience: "Acme receiving operators" } } })).status).toBe("accepted");
  const packet = await f.agentCanvas.designCraft(f.requestId, "finish"); expect(packet.request.author).toEqual(f.person.actor);
  row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_craft_agent_complete", action: { kind: "complete", brief: row.ref, epoch: 1, versionId: "ver_craft_agent_complete" } })).status).toBe("accepted");
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).status).toBe("current");
  await f.client.undo(f.canvasId, f.agent.actor);
  expect((await f.agentCanvas.designChange({ opId: "op_craft_complete_patch", action: { kind: "complete", brief: row.ref, epoch: 1, versionId: "ver_craft_complete_patch", patch: { audience: "A changed audience" } } })).status).toBe("accepted");
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).status).toBe("stale");
});

it("validates the entire packet and cannot bless rehashed invented facts against canonical state", async () => {
  const f = await designReviewFixture(); fixture = f;
  const packet = await f.agentCanvas.designCraft(f.requestId, "critique");
  await expect(parseDesignCraftPacket({ ...packet, nativeExecuted: true })).rejects.toThrow();
  const bad = structuredClone(packet); bad.files[0]!.data = "eA==";
  await expect(parseDesignCraftPacket(await rehash(bad))).rejects.toThrow(/bytes|hash/);
  const nested = structuredClone(packet); (nested.request as any).trusted = true;
  await expect(parseDesignCraftPacket(await rehash(nested))).rejects.toThrow();
  const pathBad = structuredClone(packet); pathBad.files[0]!.path = "../outside";
  await expect(parseDesignCraftPacket(await rehash(pathBad))).rejects.toThrow();
  const forged = structuredClone(packet); forged.request.brief.audience = "Invented human preference";
  for (const [name, body] of Object.entries(craftContextFiles(forged))) forged.files[forged.files.findIndex(file => file.path === name)] = await craftFile(name, body, "text/markdown");
  const validShape = await parseDesignCraftPacket(await rehash(forged));
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet: validShape })).status).toBe("stale");
  await f.otherCanvas.edit(f.system.id, { content: auditDesign("Acme changed", "24px") });
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).status).toBe("stale");
});

it("keeps actual accepted rationale and reported versus questionnaire attribution without another interview", async () => {
  const f = await designDecisionFixture({ external: true }); fixture = f;
  const io = designDecisionPort(f.agent);
  expect((await publishDesignComparison(io, f.publication)).status).toBe("accepted");
  const view = (await readDesignComparisons(io, { canvasId: f.canvasId })).comparisons[0]!;
  const decision = f.decide(view, { kind: "external-report", externalRequestId: "native_acme_receiving", reportedOutcome: "choice", statement: "The native user selected confirmation per line.", reportedReason: "Immediate error recovery", rationale: "Prioritize error recovery over the original recommendation." });
  decision.decision.chosenAlternativeId = "each"; decision.decision.basis = view.approvalBases.find(one => one.alternativeId === "each")!.basis!;
  expect((await submitDesignDecision(io, decision)).status).toBe("accepted");
  const packet = await f.personCanvas.designCraft(f.comparison.requestId, "critique");
  expect(packet.decisions[0]).toMatchObject({ author: f.agent.actor, recommendationAuthor: f.agent.actor, input: { authority: { kind: "external-report", rationale: "Prioritize error recovery over the original recommendation." } } });
  expect(text(packet, "PRODUCT.md")).toContain('"kind": "reported"');
  expect(text(packet, "PRODUCT.md")).toContain("accepted choice each — Confirm each line");
  expect(text(packet, "PRODUCT.md")).toContain("Original recommendation (continuous)");
  expect(packet.questions).toEqual([]);
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  await f.otherCanvas.designCraft(f.comparison.requestId, "finish");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
});

it("retains settled questionnaire answers, skips and field provenance through explicit resume", async () => {
  const f = await designReviewFixture(); fixture = f;
  let row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  const questions = { ...f.questions, id: "qset_craft", requestId: f.requestId, brief: row.ref, discovery: { purpose: "initial" as const, factBindings: [{ questionId: "workflow", factId: "primaryTask" }, { questionId: "optional", factId: "audience" }] }, questions: [...f.questions.questions, { ...f.questions.questions[0]!, id: "optional", title: "Refine the audience?" }] };
  expect((await f.agentCanvas.designAsk({ opId: "op_craft_question", commentId: "cmt_craft_question", threadId: f.original.threadId, questions })).status).toBe("accepted");
  const source = (await f.personCanvas.designQuestions({ requestId: f.requestId }))[0]!.source;
  expect((await f.personCanvas.designAnswer({ opId: "op_craft_answer", commentId: "cmt_craft_answer", threadId: source.threadId, response: { schemaVersion: 1, kind: "response", id: "answer_craft", requestId: f.requestId, epoch: 1, question: source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["batch"] } }, { questionId: "optional", state: "skipped" }], supersedesResponseId: null } })).status).toBe("accepted");
  row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_craft_reconcile", action: { kind: "update", brief: row.ref, epoch: 1, versionId: "ver_craft_reconcile", patch: { primaryTask: "Review a receiving batch" }, acceptedResponses: row.reconciliation } })).status).toBe("accepted");
  const packet = await f.personCanvas.designCraft(f.requestId, "finish");
  expect(text(packet, "PRODUCT.md")).toContain('"kind": "questionnaire"');
  expect(packet.questions[0]!.responses[0]!.author).toEqual(f.person.actor);
  expect(packet.questions[0]!.responses[0]!.response.resolutions).toContainEqual({ questionId: "optional", state: "skipped" });
  row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect(row.remainingInitialQuestions).toBe(0);
  expect((await f.agentCanvas.designChange({ opId: "op_craft_resume", action: { kind: "resume", brief: row.ref, epoch: 1, versionId: "ver_craft_resume", reason: "Continue with another native entrance." } })).status).toBe("accepted");
  expect((await checkDesignCraft(f.io, { canvasId: f.canvasId, requestId: f.requestId, packet })).status).toBe("stale");
});

it("declared current output reads refuse unrelated, old, removed and foreign identities", async () => {
  const f = await designReviewFixture(); fixture = f;
  const requestId = "req_craft_output_only";
  expect((await f.agentCanvas.designStart({ opId: "op_craft_output_only", action: { kind: "start", requestId, itemId: "itm_craft_output_only", versionId: "ver_craft_output_only", source: { entrance: "external-agent", externalRequestId: "native_output_only" }, admission: "explicit", contextRequest: { rootIds: [] }, fields: { intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: "Operators", primaryTask: "Save a receipt", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [f.output.id] } } })).status).toBe("accepted");
  const io = designRequestPort(f.agent), old = f.artifact(f.output);
  expect(new TextDecoder().decode((await readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: old })).bytes)).toContain("Save receipt");
  const unrelated = await f.agentCanvas.add({ title: "Unrelated", content: "<main>Other</main>", mime: "text/html" });
  await expect(readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: f.artifact(unrelated) })).rejects.toThrow(/not an identified/);
  await expect(readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: { ...old, home: "https://unrelated.example" } })).rejects.toThrow(/not an identified/);
  await expect(readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: { ...old, blobHash: "0".repeat(64) } })).rejects.toThrow();
  await f.agentCanvas.edit(f.output.id, { content: "<main>Newer output</main>" });
  await expect(readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: old })).rejects.toThrow(/not an identified/);
  const now = (await f.client.snapshot(f.canvasId)).canvas.items[f.output.id]!; await f.agentCanvas.remove(f.output.id);
  await expect(readDesignRequestReference(io, { canvasId: f.canvasId, requestId, artifact: f.artifact(now) })).rejects.toThrow(/not an identified/);
});

it("distinguishes known absence from denied inherited authority and preserves its actual transport policy", async () => {
  const f = await designReviewFixture(true); fixture = f;
  await f.agentCanvas.remove(f.system.id);
  expect((await f.agentCanvas.designCraft(f.requestId, "new-work")).governing.status).toBe("none");
  const libraryId = newCanvasId(); await f.client.sendOp(null, f.agent.actor, { type: "project.create", canvasId: libraryId, title: "Acme craft library" });
  const library = new CanvasHandle(f.agent, (await f.client.snapshot(libraryId)).project);
  await library.add({ title: "Acme inherited system", content: auditDesign(), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
  await f.agentCanvas.add({ title: "Acme inherited link", content: f.base, mime: "text/plain", properties: { ...canvasItemOf(f.base, libraryId).properties, memory: "inherit" } });
  const policies: unknown[] = []; f.daemon.app.server.on("request", request => { if (request.url?.includes(`/api/projects/${libraryId}/`)) { const header = request.headers[SOURCE_POLICY_HEADER.toLowerCase()]; policies.push(typeof header === "string" ? parseSourcePolicyHeader(header) : null); } });
  const packet = await f.agentCanvas.designCraft(f.requestId, "new-work"); expect(packet.governing.status).toBe("available");
  expect(policies.length).toBeGreaterThan(0); for (const policy of policies) expect(policy).toMatchObject({ policy: { mode: "exclude" }, expectedHome: f.base });
  const denied = await readDesignCraft({ ...f.io, sourceBlobText: async () => { throw new Error("Synthetic source denied"); } }, { canvasId: f.canvasId, requestId: f.requestId, stage: "critique" });
  expect(denied).toMatchObject({ status: "unavailable", governing: { status: "unavailable" } });
  expect(denied.files.some(file => file.path === "DESIGN.md")).toBe(false);
});

it("inspects fixed bounded package sources without executing scripts and separates incomplete from drifted", async () => {
  const f = await designReviewFixture(); fixture = f;
  const folder = path.join(f.work, "skill");
  expect(await inspectDesignCraftPackage(folder)).toMatchObject({ status: "absent", native: "unsupported/not-run" });
  await fs.mkdir(folder);
  const empty = await inspectDesignCraftPackage(folder); expect(empty.status).toBe("incomplete"); expect(empty.files).toHaveLength(56);
  await fs.writeFile(path.join(folder, "SKILL.md"), "Tampered instructions that must never execute");
  expect(await inspectDesignCraftPackage(folder)).toMatchObject({ status: "drifted", native: "unsupported/not-run" });
  const packet = await f.agentCanvas.designCraft(f.requestId, "critique"); expect(packet.status).toBe("current");
});

it("exports two historical versions of a supplied reference after pruning without substituting current bytes", async () => {
  const f = await designReviewFixture(); fixture = f;
  const reference = await f.agentCanvas.add({ title: "Acme supplied sketch", content: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>First supplied sketch</text></svg>", mime: "image/svg+xml", filename: "sketch.svg" });
  const first = f.artifact(reference);
  await f.agentCanvas.edit(reference.id, { content: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Second supplied sketch</text></svg>" });
  const second = f.artifact((await f.client.snapshot(f.canvasId)).canvas.items[reference.id]!);
  const row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_craft_citations", action: { kind: "update", brief: row.ref, epoch: 1, versionId: "ver_craft_citations", patch: { references: [{ id: "first", state: "fetched", artifact: first }, { id: "second", state: "fetched", artifact: second }] } } })).status).toBe("accepted");
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "item.pruneVersions", itemId: reference.id, keep: 1 });
  await f.daemon.engine.gc(f.canvasId, { keepOps: 0, graceMs: 0 });
  const packet = await f.agentCanvas.designCraft(f.requestId, "critique");
  expect(packet.status, JSON.stringify({ reasons: packet.reasons, first, second, references: packet.references, retained: (await f.client.designRequests(f.canvasId)).requests.find(row => row.brief.requestId === f.requestId)?.marker.retainedReferences.map(ref => ref.artifact) })).toBe("current");
  const refs = packet.references.filter(one => one.artifact.itemId === reference.id); expect(refs).toHaveLength(2);
  expect(text(packet, refs.find(one => one.artifact.versionId === first.versionId)!.path!)).toContain("First supplied sketch");
  expect(text(packet, refs.find(one => one.artifact.versionId === second.versionId)!.path!)).toContain("Second supplied sketch");
});

it("carries an existing repository report without claiming this packet inspected or ran its delivery", async () => {
  const f = await designReviewFixture(true); fixture = f;
  let row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect((await f.agentCanvas.designChange({ opId: "op_craft_repo_complete", action: { kind: "complete", brief: row.ref, epoch: 1, versionId: "ver_craft_repo_complete" } })).status).toBe("accepted");
  row = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  const output = { kind: "repository" as const, repository: "acme/receiving", revision: "synthetic-commit", buildId: "synthetic-build", runtimeUrl: "http://127.0.0.1:4173/" };
  expect((await f.agentCanvas.designPublishReceipt({ opId: "op_craft_repo_receipt", itemId: "itm_craft_repo_receipt", versionId: "ver_craft_repo_receipt", receipt: { schemaVersion: 1, kind: "receipt", id: "receipt_craft_repo", requestId: f.requestId, epoch: 1, brief: row.ref, output, context: [], governing: row.governingBinding, fidelity: "designed", status: "draft", checks: [{ id: "craft", kind: "craft", tool: "Synthetic authored report", toolVersion: "1", result: "unavailable", coverage: "Repository inspection was not executed", state: "uninspected", viewport: null, evidence: [] }], unresolved: [] } })).status).toBe("accepted");
  const packet = await f.personCanvas.designCraft(f.requestId, "critique");
  expect(packet.runtimeReports).toMatchObject([{ receipt: { itemId: "itm_craft_repo_receipt", versionId: "ver_craft_repo_receipt" }, output, author: f.agent.actor, status: "current" }]);
  expect(text(packet, "PRODUCT.md")).toContain("acme/receiving");
  expect(text(packet, ".impeccable/surfaces/task.md")).toContain("This packet did not inspect or run the repository.");
});
