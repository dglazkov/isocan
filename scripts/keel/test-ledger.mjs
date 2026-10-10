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
// newest runs of each lane (a suite's folder and config: KEEP, or the window
// and ten more when that is larger, reserved first; TOTAL in all prunes only
// the rest), and yields one thing to stdout, at the end: the hygiene
// block. A clean run is one line. It never changes the other reporter's
// output, and whatever goes wrong here is a line, never a throw. It changes
// the run's exit code in one case only: a run that executed no test (none
// passed or failed; a file with no test in it is reported as the file, and
// is not a test; a describe() is a suite, and only a test inside it counts)
// exits 1, "no tests ran" — a gate that ran nothing would
// pass anything (keel's lessons 14 and 38). A project with no tests yet
// says so in .keel/keel.json: "tests": { "allowEmpty": true }. And a file
// pinned to stalls ("tests": { "stalls": ["tests/acme.test.mjs"] }) runs
// again, paused at random moments (./stalls.mjs, keel phase 55), once its own
// run in the suite is over, while the rest goes on; a failure there fails the
// run and prints the seed that replays it, and so does an entry that pins
// nothing. A narrowed run never does this.
//
// A record: { commit, tree, dirty, machine: { os, arch, cpus }, node, dir,
// config, setting: { env, preload }, flags, filtered?, date, busy, wallMs, tests: [{ file, name,
// outcome, ms, inconclusive?, error? }] } for each top-level test. `flags` are the
// node flags a rerun of the suite carries (preloads, conditions, setup; not
// in the config hash, so lanes stay as they were). An outcome is pass,
// fail, skip, todo, or inconclusive: a passing test that said
// t.diagnostic('keel:inconclusive <what it measured>') judges real time on
// purpose and the machine kept it from judging; it is neither pass nor fail,
// so it is never flaky, never slower, and never a proof. `dir` is the folder `node --test`
// ran in, relative to the repo's root ('.' at the root); a test's `file` is
// root-relative wherever it ran. `dirty` ignores git-ignored files and keel's machine directories
// (.keel/test-runs, .keel/climb, .keel/tend: the night writes or gathers them).
// `config` is a short stable hash of what makes two runs of one tree differ
// on purpose: NODE_OPTIONS, the run's preloads (--import, --require), and each
// variable .keel/keel.json names in "tests": { "configEnv": [..] }; `setting`
// is what it hashes, never a configEnv value (records are uploaded): each
// configEnv variable as { name, set, hash } (a short sha256 of its value),
// NODE_OPTIONS's value (null when unset; hashed the same way when it looks
// secret: token=, secret=, key=, password=), and the preloads, so a finding's
// run-alone command reproduces it (a set variable as
// NAME="${NAME:?set NAME as it was in the run}", an unset one as env -u NAME). `filtered`
// is true when the run was narrowed (--test-name-pattern, --test-skip-pattern,
// --test-only): a test absent from it was not run, not renamed. `workflow`
// is the GitHub Actions workflow that ran it (none outside Actions), so the
// night can tell its own runs from CI's.
//
// bun test and vitest (keel phase 59) write JUnit XML instead, and the
// ledger reads it after the run, as its own command in the gate:
//
//   keel_status=0; rm -f .keel/test-runs/junit.xml; mkdir -p .keel/test-runs && \
//     bun test --reporter=junit --reporter-outfile=.keel/test-runs/junit.xml || keel_status=$?; \
//     node scripts/keel/test-ledger.mjs --junit .keel/test-runs/junit.xml --runner bun --status $keel_status
//
// (vitest: --reporter=default --reporter=junit --outputFile.junit=<file>.)
// The runner's exit code is kept by `|| keel_status=$?`, so a shell under
// set -e (GitHub's bash -e) still reaches the ledger after a red run, and the
// old file is removed first, so a run that writes none is "no tests ran".
// The record is a node run's, plus `runner` ("bun" or "vitest"; a record
// without one is node's), and `junit`, a short hash of the file's path and
// bytes: the same bytes at the same path again are stale (the runner wrote
// nothing new, as bun does when no test ran) and are not recorded again;
// two packages' identical reports at their own paths are two runs. `node` is the
// version of node that read it; the preloads are none. Each top-level test
// is the file's own testcase, or one top-level describe() with every
// testcase in it (failed if any failed): bun names a testcase's describes in
// its classname, innermost first, escaped twice; vitest in its name,
// outermost first, joined by " > "; a nested <testsuite> is a describe too.
// "No tests ran" is the same rule (a missing file, or one with no testcase
// that passed or failed, is a run of nothing; vitest's testcase for a file
// that would not load is the file's, not a test). The exit code: 1 when no
// tests ran (unless allowEmpty), else --status (the runner's own exit code,
// $?: bun leaves a file that would not load out of its JUnit), else 1 when a
// testcase failed. A file that is not JUnit is 1, never recorded. The runner
// is part of the config hash and the lane, so runs of two runners are never
// compared. .keel/keel.json "tests": { "runner", "junit" } names the runner
// and the file (default .keel/test-runs/junit.xml); the flags win, but a
// runner that contradicts the one the file names is refused (exit 1). A
// describe is recorded with `describe: true`, so its run-alone filter is a
// prefix of its tests' names, and a test's is its whole name.
//
// The analysis is here too, so the reporter and the night's improve.mjs
// (flaky_tests, slow_tests, proofs_hold) read history one way:
//   flaky   a test that both passed and failed on the same clean tree in
//           the same lane (suite folder and config), among the newest `window` runs. A fact, no threshold.
//   slower  a passing test whose time is above factor × the median of its
//           last `window` passing runs on the same machine class and lane,
//           AND more than floorMs above it, so noise on a fast test is not news.
// window 20, factor 2, floorMs 200; .keel/keel.json "tests" overrides each
// (and "allowEmpty", above, "configEnv" and "stalls").
//
// Adapted ideas, not code: isocan's test profile and shard weights, and
// nerd's pass history (docs/research/2026-10-06-spec-rigor.md).
import { readFile, readdir, writeFile, mkdir, rm, rename, stat } from 'node:fs/promises';
import { realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { join, relative, resolve, sep, posix, isAbsolute } from 'node:path';
import { platform, arch, availableParallelism, loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { digest, nodePlan, suiteCollector, readReceiptPlan, stallsEvidence, isStallsReceipt } from './time-receipts.mjs';
import { stripVTControlCharacters } from 'node:util';

export const RUNS = '.keel/test-runs';
/** Runs kept on disk per lane (a suite's folder and config), at least; older ones are pruned. */
export const KEEP = 50;
/** Runs kept on disk in all, whatever the lanes: a safety bound. */
export const TOTAL = 4000;
export const RETENTION = Object.freeze({ weeks: 8, quietPerWeek: 20, otherPerWeek: 5, lanes: 16, records: 4000, bytes: 256 * 1024 * 1024 });
/** The largest window: the total grows with lanes × (window + 10), so it is bounded. */
export const MAX_WINDOW = 200;
export const DEFAULTS = Object.freeze({ window: 20, factor: 2, floorMs: 200 });
export const LABEL = 'keel test ledger';
/** keel's machine directories: the night writes or gathers them, so they never make a tree dirty. */
export const MACHINE_DIRS = Object.freeze([RUNS, '.keel/climb', '.keel/tend']);
/** The test runners the ledger reads: node's own reporter, and bun's and vitest's JUnit. */
export const RUNNERS = Object.freeze(['node', 'bun', 'vitest']);
/** Where a JUnit file is written and read by default: in the ledger's own directory, which ignores itself. */
export const JUNIT = `${RUNS}/junit.xml`;
const OTHER_KEYS = ['allowEmpty', 'configEnv', 'runner', 'junit', 'stalls'];
/** A "tests".junit keel accepts: a .xml file directly in the ledger's directory, a name a shell reads as it is. */
export const JUNIT_PATH = /^\.keel\/test-runs\/[A-Za-z0-9_][A-Za-z0-9_.-]*\.xml$/;

// ---- a run's node flags --------------------------------------------------------

/** A shell line's words: quotes ('…', "…") and backslashes read as the shell reads them, never run. */
export function shellWords(line) {
  const words = [];
  let word = null, quote = null;
  for (let i = 0; i < String(line ?? '').length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += c;
    } else if (c === "'" || c === '"') { quote = c; word ??= ''; }
    else if (c === '\\' && i + 1 < line.length) word = (word ?? '') + line[++i];
    else if (/\s/.test(c)) { if (word !== null) words.push(word); word = null; }
    else word = (word ?? '') + c;
  }
  if (word !== null) words.push(word);
  return words;
}

/** Node flags that take the next word as their value when written without `=`. */
const VALUED = new Set(['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C', '--env-file', '--env-file-if-exists',
  '--input-type', '--test-global-setup', '--test-isolation', '--test-concurrency', '--test-coverage-include', '--test-coverage-exclude',
  '--test-reporter', '--test-reporter-destination', '--test-name-pattern', '--test-skip-pattern', '--test-timeout', '--test-shard', '--watch-path']);
/**
 * The run's own: which files, which tests, what it reports, and its time limit (paused time must not count);
 * and what writes the project's own files (--test-update-snapshots): a rerun to judge never rewrites them.
 */
const DROPPED = new Set(['--test', '--test-reporter', '--test-reporter-destination', '--test-name-pattern', '--test-skip-pattern', '--test-only',
  '--test-timeout', '--test-shard', '--watch', '--watch-path', '--test-update-snapshots']);
export const PRELOADS = new Set(['--import', '--require', '-r', '--loader', '--experimental-loader']);

/**
 * The node flags in a list of words ({ name, words }), as written: `--import
 * x` is two words, `--import=x` one, the form node's execArgv has. A flag
 * not known to take a value is taken as one without (write `--flag=value`).
 * Words that are not flags (files, folders) are left out.
 */
export function flagsIn(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '--') break;
    if (!w.startsWith('-') || w === '-') continue;
    const eq = w.indexOf('=');
    const name = eq > 0 ? w.slice(0, eq) : w;
    out.push({ name, words: eq < 0 && VALUED.has(name) && i + 1 < words.length ? [w, words[++i]] : [w] });
  }
  return out;
}

/** The node flags a run of the suite carries over to a stalled one: all but the run's own (files, names, reporters, time limit). */
export const runnerFlags = words => flagsIn(words).filter(f => !DROPPED.has(f.name)).flatMap(f => f.words);

// ---- machine context and failure memory --------------------------------------

/** Linux PSI totals are microseconds of contention, not CPU utilization. */
export function pressureOf(text) {
  const out = {};
  for (const line of text.trim().split('\n')) {
    const [kind, ...fields] = line.split(/\s+/);
    if (!['some', 'full'].includes(kind)) continue;
    const values = Object.fromEntries(fields.map(f => f.split('=' )).map(([k, v]) => [k, Number(v)]));
    if (Number.isFinite(values.total)) out[kind] = values;
  }
  return Object.keys(out).length ? out : null;
}
export async function busySample({ os = platform(), load = loadavg, cores = availableParallelism, read = readFile } = {}) {
  let pressure = null;
  if (os === 'linux') {
    try { pressure = pressureOf(await read('/proc/pressure/cpu', 'utf8')); } catch { /* explicitly unavailable */ }
  }
  return { at: new Date().toISOString(), load: os === 'win32' ? null : load(), cores: cores(), pressure,
    ...(os === 'win32' ? { loadUnavailable: 'load average unsupported on win32' } : {}),
    pressureSource: pressure ? '/proc/pressure/cpu' : null };
}
export function busyBetween(start, end) {
  const delta = start?.pressure && end?.pressure && start.pressureSource === end.pressureSource
    ? Object.fromEntries(Object.keys(end.pressure).filter(k => start.pressure[k] && end.pressure[k].total >= start.pressure[k].total)
      .map(k => [k, end.pressure[k].total - start.pressure[k].total])) : null;
  return { start, end, pressureUs: delta, unavailable: !start ? 'run start was not captured; pass a runner-local start sample' : null };
}
export function busyState(run) {
  const samples = [run.busy?.start, run.busy?.end];
  if (samples.some(s => Number.isFinite(s?.load?.[0]) && s?.cores > 0 && s.load[0] > s.cores)) return 'busy';
  return samples.every(s => Number.isFinite(s?.load?.[0]) && s?.cores > 0) ? 'quiet' : 'unknown';
}
export function busyCoverage(runs) {
  return { omitted: runs.filter(r => busyState(r) === 'busy').length, unknown: runs.filter(r => busyState(r) === 'unknown').length };
}
export const busyNote = runs => { const c = busyCoverage(runs); return `; ${c.omitted} busy runs omitted; ${c.unknown} runs with unavailable load context (not known quiet)`; };

/** Redact complete assignment values, consuming escaped quotes/backslashes as
 * part of a quoted token. An unfinished quote consumes the remainder, including
 * newlines: a malformed diagnostic must not expose the rest of a credential. */
function assignmentSpans(text) {
  const keys = /([\w-]*(?:token|secret|password|credential|api[_-]?key|key)[\w-]*|authorization)["']?\s*[:=]\s*/gi;
  const spans = [];
  let match;
  while ((match = keys.exec(text))) {
    const start = keys.lastIndex, quote = text[start];
    let end = start;
    if (quote === '"' || quote === "'") {
      end++;
      while (end < text.length) {
        if (text[end] === '\\') { end = Math.min(end + 2, text.length); continue; }
        if (text[end++] === quote) break;
      }
    } else {
      const token = (match[1].toLowerCase() === 'authorization'
        ? /^[^\r\n]+/ : /^[^\s,;]+/).exec(text.slice(start));
      if (!token) continue;
      end += token[0].length;
    }
    spans.push([start, end]);
    keys.lastIndex = end;
  }
  return spans;
}

/** First eight lines, at most 1 KiB, redacted before truncation (including configured secrets). */
export function failureText(value, env = process.env, { configEnv = [] } = {}) {
  let text = stripVTControlCharacters(String(value ?? ''));
  const configured = new Set(configEnv);
  const secrets = [...new Set(Object.entries(env)
    .filter(([name, secret]) => secret && (configured.has(name) || /token|secret|password|credential|api.?key/i.test(name)))
    .flatMap(([, secret]) => {
      const raw = String(secret), normalized = stripVTControlCharacters(raw);
      return normalized ? [normalized, JSON.stringify(normalized).slice(1, -1), JSON.stringify(raw).slice(1, -1)] : [];
    }).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  // All recognizers see the original normalized text. Replacing a known value
  // first could erase a key; replacing a field first could split a known value.
  const spans = assignmentSpans(text);
  for (const secret of secrets) {
    let at = text.indexOf(secret);
    while (at !== -1) {
      spans.push([at, at + secret.length]);
      at = text.indexOf(secret, at + 1);
    }
  }
  for (const match of text.matchAll(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g)) spans.push([match.index, match.index + match[0].length]);
  for (const match of text.matchAll(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi)) spans.push([match.index + match[1].length, match.index + match[0].length - 1]);
  const merged = [];
  for (const span of spans.sort((a, b) => a[0] - b[0] || b[1] - a[1])) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  let redacted = '', copied = 0;
  for (const [start, end] of merged) {
    redacted += text.slice(copied, start) + '[redacted]';
    copied = end;
  }
  text = (redacted + text.slice(copied)).split('\n').slice(0, 8).join('\n').slice(0, 1024);
  while (Buffer.byteLength(text) > 1024) text = text.slice(0, -1);
  return text;
}

/** Each lane and machine keeps its own last ten passing observations, including coverage. */
export function usualTimes(runs) {
  const groups = new Map();
  for (const r of runs) {
    if (r.kind === 'gate' || busyState(r) === 'busy') continue;
    for (const t of r.tests ?? []) {
      if (t.outcome !== 'pass' || !Number.isFinite(t.ms) || t.ms < 0) continue;
      const k = JSON.stringify([laneOf(r), machineClass(r.machine), key(t)]);
      const g = groups.get(k) ?? { file: t.file, name: t.name, ...suiteOf(t), ...seenUnder(r), machine: machineClass(r.machine), samples: [] };
      g.samples.push(t.ms); g.samples = g.samples.slice(-10); groups.set(k, g);
    }
  }
  return [...groups.values()].map(({ samples, ...g }) => ({ ...g, median: median(samples), passes: samples.length }));
}
export async function writeUsual(root, runs) {
  const dir = await ignoreRuns(root);
  const path = join(dir, 'usual'); // not a run: no .json suffix
  const temporary = `${path}-${randomUUID()}`;
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, tests: usualTimes(runs), coverage: busyCoverage(runs) }) + '\n');
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
  return path;
}

/** Run a whole gate, preserving its exit code, and give runners a usual-times file.
 * preparedEnv is only for gateEnv's result: inherited runner context has already
 * been removed before explicit project environment overrides were applied. */
export async function timedCommand(command, { cwd = process.cwd(), env = process.env, stdio = 'pipe', preparedEnv = false, configured = false } = {}) {
  // A nested project's gate belongs to that project, never the enclosing Git repository.
  const root = real(cwd), config = await projectConfig(root, { strict: true });
  const options = { cwd, shell: true, stdio, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 60 * 60_000 };
  let parent = null;
  if (/^[a-f0-9-]{36}$/.test(env.KEEL_GATE_INVOCATION ?? '')) {
    try {
      const p = JSON.parse(await readFile(join(root, RUNS, `active-${env.KEEL_GATE_INVOCATION}`), 'utf8'));
      process.kill(p.pid, 0);
      if (p.root === root && p.id === env.KEEL_GATE_INVOCATION && p.completed === false) parent = p;
    } catch { /* inherited labels without a live outer receipt confer no provenance */ }
  }
  if (parent) {
    try { await writeFile(join(root, RUNS, `payload-${parent.id}`), sha12(command)); } catch {}
    const started = Date.now();
    const result = spawnSync(command, { ...options, env });
    return { ...result, ms: Date.now() - started };
  }
  let usual;
  const telemetry = { usual: false, recorded: false };
  const unavailable = (stage, error) => process.stderr.write(`${LABEL}: ${stage} unavailable (${error.code ?? 'storage error'}); gate exit unchanged.\n`);
  try {
    const history = await readRuns(root);
    usual = await writeUsual(root, history.runs);
    telemetry.usual = true;
  } catch (error) { unavailable('usual timing', error); }
  const identity = where(root), invocationId = randomUUID();
  let plan = null, active = null;
  try {
    const script = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).scripts?.test;
    plan = await nodePlan({ root, script, words: shellWords, flags: flagsIn, revision: identity.commit, invocationId: randomUUID() });
  } catch { /* missing declared plan leaves file coverage unavailable */ }
  try { active = join(await ignoreRuns(root), `active-${invocationId}`); await writeFile(active, JSON.stringify({ id: invocationId, root, pid: process.pid, commandHash: sha12(command), completed: false })); } catch { active = null; }
  const start = await busySample(), started = Date.now();
  const childEnv = Object.fromEntries(Object.entries(env).filter(([k]) => (preparedEnv || !k.startsWith('NODE_TEST_')) && !['KEEL_USUAL', 'KEEL_GATE_ACTIVE', 'KEEL_GATE_INVOCATION', 'KEEL_SUITE_PLAN', 'KEEL_RUN_START'].includes(k)));
  const result = spawnSync(command, { ...options, env: { ...childEnv, KEEL_GATE_ACTIVE: root, ...(active ? { KEEL_GATE_INVOCATION: invocationId } : {}), ...(plan ? {KEEL_SUITE_PLAN: JSON.stringify(plan)} : {}), ...(usual ? { KEEL_USUAL: usual } : {}), KEEL_RUN_START: JSON.stringify(start) } });
  const ms = Date.now() - started, busy = busyBetween(start, await busySample());
  let innerPayloadHash = null;
  try { innerPayloadHash = await readFile(join(root, RUNS, `payload-${invocationId}`), 'utf8'); } catch {}
  if (active) await rm(active, {force:true}).catch(() => {});
  await rm(join(root, RUNS, `payload-${invocationId}`), {force:true}).catch(() => {});
  try {
    await record(root, { ...finishedIdentity(identity, root), invocationId, completed: true, startedAt: new Date(started).toISOString(), provenance: { version: 1, source: 'outer-launcher', invocationId, outerCommandHash: sha12(command), innerPayloadHash, scope: '.' }, kind: 'gate', runner: 'gate', dir: relative(root, real(cwd)) || '.',
    config: configHash({ env, preload: [], configEnv: config.tests?.configEnv ?? [], runner: 'gate' }),
    gateSource: configured && command === (config.check ?? 'npm run check') ? 'configured-check' : 'explicit-command', commandHash: sha12(command), date: new Date().toISOString(), tests: [], ms, busy,
    status: result.status, signal: result.signal });
    telemetry.recorded = true;
  } catch (error) { unavailable('gate timing record', error); }
  return { ...result, ms, telemetry };
}

// ---- config ------------------------------------------------------------------

/** What is wrong with .keel/keel.json "tests": [string]. */
export function testsConfigProblems(config) {
  const t = config?.tests;
  if (t === undefined) return [];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['"tests" must be an object of window, factor, floorMs'];
  const out = [];
  for (const k of Object.keys(t)) if (!Object.hasOwn(DEFAULTS, k) && !OTHER_KEYS.includes(k)) out.push(`"tests" has an unknown key ${k} (window, factor, floorMs, ${OTHER_KEYS.join(', ')})`);
  if (t.runner !== undefined && !RUNNERS.includes(t.runner)) out.push(`"tests".runner must be one of ${RUNNERS.join(', ')}`);
  // keel writes it into the gate's shell line as it is (adopt's proposal), so it holds no character a shell reads: never quoted, never wrong.
  // It lives in the ledger's own directory, which ignores itself: a report anywhere else would stay behind, untracked, after every gate.
  if (t.junit !== undefined && !(typeof t.junit === 'string' && JUNIT_PATH.test(t.junit))) out.push(`"tests".junit must be a .xml file in ${RUNS}/ (which ignores itself), of letters, digits, _ . and - only`);
  if (t.stalls !== undefined && !(Array.isArray(t.stalls) && t.stalls.every(pinnable))) out.push('"tests".stalls must be a list of test files, each relative to the repo\'s root (tests/acme.test.mjs)');
  if (t.configEnv !== undefined && !(Array.isArray(t.configEnv) && t.configEnv.every(v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))) out.push('"tests".configEnv must be a list of environment variable names');
  if (t.allowEmpty !== undefined && typeof t.allowEmpty !== 'boolean') out.push('"tests".allowEmpty must be true or false');
  if (t.window !== undefined && !(Number.isInteger(t.window) && t.window >= 2 && t.window <= MAX_WINDOW)) out.push(`"tests".window must be a whole number of runs, 2 to ${MAX_WINDOW}`);
  if (t.factor !== undefined && !(Number.isFinite(t.factor) && t.factor > 1)) out.push('"tests".factor must be a number above 1');
  if (t.floorMs !== undefined && !(Number.isFinite(t.floorMs) && t.floorMs >= 0)) out.push('"tests".floorMs must be a number of milliseconds, 0 or more');
  return out;
}

/** A file pinned to stalls: a path relative to the repo's root, never outside it. */
const pinnable = f => typeof f === 'string' && f.trim() !== '' && !isAbsolute(f) && !f.split(/[\\/]/).includes('..');

/** The files .keel/keel.json pins to stalls ("tests": { "stalls": [...] }) that are files relative to the repo's root; [] when none. */
export const stallsPins = config => (Array.isArray(config?.tests?.stalls) ? config.tests.stalls.filter(pinnable).map(f => posix.normalize(f.split(sep).join('/'))) : []);
/** The "tests".stalls entries that pin nothing (outside the repo, absolute, empty, not a string), or the whole value when it is not a list. */
export const stallsBad = config => {
  const s = config?.tests?.stalls;
  if (s === undefined) return [];
  return Array.isArray(s) ? s.filter(f => !pinnable(f)) : [s];
};

/** The ledger's settings for this project; throws on a bad "tests". */
export function testsConfigOf(config) {
  const problems = testsConfigProblems(config);
  if (problems.length) throw new Error(`.keel/keel.json: ${problems.join('; ')}`);
  return { ...DEFAULTS, ...(config?.tests ?? {}) };
}

// ---- history -----------------------------------------------------------------

const isRun = r => r && typeof r === 'object' && typeof r.date === 'string' && Array.isArray(r.tests);

/** Test runs under root, oldest first: { runs, skipped }. gates:true includes full-gate records. No directory: no runs. */
export async function readRuns(root, dir = RUNS, { gates = false, stalls = false } = {}) {
  let names;
  try { names = (await readdir(join(root, dir))).filter(n => n.endsWith('.json')); }
  catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) return { runs: [], skipped: 0 }; throw e; }
  const runs = [];
  let skipped = 0, bytes = 0;
  for (const name of names.sort().reverse()) {
    try {
      const size=(await stat(join(root,dir,name))).size;
      if(size>RETENTION.bytes-bytes || runs.length>=RETENTION.records) { skipped++; continue; }
      bytes+=size;
      const r = JSON.parse(await readFile(join(root, dir, name), 'utf8'));
      if (isRun(r)) { if ((gates || r.kind !== 'gate') && (stalls || r.kind !== 'stalls')) runs.push({ ...r, id: name.slice(0, -5) }); } else skipped++;
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
/** A test's identity: its file, whether it is a JUnit describe, and its name (a describe and a test of one name are two). */
const key = t => `${t.file ?? ''}\u0000${t.describe === true ? 'd' : 't'}\u0000${t.name}`;
/** A run's config identity; a record from before configs is its own (null) class. */
const configOf = r => r?.config ?? null;
/** The folder a run's `node --test` ran in, relative to the repo's root; a record from before folders ran at the root. */
const dirOf = r => r?.dir ?? '.';
/** The runner that ran a run: a record without one is node's (the reporter's own records). */
export const runnerOf = r => r?.runner ?? 'node';
/** A run's lane: its suite's folder, its config and its runner (node's lane is as it was). Retention keeps each lane's own newest runs. */
export const laneOf = r => `${dirOf(r)}\u0000${configOf(r)}${runnerOf(r) === 'node' ? '' : `\u0000${runnerOf(r)}`}`;
/** A JUnit describe() recorded as one top-level test: its run-alone filter is a prefix, not a whole name. */
const suiteOf = t => t?.describe === true ? { describe: true } : {};
/** What a finding carries of the run it was seen in, so its run-alone command reproduces that run. */
const seenUnder = r => ({ dir: dirOf(r), config: configOf(r), setting: r?.setting ?? null, ...(runnerOf(r) === 'node' ? {} : { runner: runnerOf(r) }) });
const median = xs => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/**
 * Flaky: a test with both a pass and a fail on one clean tree in one lane
 * (suite folder and config). A dirty tree, or a mix across different trees,
 * is not flaky: the code moved. A mix across lanes is not either: the
 * setting moved.
 * [{ file, name, tree, passed, failed, dir, config, setting, runs }]
 */
export function flaky(runs) {
  const seen = new Map();
  for (const r of runs) {
    if (r.dirty !== false || !r.tree || busyState(r) === 'busy') continue;
    for (const t of r.tests ?? []) {
      if (!['pass', 'fail'].includes(t.outcome)) continue;
      const k = `${r.tree}\u0000${laneOf(r)}\u0000${machineClass(r.machine)}\u0000${key(t)}`;
      const s = seen.get(k) ?? { file: t.file ?? null, name: t.name, ...suiteOf(t), tree: r.tree, passed: 0, failed: 0, ...seenUnder(r) };
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
 * [{ file, name, ms, median, over, window, machine, dir, config, setting }]
 */
export function slower(runs, { window = DEFAULTS.window, factor = DEFAULTS.factor, floorMs = DEFAULTS.floorMs } = {}, current = runs.filter(r => r.kind !== 'gate').at(-1)) {
  if (!current || busyState(current) === 'busy') return [];
  const machine = machineClass(current.machine);
  const before = comparable(runs, current).filter(r => busyState(r) !== 'busy');
  const out = [];
  for (const t of current.tests ?? []) {
    if (t.outcome !== 'pass' || !Number.isFinite(t.ms) || t.ms < 0) continue;
    const past = [];
    for (let i = before.length - 1; i >= 0 && past.length < window; i--) {
      const p = before[i].tests?.find(x => key(x) === key(t));
      if (p?.outcome === 'pass' && Number.isFinite(p.ms)) past.push(p.ms);
    }
    if (past.length < window) continue;
    const m = median(past);
    if (t.ms > factor * m && t.ms - m > floorMs) out.push({ file: t.file ?? null, name: t.name, ...suiteOf(t), ms: t.ms, median: Math.round(m), over: Math.round(t.ms - m), window, machine, ...seenUnder(current) });
  }
  return out.sort((a, b) => b.over - a.over);
}

/** The runs before `current` that its times are judged against: the same machine class and the same lane (suite folder and config). */
export function comparable(runs, current) {
  const machine = machineClass(current.machine);
  return runs.filter(r => r !== current && r.date <= current.date && machineClass(r.machine) === machine && laneOf(r) === laneOf(current));
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

/**
 * The command that runs one test alone as it ran when it was seen: the
 * finding's own setting (each config variable that was set, as
 * `NAME="${NAME:?set NAME as it was in the run}"` since its value is never
 * recorded: it runs when the person's shell has it set, and stops with that
 * message when not; NODE_OPTIONS's
 * own value; each that was unset as `env -u NAME`; then its
 * --import/--require preloads; `preload` is for a finding that carries none),
 * from the folder its suite ran in. `here` is where the command is printed,
 * relative to the repo's root: from anywhere else it first changes to that
 * folder (git's top level, then the suite's folder), and the file is said
 * relative to it.
 */
/** Whether a recorded variable was set: a value (NODE_OPTIONS, or a record from before hashes) or { set: true }. */
const isSet = v => typeof v === 'string' || (v !== null && typeof v === 'object' && v.set === true);

export function aloneCommand(test, preload = [], { here = '.' } = {}) {
  const runner = runnerOf(test);
  const escaped = test.name.replace(RE_SPECIAL, '\\$&');
  // bun and vitest match -t against the full name, describes joined by spaces (bun's with a leading one).
  // A describe is the start of its tests' names; a test is its whole name, so `save` never runs `save draft` too.
  const pattern = runner === 'node' ? `^${escaped}$` : test.describe ? `^ ?${escaped}( |$)` : `^ ?${escaped}$`;
  const dir = test.dir ?? '.';
  const vars = Object.entries(test.setting?.env ?? {});
  // A value is printed for NODE_OPTIONS only (never a secret: one that looks like one is recorded as a hash);
  // any other set variable is taken from the person's shell, or the command stops and says to set it,
  // so a configEnv value never reaches a printed command and the command still runs as printed.
  const env = vars.filter(([, v]) => isSet(v)).map(([k, v]) => k === 'NODE_OPTIONS' && typeof v === 'string' ? `${k}=${quote(v)}` : `${k}="\${${k}?set ${k} as it was in the run}"`);
  const unset = vars.filter(([, v]) => !isSet(v)).map(([k]) => `-u ${k}`);
  const rel = test.file ? posix.relative(dir === '.' ? '' : dir, test.file) || test.file : '';
  // One shell word, whatever the path holds (a space, a quote).
  const file = rel && !/^[\w./@+-]+$/.test(rel) ? quote(rel) : rel;
  const run = runner === 'bun' ? ['bun', 'test', file, '-t', quote(pattern)]
    : runner === 'vitest' ? ['npx', 'vitest', 'run', file, '-t', quote(pattern)]
    : ['node', ...(test.setting?.preload ?? preload), '--test', `--test-name-pattern=${quote(pattern)}`, file];
  const command = [...env, ...(unset.length ? ['env', ...unset] : []), ...run].filter(Boolean).join(' ');
  return dir === here ? command : `cd "$(git rev-parse --show-toplevel)"${dir === '.' ? '' : `/${quote(dir)}`} && ${command}`;
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
export function hygiene(runs, opts = DEFAULTS, { preload = [], skipped = 0, here = '.' } = {}) {
  runs = runs.filter(r => r.kind !== 'gate');
  const recent = runs.filter(r => busyState(r) !== 'busy').slice(-opts.window);
  const f = flaky(recent), s = slower(runs, opts);
  const memory = failureMemory(runs);
  const of = `${runs.length} run${runs.length === 1 ? '' : 's'} in ${RUNS}${skipped ? `, ${skipped} unreadable` : ''}${busyNote(runs)}`;
  if (!f.length && !s.length) return [`${LABEL}: no flaky or slower test (${of}).`, ...memory.map(m => `  ${m.message}`)];
  const items = f.length + s.length;
  return [
    `${LABEL}: ${items} hygiene item${items === 1 ? '' : 's'} (${of}). Each is work: fix it or file it; never rerun until green.`,
    ...f.flatMap(t => [
      `  flaky   ${named(t)}: passed ${t.passed}, failed ${t.failed} on one clean tree (${shortTree(t.tree)}) in the last ${recent.length} runs`,
      `          ${aloneCommand(t, preload, { here })}`,
    ]),
    ...memory.map(m => `  ${m.message}`),
    ...s.flatMap(t => [
      `  slower  ${named(t)}: ${Math.round(t.ms)} ms against a median of ${t.median} ms over its last ${t.window} passing runs (${t.machine}), +${t.over} ms`,
      `          ${aloneCommand(t, preload, { here })}`,
    ]),
  ];
}

const busyDescription = r => `${busyState(r)} [${[r.busy?.start, r.busy?.end].map(s => s ? `${s.load?.[0] ?? '?'} load/${s.cores ?? '?'} cores` : 'unavailable').join(' → ')}]`;

/** Failure matches and differing outcomes, independently of whether load permits a flake finding. */
export function failureMemory(runs) {
  const current = runs.filter(r => r.kind !== 'gate').at(-1);
  if (!current || current.dirty !== false || !current.tree) return [];
  const history = runs.filter(r => r !== current && r.dirty === false && r.tree === current.tree && laneOf(r) === laneOf(current) && machineClass(r.machine) === machineClass(current.machine));
  return (current.tests ?? []).flatMap(t => {
    if (!['pass', 'fail'].includes(t.outcome)) return [];
    const prior = history.filter(r => r.date <= current.date).flatMap(r => r.tests.filter(p => key(p) === key(t) && ['pass', 'fail'].includes(p.outcome)).map(p => ({ date: r.date, outcome: p.outcome, error: p.error, busy: r.busy ?? null })));
    const different = prior.some(p => p.outcome !== t.outcome);
    if (!different) return [];
    const knownFlake = flaky([...history, current]).some(f => key(f) === key(t));
    const repeat = knownFlake && t.outcome === 'fail' && Boolean(t.error) && prior.some(p => p.outcome === 'fail' && p.error === t.error);
    return [{ file: t.file, name: t.name, ...seenUnder(current), machine: machineClass(current.machine), repeat, runs: [...prior, { date: current.date, outcome: t.outcome, error: t.error, busy: current.busy ?? null }],
      message: `${named(t)}: ${repeat ? 'matches an earlier failure on a flaky test; ' : ''}different outcomes on an identical clean tree: decided by something besides the files; load ${[...prior.map(p => busyDescription({ busy: p.busy })), busyDescription(current)].join(', ')}` }];
  });
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

// A receipt keeps its starting revision; an end-state change cannot be
// attributed to that revision as a clean observation. Unknown remains unknown.
function finishedIdentity(start, root) {
  const end = where(root);
  const changed = start.commit !== end.commit || start.tree !== end.tree;
  const clean = start.dirty === false && end.dirty === false && start.commit && start.tree && !changed;
  return {...start, dirty: clean ? false : changed || start.dirty === true || end.dirty === true ? true : null};
}

/**
 * Where this run happened: commit, tree, dirty, machine, node. Dirty reads
 * the whole repo (from its top), git-ignored files aside (porcelain never
 * lists them) and keel's machine directories aside, and `exclude` (root-relative
 * paths: the JUnit file a run wrote, wherever it was told to).
 */
export function where(cwd = process.cwd(), { exclude = [] } = {}) {
  const commit = gitOut(cwd, ['rev-parse', 'HEAD'])?.trim() || null;
  const tree = commit ? gitOut(cwd, ['rev-parse', 'HEAD^{tree}'])?.trim() || null : null;
  const status = commit ? gitOut(cwd, ['status', '--porcelain', '--', ':/', ...[...MACHINE_DIRS, ...exclude].map(d => `:(top,exclude)${d}`)]) : null;
  return {
    commit, tree, dirty: status === null ? null : status.trim() !== '',
    machine: { os: platform(), arch: arch(), cpus: availableParallelism() },
    node: process.version,
  };
}

/**
 * Write one run, keep the newest `keep` of each lane (a suite's folder and
 * config: one pass of a project with four lanes writes four runs, and each
 * lane needs its own window of history), reserving each lane's newest
 * max(KEEP, window + 10) first, then prune only the rest (unreadable records,
 * and runs past the reserve when `keep` is larger) down to `total` in all
 * (TOTAL, or lanes × (window + 10) when that is larger): many runs of one lane
 * never evict another lane's baseline. Make the directory ignore itself.
 * Returns the file name.
 */
/** The ledger's directory, made, and ignoring itself (a .gitignore of `*`), so what lands there never dirties a tree. */
export async function ignoreRuns(root) {
  const dir = join(root, RUNS);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '.gitignore'), '*\n');
  return dir;
}

/** Recent reserve plus outcome-independent stable weekly samples. Legacy explicit
 * keep opts remain available for bounded callers; production uses weekly retention. */
export function retainedRecords(rows, { window = DEFAULTS.window, keep = Math.max(KEEP, window + 10), total, sampled = true, now = Date.now(), limits = RETENTION } = {}) {
  const sorted = [...rows].sort((a,b) => a.run.date.localeCompare(b.run.date) || a.name.localeCompare(b.name));
  const lanes = new Map();
  for (const row of sorted) { const lane = JSON.stringify([row.run.kind??'tests',laneOf(row.run),row.run.flags??null,machineClass(row.run.machine),row.run.commandHash??row.run.suite?.commandHash??null]); lanes.set(lane, [...(lanes.get(lane) ?? []), row]); }
  const active = [...lanes.values()].sort((a,b) => b.at(-1).run.date.localeCompare(a.at(-1).run.date)).slice(0, limits.lanes);
  const reserved = new Set(), weekly = new Set();
  const monday = ms => { const d = new Date(ms); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7); return +d; };
  const first = monday(now) - (limits.weeks - 1) * 7 * 86400000;
  for (const lane of active) {
    for (const r of lane.slice(-keep)) reserved.add(r.name);
    if (!sampled) continue;
    const bins = new Map();
    for (const r of lane) {
      const date = Date.parse(r.run.date); if (date < first || date > now) continue;
      const key = `${monday(date)}:${busyState(r.run) === 'quiet' ? 'quiet' : 'other'}`;
      bins.set(key, [...(bins.get(key) ?? []), r]);
    }
    for (const [key, bin] of bins) for (const r of bin.sort((a,b) => digest(a.name).localeCompare(digest(b.name))).slice(0, key.endsWith(':quiet') ? limits.quietPerWeek : limits.otherPerWeek)) weekly.add(r.name);
  }
  let kept = sorted.filter(r => reserved.has(r.name) || weekly.has(r.name));
  // A caller's soft total cannot undercut reserves; the hard global caps can.
  const soft = total ?? limits.records;
  const spare = kept.filter(r => !reserved.has(r.name));
  const drop = new Set(spare.slice(0, Math.max(0, kept.length - soft)).map(r => r.name));
  kept = kept.filter(r => !drop.has(r.name));
  let bytes = kept.reduce((n,r) => n + r.bytes, 0), pressure = 0;
  while (kept.length > limits.records || bytes > limits.bytes) { bytes -= kept.shift().bytes; pressure++; }
  return { names: kept.map(r => r.name), coverage: { version: 1, sampled, policy: limits, retained: kept.length, considered: rows.length, omitted: rows.length - kept.length, pressureLosses: pressure, laneLosses: Math.max(0, lanes.size - active.length), bytes, at: new Date(now).toISOString() } };
}
export async function record(root, run, options = {}) {
  const dir = await ignoreRuns(root);
  const name = `${run.date.replaceAll(':', '-').replace('.', '-')}-${process.pid}-${randomUUID()}.json`;
  const temporary = join(dir, `${name}.tmp`);
  await writeFile(temporary, `${JSON.stringify(run)}\n`); await rename(temporary, join(dir, name));
  const rows = [], invalid = [];
  for (const n of (await readdir(dir)).filter(n => n.endsWith('.json'))) {
    try { const bytes=(await stat(join(dir,n))).size; if(bytes>RETENTION.bytes)throw new Error('oversized'); const r = JSON.parse(await readFile(join(dir,n),'utf8')); if (!isRun(r)) throw new Error('invalid'); const {date,kind,dir:scope,config,flags,machine,commandHash,busy}=r; rows.push({name:n,run:{date,kind,dir:scope,config,flags,machine,commandHash,busy,suite:{commandHash:r.suite?.commandHash}},bytes}); }
    catch { invalid.push(n); }
  }
  const selection = retainedRecords(rows, { ...options, sampled: options.keep === undefined, now: Math.max(Date.now(), Date.parse(run.date)) });
  const names = new Set(selection.names);
  for (const old of [...rows.filter(r => !names.has(r.name)).map(r => r.name), ...invalid]) await rm(join(dir,old), {force:true});
  const status = join(dir,'retention');
  let previous; try { previous = JSON.parse(await readFile(status,'utf8')); } catch { previous = {}; }
  selection.coverage.invalidOrOversized=invalid.length;
  selection.coverage.omitted+=invalid.length;
  selection.coverage.cumulativeOmitted = (previous.cumulativeOmitted ?? 0) + selection.coverage.omitted;
  selection.coverage.cumulativePressureLosses = (previous.cumulativePressureLosses ?? 0) + selection.coverage.pressureLosses;
  const tmp = `${status}-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify(selection.coverage)+'\n'); await rename(tmp,status);
  return name;
}

export async function readRetention(root) {
  try { return JSON.parse(await readFile(join(root, RUNS, 'retention'), 'utf8')); }
  catch { return { sampled: true, gaps: ['retention coverage unavailable'] }; }
}
export async function recordStalls(root, receipts) {
  if (!receipts.length) return;
  if (receipts.length>2000 || !receipts.every(isStallsReceipt) || Buffer.byteLength(JSON.stringify(receipts))>1024*1024) throw new Error('stalls receipts invalid or oversized');
  const identity=receipts[0].identity;
  return record(root,{kind:'stalls',version:1,date:receipts.at(-1).completedAt,completed:true,tests:[],stallsReceipts:receipts,
    dir:identity.scope,config:identity.configHash,flagsHash:identity.flagsHash,commit:receipts[0].revision});
}
export async function readStalls(root) {
  const {runs,skipped}=await readRuns(root,undefined,{gates:true,stalls:true});
  const receipts=[],gaps=skipped?[`${skipped} ledger records unreadable`]:[];
  for(const r of runs.filter(r=>r.kind==='stalls')) {
    if(r.version!==1 || !Array.isArray(r.stallsReceipts) || r.stallsReceipts.length>2000 || !r.stallsReceipts.every(isStallsReceipt)) {gaps.push('invalid typed stalls record');continue;}
    receipts.push(...r.stallsReceipts);
  }
  return {receipts,gaps,sampled:true};
}

async function projectConfig(root, { strict = false, redaction = false } = {}) {
  try {
    const config = JSON.parse(await readFile(join(root, '.keel', 'keel.json'), 'utf8'));
    if (redaction && (!config || typeof config !== 'object' || Array.isArray(config) || (config.tests !== undefined && (!config.tests || typeof config.tests !== 'object' || Array.isArray(config.tests))) || (config.tests?.configEnv !== undefined && !(Array.isArray(config.tests.configEnv) && config.tests.configEnv.every(v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))))) return null;
    if (strict && (!config || typeof config !== 'object' || Array.isArray(config) || (config.check !== undefined && (typeof config.check !== 'string' || !config.check.trim())))) throw new Error('invalid gate configuration');
    return config;
  } catch (error) {
    if (redaction && error.code !== 'ENOENT') return null;
    if (!strict || error.code === 'ENOENT') return {};
    throw new Error(`cannot determine gate from .keel/keel.json (${error.code ?? 'invalid configuration'})`);
  }
}

/**
 * The run's config identity: a short stable hash of NODE_OPTIONS, the run's
 * preloads, and each variable named in "tests".configEnv (absent and empty
 * differ), and the runner when it is not node (node's hash is as it was).
 * Two runs under different configs never make a test flaky or slower.
 */
export function configHash({ env = process.env, preload = preloads(), configEnv = [], runner = 'node' } = {}) {
  const vars = Object.fromEntries(settingNames(configEnv).map(n => [n, env[n] ?? null]));
  return createHash('sha256').update(JSON.stringify({ vars, preload, ...(runner === 'node' ? {} : { runner }) })).digest('hex').slice(0, 12);
}

const settingNames = configEnv => [...new Set(['NODE_OPTIONS', ...configEnv])].sort();
/** A NODE_OPTIONS that carries something secret-looking (token=, secret=, key=, password=) is hashed like a configEnv variable. */
const SECRETISH = /(token|secret|key|password)=/i;
const sha12 = v => createHash('sha256').update(v).digest('hex').slice(0, 12);
/** A variable recorded without its value: { name, set, hash } (hash null when unset). */
const hidden = (name, v) => ({ name, set: v !== undefined, hash: v === undefined ? null : sha12(v) });

/**
 * What the config hash is a hash of, recorded beside it, never a configEnv
 * value (records are uploaded, and findings print): { env: { NODE_OPTIONS:
 * value or null (or hidden, when it looks secret), NAME: { name, set, hash } },
 * preload }.
 */
export function settingOf({ env = process.env, preload = preloads(), configEnv = [] } = {}) {
  return {
    env: Object.fromEntries(settingNames(configEnv).map(n => {
      const v = env[n];
      if (n === 'NODE_OPTIONS' && !configEnv.includes(n)) return [n, v === undefined ? null : SECRETISH.test(v) ? hidden(n, v) : v];
      return [n, hidden(n, v)];
    })),
    preload,
  };
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

/** What a test said it could not judge (`t.diagnostic('keel:inconclusive <what it measured>')`), or null. */
export function inconclusiveOf(message) {
  const m = /^keel:inconclusive(?:\s+([\s\S]*))?$/.exec(String(message ?? '').trim());
  return m ? (m[1] ?? '').trim() || 'the machine kept it from judging' : null;
}

/**
 * The top-level tests of a run, from its reporter events: push(e) each one,
 * read `tests` at the end ([{ file, name, outcome, ms, inconclusive?, error? }]).
 * `file` is relative to `root` (absolute without one). A passing test that
 * said keel:inconclusive, itself or in a subtest, is `inconclusive`: neither
 * pass nor fail. It never hides a failure: a failing test stays `fail`.
 * node reports a test's own diagnostic right after its result, and a
 * subtest's before its parent's.
 */
export function topLevel({ root = null, errors = false, configEnv = [], env = process.env } = {}) {
  const redact = value => failureText(value, env, { configEnv });
  const tests = [], last = new Map(), pending = new Map(), names = new Map(), failures = new Map();
  const fileOf = f => {
    if (!names.has(f)) names.set(f, root ? relative(root, real(f)).split(sep).join('/') : real(f));
    return names.get(f);
  };
  const mark = (t, what) => { if (t.outcome === 'pass') { t.outcome = 'inconclusive'; t.inconclusive = what; } };
  return {
    tests,
    push(e) {
      const d = e.data;
      if (e.type === 'test:diagnostic') {
        const what = inconclusiveOf(d?.message);
        if (what === null || !d?.file) return;
        if (d.nesting === 0) { const at = last.get(d.file); if (at && at.line === d.line) mark(at.test, what); }
        else pending.set(d.file, what);
        return;
      }
      // Node IDs are scoped to an entry file. Propagate detail only over an
      // explicit parent link; older events without IDs must never guess by file.
      const id = d?.file && d.testId != null ? JSON.stringify([d.file, d.testId]) : null;
      if (errors && e.type === 'test:fail' && d?.nesting > 0 && d.file && d.parentId != null) {
        const parent = JSON.stringify([d.file, d.parentId]);
        const err = d.details?.error;
        if (!failures.has(parent)) failures.set(parent, failures.get(id) ?? redact(err?.cause?.message ?? err?.message ?? err ?? ''));
        failures.delete(id);
      }
      if ((e.type !== 'test:pass' && e.type !== 'test:fail') || d?.nesting !== 0) return;
      const t = { file: d.file ? fileOf(d.file) : null, name: String(d.name), outcome: outcomeOf(e), ms: Math.round((d.details?.duration_ms ?? 0) * 10) / 10 };
      if (errors && t.outcome === 'fail') {
        const err = d.details?.error;
        t.error = failures.get(id) ?? redact(err?.cause?.message ?? err?.message ?? err ?? '');
        if (!failures.has(id) && err?.failureType === 'subtestsFailed') t.error = redact(t.error + '\nChild failure detail unavailable: no correlated parent link.');
      }
      if (d.file && pending.has(d.file)) { mark(t, pending.get(d.file)); pending.delete(d.file); }
      if (d.file) last.set(d.file, { test: t, line: d.line });
      failures.delete(id);
      tests.push(t);
    },
  };
}

/** Whether an event is a test that executed: a test (never a suite: an empty describe() runs nothing), passed or failed, not a file's own entry. */
export const executed = (cwd, e) => (e.type === 'test:pass' || e.type === 'test:fail') && e.data?.details?.type === 'test'
  && ['pass', 'fail'].includes(outcomeOf(e)) && !fileOwn(cwd, e.data);

export const STALLS_LABEL = 'keel stalls';

/**
 * Files pinned to stalls ("tests": { "stalls": [...] }): each one this run
 * reaches is run again, with stalls (./stalls.mjs), once its own run is over
 * (never two copies of one file at once), while the rest of the suite goes
 * on, from one fresh seed per run. said(tests) waits for them and returns
 * their lines; a pinned file that fails with stalls fails the run and prints
 * the seed and the command that replays it, and an entry that pins nothing
 * fails it too. Null when nothing is pinned.
 */
export function pinned(root, config, { env = process.env, preload, seed: given } = {}) {
  const pins = new Set(stallsPins(config)), bad = stallsBad(config), receiptIdentity = where(root), receiptStartedAt = new Date().toISOString();
  if (!pins.size && !bad.length) return null;
  const started = new Map(), seen = new Map(), reached = new Set();
  // A suite with a global setup holds what it set up until the whole suite is over (its teardown): a rerun
  // that starts at one file's summary would set it up a second time beside it. Then every rerun waits.
  const whole = process.execArgv.some(a => a === '--test-global-setup' || a.startsWith('--test-global-setup='));
  let seed = given;
  const relOf = f => {
    if (!seen.has(f)) seen.set(f, relative(root, real(f)).split(sep).join('/'));
    return seen.get(f);
  };
  const start = rel => (async () => {
    const m = await import('./stalls.mjs');
    seed ??= m.freshSeed();
    // The suite's own node flags (preloads, conditions, setup), never its files, names, reporters or time limit.
    const once = shape => m.runFiles({ files: [join(root, rel)], cwd: process.cwd(), root, preload: preload ?? m.runnerFlags(process.execArgv), env, seed, ...(shape ? { shape } : {}) });
    const run = await once();
    if (run.stalls.length || run.exitCode !== 0 || run.timedOut) return { m, run };
    // No stall landed (the file ran in less than the first stall's wait): a run with no stall judged nothing.
    // Once more, with the first stall inside half of that run's running time; never a third time.
    const within = Math.max(1, Math.floor(run.active / 2));
    return { m, run: await once({ ...m.shapeOf(env), firstMs: [Math.floor(within / 2), within] }), again: { within, first: run.active } };
  })().catch(error => ({ error }));
  return {
    // A pinned file's stalled copy starts once its own run is over (node's per-file summary), never beside it:
    // two copies of one file share its ports, databases and fixtures, and would fail with no stall at all.
    saw(e) {
      const f = e.data?.file;
      if (!f || typeof f !== 'string') return;
      const rel = relOf(f);
      if (!pins.has(rel) || started.has(rel)) return;
      reached.add(rel);
      if (e.type === 'test:summary' && !whole) started.set(rel, start(rel));
    },
    async said(tests) {
      const lines = [];
      if (bad.length) {
        lines.push(`${STALLS_LABEL}: "tests".stalls pins nothing with ${bad.map(b => JSON.stringify(b)).join(', ')}: each entry is a test file relative to the repo's root. The rest still run with stalls; this run fails until it is fixed.`);
        process.exitCode = 1;
      }
      // A pin to a file that is gone (renamed, deleted), or to a folder, guards nothing, so it fails the run.
      // One this run did not reach is only said: a run of some of the suite's files is not a broken pin.
      const isFile = rel => { try { return statSync(join(root, rel)).isFile(); } catch { return false; } };
      const gone = [...pins].filter(rel => !isFile(rel));
      if (gone.length) {
        lines.push(`${STALLS_LABEL}: "tests".stalls pins ${gone.join(', ')}, which ${gone.length === 1 ? 'is' : 'are'} not a test file: a pin to a moved or deleted file, or to a folder, guards nothing. Pin the file's path, or drop the pin; this run fails until then.`);
        process.exitCode = 1;
      }
      for (const rel of reached) if (!started.has(rel)) started.set(rel, start(rel)); // its summary never came: the suite is over now
      for (const [rel, p] of started) {
        const { m, run, error, again } = await p;
        if (error) {
          lines.push(`${STALLS_LABEL}: ${rel} is pinned to stalls and could not run with them (${String(error?.message ?? error).split('\n')[0]}).`);
          process.exitCode = 1;
          continue;
        }
        const plainTests = tests.filter(t => t.file === rel);
        try { await recordStalls(root, stallsEvidence({ sanitize: value => failureText(value,env,{configEnv:config.tests?.configEnv??[]}), identity: finishedIdentity(receiptIdentity, root), plain: {tests:plainTests,exitCode:plainTests.some(t => t.outcome === 'fail') ? 1 : 0}, stalled: run, pinned: true, startedAt: receiptStartedAt, completedAt: new Date().toISOString(), configHash: configHash({env, preload: preloads(), configEnv:config.tests?.configEnv ?? []}), flagsHash:digest(preload ?? m.runnerFlags(process.execArgv)), scope: relative(root,process.cwd()).split(sep).join('/') || '.' })); } catch { lines.push(`${STALLS_LABEL}: receipt storage unavailable.`); }
        const j = m.judge(plainTests, run.tests);
        const s = `${run.stalls.length} stall${run.stalls.length === 1 ? '' : 's'}, ${(run.paused / 1000).toFixed(1)} s paused, ${(run.wall / 1000).toFixed(1)} s in all${again ? `; run again with the first stall within ${again.within} ms, after the first run (${Math.round(again.first)} ms) got none` : ''}`;
        const failed = run.tests.filter(t => t.outcome === 'fail');
        // A test that ran without stalls and never with them (registered only some of the time) was not judged.
        const unjudged = j.missing.length > 0;
        if (!failed.length && !unjudged && !run.timedOut && run.exitCode === 0 && run.ran > 0 && run.stalls.length) {
          lines.push(`${STALLS_LABEL}: ${rel} passed with ${s}, seed ${run.seed}.`);
          continue;
        }
        if (!failed.length && !unjudged && !run.timedOut && run.exitCode === 0 && run.ran > 0) {
          // Zero stalls is not a pass: nothing paused it, so nothing was judged.
          process.exitCode = 1;
          lines.push(`${STALLS_LABEL}: ${rel} is inconclusive: no stall landed (${s}), seed ${run.seed}. A file that ends before a stall can land guards nothing pinned; unpin it, or give it a test long enough to pause.`);
          continue;
        }
        process.exitCode = 1;
        lines.push(`${STALLS_LABEL}: ${rel} failed with stalls (${s}), seed ${run.seed}. Replay: ${m.replay([rel], run.seed)}`);
        for (const t of j.named) lines.push(`  "${t.name}" passed plainly and failed with stalls: it judges the wall clock${t.error ? `: ${t.error}` : ''}`);
        for (const t of j.unbased) lines.push(`  "${t.name}" failed with stalls, and was ${t.plain ?? 'not run'} without them: no pass to compare with${t.error ? `: ${t.error}` : ''}`);
        for (const t of j.missing) lines.push(`  "${t.name}" ran without stalls and never with them: it was not judged`);
        for (const t of j.both) lines.push(`  "${t.name}" failed with stalls${tests.some(x => x.file === rel && x.name === t.name) ? ' and plainly' : ''}${t.error ? `: ${t.error}` : ''}`);
        if (run.timedOut) lines.push('  it ran past its time limit (paused time not counted)');
        else if (!failed.length && run.exitCode === 0 && run.ran === 0) lines.push('  no test ran with stalls: nothing was judged');
        else if (!failed.length) lines.push(`  node --test exited ${run.exitCode ?? run.signal}: ${run.stderr.split('\n').slice(-3).join(' | ') || 'no output'}`);
      }
      return lines;
    },
  };
}

/** The reporter: records each top-level test, then yields the hygiene block; a run that executed no test fails. */
export default async function* ledger(source) {
  const cwd = process.cwd();
  const root = rootOf(cwd);
  const knownConfig = await projectConfig(root, { redaction: true });
  const config = knownConfig ?? {};
  const configEnv = config.tests?.configEnv ?? [];
  const started = Date.now(), start = await busySample();
  const top = topLevel({ root, errors: knownConfig !== null, configEnv });
  const plan = await readReceiptPlan();
  const suite = suiteCollector({root, plan, sanitize: value => failureText(value,process.env,{configEnv}), flagsHash: digest(flagsIn(process.execArgv).flatMap(f => f.words))});
  const initialIdentity = where(root);
  const { tests } = top;
  const pins = narrowed() || knownConfig === null ? null : pinned(root, config);
  let ran = 0;
  for await (const e of source) {
    if (executed(cwd, e)) ran++;
    top.push(e);
    suite.push(e);
    pins?.saw(e);
  }
  const empty = emptyRun(ran, config);
  if (empty && !process.exitCode) process.exitCode = 1;
  if (knownConfig === null) {
    if (empty) yield `${empty}\n`;
    yield `${LABEL}: redaction configuration unavailable; nothing recorded.\n`;
    return;
  }
  if (pins) {
    const said = await pins.said(tests);
    if (said.length) yield `${said.join('\n')}\n`;
  }
  if (!tests.length) { if (empty) yield `${empty}\n`; return; } // nothing reported: nothing to remember
  try {
    const workflow = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW ? { workflow: process.env.GITHUB_WORKFLOW } : {};
    const here = relative(root, real(cwd)).split(sep).join('/') || '.';
    // flags: the node flags a rerun of this suite carries (runnerFlags), so keel test reuses this run as a
    // baseline only under the same ones; the config hash, and so the lanes, are as they were.
    const run = { ...finishedIdentity(initialIdentity, root), suite: suite.finish(), commandHash: plan?.available ? plan.commandHash : digest({argv:process.argv.slice(1),execArgv:process.execArgv}), invocationId: plan?.invocationId ?? randomUUID(), parentInvocationId: process.env.KEEL_GATE_INVOCATION ?? null, completed: true, busy: busyBetween(start, await busySample()), wallMs: Date.now() - started, dir: here, config: configHash({ configEnv }), setting: settingOf({ configEnv }), flags: runnerFlags(process.execArgv), ...(narrowed() ? { filtered: true } : {}), ...workflow, date: new Date().toISOString(), tests };
    const w = config?.tests?.window;
    await record(root, run, { window: Number.isInteger(w) && w >= 2 && w <= MAX_WINDOW ? w : DEFAULTS.window });
    let opts;
    try { opts = testsConfigOf(config); }
    catch (e) { yield `${LABEL}: recorded; not judged: ${e.message}\n`; return; }
    const { runs, skipped } = await readRuns(root);
    yield `${hygiene(runs, opts, { preload: preloads(), skipped, here }).join('\n')}\n`;
  } catch (e) {
    yield `${LABEL}: could not record this run (${String(e?.message ?? e).split('\n')[0]}).\n`;
  } finally {
    if (empty) yield `${empty}\n`;
  }
}

// ---- JUnit: bun test and vitest (phase 59) ----------------------------------

const ENTITIES = Object.freeze({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" });

/** XML text with its entities read: the five named ones and character references; any other stays as written. */
export function xmlText(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (m, e) => {
    if (e[0] !== '#') return Object.hasOwn(ENTITIES, e) ? ENTITIES[e] : m;
    const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
}

const XNAME = '[A-Za-z_:][\\w:.-]*';
const OPEN = new RegExp(`<(${XNAME})`, 'y');
const ATTR = new RegExp(`\\s+(${XNAME})\\s*=\\s*(?:"([^"<]*)"|'([^'<]*)')`, 'y');
const OPEN_END = /\s*(\/?)>/y;
const END = new RegExp(`</(${XNAME})\\s*>`, 'y');

/**
 * A small XML reader, enough for JUnit: elements, their attributes (entities
 * read) and children. Text is retained for bounded, redacted failure snippets;
 * comments, CDATA, the declaration, processing instructions and a DOCTYPE are
 * skipped. What is not well formed throws: a tag left open, an end tag that
 * does not match, an attribute without a quoted value or given twice, a second
 * root, no root. Returns the root element: { name, attrs, children }.
 */
export function readXml(text) {
  const doc = { name: '#document', attrs: Object.create(null), children: [] };
  const stack = [doc];
  let i = 0;
  const fail = what => { throw new Error(`${what} (at character ${i})`); };
  const past = (end, what) => { const j = text.indexOf(end, i); if (j < 0) fail(`an unterminated ${what}`); i = j + end.length; };
  for (;;) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (stack.length > 1) stack.at(-1).text = (stack.at(-1).text ?? '') + xmlText(text.slice(i, lt));
    i = lt;
    if (text.startsWith('<!--', i)) past('-->', 'comment');
    else if (text.startsWith('<![CDATA[', i)) { const end = text.indexOf(']]>', i); if (end >= 0) stack.at(-1).text = (stack.at(-1).text ?? '') + text.slice(i + 9, end); past(']]>', 'CDATA section'); }
    else if (text.startsWith('<?', i)) past('?>', 'declaration');
    else if (text.startsWith('<!', i)) {
      const close = text.indexOf('>', i), bracket = text.indexOf('[', i);
      if (close < 0) fail('an unterminated DOCTYPE');
      if (bracket >= 0 && bracket < close) past(']>', 'DOCTYPE'); else i = close + 1;
    } else if (text[i + 1] === '/') {
      END.lastIndex = i;
      const m = END.exec(text);
      if (!m) fail('a malformed end tag');
      const open = stack.at(-1);
      if (stack.length === 1 || open.name !== m[1]) fail(`</${m[1]}> closes ${stack.length === 1 ? 'nothing' : `<${open.name}>`}`);
      stack.pop();
      i = END.lastIndex;
    } else {
      OPEN.lastIndex = i;
      const m = OPEN.exec(text);
      if (!m) fail('a malformed tag');
      const el = { name: m[1], attrs: Object.create(null), children: [] };
      i = OPEN.lastIndex;
      for (;;) {
        ATTR.lastIndex = i;
        const a = ATTR.exec(text);
        if (!a) break;
        if (Object.hasOwn(el.attrs, a[1])) fail(`<${el.name}> repeats ${a[1]}`);
        el.attrs[a[1]] = xmlText(a[2] ?? a[3]);
        i = ATTR.lastIndex;
      }
      OPEN_END.lastIndex = i;
      const c = OPEN_END.exec(text);
      if (!c) fail(`a malformed <${el.name}> (each attribute needs a quoted value)`);
      i = OPEN_END.lastIndex;
      if (stack.length === 1 && doc.children.length) fail('a second root element');
      stack.at(-1).children.push(el);
      if (!c[1]) stack.push(el);
    }
  }
  if (stack.length > 1) fail(`<${stack.at(-1).name}> is never closed`);
  if (!doc.children.length) fail('no root element');
  return doc.children[0];
}

/** The runner a JUnit document came from, by the <testsuites name> each writes ("bun test", "vitest tests"); else null. */
export function junitRunner(root) {
  const name = root?.attrs?.name;
  return name === 'bun test' ? 'bun' : name === 'vitest tests' ? 'vitest' : null;
}

/** A testcase's outcome: fail (a failure or an error), todo (bun's skipped message="TODO"), skip, or pass. */
const caseOutcome = c => {
  if (c.children.some(x => x.name === 'failure' || x.name === 'error')) return 'fail';
  const s = c.children.find(x => x.name === 'skipped');
  return s ? (s.attrs.message === 'TODO' ? 'todo' : 'skip') : 'pass';
};
const msOf = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n * 1000 : 0; };
const casesIn = el => el.children.flatMap(c => c.name === 'testcase' ? [c] : c.name === 'testsuite' ? casesIn(c) : []);

/**
 * Where a testcase sits at the top of its file: { name, describe }, its own
 * name, or its outermost describe's. bun names the describes in classname,
 * innermost first, joined by " > " and escaped twice; vitest in name,
 * outermost first, joined by " > ".
 */
export function topOf(c, runner) {
  const name = c.attrs.name ?? '';
  if (runner === 'bun') {
    const cls = c.attrs.classname ?? '';
    if (!cls) return { name, describe: false };
    const parts = cls.includes(' &gt; ') ? cls.split(' &gt; ') : cls.split(' > ');
    return { name: xmlText(parts.at(-1)), describe: true };
  }
  if (runner === 'vitest') {
    const parts = name.split(' > ');
    if (parts.length > 1) return { name: parts[0], describe: true };
  }
  return { name, describe: false };
}

/** One top-level test's outcome from its testcases': any fail fails it, else any pass passes it. */
const groupOutcome = os => os.length === 1 ? os[0] : os.includes('fail') ? 'fail' : os.includes('pass') ? 'pass' : os.every(o => o === 'todo') ? 'todo' : 'skip';

/**
 * A JUnit document's top-level tests, as the node reporter records them:
 * { tests: [{ file, name, outcome, ms }], ran, failed }. `ran` counts the
 * testcases that passed or failed (a file's own entry, vitest's for a file
 * that would not load, aside: it is recorded as the file, not a test),
 * `failed` every testcase that failed. A nested <testsuite> is a describe.
 * `fileOf` turns a JUnit path into the record's (root-relative).
 */
export function junitTests(root, runner, fileOf = f => f, { configEnv = [], env = process.env } = {}) {
  const redact = value => failureText(value, env, { configEnv });
  if (root?.name !== 'testsuites' && root?.name !== 'testsuite') throw new Error(`its root is <${root?.name}>, not <testsuites>`);
  const suites = root.name === 'testsuite' ? [root] : root.children.filter(e => e.name === 'testsuite');
  const tests = [];
  let ran = 0, failed = 0;
  const count = (c, own) => {
    const o = caseOutcome(c);
    if (o === 'fail') failed++;
    if (!own && (o === 'pass' || o === 'fail')) ran++;
    return o;
  };
  for (const suite of suites) {
    const groups = new Map();
    const add = (key, file, name) => groups.get(key) ?? groups.set(key, { file, name, describe: key.split('\u0000')[1] === 'd', outcomes: [], ms: 0 }).get(key);
    for (const child of suite.children) {
      const raw = child.attrs.file ?? suite.attrs.file ?? suite.attrs.name ?? '';
      const file = raw ? fileOf(raw) : null;
      if (child.name === 'testcase') {
        // vitest's entry for a file that would not load: named for the file, and failed. A test that merely shares
        // its file's name and passes is a test (bun writes no such entry at all).
        const own = runner === 'vitest' && Boolean(raw) && child.attrs.name === raw && caseOutcome(child) === 'fail';
        const top = own ? { name: file, describe: false } : topOf(child, runner);
        const g = add(`${file}\u0000${top.describe ? 'd' : 't'}\u0000${top.name}`, file, top.name);
        g.outcomes.push(count(child, own));
        const failure = child.children.find(c => ['failure', 'error'].includes(c.name));
        if (failure && !g.error) g.error = redact([failure.attrs.message, failure.text].filter(Boolean).join('\n'));
        g.ms += msOf(child.attrs.time);
      } else if (child.name === 'testsuite') {
        const name = child.attrs.name ?? '';
        const g = add(`${file}\u0000d\u0000${name}`, file, name);
        for (const c of casesIn(child)) { g.outcomes.push(count(c, false)); g.ms += msOf(c.attrs.time); const failure = c.children.find(x => ['failure', 'error'].includes(x.name)); if (failure && !g.error) g.error = redact([failure.attrs.message, failure.text].filter(Boolean).join('\n')); }
        if (child.attrs.time !== undefined) g.ms = msOf(child.attrs.time);
      }
    }
    for (const g of groups.values()) {
      if (g.outcomes.length) tests.push({ file: g.file, name: g.name, ...(g.describe ? { describe: true } : {}), outcome: groupOutcome(g.outcomes), ...(g.error ? { error: g.error } : {}), ms: Math.round(g.ms * 10) / 10 });
    }
  }
  return { tests, ran, failed };
}

/**
 * Read a JUnit file into the ledger, as the reporter records a node run, and
 * say the hygiene block: { lines, code }. `junit` is relative to `cwd` (the
 * folder the tests ran in), else .keel/keel.json "tests".junit, else JUNIT,
 * relative to the repo's root; `runner` is bun or vitest, else "tests".runner,
 * else what the file says; `status` is the runner's own exit code, or null.
 */
export async function junitRun({ junit, runner, status = null, cwd = process.cwd(), sample = busySample, start = null } = {}) {
  const root = rootOf(cwd);
  const knownConfig = await projectConfig(root, { redaction: true });
  const config = knownConfig ?? {};
  const configEnv = config.tests?.configEnv ?? [];
  const lines = [];
  const at = junit !== undefined ? resolve(cwd, junit) : resolve(root, typeof config?.tests?.junit === 'string' ? config.tests.junit : JUNIT);
  const inside = relative(root, at).split(sep).join('/');
  const shown = inside && !inside.startsWith('../') && !isAbsolute(inside) ? inside : at;
  // A report in the ledger's directory is ignored even by a run that records nothing (no tests, a stale file).
  if (shown.startsWith(`${RUNS}/`)) await ignoreRuns(root).catch(() => {});
  const done = (ran, failed) => {
    const empty = emptyRun(ran, config);
    if (empty) lines.push(empty);
    return { lines, code: empty ? 1 : status || (failed ? 1 : 0) };
  };
  let xml;
  try { xml = await readFile(at, 'utf8'); }
  catch (e) {
    if (e.code !== 'ENOENT') { lines.push(`${LABEL}: could not read ${shown} (${e.code ?? e.message}); nothing recorded.`); return { lines, code: status || 1 }; }
    lines.push(`${LABEL}: no JUnit file at ${shown}: the tests did not run, or wrote it elsewhere.`);
    return done(0, 0);
  }
  let parsed, kind;
  try {
    const doc = readXml(xml);
    const configured = RUNNERS.includes(config?.tests?.runner) && config.tests.runner !== 'node' ? config.tests.runner : undefined;
    const says = junitRunner(doc);
    kind = runner ?? configured ?? says;
    // A file that names its runner is read as that runner's: a stale "tests".runner or a wrong --runner would misread every name.
    if (says && kind !== says) throw new Error(`it is ${says}'s JUnit, but the runner is ${kind} (${runner ? '--runner' : '.keel/keel.json "tests".runner'}); say ${says}`);
    if (kind !== 'bun' && kind !== 'vitest') throw new Error('its runner is not known: pass --runner bun or --runner vitest');
    parsed = junitTests(doc, kind, f => relative(root, real(resolve(cwd, f))).split(sep).join('/'), { configEnv });
  } catch (e) {
    lines.push(`${LABEL}: ${shown} is not JUnit the ledger can read (${e.message}); nothing recorded.`);
    return { lines, code: status || 1 };
  }
  if (knownConfig === null) { lines.push(`${LABEL}: redaction configuration unavailable; nothing recorded.`); return done(parsed.ran, parsed.failed); }
  // The file's own identity: its path and its bytes. Two packages' identical reports at their own paths are two runs;
  // the same bytes at the same path again are one report read twice (stale).
  const hash = sha12(`${shown}\u0000${xml}`);
  let history = null;
  try { history = await readRuns(root); } catch { /* record() below says what is wrong with the directory */ }
  if (history?.runs.some(r => r.junit === hash)) {
    lines.push(`${LABEL}: ${shown} is one already recorded: the tests wrote no new one (bun writes none when no test ran), so this run is not counted.`);
    return done(0, 0);
  }
  if (!parsed.tests.length) return done(parsed.ran, parsed.failed); // nothing reported: nothing to remember
  try {
    const workflow = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW ? { workflow: process.env.GITHUB_WORKFLOW } : {};
    const here = relative(root, real(cwd)).split(sep).join('/') || '.';
    const run = {
      busy: busyBetween(start, await sample()),
      ...where(root, { exclude: shown === at ? [] : [shown] }), runner: kind, dir: here,
      config: configHash({ configEnv, preload: [], runner: kind }), setting: settingOf({ configEnv, preload: [] }),
      ...workflow, junit: hash, date: new Date().toISOString(), tests: parsed.tests,
    };
    const w = config?.tests?.window;
    await record(root, run, { window: Number.isInteger(w) && w >= 2 && w <= MAX_WINDOW ? w : DEFAULTS.window });
    let opts;
    try { opts = testsConfigOf(config); }
    catch (e) { lines.push(`${LABEL}: recorded; not judged: ${e.message}`); return done(parsed.ran, parsed.failed); }
    const { runs, skipped } = await readRuns(root);
    lines.push(...hygiene(runs, opts, { preload: [], skipped, here }));
  } catch (e) {
    lines.push(`${LABEL}: could not record this run (${String(e?.message ?? e).split('\n')[0]}).`);
  }
  return done(parsed.ran, parsed.failed);
}

export const USAGE = 'usage: node scripts/keel/test-ledger.mjs --junit <file> [--runner bun|vitest] [--status <exit code>] [--start <sample-json>] | --sample | --gate | --run <shell-command>';

/** The command line's { junit, runner?, status? }; throws on anything else. */
export function junitArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const eq = argv[i].indexOf('=');
    const flag = eq > 0 ? argv[i].slice(0, eq) : argv[i];
    const value = () => { const v = eq > 0 ? argv[i].slice(eq + 1) : argv[++i]; if (v === undefined || v === '') throw new Error(`${flag} needs a value`); return v; };
    if (flag === '--junit') out.junit = value();
    else if (flag === '--runner') out.runner = value();
    else if (flag === '--status') out.status = value();
    else if (flag === '--start') {
      const raw = eq > 0 ? argv[i].slice(eq + 1) : argv[++i];
      if (raw === undefined) throw new Error('--start needs a value');
      try { out.start = raw ? JSON.parse(raw) : null; } catch { throw new Error('--start must be sample JSON'); }
      if (out.start !== null && (typeof out.start !== 'object' || Array.isArray(out.start))) throw new Error('--start must be sample JSON');
    }
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (out.junit === undefined) throw new Error('--junit <file> is required');
  if (out.runner !== undefined && out.runner !== 'bun' && out.runner !== 'vitest') throw new Error('--runner must be bun or vitest');
  if (out.status !== undefined) {
    if (!/^\d{1,3}$/.test(out.status) || Number(out.status) > 255) throw new Error('--status must be an exit code, 0 to 255');
    out.status = Number(out.status);
  }
  return out;
}

// Run as a command (node scripts/keel/test-ledger.mjs --junit …), never when node loads it as a reporter.
if (process.argv[1] && real(resolve(process.argv[1])) === real(fileURLToPath(import.meta.url))) {
  if (process.argv[2] === '--gate' && process.argv.length === 3) {
    try {
      const config = await projectConfig(real(process.cwd()), { strict: true });
      const r = await timedCommand(config.check ?? 'npm run check', { stdio: 'inherit', configured: true });
      process.exitCode = r.status ?? 1;
    } catch (error) { process.stderr.write(`${LABEL}: ${error.message}\n`); process.exitCode = 2; }
  } else if (process.argv[2] === '--sample' && process.argv.length === 3) {
    try { process.stdout.write(JSON.stringify(await busySample()) + '\n'); }
    catch { process.stderr.write(`${LABEL}: start sample unavailable\n`); process.exitCode = 1; }
  } else if (process.argv[2] === '--run' && process.argv.length === 4) {
    const r = await timedCommand(process.argv[3], { stdio: 'inherit' });
    process.exitCode = r.status ?? 1;
  } else {
  let args = null;
  try { args = junitArgs(process.argv.slice(2)); }
  catch (e) { process.stderr.write(`${LABEL}: ${e.message}\n${USAGE}\n`); process.exitCode = 2; }
  if (args) {
    const { lines, code } = await junitRun(args);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = code;
  }
}
}
