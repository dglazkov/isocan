import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { collectStudyResult, assessStudyResult, validateStudyResultEvidence, studyAssessmentOutcomes } from "../scripts/lib/design-partner-results.mjs";
import { studyHash } from "../scripts/lib/design-partner-runtime.mjs";
import { questionnaireFixture } from "../packages/api/test/questionnaire-fixture.ts";
import { executionIdentity } from "../scripts/lib/design-partner-execution.mjs";
const owned: string[] = [];
afterEach(async () => { for (const directory of owned.splice(0)) await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const temporary = async () => { const directory = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-study-assessment-")); owned.push(directory); return directory; };

it("executes private declarative browser steps against exact bytes, retaining failures and rejecting code callbacks", async () => {
  const root = await temporary(), bytes = '<!doctype html><title>Acme assessment</title><input id="qty" type="number" value="0"><button id="save" onclick="document.querySelector(\'#saved\').textContent=\'Saved \'+document.querySelector(\'#qty\').value">Save</button><p id="saved">Empty</p>';
  await fs.writeFile(path.join(root, "output.html"), bytes);
  const task = { id: "synthetic", primaryTask: { id: "synthetic-task", steps: ["Save quantity four", "Correct quantity two"] }, viewports: [{ width: 390, height: 844 }] };
  const manifest: any = { dry: { runs: [{ runId: "synthetic/A", fixtureId: task.id, primaryTaskId: task.primaryTask.id, viewports: task.viewports }] }, authorization: null };
  const record: any = { kind: "design-partner-execution-result", runId: "synthetic/A", artifact: { kind: "canvas-item", path: "output.html", sha256: studyHash(bytes) }, manifestSha256: executionIdentity(manifest) };
  const plan = { evaluatorId: "independent-evaluator", independent: true, taskId: task.primaryTask.id, artifactSha256: record.artifact.sha256, repairBudget: { adherent: true, observedRounds: 0, reason: "Synthetic process boundary only; no generation" }, viewports: [{ ...task.viewports[0], steps: [
    { stepIndex: 0, actions: [{ action: "fill", selector: "#qty", text: "4" }, { action: "click", selector: "#save" }], expectations: [{ kind: "text-includes", text: "Saved 4" }] },
    { stepIndex: 1, actions: [{ action: "fill", selector: "#qty", text: "2" }, { action: "click", selector: "#save" }], expectations: [{ kind: "text-includes", text: "Saved 99" }] },
  ] }] };
  const result = await assessStudyResult({ record, manifest, corpus: { tasks: [task] }, evidenceRoot: root, directory: path.join(root, "assessment"), plan });
  expect(result.taskSuccess).toBe(false);
  const assessment = JSON.parse(await fs.readFile(path.join(root, result.assessment.path), "utf8")); expect(assessment.observations.map((row: any) => row.result)).toEqual(["passed", "failed"]); expect(assessment.evidence.filter((row: any) => row.kind === "screenshot" && Number.isInteger(row.stepIndex)).map((row: any) => ({ stepIndex: row.stepIndex, viewport: row.viewport }))).toEqual([{ stepIndex: 0, viewport: task.viewports[0] }, { stepIndex: 1, viewport: task.viewports[0] }]);
  const unsafe = structuredClone(plan) as any; unsafe.viewports[0].steps[0].actions = [{ action: "evaluate", code: "true" }];
  await expect(assessStudyResult({ record, manifest, corpus: { tasks: [task] }, evidenceRoot: root, directory: path.join(root, "unsafe"), plan: unsafe })).rejects.toThrow(/cannot execute scripts/);
  await fs.writeFile(path.join(root, "output.html"), "Changed after capture");
  await expect(assessStudyResult({ record, manifest, corpus: { tasks: [task] }, evidenceRoot: root, directory: path.join(root, "changed"), plan })).rejects.toThrow(/bytes changed/);
});

it("cannot turn a populated authored record into eligible comparison evidence", async () => {
  const result = await validateStudyResultEvidence({ kind: "design-partner-execution-result", runId: "invented", readyReported: true, taskSuccess: true, comparisonStratum: "looks-identical", artifact: { sha256: "a".repeat(64) }, assessment: { path: "pretend", sha256: "b".repeat(64) } }, { manifest: { dry: { runs: [] }, authorization: null }, evidenceRoot: await temporary() });
  expect(result).toMatchObject({ eligible: false, complete: false, taskSuccess: null, readyReported: false }); expect(result.reasons.length).toBeGreaterThan(0);
});

it("captures current final canvas bytes through the actual API while canned execution remains ineligible", async () => {
  const root = await temporary(), fixture = await questionnaireFixture();
  try {
    const content = "<!doctype html><main>Acme exact final output</main>", item = await fixture.agentCanvas.add({ title: "Acme final", content, mime: "text/html", filename: "output.html" });
    const manifest: any = { dry: { runs: [{ runId: "inventory/external-agent/1/B", fixtureId: "inventory", fixtureSha256: "a".repeat(64), condition: "B", deliveryType: "standalone-html" }] }, runtimes: { B: { directory: process.cwd() } }, profile: { model: "synthetic", effort: "none", tools: [], network: {} }, limits: {}, authorization: null };
    const attempt = { attemptId: "synthetic", runId: manifest.dry.runs[0].runId, manifestSha256: executionIdentity(manifest), state: "terminal", reservedAt: new Date().toISOString(), outcome: { status: "completed", providerExecution: "canned-process-only", elapsedMs: 10 }, accounting: { apiEquivalentUsd: 0, billedUsd: null } };
    const attemptFile = path.join(root, "attempt.json"); await fs.writeFile(attemptFile, JSON.stringify(attempt));
    const record = await collectStudyResult({ manifest, attemptFile, runtimeConfig: { source: process.cwd(), home: fixture.home, base: fixture.base, canvasId: fixture.canvasId, runId: attempt.runId, workspace: fixture.work, actor: fixture.agent.actor }, outputItemId: item.id, directory: path.join(root, "capture"), evidenceRoot: root });
    expect(record, JSON.stringify(record)).toMatchObject({ status: "completed", artifact: { itemId: item.id, versionId: item.currentVersionId, sha256: studyHash(content) }, taskSuccess: null, readyReported: false });
    expect(await fs.readFile(path.join(root, record.artifact.path), "utf8")).toBe(content);
    const verified = await validateStudyResultEvidence(record, { manifest, evidenceRoot: root }); expect(verified.eligible).toBe(false); expect(verified.reasons.join(" ")).toMatch(/Canned/);
  } finally { await fixture.close(); }
});

it("retains an observed failed action even when later assertions pass, without requiring agent browser use", () => {
  const viewport = { width: 390, height: 844 }, observation = { viewport, stepIndex: 0, result: "failed", reason: "Control missing" }, task = { primaryTask: { steps: ["Save the receipt"] } };
  const assessment = { status: "failed", observations: [observation] };
  const trace = { observations: [observation], trace: [{ viewport, stepIndex: 0, action: { action: "click", selector: "#missing" }, error: "Control missing" }, { viewport, stepIndex: 0, assertion: { kind: "text-includes", text: "Acme" }, passed: true }] };
  expect(studyAssessmentOutcomes(assessment, trace, task, [viewport])).toMatchObject({ taskSuccess: false });
  expect(() => studyAssessmentOutcomes({ ...assessment, status: "passed" }, trace, task, [viewport])).toThrow(/Aggregate/);
  expect(() => studyAssessmentOutcomes(assessment, trace, { primaryTask: { steps: ["Save", "Correct"] } }, [viewport])).toThrow(/omitted/);
});
