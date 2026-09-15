import { afterEach, describe, expect, it } from "vitest";
import { designReviewPort, parseDesignReviewRun, prepareDesignReviewStart, prepareDesignReviewStep, readDesignReviews, submitDesignReviewWrite, type DesignReviewRun, type DesignReviewWritePort, type PreparedDesignReviewWrite } from "@isocan/api";
import { designReviewFixture } from "./design-review-fixture.ts";
let f: Awaited<ReturnType<typeof designReviewFixture>> | undefined;
afterEach(async () => { await f?.close(); f = undefined; });
const ids = (label: string) => ({ opId: `op_history_${label}`, versionId: `ver_history_${label}` });
const unavailableRecord = { outcome: "reviewed" as const, note: "Synthetic history test: browser unavailable; no inspection claimed.", observations: [], findings: [] };
const view = async (io: DesignReviewWritePort = f!.io) => (await readDesignReviews(io, { canvasId: f!.canvasId, runId: f!.start.runId })).runs[0]!;
async function send(prepared: PreparedDesignReviewWrite, io: DesignReviewWritePort = f!.io) { const result = await submitDesignReviewWrite(io, prepared); expect(result, JSON.stringify(result)).toMatchObject({ status: "accepted" }); return result; }
async function startAndRecord() {
  f = await designReviewFixture(); await send(await prepareDesignReviewStart(f.io, f.start));
  const row = await view(); await send(await prepareDesignReviewStep(f.io, { canvasId: f.canvasId, runId: row.run.id, base: row.ref, action: "record", record: unavailableRecord, ...ids("initial") })); return view();
}
async function appendOrdinary(report: unknown, label: string) {
  const row = await view(), text = JSON.stringify(report), blob = await f!.client.uploadBlob(f!.canvasId, Buffer.from(text), "application/json", "design-review.json");
  await f!.client.sendOp(f!.canvasId, f!.other.actor, { type: "item.edit", itemId: row.ref.itemId, expectedVersionId: row.ref.versionId, patch: {}, version: { id: ids(label).versionId, blobHash: blob.blobHash, size: blob.size, mimeType: "application/json", filename: "design-review.json" } });
}
async function consumeRepairs() {
  await startAndRecord();
  for (const n of [1, 2]) {
    let row = await view(); await send(await prepareDesignReviewStep(f!.io, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: `repair${n}`, sessionId: "synthetic-designer", ...ids(`reserve${n}`) }));
    row = await view(); await send(await prepareDesignReviewStep(f!.io, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "record", record: { ...unavailableRecord, outcome: n === 1 ? "invalid" : "noop" }, ...ids(`record${n}`) }));
  }
  expect((await view()).remainingRepairs).toBe(0);
}

describe("ordinary shared review history retains its meaning", () => {
  for (const [label, mutate] of [
    ["record", (run: DesignReviewRun) => { run.passes[0]!.record!.note = "Different author's replacement evidence"; }],
    ["cleared", (run: DesignReviewRun) => { run.passes[0]!.record = null; }],
    ["output", (run: DesignReviewRun) => { const output = run.passes[0]!.output; if (output.kind === "canvas") output.artifact.blobHash = "f".repeat(64); }],
    ["reservation", (run: DesignReviewRun) => { run.passes[0]!.reservedAt = new Date(Date.parse(run.passes[0]!.reservedAt) + 1000).toISOString(); }],
  ] as const) it(`refuses progression after an ordinary edit rewrites the historical ${label}`, async () => {
    const original = await startAndRecord(), originalRef = original.ref, changed = structuredClone(original.run); mutate(changed);
    if (label === "output") expect(() => parseDesignReviewRun(changed)).toThrow();
    else parseDesignReviewRun(changed);
    await appendOrdinary(changed, label);
    const row = await view(); expect(row.status).not.toBe("current"); expect(row.ready).toBe(false); expect(row.allowedActions.record).toBe(false); expect(row.allowedActions.beginRepair).toBe(false);
    if (label === "output") {
      expect(row.status).toBe("unavailable"); expect(row.author).toEqual(f!.agent.actor);
      expect((await readDesignReviews(f!.io, { canvasId: f!.canvasId, runId: row.run.id })).unavailable.some(one => one.itemId === originalRef.itemId)).toBe(true);
    } else expect(row.author).toEqual(f!.other.actor);
    expect(row.versions.find(v => v.ref.versionId === originalRef.versionId)?.author).toEqual(f!.agent.actor);
    const bytes = await f!.io.blobBytes(f!.canvasId, originalRef.blobHash); expect(parseDesignReviewRun(JSON.parse(new TextDecoder().decode(bytes)))).toEqual(original.run);
    await expect(prepareDesignReviewStep(f!.otherIO, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "record", record: unavailableRecord, ...ids(`retry_${label}`) })).rejects.toThrow();
  });

  it("serializes truly simultaneous reservations and attributes the one accepted actor without a private journal", async () => {
    const row = await startAndRecord();
    const [a, b] = await Promise.all([prepareDesignReviewStep(f!.io, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "repair_agent", sessionId: "synthetic-agent", ...ids("race_agent") }), prepareDesignReviewStep(f!.otherIO, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "repair_helper", sessionId: "synthetic-helper", ...ids("race_helper") })]);
    const results = await Promise.all([submitDesignReviewWrite(f!.io, a), submitDesignReviewWrite(f!.otherIO, b)]);
    expect(results.filter(r => r.status === "accepted")).toHaveLength(1); expect(results.filter(r => r.status === "refused")).toHaveLength(1);
    const fresh = await view(designReviewPort(f!.other)), winner = results[0]!.status === "accepted" ? f!.agent.actor : f!.other.actor;
    expect(fresh.remainingRepairs).toBe(1); expect(fresh.run.passes).toHaveLength(2); expect(fresh.passes[1]?.reservedBy).toEqual(winner); expect(fresh.passes[1]?.recordedBy).toBeNull();
  });

  it("preserves consumed attempts across Undo and actor switch, then reports unknown when archived report bytes are swept", async () => {
    await consumeRepairs(); await f!.client.undo(f!.canvasId, f!.agent.actor); await f!.client.undo(f!.canvasId, f!.agent.actor);
    const beforeGc = await view(designReviewPort(f!.other)); expect(beforeGc.remainingRepairs).toBe(0); expect(beforeGc.allowedActions.beginRepair).toBe(false);
    await f!.daemon.engine.gc(f!.canvasId, { keepOps: 0, graceMs: 0 });
    const fresh = designReviewPort(f!.other), row = await view(fresh);
    expect((await fresh.history(f!.canvasId)).some(entry => entry.envelope.id === ids("reserve2").opId)).toBe(true);
    expect(row.remainingRepairs).toBeNull(); expect(row.status).toBe("unavailable"); expect(row.allowedActions).toEqual({ record: false, beginRepair: false, finish: false, handoff: false });
    await expect(prepareDesignReviewStep(fresh, { canvasId: f!.canvasId, runId: row.run.id, base: row.ref, action: "begin-repair", passId: "third", sessionId: "fresh-helper", ...ids("third") })).rejects.toThrow();
  });

  it("does not infer a fresh counter when the archive is missing or fails to read", async () => {
    await consumeRepairs(); await f!.client.undo(f!.canvasId, f!.agent.actor); await f!.client.undo(f!.canvasId, f!.agent.actor); await f!.daemon.engine.gc(f!.canvasId, { keepOps: 0, graceMs: 0 });
    const incomplete = { ...designReviewPort(f!.other), history: (id: string) => f!.client.getLog(id, 0) };
    const result = await readDesignReviews(incomplete, { canvasId: f!.canvasId, runId: f!.start.runId }).then(value => ({ value }), error => ({ error }));
    if ("value" in result) { expect(result.value.unavailable.length + result.value.runs.filter(r => r.status === "unavailable").length).toBeGreaterThan(0); expect(result.value.runs.some(r => r.allowedActions.beginRepair || r.allowedActions.record)).toBe(false); }
    else expect(String(result.error)).toMatch(/history|unavailable|gap/i);
    await expect(prepareDesignReviewStart(incomplete, { ...f!.start, runId: "review_fresh", itemId: "itm_fresh", ...ids("fresh") })).rejects.toThrow();
    const failed = { ...designReviewPort(f!.other), history: async () => { throw new Error("Synthetic archived history is unavailable"); } };
    await expect(readDesignReviews(failed, { canvasId: f!.canvasId })).rejects.toThrow(/history is unavailable/);
  });

  it("keeps a malformed archived report unavailable instead of silently discarding its prior attempts", async () => {
    const original = await startAndRecord();
    const malformed = { ...original.run, passes: "not a pass history" };
    await appendOrdinary(malformed, "malformed");
    // A separate ordinary artifact owns the malformed bytes after the report version is undone and archived.
    await f!.agentCanvas.add({ title: "Acme recovery source", content: JSON.stringify(malformed), mime: "application/json" });
    await f!.client.undo(f!.canvasId, f!.other.actor); await f!.daemon.engine.gc(f!.canvasId, { keepOps: 0, graceMs: 0 });
    const row = await view(); expect(row.status).toBe("unavailable"); expect(row.allowedActions.beginRepair).toBe(false); expect(row.allowedActions.record).toBe(false);
    const result = await readDesignReviews(f!.otherIO, { canvasId: f!.canvasId }); expect(result.unavailable.some(r => r.itemId === original.ref.itemId)).toBe(true);
  });
  it("does not let a reused ordinary version ID erase an earlier accepted observation", async () => {
    const original = await startAndRecord(); await f!.client.undo(f!.canvasId, f!.agent.actor);
    const replacement = structuredClone(original.run); replacement.passes[0]!.record!.note = "Different observation under a reused version identity";
    await appendOrdinary(replacement, "initial");
    const rows = await f!.io.history(f!.canvasId); expect(rows.filter(entry => entry.envelope.op.type === "item.edit" && entry.envelope.op.version.id === original.ref.versionId)).toHaveLength(2);
    const row = await view(); expect(row.status).not.toBe("current"); expect(row.allowedActions.beginRepair).toBe(false); expect(row.allowedActions.record).toBe(false);
    expect(row.reasons.join(" ")).toMatch(/identity|history|rewrit|conflict/i);
  });

});
