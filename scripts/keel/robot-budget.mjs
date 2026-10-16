// Robot allowance counts model-step time, across attempts, never queue time.
import { robotGithub, robotRead, robotRepo, robotId, robotSha } from './robot-delivery.mjs';
export const ROBOT_MODEL_STEPS = Object.freeze(['Robot build Claude', 'Robot build Codex', 'Robot review Claude', 'Robot review Codex']);
export function robotWeek(now) {
  const end = new Date(now);
  if (!Number.isFinite(end.getTime())) throw new Error('invalid budget clock');
  const start = new Date(end); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return { windowStart: start.toISOString(), windowEnd: new Date(start.getTime() + 7 * 86400_000).toISOString(), observedAt: end.toISOString() };
}
async function pages(github, path, key) {
  const rows = []; let total;
  for (let page = 1; page <= 5; page++) {
    const data = await robotRead(github, `${path}?per_page=100&page=${page}`);
    if (!Array.isArray(data?.[key]) || !Number.isSafeInteger(data.total_count) || data.total_count < 0 || (total !== undefined && total !== data.total_count)) throw new Error('budget page identity/coverage unavailable');
    total = data.total_count; rows.push(...data[key]);
    if (rows.length === total) return rows;
    if (data[key].length < 100 || rows.length > total) throw new Error('budget pages truncated');
  }
  throw new Error('budget history exceeds bounded coverage');
}
export async function readRobotBudget({ repo, policy, now = new Date(), github = robotGithub, preflight = null }) {
  let window;
  try { window = robotWeek(now); } catch (e) { return { state: 'unknown', windowStart: null, windowEnd: null, observedAt: null, usedSeconds: null, remainingSeconds: null, complete: false, reasons: [e.message] }; }
  const result = { ...window, state: 'unknown', usedSeconds: null, remainingSeconds: null, complete: false, reasons: [] };
  if (!policy?.valid) return { ...result, state: 'invalid', reasons: policy?.problems ?? ['policy unavailable'] };
  if (!policy.enabled) return { ...result, state: 'off' };
  try {
    if (!robotRepo(repo) || !(policy.weeklyMinutes > 0 && Number.isFinite(policy.weeklyMinutes))) throw new Error('invalid budget identity or allowance');
    const workflow = await robotRead(github, `/repos/${repo}/actions/workflows/keel-robot.yml`);
    if (!robotId(workflow.id) || workflow.path !== '.github/workflows/keel-robot.yml') throw new Error('budget workflow identity unavailable');
    // Only the model worker: public-event router runs have their own history.
    // Include legacy worker events and old logical runs rerun this week. Never
    // filter by event/created_at or treat the 500-worker-run coverage cap as zero.
    const runs = await pages(github, `/repos/${repo}/actions/workflows/${workflow.id}/runs`, 'workflow_runs');
    let used = 0, sawPreflight = false, countedCurrentBuild = false; const ids = new Set(), jobIds = new Set();
    const start = Date.parse(window.windowStart), end = Date.parse(window.observedAt);
    for (const run of runs) {
      if (!robotId(run.id) || ids.has(run.id) || run.workflow_id !== workflow.id || run.repository?.full_name !== repo || !robotSha(run.head_sha) || !robotId(run.run_attempt)) throw new Error('budget run identity unavailable');
      ids.add(run.id);
      if (preflight?.runId === run.id && preflight.attempt !== run.run_attempt) throw new Error('current preflight attempt unavailable');
      // Updated time is only an exclusion when the entire logical run completed before this week.
      if (!Number.isFinite(Date.parse(run.updated_at)) || Date.parse(run.updated_at) > end) throw new Error('budget run time unavailable');
      if (run.status === 'completed' && Date.parse(run.updated_at) < start) continue;
      if (run.run_attempt > 100) throw new Error('budget attempts exceed bounded coverage');
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
        const jobs = await pages(github, `/repos/${repo}/actions/runs/${run.id}/attempts/${attempt}/jobs`, 'jobs');
        if (!jobs.length && run.status !== 'queued') throw new Error('budget jobs unavailable');
        for (const job of jobs) {
          const id = `${run.id}:${attempt}:${job.id}`;
          if (!robotId(job.id) || jobIds.has(id) || job.run_id !== run.id || (Object.hasOwn(job, 'run_attempt') && job.run_attempt !== attempt) || job.head_sha !== run.head_sha) throw new Error('budget job identity unavailable');
          jobIds.add(id);
          if (job.status === 'queued' || job.conclusion === 'skipped') continue;
          if (!['agent','judge','publish','review-agent','review-post'].includes(job.name)) throw new Error('unrecognised robot job; usage cannot be established');
          const beforeModel = preflight && preflight.runId === run.id && preflight.attempt === attempt && preflight.job === job.name && ['agent','review-agent'].includes(job.name) && job.status === 'in_progress';
          if (beforeModel) sawPreflight = true;
          if (!Array.isArray(job.steps) && !beforeModel) throw new Error('budget steps unavailable');
          const seen = new Set();
          for (const step of job.steps ?? []) {
            if (!ROBOT_MODEL_STEPS.includes(step.name)) continue;
            if (seen.has(step.name)) throw new Error('duplicate model step');
            seen.add(step.name);
            if (step.conclusion === 'skipped' || step.status === 'queued' || step.status === 'pending') continue;
            const a = Date.parse(step.started_at), b = Date.parse(step.completed_at);
            if (step.status !== 'completed' || !Number.isFinite(a) || !Number.isFinite(b) || b < a || b > end) throw new Error('model usage incomplete');
            used += Math.max(0, b - Math.max(a, start)) / 1000;
          }
          if (['agent', 'review-agent'].includes(job.name) && seen.size !== 2 && !beforeModel) throw new Error('model job step coverage incomplete');
          // Re-run failed jobs can reuse the completed build from an earlier
          // attempt of this same logical run; every attempt is still accounted.
          if (preflight?.runId === run.id && attempt <= preflight.attempt && job.name === 'agent' && job.status === 'completed' && seen.size === 2) countedCurrentBuild = true;
        }
      }
    }
    if (preflight && (!sawPreflight || (preflight.job === 'review-agent' && !countedCurrentBuild))) throw new Error('current preflight/build coverage unavailable');
    const remainingSeconds = Math.max(0, policy.weeklyMinutes * 60 - used);
    return { ...result, state: remainingSeconds > 0 ? 'available' : 'exhausted', usedSeconds: used, remainingSeconds, complete: true };
  } catch (e) { return { ...result, reasons: [e.message] }; }
}
export function robotAdmission({ policy, budget, requestedBuildSeconds, reservedReviewSeconds }) {
  const refuse = reason => ({ allowed: false, buildSeconds: 0, reviewSeconds: 0, reason });
  if (!policy?.valid || !policy.enabled) return refuse('robot is off or policy invalid');
  if (budget?.state !== 'available' || !budget.complete || !Number.isFinite(budget.remainingSeconds) || !Number.isFinite(budget.usedSeconds) || budget.usedSeconds < 0 || budget.remainingSeconds !== Math.max(0, policy.weeklyMinutes * 60 - budget.usedSeconds)) return refuse('budget unavailable or mismatched');
  if (![requestedBuildSeconds, reservedReviewSeconds].every(n => Number.isInteger(n) && n >= 60)) return refuse('build and review need bounded positive allocations');
  // Actions timeout-minutes is integral here: round DOWN, never overspend a remainder.
  const available = Math.floor(budget.remainingSeconds / 60) * 60;
  const reviewSeconds = Math.ceil(reservedReviewSeconds / 60) * 60;
  const buildSeconds = Math.floor(Math.min(requestedBuildSeconds, available - reviewSeconds) / 60) * 60;
  return buildSeconds >= 60 ? { allowed: true, buildSeconds, reviewSeconds, reason: 'serialized build and other-provider review fit the allowance' } : refuse('insufficient allowance for build and review');
}
