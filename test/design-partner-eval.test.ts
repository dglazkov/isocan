import { afterEach, describe, expect, it } from "vitest";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { parseArgs } from "../scripts/design-partner-eval.mjs";
import { designSystemProperties } from "../packages/core/src/designsystem.ts";
import { FIXTURES, answerFromBank, createManifest, hash, loadBaseline, loadCorpus, renderBaselineEnvelope, validateActualResult, validateDryManifest, validateResultSet } from "../scripts/lib/design-partner-eval.mjs";

const scratch: string[] = [];
afterEach(async () => { for (const dir of scratch.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const temporary = async () => { const dir = await mkdtemp(path.join(tmpdir(), "isocan-design-partner-unit-")); scratch.push(dir); return dir; };
const inputs = async () => { const [corpus, baseline] = await Promise.all([loadCorpus(), loadBaseline()]); return { corpus, baseline, manifest: createManifest(corpus, baseline) }; };

describe("the frozen design creation instrument", () => {
  it("has twelve actual fixtures, equivalent entrances, answers, and a 96-cell paired matrix", async () => {
    const { corpus, baseline, manifest } = await inputs();
    expect(corpus.tasks).toHaveLength(12); expect(manifest.runs).toHaveLength(96);
    expect(validateDryManifest(manifest)).toMatchObject({ plannedRuns: 96, providerCalls: 0, qualityEvidence: false });
    expect(createManifest(corpus, baseline)).toEqual(manifest);
    expect(createManifest(corpus, baseline, { seed: "different" }).runs).not.toEqual(manifest.runs);
    expect(createManifest(corpus, baseline, { study: "smoke" }).runs).toHaveLength(16);
    expect(createManifest(corpus, baseline, { includeC: "native" }).runs).toHaveLength(144);
    expect(createManifest(corpus, baseline, { includeC: "adapted" }).impeccable.mode).toBe("adapted");
    expect(() => createManifest(corpus, baseline, { includeC: "unspecified" })).toThrow();
    for (const task of corpus.tasks) {
      expect(task.entryPoints["canvas-chat"].selectedItemIds).toEqual(task.entryPoints["external-agent"].selectedItemIds);
      expect(answerFromBank(task, "audience").answer).toBeTruthy();
      expect(answerFromBank(task, "not-a-supplied-fact")).toBeNull();
      expect(task.snapshot.items.some(item => item.path === "reference.md")).toBe(true);
      for (const item of task.snapshot.items.filter(item => item.path.endsWith("DESIGN.md"))) expect(item.properties).toEqual(designSystemProperties());
    }
  });

  it("rejects a deleted asset before a run can be planned", async () => {
    const dir = await temporary(); await cp(FIXTURES, dir, { recursive: true });
    await rm(path.join(dir, "imagery/landscape.svg"));
    await expect(loadCorpus(dir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects changed reference bytes and a changed baseline prompt", async () => {
    const dir = await temporary(); await cp(FIXTURES, dir, { recursive: true });
    await writeFile(path.join(dir, "inventory/stock.csv"), "silently changed data");
    await expect(loadCorpus(dir)).rejects.toThrow(/Fixture hash mismatch/);
    await writeFile(path.join(dir, "baseline/agent-guide.md"), "silently weakened baseline");
    await expect(loadBaseline(dir)).rejects.toThrow(/Baseline hash mismatch/);
  });

  it("renders the preserved summons and external doorway without adding a design procedure or hidden answers", async () => {
    const { corpus, baseline } = await inputs(), task = corpus.tasks.find(task => task.id === "inventory");
    const summoned = await renderBaselineEnvelope(task, "canvas-chat", baseline);
    const external = await renderBaselineEnvelope(task, "external-agent", baseline);
    expect(summoned.messages[0].content).toContain("This is a summons:");
    expect(summoned.messages[0].content).toContain("do NOT run `isocan wait`");
    expect(external.messages).toEqual([{ role: "user", content: task.instruction }]);
    expect(summoned.resources.manualCommands.map(command => command.name)).toEqual(baseline.commands.map(command => command.name));
    expect(summoned.resources).toEqual(external.resources);
    expect(summoned.resources.guide.length).toBeGreaterThan(50_000);
    expect(summoned.resources.initialSnapshot.items.some(item => item.path === "stock.csv")).toBe(true);
    expect(JSON.stringify(summoned.resources)).not.toContain(task.answerBank.find(answer => answer.id === "tradeoff").answer);
    expect(JSON.stringify(summoned.messages)).not.toContain("zero to three");
    expect(summoned.execution).toMatchObject({ executed: false, providerCalls: 0, qualityEvidence: null });
  });

  it("refuses invented dry-run quality and missing/duplicated matrix cells", async () => {
    const { manifest } = await inputs();
    for (const change of [value => { value.execution.providerCalls = 1; }, value => { value.execution.qualityEvidence = { score: 5 }; }, value => { value.runs[0].quality = "excellent"; }, value => { value.runs[0].taskSuccess = true; }, value => { value.runs.pop(); }, value => { value.runs[0] = value.runs[1]; }, value => { value.conditions = ["A"]; value.runs = value.runs.filter(row => row.condition === "A"); value.plannedRuns = value.runs.length; }, value => { value.runs = []; value.plannedRuns = 0; value.caseIds = []; }]) {
      const candidate = structuredClone(manifest); change(candidate); expect(() => validateDryManifest(candidate)).toThrow();
    }
  });

  it("has no provider command, ambiguous mode or implicit spending option", () => {
    for (const args of [[], ["--model", "Acme"], ["--dry-run", "--budget-usd", "5"], ["--dry-run", "--baseline", "inventory"], ["--baseline", "inventory"], ["--dry-run", "--dry-run"]]) expect(() => parseArgs(args)).toThrow();
    expect(parseArgs(["--dry-run"]).mode).toBe("dry-run");
    expect(parseArgs(["--baseline", "inventory", "--entrance", "external-agent"]).baseline).toBe("inventory");
  });
});

// Explicit synthetic unit evidence. Nothing here is written as a measured generation.
function unitResult(manifest, planned = manifest.runs.find(run => run.condition === "A" && run.deliveryType === "standalone-html")) {
  const artifact = "<html lang='en'><title>Acme unit fixture</title><p>Synthetic evidence only</p></html>";
  return { schemaVersion: 1, mode: "actual", runId: planned.runId, fixtureId: planned.fixtureId, entrance: planned.entrance, repetition: planned.repetition, condition: planned.condition, fixtureSha256: planned.fixtureSha256,
    requestId: "acme-unit-request", protocolRevision: manifest.protocolRevision, sourceRevision: manifest.baseline.sourceRevision, procedureRevision: manifest.baseline.procedureRevision, promptSha256: hash("synthetic unit prompt"),
    context: { state: "available", manifestSha256: planned.contextManifestSha256, items: structuredClone(planned.contextItems), repositorySnapshotSha256: planned.repositorySnapshotSha256 },
    provider: { name: "synthetic-unit-provider", requestedModel: "synthetic-model", resolvedModel: "synthetic-model", modelRevision: "synthetic-v1", used: true, calls: 1 },
    capabilities: { harness: "unit-test", harnessRevision: "v1", tools: ["local-fixture"], browser: { status: "unavailable", reason: "Unit test has no browser evidence" }, imageGeneration: { status: "not-used", reason: "Unit fixture" }, repositoryRuntime: { status: "not-used", reason: "Standalone fixture" } },
    comparisonStratum: "synthetic-unit-only", cost: { currency: "USD", authorized: true, ceilingUsd: 1, modelUsd: 0, toolUsd: 0 }, tokens: { input: 0, output: 0, cached: 0 }, ceilings: { tokens: 1000, milliseconds: 1000, repairRounds: 2 },
    status: "completed", startedAt: "2026-09-14T00:00:00.000Z", endedAt: "2026-09-14T00:00:01.000Z", timeToFirstUsefulVisualMs: null, repairRounds: 0, unresolvedFailures: [], answers: [], checks: [], ready: false,
    artifact: { kind: "canvas-item", itemId: "acme-unit-output", versionId: "acme-unit-v1", blobSha256: hash(artifact), path: "artifact.html", sha256: hash(artifact) }, quality: { status: "unmeasured" }, impeccable: null };
}

describe("result identity, incomplete work and evidence", () => {
  it("rejects absent artifact/context/model identity, wrong fixture and undeclared resource use", async () => {
    const { manifest } = await inputs(); expect(validateActualResult(unitResult(manifest), manifest).ready).toBe(false);
    for (const change of [row => { delete row.artifact; }, row => { row.artifact = null; }, row => { delete row.artifact.versionId; }, row => { delete row.context; }, row => { row.context.items = []; }, row => { row.context.items[0].versionId = "wrong"; }, row => { delete row.provider.resolvedModel; }, row => { row.fixtureId = "other"; }, row => { delete row.capabilities.browser; }, row => { delete row.cost; }, row => { row.ready = true; }, row => { row.mode = "dry-run"; }]) {
      const result = unitResult(manifest); change(result); expect(() => validateActualResult(result, manifest)).toThrow();
    }
  });

  it("keeps failures/timeouts and unknown spend in the planned denominator", async () => {
    const { manifest } = await inputs(), row = unitResult(manifest);
    row.status = "timed-out"; row.failureReason = "Synthetic timeout"; row.artifact = null; row.artifactUnavailableReason = "No output was returned";
    row.cost.modelUsd = null; row.cost.unknownReason = "Provider reported no terminal cost";
    const report = { schemaVersion: 1, kind: "design-partner-results", mode: "actual", manifestSha256: hash(JSON.stringify(manifest)), records: [row] };
    const result = await validateResultSet(report, manifest, await temporary());
    expect(result).toMatchObject({ status: "incomplete", plannedRuns: 96, attemptedRuns: 1, outcomes: { "timed-out": 1 }, totalCostUsd: null, unknownCostRuns: 1, qualityEvidence: false, comparisonEligible: false });
    expect(result.missingRunIds).toHaveLength(95);
    await expect(validateResultSet({ ...report, records: [row, row] }, manifest, FIXTURES)).rejects.toThrow(/Duplicated/);
    const fabricated = { ...manifest, conditions: [], caseIds: [], runs: [], plannedRuns: 0 };
    await expect(validateResultSet({ ...report, records: [] }, fabricated, FIXTURES)).rejects.toThrow();
  });

  it("checks output bytes instead of trusting an artifact filename or digest", async () => {
    const { manifest } = await inputs(), row = unitResult(manifest), root = await temporary();
    const report = { schemaVersion: 1, kind: "design-partner-results", mode: "actual", manifestSha256: hash(JSON.stringify(manifest)), records: [row] };
    await expect(validateResultSet(report, manifest, root)).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(path.join(root, "artifact.html"), "different output");
    await expect(validateResultSet(report, manifest, root)).rejects.toThrow(/Evidence hash mismatch/);
    await writeFile(path.join(root, "artifact.html"), "<html lang='en'><title>Acme unit fixture</title><p>Synthetic evidence only</p></html>");
    expect((await validateResultSet(report, manifest, root)).attemptedRuns).toBe(1);
  });

  it("reports differently modeled or equipped arms as unmatched while retaining both attempts", async () => {
    const { manifest } = await inputs(), left = unitResult(manifest), root = await temporary();
    const plan = manifest.runs.find(run => run.runId === left.runId);
    const right = unitResult(manifest, manifest.runs.find(run => run.pairId === plan.pairId && run.condition === "B"));
    left.status = right.status = "failed";
    left.failureReason = right.failureReason = "Synthetic pre-output failure";
    left.artifact = right.artifact = null;
    left.artifactUnavailableReason = right.artifactUnavailableReason = "Synthetic failed attempt has no artifact";
    const report = { schemaVersion: 1, kind: "design-partner-results", mode: "actual", manifestSha256: hash(JSON.stringify(manifest)), records: [left, right] };
    expect((await validateResultSet(report, manifest, root)).unmatchedPairIds).toEqual([]);
    right.provider.resolvedModel = "different-synthetic-model";
    expect((await validateResultSet(report, manifest, root)).unmatchedPairIds).toEqual([plan.pairId]);
    right.provider.resolvedModel = left.provider.resolvedModel;
    right.capabilities.browser = { status: "available", reason: "Different synthetic capability" };
    const result = await validateResultSet(report, manifest, root);
    expect(result).toMatchObject({ attemptedRuns: 2, outcomes: { failed: 2 }, comparisonEligible: false, unmatchedPairIds: [plan.pairId] });
  });

  it("requires current browser/task/viewport evidence before an output can be called ready", async () => {
    const { manifest } = await inputs(), row = unitResult(manifest), plan = manifest.runs.find(run => run.runId === row.runId);
    row.ready = true; row.capabilities.browser = { status: "available", reason: "Synthetic unit evidence only" };
    const check = { kind: "browser-task", result: "passed", evidenceRole: "current", tool: "synthetic-unit-browser", toolRevision: "v1", artifactSha256: row.artifact.sha256, contextManifestSha256: row.context.manifestSha256, evidencePath: "unit-evidence.json", evidenceSha256: hash("synthetic unit evidence") };
    row.checks = [{ ...check, primaryTaskId: plan.primaryTaskId }, ...plan.viewports.map(viewport => ({ ...check, kind: "browser-layout", viewport }))];
    expect(validateActualResult(row, manifest).ready).toBe(true);
    row.checks[0].artifactSha256 = hash("stale output"); expect(() => validateActualResult(row, manifest)).toThrow(/historical evidence/);
    row.checks[0].evidenceRole = "historical"; expect(() => validateActualResult(row, manifest)).toThrow(/primary-task/);
  });

  it("does not hide a current failed check behind passed checks or an empty failure list", async () => {
    const { manifest } = await inputs(), row = unitResult(manifest), plan = manifest.runs.find(run => run.runId === row.runId);
    row.ready = true; row.capabilities.browser = { status: "available", reason: "Synthetic unit evidence only" };
    const check = { kind: "browser-task", result: "passed", evidenceRole: "current", tool: "synthetic-unit-browser", toolRevision: "v1", artifactSha256: row.artifact.sha256, contextManifestSha256: row.context.manifestSha256, evidencePath: "unit-evidence.json", evidenceSha256: hash("synthetic unit evidence") };
    row.checks = [{ ...check, primaryTaskId: plan.primaryTaskId }, ...plan.viewports.map(viewport => ({ ...check, kind: "browser-layout", viewport }))];
    const failed = { ...check, kind: "source", result: "failed" };
    row.checks.push(failed);
    expect(row.unresolvedFailures).toEqual([]);
    expect(() => validateActualResult(row, manifest)).toThrow(/failed check for the current/);
    failed.evidenceRole = "historical"; expect(() => validateActualResult(row, manifest)).toThrow(/failed check for the current/);
    failed.artifactSha256 = hash("older repaired output");
    expect(validateActualResult(row, manifest).ready).toBe(true);
  });
});

it("the supplied tiny repository really serves its existing component, tokens and stock API", async () => {
  const process = spawn("node", [path.join(FIXTURES, "brand-extension/repo/server.mjs")], { env: { ...globalThis.process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error("Fixture server did not start")), 5000);
      process.on("error", error => { clearTimeout(timeout); reject(error); });
      process.stdout.on("data", chunk => { output += chunk; if (output.includes("\n")) { clearTimeout(timeout); resolve(JSON.parse(output.split("\n")[0]).url); } });
      process.on("exit", code => { clearTimeout(timeout); reject(new Error(`Fixture server exited: ${code}`)); });
    });
    const [page, component, tokens, data] = await Promise.all([fetch(url).then(r => r.text()), fetch(url + "/components.mjs").then(r => r.text()), fetch(url + "/tokens.css").then(r => r.text()), fetch(url + "/api/stock?q=BTL-20").then(r => r.json())]);
    expect(page).toContain("<acme-card>"); expect(component).toContain('customElements.define("acme-card"'); expect(tokens).toContain("--accent:#285c98");
    expect(data).toEqual([{ sku: "BTL-20", name: "Insulated bottle 500 ml", available: 24, shelf: "B-4" }]);
  } finally { process.kill(); await new Promise<void>(resolve => { if (process.exitCode !== null) resolve(); else process.once("exit", () => resolve()); }); }
});
