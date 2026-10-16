// Actions usage estimates, not invoices. Zero dependencies; read-only REST via gh.
// Job timing excludes queue time. Defaults are project weighting assumptions
// dated 2026-10-09, not a universal GitHub price schedule.
import { spawnSync } from 'node:child_process';

export const CI_LOGICAL_RUN_BASIS = 'all-attempts-in-window-v1';
export const CI_WEIGHTS = Object.freeze({ linux: 1, windows: 2, macos: 10 });
export const CI_LIMITS = Object.freeze({ perPage: 100, runPages: 5, jobPages: 5, workflowPages: 5, requests: 200, attempts: 10 });
const DAY = 86400000;
// GitHub's job schema makes run_attempt optional. Only attempt-scoped callers
// use this check: the request path supplies absence, never a present mismatch.
const attemptMatches = (job, attempt) => !Object.hasOwn(job, 'run_attempt') || job.run_attempt === attempt;
const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function ciOptions(config = {}) {
  const ci = config.ci === undefined ? {} : config.ci;
  if (!ci || typeof ci !== 'object' || Array.isArray(ci)) throw new Error('"ci" must be an object');
  if (ci.weeklyMinutes !== undefined && !finite(ci.weeklyMinutes)) throw new Error('"ci".weeklyMinutes must be a nonnegative number');
  if (ci.weights !== undefined && (!ci.weights || typeof ci.weights !== 'object' || Array.isArray(ci.weights))) throw new Error('\"ci\".weights must be an object');
  const weights = { ...CI_WEIGHTS, ...ci.weights };
  for (const [k, v] of Object.entries(weights)) if (!Object.hasOwn(CI_WEIGHTS, k) || !finite(v)) throw new Error('"ci".weights needs nonnegative linux/windows/macos weights');
  const runnerWeights = ci.runnerWeights === undefined ? {} : ci.runnerWeights;
  if (!runnerWeights || typeof runnerWeights !== 'object' || Array.isArray(runnerWeights) || Object.values(runnerWeights).some(v => !finite(v))) throw new Error('"ci".runnerWeights needs label-to-weight numbers');
  return { weights, runnerWeights, weeklyMinutes: ci.weeklyMinutes ?? null, weightsDate: '2026-10-09' };
}

/** Injectable only at the transport boundary: fixtures exercise the production pager. */
export function actionsClient({ repo, env = process.env, limits = {}, request } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) throw new Error('Actions needs an owner/repo');
  const caps = { ...CI_LIMITS, ...limits };
  for (const [key, value] of Object.entries(caps)) if (!Number.isInteger(value) || value < 1 || value > CI_LIMITS[key]) throw new Error(`invalid Actions limit ${key}`);
  const coverage = { complete: true, requests: 0, runPages: 0, jobPages: 0, workflowPages: 0, gaps: [], limits: caps };
  const gap = message => { coverage.failures = (coverage.failures ?? 0) + 1; coverage.complete = false; if (!coverage.gaps.includes(message)) coverage.gaps.push(message); };
  const get = async path => {
    if (coverage.requests >= caps.requests) throw new Error('Actions request budget exhausted');
    coverage.requests++;
    if (request) return request(path);
    const r = spawnSync(env.KEEL_GH || 'gh', ['api', path], { env, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error('Actions API unavailable');
    try { return JSON.parse(r.stdout); } catch { throw new Error('Actions API returned invalid JSON'); }
  };
  const pages = async (path, key, kind) => {
    const rows = [], seen = new Set();
    for (let page = 1; page <= caps[kind]; page++) {
      let data;
      try { data = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=${caps.perPage}&page=${page}`); }
      catch (error) { gap(`${key}: ${error.message}`); return rows; }
      coverage[kind]++;
      if (!Array.isArray(data?.[key]) || !Number.isInteger(data.total_count) || data.total_count < 0 || data[key].length > caps.perPage) { gap(`${key}: malformed page`); return rows; }
      for (const row of data[key]) {
        if (!Number.isSafeInteger(row?.id) || row.id < 1) { gap(`${key}: missing identity`); continue; }
        if (!seen.has(row.id)) { rows.push(row); seen.add(row.id); }
      }
      if (seen.size >= data.total_count) return rows;
      if (data[key].length < caps.perPage) { gap(`${key}: page ended before total_count`); return rows; }
    }
    gap(`${key}: page limit reached`);
    return rows;
  };
  return { get, pages, gap, coverage, repo, caps };
}

export function runnerUsage(job, visibility, options) {
  const labels = Array.isArray(job.labels) ? job.labels.filter(x => typeof x === 'string') : [];
  const lower = labels.map(x => x.toLowerCase());
  const self = lower.includes('self-hosted');
  const standard = lower.find(x => /^(ubuntu-(latest|\d+\.\d+)(-arm)?|windows-(latest|2019|2022|2025)|macos-(latest|\d+)(-intel|-arm64)?)$/.test(x));
  const os = lower.some(x => /^(linux$|ubuntu-)/.test(x)) ? 'linux' : lower.some(x => /^windows($|-)/.test(x)) ? 'windows' : lower.some(x => /^(macos($|-)|osx$)/.test(x)) ? 'macos' : null;
  const override = labels.find(l => Object.hasOwn(options.runnerWeights, l));
  const weight = override ? options.runnerWeights[override] : os ? options.weights[os] : null;
  const kind = self ? 'self-hosted' : standard ? 'standard-hosted' : os ? 'larger-or-custom' : 'unknown';
  return { labels, os, kind, weight, billing: self ? 'self-hosted-no-hosted-charge' : kind === 'standard-hosted' && visibility === 'public' ? 'public-standard-free' : visibility === 'private' ? 'private-plan-dependent' : 'unknown' };
}

/** Read retained run pages without a created-at lower filter: reruns of old runs
 * may have fresh jobs. Bounds may leave older reruns unseen; gaps say so. */
export async function readCiUsage({ repo, env, config = {}, now = Date.now(), days = 7, workflow, ownedWorkflows = [], limits, request } = {}) {
  const options = ciOptions(config), client = actionsClient({ repo, env, limits, request });
  const { get, pages, gap, coverage } = client;
  if (!Number.isFinite(now) || !Number.isFinite(days) || days <= 0 || days > 90) throw new Error('invalid CI history window');
  const since = now - days * DAY;
  const owned = new Set(ownedWorkflows);
  const report = { source: 'github-actions-jobs', repo, window: { since: new Date(since).toISOString(), until: new Date(now).toISOString(), days, workflow: workflow ?? null, workflowPath: null, workflowCreatedAt: null, repoCreatedAt: null, observedSince: null, observedDays: null, basis: 'jobs completed in window; full started-to-completed duration' }, assumptions: { ...options, logicalRunBasis: CI_LOGICAL_RUN_BASIS, rounding: 'ceil each job runtime / 60000', invoice: false }, visibility: 'unknown', workflows: [], observedWeightedMinutes: 0, weightedMinutes: null, coverage };
  try {
    const data = await get(`repos/${repo}`);
    report.visibility = data.private === true ? 'private' : data.private === false ? 'public' : 'unknown';
    const created = typeof data.created_at === 'string' ? Date.parse(data.created_at) : NaN;
    if (Number.isFinite(created) && created < now) {
      report.window.repoCreatedAt = new Date(created).toISOString();
      report.window.observedSince = new Date(Math.max(since, created)).toISOString();
      report.window.observedDays = (now - Math.max(since, created)) / DAY;
    }
  } catch { coverage.billingUnavailable = true; }
  if (workflow) {
    try {
      const data = await get(`repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`);
      const path = data?.path;
      if (typeof path === 'string' && /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) && [path, path.split('/').at(-1), String(data.id)].includes(workflow)) {
        report.window.workflowPath = path;
        const created = typeof data.created_at === 'string' ? Date.parse(data.created_at) : NaN;
        if (Number.isFinite(created) && created < now) report.window.workflowCreatedAt = new Date(created).toISOString();
      }
    } catch { /* workflow exposure unavailable; completed-job accounting can continue */ }
    const repoCreated = Date.parse(report.window.repoCreatedAt), workflowCreated = Date.parse(report.window.workflowCreatedAt);
    const observed = Math.max(since, repoCreated, workflowCreated);
    report.window.observedSince = Number.isFinite(observed) ? new Date(observed).toISOString() : null;
    report.window.observedDays = Number.isFinite(observed) ? (now - observed) / DAY : null;
  }
  if (report.window.observedDays === null) coverage.exposureUnavailable = true;
  const runs = await pages(workflow ? `repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs` : `repos/${repo}/actions/runs`, 'workflow_runs', 'runPages');
  let runPagesComplete = coverage.complete;
  coverage.runs = runs.length; coverage.jobs = 0; coverage.attempts = 0; coverage.excludedJobs = 0; coverage.unknownJobs = 0; coverage.unfinishedJobs = 0; coverage.queuedAttemptsWithoutJobs = 0; coverage.unfinishedWeightedMinutes = null;
  const groups = new Map(), jobIds = new Set();
  for (const run of runs) {
    // updated_at changes on a rerun. Only positively old, completed runs can be skipped.
    if (run.status === 'completed' && Number.isFinite(Date.parse(run.updated_at)) && Date.parse(run.updated_at) < since) continue;
    const path = typeof run.path === 'string' ? run.path.split('@')[0] : null;
    if (!path || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) { gap('run missing workflow path or attempt count'); runPagesComplete = false; continue; }
    const group = groups.get(path) ?? { path, name: run.name ?? path, keel: owned.has(path), keelNamed: /\/keel-[^/]+\.ya?ml$/.test(path), observedWeightedMinutes: 0, weightedMinutes: null, jobs: [], runs: [], complete: runPagesComplete };
    groups.set(path, group);
    let runComplete = run.status === 'completed';
    const runGaps = coverage.failures ?? 0;
    const logicalRows = [];
    if (run.run_attempt > client.caps.attempts) { gap('run attempt limit reached'); group.complete = false; }
    for (let attempt = 1; attempt <= Math.min(run.run_attempt, client.caps.attempts); attempt++) {
      coverage.attempts++;
      const gaps = coverage.failures ?? 0;
      const jobs = await pages(`repos/${repo}/actions/runs/${run.id}/attempts/${attempt}/jobs`, 'jobs', 'jobPages');
      // A successful total_count:0 response for the current queued attempt
      // positively places it outside the completion window. Earlier attempts
      // still need observable jobs; an empty failed read is never authoritative.
      if (!jobs.length && (coverage.failures ?? 0) === gaps && attempt === run.run_attempt && run.status === 'queued' && run.conclusion == null) {
        coverage.queuedAttemptsWithoutJobs++;
        continue;
      }
      if ((coverage.failures ?? 0) !== gaps || !jobs.length) { group.complete = false; if (!jobs.length) gap('attempt has no observable jobs'); }
      const observed = { id: run.id, attempt, event: run.event ?? 'unknown', weightedMinutes: 0, complete: group.complete, jobs: 0 };
      for (const job of jobs) {
        if (job.run_id !== run.id || !attemptMatches(job, attempt) || (run.head_sha && job.head_sha !== run.head_sha)) { gap('job run/attempt/SHA mismatch'); group.complete = observed.complete = false; coverage.unknownJobs++; continue; }
        if (jobIds.has(job.id)) continue; // carried-forward jobs on partial reruns are charged once
        jobIds.add(job.id); coverage.jobs++;
        // A completion-window total excludes positively unfinished jobs. Their
        // eventual cost is unknown, not zero; contradictory completion metadata
        // still goes through timing validation below.
        if (['queued', 'in_progress'].includes(job.status) && job.completed_at == null && job.conclusion == null) {
          coverage.excludedJobs++; coverage.unfinishedJobs++;
          observed.complete = false; // not a complete attempt for per-run means
          runComplete = false;
          continue;
        }
        const start = Date.parse(job.started_at), end = Date.parse(job.completed_at);
        if (job.status === 'completed' && job.conclusion === 'skipped' && ((!Number.isFinite(start) && !Number.isFinite(end)) || (Number.isFinite(start) && start === end && end <= now))) {
          coverage.excludedJobs++;
          // Known zero execution is an observation only with dated membership.
          // Undated/old skips cannot create an in-window logical-run sample.
          if (Number.isFinite(end) && end >= since) observed.jobs++;
          continue;
        }
        if (Number.isFinite(end) && end < since) { coverage.excludedJobs++; runComplete = false; continue; }
        if (end > now) { gap('future job completion excluded'); group.complete = observed.complete = false; coverage.unknownJobs++; continue; }
        if (job.status !== 'completed' || !Number.isFinite(start) || !Number.isFinite(end) || end < start) { gap('job timing unavailable or unfinished'); group.complete = observed.complete = false; coverage.unknownJobs++; continue; }
        const runner = runnerUsage(job, report.visibility, options), minutes = Math.ceil((end - start) / 60000);
        if (runner.weight === null) { gap('unknown runner weighting'); group.complete = observed.complete = false; coverage.unknownJobs++; }
        const weightedMinutes = runner.weight === null ? null : minutes * runner.weight;
        group.jobs.push({ id: job.id, runId: run.id, attempt: job.run_attempt ?? attempt, conclusion: job.conclusion, startedAt: job.started_at, completedAt: job.completed_at, minutes, weightedMinutes, runner });
        observed.jobs++; observed.weightedMinutes += weightedMinutes ?? 0;
        group.observedWeightedMinutes += weightedMinutes ?? 0;
      }
      if (observed.jobs) { group.runs.push(observed); logicalRows.push(observed); }
    }
    // Completion-window coverage is distinct from a whole logical run's cost.
    // Every non-skipped job across every attempt must contribute: unfinished
    // or out-of-window jobs, missing pages, and invalid metadata disqualify all
    // rows, even when the omitted attempt produced no in-window row itself.
    runComplete &&= (coverage.failures ?? 0) === runGaps;
    for (const observed of logicalRows) observed.runComplete = runComplete;
  }
  report.workflows = [...groups.values()];
  for (const group of report.workflows) {
    group.complete &&= runPagesComplete;
    group.weightedMinutes = group.complete ? group.observedWeightedMinutes : null;
    report.observedWeightedMinutes += group.observedWeightedMinutes;
  }
  report.weightedMinutes = coverage.complete ? report.observedWeightedMinutes : null;
  return report;
}

/** The artifact a workflow keeps of the test ledger's records (migration 0005); uploaded only when the ledger wrote some. */
export const LEDGER_ARTIFACT = 'keel-test-runs';
/** A job or step whose name says it runs tests. */
const TESTS_NAMED = /\btest(?:s|ing)?\b/i;
/** A job or step that ran to a verdict, not one skipped, cancelled or never reached. */
const executed = x => x?.conclusion === 'success' || x?.conclusion === 'failure';

/**
 * Evidence that the reused attempt ran tests (keel#93, #95): an executed job
 * named for tests whose every step ran. Not a step's name, and not the test
 * ledger's artifact until its contents are read (#96). A run with none (its
 * test jobs skipped, only lint or setup run) gives null, and the night runs
 * its local gate: a green run of nothing is not a gate that passed.
 */
async function testEvidence(client, repo, run, jobs, sha) {
  const ran = jobs.filter(j => executed(j) && Number.isFinite(Date.parse(j.started_at)));
  for (const j of ran) {
    const steps = Array.isArray(j.steps) ? j.steps : [];
    // A job named for tests counts when none of its steps was skipped (#95): a successful `test` job whose
    // `Run tests` step a condition skipped ran no tests. With no step detail, its name is what there is.
    // A run that failed (#98): GitHub skips the steps after a failed one, so those skips are the failure's, and
    // the reused gate is that failure either way. A run that succeeded keeps every step's having run: a test job
    // allowed to fail (continue-on-error, a matrix lane) with its tests skipped is no evidence of a pass.
    const failedAt = run.conclusion === 'failure' ? steps.findIndex(s => s?.conclusion === 'failure') : -1;
    if (TESTS_NAMED.test(j.name ?? '') && (failedAt < 0 ? steps : steps.slice(0, failedAt + 1)).every(s => executed(s))) return { kind: 'job', job: j.name };
    // No step's name is evidence (#95): a step named for tests can be the one keeping the ledger's artifact
    // ("Keep the test ledger"), which succeeds with nothing to keep.
  }
  // Nor the ledger's artifact, until its contents are read (#95, #96): the gate's own timing record (kind
  // "gate", no tests) is written and uploaded even when no tests ran. Without evidence, the local gate runs.
  return null;
}

/** Exact clean revision CI reuse. Explicit workflow selection is done by the caller. */
export async function readCiGate({ repo, workflow, sha, clean, env, now = Date.now(), limits, request } = {}) {
  const unavailable = reason => ({ reused: false, reason });
  if (!clean || !/^[0-9a-f]{40,64}$/i.test(sha ?? '')) return unavailable('revision is dirty or unavailable');
  const client = actionsClient({ repo, env, limits, request });
  try {
    const metadata = await client.get(`repos/${repo}`);
    const flows = await client.pages(`repos/${repo}/actions/workflows`, 'workflows', 'workflowPages');
    const matches = flows.filter(w => w.name === workflow || w.path === workflow || w.path?.split('/').at(-1) === workflow || String(w.id) === workflow);
    if (!client.coverage.complete || matches.length !== 1) return unavailable('configured workflow unavailable or ambiguous');
    const rows = await client.pages(`repos/${repo}/actions/workflows/${matches[0].id}/runs?head_sha=${sha}`, 'workflow_runs', 'runPages');
    if (!client.coverage.complete) return unavailable('CI run history incomplete');
    // Never fall back to an earlier green run when a newer matching run is pending.
    const same = rows.filter(r => r.workflow_id === matches[0].id && r.head_sha === sha && r.head_repository?.full_name?.toLowerCase() === repo.toLowerCase() && r.head_branch === metadata.default_branch && r.event === 'push');
    if (same.some(r => !Number.isFinite(Date.parse(r.created_at)) || !Number.isFinite(Date.parse(r.updated_at)) || Date.parse(r.updated_at) > now || Date.parse(r.updated_at) < Date.parse(r.created_at))) return unavailable('run ordering unavailable');
    same.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id);
    if (same.length > 1 && Date.parse(same[0].updated_at) === Date.parse(same[1].updated_at)) return unavailable('latest attempt ordering ambiguous');
    const run = same[0];
    if (!run || run.status !== 'completed' || !['success', 'failure'].includes(run.conclusion)) return unavailable('no completed success/failure on the exact default-branch revision');
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) return unavailable('run attempt unavailable');
    const jobs = await client.pages(`repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs', 'jobPages');
    if (!client.coverage.complete || !jobs.length || jobs.some(j => j.run_id !== run.id || !attemptMatches(j, run.run_attempt) || j.head_sha !== sha || j.status !== 'completed' || (!Number.isFinite(Date.parse(j.completed_at)) && j.conclusion !== 'skipped'))) return unavailable('completion timing unavailable');
    if (!jobs.some(j => j.conclusion !== 'skipped' && Number.isFinite(Date.parse(j.started_at)))) return unavailable('no executed jobs');
    if (jobs.some(j => j.conclusion !== 'skipped' && (!Number.isFinite(Date.parse(j.started_at)) || Date.parse(j.started_at) > Date.parse(j.completed_at)))) return unavailable('invalid job runtime');
    const completed = Math.max(...jobs.map(j => Date.parse(j.completed_at)).filter(Number.isFinite));
    const ageMs = now - completed;
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > DAY) return unavailable('CI result outside 24-hour window');
    const evidence = await testEvidence(client, repo, run, jobs, sha);
    if (!evidence) return unavailable('no test job or test-ledger run executed in the CI run');
    return { reused: true, source: 'github-actions', workflow: matches[0].path, runId: run.id, attempt: run.run_attempt, sha, conclusion: run.conclusion, ageMs, ordering: 'run updated_at', updatedAt: run.updated_at, completedAt: new Date(completed).toISOString(), status: run.conclusion === 'success' ? 0 : 1, testEvidence: evidence, tests: null, ms: null };
  } catch { return unavailable('Actions API unavailable'); }
}
