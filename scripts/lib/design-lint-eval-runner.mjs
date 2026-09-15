/** Local host for the frozen correction pilot; all writes use the shipped API. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm, rename, realpath, open } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildPrompt, cannedCandidate, CostLedger, invokeModel, MODEL_SPEC, modelInvocation, modelPreflight, parseCandidate } from "./design-lint-eval-model.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const defaultFixtures = path.join(repo, "test/fixtures/design-lint-eval");
export const inputHash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = async (file, value) => { const temporary = `${file}.tmp`; await writeFile(temporary, JSON.stringify(value, null, 2) + "\n"); await rename(temporary, file); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
async function browserInputsReady(evidence, task, html) {
  if (!evidence?.available || evidence.inputHash !== inputHash(html) || !same(evidence.viewports?.map(row => row.viewport), task.viewports)) return false;
  try { for (const viewport of evidence.viewports) { const bytes = await readFile(viewport.screenshot); if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false; } return true; }
  catch { return false; }
}

/** Seed both pair order and within-pair arm order without changing the 36-run design. */
export function scheduleRuns(taskIds, seed) {
  if (taskIds.length !== 6 || new Set(taskIds).size !== 6 || !seed) throw new Error("The pilot requires six distinct tasks and a recorded seed.");
  let state = Number.parseInt(inputHash(String(seed)).slice(0, 8), 16);
  const random = () => { state += 0x6d2b79f5; let x = state; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const pairs = taskIds.flatMap(taskId => [1, 2, 3].map(repetition => ({ taskId, repetition })));
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  return pairs.flatMap(pair => (random() < 0.5 ? ["rules-only", "diagnostics"] : ["diagnostics", "rules-only"]).map(condition => ({ ...pair, condition }))).map((run, index) => ({ ...run, runId: `run-${String(index + 1).padStart(2, "0")}`, order: index + 1 }));
}

/** Select the dry provider structurally, so dry mode cannot reach model invocation. */
export function selectCandidateProvider(mode, providers = { dry: cannedCandidate, model: invokeModel }) {
  if (mode === "dry-run") return providers.dry;
  if (mode === "model") return providers.model;
  throw new Error("Choose explicit --dry-run or --model mode.");
}

/** Persist the reserved call before provider dispatch and its reported outcome before continuation. */
export async function requestCandidate({ provider, ledger, attempt, save, providerArgs }) {
  const allowance = ledger?.begin(); attempt.allowance = allowance ?? null;
  await save();
  let result;
  try { result = await provider({ ...providerArgs, allowance }); }
  catch { result = { candidateText: null, apiEquivalentCost: null, stopReason: "Provider invocation failed without a confirmed outcome.", elapsedMs: null }; }
  attempt.provider = result;
  if (ledger) ledger.finish(result.apiEquivalentCost, allowance, result.stopReason);
  await save();
  return result;
}

/** Load literal files once and hash exactly the bytes retained as evaluation inputs. */
export async function loadEvalTasks(root = defaultFixtures) {
  const directories = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const tasks = [];
  for (const directory of directories) {
    const taskDir = path.join(root, directory), taskBytes = await readFile(path.join(taskDir, "task.json"));
    const task = JSON.parse(taskBytes.toString("utf8"));
    assert.equal(task.schemaVersion, 1); assert.equal(task.id, directory);
    const files = {}, hashes = { "task.json": inputHash(taskBytes) };
    for (const [name, filename] of Object.entries(task.files)) {
      assert.equal(path.basename(filename), filename, "Fixture input must remain in its task directory");
      const bytes = await readFile(path.join(taskDir, filename));
      files[name] = bytes.toString("utf8"); assert(Buffer.from(files[name]).equals(bytes), "Fixture must be valid UTF-8"); hashes[filename] = inputHash(bytes);
    }
    tasks.push({ ...task, initialHtml: files.initial, repairedHtml: files.repaired, design: files.design, adjacentDesign: files.adjacentDesign ?? null, fixtureHashes: hashes });
  }
  assert.equal(tasks.length, 6, "Frozen pilot has exactly six tasks");
  return tasks;
}

/** Read-only validation for the single documented pre-model refusal; no general run restart. */
export async function readContinuation(priorDirectory, { budgetUsd, model, seed, fixtures }) {
  const directory = await realpath(priorDirectory), reportBytes = await readFile(path.join(directory, "report.json"));
  const prior = JSON.parse(reportBytes.toString("utf8"));
  const require = (condition, reason) => { if (!condition) throw new Error(`Continuation refused: ${reason}`); };
  require(budgetUsd === 10 && prior.accounting?.cap === 10, "the original approved aggregate is exactly $10.");
  require(model === MODEL_SPEC.model && same(prior.model, MODEL_SPEC) && prior.modelSpecSha256 === inputHash(JSON.stringify(MODEL_SPEC)), "model specification changed.");
  require(prior.seed === seed && same(prior.fixtures, fixtures), "seed or frozen fixture hashes changed.");
  require(prior.mode === "model" && prior.status === "unavailable" && prior.modelCalls === 1 && !prior.continuation, "only the initial one-invocation failed model run is eligible.");
  const account = prior.accounting;
  require(account.calls === 1 && account.pending === false && account.reportedApiEquivalent === 0 && account.knownReportedSubtotal === 0 && account.fixedPerCall === 0.138888888 && typeof account.stopped === "string", "pending, unknown, changed or nonzero accounting cannot restart.");
  require(prior.runs?.length === 1 && prior.runs[0].attempts?.length === 1, "a measured or partially completed comparison cannot restart.");
  const run = prior.runs[0], attempt = run.attempts[0];
  require(/^run-\d{2}$/.test(run.runId) && attempt.round === 1 && !attempt.receipt && !attempt.accepted && !attempt.complete, "the prior invocation must not have produced an accepted repair.");
  require(same(prior.order, scheduleRuns(fixtures.map(task => task.id), seed)) && same(prior.order[0], { taskId: run.taskId, repetition: run.repetition, condition: run.condition, runId: run.runId, order: run.order }), "the prior comparison schedule changed.");
  const providerRelativePath = `${run.runId}/attempt-1/provider.json`, providerBytes = await readFile(path.join(directory, providerRelativePath)), provider = JSON.parse(providerBytes.toString("utf8"));
  require(same(provider, attempt.provider), "provider file and report disagree.");
  require(provider.provider === "claude-cli" && provider.modelCalls === 1 && provider.exitCode === 1 && provider.signal === null && provider.apiEquivalentCost === 0 && provider.candidateText === "Not logged in · Please run /login" && Array.isArray(provider.models) && provider.models.length === 0, "the outcome is not the known pre-model login refusal.");
  require(["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"].every(key => provider.usage?.[key] === 0), "all reported token counts must be known zero.");
  require(attempt.allowance === account.fixedPerCall && same(provider.invocation?.args, modelInvocation(account.fixedPerCall).args), "the original per-call/tool constraints changed.");
  return { kind: "zero-token-login-refusal", priorDirectory: directory, priorReportSha256: inputHash(reportBytes), priorProviderRelativePath: providerRelativePath, priorProviderSha256: inputHash(providerBytes), priorInvocations: 1, priorReportedApiEquivalent: 0, fixedPerCall: account.fixedPerCall,
    approvedAggregate: 10, approvedMaxInvocations: 72, maxAdditionalInvocations: 71, seed, modelSpecSha256: prior.modelSpecSha256,
    comparisonBoundary: "Fresh 36 comparison rows; the zero-token login refusal remains in aggregate invocation lineage, outside model-effect rows." };
}

/** Atomically reserve the only continuation branch after free checks, retaining prior evidence. */
export async function claimContinuation(continuation, { outputDir, readinessPassed, auth }) {
  if (!readinessPassed || !auth?.available || auth.loggedIn !== true) throw new Error("Continuation claim requires completed free readiness and isolated authentication checks.");
  const priorReport = await readFile(path.join(continuation.priorDirectory, "report.json"));
  const priorProvider = await readFile(path.join(continuation.priorDirectory, continuation.priorProviderRelativePath));
  if (inputHash(priorReport) !== continuation.priorReportSha256 || inputHash(priorProvider) !== continuation.priorProviderSha256) throw new Error("Prior continuation evidence changed during readiness checks.");
  const claimPath = path.join(continuation.priorDirectory, "continuation-claim.json");
  const claim = { schemaVersion: 1, kind: continuation.kind, outputDirectory: await realpath(outputDir), priorReportSha256: continuation.priorReportSha256, priorProviderSha256: continuation.priorProviderSha256, approvedAggregate: 10, approvedMaxInvocations: 72, fixedPerCall: 0.138888888, priorInvocations: 1, maxAdditionalInvocations: 71, createdAt: new Date().toISOString() };
  const contents = JSON.stringify(claim, null, 2) + "\n";
  let handle;
  try { handle = await open(claimPath, "wx", 0o600); await handle.writeFile(contents); await handle.sync(); }
  catch (error) { if (error.code === "EEXIST") throw new Error("A continuation branch already claimed this remaining budget; no additional invocation is allowed."); throw error; }
  finally { await handle?.close(); }
  return { path: claimPath, sha256: inputHash(contents), ...claim };
}

/** Match preregistered findings, preserving false positives separately from missing seeds. */
export function checkInitial(task, audit) {
  const actual = (audit?.diagnostics ?? []).map(({ code, property, actual }) => ({ code, property, actual }));
  const expected = task.expected.initialDiagnostics;
  const key = value => JSON.stringify(value);
  const unmatched = actual.slice();
  const missing = expected.filter(value => { const at = unmatched.findIndex(one => key(one) === key(value)); if (at < 0) return true; unmatched.splice(at, 1); return false; });
  return { ready: audit?.status === "audited" && missing.length === 0 && unmatched.length === 0 && audit.coverage.complete === task.expected.initialCoverageComplete && audit.coverage.checkedValues > 0 && audit.coverage.omittedCategories.length === 0, expected, actual, missing, falsePositives: unmatched, coverage: audit?.coverage ?? null };
}

/** Classify explicit non-HTML fields without inferring intent from CSS edits inside HTML. */
export function candidateScope(text) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { attemptedPolicyEdit: null, extraFields: [], reason: "Candidate intent unavailable." };
    const extraFields = Object.keys(value).filter(key => key !== "html");
    return { attemptedPolicyEdit: extraFields.some(key => /design|policy|tokens|governing/i.test(key)) ? true : extraFields.length ? null : false, extraFields };
  } catch { return { attemptedPolicyEdit: null, extraFields: [], reason: "Invalid candidate JSON; policy-edit intent unavailable." }; }
}

let loadedApi;
async function apiModules() {
  if (loadedApi) return loadedApi;
  loadedApi = (async () => {
  const { register } = await import("tsx/esm/api"); register();
  const [{ startDaemon }, { CanvasHandle }, { DaemonClient }, core] = await Promise.all([
    import("../../packages/server/src/daemon.ts"), import("../../packages/api/src/connect.ts"), import("../../packages/api/src/client.ts"), import("../../packages/core/src/index.ts"),
  ]);
  return { startDaemon, CanvasHandle, DaemonClient, core };
  })();
  return loadedApi;
}

/** Every run owns a fresh file-backed daemon and actual scoped canvas; no shared account state. */
export async function createEvalHost(task) {
  const { startDaemon, CanvasHandle, DaemonClient, core } = await apiModules();
  const home = await mkdtemp(path.join(tmpdir(), "isocan-design-eval-"));
  const previousStore = process.env.ISOCAN_STORE; process.env.ISOCAN_STORE = "file";
  let daemon;
  try { daemon = await startDaemon({ port: 0, host: "127.0.0.1", home, birthHome: null, auth: null, operators: [], contentPort: "off" }); }
  catch (error) { await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); throw error; }
  finally { if (previousStore === undefined) delete process.env.ISOCAN_STORE; else process.env.ISOCAN_STORE = previousStore; }
  const close = async () => { daemon.app.server.closeAllConnections(); await daemon.close(); await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); };
  try {
    const client = new DaemonClient(`http://127.0.0.1:${daemon.app.server.address().port}`, home);
    const session = "acme:design-eval";
    await client.claimActor({ type: "actor.claim", sessionKey: session, name: "Acme Evaluation" });
    const actor = (await client.actorBindings([session]))[0].actor;
    const ctx = { client, actor, home, harness: "acme", birthHome: null, binding: null, homeOf: async () => null, homes: async () => ({ birth: null, links: [], rows: {}, legacy: false, rowFor: () => null }) };
    const id = core.newCanvasId();
    await client.sendOp(null, actor, { type: "project.create", canvasId: id, title: "Acme evaluation", groupMode: "groups" });
    const canvas = new CanvasHandle(ctx, (await client.snapshot(id)).project);
    let selectedGroup, adjacentGroup;
    if (task.scope.kind === "group") {
      selectedGroup = (await canvas.groups.new(task.scope.groupTitle)).itemId;
      adjacentGroup = (await canvas.groups.new(task.scope.adjacentGroupTitle)).itemId;
    }
    const system = await canvas.add({ title: "Acme DESIGN.md", filename: "DESIGN.md", content: task.design, mime: "text/markdown", properties: core.designSystemProperties(), ...(selectedGroup ? { in: selectedGroup } : {}) });
    const protectedIds = [system.id];
    if (task.adjacentDesign) protectedIds.push((await canvas.add({ title: "Acme adjacent DESIGN.md", filename: "DESIGN.md", content: task.adjacentDesign, mime: "text/markdown", properties: core.designSystemProperties(), in: adjacentGroup })).id);
    const screen = await canvas.add({ title: "Acme task screen", filename: "screen.html", content: task.initialHtml, mime: "text/html", size: { width: 390, height: 844 }, ...(selectedGroup ? { in: selectedGroup } : {}) });
    const readStored = async () => {
      const item = await canvas.item(screen.id), version = item.versions.find(one => one.id === item.currentVersionId);
      const bytes = await client.downloadBlob(id, version.blobHash), html = bytes.toString("utf8");
      assert(Buffer.from(html).equals(bytes), "Stored HTML must retain exact UTF-8 bytes");
      return { item, version, html, sha256: inputHash(bytes) };
    };
    const protectedState = async () => Promise.all(protectedIds.map(async itemId => {
      const item = await canvas.item(itemId);
      const blobs = await Promise.all(item.versions.map(async version => { const bytes = await client.downloadBlob(id, version.blobHash); return { versionId: version.id, blobHash: version.blobHash, sha256: inputHash(bytes), text: bytes.toString("utf8") }; }));
      return { item, blobs };
    }));
    const audit = async () => { const report = await canvas.designAudit({ itemIds: [screen.id] }); const selected = report.items.find(one => one.itemId === screen.id); if (selected?.governing?.itemId !== system.id) throw new Error("The actual resolver did not select the frozen governing lane."); return selected; };
    return { canvas, client, actor, screen, system, readStored, protectedState, audit, close };
  } catch (error) { await close(); throw error; }
}

/** Submit a captured repair, then independently read accepted bytes and protected histories. */
export async function applyCandidate(host, { html, before, audit, protectedBefore }) {
  if (audit.status !== "audited") throw new Error("Repair requires an available captured audit.");
  let receipt;
  if (html === before.html) {
    const current = await host.readStored();
    receipt = same(current.item, before.item) && current.html === html ? { status: "unchanged", versionId: current.version.id } : { status: "refused", code: "stale-version", reason: "Stored input changed while the unchanged candidate was produced." };
  } else {
    try { receipt = await host.canvas.designRepair(host.screen.id, { text: html, expectedVersionId: before.version.id, expectedGoverning: audit.governing, expectedRuleVersion: audit.ruleVersion, filename: "screen.html" }); }
    catch (error) {
      if (error.status !== 400 || error.code !== "bad-op") throw error;
      receipt = { status: "refused", code: "candidate-rejected", reason: error.message };
    }
  }
  const stored = await host.readStored(), afterAudit = await host.audit(), protectedAfter = await host.protectedState();
  const protectedUnchanged = same(protectedBefore, protectedAfter);
  const oneVersion = stored.item.versions.length === before.item.versions.length + 1 && before.item.versions.every(version => stored.item.versions.some(after => same(after, version)));
  let accepted = receipt.status === "saved" && oneVersion && stored.version.id === receipt.versionId && stored.html === html && receipt.governingChanged === false && receipt.superseded === false;
  if (receipt.status === "unchanged") accepted = same(stored.item, before.item) && stored.html === html;
  return { receipt, accepted, stored, audit: afterAudit, protectedAfter, protectedUnchanged, receiptStatus: accepted ? receipt.status === "unchanged" ? "unchanged" : "accepted" : receipt.status };
}

/** A concurrent edit is a real accepted API write; stale repair must preserve its bytes/history. */
export async function staleWriteControl(task, outputDir) {
  await mkdir(outputDir, { recursive: true }); const host = await createEvalHost(task);
  try {
    const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
    const concurrentHtml = task.initialHtml + "\n<!-- Acme concurrent edit -->\n";
    await host.canvas.edit(host.screen.id, { content: concurrentHtml });
    const concurrent = await host.readStored();
    const result = await applyCandidate(host, { html: task.repairedHtml, before, audit, protectedBefore });
    const passed = result.receipt.status === "refused" && same(result.stored.item, concurrent.item) && result.stored.html === concurrentHtml && result.protectedUnchanged;
    const evidence = { passed, receipt: result.receipt, beforeVersionId: before.version.id, concurrent, after: result.stored, protectedUnchanged: result.protectedUnchanged };
    await json(path.join(outputDir, "stale-write.json"), evidence); return evidence;
  } finally { await host.close(); }
}

/** Every literal task and its accepted golden control must be ready before any candidate provider. */
export async function verifyReadiness(tasks, { browser, scoring, outputDir }) {
  const evidence = [];
  for (const task of tasks) {
    const dir = path.join(outputDir, task.id); await mkdir(dir, { recursive: true }); const host = await createEvalHost(task);
    try {
      const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
      const initial = checkInitial(task, audit);
      const cleanExact = !task.expected.unchangedControl || task.initialHtml === task.repairedHtml;
      const initialBrowser = await browser.assessStoredHtml({ task, html: before.html, outputDir: dir, label: "initial" });
      const applied = await applyCandidate(host, { html: task.repairedHtml, before, audit, protectedBefore });
      const repairedBrowser = await browser.assessStoredHtml({ task, html: applied.stored.html, outputDir: dir, label: "repaired" });
      const score = scoring.assessAttempt({ task, beforeHtml: before.html, html: applied.stored.html, audit: applied.audit, baselineAudit: audit, protectedUnchanged: applied.protectedUnchanged, browserEvidence: repairedBrowser, receiptStatus: applied.receiptStatus });
      const repairedReady = applied.audit.status === "audited" && applied.audit.diagnostics.length === task.expected.repairedDiagnostics && applied.audit.coverage.complete === task.expected.repairedCoverageComplete && applied.audit.coverage.checkedValues > 0 && applied.audit.coverage.omittedCategories.length === 0;
      const initialAvailable = await browserInputsReady(initialBrowser, task, before.html), repairedAvailable = await browserInputsReady(repairedBrowser, task, applied.stored.html);
      const row = { taskId: task.id, passed: initial.ready && cleanExact && initialAvailable && repairedAvailable && repairedReady && applied.accepted && applied.protectedUnchanged && score.complete, initial, cleanExact, initialAvailable, initialBrowser, repairedBrowser, repairedReady, initialAudit: audit, repairedAudit: applied.audit, receipt: applied.receipt, score, protectedBefore, protectedAfter: applied.protectedAfter };
      await writeFile(path.join(dir, "initial.html"), before.html); await writeFile(path.join(dir, "repaired-stored.html"), applied.stored.html); await json(path.join(dir, "readiness.json"), row); evidence.push(row);
    } finally { await host.close(); }
  }
  return { passed: evidence.length === 6 && evidence.every(row => row.passed), tasks: evidence };
}

/** Real stored negative candidates and deliberately changed protected histories must fail completion. */
export async function verifyNegativeControls(tasks, { browser, scoring, outputDir }) {
  const results = [];
  const task = tasks.find(one => one.id === "button-treatment");
  const controls = scoring.controlsForTask(task);
  for (const control of controls) {
    const dir = path.join(outputDir, control.id); await mkdir(dir, { recursive: true }); const host = await createEvalHost(task);
    try {
      const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
      const applied = await applyCandidate(host, { html: control.html, before, audit, protectedBefore });
      const browserEvidence = await browser.assessStoredHtml({ task, html: applied.stored.html, outputDir: dir, label: "stored" });
      const score = scoring.assessAttempt({ task, beforeHtml: before.html, html: applied.stored.html, audit: applied.audit, baselineAudit: audit, protectedUnchanged: applied.protectedUnchanged, browserEvidence, receiptStatus: applied.receiptStatus });
      const row = { id: control.id, passed: applied.accepted && browserEvidence.available && score.complete === false, receipt: applied.receipt, audit: applied.audit, browserEvidence, score, protectedUnchanged: applied.protectedUnchanged };
      await writeFile(path.join(dir, "stored.html"), applied.stored.html); await json(path.join(dir, "control.json"), row); results.push(row);
    } finally { await host.close(); }
  }
  // These deliberate test writes are separate controls, never candidate repairs or model outcomes.
  const scoped = tasks.find(one => one.id === "scoped-lane");
  for (const index of [0, 1]) {
    const id = index === 0 ? "governing-document-changed" : "adjacent-document-changed", dir = path.join(outputDir, id);
    await mkdir(dir, { recursive: true }); const host = await createEvalHost(scoped);
    try {
      const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
      const applied = await applyCandidate(host, { html: scoped.repairedHtml, before, audit, protectedBefore });
      const protectedItem = protectedBefore[index];
      await host.canvas.edit(protectedItem.item.id, { content: protectedItem.blobs[0].text + "\nAcme deliberate policy-protection negative control.\n" });
      const protectedAfter = await host.protectedState(), protectedUnchanged = same(protectedBefore, protectedAfter), afterAudit = await host.audit();
      const browserEvidence = await browser.assessStoredHtml({ task: scoped, html: applied.stored.html, outputDir: dir, label: "stored" });
      const score = scoring.assessAttempt({ task: scoped, beforeHtml: before.html, html: applied.stored.html, audit: afterAudit, baselineAudit: audit, protectedUnchanged, browserEvidence, receiptStatus: applied.receiptStatus });
      const row = { id, passed: !protectedUnchanged && browserEvidence.available && score.complete === false, deliberateControlPolicyWrite: true, protectedBefore, protectedAfter, score, browserEvidence };
      await json(path.join(dir, "control.json"), row); results.push(row);
    } finally { await host.close(); }
  }
  return { passed: results.length >= 10 && results.every(row => row.passed), results };
}

/** Both paid runs and labelled invalid-output controls use this same two-attempt loop. */
export async function runCorrections({ task, run, host, runDir, initialBrowser, browser, scoring, provider, ledger, save }) {
  const started = performance.now();
  let before = await host.readStored(), currentAudit = await host.audit();
  const protectedBefore = await host.protectedState(), initial = checkInitial(task, currentAudit);
  run.initialReady = initial.ready; run.initialCheck = initial; run.protectedBefore = protectedBefore;
  await writeFile(path.join(runDir, "initial.html"), before.html); await writeFile(path.join(runDir, "DESIGN.md"), task.design);
  await json(path.join(runDir, "initial-audit.json"), currentAudit);
  run.initialBrowser = initialBrowser;
  if (!initial.ready || !await browserInputsReady(run.initialBrowser, task, before.html)) throw new Error(`Initial fixture evidence unavailable or differs from frozen expectations: ${task.id}`);
  const baselineAudit = currentAudit;
  run.final = { htmlPath: path.join(runDir, "initial.html"), auditPath: path.join(runDir, "initial-audit.json"), browserEvidence: initialBrowser, score: scoring.assessAttempt({ task, beforeHtml: task.initialHtml, html: before.html, audit: currentAudit, baselineAudit, protectedUnchanged: true, browserEvidence: initialBrowser, receiptStatus: "not-submitted" }) };
  for (let round = 1; round <= 2; round++) {
    const attemptStarted = performance.now();
    const attemptDir = path.join(runDir, `attempt-${round}`); await mkdir(attemptDir);
    const prompt = buildPrompt({ instruction: task.instruction, design: task.design, html: before.html, condition: run.condition, audit: currentAudit });
    await writeFile(path.join(attemptDir, "prompt.txt"), prompt); await writeFile(path.join(attemptDir, "before.html"), before.html); await json(path.join(attemptDir, "before-audit.json"), currentAudit);
    const attempt = { round, inputSha256: before.sha256, promptSha256: inputHash(prompt), promptBytes: Buffer.byteLength(prompt), capturedVersionId: before.version.id, governing: currentAudit.governing, ruleVersion: currentAudit.ruleVersion };
    run.attempts.push(attempt);
    const result = await requestCandidate({ provider, ledger, attempt, save, providerArgs: { task, round, prompt, approvedModelMode: ledger !== null } });
    await json(path.join(attemptDir, "provider.json"), result);
    if (typeof result.candidateText === "string") { await writeFile(path.join(attemptDir, "candidate-output.txt"), result.candidateText); attempt.candidateSha256 = inputHash(result.candidateText); }
    attempt.candidateScope = candidateScope(result.candidateText);
    if (result.stopReason || ledger?.stopped) { attempt.stopReason = ledger?.stopped ?? result.stopReason; await save(); throw new Error(attempt.stopReason); }
    let html;
    try { html = parseCandidate(result.candidateText); }
    catch (error) {
      attempt.invalidOutput = error.message; attempt.complete = false;
      before = await host.readStored(); currentAudit = await host.audit();
      const protectedAfter = await host.protectedState();
      attempt.protectedUnchanged = same(protectedBefore, protectedAfter); attempt.acceptedPolicyChange = !attempt.protectedUnchanged;
      attempt.receipt = { status: "not-submitted", reason: "Invalid candidate JSON consumed this attempt." };
      attempt.browserEvidence = await browser.assessStoredHtml({ task, html: before.html, outputDir: attemptDir, label: "stored" });
      attempt.score = scoring.assessAttempt({ task, beforeHtml: task.initialHtml, html: before.html, audit: currentAudit, baselineAudit, protectedUnchanged: attempt.protectedUnchanged, browserEvidence: attempt.browserEvidence, receiptStatus: "not-submitted" });
      await writeFile(path.join(attemptDir, "stored.html"), before.html); await json(path.join(attemptDir, "audit.json"), currentAudit); await json(path.join(attemptDir, "receipt.json"), attempt.receipt); await json(path.join(attemptDir, "protected-after.json"), protectedAfter);
      run.final = { htmlPath: path.join(attemptDir, "stored.html"), auditPath: path.join(attemptDir, "audit.json"), browserEvidence: attempt.browserEvidence, score: attempt.score };
      attempt.storedSha256 = before.sha256; attempt.elapsedMs = performance.now() - attemptStarted;
      await save();
      if (!attempt.protectedUnchanged || !attempt.browserEvidence.available) throw new Error("Stored evidence unavailable after invalid output.");
      continue;
    }
    await writeFile(path.join(attemptDir, "candidate.html"), html);
    const applied = await applyCandidate(host, { html, before, audit: currentAudit, protectedBefore });
    await writeFile(path.join(attemptDir, "stored.html"), applied.stored.html); await json(path.join(attemptDir, "receipt.json"), applied.receipt); await json(path.join(attemptDir, "audit.json"), applied.audit); await json(path.join(attemptDir, "protected-after.json"), applied.protectedAfter);
    attempt.receipt = applied.receipt; attempt.accepted = applied.accepted; attempt.protectedUnchanged = applied.protectedUnchanged; attempt.acceptedPolicyChange = !applied.protectedUnchanged;
    attempt.auditSummary = { diagnosticsByRule: applied.audit.diagnostics?.reduce((counts, value) => ({ ...counts, [value.code]: (counts[value.code] ?? 0) + 1 }), {}), coverage: applied.audit.coverage ?? null };
    attempt.browserEvidence = await browser.assessStoredHtml({ task, html: applied.stored.html, outputDir: attemptDir, label: "stored" });
    attempt.score = scoring.assessAttempt({ task, beforeHtml: task.initialHtml, html: applied.stored.html, audit: applied.audit, baselineAudit, protectedUnchanged: applied.protectedUnchanged, browserEvidence: attempt.browserEvidence, receiptStatus: applied.receiptStatus });
    attempt.complete = attempt.score.complete; attempt.storedSha256 = applied.stored.sha256; attempt.elapsedMs = performance.now() - attemptStarted;
    run.final = { htmlPath: path.join(attemptDir, "stored.html"), auditPath: path.join(attemptDir, "audit.json"), browserEvidence: attempt.browserEvidence, score: attempt.score };
    const rejectedUnchanged = applied.receipt.status === "refused" && applied.receipt.code === "candidate-rejected" && same(applied.stored.item, before.item) && applied.stored.html === before.html;
    before = applied.stored; currentAudit = applied.audit;
    if ((!applied.accepted && !rejectedUnchanged) || !applied.protectedUnchanged || !attempt.browserEvidence.available) throw new Error("Repair receipt, fixed-policy protection or browser evidence failed.");
    if (attempt.complete) break;
    await save();
  }
  run.complete = run.attempts.at(-1)?.complete === true; run.rounds = run.attempts.length; run.elapsedMs = performance.now() - started;
}

/** Two labelled invalid outputs fail a task but retain actual stored bytes for blind review. */
export async function invalidOutputControl(task, { initialBrowser, browser, scoring, outputDir }) {
  await mkdir(outputDir, { recursive: true }); const host = await createEvalHost(task);
  const run = { runId: "invalid-output-control", taskId: task.id, repetition: 1, condition: "rules-only", attempts: [], human: { intent: null, preference: null } };
  let calls = 0;
  try {
    const before = await host.readStored();
    const provider = async () => ({ provider: "canned-invalid-output-control", modelCalls: 0, candidateText: ++calls === 1 ? '{"html":"","tokens":{}}' : 'Acme deliberately invalid JSON', apiEquivalentCost: null, usage: null, elapsedMs: 0, stopReason: null });
    await runCorrections({ task, run, host, runDir: outputDir, initialBrowser, browser, scoring, provider, ledger: null, save: () => json(path.join(outputDir, "control.json"), { modelCalls: 0, calls, run }) });
    const after = await host.readStored();
    const passed = calls === 2 && run.rounds === 2 && run.complete === false && run.attempts.every(attempt => !!attempt.invalidOutput) && same(before.item, after.item) && before.html === after.html && run.final.browserEvidence.inputHash === after.sha256 && run.final.score.render.passed && run.final.score.coverage.complete;
    const evidence = { passed, modelCalls: 0, calls, run, retainedStoredItem: after.item };
    await json(path.join(outputDir, "control.json"), evidence); return evidence;
  } finally { await host.close(); }
}

async function sourceIdentity() {
  const files = ["scripts/design-lint-eval.mjs", "scripts/lib/design-lint-eval-runner.mjs", "scripts/lib/design-lint-eval-model.mjs", "scripts/lib/design-lint-eval-browser.mjs", "scripts/lib/design-lint-eval-score.mjs", "scripts/lib/browser.mjs", "packages/core/src/designaudit.ts", "packages/core/src/design-contract.ts", "packages/core/src/design-contract-rules.ts", "packages/core/src/designmd.ts", "packages/core/src/tokens.ts", "packages/core/src/memory.ts", "packages/core/src/designsystem.ts", "packages/core/src/canvas-scope.ts", "packages/api/src/context-reader.ts", "packages/api/src/design-audit-reader.ts", "packages/api/src/design-audit.ts", "packages/api/src/connect.ts", "package-lock.json"];
  const hashes = {};
  for (const filename of files) hashes[filename] = inputHash(await readFile(path.join(repo, filename)));
  return { node: process.version, gitRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), hashes, boundary: "Required named harness, scorer, parser, governing resolver and API sources plus dependency lock; not a transitive fingerprint of every daemon/platform input." };
}

/** Complete local instrumentation; no candidate may choose a policy document or bypass receipts. */
export async function runEvaluation({ mode, outputDir, seed, budgetUsd, model, continueFrom = null }) {
  if (mode !== "dry-run" && (mode !== "model" || model !== MODEL_SPEC.model)) throw new Error("Explicit supported evaluation mode required.");
  if (continueFrom && mode !== "model") throw new Error("Only explicit model mode may continue the prior login refusal.");
  const tasks = await loadEvalTasks(), order = scheduleRuns(tasks.map(task => task.id), seed);
  const fixtures = tasks.map(({ id, fixtureHashes }) => ({ id, hashes: fixtureHashes }));
  const continuation = continueFrom ? await readContinuation(continueFrom, { budgetUsd, model, seed, fixtures }) : null;
  const ledger = mode === "model" ? new CostLedger(budgetUsd, continuation) : null;
  await mkdir(outputDir); // Refuse an existing evidence directory rather than mixing runs.
  const browser = await import("./design-lint-eval-browser.mjs"), scoring = await import("./design-lint-eval-score.mjs");
  const preflight = modelPreflight(), provider = selectCandidateProvider(mode);
  const report = { schemaVersion: 1, mode, seed, modelCalls: 0, modelCallsThisRun: 0, continuation, provider: mode === "dry-run" ? "canned-dry-run" : "claude-cli", model: MODEL_SPEC, modelSpecSha256: inputHash(JSON.stringify(MODEL_SPEC)), preflight, source: await sourceIdentity(), fixtures, order, runs: [], controls: {}, status: "running", modelLift: { verdict: "unavailable", reason: mode === "dry-run" ? "Canned outputs measure instrumentation only." : "Human ratings and complete cost/coverage comparison are required." }, billedSpend: null };
  const save = async () => { report.modelCalls = ledger?.calls ?? 0; report.modelCallsThisRun = (ledger?.calls ?? 0) - (continuation?.priorInvocations ?? 0); report.accounting = ledger?.snapshot() ?? { calls: 0, reportedApiEquivalent: null, billedSpend: null, reason: "No model invoked; canned data is not a cost comparison." }; report.records = normalizedRecords(report); await json(path.join(outputDir, "report.json"), report); };
  await save();
  if (mode === "model" && !preflight.available) { report.status = "unavailable"; report.stopReason = preflight.reason; await save(); return report; }
  try {
    report.readiness = await verifyReadiness(tasks, { browser, scoring, outputDir: path.join(outputDir, "readiness") });
    await save();
    if (!report.readiness.passed) throw new Error("The six frozen initial/golden fixtures did not all pass readiness before provider calls.");
    report.controls.staleWrite = await staleWriteControl(tasks.find(task => task.id === "card-spacing"), path.join(outputDir, "controls"));
    if (!report.controls.staleWrite.passed) throw new Error("Stale-write readiness control failed.");
    report.controls.negative = await verifyNegativeControls(tasks, { browser, scoring, outputDir: path.join(outputDir, "controls") });
    await save();
    if (!report.controls.negative.passed) throw new Error("A negative output/policy control was accepted as a completed task.");
    report.controls.invalidOutput = await invalidOutputControl(tasks.find(task => task.id === "clean-control"), { initialBrowser: report.readiness.tasks.find(row => row.taskId === "clean-control").initialBrowser, browser, scoring, outputDir: path.join(outputDir, "controls/invalid-output") });
    await save();
    if (!report.controls.invalidOutput.passed) throw new Error("Two invalid outputs did not retain reviewable failed-task evidence.");
    if (continuation) {
      const freshAuth = modelPreflight(); report.continuationAuth = freshAuth;
      continuation.claim = await claimContinuation(continuation, { outputDir, readinessPassed: report.readiness.passed && report.controls.staleWrite.passed && report.controls.negative.passed && report.controls.invalidOutput.passed, auth: freshAuth.available ? freshAuth.auth : null });
      await save();
    }
    for (const entry of order) {
      const task = tasks.find(one => one.id === entry.taskId), runDir = path.join(outputDir, entry.runId);
      await mkdir(runDir); const host = await createEvalHost(task);
      const run = { ...entry, taskText: task.instruction, attempts: [], human: { intent: null, preference: null }, initialReady: false };
      report.runs.push(run);
      try {
        await runCorrections({ task, run, host, runDir, initialBrowser: report.readiness.tasks.find(row => row.taskId === task.id).initialBrowser, browser, scoring, provider, ledger, save });
      } finally { await host.close(); }
      await save();
    }
    const imageRows = evidence => (evidence?.viewports ?? []).map(row => ({ width: row.viewport.width, height: row.viewport.height, path: row.screenshot }));
    report.review = await scoring.writeBlindReview({ runs: report.runs.map(run => ({ runId: run.runId, taskId: run.taskId, taskText: run.taskText, condition: run.condition, repetition: run.repetition, htmlHash: run.final?.browserEvidence.inputHash ?? null, screenshots: imageRows(run.final?.browserEvidence), initialScreenshots: imageRows(run.initialBrowser) })), outputDir, seed });
    report.status = "completed";
  } catch (error) { report.status = "unavailable"; report.stopReason = error.message; }
  await save(); return report;
}

/** Summary inputs keep completion, behavior, coverage and reported cost as separate dimensions. */
export function normalizedRecords(report) {
  return report.runs.map(run => ({ runId: run.runId, taskId: run.taskId, repetition: run.repetition, condition: run.condition, htmlHash: run.final?.browserEvidence.inputHash ?? null, complete: run.complete === true, rounds: run.attempts.length,
    apiEquivalentCost: report.mode === "model" && run.attempts.length > 0 && run.attempts.every(attempt => Number.isFinite(attempt.provider?.apiEquivalentCost)) ? run.attempts.reduce((sum, attempt) => sum + attempt.provider.apiEquivalentCost, 0) : null,
    interactionFailures: run.final?.score?.render?.interactionFailures ?? null, newUnexamined: run.final?.score?.coverage?.newUnexamined ?? null,
    protectedUnchanged: run.attempts.some(attempt => attempt.protectedUnchanged === false) ? false : run.attempts.length > 0 && run.attempts.every(attempt => attempt.protectedUnchanged === true) ? true : null,
    concurrentSafe: report.controls.staleWrite?.passed === true, initialReady: run.initialReady,
  }));
}
