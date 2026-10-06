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
// (a directory that ignores itself: it holds a .gitignore of `*`), keeps the
// newest KEEP runs, and yields one thing to stdout, at the end: the hygiene
// block. A clean run is one line. It never changes the other reporter's
// output, and whatever goes wrong here is a line, never a throw. It changes
// the run's exit code in one case only: a run that executed no test (none
// passed or failed; a file with no test in it is reported as the file, and
// is not a test) exits 1, "no tests ran" — a gate that ran nothing would
// pass anything (keel's lessons 14 and 38). A project with no tests yet
// says so in .keel/keel.json: "tests": { "allowEmpty": true }.
//
// A record: { commit, tree, dirty, machine: { os, arch, cpus }, node, date,
// tests: [{ file, name, outcome, ms }] } for each top-level test.
//
// The analysis is here too, so the reporter and the night's improve.mjs
// (flaky_tests, slow_tests, proofs_hold) read history one way:
//   flaky   a test that both passed and failed on the same clean tree, among
//           the newest `window` runs. A fact, no threshold.
//   slower  a passing test whose time is above factor × the median of its
//           last `window` passing runs on the same machine class, AND more
//           than floorMs above it, so noise on a fast test is not news.
// window 20, factor 2, floorMs 200; .keel/keel.json "tests" overrides each
// (and "allowEmpty", above).
//
// Adapted ideas, not code: isocan's test profile and shard weights, and
// nerd's pass history (docs/research/2026-10-06-spec-rigor.md).
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';
import { platform, arch, availableParallelism } from 'node:os';

export const RUNS = '.keel/test-runs';
/** Runs kept on disk; older ones are pruned. */
export const KEEP = 50;
export const DEFAULTS = Object.freeze({ window: 20, factor: 2, floorMs: 200 });
export const LABEL = 'keel test ledger';

// ---- config ------------------------------------------------------------------

/** What is wrong with .keel/keel.json "tests": [string]. */
export function testsConfigProblems(config) {
  const t = config?.tests;
  if (t === undefined) return [];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['"tests" must be an object of window, factor, floorMs'];
  const out = [];
  for (const k of Object.keys(t)) if (!Object.hasOwn(DEFAULTS, k) && k !== 'allowEmpty') out.push(`"tests" has an unknown key ${k} (window, factor, floorMs, allowEmpty)`);
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

/** A machine's class: what makes two durations comparable. */
export const machineClass = m => m ? `${m.os}-${m.arch}-${m.cpus}cpu` : 'unknown';
const key = t => `${t.file ?? ''}\u0000${t.name}`;
const median = xs => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/**
 * Flaky: a test with both a pass and a fail on one clean tree. A dirty tree,
 * or a mix across different trees, is not flaky: the code moved.
 * [{ file, name, tree, passed, failed, runs }]
 */
export function flaky(runs) {
  const seen = new Map();
  for (const r of runs) {
    if (r.dirty !== false || !r.tree) continue;
    for (const t of r.tests ?? []) {
      if (!['pass', 'fail'].includes(t.outcome)) continue;
      const k = `${r.tree}\u0000${key(t)}`;
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
  const before = runs.filter(r => r !== current && r.date <= current.date && machineClass(r.machine) === machine);
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

/** The newest run that ran `file`, and its tests whose name is or contains `name` (a phase's cited test). */
export function lastOutcome(runs, file, name) {
  const want = String(name).toLowerCase();
  for (let i = runs.length - 1; i >= 0; i--) {
    const inFile = (runs[i].tests ?? []).filter(t => t.file === file);
    if (!inFile.length) continue;
    const matched = inFile.filter(t => t.name.toLowerCase() === want || t.name.toLowerCase().includes(want));
    return { run: runs[i].id ?? runs[i].date, date: runs[i].date, matched };
  }
  return null;
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

/** Where this run happened: commit, tree, dirty (the ledger's own directory aside), machine, node. */
export function where(cwd = process.cwd()) {
  const commit = gitOut(cwd, ['rev-parse', 'HEAD'])?.trim() || null;
  const tree = commit ? gitOut(cwd, ['rev-parse', 'HEAD^{tree}'])?.trim() || null : null;
  const status = commit ? gitOut(cwd, ['status', '--porcelain', '--', '.', `:(exclude)${RUNS}`]) : null;
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

/** The reporter: records each top-level test, then yields the hygiene block; a run that executed no test fails. */
export default async function* ledger(source) {
  const root = process.cwd();
  const tests = [];
  let ran = 0;
  for await (const e of source) {
    if ((e.type !== 'test:pass' && e.type !== 'test:fail') || e.data?.nesting !== 0) continue;
    const d = e.data;
    const outcome = d.skip !== undefined && d.skip !== false ? 'skip' : d.todo !== undefined && d.todo !== false ? 'todo' : e.type === 'test:pass' ? 'pass' : 'fail';
    if ((outcome === 'pass' || outcome === 'fail') && !fileOwn(root, d)) ran++;
    tests.push({
      file: d.file ? relative(root, d.file).split(sep).join('/') : null,
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
    const run = { ...where(root), date: new Date().toISOString(), tests };
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
