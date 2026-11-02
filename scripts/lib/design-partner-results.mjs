/** Exact final-byte capture and independent evaluator observations. Native ready claims are never task success. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStudyTools } from "./design-partner-tools.mjs";
import { nativeStreamAccounting, nativeInvocation, nativeSessionId } from "./design-partner-native.mjs";
import { executionIdentity } from "./design-partner-execution.mjs";
import { loadCorpus } from "./design-partner-eval.mjs";
import { studyHash, studyJson, studyPath, studyProcess, studyTreeIdentity, startStudyService } from "./design-partner-runtime.mjs";
const require = (condition, reason) => { if (!condition) throw new Error(reason); };
const reference = async (root, filename) => ({ path: path.relative(root, filename), sha256: studyHash(await fs.readFile(filename)) });
const read = async (root, ref) => { const bytes = await fs.readFile(await studyPath(root, ref.path)); require(studyHash(bytes) === ref.sha256, "Evidence bytes changed"); return bytes; };
/** Validate independent observation consistency only; this never grants native execution or comparison eligibility. */
export function studyAssessmentOutcomes(assessment, trace, task, viewports) {
  require(Array.isArray(assessment.observations) && assessment.observations.length === task.primaryTask.steps.length * viewports.length && viewports.every(viewport => task.primaryTask.steps.every((_, stepIndex) => assessment.observations.filter(row => row.viewport.width === viewport.width && row.viewport.height === viewport.height && row.stepIndex === stepIndex).length === 1)), "Independent assessment omitted or duplicated a frozen task step");
  require(JSON.stringify(trace.observations) === JSON.stringify(assessment.observations), "Assessment observations differ from actual trace");
  for (const observation of assessment.observations) {
    const entries = trace.trace.filter(row => row.stepIndex === observation.stepIndex && row.viewport.width === observation.viewport.width && row.viewport.height === observation.viewport.height);
    require(entries.some(row => row.assertion) && entries.every(row => !row.error && (!row.assertion || row.passed === true)) === (observation.result === "passed"), "A task step contradicts its actual action/assertion observations");
  }
  const passed = assessment.observations.every(row => row.result === "passed");
  require(assessment.status === (passed ? "passed" : "failed"), "Aggregate assessment contradicts observed task outcomes");
  return { taskSuccess: passed, observations: assessment.observations };
}

/** Capture the actual selected runtime output after one immutable attempt, including failed or absent outputs.
 * @param {{manifest: any, attemptFile: string, runtimeConfig: any, outputItemId?: string|null, directory: string, evidenceRoot: string}} input
 */
export async function collectStudyResult({ manifest, attemptFile, runtimeConfig, outputItemId = null, directory, evidenceRoot }) {
  const attempt = JSON.parse(await fs.readFile(attemptFile, "utf8")), planned = manifest.dry.runs.find(row => row.runId === attempt.runId);
  require(planned && attempt.state === "terminal" && attempt.manifestSha256 === executionIdentity(manifest), "No matching terminal attempt");
  require(runtimeConfig.runId === attempt.runId && runtimeConfig.source === manifest.runtimes[planned.condition === "A" ? "A" : "B"].directory, "Output capture belongs to another runtime");
  await fs.mkdir(directory, { recursive: false });
  const folder = path.dirname(attemptFile), runFolder = path.join(folder, attempt.attemptId);
  const nativeFolder = path.join(runFolder, "native");
  const provenance = { attempt: await reference(evidenceRoot, attemptFile), nativeStream: null, invocation: null, tools: null, config: null };
  for (const [key, filename] of [["config", path.join(runFolder, "tool-config.json")], ["nativeStream", path.join(nativeFolder, "native-stream.jsonl")], ["invocation", path.join(runFolder, "invocation.json")], ["tools", path.join(runFolder, "tools/tools.jsonl")]]) {
    try { provenance[key] = await reference(evidenceRoot, filename); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  let artifact = null, artifactUnavailableReason = null, reportedReceipts = [];
  try {
    if (planned.deliveryType === "connected-app") {
      const files = await studyTreeIdentity(path.join(runtimeConfig.workspace, "repo"));
      await fs.cp(path.join(runtimeConfig.workspace, "repo"), path.join(directory, "repository"), { recursive: true, errorOnExist: true, force: false });
      const filename = path.join(directory, "repository.json");
      const packageBody = { kind: "repository-files", files, entry: "public/index.html", revisionKind: "content-sha256" };
      await fs.writeFile(filename, studyJson(packageBody), { flag: "wx" });
      artifact = { kind: "repository", ...await reference(evidenceRoot, filename), files: files.map(file => ({ ...file, relative: file.path, path: path.relative(evidenceRoot, path.join(directory, "repository", file.path)) })), entry: "public/index.html", repositoryRevision: studyHash(JSON.stringify(files)), buildId: studyHash(JSON.stringify(files)), runtimeId: runtimeConfig.repositoryUrl, mimeType: "application/json" };
    } else {
      require(typeof outputItemId === "string" && outputItemId, "No final canvas output selected");
      const outputFile = path.join(directory, "output.html"), worker = fileURLToPath(new URL("./design-partner-result-child.mjs", import.meta.url));
      const actual = await studyProcess(process.execPath, ["--import", path.join(runtimeConfig.source, "node_modules/tsx/dist/loader.mjs"), worker], { cwd: runtimeConfig.source, env: { PATH: process.env.PATH, HOME: process.env.HOME }, input: JSON.stringify({ ...runtimeConfig, outputItemId, outputFile }), milliseconds: 30_000 });
      require(actual.code === 0, `Actual final output unavailable: ${actual.stderr}`);
      const captured = JSON.parse(actual.stdout); reportedReceipts = captured.reportedReceipts;
      const { reportedReceipts: _, ...identity } = captured;
      const supportFiles = [];
      for (const file of (await studyTreeIdentity(runtimeConfig.workspace)).filter(row => !row.path.startsWith(".") && !["CONTEXT.json", "RESULT.json"].includes(row.path) && !row.path.split("/").some(part => part.startsWith(".")))) {
        const filename = path.join(directory, "support", file.path), source = await studyPath(runtimeConfig.workspace, file.path);
        await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.copyFile(source, filename);
        const copied = await reference(evidenceRoot, filename); require(copied.sha256 === file.sha256, "Support file changed during final capture");
        supportFiles.push({ ...copied, relative: file.path, bytes: file.bytes });
      }
      artifact = { ...identity, ...await reference(evidenceRoot, outputFile), supportFiles };
    }
  } catch (error) { artifactUnavailableReason = error.message; }
  const tools = provenance.tools ? (await read(evidenceRoot, provenance.tools)).toString().trim().split("\n").map(line => JSON.parse(line)) : [];
  let finalClaim = null;
  try { finalClaim = JSON.parse(await fs.readFile(path.join(runtimeConfig.workspace, "RESULT.json"), "utf8")); } catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; }
  const captureFile = path.join(directory, "capture.json"); await fs.writeFile(captureFile, studyJson({ artifact, reportedReceipts, finalClaim, producer: runtimeConfig.actor, capturedAt: new Date().toISOString() }), { flag: "wx" }); provenance.capture = await reference(evidenceRoot, captureFile);
  const firstVisual = tools.find(row => row.kind === "tool-result" && row.name === "browser" && row.result?.image?.deliveredAs === "MCP image content");
  const record = { schemaVersion: 1, kind: "design-partner-execution-result", runId: planned.runId, manifestSha256: executionIdentity(manifest), fixtureSha256: planned.fixtureSha256, status: artifact && attempt.outcome.status === "completed" ? "completed" : attempt.outcome.status === "completed" ? "failed" : attempt.outcome.status, artifact, artifactUnavailableReason, provenance, assessment: null, readyReported: finalClaim?.ready === true || reportedReceipts.some(row => row.status === "current" && row.receipt.status === "ready"), reportedReceipts, taskSuccess: null, accounting: { ...attempt.accounting, toolUsd: 0 }, elapsedMs: attempt.outcome.elapsedMs ?? null, timeToFirstVisualMs: firstVisual ? Date.parse(firstVisual.at) - Date.parse(attempt.reservedAt) : null, comparisonStratum: studyHash(JSON.stringify({ model: manifest.profile.model, effort: manifest.profile.effort, tools: manifest.profile.tools, network: manifest.profile.network, limits: manifest.limits })), qualityEvidence: false };
  await fs.writeFile(path.join(directory, "result.json"), studyJson(record), { flag: "wx" }); return record;
}

/** Execute a separate evaluator's declarative task plan against copied exact output bytes, never model code callbacks. */
export async function assessStudyResult({ record, manifest, corpus, evidenceRoot, directory, plan }) {
  const planned = manifest.dry.runs.find(row => row.runId === record.runId), task = corpus.tasks.find(row => row.id === planned?.fixtureId);
  require(task && typeof plan.evaluatorId === "string" && plan.evaluatorId.trim() && plan.independent === true, "An independent evaluator and frozen task are required");
  if (!record.artifact) {
    require(record.status !== "completed" && typeof record.artifactUnavailableReason === "string" && plan.taskId === task.primaryTask.id && plan.artifactSha256 === null && Array.isArray(plan.viewports) && plan.viewports.length === 0, "Absent output requires an explicit failed-outcome assessment");
    require(Object.keys(plan).every(key => ["evaluatorId", "independent", "taskId", "artifactSha256", "viewports", "repairBudget"].includes(key)) && typeof plan.repairBudget?.adherent === "boolean" && Number.isInteger(plan.repairBudget.observedRounds) && plan.repairBudget.observedRounds >= 0 && typeof plan.repairBudget.reason === "string" && plan.repairBudget.reason.trim(), "Missing failure budget disposition");
    await fs.mkdir(directory, { recursive: false });
    const filename = path.join(directory, "assessment.json");
    await fs.writeFile(filename, studyJson({ schemaVersion: 1, kind: "design-partner-independent-failure-assessment", runId: record.runId, manifestSha256: executionIdentity(manifest), ...plan, status: "unavailable", reason: record.artifactUnavailableReason, instrumentationSha256: studyHash(await fs.readFile(fileURLToPath(import.meta.url))), assessedAt: new Date().toISOString() }), { flag: "wx" });
    return { ...record, assessment: await reference(evidenceRoot, filename), taskSuccess: false };
  }
  require(plan.taskId === task.primaryTask.id && plan.artifactSha256 === record.artifact.sha256 && Array.isArray(plan.viewports) && plan.viewports.length === task.viewports.length, "Assessment must name the frozen task and exact final output");
  require(Object.keys(plan).every(key => ["evaluatorId", "independent", "taskId", "artifactSha256", "viewports", "repairBudget"].includes(key)), "Unsupported evaluator plan field");
  require(plan.repairBudget && Object.keys(plan.repairBudget).every(key => ["adherent", "observedRounds", "reason"].includes(key)) && typeof plan.repairBudget.adherent === "boolean" && Number.isInteger(plan.repairBudget.observedRounds) && plan.repairBudget.observedRounds >= 0 && typeof plan.repairBudget.reason === "string" && plan.repairBudget.reason.trim(), "Evaluator must explicitly assess marked and unmarked repair-budget activity");
  await read(evidenceRoot, record.artifact);
  await fs.mkdir(directory, { recursive: false }); const workspace = path.join(directory, "workspace"); await fs.mkdir(workspace);
  let service = null;
  if (record.artifact.kind === "repository") {
    for (const name of ["server.mjs", "package.json"]) {
      const file = record.artifact.files.find(row => row.relative === name);
      require(file && file.sha256 === task.hashes[`repo/${name}`], "The independent assessment cannot execute a changed backend/package");
    }
    for (const file of record.artifact.files) { const bytes = await read(evidenceRoot, file), filename = await studyPath(workspace, file.relative, { missing: true }); await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, bytes, { flag: "wx" }); }
    service = await startStudyService("npm", ["start"], { cwd: workspace, env: { PATH: process.env.PATH, PORT: "0" }, milliseconds: 120_000 });
  } else {
    for (const file of record.artifact.supportFiles ?? []) { const filename = await studyPath(workspace, file.relative, { missing: true }); if (file.relative === "output.html") continue; await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, await read(evidenceRoot, file), { flag: "wx" }); }
    await fs.writeFile(path.join(workspace, "output.html"), await read(evidenceRoot, record.artifact), { flag: "wx" });
  }
  const trace = [], observations = [], screenshots = [], startedAt = new Date().toISOString();
  const tools = await createStudyTools({ workspace, base: "http://127.0.0.1:1", repositoryUrl: service?.url ?? null, canvasId: "prj_assessment", evidence: path.join(directory, "browser"), questions: path.join(directory, "questions"), deadline: new Date(Date.now() + 120_000).toISOString(), runId: record.runId, fixtureId: task.id });
  try {
    for (const viewport of task.viewports) {
      const supplied = plan.viewports.find(row => row.width === viewport.width && row.height === viewport.height);
      require(supplied && Object.keys(supplied).every(key => ["width", "height", "steps"].includes(key)) && Array.isArray(supplied.steps) && supplied.steps.length === task.primaryTask.steps.length, "Each frozen viewport needs every task step");
      await tools.invoke("browser", { action: "resize", ...viewport });
      await tools.invoke("browser", { action: "navigate", url: service?.url ?? "task:output.html" });
      const initialShot = await tools.invoke("browser", { action: "screenshot" });
      screenshots.push({ ...await reference(evidenceRoot, path.join(directory, "browser", initialShot.path)), kind: "screenshot", mimeType: "image/png", viewport, state: "initial" });
      for (let index = 0; index < task.primaryTask.steps.length; index++) {
        const step = supplied.steps[index];
        require(step.stepIndex === index && Object.keys(step).every(key => ["stepIndex", "actions", "expectations"].includes(key)) && Array.isArray(step.actions) && step.actions.length <= 30 && Array.isArray(step.expectations) && step.expectations.length > 0 && step.expectations.length <= 12, "Every task step needs bounded real actions and observations");
        let failure = null;
        for (const action of step.actions) {
          require(["click", "fill", "key", "snapshot"].includes(action.action), "Evaluator plans cannot execute scripts or navigate away from exact output");
          try { const result = await tools.invoke("browser", action); trace.push({ viewport, stepIndex: index, action, result }); } catch (error) { failure ??= error.message; trace.push({ viewport, stepIndex: index, action, error: error.message }); break; }
        }
        let snapshot;
        try { snapshot = await tools.invoke("browser", { action: "snapshot" }); } catch (error) { failure ??= error.message; }
        for (const assertion of step.expectations) {
          require(Object.keys(assertion).every(key => ["kind", "text", "id", "value"].includes(key)) && ["text-includes", "text-excludes", "control-value", "control-disabled", "no-horizontal-overflow"].includes(assertion.kind), "Unsupported task expectation");
          const passed = snapshot && (assertion.kind === "text-includes" ? snapshot.text.includes(assertion.text) : assertion.kind === "text-excludes" ? !snapshot.text.includes(assertion.text) : assertion.kind === "control-value" ? snapshot.controls.some(row => row.id === assertion.id && row.value === assertion.value) : assertion.kind === "control-disabled" ? snapshot.controls.some(row => row.id === assertion.id && row.disabled === assertion.value) : snapshot.scrollWidth <= snapshot.viewport.width);
          trace.push({ viewport, stepIndex: index, assertion, passed: Boolean(passed), snapshot }); if (!passed) failure ??= "Observed task expectation failed";
        }
        observations.push({ viewport, stepIndex: index, result: failure ? "failed" : "passed", reason: failure });
        const stateShot = await tools.invoke("browser", { action: "screenshot" });
        screenshots.push({ ...await reference(evidenceRoot, path.join(directory, "browser", stateShot.path)), kind: "screenshot", mimeType: "image/png", viewport, stepIndex: index });
      }
      const shot = await tools.invoke("browser", { action: "screenshot" });
      screenshots.push({ ...await reference(evidenceRoot, path.join(directory, "browser", shot.path)), kind: "screenshot", mimeType: "image/png", viewport });
    }
  } finally { await tools.close(); await service?.close(); }
  const traceFile = path.join(directory, "task-trace.json"); await fs.writeFile(traceFile, studyJson({ observations, trace }), { flag: "wx" });
  const assessment = { schemaVersion: 1, kind: "design-partner-independent-assessment", manifestSha256: executionIdentity(manifest), runId: record.runId, evaluatorId: plan.evaluatorId, independent: true, taskId: task.primaryTask.id, artifactSha256: record.artifact.sha256, startedAt, finishedAt: new Date().toISOString(), instrumentationSha256: studyHash(await fs.readFile(fileURLToPath(import.meta.url))), planSha256: studyHash(JSON.stringify(plan)), observations, status: observations.every(row => row.result === "passed") ? "passed" : "failed", evidence: [...screenshots, { ...await reference(evidenceRoot, traceFile), kind: "task-trace", mimeType: "application/json" }] };
  await fs.writeFile(path.join(directory, "plan.json"), studyJson(plan), { flag: "wx" });
  assessment.plan = await reference(evidenceRoot, path.join(directory, "plan.json"));
  const filename = path.join(directory, "assessment.json"); await fs.writeFile(filename, studyJson(assessment), { flag: "wx" });
  return { ...record, assessment: await reference(evidenceRoot, filename), taskSuccess: assessment.status === "passed" };
}

/** Re-read private execution and evaluator evidence; a plausible authored result cannot confer study eligibility.
 * @returns {Promise<{eligible: boolean, complete: boolean, reasons: string[], taskSuccess: boolean|null, readyReported: boolean, criticalUnresolved: boolean|null, comparisonSignature: string|null, ceilingsAdherent: boolean|null, producingAgentBrowserUse: {initialized:boolean,screenshotDelivered:boolean}|null, publicEvidence: any[], assessment: any}>}
 */
export async function validateStudyResultEvidence(record, { manifest, evidenceRoot }) {
  const reasons = [], result = { eligible: false, complete: false, reasons, taskSuccess: null, readyReported: false, criticalUnresolved: null, comparisonSignature: null, ceilingsAdherent: null, producingAgentBrowserUse: null, publicEvidence: [], assessment: null };
  try {
    const planned = manifest.dry.runs.find(row => row.runId === record.runId);
    require(planned && record.kind === "design-partner-execution-result" && record.manifestSha256 === executionIdentity(manifest) && record.fixtureSha256 === planned.fixtureSha256, "Result is outside the frozen matched matrix");
    const corpus = await loadCorpus(), task = corpus.tasks.find(row => row.id === planned.fixtureId);
    const capture = JSON.parse(await read(evidenceRoot, record.provenance.capture));
    require(JSON.stringify(capture.artifact) === JSON.stringify(record.artifact), "Captured output identity changed");
    result.readyReported = capture.finalClaim?.ready === true || capture.reportedReceipts.some(row => row.status === "current" && row.receipt.status === "ready");
    require(record.readyReported === result.readyReported, "Reported readiness differs from captured authored claim");
    const attempt = JSON.parse(await read(evidenceRoot, record.provenance.attempt));
    require(attempt.runId === record.runId && attempt.manifestSha256 === executionIdentity(manifest) && attempt.state === "terminal", "Missing actual terminal reservation");
    require(attempt.outcome.providerExecution === "native-requested" && manifest.authorization?.approvedManifestSha256 === executionIdentity(manifest), "Canned, synthetic or unauthorized execution is not comparison evidence");
    const parser = nativeStreamAccounting(manifest.profile, manifest.limits); parser.append(await read(evidenceRoot, record.provenance.nativeStream)); const actual = parser.finish();
    require(actual.initialization && actual.apiEquivalentUsd !== null && actual.usage && JSON.stringify(actual.usage) === JSON.stringify(attempt.outcome.usage), "Native actual usage/initialization is unavailable or mismatched");
    require(record.status === (record.artifact && attempt.outcome.status === "completed" ? "completed" : attempt.outcome.status === "completed" ? "failed" : attempt.outcome.status), "Result status differs from the actual terminal outcome");
    require(!actual.stopStudy || !/model|tool|initialization|accounting|Malformed|Truncated|smaller/i.test(actual.stopStudy), "Native execution has untrustworthy model/tool/accounting evidence");
    require(record.accounting.apiEquivalentUsd === actual.apiEquivalentUsd && record.accounting.toolUsd === 0 && record.elapsedMs === attempt.outcome.elapsedMs, "Result cost/time differs from actual execution");
    const invocation = JSON.parse(await read(evidenceRoot, record.provenance.invocation));
    require(invocation.attemptId === attempt.attemptId && invocation.command === manifest.profile.binary.path && invocation.sourceRevision === manifest.runtimes[planned.condition === "A" ? "A" : "B"].sourceRevision, "Actual invocation belongs to another runtime");
    const config = JSON.parse(await read(evidenceRoot, record.provenance.config));
    require(config.runId === record.runId && config.source === manifest.runtimes[planned.condition === "A" ? "A" : "B"].directory && invocation.promptSha256 === studyHash(config.prompt), "Delivered prompt or source tool configuration changed");
    const expected = nativeInvocation({ profile: manifest.profile, limits: manifest.limits, toolConfigFile: await studyPath(evidenceRoot, record.provenance.config.path), sessionId: nativeSessionId(manifest, record.runId), inherited: {} });
    require(JSON.stringify(invocation.args) === JSON.stringify(expected.args), "Actual native isolation/session/limit flags differ from the provisioned profile");
    const tools = record.provenance.tools ? (await read(evidenceRoot, record.provenance.tools)).toString().trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
    result.comparisonSignature = studyHash(JSON.stringify({ model: manifest.profile.model, effort: manifest.profile.effort, tools: manifest.profile.tools, network: manifest.profile.network, limits: manifest.limits }));
    if (!record.artifact) {
      require(record.status !== "completed" && typeof record.artifactUnavailableReason === "string" && record.assessment, "Failed output still needs an independent budget disposition");
      const assessment = JSON.parse(await read(evidenceRoot, record.assessment));
      require(assessment.kind === "design-partner-independent-failure-assessment" && assessment.independent === true && assessment.runId === record.runId && assessment.manifestSha256 === executionIdentity(manifest) && assessment.taskId === planned.primaryTaskId && assessment.artifactSha256 === null && assessment.instrumentationSha256 === studyHash(await fs.readFile(fileURLToPath(import.meta.url))) && typeof assessment.evaluatorId === "string" && assessment.evaluatorId && ![invocation.producer?.actor?.id, invocation.producer?.actor?.name, invocation.producer?.sessionId].includes(assessment.evaluatorId), "Invalid independent failed-output assessment");
      require(typeof assessment.repairBudget?.adherent === "boolean" && Number.isInteger(assessment.repairBudget.observedRounds) && typeof assessment.repairBudget.reason === "string" && assessment.repairBudget.reason.trim(), "Failure budget disposition is missing");
      result.ceilingsAdherent = assessment.repairBudget.adherent && assessment.repairBudget.observedRounds <= manifest.limits.repairRounds && assessment.repairBudget.observedRounds >= tools.filter(row => row.kind === "review-phase" && row.phase === "repair").length && actual.totalTurns <= manifest.limits.turnsPerRun && Object.values(actual.usage).reduce((sum, count) => sum + count, 0) <= manifest.limits.tokensPerRun && actual.apiEquivalentUsd <= manifest.limits.perRunApiEquivalentUsd && record.elapsedMs <= manifest.limits.millisecondsPerRun;
      result.taskSuccess = false; result.criticalUnresolved = true; result.complete = true; result.eligible = true; return result;
    }
    result.producingAgentBrowserUse = { initialized: tools.some(row => row.kind === "browser-initialized"), screenshotDelivered: tools.some(row => row.kind === "tool-result" && row.name === "browser" && row.result?.image?.deliveredAs === "MCP image content") };
    await read(evidenceRoot, record.artifact);
    if (record.artifact.kind === "repository") for (const file of record.artifact.files) await read(evidenceRoot, file);
    for (const file of record.artifact.supportFiles ?? []) await read(evidenceRoot, file);
    require(record.assessment, "Independent final-byte task assessment is missing");
    const assessment = JSON.parse(await read(evidenceRoot, record.assessment));
    require(assessment.kind === "design-partner-independent-assessment" && assessment.independent === true && typeof assessment.evaluatorId === "string" && assessment.evaluatorId && assessment.runId === record.runId && assessment.manifestSha256 === executionIdentity(manifest) && assessment.taskId === planned.primaryTaskId && assessment.artifactSha256 === record.artifact.sha256, "Independent task assessment has different provenance or output");
    require(assessment.instrumentationSha256 === studyHash(await fs.readFile(fileURLToPath(import.meta.url))), "Independent assessment instrumentation changed");
    require(![invocation.producer?.actor?.id, invocation.producer?.actor?.name, invocation.producer?.sessionId].includes(assessment.evaluatorId), "Producer cannot attest independent task success");
    const plan = JSON.parse(await read(evidenceRoot, assessment.plan));
    require(studyHash(JSON.stringify(plan)) === assessment.planSha256 && plan.independent === true && plan.evaluatorId === assessment.evaluatorId && plan.artifactSha256 === record.artifact.sha256, "Independent evaluator plan changed");
    require(typeof plan.repairBudget?.adherent === "boolean" && Number.isInteger(plan.repairBudget.observedRounds) && typeof plan.repairBudget.reason === "string" && plan.repairBudget.reason.trim(), "Independent evaluator repair-budget disposition is missing");
    result.ceilingsAdherent = plan.repairBudget.adherent && plan.repairBudget.observedRounds <= manifest.limits.repairRounds && plan.repairBudget.observedRounds >= tools.filter(row => row.kind === "review-phase" && row.phase === "repair").length && actual.totalTurns <= manifest.limits.turnsPerRun && Object.values(actual.usage).reduce((sum, count) => sum + count, 0) <= manifest.limits.tokensPerRun && actual.apiEquivalentUsd <= manifest.limits.perRunApiEquivalentUsd && record.elapsedMs <= manifest.limits.millisecondsPerRun;
    require(planned.viewports.every(viewport => task.primaryTask.steps.every((_, stepIndex) => assessment.evidence.some(row => row.kind === "screenshot" && row.viewport.width === viewport.width && row.viewport.height === viewport.height && row.stepIndex === stepIndex))), "Independent screenshots omit a frozen task step or viewport");
    require(Array.isArray(assessment.observations) && planned.viewports.every(viewport => assessment.observations.some(row => row.viewport.width === viewport.width && row.viewport.height === viewport.height)), "Independent observations omit a frozen viewport");
    const trace = JSON.parse(await read(evidenceRoot, assessment.evidence.find(row => row.kind === "task-trace")));
    studyAssessmentOutcomes(assessment, trace, task, planned.viewports);
    for (const evidence of assessment.evidence) await read(evidenceRoot, evidence);
    result.taskSuccess = assessment.status === "passed"; result.criticalUnresolved = !result.taskSuccess; result.complete = true; result.eligible = true;
    result.publicEvidence = assessment.evidence;
    result.assessment = { evaluatorId: assessment.evaluatorId, taskId: assessment.taskId, steps: assessment.observations.map(row => ({ stepIndex: row.stepIndex, result: row.result, viewport: row.viewport })), viewports: planned.viewports, status: assessment.status, artifactSha256: assessment.artifactSha256 };
  } catch (error) { reasons.push(error.message); }
  return result;
}
