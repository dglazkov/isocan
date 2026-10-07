// keel's test ledger (keel practice `night`; managed: keel render rewrites
// it). Every test run is remembered, and a flaky or slower test becomes
// hygiene work (keel phase 33; docs/research/2026-10-06-spec-rigor.md, lever 2).
//
// A node test reporter, used as a SECOND reporter beside the usual one:
//
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//     --test-reporter=./scripts/keel/test-ledger.mjs --test-reporter-destination=stdout …
//
// It writes the run's record itself, to .keel/test-runs/<iso-time>-<pid>.json
// at the REPO's root (git's top level, so a workspace or app folder's own
// `node --test`, run from web/ say, lands beside the root's runs; outside git,
// the working directory), a directory that ignores itself (it holds a
// .gitignore of `*`), and keeps the
// newest KEEP runs, and yields one thing to stdout, at the end: the hygiene
// block. A clean run is one line. It never changes the other reporter's
// output, and whatever goes wrong here is a line, never a throw. It changes
// the run's exit code in one case only: a run that executed no test (none
// passed or failed; a file with no test in it is reported as the file, and
// is not a test; a describe() is a suite, and only a test inside it counts)
// exits 1, "no tests ran" — a gate that ran nothing would
// pass anything (keel's lessons 14 and 38). A project with no tests yet
// says so in .keel/keel.json: "tests": { "allowEmpty": true }.
//
// A record: { commit, tree, dirty, machine: { os, arch, cpus }, node, config,
// filtered?, date, tests: [{ file, name, outcome, ms }] } for each top-level
// test. `dirty` ignores git-ignored files and keel's machine directories
// (.keel/test-runs, .keel/climb, .keel/tend: the night writes or gathers them).
// `config` is a short stable hash of what makes two runs of one tree differ
// on purpose: NODE_OPTIONS, the run's preloads (--import, --require), and each
// variable .keel/keel.json names in "tests": { "configEnv": [..] }. `filtered`
// is true when the run was narrowed (--test-name-pattern, --test-skip-pattern,
// --test-only): a test absent from it was not run, not renamed. `workflow`
// is the GitHub Actions workflow that ran it (none outside Actions), so the
// night can tell its own runs from CI's.
//
// The analysis is here too, so the reporter and the night's improve.mjs
// (flaky_tests, slow_tests, proofs_hold) read history one way:
//   flaky   a test that both passed and failed on the same clean tree under
//           the same config, among the newest `window` runs. A fact, no threshold.
//   slower  a passing test whose time is above factor × the median of its
//           last `window` passing runs on the same machine class and config,
//           AND more than floorMs above it, so noise on a fast test is not news.
// window 20, factor 2, floorMs 200; .keel/keel.json "tests" overrides each
// (and "allowEmpty", above, and "configEnv").
//
// Adapted ideas, not code: isocan's test profile and shard weights, and
// nerd's pass history (docs/research/2026-10-06-spec-rigor.md).
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';
import { platform, arch, availableParallelism } from 'node:os';

export const RUNS = '.keel/test-runs';
/** Runs kept on disk; older ones are pruned. */
export const KEEP = 50;
export const DEFAULTS = Object.freeze({ window: 20, factor: 2, floorMs: 200 });
export const LABEL = 'keel test ledger';
/** keel's machine directories: the night writes or gathers them, so they never make a tree dirty. */
export const MACHINE_DIRS = Object.freeze([RUNS, '.keel/climb', '.keel/tend']);

// ---- config ------------------------------------------------------------------

/** What is wrong with .keel/keel.json "tests": [string]. */
export function testsConfigProblems(config) {
  const t = config?.tests;
  if (t === undefined) return [];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['"tests" must be an object of window, factor, floorMs'];
  const out = [];
  for (const k of Object.keys(t)) if (!Object.hasOwn(DEFAULTS, k) && k !== 'allowEmpty' && k !== 'configEnv') out.push(`"tests" has an unknown key ${k} (window, factor, floorMs, allowEmpty, configEnv)`);
  if (t.configEnv !== undefined && !(Array.isArray(t.configEnv) && t.configEnv.every(v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))) out.push('"tests".configEnv must be a list of environment variable names');
  if (t.allowEmpty !== undefined && typeof t.allowEmpty !== 'boolean') out.push('"tests".allowEmpty must be true or false');
  if (t.window !== undefined && !(Number.isInteger(t.window) && t.window >= 2)) out.push('"tests".window must be a whole number of runs, 2 or more');
  if (t.factor !== undefined && !(Number.isFinite(t.factor) && t.factor > 1)) out.push('"tests".factor must be a number above 1');
  if (t.floorMs !== undefined && !(Number.isFinite(t.floorMs) && t.floorMs >= 0)) out.push('"tests".floorMs must be a number of milliseconds, 0 or more');
  return out;
}

/** The ledger's settings for this project; throws on a bad "tests". */
export function testsConfigOf(config) {
  const problems = testsConfigProblems(config);
  if (problems.length) throw new Error(`.keel/keel.json: ${problems.join('; ')}`);
  return { ...DEFAULTS, ...(config?.tests ?? {}) };
}

// ---- history -----------------------------------------------------------------

const isRun = r => r && typeof r === 'object' && typeof r.date === 'string' && Array.isArray(r.tests);

/** Every recorded run under root, oldest first: { runs, skipped }. No directory: no runs. */
export async function readRuns(root, dir = RUNS) {
  let names;
  try { names = (await readdir(join(root, dir))).filter(n => n.endsWith('.json')); }
  catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) return { runs: [], skipped: 0 }; throw e; }
  const runs = [];
  let skipped = 0;
  for (const name of names) {
    try {
      const r = JSON.parse(await readFile(join(root, dir, name), 'utf8'));
      if (isRun(r)) runs.push({ ...r, id: name.slice(0, -5) }); else skipped++;
    } catch { skipped++; }
  }
  runs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { runs, skipped };
}

/** The workflows that are keel's own nights; a history of only their runs means CI keeps none. */
export const NIGHT_WORKFLOWS = Object.freeze(['keel-night', 'keel-climb']);
/** True when every run came from a keel night: no CI (or local) run was read. */
export const nightOnly = runs => runs.length > 0 && runs.every(r => NIGHT_WORKFLOWS.includes(r.workflow));
export const NIGHT_ONLY = 'nightly runs only: CI does not upload keel-test-runs';

/** A machine's class: what makes two durations comparable. */
export const machineClass = m => m ? `${m.os}-${m.arch}-${m.cpus}cpu` : 'unknown';
const key = t => `${t.file ?? ''}\u0000${t.name}`;
/** A run's config identity; a record from before configs is its own (null) class. */
const configOf = r => r?.config ?? null;
const median = xs => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/**
 * Flaky: a test with both a pass and a fail on one clean tree under one
 * config. A dirty tree, or a mix across different trees, is not flaky: the
 * code moved. A mix across configs is not either: the setting moved.
 * [{ file, name, tree, passed, failed, runs }]
 */
export function flaky(runs) {
  const seen = new Map();
  for (const r of runs) {
    if (r.dirty !== false || !r.tree) continue;
    for (const t of r.tests ?? []) {
      if (!['pass', 'fail'].includes(t.outcome)) continue;
      const k = `${r.tree}\u0000${configOf(r)}\u0000${key(t)}`;
      const s = seen.get(k) ?? { file: t.file ?? null, name: t.name, tree: r.tree, passed: 0, failed: 0 };
      s[t.outcome === 'pass' ? 'passed' : 'failed']++;
      seen.set(k, s);
    }
  }
  return [...seen.values()].filter(s => s.passed && s.failed).map(s => ({ ...s, runs: runs.length }))
    .sort((a, b) => b.failed - a.failed || String(a.file).localeCompare(String(b.file)) || a.name.localeCompare(b.name));
}

/**
 * Slower: in `current` (default the newest run), each passing test above
 * factor × the median of its last `window` passing runs before it on the
 * same machine class, and more than floorMs above that median. A test with
 * fewer than `window` such runs is not judged yet.
 * [{ file, name, ms, median, over, window, machine }]
 */
export function slower(runs, { window = DEFAULTS.window, factor = DEFAULTS.factor, floorMs = DEFAULTS.floorMs } = {}, current = runs.at(-1)) {
  if (!current) return [];
  const machine = machineClass(current.machine);
  const before = runs.filter(r => r !== current && r.date <= current.date && machineClass(r.machine) === machine && configOf(r) === configOf(current));
  const out = [];
  for (const t of current.tests ?? []) {
    if (t.outcome !== 'pass' || !Number.isFinite(t.ms)) continue;
    const past = [];
    for (let i = before.length - 1; i >= 0 && past.length < window; i--) {
      const p = before[i].tests?.find(x => key(x) === key(t));
      if (p?.outcome === 'pass' && Number.isFinite(p.ms)) past.push(p.ms);
    }
    if (past.length < window) continue;
    const m = median(past);
    if (t.ms > factor * m && t.ms - m > floorMs) out.push({ file: t.file ?? null, name: t.name, ms: t.ms, median: Math.round(m), over: Math.round(t.ms - m), window, machine });
  }
  return out.sort((a, b) => b.over - a.over);
}

/**
 * A phase's cited test (`name` is the test's name or a part of it) in `file`:
 * the newest run where it passed or failed, and those outcomes. A run where it
 * was only skipped or todo, or absent from a narrowed run (a targeted
 * --test-name-pattern run), says nothing about it and is passed over. Absent
 * from a full run of the file is `matched: []` (renamed or gone: proof lost);
 * only ever skipped is those skips. No run of it at all: null.
 */
export function lastOutcome(runs, file, name) {
  const want = String(name).toLowerCase();
  let fallback = null;
  for (let i = runs.length - 1; i >= 0; i--) {
    const inFile = (runs[i].tests ?? []).filter(t => t.file === file);
    if (!inFile.length) continue;
    const matched = inFile.filter(t => t.name.toLowerCase() === want || t.name.toLowerCase().includes(want));
    const at = { run: runs[i].id ?? runs[i].date, date: runs[i].date };
    const decided = matched.filter(t => t.outcome === 'pass' || t.outcome === 'fail');
    if (decided.length) return { ...at, matched: decided };
    if (!matched.length && !runs[i].filtered) return fallback ?? { ...at, matched };
    if (matched.length) fallback ??= { ...at, matched };
  }
  return fallback;
}

// ---- the hygiene block -------------------------------------------------------

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;

/** The command that runs one test alone, with the run's own --import/--require (keel's hermetic helper, say). */
export function aloneCommand(test, preload = []) {
  const pattern = `^${test.name.replace(RE_SPECIAL, '\\$&')}$`;
  return ['node', ...preload, '--test', `--test-name-pattern=${quote(pattern)}`, test.file ?? ''].filter(Boolean).join(' ');
}

/** The run's preload flags (--import x, --require x), so a test runs alone as it ran here. */
export function preloads(execArgv = process.execArgv) {
  const out = [];
  for (let i = 0; i < execArgv.length; i++) {
    const a = execArgv[i];
    if (/^--(import|require|loader|experimental-loader)=/.test(a)) out.push(a);
    else if (['--import', '--require', '-r', '--loader', '--experimental-loader'].includes(a) && execArgv[i + 1] !== undefined) out.push(a, execArgv[++i]);
  }
  return out;
}

const shortTree = t => String(t ?? '').slice(0, 7);
const named = t => `${t.file ?? '(no file)'} "${t.name}"`;

/** The block printed at the end of a run: [line]. One line when clean. */
export function hygiene(runs, opts = DEFAULTS, { preload = [], skipped = 0 } = {}) {
  const recent = runs.slice(-opts.window);
  const f = flaky(recent), s = slower(runs, opts);
  const of = `${runs.length} run${runs.length === 1 ? '' : 's'} in ${RUNS}${skipped ? `, ${skipped} unreadable` : ''}`;
  if (!f.length && !s.length) return [`${LABEL}: no flaky or slower test (${of}).`];
  const items = f.length + s.length;
  return [
    `${LABEL}: ${items} hygiene item${items === 1 ? '' : 's'} (${of}). Each is work: fix it or file it; never rerun until green.`,
    ...f.flatMap(t => [
      `  flaky   ${named(t)}: passed ${t.passed}, failed ${t.failed} on one clean tree (${shortTree(t.tree)}) in the last ${recent.length} runs`,
      `          ${aloneCommand(t, preload)}`,
    ]),
    ...s.flatMap(t => [
      `  slower  ${named(t)}: ${Math.round(t.ms)} ms against a median of ${t.median} ms over its last ${t.window} passing runs (${t.machine}), +${t.over} ms`,
      `          ${aloneCommand(t, preload)}`,
    ]),
  ];
}

// ---- recording ---------------------------------------------------------------

function gitOut(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

/** The repo's root (git's top level), so every package's runs land in one ledger; outside git, `cwd`. */
export function rootOf(cwd = process.cwd()) {
  return gitOut(cwd, ['rev-parse', '--show-toplevel'])?.trim() || cwd;
}

/**
 * Where this run happened: commit, tree, dirty, machine, node. Dirty reads
 * the whole repo (from its top), git-ignored files aside (porcelain never
 * lists them) and keel's machine directories aside.
 */
export function where(cwd = process.cwd()) {
  const commit = gitOut(cwd, ['rev-parse', 'HEAD'])?.trim() || null;
  const tree = commit ? gitOut(cwd, ['rev-parse', 'HEAD^{tree}'])?.trim() || null : null;
  const status = commit ? gitOut(cwd, ['status', '--porcelain', '--', ':/', ...MACHINE_DIRS.map(d => `:(top,exclude)${d}`)]) : null;
  return {
    commit, tree, dirty: status === null ? null : status.trim() !== '',
    machine: { os: platform(), arch: arch(), cpus: availableParallelism() },
    node: process.version,
  };
}

/** Write one run, keep the newest `keep`, and make the directory ignore itself. Returns the file name. */
export async function record(root, run, { keep = KEEP } = {}) {
  const dir = join(root, RUNS);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '.gitignore'), '*\n');
  const name = `${run.date.replaceAll(':', '-').replace('.', '-')}-${process.pid}.json`;
  await writeFile(join(dir, name), `${JSON.stringify(run)}\n`);
  const names = (await readdir(dir)).filter(n => n.endsWith('.json')).sort();
  for (const old of names.slice(0, Math.max(0, names.length - keep))) await rm(join(dir, old), { force: true });
  return name;
}

async function projectConfig(root) {
  try { return JSON.parse(await readFile(join(root, '.keel', 'keel.json'), 'utf8')); } catch { return {}; }
}

/**
 * The run's config identity: a short stable hash of NODE_OPTIONS, the run's
 * preloads, and each variable named in "tests".configEnv (absent and empty
 * differ). Two runs under different configs never make a test flaky or slower.
 */
export function configHash({ env = process.env, preload = preloads(), configEnv = [] } = {}) {
  const names = [...new Set(['NODE_OPTIONS', ...configEnv])].sort();
  const vars = Object.fromEntries(names.map(n => [n, env[n] ?? null]));
  return createHash('sha256').update(JSON.stringify({ vars, preload })).digest('hex').slice(0, 12);
}

/** Whether a run was narrowed to some of its tests (node's execArgv). */
export const narrowed = (execArgv = process.execArgv) => execArgv.some(a => /^--test-(name-pattern|skip-pattern|only)(=|$)/.test(a));

/** A path with its links resolved (git's top level is resolved; a test file's path may not be). */
const real = p => { try { return realpathSync(p); } catch { return p; } };

/** A top-level entry that is a test file's own (node reports a file with no test in it as the file), not a test. */
export const fileOwn = (root, d) => Boolean(d?.file) && resolve(root, String(d.name)) === d.file;

export const NO_TESTS = `${LABEL}: no tests ran. A gate that ran nothing passes anything, so this run fails. Add a test, or say there are none yet with "tests": { "allowEmpty": true } in .keel/keel.json.`;

/**
 * The zero-tests gate: the line to say and whether the run fails, for a run
 * that executed `ran` tests. allowEmpty is read as written, even beside a bad
 * window or factor, so a typo elsewhere never turns the gate on or off.
 */
export function emptyRun(ran, config) {
  if (ran > 0 || config?.tests?.allowEmpty === true) return null;
  return NO_TESTS;
}

/** An event's outcome: skip, todo, pass or fail. */
const outcomeOf = e => {
  const d = e.data;
  return d.skip !== undefined && d.skip !== false ? 'skip' : d.todo !== undefined && d.todo !== false ? 'todo' : e.type === 'test:pass' ? 'pass' : 'fail';
};

/** Whether an event is a test that executed: a test (never a suite: an empty describe() runs nothing), passed or failed, not a file's own entry. */
export const executed = (cwd, e) => (e.type === 'test:pass' || e.type === 'test:fail') && e.data?.details?.type === 'test'
  && ['pass', 'fail'].includes(outcomeOf(e)) && !fileOwn(cwd, e.data);

/** The reporter: records each top-level test, then yields the hygiene block; a run that executed no test fails. */
export default async function* ledger(source) {
  const cwd = process.cwd();
  const root = rootOf(cwd);
  const tests = [];
  let ran = 0;
  for await (const e of source) {
    if (executed(cwd, e)) ran++;
    if ((e.type !== 'test:pass' && e.type !== 'test:fail') || e.data?.nesting !== 0) continue;
    const d = e.data;
    const outcome = outcomeOf(e);
    tests.push({
      file: d.file ? relative(root, real(d.file)).split(sep).join('/') : null,
      name: String(d.name),
      outcome,
      ms: Math.round((d.details?.duration_ms ?? 0) * 10) / 10,
    });
  }
  const config = await projectConfig(root);
  const empty = emptyRun(ran, config);
  if (empty && !process.exitCode) process.exitCode = 1;
  if (!tests.length) { if (empty) yield `${empty}\n`; return; } // nothing reported: nothing to remember
  try {
    const configEnv = Array.isArray(config?.tests?.configEnv) ? config.tests.configEnv.filter(v => typeof v === 'string') : [];
    const workflow = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW ? { workflow: process.env.GITHUB_WORKFLOW } : {};
    const run = { ...where(root), config: configHash({ configEnv }), ...(narrowed() ? { filtered: true } : {}), ...workflow, date: new Date().toISOString(), tests };
    await record(root, run);
    let opts;
    try { opts = testsConfigOf(config); }
    catch (e) { yield `${LABEL}: recorded; not judged: ${e.message}\n`; return; }
    const { runs, skipped } = await readRuns(root);
    yield `${hygiene(runs, opts, { preload: preloads(), skipped }).join('\n')}\n`;
  } catch (e) {
    yield `${LABEL}: could not record this run (${String(e?.message ?? e).split('\n')[0]}).\n`;
  } finally {
    if (empty) yield `${empty}\n`;
  }
}
