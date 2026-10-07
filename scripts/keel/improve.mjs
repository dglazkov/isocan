// keel improve, shipped: is the practice working here? Numbers first, one
// proposal last, and nothing changed (keel docs/design.md §6, "The night
// shift"). keel practice `night`; managed: keel render rewrites it.
//
//   node scripts/keel/improve.mjs [--report] [--transcripts <dir>] [--pr-input <file>] [--json]
//
// --pr-input writes the night PR's body input for scripts/keel/pr-body.mjs
// (nightPr): the gate's line and the measures outside as evidence, a two-way
// door over data files, the proposal as a note. The night's workflow builds
// its PR body from it, never from inline JS (keel phase 39).
//
// It runs from the project's own checkout with Node built-ins, git, gh and npm
// (KEEL_GIT, KEEL_GH, KEEL_NPM stand in for them),
// and the project's scripts/roadmap.mjs (the phases practice); no keel. keel's
// own `keel improve` is this same module, handed keel's instruments (its
// roadmap parser, doctor and inbox), so it computes the full set. Here, a
// measure that needs keel says `keel-side only`; it is never a zero:
//   drift  by .keel/lock.json alone: bytes keel did not write are `edited`
//          (`behind`, keel moving on, needs keel's templates: keel doctor)
//   lint   the rules the project's own files can show (PROJECT_LINTS)
//   inbox_waiting  keel-side only
//
// Each measure is { id, what, unit, bound, better, ratchet?, run(ctx) → { value,
// detail, facts? } | { na } }. `bound` is the default; a project's .keel/bounds.json
// holds its own. An instrument that cannot run THROWS: the measure is
// `broken` and the whole run exits 2. It is never reported as a zero, because
// a grader that reports zeros when it breaks is believed (lesson 6).
//
// The test measures (flaky_tests, slow_tests, and proofs_hold's ledger half)
// read .keel/test-runs, the test ledger's history (scripts/keel/test-ledger.mjs):
// the night downloads CI's keel-test-runs artifacts into it, and the gate run
// here adds one more when the project's test script carries the reporter.
// Fewer runs than the window is n/a, never a zero.
//
// Exit codes: 0 every measure within its bound (or n/a), 1 one outside, 2 one
// broken. --report also writes <health>/<date>.md (.keel/keel.json `health`,
// default docs/health) and tightens
// .keel/bounds.json where a value beat its bound (a ratchet: never loosens).
// With the climb practice on, the page also carries one line about the newest
// climb night (.keel/climb/night.json, which the night fetches): kept N and its
// PR, or kept nothing and why, and a line for each climb job whose last three
// PRs were closed unmerged (it proposes its own retirement; gh's list of every state).
// build_time times "climb".build once, when the project names one: bound
// "climb".buildBudgetMs, else the value is recorded only (no bound, never outside).
// With "tend" set, one line about the newest tend pass (.keel/tend/pass.json,
// fetched the same way): what it resolved, its PR, and each finding it left
// unresolved with what it tried (phase 38).
// With climb, tend or crossReview on, one Budget line (phase 43): each pass's
// agent-step minutes in its last runs (at most 8, from GitHub's record of the
// workflow's runs and jobs), which ran out, and a suggestion: extend, shorten
// to N, hold, or too few to say. n/a with why when gh cannot read them.
//
// Adapted ideas, not code: the conduct-cost measure follows isocan's
// scripts/subagent-time.mjs (github.com/dalmaer/isocan, origin/main,
// Apache-2.0): time each Bash call from tool_use to tool_result, by kind. The
// ratchet follows isocan's scripts/ratchet.mjs (Apache-2.0): bounds that only
// report the wrong way.
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  LOCK, read, readLock, lockDrift, phaseLints, claudeMdLint, secondCopies, lockedSkills, lessonsTableSplit, lessonsTableShapes, parseLessons, lessonsPathOf, unsentLessons, SENT, gateEnv, healthDirOf, healthDirIn, healthPage, healthLints, HEALTH_DIR, isMain, rootOf, main,
  shapeOf, readProjectRecords, climbLine, readClimbNight, tendLine, readTendPass, climbRetiring, retireLine, budgetPasses, budgetUse, budgetLine, BUDGET_RUNS, BUDGET_EXAMINE, recordsDisagree, statusUnknown, changelogGaps, issuesNamed, frontMatter, addDays, walk, gateWorkflowOf,
  reviewConfigOf, repoReviewArgs, readRepoReviews, unansweredPrs, windowPrs, sameLogin, IncompleteRead, REVIEW_DAYS, REVIEW_PRS, REVIEW_PAGES,
} from './lib.mjs';
import { RUNS, readRuns, testsConfigOf, flaky, slower, comparable, machineClass, lastOutcome, aloneCommand, nightOnly, NIGHT_ONLY } from './test-ledger.mjs';

export const BOUNDS = '.keel/bounds.json';
/** The default health directory; a project's own is .keel/keel.json `health` (healthDirOf). */
export const HEALTH = HEALTH_DIR;
export { healthDirOf };
export const STUCK_DAYS = 21;
/** A pull request open longer than this is stale (prs_stale). */
export const STALE_PR_DAYS = 14;
/** The changelog window: days back from today, today itself not owed yet (changelog_gaps). */
export const CHANGELOG_DAYS = 30;
/** ci_red_streak reads the newest RED_RUNS runs of the gate workflow, then keeps the verdicts among them. */
export const RED_RUNS = 100;
/** reviews_unanswered reads open PRs and those merged in the last REVIEW_DAYS days, REVIEW_PAGES pages of REVIEW_PRS each at most (lib.mjs). */
export { REVIEW_DAYS, REVIEW_PRS, REVIEW_PAGES };
/**
 * Each machine queue's bound: the open PRs it may hold. keel's own queues
 * hold one, the newest (lesson 9; the drain keeps them there). Renovate keeps
 * one PR per lane, and keel's renovate.json (practice renovate) has four
 * lanes, so renovate/ holds up to four. A project whose Renovate config is its
 * own (`renovate` local in .keel/keel.json) may group differently: its
 * renovate/ count is reported as information, not judged.
 */
export const MACHINE_BOUNDS = Object.freeze({ 'keel/': 1, 'keel-night/': 1, 'keel-loop/': 1, 'renovate/': 4 });
export const MACHINE_PREFIXES = Object.keys(MACHINE_BOUNDS);
export const CHECK = 'npm run check';
export const LESSONS = 'docs/lessons.md';
export { lessonsPathOf };
export const SEND_LESSONS = 'npx -y github:dalmaer/keel lessons --yes';
export const COMMAND = 'node scripts/keel/improve.mjs';

export class ImproveError extends Error {
  constructor(message, exitCode = 2) { super(message); this.exitCode = exitCode; }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const days = (from, to) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
const list = (xs, n = 5) => xs.length > n ? `${xs.slice(0, n).join(', ')} and ${xs.length - n} more` : xs.join(', ');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const exists = path => stat(path).then(s => s, () => null);
/**
 * The folders whose package.json counts beside the root's: the usual app
 * folders, and the root's workspaces (`dir/*` read one level). The same rule
 * as keel's lib/stacks.mjs packageDirs; the night ships no lib/, so it reads
 * them itself. Relative, existing directories only.
 */
export const APP_DIRS = ['web', 'app', 'client', 'frontend'];
export async function packageDirs(root) {
  const dirs = new Set(APP_DIRS);
  let pkg = null;
  try { pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')); } catch {}
  const ws = Array.isArray(pkg?.workspaces) ? pkg.workspaces : Array.isArray(pkg?.workspaces?.packages) ? pkg.workspaces.packages : [];
  for (const w of ws) {
    if (typeof w !== 'string') continue;
    const star = /^([\w.-]+(?:\/[\w.-]+)*)\/\*$/.exec(w);
    if (star) {
      const names = await readdir(join(root, star[1]), { withFileTypes: true }).catch(() => []);
      for (const e of names) if (e.isDirectory()) dirs.add(`${star[1]}/${e.name}`);
    } else if (/^[\w.-]+(\/[\w.-]+)*$/.test(w)) dirs.add(w);
  }
  const out = [];
  for (const d of dirs) if (!d.split('/').includes('..') && (await exists(join(root, d)))?.isDirectory()) out.push(d);
  return out;
}

const stripTest = env => Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('NODE_TEST_')));
const unfinished = (p, done) => !done.includes(p.status) && p.status !== 'superseded';

/** Memoise one instrument per run, so two measures share one reading. */
const once = (ctx, key, fn) => {
  if (!ctx.cache.has(key)) ctx.cache.set(key, Promise.resolve().then(fn));
  return ctx.cache.get(key);
};

// ---- shared instruments ----------------------------------------------------

/**
 * Why the phases measures do not apply here, or null. In the projects shape
 * (docs/projects/<p>/phases.md, read only) the measures that read phases
 * (`projects: true`) apply; the ones that read keel's roadmap and evidence
 * files do not, and say so.
 */
function phasesOff({ config }, { projects = false } = {}) {
  if (shapeOf(config) === 'projects') return projects ? null : 'phases are in the projects shape (docs/projects/<p>/phases.md): no keel roadmap or evidence files to read';
  const local = config.local ?? {};
  if ((config.practices ?? []).includes('phases')) return null;
  // One short line: the whole proposal lives in keel doctor, not repeated on every measure.
  if (Object.hasOwn(local, 'phases')) return 'phases is a local variant here; keel doctor lists why and what is owed';
  return 'the phases practice is not on';
}

/**
 * The roadmap module: keel's own when keel runs this, else the project's
 * scripts/roadmap.mjs (the phases practice manages it). Missing while phases
 * is on is a broken instrument, not a zero.
 */
const roadmapModule = ctx => once(ctx, 'roadmap-module', async () => {
  if (ctx.keel?.roadmap) return ctx.keel.roadmap;
  const path = join(ctx.root, 'scripts', 'roadmap.mjs');
  if (!await exists(path)) throw new Error('scripts/roadmap.mjs is missing; the phases practice manages it (keel render puts it back)');
  return import(pathToFileURL(path).href);
});

const roadmapData = ctx => once(ctx, 'roadmap', async () => {
  const { collect } = await roadmapModule(ctx);
  try { return await collect(ctx.root); } catch (e) { throw new Error(`the roadmap cannot be read: ${e.message}`); }
});

/**
 * Drift and lint. From keel, its doctor (three hashes: now, lock, template).
 * In the project, what its own files can say: the lock, the roadmap parser,
 * CLAUDE.md, the skills the lock names. The rest is keel-side (keel doctor).
 */
const practiceReading = ctx => once(ctx, 'doctor', async () => {
  if (ctx.keel?.diagnose) {
    const d = await ctx.keel.diagnose(ctx.root);
    return { keel: true, drift: d.drift.filter(x => x.state === 'edited' || x.state === 'both'), lint: d.lint };
  }
  const lock = await readLock(ctx.root);
  if (!lock) return { na: `no ${LOCK}: nothing records what keel wrote here` };
  const { drift, lint } = await lockDrift(ctx.root);
  if ((ctx.config.practices ?? []).includes('phases')) {
    const { parsePhase, specProblems } = await roadmapModule(ctx);
    lint.push(...await phaseLints(ctx.root, parsePhase, specProblems));
  }
  if (lock.files['CLAUDE.md']) {
    const claude = claudeMdLint(await read(join(ctx.root, 'CLAUDE.md')));
    if (claude) lint.push(claude);
  }
  lint.push(...await secondCopies(ctx.root, await lockedSkills(ctx.root, lock), { self: ctx.config.keel === 'self' }));
  if ((ctx.config.practices ?? []).includes('lessons') || typeof ctx.config.lessons === 'string') {
    const lessons = typeof ctx.config.lessons === 'string' && ctx.config.lessons ? ctx.config.lessons : 'docs/lessons.md';
    const text = await read(join(ctx.root, lessons));
    lint.push(...lessonsTableSplit(text, lessons), ...lessonsTableShapes(text, lessons));
  }
  lint.push(...await healthLints(ctx.root, ctx.config, ctx.date));
  return { keel: false, drift, lint };
});
export const PROJECT_LINTS = ['phase', 'goal-without-phase', 'claude-md-pointer', 'second-copy', 'symlink-replaced', 'lessons-table-split', 'health-config', 'health-ignored'];
const projectSide = what => `; ${what} (keel doctor reads the rest)`;

/** Every project under docs/projects with its phases (null with no docs/projects), read once. */
const projectRecords = ctx => once(ctx, 'projects', () => readProjectRecords(ctx.root));

/**
 * The projects shape's phases as the files shape's measures read them:
 * [{ id: '<project>/<n>', status, project, issue, path }], keel statuses.
 */
const projectPhases = ctx => once(ctx, 'project-phases', async () =>
  ((await projectRecords(ctx)) ?? []).flatMap(p => (p.phases ?? []).map(x => ({ id: `${p.name}/${x.id}`, status: x.status, project: p.name, issue: p.issue, path: p.phasesPath }))));
const OPEN = ['planned', 'partial'];

/** git in the project (KEEL_GIT stands in for it): stdout, or a throw that names the command. */
function git(ctx, args) {
  const bin = ctx.env.KEEL_GIT || 'git';
  const r = spawnSync(bin, args, { cwd: ctx.root, env: stripTest(ctx.env), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`could not run git: ${r.error.message}`);
  return r;
}
const gitOut = (ctx, args) => {
  const r = git(ctx, args);
  if (r.status !== 0) throw new Error(`git ${args.slice(0, 2).join(' ')} exited ${r.status}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  return r.stdout;
};

/** The default branch to count commits on: main when it exists, else HEAD; null in a repo with no commits. */
const defaultRef = ctx => once(ctx, 'git-ref', () => {
  for (const ref of ['main', 'HEAD']) if (git(ctx, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status === 0) return ref;
  gitOut(ctx, ['rev-parse', '--git-dir']); // not a repository at all: a broken instrument
  return null;
});

/** Commits per committer day on the default branch, back to the changelog window's start. */
const commitDays = ctx => once(ctx, 'commit-days', async () => {
  const ref = await defaultRef(ctx);
  const counts = new Map();
  if (!ref) return counts;
  const out = gitOut(ctx, ['log', ref, '--no-merges', `--since=${addDays(ctx.date, -(CHANGELOG_DAYS + 2))}`, '--format=%cs']);
  for (const d of out.split('\n').filter(Boolean)) counts.set(d, (counts.get(d) ?? 0) + 1);
  return counts;
});

/** The day a path was last committed (YYYY-MM-DD), or null when it never was. */
async function lastTouched(ctx, path) {
  if (!await defaultRef(ctx)) return null;
  return gitOut(ctx, ['log', '-1', '--format=%cs', '--', path]).trim() || null;
}

/** The repo's open issues and open PRs, read once each. */
const openIssues = (ctx, gh) => once(ctx, 'issues', () => ghJson(ctx, gh, ['issue', 'list', '--repo', ctx.config.repo, '--state', 'open', '--json', 'number,title', '--limit', '1000']));
const openPrs = (ctx, gh) => once(ctx, 'prs', () => ghJson(ctx, gh, ['pr', 'list', '--repo', ctx.config.repo, '--state', 'open', '--json', 'number,title,createdAt', '--limit', '200']));

/** Every Markdown file under docs/, except the health pages (which name issues themselves): their text. */
async function docTexts(ctx) {
  const health = (() => { try { return healthDirOf(ctx.config); } catch { return HEALTH_DIR; } })();
  const files = (await walk(join(ctx.root, 'docs'))).filter(f => f.endsWith('.md')).map(f => `docs/${f}`)
    .filter(f => f !== health && !f.startsWith(`${health}/`));
  return Promise.all(files.map(f => read(join(ctx.root, f))));
}

/** A directory's *.md names except README.md, or null when the directory is absent. */
async function notes(ctx, dir) {
  try { return (await readdir(join(ctx.root, dir))).filter(n => n.endsWith('.md') && n !== 'README.md').sort(); }
  catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) return null; throw e; }
}

/** The project's gate, run once: { command, status, tests, ms }. */
const gateRun = ctx => once(ctx, 'gate', () => {
  const command = ctx.config.check ?? CHECK;
  const started = Date.now();
  // Never a test runner's context (lesson 14); the project's .keel/keel.json `env` over it.
  const r = spawnSync(command, { cwd: ctx.root, env: gateEnv(ctx.env, ctx.config), shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 60 * 60_000 });
  if (r.error) throw new Error(`could not run \`${command}\`: ${r.error.message}`);
  if (r.status === null) throw new Error(`\`${command}\` was killed (${r.signal}) before it finished`);
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const counts = [...out.matchAll(/^(?:ℹ|#) tests (\d+)$/gm)].map(m => Number(m[1]));
  return { command, status: r.status, tests: counts.length ? counts.reduce((a, b) => a + b, 0) : null, ms: Date.now() - started };
});

/** gh, ready to read the project's repo, or a reason it is not. */
const ghReady = ctx => once(ctx, 'gh', () => {
  if (!ctx.config.repo) return { na: 'no repo in .keel/keel.json' };
  const gh = ctx.env.KEEL_GH || 'gh';
  const v = spawnSync(gh, ['--version'], { env: ctx.env, encoding: 'utf8' });
  if (v.error?.code === 'ENOENT') return { na: `gh is not installed (${gh})` };
  if (v.error) throw new Error(`could not run gh: ${v.error.message}`);
  const auth = spawnSync(gh, ['auth', 'status'], { env: ctx.env, encoding: 'utf8' });
  if (auth.status !== 0) return { na: 'gh is not authenticated (gh auth status fails; gh auth login, or GH_TOKEN in CI)' };
  return { gh };
});

/**
 * The repo-wide review read (lib.mjs readRepoReviews), once a night:
 * reviews_unanswered and cross_review_valid read the same pages.
 */
const repoReviews = (ctx, gh) => once(ctx, 'repo-reviews', () => {
  const page = vars => {
    const r = spawnSync(gh, repoReviewArgs(ctx.config.repo, vars), { env: ctx.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw new Error(`gh api graphql: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`gh api graphql exited ${r.status}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
    let repository;
    try { repository = JSON.parse(r.stdout)?.data?.repository; } catch { throw new Error('gh api graphql did not print JSON'); }
    if (!repository) throw new Error(`gh api graphql: no repository ${ctx.config.repo}`);
    return repository;
  };
  return readRepoReviews(page, ctx.date);
});

/** The cross-review's author: the Claude GitHub App, through which claude-code-action posts (REST claude[bot], GraphQL claude). */
export const CROSS_REVIEWER = 'claude[bot]';
/** cross_review_valid is n/a until this many of its comments are answered. */
export const CROSS_REVIEW_MIN = 10;
/**
 * keel review --close's three replies (lib/review.mjs replyText), by how each
 * opens; tests/improve.test.mjs holds them to replyText. A reply in other
 * words is not counted either way: the form is what says which it is.
 */
export const CROSS_REVIEW_ANSWERS = Object.freeze([['fixed', /^\*\*Fixed\*\* in /], ['tracked', /^\*\*Valid, tracked\*\* in /], ['notValid', /^\*\*Not valid:\*\* /]]);

/**
 * From the repo-wide read: the cross-review's inline comments (threads opened
 * by CROSS_REVIEWER on a PR whose head branch starts with one of `prefixes`,
 * open or merged in the window) and how each was answered: the first reply in
 * keel review's form by someone else decides. Throws as windowPrs does.
 * { prs, comments, fixed, tracked, valid, notValid, unanswered }.
 */
export function crossReviewTally(repository, { prefixes, date, reviewer = CROSS_REVIEWER }) {
  const { open, merged } = windowPrs(repository, date);
  const t = { prs: 0, comments: 0, fixed: 0, tracked: 0, valid: 0, notValid: 0, unanswered: 0 };
  for (const pr of [...open, ...merged]) {
    if (!prefixes.some(p => String(pr?.headRefName ?? '').startsWith(p))) continue;
    const threads = pr.reviewThreads;
    if (!Array.isArray(threads?.nodes)) throw new Error('the pull request came back without its review threads');
    if (threads.pageInfo?.hasNextPage) throw new IncompleteRead(`#${pr.number} has more review threads than one page; the read is incomplete`);
    let mine = 0;
    for (const th of threads.nodes) {
      const comments = th?.comments?.nodes ?? [];
      if (!comments.length || !sameLogin(comments[0]?.author?.login, reviewer)) continue;
      if (th.comments.pageInfo?.hasNextPage) throw new IncompleteRead(`#${pr.number} has more comments in a review thread than one page; the read is incomplete`);
      mine++;
      const answer = comments.slice(1).filter(c => !sameLogin(c?.author?.login, reviewer))
        .map(c => CROSS_REVIEW_ANSWERS.find(([, re]) => re.test(String(c?.body ?? '').trim()))?.[0]).find(Boolean);
      if (answer) t[answer]++;
      else t.unanswered++;
    }
    if (mine) { t.prs++; t.comments += mine; }
  }
  t.valid = t.fixed + t.tracked;
  return t;
}

function ghJson(ctx, gh, args) {
  const r = spawnSync(gh, args, { env: ctx.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`gh ${args.slice(0, 2).join(' ')}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} exited ${r.status}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  let data;
  try { data = JSON.parse(r.stdout); } catch { throw new Error(`gh ${args.slice(0, 2).join(' ')} did not print JSON`); }
  if (!Array.isArray(data)) throw new Error(`gh ${args.slice(0, 2).join(' ')} did not print a JSON array`);
  return data;
}

/**
 * The workflow that runs the gate on pushes: the one .keel/keel.json
 * `gateWorkflow` names (as fleet reads it: no guess beats the project
 * saying), else check.yml, else one naming the check command.
 */
async function gateWorkflow(ctx) {
  const named = gateWorkflowOf(ctx.config);
  if (named?.problem) throw new Error(named.problem);
  if (named) return named.name;
  const dir = join(ctx.root, '.github', 'workflows');
  const names = (await readdir(dir).catch(() => [])).filter(n => /\.ya?ml$/.test(n)).sort();
  if (names.includes('check.yml')) return 'check.yml';
  const command = ctx.config.check ?? CHECK;
  for (const n of names) if ((await readFile(join(dir, n), 'utf8')).includes(command)) return n;
  return null;
}

/** The test ledger's history and settings, read once; a bad .keel/keel.json "tests" is a broken instrument. */
const ledgerHistory = ctx => once(ctx, 'ledger', async () => ({ opts: testsConfigOf(ctx.config), ...await readRuns(ctx.root) }));
const tooFew = (n, window, what = `recorded runs in ${RUNS}`) => `${what}: ${n}, fewer than the window of ${window}; n/a until there are ${window} (the gate's own runs and CI's keel-test-runs artifacts fill it), never a zero`;
const named = t => `${t.file} "${t.name}"`;
/** The ledger measures' note when the history is the nights' own: CI's check does not keep its runs. */
const nightNote = runs => nightOnly(runs) ? `; ${NIGHT_ONLY} (add its upload step: keel-test-runs, path .keel/test-runs/)` : '';

/** A built phase's cited tests with a name: [{ file, name }] from its Acceptance (`tests/<file>: "<name>"`). */
export function citedNames(raw) {
  const acceptance = /^## Acceptance[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(raw ?? '')?.[1] ?? '';
  const out = [];
  for (const m of acceptance.matchAll(/(?<![\w./-])(tests\/[\w./-]*\w):\s*"([^"]+)"/g)) {
    if (!out.some(x => x.file === m[1] && x.name === m[2])) out.push({ file: m[1], name: m[2] });
  }
  return out;
}

// ---- conduct cost (after isocan's subagent-time.mjs) -----------------------

const READING = /^(cat|sed|head|tail|ls|find|grep|rg|wc|diff|git (log|show|diff|status|ls-files))\b/;

/** One shell segment's kind: whole check, whole suite, targeted tests, reading, or other. */
export function segmentKind(segment, check = CHECK) {
  let s = segment.trim().replace(/^env(\s+(-u\s+\S+|-i|\w+=\S*))*\s+/, '').replace(/^(\w+=\S*\s+)+/, '');
  s = s.replace(/\s+\d*>{1,2}&?\s*\S+/g, '').replace(/\s+/g, ' ').trim();
  const norm = c => c.replace(/\s+/g, ' ').trim();
  if (s === norm(check) || /^npm run check(:all)?$/.test(s)) return 'whole check';
  if (/^npm (run )?test$/.test(s)) return 'whole suite';
  if (/^npm (run )?test -- \S/.test(s)) return 'targeted tests';
  const nodeTest = /^node (?:\S+ )*--test(?: (.*))?$/.exec(s);
  if (nodeTest) {
    const files = (nodeTest[1] ?? '').split(' ').filter(a => a && !a.startsWith('--'));
    return !files.length || files.some(f => f.includes('*')) ? 'whole suite' : 'targeted tests';
  }
  if (READING.test(s)) return 'reading';
  return 'other';
}

const KIND_ORDER = ['whole check', 'whole suite', 'targeted tests', 'reading', 'other'];

/** A command with heredoc bodies dropped and quoted strings blanked (a glob stays a glob). */
function shellWords(command) {
  const lines = String(command).split('\n'), kept = [];
  for (let i = 0; i < lines.length; i++) {
    kept.push(lines[i]);
    const tag = /<<-?\s*['"]?([A-Za-z_]\w*)['"]?/.exec(lines[i])?.[1];
    if (tag) while (i + 1 < lines.length && lines[i + 1].trim() !== tag) i++;
  }
  return kept.join('\n').replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, q => q.includes('*') ? 'Q*' : 'Q');
}

/**
 * A Bash command's kind: the weightiest kind among its segments. With `root`,
 * a whole check or suite counts only where it runs in root: a `cd` elsewhere
 * (a fixture, a clone of another project) makes it another project's gate.
 */
export function commandKind(command, check, root) {
  let dir = root ?? null;
  const kinds = [];
  for (const segment of shellWords(command).split(/&&|\|\||[;|\n]/)) {
    const cd = /^\s*cd\s+(\S+)\s*$/.exec(segment);
    if (cd) {
      const to = cd[1];
      dir = /[$~`]/.test(to) ? undefined : to.startsWith('/') ? resolve(to) : typeof dir === 'string' ? resolve(dir, to) : undefined;
      continue;
    }
    const kind = segmentKind(segment, check);
    kinds.push(root !== undefined && kind.startsWith('whole') && dir !== root ? 'other' : kind);
  }
  return KIND_ORDER.find(k => kinds.includes(k)) ?? 'other';
}

/** Read every *.jsonl / *.output transcript in dir: wall minutes and calls per kind. */
export async function conductCost(dir, check, root) {
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`--transcripts ${dir} is not a directory`);
  const names = (await readdir(dir)).filter(n => /\.(jsonl|output)$/.test(n)).sort();
  const kinds = Object.fromEntries(KIND_ORDER.map(k => [k, { minutes: 0, calls: 0 }]));
  let transcripts = 0, skipped = 0;
  const agents = [];
  for (const name of names) {
    if (!(await stat(join(dir, name)).catch(() => null))?.isFile()) continue; // follows symlinks
    const open = new Map();
    let parsed = 0, whole = 0;
    for (const line of (await readFile(join(dir, name), 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { skipped++; continue; }
      if (!entry || typeof entry !== 'object') { skipped++; continue; }
      parsed++;
      const t = Date.parse(entry.timestamp ?? '');
      const content = entry.message?.content;
      if (!Array.isArray(content) || Number.isNaN(t)) continue;
      for (const part of content) {
        if (part?.type === 'tool_use' && part.name === 'Bash') {
          const kind = commandKind(part.input?.command ?? '', check, root);
          if (kind === 'whole check' || kind === 'whole suite') whole++;
          open.set(part.id, { t, kind });
        }
        if (part?.type === 'tool_result' && open.has(part.tool_use_id)) {
          const { t: t0, kind } = open.get(part.tool_use_id);
          open.delete(part.tool_use_id);
          kinds[kind].minutes += Math.max(0, t - t0) / 60_000;
          kinds[kind].calls++;
        }
      }
    }
    if (parsed) { transcripts++; agents.push({ file: name, wholeRuns: whole }); }
  }
  if (!transcripts) throw new Error(`no readable *.jsonl or *.output transcripts in ${dir}`);
  for (const k of KIND_ORDER) kinds[k].minutes = Math.round(kinds[k].minutes * 10) / 10;
  return { transcripts, skipped, kinds, agents, wholeRuns: agents.reduce((a, b) => a + b.wholeRuns, 0) };
}

// ---- escapes (phase 34) ----------------------------------------------------
//
// A defect found after a phase was built, read from what is already written,
// since the newest release tag (`v*`; with none, the first commit):
//   - a commit whose subject starts `fix:` or `fix(` (never "prefix", never "a fix in");
//   - a lessons row added since the tag whose provenance italics name this
//     project (its `repo` or its `name`);
//   - a Trajectory entry added since the tag that begins
//     `- **YYYY-MM-DD** — Escape:` (the phases README's marker; no prose is read).
// Each is attributed to the one phase its text names ("phase 33",
// "phases/33-"); a Trajectory entry naming none belongs to its own file's
// phase. Naming none, or several, is counted unattributed: never guessed.

/** A fix commit's subject: `fix:` or `fix(` at its very start. */
export const isFixSubject = subject => /^fix[:(]/i.test(String(subject ?? ''));
/** The Trajectory marker of an escape (docs/phases/README.md). */
export const ESCAPE_ENTRY = /^- \*\*\d{4}-\d{2}-\d{2}\*\* — Escape:/;

/** The distinct phase numbers a text names, in order: "phase 33", "phases/33-". */
export function phasesNamed(text) {
  const found = [];
  for (const m of String(text ?? '').matchAll(/\bphase[ -](\d+)\b|(?<![\w.])phases\/(\d+)-/gi)) {
    const n = Number(m[1] ?? m[2]);
    if (!found.includes(n)) found.push(n);
  }
  return found;
}
/** The one phase a text names, or null (none, or several: never guessed). */
export const phaseOf = text => { const p = phasesNamed(text); return p.length === 1 ? p[0] : null; };

/** Whether a lessons row's provenance italics *(…)* name this project: its repo, or its name as a word. */
export function selfProvenance(row, config = {}) {
  const groups = [...String(row ?? '').matchAll(/\*\(([^)]*)\)\*/g)].map(m => m[1]);
  if (!groups.length) return false;
  const words = [config.repo, config.name].filter(w => typeof w === 'string' && w.trim());
  return groups.some(g => words.some(w => new RegExp(`(?<![\\w/.-])${w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w/-])`, 'i').test(g)));
}

/** Added Trajectory escape lines in a `git diff -U0` of docs/phases/: [{ file, phase, text }]. */
export function escapeEntries(diff) {
  const out = [];
  let file = null;
  for (const line of String(diff ?? '').split('\n')) {
    if (line.startsWith('+++ ')) { const m = /^\+\+\+ b\/(docs\/phases\/(\d+)-[^/]*\.md)$/.exec(line); file = m ? { path: m[1], phase: Number(m[2]) } : null; continue; }
    if (!file || !line.startsWith('+') || !ESCAPE_ENTRY.test(line.slice(1))) continue;
    const text = line.slice(1);
    out.push({ file: file.path, phase: phaseOf(text.replace(ESCAPE_ENTRY, '')) ?? file.phase, text });
  }
  return out;
}

const SEP = '\x1f', REC = '\x1e';

/** A file's text at a revision, or null where the revision does not hold it. */
function textAt(ctx, rev, path) {
  const r = git(ctx, ['show', `${rev}:${path}`]);
  if (r.status === 0) return r.stdout;
  if (/does not exist|exists on disk, but not in|bad revision|invalid object name/i.test(r.stderr)) return null;
  throw new Error(`git show ${rev}:${path} exited ${r.status}: ${r.stderr.trim().split('\n')[0]}`);
}

/** The escapes between two revisions (from null: the first commit): [{ kind, ref, phase, text }]. */
function escapesBetween(ctx, from, to) {
  const found = [];
  const range = from ? `${from}..${to}` : to;
  for (const rec of gitOut(ctx, ['log', range, '--reverse', '--no-merges', `--format=%H${SEP}%s${SEP}%b${REC}`]).split(REC)) {
    const [sha, subject, body = ''] = rec.replace(/^\n/, '').split(SEP);
    if (!sha || !isFixSubject(subject)) continue;
    const lessons = [...`${subject}\n${body}`.matchAll(/\blesson (\d+)\b/gi)].map(m => Number(m[1]));
    found.push({ kind: 'commit', ref: sha.slice(0, 7), phase: phaseOf(`${subject}\n${body}`), text: subject, lessons });
  }
  const path = lessonsPathOf(ctx.config);
  const before = from ? textAt(ctx, from, path) : null, after = textAt(ctx, to, path);
  if (after !== null) {
    const known = new Set(parseLessons(before ?? '').rows.map(r => r.n));
    const lines = after.split('\n');
    for (const row of parseLessons(after).rows) {
      const raw = lines[row.line - 1] ?? '';
      if (known.has(row.n) || !selfProvenance(raw, ctx.config)) continue;
      // The phase from the shape and its cost only: a Guard naming a phase names the guard's builder, not the escape.
      found.push({ kind: 'lesson', ref: `lesson ${row.n}`, n: row.n, phase: phaseOf(`${row.shape} ${row.cost}`), text: row.shape.replace(/\*\(([^)]*)\)\*/g, '').replace(/\*\*/g, '').trim().slice(0, 100) });
    }
  }
  // One defect, one count: a fix commit naming a lesson counted here is that lesson's escape (the lesson keeps the commit).
  for (const c of found.filter(e => e.kind === 'commit')) {
    const lesson = found.find(e => e.kind === 'lesson' && c.lessons.includes(e.n));
    if (lesson) { (lesson.commits ??= []).push(c.ref); lesson.phase ??= c.phase; found.splice(found.indexOf(c), 1); }
  }
  for (const e of found) { delete e.lessons; delete e.n; }
  const base = from ?? gitOut(ctx, ['hash-object', '-t', 'tree', '/dev/null']).trim();
  for (const e of escapeEntries(gitOut(ctx, ['diff', '--no-renames', '--no-color', '-U0', base, to, '--', 'docs/phases/']))) {
    found.push({ kind: 'trajectory', ref: e.file, phase: e.phase, text: e.text.replace(ESCAPE_ENTRY, '').trim().slice(0, 100) });
  }
  return found;
}

/**
 * Ceremony for the phases built since `from` (null: all): days from planned
 * (the `since` written with `status: planned`, else the commit's day; a phase
 * never planned starts at its first commit) to the first commit in the window
 * that set `status: built`, and the phase file's words now.
 */
function ceremonyBetween(ctx, from, to) {
  const window = from ? new Set(gitOut(ctx, ['rev-list', `${from}..${to}`]).split('\n').filter(Boolean)) : null;
  const state = new Map();
  for (const rec of gitOut(ctx, ['log', to, '--reverse', '--no-renames', '--no-color', '-p', '-U0', `--format=${REC}%H${SEP}%cs`, '--', 'docs/phases/']).split(REC)) {
    const nl = rec.indexOf('\n');
    const [sha, day] = (nl < 0 ? rec : rec.slice(0, nl)).split(SEP);
    if (!sha || !day) continue;
    const files = new Map();
    let file = null;
    for (const line of rec.slice(nl + 1).split('\n')) {
      if (line.startsWith('+++ ')) { const m = /^\+\+\+ b\/(docs\/phases\/(\d+)-[^/]*\.md)$/.exec(line); file = m?.[1] ?? null; if (file && !files.has(file)) files.set(file, { phase: Number(m[2]), status: [], since: null }); continue; }
      if (!file) continue;
      const kv = /^\+(status|since):\s*(\S+)/.exec(line);
      if (kv?.[1] === 'status') files.get(file).status.push(kv[2]);
      if (kv?.[1] === 'since' && /^\d{4}-\d{2}-\d{2}$/.test(kv[2])) files.get(file).since = kv[2];
    }
    for (const [path, f] of files) {
      const s = state.get(path) ?? { phase: f.phase, first: day, planned: null, built: null };
      state.set(path, s);
      if (f.status.includes('planned') && !s.planned) s.planned = f.since ?? day;
      if (f.status.includes('built') && !s.built && (!window || window.has(sha))) s.built = day;
    }
  }
  const out = [];
  for (const [path, s] of state) {
    if (!s.built) continue;
    const text = textAt(ctx, to, path);
    out.push({ phase: s.phase, planned: s.planned ?? s.first, built: s.built, days: Math.max(0, days(s.planned ?? s.first, s.built)), words: text === null ? null : text.split(/\s+/).filter(Boolean).length });
  }
  return out.sort((a, b) => a.phase - b.phase);
}

const ESCAPE_KINDS = { commit: ['fix commit', 'fix commits'], lesson: ['own lesson', 'own lessons'], trajectory: ['Escape entry', 'Escape entries'] };

/** The escapes reading: n/a with why when git history cannot be read; never a zero. */
const escapesReading = ctx => once(ctx, 'escapes', () => {
  const shallow = git(ctx, ['rev-parse', '--is-shallow-repository']);
  if (shallow.status !== 0) return { na: 'not a git repository: no history to read escapes from' };
  if (shallow.stdout.trim() === 'true') return { na: 'a shallow clone: the release tags and history are not all here (fetch-depth: 0)' };
  const ref = ['main', 'HEAD'].find(r => git(ctx, ['rev-parse', '--verify', '--quiet', `${r}^{commit}`]).status === 0);
  if (!ref) return { na: 'no commits yet: no history to read escapes from' };
  const tags = gitOut(ctx, ['tag', '--list', 'v*', '--merged', ref, '--sort=-v:refname']).split('\n').map(t => t.trim()).filter(Boolean);
  const [tag = null, prev = null] = tags;
  const now = escapesBetween(ctx, tag, ref);
  const before = tag ? escapesBetween(ctx, prev, tag) : null;
  return { ref, tag, prev, now, before, ceremony: ceremonyBetween(ctx, tag, ref) };
});

/** The escapes between two revisions of a project (from null: its first commit), for a baseline by hand. */
export const escapesIn = ({ root, config, env = process.env }, from, to) => escapesBetween({ root, config, env, cache: new Map() }, from, to);

/** Escapes per phase, most first, then by phase: [[phase, [escape…]]]. */
export const escapesByPhase = escapes => [...escapes.filter(e => e.phase !== null).reduce((m, e) => m.set(e.phase, [...(m.get(e.phase) ?? []), e]), new Map())]
  .sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);

// ---- the measures ----------------------------------------------------------

const unguarded = g => !g.trim() || /^\*?to write\*?\.?$/i.test(g.trim()) || (/planned/i.test(g) && !/phase \d+/i.test(g));

/**
 * An evidence page that proves nothing: keel's evidence template with its
 * blanks still blank (the <phase> or <claim> heading, an empty Date or Claim
 * line). It passes the roadmap's "exists and is not empty" check without
 * being the thing — a facade.
 */
export const placeholderEvidence = text => /<phase>|<claim>/.test(text) || /^- (Date|Claim being checked):[ \t]*$/m.test(text);

/**
 * cross_review_valid (phase 42): is Claude's cross-review worth answering? The
 * share of its inline comments answered valid (fixed or tracked) among those
 * answered, recorded with no bound. Not in MEASURES yet: a measure with no
 * bound can never be outside, and --selftest holds every measure to reporting
 * outside on the unhealthy fixture (lesson 6). It joins the night when it has
 * a bound, or the selftest a rule for a recorded-only measure.
 */
export const CROSS_REVIEW_VALID = Object.freeze({
  id: 'cross_review_valid', what: `the cross-review's inline comments (${CROSS_REVIEWER}, on "crossReview".for branches) answered valid (fixed or tracked) among those answered, on open PRs and PRs merged in the last ${REVIEW_DAYS} days; n/a below ${CROSS_REVIEW_MIN} answered`, unit: '%', bound: null, better: 'higher', ratchet: false,
  async run(ctx) {
    const prefixes = ctx.config.crossReview?.for;
    if (ctx.config.crossReview === undefined) return { na: 'cross-review is off: .keel/keel.json has no "crossReview"' };
    if (!Array.isArray(prefixes) || !prefixes.length || prefixes.some(p => typeof p !== 'string' || !p)) throw new Error('"crossReview".for must list one branch prefix or more');
    const ready = await ghReady(ctx);
    if (ready.na) return { na: ready.na };
    let t;
    try { t = crossReviewTally(await repoReviews(ctx, ready.gh), { prefixes, date: ctx.date }); } catch (e) { if (e?.incomplete) return { na: e.message }; throw e; }
    const answered = t.valid + t.notValid;
    const said = `${t.valid} of ${answered} answered valid (fixed ${t.fixed}, tracked ${t.tracked}), ${t.notValid} not valid; ${t.unanswered} not answered in keel's form; ${t.comments} comment${t.comments === 1 ? '' : 's'} on ${t.prs} PR${t.prs === 1 ? '' : 's'}`;
    if (answered < CROSS_REVIEW_MIN) return { na: `${said}: the share waits for ${CROSS_REVIEW_MIN} answered` };
    return { value: Math.round((100 * t.valid) / answered), detail: said, facts: t };
  },
});

export const MEASURES = [
  {
    id: 'record_contradictions', what: 'working records contradict references or delivery facts', unit: 'findings', bound: 0, better: 'lower', ratchet: false,
    async run(ctx) {
      if (!(ctx.config.practices ?? []).includes('reconciliation')) return { na: 'the reconciliation practice is not on' };
      const reconcile = ctx.keel?.reconcile ?? (await import(pathToFileURL(join(ctx.root, 'scripts/keel/reconcile.mjs')).href)).reconcile;
      const facts = await reconcile({ root: ctx.root, github: true, env: ctx.env });
      if (facts.unknown.length) {
        const error = new Error('reconciliation incomplete: ' + facts.unknown.map(x => x.message ?? JSON.stringify(x)).join('; '));
        error.facts = facts;
        throw error;
      }
      return { value: facts.findings.length, bound: 0, detail: facts.findings.length ? facts.findings.map(x => `${x.rule} ${x.path}`).join('; ') : `no structured contradictions observed; ${facts.notes.length} advisory migration/review notes (not complete verification)`, facts };
    },
  },
  {
    id: 'gate', what: "the project's check fails, or passes having run no tests", unit: '0/1', bound: 0, better: 'lower',
    async run(ctx) {
      const g = await gateRun(ctx);
      const empty = g.status === 0 && g.tests === 0;
      return {
        value: g.status !== 0 || empty ? 1 : 0,
        detail: `\`${g.command}\` exit ${g.status}; ${g.tests === null ? 'no node test summary' : plural(g.tests, 'test')}${empty ? ' — passed while running nothing (lesson 14)' : ''}`,
        facts: { ...g, empty },
      };
    },
  },
  {
    // After the gate, so its own run (recorded by the reporter) is in the history.
    id: 'flaky_tests', what: 'tests that both passed and failed on one clean tree, in the newest window of recorded runs (the test ledger)', unit: 'tests', bound: 0, better: 'lower', ratchet: false,
    async run(ctx) {
      const { opts, runs, skipped } = await ledgerHistory(ctx);
      if (runs.length < opts.window) return { na: `${tooFew(runs.length, opts.window)}${nightNote(runs)}` };
      const recent = runs.slice(-opts.window);
      const found = flaky(recent);
      const trees = new Set(recent.filter(r => r.dirty === false && r.tree).map(r => r.tree)).size;
      return {
        value: found.length,
        detail: `${found.length ? list(found.map(t => `${named(t)} (passed ${t.passed}, failed ${t.failed})`), 3) : 'none'}; the newest ${opts.window} of ${plural(runs.length, 'run')}, ${plural(trees, 'clean tree')}${skipped ? `, ${skipped} unreadable` : ''}${nightNote(runs)}`,
        facts: { flaky: found.map(({ file, name, tree, passed, failed, dir, config, setting }) => ({ file, name, tree, passed, failed, dir, config, setting })), runs: runs.length, window: opts.window },
      };
    },
  },
  {
    id: 'slow_tests', what: 'tests in the newest recorded run above factor × their median over the last window passing runs on the same machine class and config, and above the floor (the test ledger)', unit: 'tests', bound: 0, better: 'lower', ratchet: false,
    async run(ctx) {
      const { opts, runs } = await ledgerHistory(ctx);
      if (runs.length < opts.window) return { na: `${tooFew(runs.length, opts.window)}${nightNote(runs)}` };
      const newest = runs.at(-1), machine = machineClass(newest.machine);
      // The baseline slower() judges against: the same machine class AND config. Fewer is n/a, never a zero.
      const same = comparable(runs, newest).length;
      if (same < opts.window) return { na: `${tooFew(same, opts.window, `earlier recorded runs on ${machine} under config ${newest.config ?? 'none'}`)}${nightNote(runs)}` };
      const found = slower(runs, opts, newest);
      return {
        value: found.length,
        detail: `${found.length ? list(found.map(t => `${named(t)} ${Math.round(t.ms)} ms against ${t.median} ms`), 3) : 'none'}; the newest run (${newest.date}) against ${opts.window} before it on ${machine} under config ${newest.config ?? 'none'}; ×${opts.factor} and +${opts.floorMs} ms${nightNote(runs)}`,
        facts: { slower: found, factor: opts.factor, floorMs: opts.floorMs, window: opts.window, machine },
      };
    },
  },
  {
    // The build a climb night's build-time job climbs (phase 36): timed once a night when
    // .keel/keel.json names "climb".build. Its bound is "climb".buildBudgetMs; without one
    // the value is recorded only (no bound, never outside), so a later night has a trend.
    id: 'build_time', what: "the build's wall time (.keel/keel.json climb.build), timed once; bound climb.buildBudgetMs, else recorded only", unit: 'ms', bound: null, better: 'lower', ratchet: false,
    async run(ctx) {
      const build = ctx.config.climb?.build;
      if (build === undefined) return { na: 'no "climb".build in .keel/keel.json' };
      if (typeof build !== 'string' || !build.trim()) throw new Error('"climb".build must be a non-empty shell command');
      const budget = ctx.config.climb.buildBudgetMs;
      if (budget !== undefined && !(Number.isInteger(budget) && budget > 0)) throw new Error('"climb".buildBudgetMs must be a whole number of milliseconds above 0');
      const started = Date.now();
      const r = spawnSync(build, { cwd: ctx.root, env: gateEnv(ctx.env, ctx.config), shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 60 * 60_000 });
      const ms = Date.now() - started;
      if (r.error) throw new Error(`could not run \`${build}\`: ${r.error.message}`);
      if (r.status !== 0) throw new Error(`\`${build}\` failed (exit ${r.status ?? r.signal}): a failing build has no time`);
      return {
        value: ms, bound: budget ?? null,
        detail: `\`${build}\` ${ms} ms${budget === undefined ? '; no "climb".buildBudgetMs, so recorded only' : ` against a budget of ${budget} ms`}`,
        facts: { command: build, ms, budget: budget ?? null },
      };
    },
  },
  {
    id: 'roadmap_stale', what: 'the roadmap check fails', unit: '0/1', bound: 0, better: 'lower',
    async run(ctx) {
      const off = phasesOff(ctx);
      if (off) return { na: off };
      const { run: roadmap } = await roadmapModule(ctx);
      try { await roadmap({ root: ctx.root, mode: 'check' }); return { value: 0, detail: 'docs/ROADMAP.md is current' }; }
      catch (e) { return { value: 1, detail: e.message, facts: { message: e.message } }; }
    },
  },
  {
    id: 'phases_without_issue', what: 'unfinished phases with no issue', unit: 'phases', bound: 0, better: 'lower',
    async run(ctx) {
      const off = phasesOff(ctx, { projects: true });
      if (off) return { na: off };
      if (!ctx.config.repo) return { na: 'no repo in .keel/keel.json, so there is nowhere to open an issue' };
      if (shapeOf(ctx.config) === 'projects') {
        // A project's issue is its primary doc's `issue:`; its open phases are followed there.
        const open = (await projectPhases(ctx)).filter(p => OPEN.includes(p.status) && !p.issue);
        const ids = open.map(p => p.id), projects = [...new Set(open.map(p => p.project))];
        return { value: ids.length, detail: ids.length ? `${list(ids, 6)} (${plural(projects.length, 'project')} with no issue:)` : 'every project with an open phase names its issue', facts: { shape: 'projects', ids, projects } };
      }
      const { DONE } = await roadmapModule(ctx);
      const ids = (await roadmapData(ctx)).phases.filter(p => unfinished(p, DONE) && !p.issue).map(p => p.id);
      return { value: ids.length, detail: ids.length ? `phases ${list(ids, 10)}` : 'every unfinished phase has an issue', facts: { ids } };
    },
  },
  {
    id: 'phases_stuck', what: `unfinished phases in one status for over ${STUCK_DAYS} days (by since; in the projects shape, by phases.md's last commit)`, unit: 'phases', bound: 0, better: 'lower',
    async run(ctx) {
      const off = phasesOff(ctx, { projects: true });
      if (off) return { na: off };
      if (shapeOf(ctx.config) === 'projects') {
        // No `since` per phase here: a phase is as old as its phases.md's last commit.
        const stuck = [];
        for (const p of (await projectRecords(ctx)) ?? []) {
          const open = (p.phases ?? []).filter(x => OPEN.includes(x.status));
          if (!open.length) continue;
          const touched = await lastTouched(ctx, p.phasesPath);
          const age = touched ? days(touched, ctx.date) : null;
          if (age !== null && age > STUCK_DAYS) stuck.push(...open.map(x => ({ id: `${p.name}/${x.id}`, status: x.status, since: touched, days: age, path: p.phasesPath })));
        }
        stuck.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
        return {
          value: stuck.length,
          detail: stuck.length ? list(stuck.map(p => `${p.id} ${p.status}, untouched since ${p.since} (${p.days}d)`), 4) : `no open phase in a phases.md untouched over ${STUCK_DAYS} days`,
          facts: { shape: 'projects', stuck },
        };
      }
      const { DONE } = await roadmapModule(ctx);
      const stuck = (await roadmapData(ctx)).phases.filter(p => unfinished(p, DONE) && days(p.since, ctx.date) > STUCK_DAYS)
        .map(p => ({ id: p.id, status: p.status, since: p.since, days: days(p.since, ctx.date) }));
      return {
        value: stuck.length,
        detail: stuck.length ? list(stuck.map(p => `${p.id} ${p.status} since ${p.since} (${p.days}d)`), 4) : `none older than ${STUCK_DAYS} days`,
        facts: { stuck },
      };
    },
  },
  {
    id: 'evidence_placeholders', what: 'built or lived-in phases whose evidence is the blank template (proves nothing)', unit: 'phases', bound: 0, better: 'lower',
    async run(ctx) {
      const off = phasesOff(ctx);
      if (off) return { na: off };
      const { DONE } = await roadmapModule(ctx);
      const found = [];
      for (const p of (await roadmapData(ctx)).phases.filter(p => DONE.includes(p.status))) {
        for (const e of p.evidence) {
          const text = await read(join(ctx.root, 'docs', e));
          if (text !== null && placeholderEvidence(text)) found.push({ id: p.id, evidence: e });
        }
      }
      const ids = [...new Set(found.map(f => f.id))];
      return { value: ids.length, detail: ids.length ? `phase${ids.length === 1 ? '' : 's'} ${list(found.map(f => `${f.id} (${f.evidence})`), 4)}` : 'every built phase\'s evidence says what was checked', facts: { ids, found } };
    },
  },
  {
    // Phase 32; its ledger half is phase 33's: a cited `tests/<file>: "<name>"`
    // that did not pass in the newest recorded run of that file is proof lost.
    // The name is matched as the test's name or a part of it. No recorded run
    // of a file is not a pass: it is said, and not counted.
    id: 'proofs_hold', what: 'built or lived-in phases whose proof is lost: Acceptance cites a tests/ path that is gone or a named test that did not pass in the last recorded run, or evidence names a missing path', unit: 'phases', bound: 0, better: 'lower', ratchet: false,
    async run(ctx) {
      const off = phasesOff(ctx);
      if (off) return { na: off };
      const { parsePhase, DONE } = await roadmapModule(ctx);
      const found = [];
      const { runs } = await readRuns(ctx.root);
      const unrun = [];
      // Each file on its own, not the roadmap's collect: a missing evidence file is what this measure names, where collect would stop.
      for (const file of (await notes(ctx, 'docs/phases')) ?? []) {
        let p;
        const raw = await read(join(ctx.root, 'docs', 'phases', file));
        try { p = parsePhase(file, raw); } catch { continue; } // the phase lint names it
        if (!DONE.includes(p.status)) continue;
        if (!Array.isArray(p.tests)) throw new Error('scripts/roadmap.mjs names no cited tests (it predates phase 32); keel update brings it');
        const missing = [];
        for (const t of p.tests) if (!await exists(join(ctx.root, t))) missing.push(t);
        for (const e of p.evidence) if (!await exists(join(ctx.root, 'docs', e))) missing.push(`docs/${e}`);
        const failing = [];
        for (const c of runs.length ? citedNames(raw) : []) {
          if (missing.includes(c.file)) continue;
          const last = lastOutcome(runs, c.file, c.name);
          if (!last) { unrun.push(`${c.file}: "${c.name}"`); continue; }
          if (!last.matched.length || last.matched.some(t => t.outcome !== 'pass')) failing.push(`${c.file}: "${c.name}"`);
        }
        if (missing.length || failing.length) found.push({ id: p.id, file, missing, ...(failing.length ? { failing } : {}) });
      }
      const ledger = !runs.length
        ? `the ledger half is n/a: no recorded test run in ${RUNS}`
        : `cited tests read against ${plural(runs.length, 'recorded run')}${unrun.length ? `; ${list(unrun, 3)} in no recorded run` : ''}`;
      const lost = f => [f.missing.length ? `${f.missing.join(', ')} missing` : '', f.failing ? `${f.failing.join(', ')} did not pass in the last recorded run` : ''].filter(Boolean).join('; ');
      return {
        value: found.length,
        detail: found.length
          ? `proof lost: ${list(found.map(f => `phase ${f.id} (${lost(f)})`), 3)}; ${ledger}`
          : `every built phase's cited tests and evidence paths exist; ${ledger}`,
        facts: { found, ...(unrun.length ? { unrun } : {}) },
      };
    },
  },
  {
    // Phase 34: defects found after a phase was built, since the newest release.
    // The bound is the previous release's own count (no rise release over
    // release), computed from git and recorded in .keel/bounds.json by --report;
    // with no previous release there is none, and the value is recorded only.
    id: 'escapes', what: 'defects found after a phase was built, since the newest release tag: fix: commits, own-provenance lessons, Trajectory `— Escape:` entries', unit: 'escapes', bound: null, better: 'lower', ratchet: false, release: true,
    async run(ctx) {
      const r = await escapesReading(ctx);
      if (r.na) return { na: r.na };
      const by = escapesByPhase(r.now);
      const unattributed = r.now.filter(e => e.phase === null).length;
      const kinds = Object.entries(ESCAPE_KINDS).map(([k, [one, many]]) => { const n = r.now.filter(e => e.kind === k).length; return `${n} ${n === 1 ? one : many}`; }).join(', ');
      const bound = r.before ? r.before.length : null;
      const window = r.tag ? `since ${r.tag}` : 'since the first commit (no release tag)';
      const prior = r.tag ? `; the release before (${r.prev ? `${r.prev}..` : 'up to '}${r.tag}) had ${r.before.length}` : '; no release before to compare';
      const ceremony = r.ceremony.length
        ? `ceremony, ${plural(r.ceremony.length, 'phase')} built ${r.tag ? `since ${r.tag}` : 'so far'}: ${list(r.ceremony.map(c => `${c.phase} ${c.days}d/${c.words ?? '?'}w`), 8)}`
        : `ceremony: no phase built ${r.tag ? `since ${r.tag}` : 'yet'}`;
      return {
        value: r.now.length, bound,
        detail: `${r.now.length} ${window} (${kinds}); ${by.length ? `by phase: ${list(by.map(([p, es]) => `${p} ×${es.length}`), 6)}` : 'none names a phase'}${unattributed ? `; ${unattributed} unattributed` : ''}${prior}; ${ceremony}`,
        facts: {
          since: r.tag, ref: r.ref, previous: r.tag ? { from: r.prev, to: r.tag, value: r.before.length } : null,
          escapes: r.now, byPhase: Object.fromEntries(by.map(([p, es]) => [p, es.length])), unattributed, ceremony: r.ceremony,
        },
      };
    },
  },
  {
    id: 'records_disagree', what: "projects whose front matter status contradicts their phases (built with a phase open, partial with all closed)", unit: 'projects', bound: 0, better: 'lower',
    async run(ctx) {
      const projects = ((await projectRecords(ctx)) ?? []).filter(p => p.phases?.length);
      if (!projects.length) return { na: 'no docs/projects/<p>/phases.md: no project records to compare' };
      const found = recordsDisagree(projects);
      return { value: found.length, detail: found.length ? list(found.map(f => f.detail), 3) : `all ${plural(projects.length, 'project')} agree with their phases`, facts: { found } };
    },
  },
  {
    id: 'status_unknown', what: 'phase Status lines no reader understands (a word outside CLOSED, PART-DONE, NOT STARTED, RETIRED; or none at all)', unit: 'findings', bound: 0, better: 'lower',
    async run(ctx) {
      const projects = ((await projectRecords(ctx)) ?? []).filter(p => p.phases?.length);
      if (!projects.length) return { na: 'no docs/projects/<p>/phases.md with phase headings to read' };
      const found = statusUnknown(projects);
      return { value: found.length, detail: found.length ? list(found.map(f => f.detail), 3) : `every phase in ${plural(projects.length, 'project')} has a known Status`, facts: { found } };
    },
  },
  {
    id: 'changelog_gaps', what: `changelog days in the last ${CHANGELOG_DAYS} with commits and no docs/changelog/<date>.md, or one still a draft`, unit: 'days', bound: 0, better: 'lower',
    async run(ctx) {
      const names = await notes(ctx, 'docs/changelog');
      if (names === null) return { na: 'no docs/changelog: this project keeps no changelog' };
      const pages = new Map();
      for (const n of names.filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))) pages.set(n.slice(0, 10), await read(join(ctx.root, 'docs/changelog', n)));
      const gaps = changelogGaps({ commits: await commitDays(ctx), pages, day: ctx.date, window: CHANGELOG_DAYS });
      return { value: gaps.length, detail: gaps.length ? list(gaps.map(g => g.detail), 4) : `every day with commits in the last ${CHANGELOG_DAYS} has a written page`, facts: { days: gaps.map(g => g.day) } };
    },
  },
  {
    id: 'research_unindexed', what: 'notes in docs/research/ its README does not name', unit: 'notes', bound: 0, better: 'lower',
    async run(ctx) {
      const names = await notes(ctx, 'docs/research');
      if (names === null) return { na: 'no docs/research' };
      const index = await read(join(ctx.root, 'docs/research/README.md'));
      if (index === null) return { na: 'no docs/research/README.md: no index for a note to be missing from' };
      const missing = names.filter(n => !index.includes(n));
      return { value: missing.length, detail: missing.length ? list(missing, 4) : `all ${plural(names.length, 'note')} indexed`, facts: { missing } };
    },
  },
  {
    id: 'verify_owed', what: 'walks in docs/verify/ nobody has walked yet (status unverified)', unit: 'walks', bound: 0, better: 'lower',
    async run(ctx) {
      const names = await notes(ctx, 'docs/verify');
      if (names === null) return { na: 'no docs/verify: no walks that need a person' };
      const owed = [];
      for (const n of names) {
        const front = frontMatter(await read(join(ctx.root, 'docs/verify', n)));
        // No front matter, or a word that is not works/broken, stays owed: a typo never takes a walk off the list.
        if (['works', 'broken'].includes(front?.get('status'))) continue;
        const since = /^\d{4}-\d{2}-\d{2}/.test(front?.get('since') ?? '') ? front.get('since').slice(0, 10) : null;
        owed.push({ path: `docs/verify/${n}`, since, days: since ? days(since, ctx.date) : null });
      }
      owed.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
      const oldest = owed.find(w => w.days !== null) ?? null;
      return {
        value: owed.length,
        detail: owed.length ? `${list(owed.map(w => w.path.slice('docs/verify/'.length)), 3)}${oldest ? `; oldest ${oldest.days}d (since ${oldest.since})` : '; none dated'}` : `all ${plural(names.length, 'walk')} walked`,
        facts: { owed: owed.map(w => w.path), oldest: oldest ? { path: oldest.path, since: oldest.since, days: oldest.days } : null },
      };
    },
  },
  {
    id: 'lessons_without_guard', what: 'lessons whose guard is empty, "to write", or planned without a phase', unit: 'lessons', bound: 0, better: 'lower',
    async run(ctx) {
      const path = lessonsPathOf(ctx.config);
      const text = await readFile(join(ctx.root, path), 'utf8').catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
      if (text === null) return { na: `no ${path}` };
      // The guard column is the header cell naming a guard, anywhere (ledger's
      // `Guard`, cajones' `Guard / status`); unnumbered rows count by position.
      const table = parseLessons(text);
      if (table.guard < 0) throw new Error(`${path} has no table with a Guard column`);
      const { rows } = table;
      const ids = rows.filter(r => unguarded(r.guard)).map(r => r.n);
      return { value: ids.length, detail: ids.length ? `#${ids.join(', #')} of ${rows.length}` : `all ${rows.length} name a guard`, facts: { ids, path } };
    },
  },
  {
    id: 'lessons_unsent', what: `lessons table rows not yet sent home (not in ${SENT})`, unit: 'lessons', bound: 0, better: 'lower',
    // A rule, not a level: every lesson goes home. The night cannot send (the
    // inbox needs the owner's login), so it counts, and the proposal says how.
    ratchet: false,
    // keel is home, so the selftest reads this one on its fixture as a project.
    projectOnly: true,
    async run(ctx) {
      if (ctx.config.keel === 'self') return { na: 'keel is home: lessons come here (keel learn), they are not sent' };
      const u = await unsentLessons(ctx.root, ctx.config);
      if (u.na) return { na: u.na };
      const ids = u.unsent.map(r => r.n);
      return {
        value: ids.length,
        detail: ids.length ? `#${ids.join(', #')} of ${u.rows} in ${u.path}` : `all ${u.rows} sent`,
        facts: { ids, fingerprints: u.unsent.map(r => r.fingerprint), path: u.path },
      };
    },
  },
  {
    id: 'drift', what: "keel's managed files the project changed (doctor: edited, both)", unit: 'files', bound: 0, better: 'lower',
    async run(ctx) {
      const d = await practiceReading(ctx);
      if (d.na) return { na: d.na };
      const paths = d.drift.map(x => x.path);
      return { value: paths.length, detail: `${paths.length ? list(paths) : 'none'}${d.keel ? '' : projectSide(`by ${LOCK}; behind is keel-side`)}`, facts: { paths } };
    },
  },
  {
    id: 'lint', what: 'practice rules broken (doctor)', unit: 'findings', bound: 0, better: 'lower',
    async run(ctx) {
      const d = await practiceReading(ctx);
      if (d.na) return { na: d.na };
      const found = d.lint.map(l => `${l.rule} ${l.path}`);
      return { value: found.length, detail: `${found.length ? list(found, 3) : 'none'}${d.keel ? '' : projectSide(`the rules a project can read: ${PROJECT_LINTS.join(', ')}`)}`, facts: { lint: d.lint.map(({ rule, path }) => ({ rule, path })) } };
    },
  },
  {
    id: 'inbox_waiting', what: 'inbox proposals not yet decided', unit: 'proposals', bound: 0, better: 'lower',
    async run(ctx) {
      if (ctx.config.keel !== 'self') return { na: "keel only: the inbox is where lessons come home to keel" };
      if (!ctx.keel?.proposals) return { na: 'keel-side only: keel improve reads the inbox' };
      const waiting = (await ctx.keel.proposals(ctx.root)).filter(p => ['untriaged', 'proposed'].includes(p.meta.status));
      if (!waiting.length) return { value: 0, detail: 'nothing waiting' };
      const oldest = waiting[0]; // proposals() is oldest first
      const age = days(oldest.date, ctx.date);
      return { value: waiting.length, detail: `oldest ${oldest.date}-${oldest.slug} (${oldest.meta.status}, ${age}d)`, facts: { oldest: oldest.slug, status: oldest.meta.status, age } };
    },
  },
  {
    id: 'ci_red_streak', what: 'failing gate runs in a row on main', unit: 'runs', bound: 0, better: 'lower',
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const workflow = await gateWorkflow(ctx);
      if (!workflow) return { na: 'no workflow in .github/workflows runs the gate, and .keel/keel.json names no gateWorkflow' };
      // The limit counts runs, not verdicts: read enough that cancelled runs cannot hide one.
      const runs = ghJson(ctx, ready.gh, ['run', 'list', '--repo', ctx.config.repo, '--branch', 'main', '--workflow', workflow, '--json', 'conclusion', '--limit', String(RED_RUNS)]);
      // Only verdicts count: a running, cancelled, skipped, neutral or stale run says
      // nothing about the code (cancel-in-progress makes most runs cancelled), so it
      // neither breaks a streak nor adds to one.
      const FAILED = ['failure', 'timed_out', 'startup_failure'];
      const verdicts = runs.filter(r => r?.conclusion === 'success' || FAILED.includes(r?.conclusion));
      const full = runs.length >= RED_RUNS;
      // A full page with no verdict says nothing: an older failure may be behind it.
      if (!verdicts.length && full) return { na: `${workflow}: no verdict in the newest ${runs.length} runs (all cancelled, skipped or running)` };
      let streak = 0;
      while (streak < verdicts.length && FAILED.includes(verdicts[streak].conclusion)) streak++;
      // Every verdict on a full page failed: the streak is at least this long.
      const least = full && streak === verdicts.length ? 'at least ' : '';
      const now = streak ? `${least}${plural(streak, 'failed run')} in a row` : verdicts.length ? 'the latest verdict is green' : 'no verdict yet';
      return { value: streak, detail: `${workflow}: ${now} (${runs.length} read, ${verdicts.length} verdicts)`, facts: { workflow, streak } };
    },
  },
  {
    id: 'machine_prs', what: 'open machine PRs in the fullest queue, against that queue\'s own bound (keel/, keel-night/, keel-loop/ 1; renovate/ 4)', unit: 'PRs', bound: 1, better: 'lower',
    // The bound is the rule, per queue (MACHINE_BOUNDS), not a level to improve: the night
    // shift's own open PR would sit outside a ratcheted 0 every morning. The run names the
    // queue it judged and that queue's bound; .keel/bounds.json does not move it.
    ratchet: false,
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const prs = ghJson(ctx, ready.gh, ['pr', 'list', '--repo', ctx.config.repo, '--state', 'open', '--json', 'headRefName', '--limit', '100']);
      const queues = Object.fromEntries(MACHINE_PREFIXES.map(p => [p, prs.filter(x => String(x?.headRefName ?? '').startsWith(p)).length]));
      const info = Object.hasOwn(ctx.config.local ?? {}, 'renovate') ? ['renovate/'] : [];
      // The fullest queue relative to its own bound; ties by order.
      const judged = MACHINE_PREFIXES.filter(p => !info.includes(p));
      const worst = judged.reduce((a, b) => queues[b] / MACHINE_BOUNDS[b] > queues[a] / MACHINE_BOUNDS[a] ? b : a);
      const detail = MACHINE_PREFIXES.map(p => `${p} ${queues[p]}${info.includes(p) ? ' (information: the project\'s own Renovate config)' : ''}`).join(', ');
      return { value: queues[worst], bound: MACHINE_BOUNDS[worst], detail, facts: { queues, worst, bounds: MACHINE_BOUNDS, ...(info.length ? { information: info } : {}) } };
    },
  },
  {
    id: 'issues_unnamed', what: 'open issues no doc under docs/ names (#N, issue: N, or an /issues/N link)', unit: 'issues', bound: 0, better: 'lower',
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const issues = await openIssues(ctx, ready.gh);
      const named = new Set();
      for (const t of await docTexts(ctx)) for (const n of issuesNamed(t ?? '')) named.add(n);
      const unnamed = issues.filter(i => !named.has(i?.number)).sort((a, b) => a.number - b.number);
      return { value: unnamed.length, detail: unnamed.length ? `${list(unnamed.map(i => `#${i.number}`), 8)} of ${issues.length} open` : `all ${issues.length} open named in docs/`, facts: { ids: unnamed.map(i => i.number) } };
    },
  },
  {
    id: 'issues_done_open', what: 'built or superseded projects (docs/projects) whose issue is still open', unit: 'issues', bound: 0, better: 'lower',
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const projects = (await projectRecords(ctx)) ?? [];
      if (!projects.length) return { na: 'no docs/projects: no project status for an issue to outlive' };
      const open = new Set((await openIssues(ctx, ready.gh)).map(i => i?.number));
      const done = projects.filter(p => ['built', 'superseded'].includes(p.status) && p.issue && open.has(p.issue));
      return { value: done.length, detail: done.length ? list(done.map(p => `#${p.issue} (${p.name} is ${p.status})`), 4) : 'no finished project has an open issue', facts: { found: done.map(p => ({ project: p.name, issue: p.issue, status: p.status })) } };
    },
  },
  {
    id: 'prs_stale', what: `open PRs older than ${STALE_PR_DAYS} days`, unit: 'PRs', bound: 0, better: 'lower',
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const prs = (await openPrs(ctx, ready.gh)).map(p => ({ number: p?.number, title: p?.title, age: /^\d{4}-\d{2}-\d{2}/.test(p?.createdAt ?? '') ? days(p.createdAt.slice(0, 10), ctx.date) : null }));
      if (prs.some(p => p.age === null)) throw new Error('gh pr list returned a PR with no createdAt');
      const stale = prs.filter(p => p.age > STALE_PR_DAYS).sort((a, b) => b.age - a.age);
      return { value: stale.length, detail: stale.length ? list(stale.map(p => `#${p.number} (${p.age}d)`), 4) : `none of ${prs.length} open older than ${STALE_PR_DAYS} days`, facts: { stale: stale.map(p => ({ number: p.number, age: p.age })) } };
    },
  },
  {
    id: 'reviews_unanswered', what: `review comments with no answer, older than a day, on open PRs and PRs merged in the last ${REVIEW_DAYS} days`, unit: 'comments', bound: 0, better: 'lower',
    // A rule, not a level: every comment is answered (keel phase 41). Never a gate: nothing refuses a merge.
    ratchet: false,
    async run(ctx) {
      const ready = await ghReady(ctx);
      if (ready.na) return { na: ready.na };
      const rc = reviewConfigOf(ctx.config);
      if (rc.problem) throw new Error(rc.problem);
      let prs, open, merged;
      // An incomplete read (more PRs than REVIEW_PAGES pages, a list longer than its page) is n/a, never a number.
      try { ({ prs, open, merged } = unansweredPrs(await repoReviews(ctx, ready.gh), rc.reviewers, ctx.date)); } catch (e) { if (e?.incomplete) return { na: e.message }; throw e; }
      const value = prs.reduce((n, p) => n + p.unanswered, 0);
      const detail = prs.length ? list(prs.map(p => `#${p.number} ${p.unanswered} (${p.state}, since ${p.oldest})`), 6) : `none on ${plural(open, 'open PR')} and ${merged} merged in ${REVIEW_DAYS} days`;
      return { value, detail, facts: { repo: ctx.config.repo, prs: prs.map(({ title, ...p }) => p) } };
    },
  },
  {
    id: 'dependency_age', what: 'outdated packages (npm outdated, in the root and each app or workspace folder with its own package-lock.json)', unit: 'packages', bound: 0, better: 'lower',
    async run(ctx) {
      // Every folder with its own lockfile: an app folder (web/) or a workspace is read where it lives (ledger's web/).
      const dirs = [];
      for (const d of ['.', ...await packageDirs(ctx.root)]) if (await exists(join(ctx.root, d, 'package-lock.json'))) dirs.push(d);
      if (!dirs.length) return { na: 'no package-lock.json' };
      const npm = ctx.env.KEEL_NPM || 'npm';
      const rows = [];
      for (const d of dirs) {
        const at = d === '.' ? '' : ` in ${d}/`;
        const r = spawnSync(npm, ['outdated', '--json'], { cwd: join(ctx.root, d), env: stripTest(ctx.env), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        if (r.error) throw new Error(`could not run npm outdated${at}: ${r.error.message}`);
        if (![0, 1].includes(r.status)) throw new Error(`npm outdated${at} exited ${r.status}: ${(r.stderr || '').trim().split('\n')[0]}`);
        let data;
        try { data = r.stdout.trim() ? JSON.parse(r.stdout) : {}; } catch { throw new Error(`npm outdated --json${at} did not print JSON`); }
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) throw new Error(`npm outdated${at}: ${data?.error?.summary ?? 'unexpected output'}`);
        for (const n of Object.keys(data).sort()) {
          const v = [].concat(data[n])[0] ?? {};
          rows.push({ name: d === '.' ? n : `${n} (${d})`, current: v.current, latest: v.latest });
        }
      }
      const names = rows.map(x => x.name);
      return {
        value: names.length,
        detail: names.length ? list(rows.map(x => `${x.name} ${x.current ?? '?'}→${x.latest ?? '?'}`), 4) : 'none',
        facts: { names, dirs },
      };
    },
  },
  {
    id: 'conduct_cost', what: 'whole-check or whole-suite runs by builders (lesson 5: builders test by file)', unit: 'runs', bound: 0, better: 'lower',
    async run(ctx) {
      if (!ctx.transcripts) return { na: 'no --transcripts <dir>: conducting cost is read from a session\'s subagent transcripts' };
      const c = await conductCost(ctx.transcripts, ctx.config.check ?? CHECK, ctx.root);
      const k = c.kinds;
      const minutes = k['whole check'].minutes + k['whole suite'].minutes;
      return {
        value: c.wholeRuns,
        detail: `${plural(c.transcripts, 'transcript')}; min: whole ${Math.round(minutes * 10) / 10}, targeted ${k['targeted tests'].minutes}, reading ${k.reading.minutes}, other ${k.other.minutes}${c.skipped ? `; ${plural(c.skipped, 'unparseable line')} skipped` : ''}`,
        facts: { ...c, wholeMinutes: Math.round(minutes * 10) / 10 },
      };
    },
  },
];

// ---- judging, the ratchet, the proposal -----------------------------------

const within = (m, value, bound) => m.better === 'higher' ? value >= bound : value <= bound;
const beats = (m, value, bound) => m.better === 'higher' ? value > bound : value < bound;
const margin = r => (r.better === 'higher' ? r.bound - r.value : r.value - r.bound) / Math.max(Math.abs(r.bound), 1);

/** Run every measure; never throws for a measure, which becomes `broken`. */
export async function measure({ root, config, env = process.env, transcripts, date = today(), bounds = {}, measures = MEASURES, keel }) {
  const ctx = { root, config, env, transcripts, date, keel, cache: new Map() };
  const results = [];
  for (const m of measures) {
    const bound = Number.isFinite(bounds[m.id]) ? bounds[m.id] : m.bound;
    const base = { id: m.id, what: m.what, unit: m.unit, better: m.better, bound };
    try {
      const r = await m.run(ctx);
      if (r?.na) { results.push({ ...base, state: 'n/a', value: null, detail: r.na }); continue; }
      if (!Number.isFinite(r?.value)) throw new Error(`the instrument returned no number (${JSON.stringify(r?.value)})`);
      // A rule measure (ratchet: false) may name the bound its value is judged by (machine_prs: per queue).
      // A release measure (escapes) is judged by its own reading only: none when there is no release before.
      const b = m.release ? (Number.isFinite(r.bound) ? r.bound : null) : m.ratchet === false && Number.isFinite(r.bound) ? r.bound : bound;
      // No bound at all (build_time with no budget): the value is recorded, never outside.
      results.push({ ...base, bound: Number.isFinite(b) ? b : null, state: !Number.isFinite(b) || within(m, r.value, b) ? 'ok' : 'outside', value: r.value, detail: r.detail ?? '', facts: r.facts ?? {} });
    } catch (e) {
      results.push({ ...base, state: 'broken', value: null, detail: String(e?.message ?? e).split('\n')[0], ...(e.facts ? { facts: e.facts } : {}) });
    }
  }
  return results;
}

/** The smallest change that would move one measure, as a sentence. Deterministic. */
export function proposalText(r, config = {}) {
  const f = r.facts ?? {};
  if (r.state === 'broken') return `Fix the ${r.id} instrument: ${r.detail}. A measure that cannot run is not a zero (lesson 6).`;
  switch (r.id) {
    case 'record_contradictions': return 'Review the reconciliation findings and manual proposals below. Refresh source observations before editing; never infer acceptance or production verification from a merge.';
    case 'gate': return f.empty
      ? `Make \`${f.command}\` run the project's tests: it passed while running none (lesson 14).`
      : `Make the gate pass: \`${f.command}\` exits ${f.status}. Start from its first failure.`;
    case 'roadmap_stale': return `Regenerate the roadmap (\`npm run roadmap\`) and commit it; the check says: ${f.message}`;
    case 'phases_without_issue': return f.shape === 'projects'
      ? `Open an issue on ${config.repo} for ${list(f.projects, 6)} and set \`issue:\` in each project's primary doc front matter (open phases ${list(f.ids, 6)}).`
      : `Open issues on ${config.repo} for phases ${list(f.ids, 10)} and set \`issue:\` in each one's front matter.`;
    case 'phases_stuck': {
      const p = f.stuck[0];
      if (f.shape === 'projects') return `Move ${p.id} (${p.status}; ${p.path} untouched since ${p.since}, ${p.days} days): take its next action, or mark it RETIRED.${f.stuck.length > 1 ? ` ${f.stuck.length - 1} more after it.` : ''}`;
      return `Move phase ${p.id} (${p.status} since ${p.since}, ${p.days} days): take its next action, split it, or mark it superseded, and set \`since:\`.${f.stuck.length > 1 ? ` ${f.stuck.length - 1} more after it.` : ''}`;
    }
    case 'records_disagree': return `Make ${f.found[0].path} say what its phases say (${f.found[0].detail}).${f.found.length > 1 ? ` ${f.found.length - 1} more after it.` : ''}`;
    case 'status_unknown': return `Give ${f.found[0].path} a Status line in the vocabulary (CLOSED, PART-DONE, NOT STARTED, RETIRED): ${f.found[0].detail}.${f.found.length > 1 ? ` ${f.found.length - 1} more after it.` : ''}`;
    case 'changelog_gaps': return `Write the changelog for ${list(f.days, 4)} (docs/changelog/<date>.md, draft marker removed), from that day's commits.`;
    case 'research_unindexed': return `Add ${list(f.missing, 4)} to docs/research/README.md, saying what each found.`;
    case 'verify_owed': return `Walk ${f.oldest?.path ?? f.owed[0]} (or another of the ${f.owed.length}) and set its status to works or broken.`;
    case 'issues_unnamed': return `Name issue${f.ids.length === 1 ? '' : 's'} ${list(f.ids.map(n => `#${n}`), 6)} in the doc whose work ${f.ids.length === 1 ? 'it follows' : 'they follow'}, or close ${f.ids.length === 1 ? 'it' : 'them'} on ${config.repo}.`;
    case 'issues_done_open': return `Close #${f.found[0].issue} on ${config.repo} (${f.found[0].project} is ${f.found[0].status}), or say in its doc what is still open.${f.found.length > 1 ? ` ${f.found.length - 1} more after it.` : ''}`;
    case 'prs_stale': return `Merge or close PR #${f.stale[0].number} (open ${f.stale[0].age} days).${f.stale.length > 1 ? ` ${f.stale.length - 1} more after it.` : ''}`;
    case 'lessons_without_guard': return `Name the guard, or the phase that will build it, for lesson${f.ids.length === 1 ? '' : 's'} #${f.ids.join(', #')} in ${f.path ?? LESSONS}.`;
    case 'evidence_placeholders': return `Fill the evidence for phase${f.ids.length === 1 ? '' : 's'} ${f.ids.join(', ')} with what was actually checked, or step ${f.ids.length === 1 ? 'it' : 'them'} back to partial; a blank template proves nothing.`;
    case 'proofs_hold': return `Phase ${f.found[0].id} has lost its proof (${[...f.found[0].missing, ...(f.found[0].failing ?? []).map(x => `${x} did not pass`)].join(', ')}): make the test pass, re-point the reference if it moved, or step the phase back to partial with the reason. Never write evidence to make it hold.${f.found.length > 1 ? ` ${f.found.length - 1} more after it.` : ''}`;
    case 'lessons_unsent': return `Send them home: \`${SEND_LESSONS}\` (${f.ids.length} unsent in ${f.path}; \`--dry-run\` lists them first). Filing on keel's inbox is the owner's step.`;
    case 'drift': return `Settle the project's edits to ${list(f.paths, 3)}: send them home (\`keel lessons\`), or \`keel doctor --fix <path> restore|eject\`.`;
    case 'lint': return `Fix ${f.lint[0].rule} at ${f.lint[0].path} (\`keel doctor\` says how).${f.lint.length > 1 ? ` ${f.lint.length - 1} more after it.` : ''}`;
    case 'inbox_waiting': return f.status === 'untriaged'
      ? `Read and propose ${f.oldest} (\`keel learn propose ${f.oldest} …\`); it has waited ${f.age} days. A person then decides.`
      : `Decide ${f.oldest} (\`keel learn decide ${f.oldest} accepted|declined\`); it has waited ${f.age} days for a person.`;
    case 'ci_red_streak': return `Fix main: ${f.workflow} has failed ${f.streak} runs in a row. Start from the newest failure (\`gh run list --workflow ${f.workflow}\`).`;
    case 'machine_prs': {
      const n = f.queues[f.worst], b = f.bounds?.[f.worst] ?? 1, over = n - b;
      return b === 1
        ? `Drain the ${f.worst} queue to its newest PR: close the ${over} older one${over === 1 ? '' : 's'} (lesson 9).`
        : `The ${f.worst} queue holds ${n} PRs against ${b} (one per lane): merge or close the ${over} oldest (lesson 9).`;
    }
    case 'reviews_unanswered': {
      const [p] = f.prs;
      return `Answer the review comments on ${list(f.prs.map(x => `#${x.number}`), 4)}: read them (\`keel review ${f.repo}#${p.number}\`), validate each against the code, then answer it fixed, tracked or not valid (\`--close <id> --fixed <commit> | --tracked <issue|version> | --not-valid "<why>"\`). Not a gate: nothing waits on it but the answer.`;
    }
    case 'dependency_age': return `Update ${list(f.names, 4)}, or let Renovate's lanes take them.`;
    case 'flaky_tests': {
      const t = f.flaky[0];
      return `Fix or file the flaky test ${named(t)}: it passed ${t.passed}, failed ${t.failed} on one clean tree (${String(t.tree).slice(0, 7)}). Run it alone: \`${aloneCommand(t)}\`. Never rerun until green.${f.flaky.length > 1 ? ` ${f.flaky.length - 1} more after it.` : ''}`;
    }
    case 'slow_tests': {
      const t = f.slower[0];
      return `Fix or file the slower test ${named(t)}: ${Math.round(t.ms)} ms against a median of ${t.median} ms over its last ${t.window} passing runs (${t.machine}). Run it alone: \`${aloneCommand(t)}\`.${f.slower.length > 1 ? ` ${f.slower.length - 1} more after it.` : ''}`;
    }
    case 'escapes': {
      const [top] = escapesByPhase(f.escapes ?? []);
      const rose = `${r.value} escapes since ${f.since ?? 'the first commit'} against ${r.bound} in the release before`;
      return top
        ? `Make phase ${top[0]} the next hygiene target: it has the most escapes (${top[1].length}: ${list(top[1].map(e => `${e.ref} ${e.text}`.slice(0, 80)), 3)}). ${rose}. For each, name the real surface its proof missed and add the guard that would have caught it.`
        : `${rose[0].toUpperCase()}${rose.slice(1)}, and none names its phase: name the phase in each fix commit, lesson row or \`— Escape:\` line, so the next night can point at one.`;
    }
    case 'build_time': return `Bring the build back under its budget: \`${f.command}\` took ${f.ms} ms against ${f.budget} ms. A climb night's build-time job can take it ("climb".jobs).`;
    case 'conduct_cost': return `Brief builders to test the files they touched: they ran the whole check or suite ${f.wholeRuns} times (${f.wholeMinutes} min); the conductor runs it once (lesson 5).`;
    default: return `Move ${r.id} back within its bound (${r.value} against ${r.bound}).`;
  }
}

/** The one proposal: broken beats outside; then the largest relative margin; ties by measure order. */
export function propose(results, config) {
  const broken = results.find(r => r.state === 'broken');
  let worst = broken;
  if (!worst) {
    for (const r of results) if (r.state === 'outside' && (!worst || margin(r) > margin(worst))) worst = r;
  }
  return worst ? { id: worst.id, state: worst.state, text: proposalText(worst, config) } : null;
}

export async function readBounds(root) {
  const raw = await readFile(join(root, BOUNDS), 'utf8').catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
  if (raw === null) return null;
  let data;
  // A bounds file that cannot be read is a broken instrument (2), never a measure outside its bound (1).
  try { data = JSON.parse(raw); } catch { throw new ImproveError(`${BOUNDS} is not JSON`, 2); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ImproveError(`${BOUNDS} must be an object of measure id → bound`, 2);
  return data;
}

/** The ratchet: every bound a value beat becomes that value. Never loosens. */
export function tighten(results, bounds, measures = MEASURES) {
  const next = {}, tightened = [];
  for (const m of measures) {
    next[m.id] = Number.isFinite(bounds[m.id]) ? bounds[m.id] : m.bound;
    const r = results.find(x => x.id === m.id);
    // A release measure records the bound it was judged by (the previous release's value); never tightened mid-release.
    if (m.release) { if (Number.isFinite(r?.bound)) next[m.id] = r.bound; continue; }
    if (m.ratchet !== false && r?.state === 'ok' && beats(m, r.value, next[m.id])) {
      tightened.push({ id: m.id, from: next[m.id], to: r.value });
      next[m.id] = r.value;
    }
  }
  for (const [k, v] of Object.entries(bounds)) if (!Object.hasOwn(next, k)) next[k] = v; // the project's own keys stay
  return { bounds: next, tightened };
}

const esc = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
const shown = r => r.value === null ? '—' : String(r.value);
/** A row's bound as the page writes it; none (a value recorded only) is a dash. */
const boundOf = r => (Number.isFinite(r.bound) ? `${r.better === 'higher' ? '≥' : '≤'} ${r.bound}` : '—');

export function page({ config, date, results, proposal, tightened, by = COMMAND, climb = null, retire = [], tend = null, budget = null }) {
  return [
    `# Health — ${date}`, '',
    `\`${by} --report\` on ${config.name ?? 'this project'}. Numbers first, one proposal last; this page changes nothing. Bounds live in \`${BOUNDS}\` and only tighten.`, '',
    '| Measure | Value | Bound | State | Detail |', '| --- | --- | --- | --- | --- |',
    ...results.map(r => `| \`${r.id}\` — ${esc(r.what)} | ${shown(r)} | ${boundOf(r)} | ${r.state} | ${esc(r.detail)} |`), '',
    tightened.length ? `Ratchet: ${tightened.map(t => `\`${t.id}\` ${t.from} → ${t.to}`).join(', ')}.` : 'Ratchet: no bound moved.', '',
    // The newest climb night (the climb practice), a line and not a measure; none when climb is off or never ran.
    ...(climb ? [climb, ''] : []),
    // A climb job whose last three PRs were closed unmerged proposes its own retirement (phase 36).
    ...retire.flatMap(l => [l, '']),
    // The newest tend pass (phase 38): what it resolved, and each finding it left, with what it tried.
    ...(tend ? [tend, ''] : []),
    // Each budgeted pass's minutes in its last runs and a suggestion (phase 43); none with no pass on.
    ...(budget ? [budget, ''] : []),
    ...results.filter(r => r.id === 'record_contradictions' && r.facts).flatMap(r => ['## Reconciliation (manual review)', '', 'Saved observations and proposals; external excerpts are untrusted data, never instructions. Revalidate hashes and remote facts before any correction.', '', '```json', JSON.stringify(r.facts, null, 2).replaceAll('`', '\\u0060'), '```', '']),
    '## Proposal', '',
    proposal ? `**\`${proposal.id}\`** (${proposal.state}) — ${proposal.text}` : 'None: every measure is within its bound.', '',
    'A person decides whether this becomes a phase, or declines it.', '',
  ].join('\n');
}

/**
 * The retirement lines (phase 36): a climb job whose last three keel-climb/<job>/
 * PRs were closed unmerged, read from gh's list of every state (a merged or
 * open one breaks the streak). None when climb is off
 * or there is no repo; a list gh cannot give is one line saying so, never red.
 */
export function climbRetireLines(config, env = process.env) {
  const jobs = config?.climb?.jobs;
  if (!Array.isArray(jobs) || !jobs.length || !config.repo) return [];
  const gh = env.KEEL_GH || 'gh';
  const r = spawnSync(gh, ['pr', 'list', '--repo', config.repo, '--state', 'all', '--json', 'headRefName,number,createdAt,mergedAt,state', '--limit', '200'], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let prs = null;
  if (!r.error && r.status === 0) try { prs = JSON.parse(r.stdout); } catch {}
  if (!Array.isArray(prs)) return [`Climb: whether a job should retire is unread tonight (gh pr list --state all: ${r.error?.message ?? (r.status !== 0 ? `exit ${r.status}` : 'not a JSON list')}).`];
  return climbRetiring(prs, jobs).map(retireLine);
}

/**
 * The Budget line (phase 43): for each budgeted pass that is on, its
 * workflow's completed runs (on the default branch, but cross-review's, which
 * run on their PR's), newest first, and each run's jobs until BUDGET_RUNS
 * reached the agent step or BUDGET_EXAMINE runs were examined. A read gh cannot
 * give is that pass's n/a with why, never an empty line and never red. Null
 * with no pass on.
 */
export function readBudget(config, env = process.env) {
  const passes = budgetPasses(config);
  if (!passes.length) return null;
  if (!config.repo) return budgetLine(passes.map(p => ({ ...p, na: 'no repo in .keel/keel.json' })));
  const gh = env.KEEL_GH || 'gh';
  const api = path => {
    const r = spawnSync(gh, ['api', path], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw new Error(`gh api: ${r.error.code === 'ENOENT' ? `gh is not installed (${gh})` : r.error.message}`);
    if (r.status !== 0) throw new Error(`gh api ${path.split('?')[0]}: exit ${r.status}${(r.stderr || r.stdout || '').trim() ? `, ${(r.stderr || r.stdout).trim().split('\n')[0]}` : ''}`);
    try { return JSON.parse(r.stdout); } catch { throw new Error(`gh api ${path.split('?')[0]} did not print JSON`); }
  };
  let branch = null;
  const defaultBranch = () => {
    if (branch === null) {
      branch = api(`repos/${config.repo}`)?.default_branch;
      if (typeof branch !== 'string' || !branch) throw new Error(`gh api repos/${config.repo}: no default_branch`);
    }
    return branch;
  };
  return budgetLine(passes.map(p => {
    try {
      const list = api(`repos/${config.repo}/actions/workflows/${p.workflow}/runs?status=completed&per_page=${BUDGET_EXAMINE}${p.branch ? `&branch=${encodeURIComponent(defaultBranch())}` : ''}`)?.workflow_runs;
      if (!Array.isArray(list)) throw new Error(`gh api: the ${p.workflow} runs came back without workflow_runs`);
      const runs = [];
      let reached = 0;
      for (const run of list.slice(0, BUDGET_EXAMINE)) {
        const jobs = api(`repos/${config.repo}/actions/runs/${run.id}/jobs?per_page=100`)?.jobs;
        if (!Array.isArray(jobs)) throw new Error(`gh api: run ${run.id} came back without its jobs`);
        runs.push({ jobs });
        if (budgetUse([{ jobs }], p).used.length && ++reached === BUDGET_RUNS) break;
      }
      return { ...p, use: budgetUse(runs, p) };
    } catch (e) {
      return { ...p, na: e.message };
    }
  }));
}

export const exitCode = results => results.some(r => r.state === 'broken') ? 2 : results.some(r => r.state === 'outside') ? 1 : 0;

export function table(results) {
  const w = Math.max(...results.map(r => r.id.length));
  return results.map(r => `${r.id.padEnd(w)}  ${shown(r).padStart(5)}  ${boundOf(r).replace(' ', '')}`.padEnd(w + 16) + `${r.state.padEnd(8)} ${r.detail}`).join('\n');
}
export const strip = results => results.map(({ facts, ...r }) => ({ ...r, ...(facts && Object.keys(facts).length ? { facts } : {}) }));

/**
 * improve [--report] [--transcripts <dir>]. deps.keel: keel's instruments
 * (roadmap, diagnose, proposals) when keel runs this; without them, only
 * what the project's own files can say.
 */
export async function improve({ root, report = false, transcripts, prInput, date = today() }, { env = process.env, measures = MEASURES, keel, by = keel ? 'keel improve' : COMMAND } = {}) {
  const config = JSON.parse(await readFile(join(root, '.keel', 'keel.json'), 'utf8'));
  // Where the page goes, settled before anything is written: a bad `health` is a broken instrument.
  let dir = null;
  if (report) try { dir = healthDirIn(root, config); } catch (e) { throw new ImproveError(e.message, 2); }
  const stored = await readBounds(root);
  const results = await measure({ root, config, env, transcripts, date, bounds: stored ?? {}, measures, keel });
  const proposal = propose(results, config);
  let written = null, tightened = [], climb = null, retire = [], tend = null, budget = null;
  if (report) {
    climb = climbLine(config, await readClimbNight(root));
    retire = climbRetireLines(config, env);
    tend = tendLine(config, await readTendPass(root));
    budget = readBudget(config, env);
    const t = tighten(results, stored ?? {}, measures);
    tightened = t.tightened;
    await writeFile(join(root, BOUNDS), `${JSON.stringify(t.bounds, null, 2)}\n`);
    written = healthPage(dir, date);
    await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, written), page({ config, date, results, proposal, tightened, by, climb, retire, tend, budget }));
  }
  const code = exitCode(results);
  if (prInput) await writeFile(prInput, `${JSON.stringify(nightPr({ date, results, proposal, report: written ?? `${dir ?? HEALTH}/` }), null, 2)}\n`);
  const counts = ['ok', 'outside', 'n/a', 'broken'].map(s => `${results.filter(r => r.state === s).length} ${s}`).join(', ');
  return {
    data: { root, date, ok: code === 0, measures: strip(results), proposal, report: written, bounds: report ? BOUNDS : stored ? BOUNDS : null, tightened, climb, retire, tend, budget },
    text: [table(results), '', counts,
      ...(tightened.length ? [`Ratchet: ${tightened.map(t => `${t.id} ${t.from} → ${t.to}`).join(', ')} (${BOUNDS})`] : []),
      proposal ? `Proposal (${proposal.id}): ${proposal.text}` : 'No proposal: every measure is within its bound.',
      ...(written ? [`Wrote ${written}${report ? ` and ${BOUNDS}` : ''}.`] : [])].join('\n'),
    exitCode: code,
  };
}

/**
 * The night PR's body input (scripts/keel/pr-body.mjs): its summary's files
 * come from the commit (pr-body --files), so the picture is what was pushed.
 */
export function nightPr({ date, results, proposal, report }) {
  const gate = results.find(r => r.id === 'gate');
  const off = results.filter(r => r.state === 'outside' || r.state === 'broken');
  return {
    summary: { lead: `The night shift measured the practice on ${date}: \`${COMMAND} --report\`; the page is \`${report}\`.`, files: [] },
    evidence: {
      ...(gate ? { gate: `${gate.state}${gate.detail ? `: ${gate.detail}` : ''} (the project's check, run on this tree)` } : {}),
      columns: ['Bound', 'Tonight'],
      rows: off.map(r => ({ what: `${r.id} (${r.state})`, before: `${r.better === 'higher' ? '≥' : '≤'}${r.bound}`, after: r.value ?? '-' })),
    },
    danger: { door: 'two-way', why: 'data only (the health page, the inbox, the bounds); reverting the merge restores them.', surfaces: [], within: 'data files' },
    notes: [
      proposal ? `**Proposal (\`${proposal.id}\`, ${proposal.state}):** ${proposal.text}` : '**Proposal:** none; every measure is within its bound.',
      'scripts/keel/drain.mjs merges this PR tonight if the gate passed on this tree; otherwise the next night merges it with the series, or supersedes it if it no longer merges.',
    ],
    impact: { declaration: { version: 1, phases: [], decisions: [], supersedes: [], evidence: [], reconciliation: 'none', reason: 'Health observations and bounds only; no working record correction is applied.' } },
  };
}

// ---- the script --------------------------------------------------------------

/**
 * On keel itself, keel's instruments are in its own checkout (lib/improve.mjs),
 * so its night reads the full set; anywhere else, the project's own files.
 */
export async function instrumentsFor(root) {
  let config = {};
  try { config = JSON.parse(await readFile(join(root, '.keel', 'keel.json'), 'utf8')); } catch { return undefined; }
  if (config.keel !== 'self') return undefined;
  const lib = join(root, 'lib', 'improve.mjs');
  return await exists(lib) ? (await import(pathToFileURL(lib).href)).instruments : undefined;
}

export function parseArgs(args) {
  const flags = ['--report'], valued = { '--transcripts': 'transcripts', '--pr-input': 'prInput' };
  const out = { report: args.includes('--report') };
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i])) continue;
    if (Object.hasOwn(valued, args[i])) {
      if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new ImproveError(`${args[i]} needs a value`, 2);
      out[valued[args[i]]] = resolve(args[++i]);
      continue;
    }
    throw new ImproveError(`unexpected argument: ${args[i]}; usage: ${COMMAND} [--report] [--transcripts <dir>] [--pr-input <file>] [--json]`, 2);
  }
  return out;
}

if (isMain(import.meta)) {
  await main(async args => {
    const root = rootOf(import.meta);
    const opts = parseArgs(args);
    const keel = await instrumentsFor(root);
    return improve({ root, ...opts }, { keel, by: COMMAND });
  });
}
