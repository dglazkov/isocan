/** Execution authorization and durable accounting are separate from the unchanged phase-0 dry matrix. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateManifestInputs, loadCorpus } from "./design-partner-eval.mjs";
import { STUDY_TOOLS } from "./design-partner-tools.mjs";
import { inspectRuntime, STUDY_SOURCES, studyHash, studyJson, studyPath, studyInstrumentationIdentity, studyTreeIdentity } from "./design-partner-runtime.mjs";

export const STUDY_UNCERTAINTY = Object.freeze({ unit: "brief-cluster", resamples: 10000, confidence: 0.95, interval: "percentile", seed: "design-partner-brief-bootstrap-v1" });
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const require = (condition, message) => { if (!condition) throw new Error(message); };
const text = value => typeof value === "string" && value.trim().length > 0;
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const positive = value => Number.isFinite(value) && value > 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const closed = (value, keys, label) => { require(object(value) && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value, key)), `Invalid or unsupported ${label} fields`); };

/** Exact prepared input identity includes owned paths and excludes only the separate approval record. */
export function executionIdentity(manifest) { const { authorization: _, ...identity } = manifest; return studyHash(JSON.stringify(identity)); }

/** Freeze a reviewable proposal; no authorization is synthesized and no provider is imported. */
export function prepareExecutionManifest({ dry, runtimes, materializations, profile, limits = null }) {
  return { schemaVersion: 1, kind: "design-partner-execution", dry, drySha256: studyHash(JSON.stringify(dry)), runtimes, materializations, profile, limits, uncertainty: { ...STUDY_UNCERTAINTY }, authorization: null };
}

/** Validate actual sources, delivered resources and native profile files, never only mutually consistent JSON. */
export async function validateExecutionManifest(value, { repository, fixtures, execution = false, authorization = null } = {}) {
  closed(value, ["schemaVersion", "kind", "dry", "drySha256", "runtimes", "materializations", "profile", "limits", "uncertainty", "authorization"], "execution manifest");
  require(value.schemaVersion === 1 && value.kind === "design-partner-execution", "Unknown execution manifest");
  await validateManifestInputs(value.dry, fixtures);
  const corpus = await loadCorpus(fixtures);
  require(value.drySha256 === studyHash(JSON.stringify(value.dry)), "Dry matrix identity changed");
  require(value.dry.impeccable === null || value.dry.impeccable.mode === "adapted", "Only the supported adapted-guidance C condition may execute");
  require(same(value.uncertainty, STUDY_UNCERTAINTY), "Preregistered brief-cluster uncertainty changed");
  closed(value.runtimes, ["A", "B"], "runtime map");
  for (const condition of ["A", "B"]) {
    const declared = value.runtimes[condition];
    require(declared.sourceRevision === STUDY_SOURCES[condition], "Condition has a different source revision");
    const actual = await inspectRuntime({ repository, revision: declared.sourceRevision, directory: declared.directory });
    require(same(actual, declared), `Actual ${condition} source/build/workspace differs from the execution manifest`);
  }
  require(value.runtimes.A.dependencyLockSha256 === value.runtimes.B.dependencyLockSha256, "Matched external dependency locks differ");
  require(Array.isArray(value.materializations) && value.materializations.length === 2, "Both source materializations are required");
  for (const condition of ["A", "B"]) {
    const entry = value.materializations.find(row => row.condition === condition);
    closed(entry, ["condition", "path", "sha256"], "materialization entry");
    require(entry && text(entry.path) && digest(entry.sha256), "Missing materialization identity");
    const bytes = await fs.readFile(entry.path); require(studyHash(bytes) === entry.sha256, "Materialization changed");
    const report = JSON.parse(bytes);
    require(report.sourceRevision === STUDY_SOURCES[condition] && report.qualityEvidence === false && report.mappings.length === 24, "Materialization must cover all twelve cases and both entrances");
    const keys = new Set(report.mappings.map(row => `${row.fixtureId}/${row.entrance}`));
    require(keys.size === 24 && value.dry.caseIds.every(id => value.dry.entrances.every(entrance => keys.has(`${id}/${entrance}`))), "Materialization omitted matched inputs");
    for (const row of report.mappings) {
      const task = corpus.tasks.find(task => task.id === row.fixtureId);
      require(task && ["canvas-chat", "external-agent"].includes(row.entrance), "Unknown materialized task or entrance");
      require(same(Object.keys(row.groups).sort(), task.snapshot.groups.map(group => group.id).sort()) && row.items.length === task.snapshot.items.length, "Materialized scope or seed membership differs from frozen fixture");
      for (const seed of task.snapshot.items) {
        const actual = row.items.find(item => item.fixtureItemId === seed.id);
        require(actual && actual.fixtureVersionId === seed.versionId && actual.path === seed.path && actual.scope === seed.scope && actual.groupId === row.groups[seed.scope] && actual.blobSha256 === task.hashes[seed.path], "Materialized item/version/source differs from frozen fixture");
      }
      require(same(row.selectedItemIds, task.snapshot.selectedItemIds.map(id => row.items.find(item => item.fixtureItemId === id).itemId)), "Materialized selected context changed");
      require(row.policy.property === "design.workflow" && row.policy.original === null && row.policy.seeded === "adaptive-v1", "Matched synthetic enrollment changed");
      require(same(await studyTreeIdentity(path.join(report.home, "projects", row.canvasId)), row.persistedState), "Persisted prepared canvas changed");
      require(row.promptSha256 === studyHash(row.prompt) && row.verification.api === true && row.verification.cli === true, "Unverified delivered input");
      const resourcePaths = [...Object.keys(task.inputs).filter(name => !["task.json", "snapshot.json"].includes(name)), "CONTEXT.json", ".agents/skills/isocan-collab/SKILL.md", "isocan --agent-help"].sort();
      require(same(row.resources.map(resource => resource.path).sort(), resourcePaths), "Unexpected or missing agent-visible materialization resource");
      require(same((await studyTreeIdentity(row.workspace)).map(file => file.path).sort(), resourcePaths.filter(name => name !== "isocan --agent-help")), "Agent workspace contains undeclared evaluator/configuration bytes");
      for (const resource of row.resources) {
        if (resource.path === "isocan --agent-help") continue;
        const source = await studyPath(row.workspace, resource.path);
        require(studyHash(await fs.readFile(source)) === resource.sha256, "Agent-visible materialized resource changed");
        if (Object.hasOwn(task.hashes, resource.path)) require(resource.sha256 === task.hashes[resource.path], "Supplied task bytes differ from frozen fixture");
        if (resource.path === ".agents/skills/isocan-collab/SKILL.md") require(resource.sha256 === studyHash(await fs.readFile(path.join(value.runtimes[condition].directory, resource.path))), "Collaboration doorway belongs to another runtime");
      }
      const expectedContext = { knownFacts: task.knownFacts, references: task.references.map(ref => ref.kind === "local" ? { ...ref, itemId: row.items.find(item => item.fixtureItemId === ref.itemId).itemId, versionId: row.items.find(item => item.fixtureItemId === ref.itemId).versionId } : ref), selectedItemIds: row.selectedItemIds, targetGroupId: row.groups[task.entryPoints[row.entrance].targetGroupId], deliveryType: task.deliveryType, viewports: task.viewports };
      require(same(JSON.parse(await fs.readFile(await studyPath(row.workspace, "CONTEXT.json"), "utf8")), expectedContext), "Supplied context differs from frozen task facts/references");
      require(!row.resources.some(resource => /(?:^|\/)(?:task|snapshot)\.json$/.test(resource.path)), "Evaluator-only resource exposed to agent");
    }
  }
  if (value.profile !== null) {
    closed(value.profile, ["schemaVersion", "kind", "binary", "version", "model", "effort", "tools", "toolFiles", "helpSha256", "nativeInitialization", "browser", "browserBinary", "network", "imageGeneration", "extraAgents", "adaptation"], "native profile");
    const profile = value.profile;
    closed(profile.binary, ["path", "sha256"], "native binary");
    closed(profile.browserBinary, ["path", "sha256", "version"], "browser binary");
    require(studyHash(await fs.readFile(profile.browserBinary.path)) === profile.browserBinary.sha256 && /^\d+(?:\.\d+){3}$/.test(profile.browserBinary.version), "Actual browser executable/profile changed");
    closed(profile.nativeInitialization, ["status", "reason"], "native initialization");
    closed(profile.adaptation, ["mode", "revision", "upstream"], "guidance condition");
    require(profile.schemaVersion === 1 && profile.kind === "claude-study-native" && profile.version === "2.1.269" && profile.model === "claude-sonnet-5" && profile.effort === "high", "Unknown model/harness stratum");
    require(profile.binary.sha256 === "c942e1228b93cb4d52183b3dfbc77f28264f35aa947acd9c0853d029164cf450" && studyHash(await fs.readFile(profile.binary.path)) === profile.binary.sha256, "Native binary changed");
    require(same(profile.network, { proxy: "owned-http-only", daemon: "unavailable-use-cli", repository: "fixed-fixture-http-get", tls: false, webSockets: false, fileUrls: false }), "Browser network capability changed");
    require(profile.extraAgents === false && profile.imageGeneration === "unavailable" && profile.browser === "owned-chrome-cdp", "Unmatched extra capability");
    require(same(profile.tools, STUDY_TOOLS.map(tool => `mcp__study__${tool.name}`)), "Only the exact explicit study MCP tools are allowed");
    require(same(profile.toolFiles, await studyInstrumentationIdentity()) && digest(profile.helpSha256), "Tool, runtime, assessor or MCP dependency implementation changed");
    require(profile.nativeInitialization.status === "unmeasured" && text(profile.nativeInitialization.reason), "Prepared native initialization is unmeasured; only actual run evidence may report observation");
    require(profile.adaptation.mode === "adapted-guidance" && profile.adaptation.revision === "isocan-craft-v1" && profile.adaptation.upstream === "2149fcce39a90bb409df5f16515f316a76dc6199", "Craft condition changed");
  }
  if (value.limits !== null) {
    closed(value.limits, ["aggregateApiEquivalentUsd", "perRunApiEquivalentUsd", "inFlightHeadroomUsd", "tokensPerRun", "outputTokensPerTurn", "turnsPerRun", "millisecondsPerRun", "repairRounds"], "run limits");
    require(["aggregateApiEquivalentUsd", "perRunApiEquivalentUsd", "inFlightHeadroomUsd", "tokensPerRun", "outputTokensPerTurn", "turnsPerRun", "millisecondsPerRun"].every(key => positive(value.limits[key])), "Every execution ceiling must be explicit and positive");
    require(["tokensPerRun", "outputTokensPerTurn", "turnsPerRun", "millisecondsPerRun"].every(key => Number.isSafeInteger(value.limits[key])) && value.limits.repairRounds === 2, "Invalid token/turn/deadline/repair budget");
    require(value.limits.aggregateApiEquivalentUsd >= value.limits.perRunApiEquivalentUsd + value.limits.inFlightHeadroomUsd, "No in-flight headroom is reserved");
  }
  if (execution) {
    require(value.profile !== null && value.limits !== null, "Execution needs a pinned actual profile and explicit ceilings");
    require(value.authorization !== null && authorization !== null && same(value.authorization, authorization), "No explicit matching execution authorization supplied");
    closed(authorization, ["reference", "approvedManifestSha256", "approvedBy", "approvedAt", "scope"], "authorization");
    require(text(authorization.reference) && text(authorization.approvedBy) && Number.isFinite(Date.parse(authorization.approvedAt)) && authorization.scope === "paid-design-partner-execution" && authorization.approvedManifestSha256 === executionIdentity(value), "Authorization does not name these exact sources, limits and cells");
  } else require(value.authorization === null || object(value.authorization), "Unknown authorization state");
  return { valid: true, executionAuthorized: execution, manifestSha256: executionIdentity(value), plannedRuns: value.dry.plannedRuns, comparisonEligible: false, qualityEvidence: false, providerCalls: 0 };
}

async function ledgerLock(directory, fn) {
  await fs.mkdir(directory, { recursive: true }); const lock = path.join(directory, ".reservation-lock");
  try { await fs.mkdir(lock); } catch (error) { if (error.code === "EEXIST") throw new Error("Another reservation or unresolved lock owns this study; reconcile explicitly"); throw error; }
  try { return await fn(); } finally { await fs.rmdir(lock); }
}
async function attempts(directory) {
  return Promise.all((await fs.readdir(directory)).filter(name => /^attempt-[a-f0-9]{64}\.json$/.test(name)).map(async name => JSON.parse(await fs.readFile(path.join(directory, name), "utf8"))));
}

/** Reserve the full allowance plus in-flight headroom atomically before any process can launch. */
export async function reserveStudyAttempt(directory, manifest, runId) {
  require(manifest.authorization?.approvedManifestSha256 === executionIdentity(manifest) && manifest.limits, "No authorized frozen execution intent");
  const planned = manifest.dry.runs.find(row => row.runId === runId); require(planned, "Unknown planned run");
  return ledgerLock(directory, async () => {
    const rows = await attempts(directory), identity = executionIdentity(manifest);
    require(rows.every(row => row.manifestSha256 === identity), "Journal belongs to another execution manifest");
    require(!rows.some(row => row.runId === runId), "This run already has an immutable attempt; no implicit retry");
    require(!rows.some(row => row.state !== "terminal" || row.accounting.apiEquivalentUsd === null || row.stopStudy), "Unresolved charge or stop condition blocks further launches");
    const known = rows.reduce((sum, row) => sum + row.accounting.apiEquivalentUsd, 0), reserved = manifest.limits.perRunApiEquivalentUsd + manifest.limits.inFlightHeadroomUsd;
    require(known + reserved <= manifest.limits.aggregateApiEquivalentUsd, "Aggregate ceiling cannot cover this run and in-flight headroom");
    const attemptId = studyHash(`${identity}/${runId}`), row = { schemaVersion: 1, kind: "design-partner-attempt", attemptId, manifestSha256: identity, runId, state: "reserved", reservedAt: new Date().toISOString(), deadline: new Date(Date.now() + manifest.limits.millisecondsPerRun).toISOString(), reservedApiEquivalentUsd: reserved, accounting: { apiEquivalentUsd: null, billedUsd: null, billingEvidence: null }, outcome: null, stopStudy: null };
    await fs.writeFile(path.join(directory, `attempt-${attemptId}.json`), studyJson(row), { flag: "wx" }); return row;
  });
}

/** Confirm one existing attempt without rewriting its run, prompt, reservation or uncertain billing history. */
export async function settleStudyAttempt(directory, attempt, result) {
  return ledgerLock(directory, async () => {
    const filename = path.join(directory, `attempt-${attempt.attemptId}.json`), current = JSON.parse(await fs.readFile(filename, "utf8"));
    require(same(current, attempt), "Attempt journal changed; recovery must inspect the original record");
    require(["completed", "failed", "timed-out", "unavailable", "abandoned"].includes(result.status), "Terminal attempts cannot disappear from the denominator");
    require(result.apiEquivalentUsd === null || Number.isFinite(result.apiEquivalentUsd) && result.apiEquivalentUsd >= 0, "Invalid reported cost");
    const next = { ...current, state: "terminal", endedAt: new Date().toISOString(), outcome: result, accounting: { apiEquivalentUsd: result.apiEquivalentUsd, billedUsd: null, billingEvidence: null }, stopStudy: result.stopStudy ?? (result.apiEquivalentUsd === null ? "Charge is unknown; explicit reconciliation required" : null) };
    const temporary = filename + ".tmp"; await fs.writeFile(temporary, studyJson(next), { flag: "wx" }); await fs.rename(temporary, filename); return next;
  });
}
