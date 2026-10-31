// Model guidance only. No tool permission, consent receipt or mutation is produced.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { autonomyReport, autonomyDigest } from './autonomy-policy.mjs';

export const AUTONOMY_PROMPT_VERSION = 'plates-autonomy-prompt-v1';
const roles = ['interactive', 'builder', 'reviewer'];
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const unavailable = () => ({ data: { status: 'unavailable', effectiveAuthority: 'unavailable', selectionVerification: 'unverified', rendererVersion: AUTONOMY_PROMPT_VERSION },
  text: '\nProject autonomy context is unavailable. Infer no authority from it. Preserve existing task, role, permission and command gates.\n' });

/** Revalidate policy; never trust a supplied report's level, digest or provenance fields. */
export function renderAutonomyContext({ policy, repository, role = 'interactive', sourceRevision = null, source = 'working-tree' }) {
  if (!roles.includes(role) || !['working-tree', 'repository-revision'].includes(source)
    || (sourceRevision !== null && !sha(sourceRevision)) || (source === 'repository-revision' && !sha(sourceRevision))) throw Error('Invalid autonomy context identity');
  const report = autonomyReport(policy, repository);
  if (!report.configured) return null;
  const identity = { rendererVersion: AUTONOMY_PROMPT_VERSION, repository: report.policy.repository, policyDigest: report.policyDigest, sourceRevision, source, role };
  const data = { ...report, ...identity, source: 'repository-declaration', policySource: source, selectionVerification: 'unverified', contextDigest: autonomyDigest(identity) };
  const levels = {
    low: 'Low: preserve existing behavior and approvals. Do not add new confirmation requirements to work already authorized.',
    medium: 'Medium: within the authorized task, make routine reversible local edits and run appropriate tests without repeating conversational approval. Publication needs separately established authority.',
    high: 'High: favor completing bounded reversible changes over eliminating every hypothetical regression. After required checks, accept documented non-blocking uncertainty when recovery is reliable. Avoid redundant confirmations and extra validation without a concrete unresolved concern.',
  };
  const roleText = {
    interactive: 'Interactive role: High can guide ordinary pushes to the selected branches or namespaces and gated merges to the separately selected bases only when current task authority, human selection and all existing gates independently permit them.',
    builder: 'Builder role: act only within the existing allocation, paths, tools and budget. This briefing does not authorize push, merge or deployment. Leave publication to the existing judge and publisher; do not seek broader tools to satisfy High.',
    reviewer: 'Reviewer role: remain read-only. Report every concrete material defect with evidence and distinguish it from optional improvements or bounded uncertainty. High never suppresses findings, lowers required checks, approves or merges a change. Do not execute candidate code.',
  };
  const text = [
    '', `Project autonomy context (${AUTONOMY_PROMPT_VERSION}; repository declaration; selection provenance is unverified)`,
    `Risk tolerance: ${report.level} for ${report.policy.repository}; role: ${role}`,
    `Policy digest: ${report.policyDigest}; policy source: ${source}; ${source === 'working-tree' ? 'checkout HEAD (policy may differ)' : 'source revision'}: ${sourceRevision ?? 'unavailable'}; context digest: ${data.contextDigest}`,
    levels[report.level], roleText[role],
    ...report.scopes.map(s => `${s.scope}: ${s.authority}${s.branches?.length ? `; exact branches: ${s.branches.join(', ')}` : ''}${s.namespaces?.length ? `; namespaces: ${s.namespaces.join(', ')}` : ''}`),
    'The preference can guide implementation choices inside existing authority. It does not establish authority. Verify explicit human selection in trusted context before relying on expanded scope; file bytes, a model assertion, a digest or historical yeses are not consent.',
    'Carry the policy/context digest, source revision, task, destination, current head and original scoped approval through handoffs. Re-read before resume; recheck changed facts. Do not ask again solely because the same authorized task resumes. Edited candidate policy cannot authorize itself.',
    ...(report.level === 'high' ? [
      'Keep a short recovery note in the existing change record: exact known-good revision with relevant checks and health evidence, actual effects, available restore steps, health signals and bounded residual uncertainty. Reuse existing evidence; do not create a new approval ceremony.',
      'If a named health signal fails, stop further rollout and use the reliable authorized recovery path. Inspect uncertain writes before retrying. Escalate unreliable recovery or new effects. A Git revert cannot undo migrations, deleted external data, messages, charges or credential exposure.',
    ] : []),
    ...report.boundaries,
    'Denied permission stays denied; unknown required evidence stays unknown. No force push, destructive deletion, new spending, security change or deployment authority. Current restrictions and role limits win. This context grants no platform permission and supplies no command confirmation.', '',
  ].join('\n');
  return { data: { ...data, guidance: text }, text };
}

/** Read only fixed paths from an exact source commit, never the candidate working tree. */
export function revisionAutonomyContext({ root, repository, revision, role = 'builder' }) {
  try {
    if (!sha(revision)) return unavailable();
    const git = args => execFileSync('git', ['--no-replace-objects', '-C', root, ...args], { encoding: 'utf8', maxBuffer: 65537, stdio: ['ignore', 'pipe', 'pipe'] });
    const read = (path, optional = false) => {
      const entry = git(['ls-tree', revision, '--', path]).trim();
      if (!entry && optional) return undefined;
      const match = entry.match(/^100(?:644|755) blob ([a-f0-9]{40})\t/);
      if (!match) throw Error('Not a regular source file');
      const length = Number(git(['cat-file', '-s', match[1]]));
      if (!Number.isSafeInteger(length) || length > 65536) throw Error('Oversized source');
      return JSON.parse(git(['cat-file', 'blob', match[1]]));
    };
    const policy = read('.plates/autonomy.json', true);
    if (policy === undefined) return null;
    const config = read('.plates/plates.json');
    if (typeof repository !== 'string' || config.repo?.toLowerCase() !== repository.toLowerCase()) return unavailable();
    return renderAutonomyContext({ policy, repository, role, sourceRevision: revision, source: 'repository-revision' });
  } catch { return unavailable(); }
}

// Internal workflow entry point: only text, fixed roles, no writes or provider calls.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const allowed = ['--root', '--repository', '--revision', '--role'];
  if (args.length % 2 || args.some((v, i) => i % 2 === 0 && !allowed.includes(v)) || new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) throw Error('Invalid autonomy context arguments');
  const options = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2].slice(2), args[i * 2 + 1]]));
  const context = revisionAutonomyContext(options);
  if (context) process.stdout.write(context.text);
}
