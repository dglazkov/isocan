import { status as productionStatus, productionLines } from './production.mjs';
// The morning (plates practice `night`; managed: plates render rewrites it). When
// the night is over, one message says what it did: the brief, in isocan's
// order (done, tried, failed and why, left alone or not finished by, the
// owner's next), with links to the canvas, the health page and each PR,
// delivered as one GitHub issue assigned to the owner, so GitHub's own
// notification is the email (plates phase 77; the design is
// docs/research/2026-10-14-nightwatch.md, "The plan is a live card, and the
// morning sends a message"). plates's `plates morning` is this same module.
//
//   node scripts/plates/morning.mjs brief [--date d]       the brief, markdown (no write)
//   node scripts/plates/morning.mjs send [--date d]        the brief as the issue "Good morning, <d>"
//   node scripts/plates/morning.mjs decide [--github-output f]
//                                   plates-morning.yml's first job: is the last night over, and sent?
//   node scripts/plates/morning.mjs finalize --date d [--pr-input f]
//                                   the final plan as docs/night/<d>.json and the health page's
//                                   "Tonight's plan" section, in the working tree (plates#137)
//
// The night is over when every build item is terminal (done, failed,
// skipped or left alone), or at the plan's readyBy (default 17:00 UTC on the
// night's date, after climb and the robot), when any item still planned or
// running is "not finished by" that time, never done. One brief a night: an
// issue titled "Good morning, <d>" with the label keel:morning, open or
// closed, means it was sent, and a second send does nothing. A send closes
// the previous open keel:morning issue. It needs `morning.assignee` (a GitHub
// login) in .plates/plates.json and refuses, naming the key, without it.
//
// Tonight's final plan is read by ONE function, finalPlan: the plan as each
// place holds it (the night's record on its branches and in the checkout, the
// plan branch keel-night-plan, the working plan), the record first as the
// plan the night ran, each item at its furthest tick. Where passes record
// their ticks durably is phase 76's to settle; it changes finalPlan only.
//
// With the delivery practice on, the brief also reads production's verifies
// (plates phase 81: the branch keel-verify, below): each one that failed in the
// day before the night started is a line first under "Your next".
//
// Exit: 0 done (sent, already sent, or not yet over); 2 usage, no plan for
// the night, no assignee, or an input it cannot read; 1 a GitHub write
// failed (the workflow goes red). gh is process.env.PLATES_GH || 'gh'.
import { readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isMain, rootOf, main, healthDirOf } from './lib.mjs';
import { PLAN, PLAN_BRANCH, REMOTE_PLAN, NIGHT_AT, MAX_BYTES, recordOf, validatePlan, healthRows, planSection, safeWrite, writeRecord, NightPlanError } from './night-plan.mjs';

export const LABEL = 'keel:morning';
export const titleOf = date => `Good morning, ${date}`;
export const TERMINAL = Object.freeze(['done', 'failed', 'skipped', 'left-alone']);
/** A plan with no readyBy is over at 17:00 UTC on its date: climb (10:17, up to four hours) and the robot have run. */
export const READY_AT = Object.freeze({ hour: 17, minute: 0 });
/** The branch the morning's finalization PR uses: in the night's own queue (keel-night/), so its drain merges it as data. */
export const finalBranchOf = date => `keel-night/${date}-final`;
export const ASSIGNEE = 'morning.assignee';
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class MorningError extends Error {
  constructor(message, exitCode = 2) { super(message); this.exitCode = exitCode; }
}

/** The night that last started at `now`: today's after 07:23 UTC, else yesterday's. */
export function lastNight(now = new Date()) {
  const d = new Date(now);
  if (!Number.isFinite(d.getTime())) throw new MorningError('lastNight: not a time');
  if (d.getUTCHours() * 60 + d.getUTCMinutes() < NIGHT_AT.hour * 60 + NIGHT_AT.minute) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const pad = n => String(n).padStart(2, '0');
/** When the night's brief is due at the latest: the plan's readyBy, else READY_AT on its date. */
export const readyByOf = plan => plan.readyBy ?? `${plan.date}T${pad(READY_AT.hour)}:${pad(READY_AT.minute)}:00Z`;
const rank = status => (TERMINAL.includes(status) ? 2 : status === 'running' ? 1 : 0);

/**
 * Is the night over? Every build item terminal, or readyBy passed (`late`:
 * what is unfinished is "not finished by"). Pure.
 */
export function readiness(plan, now = new Date()) {
  const readyBy = readyByOf(plan);
  const open = plan.items.filter(i => i.kind === 'build' && !TERMINAL.includes(i.status)).map(i => i.id);
  const passed = new Date(now).getTime() >= Date.parse(readyBy);
  if (!open.length) return { ready: true, late: passed, readyBy, open, why: 'every build item is terminal' };
  if (passed) return { ready: true, late: true, readyBy, open, why: `readyBy ${readyBy} has passed; not finished: ${open.join(', ')}` };
  return { ready: false, late: false, readyBy, open, why: `not finished: ${open.join(', ')}; readyBy ${readyBy} has not passed` };
}

// ---- reading the night -------------------------------------------------------

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });

/**
 * A file on a branch of origin, or null when the branch or the file is not
 * there. A remote that cannot be read throws: an unread branch is never
 * "no ticks".
 */
function remoteFile(root, branch, path) {
  const ls = git(root, ['ls-remote', '--exit-code', '--heads', 'origin', branch]);
  if (ls.status === 2) return null;
  if (ls.status !== 0) throw new MorningError(`cannot read the branch ${branch} on origin: git ls-remote exited ${ls.status ?? ls.error?.code}`);
  const ref = `refs/remotes/origin/${branch}`;
  const f = git(root, ['fetch', '-q', '--no-tags', 'origin', `+refs/heads/${branch}:${ref}`]);
  if (f.status !== 0) throw new MorningError(`cannot fetch the branch ${branch} from origin: git fetch exited ${f.status ?? f.error?.code}`);
  const s = git(root, ['show', `${ref}:${path}`]);
  return s.status === 0 ? s.stdout : null;
}

async function localFile(root, path) {
  const info = await lstat(join(root, path)).catch(e => (['ENOENT', 'ENOTDIR'].includes(e.code) ? null : Promise.reject(e)));
  if (!info) return null;
  if (!info.isFile()) throw new MorningError(`cannot read ${path}: it is not a regular file`);
  return readFile(join(root, path), 'utf8');
}

const hasOrigin = root => git(root, ['remote', 'get-url', 'origin']).status === 0;

/**
 * Tonight's plan as it finished: { plan, from, sources } or { plan: null }.
 * The one reader of final outcomes (phase 76 may move where ticks live; only
 * this changes). Each place is read; one that holds a valid plan for `date`
 * counts. The base is the plan the night ran (its record: the morning's own
 * final branch, the night PR's branch, the checkout), else the plan branch,
 * else the working plan; each base item takes its furthest tick from any
 * place (terminal over running over planned; ties go to the plan branch,
 * then the records, then the working plan). `branch` is the origin branch
 * the base came from, or null for the checkout: the night's health page is
 * read from there too (healthAround).
 */
export async function finalPlan({ root, date }) {
  const places = [];
  const remote = hasOrigin(root);
  const record = recordOf(date);
  const at = async (from, read, branch = null) => {
    const text = await read();
    if (text === null) { places.push({ from, state: 'absent' }); return; }
    if (text.length > MAX_BYTES) { places.push({ from, state: `refused: larger than ${MAX_BYTES} bytes` }); return; }
    let plan;
    try { plan = JSON.parse(text); } catch { places.push({ from, state: 'refused: not JSON' }); return; }
    const v = validatePlan(plan);
    if (!v.ok) places.push({ from, state: `refused: ${v.problems[0]}` });
    else if (plan.date !== date) places.push({ from, state: `another night (${plan.date})` });
    else places.push({ from, state: 'read', plan, branch });
  };
  if (remote) {
    await at(`${PLAN_BRANCH}:${REMOTE_PLAN}`, () => remoteFile(root, PLAN_BRANCH, REMOTE_PLAN), PLAN_BRANCH);
    await at(`${finalBranchOf(date)}:${record}`, () => remoteFile(root, finalBranchOf(date), record), finalBranchOf(date));
    await at(`keel-night/${date}:${record}`, () => remoteFile(root, `keel-night/${date}`, record), `keel-night/${date}`);
  }
  await at(record, () => localFile(root, record));
  await at(PLAN, () => localFile(root, PLAN));
  const read = places.filter(p => p.plan);
  const sources = places.map(({ from, state }) => ({ from, state }));
  if (!read.length) return { plan: null, from: null, branch: null, sources };
  const isRecord = p => p.from.endsWith(record);
  const base = read.find(isRecord) ?? read.find(p => p.from.startsWith(PLAN_BRANCH)) ?? read[0];
  const items = furthestItems(base.plan.items, read.map(p => p.plan));
  return { plan: { ...base.plan, items }, from: base.from, branch: base.branch, sources };
}

/**
 * finalPlan's merge, pure: each base item at its highest-ranked tick from any
 * of `plans` (the base's own included; terminal over running over planned).
 * A tie goes to the first plan in `plans` order (finalPlan's: the plan
 * branch, then the records, then the working plan), so a later done after a
 * recorded failure, or a mended note on a done item, is never lost to the base.
 */
export function furthestItems(items, plans) {
  return items.map(it => {
    const ticks = plans.map(p => p.items.find(o => o.id === it.id && o.kind === it.kind)).filter(Boolean);
    if (!ticks.length) return it;
    const top = Math.max(...ticks.map(o => rank(o.status)));
    return ticks.find(o => rank(o.status) === top);
  });
}

/**
 * The night's numbers: `before`, the health page dated the night (measured
 * before the builds; else the newest before it), and `after`, the first page
 * dated after it (the next night's), each { date, file, rows, ref? } or null.
 * `branch` is where finalPlan read the night's record (plates#149): while the
 * night's PR is unmerged its page is on that branch alone, so a page there is
 * read from there (`ref`, for its link), else from the checkout. finalPlan
 * has fetched it; a branch git cannot list throws, never "no page".
 */
export async function healthAround(root, config, date, { branch = null } = {}) {
  let dir;
  try { dir = healthDirOf(config); } catch (e) { throw new MorningError(`the health directory: ${e.message}`); }
  const dated = n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n);
  let names;
  try { names = (await readdir(join(root, dir))).filter(dated); }
  catch (e) { if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw new MorningError(`cannot read the health directory ${dir}: ${e.code ?? e.message}`); names = []; }
  const ref = branch && branch !== PLAN_BRANCH ? `refs/remotes/origin/${branch}` : null;
  let there = [];
  if (ref) {
    const ls = git(root, ['ls-tree', '--name-only', ref, '--', `${dir}/`]);
    if (ls.status !== 0) throw new MorningError(`cannot list ${dir} on the branch ${branch}: git ls-tree exited ${ls.status ?? ls.error?.code}`);
    there = ls.stdout.split('\n').map(l => l.slice(dir.length + 1)).filter(dated);
  }
  names = [...new Set([...names, ...there])].sort();
  const page = async name => {
    if (!name) return null;
    const file = `${dir}/${name}`;
    if (there.includes(name)) {
      const s = git(root, ['show', `${ref}:${file}`]);
      if (s.status !== 0) throw new MorningError(`cannot read ${file} on the branch ${branch}: git show exited ${s.status ?? s.error?.code}`);
      return { date: name.slice(0, 10), file, rows: healthRows(s.stdout), ref: branch };
    }
    const text = await localFile(root, file);
    return text === null ? null : { date: name.slice(0, 10), file, rows: healthRows(text) };
  };
  const day = `${date}.md`;
  return {
    before: await page(names.includes(day) ? day : names.filter(n => n < day).at(-1)),
    after: await page(names.find(n => n > day)),
  };
}

async function configOf(root) {
  let raw;
  try { raw = await readFile(join(root, '.plates', 'plates.json'), 'utf8'); } catch (e) { throw new MorningError(`cannot read .plates/plates.json: ${e.code ?? e.message}`); }
  let config;
  try { config = JSON.parse(raw); } catch { throw new MorningError('.plates/plates.json is not JSON'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new MorningError('.plates/plates.json is not a JSON object');
  return config;
}

const REPO = /^[\w.-]+\/[\w.-]+$/;
/**
 * The repo the brief links into: in a GitHub Actions run (plates-morning.yml),
 * the run's own repository, which is the truth there; anywhere else (a
 * person's plates, a test), the project's config "repo". A GITHUB_REPOSITORY
 * outside Actions is never trusted: it may be another repo's CI.
 */
export const repoOf = (config, env = {}) => (env.GITHUB_ACTIONS === 'true' && REPO.test(env.GITHUB_REPOSITORY ?? '') ? env.GITHUB_REPOSITORY : REPO.test(config?.repo ?? '') ? config.repo : null);

/** The links the brief carries: the canvas when one is bound, the health page (on GitHub when the repo is known, at `ref` when it is on a branch). */
export function linksOf(config, { repo = null, page = null, ref = null } = {}) {
  const c = config?.canvas;
  let canvas = null;
  if (c?.provider === 'isocan' && typeof c.home === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(c.canvasId ?? '')) {
    try { const u = new URL(c.home); if (['http:', 'https:'].includes(u.protocol)) canvas = `${u.origin}/p/${c.canvasId}`; } catch { /* no canvas link */ }
  }
  return { canvas, health: page ? (repo ? `https://github.com/${repo}/blob/${ref ?? 'HEAD'}/${page}` : page) : null };
}

// ---- production's verify (plates phase 81) -------------------------------------
//
// The delivery practice's scripts/plates/verify.mjs records each verify of
// production on the branch keel-verify, file verify.json: { results: [newest
// first, at most VERIFY_KEEP] }, each { sha, ok, at, site, serving, failures,
// run? }. The board shows the latest when it failed; the brief lists each
// that failed in the day before the night started, so every failure reaches
// one brief, and only one. Read here, beside the brief, because delivery
// requires night: the reader is always where the writer is.

export const VERIFY_BRANCH = 'keel-verify';
export const VERIFY_FILE = 'verify.json';
export const VERIFY_KEEP = 30;
/** A failure is kept this long whatever came after it: the brief that carries it is sent within a day and a half of it (PR #182 review). */
export const VERIFY_HOLD_MS = 72 * 3600 * 1000;
/** The file never grows past this many results, nor past three quarters of MAX_BYTES, so its reader never refuses it. */
export const VERIFY_MAX = 200;

/**
 * What verify.json keeps of `results` (newest first) at `now`: the newest
 * VERIFY_KEEP, and every failure younger than VERIFY_HOLD_MS, so a burst of
 * passes never pushes out a failure before its brief has read it; then at
 * most VERIFY_MAX, and within the size its reader takes, the oldest dropped
 * first. Whatever the age, count or size, the latest result of each site is
 * kept, so the board can always tell whether production's last verify failed
 * (PR #182 review): production's (`production`, "delivery".site; null: every
 * result is production's, so the newest) always, and each preview's while
 * there are fewer than VERIFY_MAX sites (preview origins can be one per
 * deploy, so theirs alone are bounded, newest first). Pure.
 */
export function keptResults(results, now = Date.now(), { production = null } = {}) {
  const sorted = [...results].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const latest = new Map();
  for (const r of sorted) if (!latest.has(r.site)) latest.set(r.site, r);
  const prod = production ? latest.get(production) : sorted[0];
  const pinned = new Set([prod, ...[...latest.values()].filter(r => r !== prod).slice(0, VERIFY_MAX - 1)].filter(Boolean));
  let rest = sorted.filter((r, i) => !pinned.has(r) && (i < VERIFY_KEEP || (!r.ok && Date.parse(r.at) > now - VERIFY_HOLD_MS)));
  const size = () => JSON.stringify({ results: [...pinned, ...rest] }, null, 2).length;
  rest = rest.slice(0, Math.max(0, VERIFY_MAX - pinned.size));
  while (rest.length && size() > MAX_BYTES * 0.75) rest = rest.slice(0, -1);
  return [...pinned, ...rest].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
const FULL_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** One recorded verify, checked: the result, or null when it is not one. */
function verifyResultOf(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (!FULL_SHA.test(r.sha ?? '') || typeof r.ok !== 'boolean' || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))) return null;
  if (!Array.isArray(r.failures) || r.failures.some(f => typeof f !== 'string')) return null;
  if (r.ok && r.failures.length) return null;
  if (!r.ok && !r.failures.length) return null;
  return { sha: r.sha, ok: r.ok, at: r.at, site: typeof r.site === 'string' ? r.site : null, serving: FULL_SHA.test(r.serving ?? '') ? r.serving : null, failures: r.failures.map(one), run: typeof r.run === 'string' && /^https:\/\//.test(r.run) ? r.run : null };
}

/** verify.json's text as its results, newest first; a throw (MorningError) when it is not that file. */
export function verifyResults(text) {
  if (text.length > MAX_BYTES) throw new MorningError(`${VERIFY_FILE} is larger than ${MAX_BYTES} bytes`);
  let data;
  try { data = JSON.parse(text); } catch { throw new MorningError(`${VERIFY_FILE} is not JSON`); }
  if (!data || !Array.isArray(data.results)) throw new MorningError(`${VERIFY_FILE} holds no "results" list`);
  const results = data.results.map(verifyResultOf);
  const bad = results.findIndex(r => !r);
  if (bad >= 0) throw new MorningError(`${VERIFY_FILE} result ${bad} is not a verify result ({ sha, ok, at, failures })`);
  return results.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * The project's recorded verifies, from origin's keel-verify branch: { results }
 * or { results: [], unread } when the branch cannot be read (never "no
 * failures"); { results: [] } when there is no branch yet.
 */
export function readVerify(root) {
  try {
    if (!hasOrigin(root)) return { results: [], unread: 'no origin to read keel-verify from' };
    const text = remoteFile(root, VERIFY_BRANCH, VERIFY_FILE);
    return { results: text === null ? [] : verifyResults(text) };
  } catch (e) {
    return { results: [], unread: one(e?.message ?? e) };
  }
}

/** Production's origin, .plates/plates.json "delivery".site, or null when it names none (or none that parses). */
export function productionOf(config) {
  const site = config?.delivery?.site;
  try { return typeof site === 'string' ? new URL(site).origin : null; } catch { return null; }
}

/**
 * Whether a result is of production: its site is "delivery".site. With no
 * site configured, every result is taken as production's (there is nothing
 * to tell a preview by). A preview (verify.mjs --site) is never production's,
 * so its pass never clears production's failure (PR #182 review).
 */
export const isProduction = (r, production) => !production || r.site === production;

/**
 * The failed verifies the brief for the night `date` carries: those recorded
 * in the day before the night started, of any site (a preview's too, said as
 * a preview's). `passedSince` is a later pass of the same site only.
 */
export function verifyFailuresFor(results, date, { production = null } = {}) {
  const end = Date.parse(`${date}T${pad(NIGHT_AT.hour)}:${pad(NIGHT_AT.minute)}:00Z`), start = end - 24 * 3600 * 1000;
  return results.filter(r => !r.ok && Date.parse(r.at) >= start && Date.parse(r.at) < end)
    .map(r => ({ ...r, preview: !isProduction(r, production), passedSince: results.some(o => o.ok && o.site === r.site && Date.parse(o.at) > Date.parse(r.at)) }));
}

/** One failed verify, as the brief and the board say it. */
export function verifyLine(r) {
  const who = r.preview ? `The preview ${r.site}` : 'Production';
  const since = r.passedSince ? ` ${r.preview ? 'It' : 'Production'} has passed a verify since.` : '';
  return `${who} failed its verify for \`${r.sha.slice(0, 7)}\` at ${r.at}${r.site && !r.preview ? ` (${r.site})` : ''}: ${r.failures.join('; ')}.${r.run ? ` ${r.run}` : ''}${since}`;
}

// ---- the brief ---------------------------------------------------------------

const one = s => String(s).replace(/\s+/g, ' ').trim();
const sign = n => (n.better === 'higher' ? '≥' : '≤');
const valueOf = (page, measure) => page?.rows.find(r => r.id === measure)?.value ?? null;

/** An item's number with its value before and after, when known. */
export function numberLine(item, health = {}) {
  const n = item.number;
  if (!n) return null;
  const before = valueOf(health.before, n.measure), after = valueOf(health.after, n.measure);
  const head = `\`${n.measure}\` ${sign(n)} ${n.bound}`;
  if (before === null && after === null) return `${head} (not measured on a health page)`;
  return `${head}: ${before ?? 'not measured'} before → ${after ?? 'not measured yet (the next night measures it)'} after`;
}

const itemLine = (it, health, tail = []) => {
  const parts = [`**${one(it.title)}** (\`${it.id}\`)`, numberLine(it, health), it.result?.note && one(it.result.note), it.result?.link, ...tail].filter(Boolean);
  return `- ${parts.join(' — ')}`;
};
const isPr = link => /^https:\/\/[^/]+\/[^/]+\/[^/]+\/pull\/\d+$/.test(link ?? '');

/**
 * The brief, pure: { sections, next, markdown }. Isocan's order: done (the
 * build items that finished, sure), tried (everything else that ran: measure,
 * review, triage), failed and why, left alone (skipped, left alone, will not
 * touch), not finished (by readyBy when it passed), and the owner's next.
 */
export function renderBrief({ plan, now = new Date(), health = {}, links = {}, verify = null, production = null }) {
  const r = readiness(plan, now);
  const done = plan.items.filter(i => i.kind === 'build' && i.status === 'done');
  const tried = plan.items.filter(i => i.kind !== 'build' && i.status === 'done');
  const failed = plan.items.filter(i => i.status === 'failed');
  const alone = plan.items.filter(i => ['skipped', 'left-alone'].includes(i.status));
  const open = plan.items.filter(i => !TERMINAL.includes(i.status));
  const unfinishedHead = r.late ? `## Not finished by ${r.readyBy}` : '## Still going';
  const next = [
    ...productionLines(production),
    // Production first: a failed verify (phase 81), and a verify record that could not be read, never silence.
    ...(verify?.failed ?? []).map(verifyLine),
    ...(verify?.unread ? [`The verify record (${VERIFY_BRANCH}:${VERIFY_FILE}) could not be read: ${one(verify.unread)}. Whether production passed is unknown.`] : []),
    ...done.filter(i => isPr(i.result?.link)).map(i => `Review and merge ${i.result.link} (\`${i.id}\`): a person merges.`),
    ...failed.map(i => `Look at why \`${i.id}\` failed: ${i.result?.note ? one(i.result.note) : 'no reason was recorded'}.`),
    ...(r.late ? open.filter(i => i.kind === 'build').map(i => `\`${i.id}\` was not finished by ${r.readyBy}: its pass may still finish it, or tomorrow's plan takes it up.`) : []),
    ...plan.leftOpen.map(l => `Left open: ${one(l)}`),
  ];
  const by = plan.shapedBy === 'owner' ? 'shaped by the owner' : 'plates\'s default plan';
  const count = (n, what) => `${n} ${what}`;
  const linkLine = [links.canvas && `Canvas: ${links.canvas}`, links.health && `Health page: ${links.health}`].filter(Boolean).join(' · ');
  const section = (head, items, line) => [head, '', ...(items.length ? items.map(line) : ['Nothing.']), ''];
  const markdown = [
    `# ${titleOf(plan.date)}`, '',
    `The night of ${plan.date} (UTC), ${by}: ${[count(done.length, 'done'), count(tried.length, 'tried'), count(failed.length, 'failed'), count(alone.length, 'left alone'), count(open.length, r.late ? `not finished by ${r.readyBy}` : 'still going')].join(', ')}.`, '',
    ...(linkLine ? [linkLine, ''] : []),
    ...section('## Done', done, i => itemLine(i, health)),
    ...section('## Tried', tried, i => itemLine(i, health)),
    ...section('## Failed, and why', failed, i => itemLine(i, health, i.result?.note ? [] : ['no reason was recorded'])),
    '## Left alone', '',
    ...(alone.length || plan.willNotTouch.length ? [...alone.map(i => itemLine(i, health, [i.status === 'skipped' ? 'skipped' : 'left alone'])), ...plan.willNotTouch.map(w => `- Will not touch: ${one(w)}`)] : ['Nothing.']), '',
    ...section(unfinishedHead, open, i => itemLine(i, health, [r.late ? `not finished by ${r.readyBy} (still ${i.status})` : `still ${i.status}`])),
    '## Your next', '',
    ...(next.length ? next.map(n => `- ${n}`) : ['Nothing waits for you this morning.']), '',
  ].join('\n');
  return { readiness: r, sections: { done: done.map(i => i.id), tried: tried.map(i => i.id), failed: failed.map(i => i.id), leftAlone: alone.map(i => i.id), unfinished: open.map(i => i.id) }, next, markdown };
}

const dateOf = (date, now) => {
  const night = date ?? lastNight(now);
  if (!DATE.test(night) || !Number.isFinite(Date.parse(`${night}T00:00:00Z`))) throw new MorningError(`--date is the night's UTC date, YYYY-MM-DD (got ${JSON.stringify(night)})`);
  return night;
};

/** plates morning: the brief for the night `date` (default: the night that last started), written nowhere. */
export async function brief({ root, date, env = process.env, now = new Date() }) {
  const night = dateOf(date, now);
  const config = await configOf(root);
  const found = await finalPlan({ root, date: night });
  if (!found.plan) throw new MorningError(`no plan for the night of ${night}: ${found.sources.map(s => `${s.from} ${s.state}`).join('; ')}`);
  const health = await healthAround(root, config, night, { branch: found.branch });
  const tonight = health.before?.date === night ? health.before : null;
  const links = linksOf(config, { repo: repoOf(config, env), page: tonight?.file ?? null, ref: tonight?.ref ?? null });
  // Production's verifies (phase 81), with the delivery practice on: each failure of the day before the night.
  let verify = null;
  if (Array.isArray(config.practices) && config.practices.includes('delivery')) {
    const v = readVerify(root);
    verify = { failed: verifyFailuresFor(v.results, night, { production: productionOf(config) }), unread: v.unread ?? null };
  }
  const production = await productionStatus({root,config,now});
  const b = renderBrief({ plan: found.plan, now, health, links, verify, production });
  return { data: { ok: true, date: night, title: titleOf(night), from: found.from, sources: found.sources, readiness: b.readiness, sections: b.sections, next: b.next, links, verify, production, markdown: b.markdown, plan: found.plan }, text: b.markdown.trimEnd() };
}

// ---- sending -----------------------------------------------------------------

function gh(root, env, args, what, { input, json = false, exitCode = 1 } = {}) {
  const bin = env.PLATES_GH || 'gh';
  const r = spawnSync(bin, args, { cwd: root, env, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  if (r.error) throw new MorningError(`cannot ${what} (${bin}): ${r.error.code === 'ENOENT' ? 'gh is not installed' : r.error.message}`, exitCode);
  if (r.status !== 0) throw new MorningError(`cannot ${what}: gh exited ${r.status}${(r.stderr || '').trim() ? `, ${r.stderr.trim().split('\n')[0]}` : ''}`, exitCode);
  if (!json) return r.stdout;
  try { return JSON.parse(r.stdout); } catch { throw new MorningError(`cannot ${what}: gh did not print JSON`, exitCode); }
}
// The repository the brief links into is the one its issues go to (plates#149): repoOf, the run's own in Actions.
const repoArgs = (config, env) => { const repo = repoOf(config, env); return repo ? ['--repo', repo] : []; };

/** Every keel:morning issue, open or closed: [{ number, title, state }]. */
export function morningIssues(root, config, env = process.env) {
  const rows = gh(root, env, ['issue', 'list', ...repoArgs(config, env), '--label', LABEL, '--state', 'all', '--limit', '200', '--json', 'number,title,state'], `list the ${LABEL} issues`, { json: true, exitCode: 2 });
  if (!Array.isArray(rows)) throw new MorningError(`cannot list the ${LABEL} issues: gh did not print a JSON list`);
  return rows.filter(i => Number.isSafeInteger(i?.number) && typeof i.title === 'string').sort((a, b) => a.number - b.number);
}

/** The owner the brief is assigned to, or a refusal naming the key. */
export function assigneeOf(config) {
  const a = config?.morning?.assignee;
  if (typeof a !== 'string' || !LOGIN.test(a)) throw new MorningError(`${ASSIGNEE} is not set in .plates/plates.json: name the GitHub login the brief is assigned to ("morning": { "assignee": "<login>" }); GitHub emails the assignee. Nothing was sent.`);
  return a;
}

/**
 * plates morning --send: the brief as one issue "Good morning, <date>",
 * assigned and labelled keel:morning; then the previous open keel:morning
 * issues are closed. An issue with that title already (open or closed) is
 * this night's brief: nothing is sent again.
 */
export async function send({ root, date, env = process.env, now = new Date() }) {
  const config = await configOf(root);
  const assignee = assigneeOf(config);
  const b = await brief({ root, date, env, now });
  const title = titleOf(b.data.date);
  const issues = morningIssues(root, config, env);
  const same = issues.find(i => i.title === title);
  if (same) return { data: { ok: true, sent: false, date: b.data.date, issue: same.number, why: 'already sent' }, text: `${title}: already sent as #${same.number}; nothing sent again.` };
  gh(root, env, ['label', 'create', LABEL, ...repoArgs(config, env), '--force', '--color', 'FBCA04', '--description', 'plates: the morning brief'], `make the label ${LABEL}`);
  const out = gh(root, env, ['issue', 'create', ...repoArgs(config, env), '--title', title, '--assignee', assignee, '--label', LABEL, '--body-file', '-'], `open the issue "${title}"`, { input: b.data.markdown });
  const url = out.trim().split('\n').at(-1);
  const number = Number(/\/issues\/(\d+)$/.exec(url)?.[1]);
  if (!Number.isSafeInteger(number)) throw new MorningError(`opened "${title}" but gh printed no issue URL (${one(url).slice(0, 200)})`, 1);
  const closed = [];
  for (const prev of issues.filter(i => i.state === 'OPEN' && i.number !== number)) {
    gh(root, env, ['issue', 'close', String(prev.number), ...repoArgs(config, env), '--comment', `Superseded by #${number} (plates morning).`], `close the previous brief #${prev.number}`);
    closed.push(prev.number);
  }
  return { data: { ok: true, sent: true, date: b.data.date, issue: number, url, assignee, closed, readiness: b.data.readiness }, text: `${title}: sent as ${url}, assigned to ${assignee}${closed.length ? `; closed ${closed.map(n => `#${n}`).join(', ')}` : ''}.` };
}

/**
 * plates-morning.yml's decision, read-only: the night that last started, its
 * readiness, whether its brief was sent, whether an assignee is set, and
 * whether it has a plan. Writes day, ready, sent, assignee and plan to
 * `githubOutput` when given.
 */
export async function decide({ root, env = process.env, now = new Date(), githubOutput }) {
  const night = lastNight(now);
  const config = await configOf(root);
  const found = await finalPlan({ root, date: night });
  let assignee = 'set';
  try { assigneeOf(config); } catch { assignee = 'unset'; }
  let data;
  if (!found.plan) data = { day: night, ready: false, sent: false, assignee, why: `no plan for the night of ${night}` };
  else {
    const r = readiness(found.plan, now);
    const sent = r.ready ? morningIssues(root, config, env).find(i => i.title === titleOf(night)) : null;
    data = { day: night, ready: r.ready, sent: Boolean(sent), assignee, why: sent ? `already sent as #${sent.number}` : r.why };
  }
  // plan: whether the night has a plan anywhere (plates-morning's card job publishes it only then).
  if (githubOutput) appendFileSync(githubOutput, `day=${data.day}\nready=${data.ready}\nsent=${data.sent}\nassignee=${data.assignee}\nplan=${found.plan ? 'found' : 'none'}\n`);
  return { data: { ok: true, ...data, sources: found.sources }, text: `The night of ${night}: ${data.ready ? 'over' : 'not over'} (${data.why}); brief ${data.sent ? 'sent' : 'not sent'}; ${ASSIGNEE} ${data.assignee}.` };
}

// ---- the final record (plates#137) --------------------------------------------

/** The page with its "## Tonight's plan" section replaced (to the next ## heading), or appended. Pure. */
export function withPlanSection(page, section) {
  const lines = page.replace(/\n+$/, '').split('\n');
  const at = lines.findIndex(l => l.trim() === '## Tonight\'s plan');
  if (at < 0) return `${[...lines, '', ...section].join('\n').replace(/\n+$/, '')}\n`;
  let end = lines.findIndex((l, i) => i > at && /^## /.test(l));
  if (end < 0) end = lines.length;
  return `${[...lines.slice(0, at), ...section, ...lines.slice(end)].join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * The night's final outcomes into its archive, in the working tree: the
 * record docs/night/<date>.json and, when the night's health page is here,
 * its "Tonight's plan" section. plates-morning.yml commits them as one
 * data-only PR in the night's queue. --pr-input writes that PR's body input
 * (scripts/plates/pr-body.mjs).
 */
export async function finalize({ root, date, prInput }) {
  const night = dateOf(date);
  const config = await configOf(root);
  const found = await finalPlan({ root, date: night });
  if (!found.plan) throw new MorningError(`no plan for the night of ${night}: ${found.sources.map(s => `${s.from} ${s.state}`).join('; ')}`);
  const written = [];
  try { written.push(await writeRecord(root, found.plan)); } catch (e) { throw e instanceof NightPlanError ? new MorningError(e.message) : e; }
  let dir;
  try { dir = healthDirOf(config); } catch (e) { throw new MorningError(`the health directory: ${e.message}`); }
  const page = `${dir}/${night}.md`;
  const text = await localFile(root, page);
  if (text !== null) {
    try { written.push(await safeWrite(root, page, withPlanSection(text, planSection(found.plan, { record: recordOf(night) })))); }
    catch (e) { throw e instanceof NightPlanError ? new MorningError(e.message) : e; }
  }
  if (prInput) await writeFile(prInput, `${JSON.stringify(finalPr(found.plan, page), null, 2)}\n`);
  return { data: { ok: true, date: night, from: found.from, written, page: text === null ? null : page }, text: `The night of ${night}, as it finished: ${written.join(', ')}${text === null ? ` (no health page ${page} here)` : ''}.` };
}

/** The finalization PR's body input: each item's final status. */
export function finalPr(plan, page) {
  return {
    summary: { lead: `The night of ${plan.date} as it finished: the plan's final outcomes, in its record and on its health page (\`${page}\`).`, files: [] },
    evidence: { columns: ['Kind', 'Final'], rows: plan.items.map(i => ({ what: i.id, before: i.kind, after: i.status })) },
    danger: { door: 'two-way', why: 'data only (the night\'s plan record and its health page); reverting the merge restores them.', surfaces: [], within: 'data files' },
    notes: ['The night\'s drain merges this PR with the series, as data, or supersedes it if it no longer merges.'],
    impact: { declaration: { version: 1, phases: [], decisions: [], supersedes: [], evidence: [], reconciliation: 'none', reason: 'The night\'s plan record and health page only; no working record correction is applied.' } },
  };
}

// ---- the script --------------------------------------------------------------

const USAGE = 'usage: node scripts/plates/morning.mjs brief [--date d] | send [--date d] | decide [--github-output f] | finalize --date d [--pr-input f] [--json]';

export function parseArgs(args) {
  const [sub, ...rest] = args;
  const valued = { brief: ['--date'], send: ['--date'], decide: ['--github-output'], finalize: ['--date', '--pr-input'] }[sub];
  if (!valued) throw new MorningError(USAGE);
  const out = { sub };
  for (let i = 0; i < rest.length; i++) {
    if (!valued.includes(rest[i])) throw new MorningError(`unexpected argument: ${rest[i]}; ${USAGE}`);
    if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) throw new MorningError(`${rest[i]} needs a value`);
    out[rest[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = rest[++i];
  }
  if (sub === 'finalize' && out.date === undefined) throw new MorningError('--date is required: the workflow passes the night it decided');
  return out;
}

export async function run(args, { root, env = process.env, now = new Date() } = {}) {
  const o = parseArgs(args);
  if (o.sub === 'brief') return brief({ root, date: o.date, env, now });
  if (o.sub === 'send') return send({ root, date: o.date, env, now });
  if (o.sub === 'decide') return decide({ root, env, now, githubOutput: o.githubOutput });
  return finalize({ root, date: o.date, prInput: o.prInput });
}

if (isMain(import.meta)) await main(args => run(args, { root: rootOf(import.meta) }));
