import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareDesignReviewHandoff, prepareDesignReviewStart, prepareDesignReviewStep, prepareDesignVerifierOffer, readDesignReviews, submitDesignReviewWrite, type DesignReviewWritePort, type DesignVerifierOffer, type PreparedDesignReviewWrite } from "@isocan/api";
import type { PostOpResponse } from "@isocan/core";
import { designReviewFixture } from "./design-review-fixture.ts";

let f: Awaited<ReturnType<typeof designReviewFixture>> | undefined;
const holds: { controller: AbortController; done: Promise<unknown> }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const hold of holds) hold.controller.abort();
  await Promise.all(holds.splice(0).map(hold => hold.done));
  await f?.close(); f = undefined;
});
const ids = (name: string) => ({ opId: `op_offer_${name}`, versionId: `ver_offer_${name}` });
const read = () => readDesignReviews(f!.io, { canvasId: f!.canvasId, runId: f!.start.runId });
async function send(prepared: PreparedDesignReviewWrite, io: DesignReviewWritePort = f!.io) {
  const result = await submitDesignReviewWrite(io, prepared);
  expect(result, JSON.stringify(result)).toMatchObject({ status: "accepted", opId: prepared.opId }); return result;
}
async function hold(listen: string[] = [f!.agent.actor.id]) {
  const controller = new AbortController();
  const done = f!.client.rcHold({ canvasId: f!.canvasId, actorIds: [f!.other.actor.id], waitMs: 60_000, owner: f!.person.actor, policies: { [f!.other.actor.id]: { owner: f!.person.actor, listen } } }, controller.signal).catch(() => undefined);
  const active = { controller, done }; holds.push(active);
  await vi.waitFor(async () => expect((await f!.client.rcAnswering(f!.canvasId)).actorIds).toContain(f!.other.actor.id));
  return active;
}
async function stopHold(active: Awaited<ReturnType<typeof hold>>) {
  active.controller.abort(); await active.done;
  await vi.waitFor(async () => expect((await f!.client.rcAnswering(f!.canvasId)).actorIds).not.toContain(f!.other.actor.id));
}
async function setup(external = false) {
  f = await designReviewFixture();
  if (external) {
    f.requestId = "req_acme_external_review";
    expect(await f.agentCanvas.designStart({ opId: "op_offer_external_admit", action: { kind: "start", requestId: f.requestId, itemId: "itm_offer_external_brief", versionId: "ver_offer_external_brief", admission: "explicit", source: { entrance: "external-agent", externalRequestId: "synthetic_external_turn" }, fields: { intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: f.output.id, groupId: null, audience: "Receiving staff", primaryTask: "Save a corrected receipt", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [f.output.id] } } })).toMatchObject({ status: "accepted" });
    f.start.requestId = f.requestId;
  }
  await send(await prepareDesignReviewStart(f.io, f.start));
  const session = await f.client.createSession(f.canvasId, f.other.actor, "Synthetic transport verifier", "acme", "cli");
  const run = (await read()).runs[0]!;
  // This declares only a synthetic transport fixture. No browser, craft inspection or provider runs here.
  const offer: DesignVerifierOffer = { schemaVersion: 1, kind: "verifier-offer", id: "offer_acme", requestId: f.requestId, runId: run.run.id, run: run.ref, output: run.run.passes[0]!.output, sessionId: session.sessionId, observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 240_000).toISOString(), delivery: "canvas", available: true, reason: "Synthetic transport eligibility fixture; no inspection performed.", tools: [{ name: "Synthetic browser transport declaration", version: "fixture-1" }] };
  const prepared = await prepareDesignVerifierOffer(f.otherIO, { canvasId: f.canvasId, itemId: "itm_offer_acme", ...ids("publish"), offer });
  await send(prepared, f.otherIO);
  const active = await hold();
  const row = (await read()).offers[0]!; expect(row.eligible, row.reasons.join(" ")).toBe(true);
  return { offer, row, run, session, active, prepared };
}
async function prepareHandoff(threadId = f!.original.threadId, name = "handoff") {
  const row = (await read()).offers[0]!;
  return prepareDesignReviewHandoff(f!.io, { canvasId: f!.canvasId, runId: f!.start.runId, offer: row.ref, threadId, commentId: `cmt_offer_${name}`, opId: ids(name).opId });
}
async function editOffer(offer: DesignVerifierOffer) {
  await f!.otherCanvas.edit("itm_offer_acme", { content: JSON.stringify(offer), mime: "application/json" });
}

describe("verifier declarations require actual transport eligibility", () => {
  for (const external of [false, true]) it(`sends one addressed ordinary ${external ? "new thread for an external request" : "source reply"} without recording an inspection`, async () => {
    const { run } = await setup(external), before = await f!.client.snapshot(f!.canvasId);
    const p = await prepareHandoff(external ? "thr_offer_external" : f!.original.threadId);
    expect(p.operation.type).toBe(external ? "thread.create" : "thread.reply");
    await send(p);
    const after = await f!.client.snapshot(f!.canvasId), next = (await read()).runs[0]!;
    expect(after.lastSeq).toBe(before.lastSeq + 1);
    if (p.operation.type !== "thread.reply" && p.operation.type !== "thread.create") throw new Error("Expected ordinary handoff comment");
    const operation = p.operation, comment = after.canvas.threads[operation.threadId]!.comments.find(c => c.id === operation.comment.id)!;
    expect(comment.author).toEqual(f!.agent.actor); expect(comment.mentions).toEqual([f!.other.actor.id]); expect(comment.body).toContain("This request is not a completed check.");
    expect(next.run.passes).toEqual(run.run.passes); expect(next.remainingRepairs).toBe(2); expect(next.run.passes[0]!.record).toBeNull();
  });

  it("refuses expired, future, unavailable, mismatched session, output and run declarations", async () => {
    const { offer } = await setup();
    const cases: [string, DesignVerifierOffer][] = [
      ["expired", { ...offer, observedAt: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() }],
      ["future", { ...offer, observedAt: new Date(Date.now() + 60_000).toISOString(), expiresAt: new Date(Date.now() + 120_000).toISOString() }],
      ["unavailable", { ...offer, available: false, reason: "Synthetic transport is unavailable" }],
      ["session", { ...offer, sessionId: "missing_synthetic_session" }],
      ["run", { ...offer, run: { ...offer.run, versionId: "ver_other_run" } }],
      ["output", { ...offer, output: { kind: "canvas", artifact: { ...f!.artifact(f!.output), versionId: "ver_other_output" } } }],
    ];
    for (const [name, value] of cases) {
      await editOffer(value); const row = (await read()).offers[0]!; expect(row.eligible, name).toBe(false);
      const before = (await f!.client.snapshot(f!.canvasId)).lastSeq;
      await expect(prepareHandoff(undefined, name)).rejects.toThrow(/authorized verifier/);
      expect((await f!.client.snapshot(f!.canvasId)).lastSeq).toBe(before);
    }
    await expect(prepareDesignVerifierOffer(f!.io, { canvasId: f!.canvasId, itemId: "itm_offer_wrong_actor", ...ids("wrong_actor"), offer })).rejects.toThrow(/live session/);
    for (const name of ["expired", "future"]) await expect(prepareDesignVerifierOffer(f!.otherIO, { canvasId: f!.canvasId, itemId: `itm_offer_${name}`, ...ids(name), offer: cases.find(c => c[0] === name)![1] })).rejects.toThrow(/Probe the actual tool/);
  });

  it("refuses a missing live session, absent rc, denied wake policy and removed offer", async () => {
    const { offer, session, active } = await setup();
    await stopHold(active); expect((await read()).offers[0]!.eligible).toBe(false); await expect(prepareHandoff()).rejects.toThrow();
    const denied = await hold([]); expect((await read()).offers[0]!.eligible).toBe(false); await expect(prepareHandoff()).rejects.toThrow(); await stopHold(denied);
    await hold(); await f!.client.endSession(f!.canvasId, session.sessionId);
    expect((await read()).offers[0]!.eligible).toBe(false); await expect(prepareHandoff()).rejects.toThrow();
    const next = await f!.client.createSession(f!.canvasId, f!.other.actor, "Synthetic resumed transport", "acme", "cli"); await editOffer({ ...offer, sessionId: next.sessionId });
    expect((await read()).offers[0]!.eligible).toBe(true);
    await f!.client.sendOp(f!.canvasId, f!.other.actor, { type: "item.delete", itemId: "itm_offer_acme" });
    expect((await read()).offers[0]!.eligible).toBe(false); await expect(prepareHandoff()).rejects.toThrow();
  });

  for (const change of ["wake", "run", "output"] as const) it(`revalidates a prepared handoff after ${change} changes before its first send`, async () => {
    const { active, run } = await setup(), p = await prepareHandoff();
    if (change === "wake") await stopHold(active);
    if (change === "run") await send(await prepareDesignReviewStep(f!.io, { canvasId: f!.canvasId, runId: run.run.id, base: run.ref, action: "record", record: { outcome: "reviewed", note: "Synthetic test: no native inspection available", observations: [], findings: [] }, ...ids("record") }));
    if (change === "output") await f!.otherCanvas.edit(f!.output.id, { content: "<main>Teammate changed the task</main>", mime: "text/html" });
    const before = (await f!.client.snapshot(f!.canvasId)).lastSeq, transport = vi.fn(f!.io.sendReview);
    expect(await submitDesignReviewWrite({ ...f!.io, sendReview: transport }, p)).toMatchObject({ status: "refused" }); expect(transport).not.toHaveBeenCalled();
    expect((await f!.client.snapshot(f!.canvasId)).lastSeq).toBe(before);
  });

  it("recovers the exact accepted request after offer expiry and Undo without sending or restoring it", async () => {
    await setup(); const p = await prepareHandoff(), accepted = await send(p);
    await f!.client.undo(f!.canvasId, f!.agent.actor); const before = await f!.client.snapshot(f!.canvasId);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 360_000);
    const transport = vi.fn(f!.io.sendReview), recovered = await submitDesignReviewWrite({ ...f!.io, sendReview: transport }, JSON.parse(JSON.stringify(p)), { retry: true });
    expect(recovered).toMatchObject({ status: "accepted", opId: accepted.opId, seq: accepted.seq }); expect(transport).not.toHaveBeenCalled();
    const after = await f!.client.snapshot(f!.canvasId); expect(after.lastSeq).toBe(before.lastSeq); expect(after.canvas.threads).toEqual(before.canvas.threads);
  });
});

describe("ordinary review receipts retain the immutable saved intent", () => {
  it("keeps acceptance when only the follow-up snapshot is unavailable", async () => {
    f = await designReviewFixture(); const p = await prepareDesignReviewStart(f.io, f.start); let saved = false;
    const result = await submitDesignReviewWrite({ ...f.io, snapshot: async (...args) => { if (saved) throw new Error("Synthetic post-save read unavailable"); return f!.io.snapshot(...args); }, sendReview: async (...args) => { const receipt = await f!.io.sendReview(...args); saved = true; return receipt; } }, p);
    expect(result).toMatchObject({ status: "accepted", opId: p.opId, consistency: { status: "unavailable" } });
    expect((await f.client.snapshot(f.canvasId)).canvas.items[f.start.itemId]?.currentVersionId).toBe(f.start.versionId);
  });

  for (const variant of ["extra-patch", "extra-version", "wrong-op-id"] as const) it(`does not confirm a normalized add receipt with ${variant}`, async () => {
    f = await designReviewFixture();
    expect((await f.client.snapshot(f.canvasId)).project.groupMode).toBe("groups");
    const p = await prepareDesignReviewStart(f.io, f.start); let real: PostOpResponse | undefined;
    await send(p, { ...f.io, sendReview: async (...args) => { const result = await f!.io.sendReview(...args); if (result.status === "accepted") real = result.receipt; return result; } });
    const unrelated = structuredClone(real!); const op = unrelated.envelope.op;
    if (op.type !== "group.change" || op.action.kind !== "apply") throw new Error("Expected actual writer-normalized grouped add");
    const created = op.action.change.writes.find(w => w.kind === "create"); if (!created || created.kind !== "create") throw new Error("Missing created report");
    if (variant === "extra-patch") op.action.change.writes.push({ kind: "patch", itemId: f.output.id, fields: { x: 123 } });
    if (variant === "extra-version") created.item.versions.push({ ...structuredClone(created.item.versions[0]!), id: "ver_offer_unrelated" });
    if (variant === "wrong-op-id") unrelated.envelope.id = "op_offer_somebody_else";
    // Deliberately faulty transport acknowledgement, never submitted to the actual canonical writer.
    const result = await submitDesignReviewWrite({ ...f.io, history: async () => [], sendReview: async () => ({ status: "accepted", receipt: unrelated }) }, p);
    expect(result).toMatchObject({ status: "pending", opId: null }); expect(result.reason).toMatch(/unrelated receipt/);
  });

  it("preserves another actor's journal and rejects unsupported operation fields before transport", async () => {
    f = await designReviewFixture(); const p = await prepareDesignReviewStart(f.io, f.start), original = JSON.stringify(p), transport = vi.fn(f.otherIO.sendReview);
    expect(await submitDesignReviewWrite({ ...f.otherIO, sendReview: transport }, p, { retry: true })).toMatchObject({ status: "pending", opId: null }); expect(transport).not.toHaveBeenCalled(); expect(JSON.stringify(p)).toBe(original);
    const malformed = structuredClone(p); Object.assign(malformed.operation, { unrelatedCommand: "silently discarded semantics" });
    const ownTransport = vi.fn(f.io.sendReview); await expect(submitDesignReviewWrite({ ...f.io, sendReview: ownTransport }, malformed)).rejects.toThrow(/Unsupported saved review operation field/); expect(ownTransport).not.toHaveBeenCalled();
  });
});
