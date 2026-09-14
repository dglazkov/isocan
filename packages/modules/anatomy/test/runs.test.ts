import { describe, expect, it } from "vitest";
import { importProject } from "../src/operations.ts";
import { dispatchRun, listRuns, readRun, requestAnalysis, resolveAnalysisTarget, retryRun, updateRun } from "../src/runs.ts";
import { PROP } from "../src/core.ts";
import { sampleProject } from "./fixture.ts";
import { memory } from "./memory.ts";
const actor = { id: "usr_test", name: "Test writer" };
const other = { id: "usr_other", name: "Other writer" };
async function fixture() { const m = memory(); const id = await importProject(m.io, sampleProject()); return { ...m, id }; }

describe("analysis targets and native request lifecycle", () => {
  it("resolves attached, explicit, sole, ambiguous, stale and create targets consistently", async () => {
    const m = await fixture();
    expect((await resolveAnalysisTarget(m.io)).analysisId).toBe(m.id);
    const b = await importProject(m.io, { ...sampleProject(), projectName: "Second analysis" });
    expect(m.project().properties[PROP.analysis]).toBe(m.id);
    expect((await resolveAnalysisTarget(m.io, { analysis: b })).analysisId).toBe(b);
    await m.io.send([{ type: "project.update", patch: { properties: { [PROP.analysis]: "" } } }]);
    await expect(resolveAnalysisTarget(m.io)).rejects.toThrow("Several analyses");
    await m.io.send([{ type: "project.update", patch: { properties: { [PROP.analysis]: "missing" } } }]);
    await expect(resolveAnalysisTarget(m.io)).rejects.toThrow("missing or ambiguous");
    expect((await resolveAnalysisTarget(m.io, { create: true })).analysisId).toBeNull();
    await expect(resolveAnalysisTarget(m.io, { create: true, analysis: b })).rejects.toThrow("not both");
  });
  it("refuses repository mismatch before mutation and never silently reattaches or rewrites repository", async () => {
    const m = await fixture();
    const b = await importProject(m.io, { ...sampleProject(), repoPath: "/example/other" });
    const before = JSON.stringify(m.canvas());
    await expect(requestAnalysis(m.io, { analysis: b })).rejects.toThrow("Repository mismatch");
    expect(JSON.stringify(m.canvas())).toBe(before);
    const receipt = await requestAnalysis(m.io, { repository: "/example/other", analysis: b });
    expect(receipt.run.analysisId).toBe(b);
    expect(m.project().properties).toMatchObject({ [PROP.analysis]: m.id, [PROP.repository]: "/example/acme" });
  });
  it("deduplicates repeated and concurrent requests and posts exactly one native comment", async () => {
    const m = await fixture();
    const results = await Promise.all([requestAnalysis(m.io), requestAnalysis(m.io)]);
    expect(results[0]!.id).toBe(results[1]!.id);
    expect((await requestAnalysis(m.io)).id).toBe(results[0]!.id);
    expect(await listRuns(m.io)).toHaveLength(1);
    expect(Object.values(m.canvas().threads).flatMap(t => t.comments)).toHaveLength(1);
    expect(results[0]!.run.status).toBe("requested");
  });
  it("keeps a recoverable receipt when Chat delivery fails and resumes its original identity", async () => {
    const m = await fixture();
    const io = { ...m.io, send: async (...args: Parameters<typeof m.io.send>) => {
      if (args[0].some(op => op.type.startsWith("thread."))) throw new Error("Disconnected");
      return m.io.send(...args);
    } };
    await expect(requestAnalysis(io)).rejects.toThrow("was saved but Chat dispatch failed");
    const pending = (await listRuns(m.io))[0]!;
    expect(pending.dispatched).toBe(false);
    expect((await dispatchRun(m.io, pending.id)).dispatched).toBe(true);
    expect((await requestAnalysis(m.io)).id).toBe(pending.id);
  });
  it("arbitrates concurrent claims and binds outcome to the winning executor", async () => {
    const m = await fixture(), request = await requestAnalysis(m.io);
    const results = await Promise.allSettled([updateRun(m.io, request.id, { type: "start" }, actor), updateRun(m.io, request.id, { type: "start" }, other)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const receipt = await readRun(m.io, request.id);
    const executor = receipt.run.executor!;
    await expect(updateRun(m.io, request.id, { type: "fail", message: "No access" }, executor.id === actor.id ? other : actor)).rejects.toThrow("Only the executor");
    await expect(updateRun(m.io, request.id, { type: "complete", resultId: m.id, revision: "" }, executor)).rejects.toThrow("revision");
    expect((await updateRun(m.io, request.id, { type: "complete", resultId: m.id, revision: "abc123", message: "Reviewed sources; no runtime checks" }, executor)).run).toMatchObject({ status: "completed", revision: "abc123", resultId: m.id });
    await expect(updateRun(m.io, request.id, { type: "start" }, actor)).rejects.toThrow();
  });
  it("makes cancellation a request, preserves it across stale worker writes, and retries after acknowledgement", async () => {
    const m = await fixture(), request = await requestAnalysis(m.io);
    await updateRun(m.io, request.id, { type: "start" }, actor);
    let once = false;
    const io = { ...m.io, put: async (...args: Parameters<typeof m.io.put>) => {
      if (!once) { once = true; await updateRun(m.io, request.id, { type: "cancel-request" }); }
      return m.io.put(...args);
    } };
    await expect(updateRun(io, request.id, { type: "fail", message: "Interrupted" }, actor)).rejects.toThrow();
    expect((await readRun(m.io, request.id)).run).toMatchObject({ status: "running", cancelRequested: true });
    await updateRun(m.io, request.id, { type: "cancelled" }, actor);
    const retry = await retryRun(m.io, request.id);
    expect(retry.id).not.toBe(request.id);
    expect(retry.run).toMatchObject({ status: "requested", retryOf: request.id, cancelRequested: false });
  });
  it("records direct Chat work without another dispatch and allows honest access failures", async () => {
    const m = await fixture(), request = await requestAnalysis(m.io, {}, undefined, false);
    expect(request.dispatched).toBe(false);
    expect(Object.values(m.canvas().threads)).toHaveLength(0);
    await expect(updateRun(m.io, request.id, { type: "fail", message: "No repo access" }, actor)).rejects.toThrow("Claim");
    await updateRun(m.io, request.id, { type: "start" }, actor);
    expect((await updateRun(m.io, request.id, { type: "fail", message: "No repo access" }, actor)).run).toMatchObject({ status: "failed", message: "No repo access" });
  });
});
