/** Frozen creation inputs and evidence validation. This module has no provider or browser runtime. */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FIXTURES = fileURLToPath(new URL("../../test/fixtures/design-partner/", import.meta.url));
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const require = (ok, message) => { if (!ok) throw new Error(message); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const revision = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Fixture/evidence paths cannot leave their root, including through symlinks. */
export async function readContained(root, relative) {
  require(text(relative) && !path.isAbsolute(relative) && !relative.split(/[\\/]/).includes(".."), `Unsafe input path: ${relative}`);
  const [base, file] = await Promise.all([realpath(root), realpath(path.resolve(root, relative))]);
  require(file.startsWith(base + path.sep), `Input escapes root: ${relative}`);
  return readFile(file);
}

export async function loadBaseline(root = FIXTURES) {
  const base = path.join(root, "baseline");
  const bytes = await readContained(base, "baseline.json"), record = JSON.parse(bytes);
  require(record.schemaVersion === 1 && revision(record.sourceRevision) && text(record.procedureRevision), "Invalid baseline identity");
  require(record.runtime.sourceRevision === record.sourceRevision, "Baseline runtime revision differs");
  const contents = {};
  for (const file of record.files) {
    const value = await readContained(base, file.path);
    require(hash(value) === file.sha256, `Baseline hash mismatch: ${file.path}`);
    contents[file.path] = value.toString("utf8");
  }
  for (const name of ["summons.mjs", "agent-guide.md", "manual-commands.json", "collaboration-skill.md", "sheep.ts.txt"]) require(text(contents[name]), `Missing baseline resource: ${name}`);
  const commands = JSON.parse(contents["manual-commands.json"]);
  for (const name of ["design-system", "design-audit", "variation", "grill-me", "sprint"]) require(commands.some(command => command.name === name && text(command.body)), `Baseline omitted /${name}`);
  return { ...record, sha256: hash(bytes), contents, commands, directory: base };
}

export async function loadCorpus(root = FIXTURES) {
  const bytes = await readContained(root, "corpus.json"), corpus = JSON.parse(bytes);
  require(corpus.schemaVersion === 1 && corpus.synthetic === true && text(corpus.revision) && text(corpus.protocolRevision), "Invalid corpus identity");
  require(corpus.cases?.length === 12 && new Set(corpus.cases.map(row => row.id)).size === 12, "Exactly twelve distinct cases are required");
  require(same(corpus.entrances, ["canvas-chat", "external-agent"]) && same(corpus.repetitions, [1, 2]) && same(corpus.conditions, ["A", "B"]), "The frozen paired matrix changed");
  const tasks = [];
  for (const row of corpus.cases) {
    require(/^[a-z][a-z-]+$/.test(row.id) && row.task === `${row.id}/task.json`, "Invalid case path");
    const taskRoot = path.join(root, row.id), inputs = {};
    for (const [name, expectedHash] of Object.entries(row.sha256)) {
      const content = await readContained(taskRoot, name);
      require(digest(expectedHash) && hash(content) === expectedHash, `Fixture hash mismatch: ${row.id}/${name}`);
      inputs[name] = content.toString("utf8");
    }
    const task = JSON.parse(inputs["task.json"]);
    require(task.schemaVersion === 1 && task.id === row.id && text(task.instruction), `Invalid task: ${row.id}`);
    require(["standalone-html", "connected-app"].includes(task.deliveryType), `Invalid delivery: ${row.id}`);
    require(Array.isArray(task.files) && same([...task.files, "task.json"].sort(), Object.keys(inputs).sort()), `Incomplete file manifest: ${row.id}`);
    require(task.viewports?.length >= 2 && task.viewports.every(view => integer(view.width) && view.width > 0 && integer(view.height) && view.height > 0), `Missing viewports: ${row.id}`);
    require(object(task.knownFacts) && task.primaryTask?.steps?.length >= 3 && text(task.primaryTask.goal) && task.forbiddenRegressions?.length > 0, `Missing acceptance inputs: ${row.id}`);
    require(task.answerBank?.length > 0 && new Set(task.answerBank.map(answer => answer.id)).size === task.answerBank.length, `Invalid answer bank: ${row.id}`);
    for (const answer of task.answerBank) require(text(answer.id) && text(answer.questionMeaning) && text(answer.answer) && answer.availability === "on-question" && same(answer.appliesTo, ["A", "B", "C"]), `Unequal or invalid answer: ${row.id}`);
    require(inputs[task.initialSnapshot], `Missing snapshot: ${row.id}`);
    const snapshot = JSON.parse(inputs[task.initialSnapshot]);
    require(snapshot.schemaVersion === 1 && text(snapshot.canvasId) && Array.isArray(snapshot.items) && Array.isArray(snapshot.groups), `Invalid snapshot: ${row.id}`);
    require(new Set(snapshot.items.map(item => item.id)).size === snapshot.items.length, `Duplicate item identity: ${row.id}`);
    for (const item of snapshot.items) require(text(item.id) && text(item.versionId) && text(item.mime) && inputs[item.path] && snapshot.groups.some(group => group.id === item.scope), `Invalid initial item: ${row.id}/${item.id}`);
    for (const entrance of corpus.entrances) {
      const entry = task.entryPoints?.[entrance];
      require(entry?.requestingActor === "acme-human" && snapshot.groups.some(group => group.id === entry.targetGroupId), `Missing equivalent entrance: ${row.id}/${entrance}`);
      require(same(entry.selectedItemIds, snapshot.selectedItemIds) && entry.selectedItemIds.every(id => snapshot.items.some(item => item.id === id)), `Invalid selection: ${row.id}/${entrance}`);
    }
    require(Array.isArray(task.references), `Missing references: ${row.id}`);
    for (const reference of task.references) {
      if (reference.kind === "local") require(reference.state === "available" && inputs[reference.path] && snapshot.items.some(item => item.id === reference.itemId && item.versionId === reference.versionId && item.path === reference.path), `Reference identity mismatch: ${row.id}/${reference.id}`);
      else require(reference.kind === "url" && reference.state === "inaccessible" && text(reference.reason) && new URL(reference.url).hostname.endsWith(".invalid"), `Invalid unavailable reference: ${row.id}`);
    }
    if (task.deliveryType === "connected-app") require(snapshot.repository?.files?.every(file => inputs[file]) && same(snapshot.repository.start, ["npm", "start"]), `Missing runnable repository: ${row.id}`);
    tasks.push({ ...task, snapshot, inputs, fixtureSha256: hash(JSON.stringify(row.sha256)), contextManifestSha256: hash(JSON.stringify({ snapshot, hashes: row.sha256 })), hashes: row.sha256 });
  }
  require(corpus.smokeCaseIds?.length === 4 && corpus.smokeCaseIds.every(id => tasks.some(task => task.id === id)), "Four valid smoke cases are required");
  return { ...corpus, sha256: hash(bytes), tasks };
}

/** The evaluator maps meaning to a stable fact key and records the original question. No arm gets secret facts. */
export function answerFromBank(task, questionId) {
  const answer = task.answerBank.find(row => row.id === questionId);
  return answer ? { questionId, answer: answer.answer, source: `${task.id}/answer-bank`, availability: answer.availability } : null;
}

/** A callable preserved adapter, not a generated design. Guide/commands remain on-demand resources. */
export async function renderBaselineEnvelope(task, entrance, baseline, { canvasTitle = task.title, agentName = "Acme Agent" } = {}) {
  require(["canvas-chat", "external-agent"].includes(entrance), "Unknown entrance");
  const entry = task.entryPoints[entrance];
  const payload = { reason: "activity", entries: [{ seq: 1, canvasId: task.snapshot.canvasId, canvasTitle,
    envelope: { id: `${task.id}-request-op`, canvasId: task.snapshot.canvasId, actor: { id: "acme-human", name: "Acme Evaluator" }, ts: "2026-09-14T00:00:00.000Z",
      op: { type: "thread.create", main: true, x: 0, y: 0, anchorItemId: null, threadId: entry.threadId ?? `${task.id}-main`, comment: { id: `${task.id}-request`, body: task.instruction, items: entry.selectedItemIds } } }, inverse: null }] };
  // Only the hashed, preserved pure function is imported; no current workflow code is used.
  const { summonsPrompt } = await import(pathToFileURL(path.join(baseline.directory, "summons.mjs")).href);
  const prompt = entrance === "canvas-chat" ? summonsPrompt(canvasTitle, agentName, payload) : task.instruction;
  return { schemaVersion: 1, kind: "baseline-invocation", entrance, fixtureId: task.id,
    procedureRevision: baseline.procedureRevision, sourceRevision: baseline.sourceRevision, baselineSha256: baseline.sha256,
    messages: [{ role: "user", content: prompt }],
    resourceDelivery: "Keep the same harness discovery and tools in matched conditions. The guide, all manual commands and references are available on demand; they are not an injected design workflow.",
    resources: { guide: baseline.contents["agent-guide.md"], collaborationSkill: baseline.contents["collaboration-skill.md"], manualCommands: baseline.commands,
      knownFacts: task.knownFacts, initialSnapshot: task.snapshot, inputFiles: Object.fromEntries(Object.entries(task.inputs).filter(([name]) => !["task.json", "snapshot.json"].includes(name))) },
    evaluatorOnly: { answerBankPath: `${task.id}/task.json#answerBank`, answerRule: "Supply the same matching fact on question in either condition; record the question and answer. Never inject this bank or task scoring invariants into the initial prompt." },
    runtime: { ...baseline.runtime, executable: "node", args: ["<baseline-checkout>/packages/cli/bin/isocan.js"], cwd: "<isolated-fixture-workspace>", selectedGroupId: entry.targetGroupId },
    execution: { executed: false, providerCalls: 0, costUsd: 0, browser: "not-probed", qualityEvidence: null } };
}

export function createManifest(corpus, baseline, { includeC = null, study = "full", seed = "design-partner-v1" } = {}) {
  require(includeC === null || ["native", "adapted"].includes(includeC), "C must explicitly name native or adapted Impeccable use");
  require(["full", "smoke"].includes(study) && text(seed), "Choose full or smoke study and a seed");
  const tasks = study === "smoke" ? corpus.tasks.filter(task => corpus.smokeCaseIds.includes(task.id)) : corpus.tasks;
  const repetitions = study === "smoke" ? [1] : corpus.repetitions;
  const conditions = includeC ? ["A", "B", "C"] : ["A", "B"];
  const pairs = tasks.flatMap(task => corpus.entrances.flatMap(entrance => repetitions.map(repetition => ({ task, entrance, repetition }))));
  // Hash sorting is deterministic without borrowing the repair pilot's fixed 36-row schedule.
  pairs.sort((a, b) => hash(`${seed}/${a.task.id}/${a.entrance}/${a.repetition}`).localeCompare(hash(`${seed}/${b.task.id}/${b.entrance}/${b.repetition}`)));
  const runs = pairs.flatMap(({ task, entrance, repetition }) => {
    const pairId = `${task.id}/${entrance}/${repetition}`;
    const order = [...conditions].sort((a, b) => hash(`${seed}/${pairId}/${a}`).localeCompare(hash(`${seed}/${pairId}/${b}`)));
    return order.map(condition => ({ runId: `${pairId}/${condition}`, pairId, fixtureId: task.id, entrance, repetition, condition,
      fixtureSha256: task.fixtureSha256, contextManifestSha256: task.contextManifestSha256,
      contextItems: task.snapshot.items.map(item => ({ itemId: item.id, versionId: item.versionId, blobSha256: task.hashes[item.path] })),
      repositorySnapshotSha256: task.snapshot.repository ? hash(JSON.stringify({ repository: task.snapshot.repository, files: Object.fromEntries(task.snapshot.repository.files.map(file => [file, task.hashes[file]])) })) : null,
      deliveryType: task.deliveryType, primaryTaskId: task.primaryTask.id, viewports: task.viewports, status: "planned" }));
  });
  return { schemaVersion: 1, kind: "design-partner-manifest", mode: "dry-run", protocolRevision: corpus.protocolRevision, corpusRevision: corpus.revision, corpusSha256: corpus.sha256,
    baseline: { sourceRevision: baseline.sourceRevision, procedureRevision: baseline.procedureRevision, sha256: baseline.sha256 },
    candidate: { sourceRevision: null, procedureRevision: null, reason: "Freeze the implemented candidate before actual execution; phase 0 only prepares inputs." },
    impeccable: includeC ? { mode: includeC, sourceRevision: corpus.optionalCondition.sourceRevision } : null,
    study, seed, conditions, entrances: corpus.entrances, caseIds: tasks.map(task => task.id), repetitions, plannedRuns: runs.length,
    execution: { executed: false, provider: { used: false, name: null, model: null }, providerCalls: 0, costUsd: 0, browser: "not-probed", imageGeneration: "not-probed", qualityEvidence: null },
    ceilings: { authorized: false, totalUsd: null, perRunUsd: null, tokensPerRun: null, millisecondsPerRun: null, repairRounds: 2, reason: "No paid execution is authorized or implemented by this offline command." },
    runs };
}

export function validateDryManifest(manifest) {
  require(manifest?.schemaVersion === 1 && manifest.kind === "design-partner-manifest" && manifest.mode === "dry-run", "Not a dry-run manifest");
  require(text(manifest.protocolRevision) && text(manifest.corpusRevision) && digest(manifest.corpusSha256), "Missing protocol/corpus identity");
  require(revision(manifest.baseline?.sourceRevision) && text(manifest.baseline?.procedureRevision) && digest(manifest.baseline?.sha256), "Missing baseline identity");
  require(["full", "smoke"].includes(manifest.study) && text(manifest.seed), "Unknown study or missing seed");
  require(same(manifest.entrances, ["canvas-chat", "external-agent"]), "Both exact entrances are required");
  require(same(manifest.conditions, ["A", "B"]) || same(manifest.conditions, ["A", "B", "C"]), "A/B are required; C is the only optional arm");
  require(same(manifest.repetitions, manifest.study === "smoke" ? [1] : [1, 2]), "Full/smoke repetitions changed");
  require(Array.isArray(manifest.caseIds) && manifest.caseIds.every(id => /^[a-z][a-z-]+$/.test(id)) && new Set(manifest.caseIds).size === manifest.caseIds.length, "Invalid or duplicate case identity");
  if (manifest.conditions.includes("C")) require(["native", "adapted"].includes(manifest.impeccable?.mode) && revision(manifest.impeccable?.sourceRevision), "C requires package revision and explicit mode");
  else require(manifest.impeccable === null, "A/B cannot contain a hidden package condition");
  require(manifest.execution?.executed === false && manifest.execution.provider?.used === false && manifest.execution.providerCalls === 0 && manifest.execution.costUsd === 0 && manifest.execution.qualityEvidence === null, "A dry run cannot contain provider use or quality evidence");
  require(manifest.execution.provider.name === null && manifest.execution.provider.model === null && manifest.ceilings?.authorized === false, "Dry preparation cannot select a provider or authorize spending");
  require(manifest.execution.browser === "not-probed" && manifest.execution.imageGeneration === "not-probed", "Dry run cannot claim capability inspection");
  require(Array.isArray(manifest.runs) && manifest.runs.length === manifest.plannedRuns && new Set(manifest.runs.map(run => run.runId)).size === manifest.plannedRuns, "Incomplete or duplicated dry-run matrix");
  const expected = manifest.caseIds.length * manifest.entrances.length * manifest.repetitions.length * manifest.conditions.length;
  require(expected === manifest.plannedRuns && manifest.caseIds.length === (manifest.study === "smoke" ? 4 : 12), "Unexpected dry-run matrix size");
  const keys = new Set(manifest.runs.map(run => run.runId));
  for (const id of manifest.caseIds) for (const entrance of ["canvas-chat", "external-agent"]) for (const repetition of manifest.repetitions) for (const condition of manifest.conditions) require(keys.has(`${id}/${entrance}/${repetition}/${condition}`), "Missing matched cell");
  for (const run of manifest.runs) {
    require(run.status === "planned" && !Object.hasOwn(run, "artifact") && !Object.hasOwn(run, "quality") && !Object.hasOwn(run, "taskSuccess"), "Dry-run rows cannot be scored as outputs");
    require(run.pairId === `${run.fixtureId}/${run.entrance}/${run.repetition}` && run.runId === `${run.pairId}/${run.condition}` && manifest.caseIds.includes(run.fixtureId) && manifest.entrances.includes(run.entrance) && manifest.conditions.includes(run.condition) && manifest.repetitions.includes(run.repetition), "Row identity disagrees with matrix");
    require(digest(run.fixtureSha256) && digest(run.contextManifestSha256) && text(run.primaryTaskId) && ["standalone-html", "connected-app"].includes(run.deliveryType), "Missing row input identity");
    require(Array.isArray(run.contextItems) && run.contextItems.length > 0 && new Set(run.contextItems.map(item => item.itemId)).size === run.contextItems.length, "Missing or duplicate seeded context");
    for (const item of run.contextItems) require(text(item.itemId) && text(item.versionId) && digest(item.blobSha256), "Invalid seeded context identity");
    require(run.deliveryType === "connected-app" ? digest(run.repositorySnapshotSha256) : run.repositorySnapshotSha256 === null, "Missing repository snapshot identity");
    require(run.viewports?.length >= 2 && run.viewports.every(view => integer(view.width) && view.width > 0 && integer(view.height) && view.height > 0), "Missing viewport contract");
  }
  return { valid: true, kind: "preparation-only", plannedRuns: manifest.plannedRuns, providerCalls: 0, qualityEvidence: false };
}

/** Checking hashes only against themselves is not input validation: reconstruct from actual frozen files. */
export async function validateManifestInputs(manifest, fixturesRoot = FIXTURES) {
  const summary = validateDryManifest(manifest);
  const [corpus, baseline] = await Promise.all([loadCorpus(fixturesRoot), loadBaseline(fixturesRoot)]);
  const expected = createManifest(corpus, baseline, { study: manifest.study, seed: manifest.seed, includeC: manifest.impeccable?.mode ?? null });
  require(same(manifest, expected), "Manifest differs from the frozen corpus, baseline, or preparation policy");
  return summary;
}

/** Shape and association validation cannot certify the truth of browser or human observations. */
export function validateActualResult(result, manifest) {
  require(object(result) && result.schemaVersion === 1 && result.mode === "actual", "Actual result must explicitly declare mode=actual");
  const planned = manifest.runs.find(run => run.runId === result.runId);
  require(planned, "Unknown run identity");
  for (const key of ["fixtureId", "entrance", "repetition", "condition", "fixtureSha256"]) require(result[key] === planned[key], `Result identity mismatch: ${key}`);
  require(text(result.requestId) && result.protocolRevision === manifest.protocolRevision && revision(result.sourceRevision) && digest(result.promptSha256) && text(result.procedureRevision), "Missing request/source/prompt identity");
  if (result.condition === "A") require(result.sourceRevision === manifest.baseline.sourceRevision && result.procedureRevision === manifest.baseline.procedureRevision, "Baseline procedure or runtime changed");
  require(object(result.context) && result.context.manifestSha256 === planned.contextManifestSha256 && Array.isArray(result.context.items), "Missing or mismatched context identity");
  for (const item of result.context.items) require(text(item.itemId) && text(item.versionId) && digest(item.blobSha256), "Invalid context item/version/blob identity");
  if (result.context.state === "available") {
    require(same([...result.context.items].sort((a, b) => a.itemId.localeCompare(b.itemId)), [...planned.contextItems].sort((a, b) => a.itemId.localeCompare(b.itemId))), "Actual context differs from the expected seeded item/version/blob identities");
    require(result.context.repositorySnapshotSha256 === planned.repositorySnapshotSha256, "Repository context changed");
  } else require(result.context.state === "unavailable" && result.status !== "completed" && result.context.items.length === 0 && text(result.context.unavailableReason), "Missing context must be an explicit unsuccessful attempt");
  const provider = result.provider;
  require(object(provider) && text(provider.name) && text(provider.requestedModel) && integer(provider.calls) && typeof provider.used === "boolean" && provider.used === (provider.calls > 0), "Explicit provider/model/call identity is required");
  require((text(provider.resolvedModel) && text(provider.modelRevision)) || (provider.resolvedModel === null && provider.modelRevision === null && text(provider.unavailableReason) && result.status !== "completed"), "Missing resolved model identity");
  require(object(result.capabilities) && text(result.capabilities.harness) && text(result.capabilities.harnessRevision) && Array.isArray(result.capabilities.tools), "Missing harness capabilities");
  for (const kind of ["browser", "imageGeneration", "repositoryRuntime"]) require(["available", "unavailable", "not-used"].includes(result.capabilities[kind]?.status) && text(result.capabilities[kind]?.reason), `Explicit ${kind} capability is required`);
  require(object(result.cost) && result.cost.currency === "USD" && result.cost.authorized === true && Number.isFinite(result.cost.ceilingUsd) && result.cost.ceilingUsd >= 0, "Explicit authorized cost ceiling is required");
  for (const key of ["modelUsd", "toolUsd"]) require((Number.isFinite(result.cost[key]) && result.cost[key] >= 0) || (result.cost[key] === null && text(result.cost.unknownReason)), `Explicit ${key} or unavailable reason is required`);
  require(object(result.tokens), "Token accounting must be explicit");
  for (const key of ["input", "output", "cached"]) require(integer(result.tokens[key]) || (result.tokens[key] === null && text(result.tokens.unavailableReason)), `Missing ${key} token accounting`);
  require(object(result.ceilings) && integer(result.ceilings.tokens) && result.ceilings.tokens > 0 && integer(result.ceilings.milliseconds) && result.ceilings.milliseconds > 0 && integer(result.ceilings.repairRounds) && result.ceilings.repairRounds <= 2, "Missing fixed run ceilings");
  require(["completed", "failed", "timed-out", "abandoned", "unavailable"].includes(result.status), "Failure and timeout are explicit outcomes");
  require(Number.isFinite(Date.parse(result.startedAt)) && Number.isFinite(Date.parse(result.endedAt)) && Date.parse(result.endedAt) >= Date.parse(result.startedAt), "Invalid run times");
  require(result.timeToFirstUsefulVisualMs === null || integer(result.timeToFirstUsefulVisualMs), "First visual time must be explicit");
  require(integer(result.repairRounds) && result.repairRounds <= result.ceilings.repairRounds && Array.isArray(result.unresolvedFailures) && Array.isArray(result.answers) && Array.isArray(result.checks), "Missing transcript, failures or checks");
  for (const answer of result.answers) require(text(answer.question) && text(answer.factId) && text(answer.answer) && text(answer.askedAt), "Incomplete question transcript");
  require(typeof result.ready === "boolean", "Readiness must be explicit");
  require(text(result.comparisonStratum), "Capability/model strata must be explicit");
  if (result.status !== "completed") require(text(result.failureReason) && result.ready === false, "Failed runs need a reason and cannot be ready");
  if (result.artifact !== null) {
    const artifact = result.artifact;
    require(object(artifact) && digest(artifact.sha256) && text(artifact.path), "Missing artifact identity");
    if (planned.deliveryType === "connected-app") require(artifact.kind === "repository" && revision(artifact.repositoryRevision) && text(artifact.buildId) && text(artifact.runtimeId), "Connected output needs repository/build/runtime identity");
    else require(artifact.kind === "canvas-item" && text(artifact.itemId) && text(artifact.versionId) && artifact.blobSha256 === artifact.sha256, "Output needs item/version/blob identity");
  }
  if (result.status === "completed") require(result.artifact !== null, "Completed output is missing artifact identity");
  if (result.artifact === null) require(result.status !== "completed" && text(result.artifactUnavailableReason), "Unavailable artifact needs an explicit failed outcome and reason");
  for (const check of result.checks) require(["source", "browser-task", "browser-layout", "craft"].includes(check.kind) && ["passed", "failed", "unavailable"].includes(check.result) && ["current", "historical"].includes(check.evidenceRole) && text(check.tool) && text(check.toolRevision) && digest(check.artifactSha256) && digest(check.contextManifestSha256) && text(check.evidencePath) && digest(check.evidenceSha256), "Incomplete check evidence identity");
  if (result.ready) {
    require(result.status === "completed" && result.capabilities.browser.status === "available" && result.unresolvedFailures.length === 0, "Ready requires an inspected result without unresolved failures");
    const sameInputs = check => check.artifactSha256 === result.artifact.sha256 && check.contextManifestSha256 === result.context.manifestSha256;
    require(!result.checks.some(check => sameInputs(check) && check.result === "failed"), "Ready cannot retain a failed check for the current artifact/context");
    require(result.checks.every(check => sameInputs(check) || check.evidenceRole === "historical"), "Stale checks must be explicitly separated as historical evidence");
    const current = check => check.evidenceRole === "current" && check.result === "passed" && sameInputs(check);
    require(result.checks.some(check => current(check) && check.kind === "browser-task" && check.primaryTaskId === planned.primaryTaskId), "Ready requires current primary-task evidence");
    for (const viewport of planned.viewports) require(result.checks.some(check => current(check) && check.kind === "browser-layout" && same(check.viewport, viewport)), "Ready requires current evidence for every agreed viewport");
  }
  require(object(result.quality) && result.quality.status === "unmeasured", "Human quality ratings are a separate review instrument; this validator cannot create them");
  if (result.condition === "C") require(manifest.impeccable && same(result.impeccable, manifest.impeccable), "C package/mode identity is missing or changed");
  else require(result.impeccable === null, "A/B must not silently include Impeccable");
  return result;
}

/** Missing attempts remain visible in the denominator; terminal failures are retained and counted. */
export async function validateResultSet(report, manifest, evidenceRoot, fixturesRoot = FIXTURES) {
  await validateManifestInputs(manifest, fixturesRoot);
  require(report?.schemaVersion === 1 && report.kind === "design-partner-results" && report.mode === "actual" && Array.isArray(report.records), "Expected an actual result set");
  require(report.manifestSha256 === hash(JSON.stringify(manifest)), "Result set belongs to another manifest");
  const seen = new Set(), counts = {};
  let knownCostUsd = 0, unknownCostRuns = 0;
  for (const row of report.records) {
    validateActualResult(row, manifest);
    require(!seen.has(row.runId), "Duplicated result would distort the denominator"); seen.add(row.runId);
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    if (row.cost.modelUsd === null || row.cost.toolUsd === null) unknownCostRuns++;
    knownCostUsd += (row.cost.modelUsd ?? 0) + (row.cost.toolUsd ?? 0);
    const files = [...(row.artifact ? [{ path: row.artifact.path, sha256: row.artifact.sha256 }] : []), ...row.checks.map(check => ({ path: check.evidencePath, sha256: check.evidenceSha256 }))];
    for (const file of files) require(hash(await readContained(evidenceRoot, file.path)) === file.sha256, `Evidence hash mismatch: ${file.path}`);
  }
  const missingRunIds = manifest.runs.filter(run => !seen.has(run.runId)).map(run => run.runId);
  const pairSignatures = new Map(), unmatchedPairIds = new Set();
  for (const row of report.records) {
    const pairId = manifest.runs.find(run => run.runId === row.runId).pairId;
    const signature = JSON.stringify({ stratum: row.comparisonStratum, model: [row.provider.name, row.provider.requestedModel, row.provider.resolvedModel, row.provider.modelRevision], capabilities: row.capabilities, ceilings: row.ceilings, costCeiling: row.cost.ceilingUsd });
    if (pairSignatures.has(pairId) && pairSignatures.get(pairId) !== signature) unmatchedPairIds.add(pairId);
    pairSignatures.set(pairId, signature);
  }
  return { valid: true, validity: "evidence-shape-and-file-integrity", comparisonEligible: false,
    comparisonIneligibleReasons: ["Phase 0 has only a dry preparation manifest, not an authorized frozen execution manifest.", "The candidate source/procedure and common model/capability/resource specifications remain unfrozen.", ...(unmatchedPairIds.size ? ["Some pairs differ in model, capabilities, stratum or ceilings."] : [])],
    status: missingRunIds.length ? "incomplete" : "recorded", plannedRuns: manifest.plannedRuns, attemptedRuns: seen.size, outcomes: counts, missingRunIds, unmatchedPairIds: [...unmatchedPairIds], knownCostUsd, unknownCostRuns, totalCostUsd: unknownCostRuns ? null : knownCostUsd, qualityEvidence: false };
}
