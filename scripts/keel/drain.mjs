// The night shift's drain (keel practice `night`; managed: keel render
// rewrites it). A machine queue holds at most one open pull request, the
// newest, and machinery enforces it, not a person remembering (keel
// docs/design.md §6; isocan's "The night shift's pull requests"). Node
// built-ins and gh only: it runs from the project's own checkout. keel's
// `keel drain` is this same module.
//
//   node scripts/keel/drain.mjs <prefix> [--gate-passed] [--yes] [--json]
//
// The queue is every open PR whose head branch starts with <prefix>, from this
// repo (a fork's PR is never a machine PR, whatever its branch is called).
// The newest by createdAt is kept. Each older one, oldest first:
//   - it holds only data (DATA: docs/health/, docs/inbox/, docs/INBOX.md,
//     .keel/bounds.json, and the health directory .keel/keel.json "health"
//     names, when it names one; for keel-loop/ instead docs/loop/ and docs/LOOP.md,
//     DATA_BY_PREFIX, plus the files .keel/keel.json "loop" "afterRenderWrites"
//     names) and GitHub says MERGEABLE → squash-merged, branch kept;
//   - otherwise, or if that merge fails → closed as superseded by the newest,
//     with a comment saying how to recover it (the branch is kept).
// Then the newest: merged under the same rule only with --gate-passed (the
// run's gate passed on that tree; a GITHUB_TOKEN PR runs no CI, so nothing
// else checked it). Otherwise it is left for a person.
// mergeable UNKNOWN (GitHub has not computed it yet) is asked once more after a
// short wait, then treated as not mergeable for this run.
// A PR whose head does not start with <prefix> is never read further.
//
// Exit: 0 done (or nothing to do); 3 actions planned and no --yes, nothing
// done; 1 a gh call failed; 2 usage. gh is process.env.KEEL_GH || 'gh'.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isMain, rootOf, main, healthDirOf, HEALTH_DIR } from './lib.mjs';

export const DATA_DIRS = [`${HEALTH_DIR}/`, 'docs/inbox/'];
export const DATA_FILES = ['docs/INBOX.md', '.keel/bounds.json'];
/**
 * A queue whose data is something else: its own paths, instead of the
 * night's. keel-loop/ (practice loop) holds Loop's findings and their page.
 */
export const DATA_BY_PREFIX = {
  'keel-loop/': { dirs: ['docs/loop/'], files: ['docs/LOOP.md'] },
};
export const FIELDS = 'number,headRefName,createdAt,mergeable,files,isCrossRepository';
export const SUPERSEDED = newest => `Superseded by #${newest} (keel drain). The branch is kept: reopen to recover.`;

export class DrainError extends Error {
  constructor(message, exitCode = 1) { super(message); this.exitCode = exitCode; }
}

/**
 * A path the queue under `prefix` writes as data, never code. `extra` is the
 * paths the project says its own step writes beside that data — for
 * keel-loop/, what "afterRenderWrites" names (a roadmap that counts findings
 * is rewritten by every pull, so a PR without it leaves main stale); for the
 * night's queues, its configured health directory. An entry ending in / is a
 * directory.
 */
export const isData = (path, prefix, extra = []) => {
  if (/^docs\/(?:phases|projects|decisions|research|evidence|records)(?:\/|$)/.test(path) || path === 'docs/design.md') return false;
  const { dirs, files } = DATA_BY_PREFIX[prefix] ?? { dirs: DATA_DIRS, files: DATA_FILES };
  return files.includes(path) || dirs.some(d => path.startsWith(d)) ||
    extra.some(e => e.endsWith('/') ? path.startsWith(e) : e === path);
};
const dataOnly = (pr, prefix, extra) => Array.isArray(pr.files) && pr.files.length > 0 && pr.files.every(f => isData(f.path, prefix, extra));

/**
 * The paths beyond a queue's own data that it may carry, from the project's
 * .keel/keel.json: for keel-loop/, "loop" "afterRenderWrites"; for the night's
 * queues, the "health" directory (healthDirOf), beside the default. Anything
 * that is not a plain repo-relative path is dropped, never trusted.
 */
export function extraData(keel, prefix) {
  if (prefix === 'keel-loop/') {
    const list = keel?.loop?.afterRenderWrites;
    return Array.isArray(list) ? list.filter(isPlainPath) : [];
  }
  if (DATA_BY_PREFIX[prefix] || keel?.health === undefined) return [];
  let dir;
  try { dir = healthDirOf(keel); } catch { return []; }
  return isPlainPath(dir) && dir !== HEALTH_DIR ? [`${dir}/`] : [];
}

/** A repo-relative file path: no leading slash, no `..`, no `.github/`, no glob, no whitespace (the workflow hands it to a shell). */
export const isPlainPath = p =>
  typeof p === 'string' && p.trim() === p && p !== '' && !p.startsWith('/') && !p.endsWith('/') &&
  !p.split('/').some(seg => seg === '..' || seg === '.' || seg === '') && !p.startsWith('.github/') && !/[*?[\]\\\s]/.test(p);

/** A prefix names a machine namespace: it has a slash, and is not one. */
export function checkPrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix.includes('/') || prefix.startsWith('/') || /\s/.test(prefix)) {
    throw new DrainError(`keel drain: the prefix must name a branch namespace like keel-night/ (got ${JSON.stringify(prefix)})`, 2);
  }
  return prefix;
}

/**
 * What a drain would do with these PRs, as data. Pure.
 * Returns { queue, newest, actions: [{ number, head, createdAt, action: merge|close|leave, why }] }.
 */
export function plan(prs, prefix, { gatePassed = false, extra = [] } = {}) {
  const queue = prs.filter(p => typeof p.headRefName === 'string' && p.headRefName.startsWith(prefix) && !p.isCrossRepository)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.number - b.number);
  if (!queue.length) return { queue: [], newest: null, actions: [] };
  const newest = queue.at(-1);
  const row = (pr, action, why) => ({ number: pr.number, head: pr.headRefName, createdAt: pr.createdAt, action, why });
  const actions = queue.slice(0, -1).map(pr => {
    if (!dataOnly(pr, prefix, extra)) return row(pr, 'close', `superseded by #${newest.number}; it touches more than data (${(pr.files ?? []).map(f => f.path).filter(p => !isData(p, prefix, extra)).slice(0, 3).join(', ') || 'no files'})`);
    if (pr.mergeable !== 'MERGEABLE') return row(pr, 'close', `superseded by #${newest.number}; it does not merge cleanly (${pr.mergeable ?? 'UNKNOWN'})`);
    return row(pr, 'merge', 'data only, and it still merges');
  });
  let last;
  if (!dataOnly(newest, prefix, extra)) last = row(newest, 'leave', 'the newest touches more than data: left for a person');
  else if (newest.mergeable !== 'MERGEABLE') last = row(newest, 'leave', `the newest does not merge cleanly yet (${newest.mergeable ?? 'UNKNOWN'}): left for a person`);
  else if (!gatePassed) last = row(newest, 'leave', 'the newest is data, but the gate did not pass on its tree (no --gate-passed): left for a person');
  else last = row(newest, 'merge', 'the newest: data only, it merges, and the gate passed on its tree');
  return { queue, newest: newest.number, actions: [...actions, last] };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** opts: { root, prefix, yes, gatePassed }; deps: { env }. */
export async function drain({ root, prefix, yes = false, gatePassed = false }, { env = process.env } = {}) {
  checkPrefix(prefix);
  const gh = env.KEEL_GH || 'gh';
  let keel = {};
  try { keel = JSON.parse(await readFile(join(root, '.keel', 'keel.json'), 'utf8')) ?? {}; } catch { keel = {}; }
  const repo = keel.repo ?? null;
  const extra = extraData(keel, prefix);
  const R = repo ? ['--repo', repo] : [];
  const call = args => {
    try { return { ok: true, out: execFileSync(gh, args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }) }; }
    catch (e) { return { ok: false, err: String(e.stderr || e.message).trim().split('\n')[0] }; }
  };
  const list = () => {
    const r = call(['pr', 'list', ...R, '--state', 'open', '--limit', '200', '--json', FIELDS]);
    if (!r.ok) throw new DrainError(`${gh} pr list failed: ${r.err}`);
    let data;
    try { data = JSON.parse(r.out); } catch { throw new DrainError(`${gh} pr list did not print JSON`); }
    if (!Array.isArray(data)) throw new DrainError(`${gh} pr list did not print a JSON array`);
    return data;
  };

  let prs = list();
  const ours = () => prs.filter(p => p.headRefName?.startsWith(prefix) && !p.isCrossRepository);
  if (ours().some(p => p.mergeable === 'UNKNOWN' || p.mergeable === undefined)) {
    // GitHub computes mergeability lazily; the first ask starts it.
    await sleep(Number(env.KEEL_DRAIN_WAIT_MS ?? 5000));
    prs = list();
  }
  const p = plan(prs, prefix, { gatePassed, extra });
  const acting = p.actions.filter(a => a.action !== 'leave');
  const lines = a => `  #${a.number} ${a.head}: ${a.action} — ${a.why}`;
  const head = `keel drain ${prefix}: ${p.queue.length} open PR${p.queue.length === 1 ? '' : 's'}${p.newest ? `, newest #${p.newest}` : ''}.`;
  if (!acting.length) {
    return { data: { ok: true, prefix, repo, newest: p.newest, actions: p.actions }, text: [head, ...p.actions.map(lines), ...(p.actions.length ? [] : ['Nothing to drain.'])].join('\n') };
  }
  if (!yes) {
    return {
      data: { ok: false, needs: 'yes', prefix, repo, newest: p.newest, actions: p.actions },
      text: [head, ...p.actions.map(lines), '', '⚑ Merging and closing PRs needs a yes. Nothing was done; re-run with --yes.'].join('\n'),
      exitCode: 3,
    };
  }

  const done = [];
  let failed = false;
  const close = a => {
    const r = call(['pr', 'close', String(a.number), ...R, '--comment', SUPERSEDED(p.newest)]);
    if (r.ok) return { ...a, action: 'close', done: true };
    failed = true;
    return { ...a, action: 'close', done: false, error: r.err };
  };
  for (const a of p.actions) {
    if (a.action === 'leave') { done.push({ ...a, done: false }); continue; }
    if (a.action === 'close') { done.push(close(a)); continue; }
    const r = call(['pr', 'merge', String(a.number), ...R, '--squash', '--delete-branch=false']);
    if (r.ok) { done.push({ ...a, done: true }); continue; }
    // A merge that fails is not a merge. An older PR is then superseded; the
    // newest (a sibling just merged may have moved its base) waits for a person.
    if (a.number === p.newest) done.push({ ...a, action: 'leave', done: false, why: `the merge failed (${r.err}): left for a person` });
    else done.push(close({ ...a, why: `superseded by #${p.newest}; the merge failed (${r.err})` }));
  }
  const verb = a => a.done ? (a.action === 'merge' ? 'merged' : 'closed') : a.action === 'leave' ? 'left' : `FAILED to ${a.action} (${a.error})`;
  return {
    data: { ok: !failed, prefix, repo, newest: p.newest, actions: done },
    text: [head, ...done.map(a => `  #${a.number} ${a.head}: ${verb(a)} — ${a.why}`)].join('\n'),
    exitCode: failed ? 1 : 0,
  };
}

/** The script's own arguments: <prefix> [--gate-passed] [--yes]. */
export function parseArgs(args) {
  const flags = ['--gate-passed', '--yes'];
  const unknown = args.find(a => a.startsWith('--') && !flags.includes(a));
  if (unknown) throw new DrainError(`unexpected argument: ${unknown}`, 2);
  const positional = args.filter(a => !a.startsWith('--'));
  if (positional.length !== 1) throw new DrainError(positional.length ? `unexpected argument: ${positional[1]}` : 'usage: node scripts/keel/drain.mjs <prefix> [--gate-passed] [--yes] [--json]', 2);
  return { prefix: positional[0], yes: args.includes('--yes'), gatePassed: args.includes('--gate-passed') };
}

if (isMain(import.meta)) await main(args => drain({ root: rootOf(import.meta), ...parseArgs(args) }));
