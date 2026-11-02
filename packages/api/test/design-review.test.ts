import { afterEach, expect, it } from "vitest";
import { prepareDesignReviewStart, prepareDesignReviewStep, readDesignReviews, submitDesignReviewWrite, prepareDesignReviewRepair, submitDesignRepair, parseDesignReviewRun, prepareDesignReviewCompletion, changeDesignRequest, designRequestPort, prepareDesignReviewReceipt, publishDesignReceipt, parseDesignVerifierOffer } from "@isocan/api";
import { designReviewFixture } from "./design-review-fixture.ts";
let f: Awaited<ReturnType<typeof designReviewFixture>> | undefined;
afterEach(async () => { await f?.close(); f = undefined; });
const ids = (id: string) => ({ opId: `op_review_${id}`, versionId: `ver_review_${id}` });
async function view() { return (await readDesignReviews(f!.io, { canvasId: f!.canvasId, runId: f!.start.runId })).runs[0]!; }
async function write(prepared: Awaited<ReturnType<typeof prepareDesignReviewStart>>) { const result = await submitDesignReviewWrite(prepared.actorId === f!.other.actor.id ? f!.otherIO : f!.io, prepared); expect(result, JSON.stringify(result)).toMatchObject({ status: "accepted" }); return result; }

it("reserves shared work, refuses competing reservations, consumes invalid/noop attempts and preserves the cap through Undo", async () => {
  f = await designReviewFixture();
  const prepared = await prepareDesignReviewStart(f.io, f.start); await write(prepared);
  let row = await view(); expect(row).toMatchObject({ remainingRepairs: 2, nextAction: "record", ready: false });
  const record = { outcome: "reviewed" as const, note: "Browser unavailable in this actor's native harness.", observations: [], findings: [] };
  await write(await prepareDesignReviewStep(f.otherIO, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record, ...ids("record") }));
  row = await view(); expect(row.passes[0]!.recordedBy).toEqual(f.other.actor);
  const a = await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "repair1", sessionId: "designer", ...ids("reserve1") });
  const b = await prepareDesignReviewStep(f.otherIO, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "competing", sessionId: "helper", ...ids("competing") });
  await write(a); expect(await submitDesignReviewWrite(f.otherIO, b)).toMatchObject({ status: "refused" });
  row = await view(); expect(row.remainingRepairs).toBe(1);
  await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { ...record, outcome: "invalid" }, ...ids("invalid") }));
  row = await view(); await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "repair2", sessionId: "designer", ...ids("reserve2") }));
  row = await view(); await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { ...record, outcome: "noop" }, ...ids("noop") }));
  row = await view(); expect(row).toMatchObject({ remainingRepairs: 0, nextAction: "finish", ready: false });
  await expect(prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "third", sessionId: "designer", ...ids("third") })).rejects.toThrow(/cannot reserve/);
  await f.client.undo(f.canvasId, f.agent.actor); await f.client.undo(f.canvasId, f.agent.actor);
  row = await view(); expect(row.remainingRepairs).toBe(0); expect(row.reasons.join(" ")).toMatch(/budget has not reset/);
  const admitted = (await f.agentCanvas.designBrief({ requestId: f.requestId })).requests[0]!;
  expect(await f.agentCanvas.designChange({ opId: "op_review_cancel", action: { kind: "cancel", brief: admitted.ref, epoch: admitted.brief.epoch, versionId: "ver_review_cancel" } })).toMatchObject({ status: "accepted" });
  expect((await f.agentCanvas.designWorkflow({ requestId: f.requestId })).requests[0]!.nextAction).toBe("resume");
});

it("records independent exact evidence, repairs one target, completes and reads its original run from a fresh client", async () => {
  f = await designReviewFixture(); await write(await prepareDesignReviewStart(f.io, f.start));
  let row = await view();
  await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { outcome: "reviewed", note: "Synthetic observed failure", observations: [], findings: [{ id: "broken-save", kind: "browser-task", severity: "critical", description: "Save did not produce a receipt.", rationale: "Primary task cannot complete." }] }, ...ids("failed") }));
  row = await view(); await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "repair", sessionId: "designer", ...ids("reserve") }));
  row = await view();
  const repair = await prepareDesignReviewRepair(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, text: '<main style="padding:16px;color:#112233"><button>Save corrected receipt</button></main>', repairId: "repair_acme", ...ids("content") });
  expect(await submitDesignRepair(f.io, repair)).toMatchObject({ status: "accepted" });
  const evidence = await f.agentCanvas.add({ title: "Synthetic native inspection", mime: "application/json", content: JSON.stringify({ action: "Saved receipt then corrected quantity", observed: "Saved correction visible", viewport: [390, 844] }) });
  const observations = f.obligations.map(o => ({ id: o.id, obligationId: o.id, tool: o.kind === "craft" ? "Synthetic craft reviewer" : "Synthetic native browser", toolVersion: "1", result: "passed" as const, action: o.task, expected: "Task and state hierarchy work", observed: "Exact synthetic expected state observed", evidence: [f!.artifact(evidence)] }));
  await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { outcome: "reviewed", note: "Authored synthetic transport proof, not model-quality evaluation.", observations, findings: [] }, ...ids("rechecked") }));
  row = await view(); expect(row.readings.task).toBe("passed"); expect(row.readings.craft).toBe("passed");
  const mismatchedSource = structuredClone(row.run), pass = mismatchedSource.passes.at(-1)!;
  if (pass.output.kind === "canvas") pass.output.artifact.blobHash = "f".repeat(64);
  expect(() => parseDesignReviewRun(mismatchedSource)).toThrow(/exact canvas output/);
  await write(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "finish", ...ids("finished") }));
  row = await view();
  const complete = await prepareDesignReviewCompletion(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, ...ids("complete") });
  expect(await changeDesignRequest(designRequestPort(f.agent), complete)).toMatchObject({ status: "accepted" });
  row = await view(); expect(row.status, row.reasons.join(" ")).toBe("current");
  const receipt = await prepareDesignReviewReceipt(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, itemId: "itm_review_receipt", receiptId: "receipt_review", ...ids("receipt") });
  expect(await publishDesignReceipt(designRequestPort(f.agent), receipt)).toMatchObject({ status: "accepted" });
  expect((await readDesignReviews(f.otherIO, { canvasId: f.canvasId, requestId: f.requestId })).runs[0]!.run.request).toEqual(row.run.request);
});

it("accepts a genuine repository-shaped run without fabricating an HTML repair target and closes schema fields", async () => {
  f = await designReviewFixture(true); const prepared = await prepareDesignReviewStart(f.io, f.start);
  const run = parseDesignReviewRun(JSON.parse(prepared.text!)); expect(run.basis.target).toBeNull(); expect(run.passes[0]!.output.kind).toBe("repository");
  expect(() => parseDesignReviewRun({ ...run, qualityAttested: true })).toThrow(/unsupported/);
  expect(() => parseDesignVerifierOffer({ schemaVersion: 1, kind: "verifier-offer", id: "offer", requestId: f!.requestId, runId: run.id, run: run.request.brief, output: run.passes[0]!.output, sessionId: "synthetic", observedAt: "2026-09-15T12:00:00Z", expiresAt: "2026-09-15T12:06:00Z", delivery: "repository", available: true, reason: "", tools: [{ name: "Browser", version: "1" }] })).toThrow(/five minutes/);
  await write(prepared); const row = await view();
  const output = row.run.passes[0]!.output; if (output.kind !== "repository") throw new Error("Expected repository output.");
  await expect(prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { outcome: "reviewed", note: "", observations: [], findings: [], output: { ...output, revision: "changed-before-initial-inspection" } }, ...ids("repository_changed") })).rejects.toThrow(/reserved runtime identity/);
  const recorded = await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { outcome: "reviewed", note: "Actual source parser on supplied synthetic repository bytes.", observations: [], findings: [], repositorySource: { text: "<main>Receiving</main>", path: "src/receiving.html" } }, ...ids("repository_record") });
  const parsed = parseDesignReviewRun(JSON.parse(recorded.text!)), source = parsed.passes[0]!.record!.source;
  if (source.kind !== "repository-audit") throw new Error("Expected repository audit.");
  source.revision = "unrelated-revision";
  expect(() => parseDesignReviewRun(parsed)).toThrow(/exact repository revision/);
});

it("isolates swept review history by its original creation scope, never mutable discovery properties", async () => {
  f = await designReviewFixture();
  const requestId = "req_acme_second_review";
  expect(await f.agentCanvas.designStart({ opId: "op_review_second_admit", action: { kind: "start", requestId, itemId: "itm_acme_second_brief", versionId: "ver_acme_second_brief", admission: "explicit", source: { entrance: "canvas-chat", threadId: f.original.threadId, commentId: f.original.commentId }, fields: { intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: f.output.id, groupId: null, audience: "Receiving staff", primaryTask: "Review a second independent task", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [f.output.id] } } })).toMatchObject({ status: "accepted" });
  const prepared = await prepareDesignReviewStart(f.io, f.start); await write(prepared);
  const item = (await f.io.snapshot(f.canvasId)).canvas.items[f.start.itemId]!;
  expect(item.properties).toMatchObject({ "design.review.request": f.requestId, "design.review.run": f.start.runId });
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "item.update", itemId: item.id, patch: { properties: { ...item.properties, "design.review.request": requestId } } });
  expect((await readDesignReviews(f.io, { canvasId: f.canvasId, requestId })).runs).toEqual([]);
  await f.client.undo(f.canvasId, f.agent.actor); await f.client.undo(f.canvasId, f.agent.actor);
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "trash.empty" });
  await f.daemon.engine.gc(f.canvasId, { keepOps: 0, graceMs: 0 });
  const old = await readDesignReviews(f.otherIO, { canvasId: f.canvasId, requestId: f.requestId });
  expect(old.unavailable.some(one => one.itemId === item.id)).toBe(true);
  await expect(prepareDesignReviewStart(f.io, { ...f.start, runId: "review_reset", itemId: "itm_review_reset", ...ids("reset") })).rejects.toThrow(/history is unavailable/);
  const fresh = await readDesignReviews(f.otherIO, { canvasId: f.canvasId, requestId }); expect(fresh.unavailable).toEqual([]);
  await expect(prepareDesignReviewStart(f.io, { ...f.start, requestId, runId: "review_second", itemId: "itm_review_second", ...ids("second") })).resolves.toMatchObject({ operation: { type: "item.add", properties: { "design.review.request": requestId } } });
  await f.agentCanvas.add({ title: "Unidentified legacy report", mime: "application/json", content: "{}", properties: { "design.review": "run-v1" } });
  await expect(prepareDesignReviewStart(f.io, { ...f.start, requestId, runId: "review_unknown", itemId: "itm_review_unknown", ...ids("unknown") })).rejects.toThrow(/history is unavailable/);
});
