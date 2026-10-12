// Read-only GitHub planning source. Shipped with night: no CLI checkout needed.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { githubRead, quotaGuard, rememberQuota } from './quota.mjs';

import { milestoneSource, planningConfig } from './planning-config.mjs';
export { milestoneSource };
export const MILESTONE_QUERY = `query($owner:String!,$name:String!) {
  rateLimit { cost remaining resetAt }
  repository(owner:$owner,name:$name) {
    openMilestones: milestones(first:50,states:[OPEN],orderBy:{field:NUMBER,direction:ASC}) {
      pageInfo { hasNextPage }
      nodes { number title description url state dueOn updatedAt closedAt
        issues(first:50) { pageInfo { hasNextPage }
          nodes { number title url state labels(first:20) { nodes { name } pageInfo { hasNextPage } } }
        }
      }
    }
    closedMilestones: milestones(first:20,states:[CLOSED],orderBy:{field:UPDATED_AT,direction:DESC}) {
      pageInfo { hasNextPage }
      nodes { number title description url state dueOn updatedAt closedAt
        issues(first:50) { pageInfo { hasNextPage }
          nodes { number title url state labels(first:20) { nodes { name } pageInfo { hasNextPage } } }
        }
      }
    }
  }
}`;

const gh = (args, env) => new Promise((resolve, reject) => {
  execFile(env.KEEL_GH || 'gh', args, { env, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 },
    (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      const message = String(stderr || error.message).trim();
      // gh exits nonzero on GraphQL errors, but stdout may still report the spend.
      try {
        const body = JSON.parse(stdout);
        return resolve({ data: body?.data, errors: [{ message }] });
      } catch { reject(new Error(message)); }
    });
});

function connection(value, name, gaps) {
  if (!Array.isArray(value?.nodes) || typeof value?.pageInfo?.hasNextPage !== 'boolean') throw new Error(`malformed ${name} connection`);
  if (value.pageInfo.hasNextPage) gaps.push(`${name} truncated`);
  return value.nodes;
}
const urlOK = url => typeof url === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/(milestone|issues)\/\d+$/.test(url);
function record(node, kind) {
  if (!node || !Number.isSafeInteger(node.number) || node.number < 1 || typeof node.title !== 'string' || !urlOK(node.url) || !['OPEN', 'CLOSED'].includes(node.state)) throw new Error(`malformed ${kind}`);
}

/** Exit criteria section, else bullet list, else the whole description (disclosed). */
export function exitCriteria(description) {
  const section = /(?:^|\n)#{1,6}\s+Exit criteria\s*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i.exec(description);
  if (section?.[1].trim()) return { done: section[1].trim(), doneFrom: 'exit-criteria' };
  const bullets = description.split('\n').filter(line => /^\s*(?:[-*+] |\d+[.)] )/.test(line));
  return { done: bullets.length ? bullets.join('\n') : description.trim(), doneFrom: bullets.length ? 'bullets' : 'description' };
}

function observedQuota(response) {
  const q = response?.data?.rateLimit;
  return q && Number.isFinite(q.cost) && q.cost >= 0 && Number.isFinite(q.remaining) && q.remaining >= 0 && Number.isFinite(Date.parse(q.resetAt)) ? q : null;
}

/** Pure mapping seam. GraphQL errors and malformed/missing connections never mean empty. */
export function projectMilestones(response, config) {
  const { ownerLabel } = planningConfig(config);
  if (typeof response === 'string') response = JSON.parse(response);
  if (response?.errors !== undefined && !Array.isArray(response.errors)) throw new Error('malformed GraphQL errors');
  if (response?.errors?.length) throw new Error(`GitHub milestones: ${response.errors.map(e => e.message).join('; ')}`);
  const data = response?.data;
  const quota = observedQuota(response);
  if (!quota) throw new Error('milestones response has no valid quota metadata');
  const gaps = [];
  const nodes = [
    ...connection(data?.repository?.openMilestones, 'open milestones', gaps),
    ...connection(data?.repository?.closedMilestones, 'closed milestones', gaps),
  ].sort((a, b) => a?.number - b?.number);
  const phases = nodes.map(m => {
    record(m, 'milestone');
    if (m.description !== null && typeof m.description !== 'string') throw new Error('malformed milestone description');
    if (!m.description?.trim()) gaps.push(`milestone ${m.number} missing exit criteria: description is empty`);
    if (m.dueOn !== null && !Number.isFinite(Date.parse(m.dueOn))) throw new Error('malformed milestone due date');
    const boxes = connection(m.issues, `milestone ${m.number} issues`, gaps).map((issue, i) => {
      record(issue, 'issue');
      const labels = connection(issue.labels, `issue ${issue.number} labels`, gaps);
      if (labels.some(l => typeof l?.name !== 'string')) throw new Error('malformed issue label');
      return { n: i + 1, number: issue.number, text: issue.title, url: issue.url, state: issue.state,
        checked: issue.state === 'CLOSED', walk: issue.state === 'OPEN' && labels.some(l => l.name === ownerLabel),
        ownershipKnown: issue.state === 'CLOSED' || labels.some(l => l.name === ownerLabel) || !issue.labels.pageInfo.hasNextPage };
    });
    return { id: m.number, title: m.title, source: 'milestones', readOnly: true, url: m.url, link: m.url,
      sourceState: m.state, status: m.state === 'CLOSED' ? 'closed' : boxes.some(b => b.checked) ? 'partial' : 'planned',
      due: m.dueOn, updatedAt: m.updatedAt ?? null, closedAt: m.closedAt ?? null,
      ...exitCriteria(m.description ?? ''), boxes, evidence: [], depends: [],
      ownershipComplete: !m.issues.pageInfo.hasNextPage && boxes.every(b => b.ownershipKnown),
      next: m.state === 'CLOSED' ? 'Closed on GitHub (planning state only).' : `Read the milestone and its issues on GitHub: ${m.url}` };
  });
  return { source: 'milestones', readOnly: true, config, phases, goals: [], coverage: { complete: !gaps.length, gaps }, quota };
}

/** One bounded query, behind the same cache/floor as all optional CLI reads. */
export async function readMilestones(config, { env = process.env, fresh = false, graphql, guard, now, spend } = {}) {
  const { ownerLabel } = planningConfig(config);
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo ?? '')) throw new Error('milestones require a known owner/repo in .keel/keel.json');
  const [owner, name] = config.repo.split('/');
  const identity = createHash('sha256').update(JSON.stringify([config.repo, ownerLabel])).digest('hex');
  const result = await githubRead(env, `milestones-v5-${identity}`, async () => {
    const raw = await (graphql ? graphql({ query: MILESTONE_QUERY, owner, name }) : gh(['api', 'graphql', '-f', `query=${MILESTONE_QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`], env));
    const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // A rejected/malformed projection still spent the quota GitHub reported.
    const quota = observedQuota(response);
    if (quota) {
      await rememberQuota(env, quota, now);
      if (spend) { spend.cost += quota.cost; spend.queries += 1; spend.remaining = quota.remaining; spend.resetAt = quota.resetAt; }
    }
    return projectMilestones(response, config);
  }, { fresh, now, guard: guard ?? (() => quotaGuard(env, spend)) });
  return { ...result.value, config, github: { readAt: result.at, cached: result.cached, cost: result.cached ? 0 : result.value.quota.cost,
    queries: result.cached ? 0 : 1, remaining: result.value.quota.remaining, resetAt: result.value.quota.resetAt } };
}

export async function milestonePlan(root, options) {
  const config = JSON.parse(await readFile(join(root, '.keel/keel.json'), 'utf8'));
  return milestoneSource(config) ? readMilestones(config, options) : null;
}

export async function requireLocalPhases(root) {
  const config = JSON.parse(await readFile(join(root, '.keel/keel.json'), 'utf8'));
  if (milestoneSource(config)) throw Object.assign(new Error('milestones are read-only GitHub planning records; no local phase or goal files are written'), { exitCode: 2 });
}

export const milestoneNext = data => data.phases.find(p => p.status !== 'closed') ?? null;
export const milestoneSummary = data => `${data.phases.filter(p => p.status === 'closed').length}/${data.phases.length} milestones closed on GitHub (planning state, not verified acceptance)${data.coverage.complete ? '' : `; coverage incomplete: ${data.coverage.gaps.join('; ')}`}`;
