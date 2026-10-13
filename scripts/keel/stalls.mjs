// keel's stalls (keel practice `night`; managed: keel render rewrites it).
// A test that judges the wall clock passes on a quiet machine and fails on a
// busy one, and the usual "fix" is a longer sleep: still the wall clock, only
// slower. Stalls make the busy machine on purpose, so such a test fails every
// time and can be named (keel phase 55; docs/research/2026-10-09-robot-and-time.md).
//
// runFiles() runs `node --test` over some files in a process group of its own
// (spawned detached). Given a seed, it pauses the whole group at seeded
// moments: SIGSTOP to the negative pid (the runner, each test file's process,
// and anything they spawned), for 50 to 500 ms, then SIGCONT. The first stall
// comes 0 to 1 s in, and each next one 500 to 1500 ms after the last ended:
// about once a second, never two seconds apart. The same seed gives the same
// stalls, at the same offsets as near as the machine's timers allow. Paused
// time is not counted against the timeout: node --test runs without one, and
// this keeps its own, of the group's running time only.
//
// It is used twice: by `keel test <file> --stalls`, which compares a run with
// stalls against a plain one and names each test that passed plainly and
// failed with stalls (it judges the wall clock); and by the test ledger,
// which runs each file pinned in .keel/keel.json "tests": { "stalls": [...] }
// with stalls on every gate, from a fresh seed it prints on a failure.
//
// The default export is the reporter those runs use: one line per top-level
// test, `keel-stalls {file, name, outcome, ms, error?}`. A passing test that
// said `t.diagnostic('keel:inconclusive <what it measured>')` is inconclusive:
// it judges real time on purpose and the machine kept it from judging.
//
// KEEL_STALLS_SHAPE is a test seam, like KEEL_GH: JSON { firstMs, gapMs,
// stallMs }, each [low, high] in ms, replaces the shape above, so keel's own
// tests can land a stall inside a 50 ms wait every time. Never set it in a gate.
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { topLevel, executed, shellWords, flagsIn, runnerFlags, PRELOADS } from './test-ledger.mjs';

export { shellWords, runnerFlags };

export const SHAPE = Object.freeze({ firstMs: [0, 1000], gapMs: [500, 1500], stallMs: [50, 500] });
/** A run's limit, of running time: paused time never counts. */
export const TIMEOUT_MS = 30 * 60_000;
export const MARK = 'keel-stalls ';
/** The reporter's last line: how many tests executed (a file's own entry, a suite and a skip are not tests). */
export const RAN = 'keel-stalls-ran ';
export const REPORTER = fileURLToPath(import.meta.url);

/** A fresh seed: a whole number, 1 to 2^31 - 1, printed so a failure can be replayed. */
export const freshSeed = () => randomInt(1, 2 ** 31 - 1);

/** A seed as given (`--seed N`): a whole number, 0 to 2^32 - 1; otherwise null. */
export function seedOf(value) {
  const n = typeof value === 'number' ? value : /^\d+$/.test(String(value ?? '')) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}

/** A small seeded generator (mulberry32): the same seed, the same numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The stalls a seed gives, forever: { gap, ms }, gap being the wait before it (from the start, or from the last stall's end). */
export function* stallsOf(seed, shape = SHAPE) {
  const next = rng(seed);
  const pick = ([lo, hi]) => Math.round(lo + next() * (hi - lo));
  for (let first = true; ; first = false) yield { gap: pick(first ? shape.firstMs : shape.gapMs), ms: pick(shape.stallMs) };
}

/** The first `n` stalls of a seed. */
export function planOf(seed, n, shape = SHAPE) {
  const out = [];
  for (const s of stallsOf(seed, shape)) { if (out.length >= n) break; out.push(s); }
  return out;
}

/** The shape, from KEEL_STALLS_SHAPE when it is set (a test seam); a bad one throws. */
export function shapeOf(env = process.env) {
  const raw = env.KEEL_STALLS_SHAPE;
  if (!raw) return SHAPE;
  let s;
  try { s = JSON.parse(raw); } catch { throw new Error('KEEL_STALLS_SHAPE is not JSON'); }
  const ok = r => Array.isArray(r) && r.length === 2 && r.every(x => Number.isFinite(x) && x >= 0) && r[0] <= r[1];
  const shape = { ...SHAPE, ...s };
  for (const k of Object.keys(SHAPE)) if (!ok(shape[k])) throw new Error(`KEEL_STALLS_SHAPE.${k} must be [low, high] in ms`);
  return shape;
}

/** The words after `node` in a test script (package.json's scripts.test), to its first `&&`, `||`, `;` or `|`. */
function nodeWords(script) {
  const words = shellWords(script);
  const at = words.findIndex(w => /(^|[\\/])node(\.exe)?$/.test(w));
  if (at < 0) return [];
  const rest = words.slice(at + 1);
  const end = rest.findIndex(w => ['&&', '||', ';', '|'].includes(w));
  return end < 0 ? rest : rest.slice(0, end);
}

/** The flags of a test script a file runs with, so it runs as the suite runs it: preloads, conditions, setup and the rest. */
export const flagsOfScript = script => runnerFlags(nodeWords(script));
/** A test script's --import/--require preloads, as written: what the test ledger's config hash reads. */
export const preloadsOfScript = script => flagsIn(nodeWords(script)).filter(f => PRELOADS.has(f.name)).flatMap(f => f.words);

/** Never a test runner's context: its node --test would run nothing and pass (lesson 14). */
const runnerFree = env => Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('NODE_TEST_') && k !== 'KEEL_STALLS_SHAPE'));

/**
 * Run `files` under `node --test` in a process group of its own; with a
 * `seed`, stall it. Returns { seed, exitCode, signal, timedOut, wall,
 * paused, active, stalls: [{ at, ms, start, end }], tests: [{ file, name,
 * outcome, ms, error? }], stderr }. `at` is the stall's offset from the
 * start; start and end are the epoch ms it was paused and resumed. A file is
 * said relative to `root`.
 */
export async function runFiles({ files, cwd = process.cwd(), root = cwd, name, preload = [], env = process.env, seed = null, shape = shapeOf(env), timeoutMs = TIMEOUT_MS }) {
  if (process.platform === 'win32') throw new Error('stalls need process groups (SIGSTOP), which Windows does not have');
  const args = [...preload, '--test', `--test-reporter=${REPORTER}`, '--test-reporter-destination=stdout', ...(name ? [`--test-name-pattern=${name}`] : []), ...files];
  const t0 = Date.now();
  const child = spawn(process.execPath, args, { cwd, env: runnerFree(env), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const group = child.pid;
  let out = '', err = '';
  child.stdout.setEncoding('utf8').on('data', s => { out += s; });
  child.stderr.setEncoding('utf8').on('data', s => { err += s; });
  let done = false, paused = 0, stoppedAt = null, timedOut = false;
  const stalls = [];
  const closed = new Promise(res => {
    child.on('error', e => { done = true; res({ code: null, sig: null, error: e }); });
    child.on('close', (code, sig) => { done = true; res({ code, sig }); });
  });
  const signal = sig => { try { process.kill(-group, sig); return true; } catch { return false; } };
  const resume = () => {
    if (stoppedAt === null) return;
    signal('SIGCONT');
    const end = Date.now();
    paused += end - stoppedAt;
    stalls.at(-1).end = end;
    stoppedAt = null;
  };
  // A stopped group outlives this process if it ends mid-stall: never leave one stopped.
  // node emits no 'exit' when a signal ends it, so SIGINT and SIGTERM end the group
  // too (it is detached: the terminal's ^C never reaches it), resume it, and go on
  // to whatever else handles the signal, or to the default: this process ends.
  // A run cut short by this process's own exit ends the group too: never left stopped, never left running.
  const onExit = () => { if (done) return; signal('SIGTERM'); signal('SIGCONT'); };
  const onSignal = sig => {
    signal(sig);
    signal('SIGCONT');
    stoppedAt = null;
    release();
    if (!process.listenerCount(sig)) process.kill(process.pid, sig);
  };
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  const handlers = SIGNALS.map(sig => [sig, () => onSignal(sig)]);
  const release = () => {
    process.off('exit', onExit);
    for (const [sig, h] of handlers) process.off(sig, h);
  };
  process.on('exit', onExit);
  for (const [sig, h] of handlers) process.on(sig, h);
  const wait = ms => new Promise(r => { const t = setTimeout(r, ms); closed.then(() => { clearTimeout(t); r(); }); });
  const running = () => Date.now() - t0 - paused - (stoppedAt === null ? 0 : Date.now() - stoppedAt);
  const watchdog = setInterval(() => { if (!done && running() > timeoutMs) { timedOut = true; signal('SIGKILL'); } }, 50);
  const stalling = seed === null ? Promise.resolve() : (async () => {
    for (const s of stallsOf(seed, shape)) {
      await wait(s.gap);
      if (done || !signal('SIGSTOP')) return;
      stoppedAt = Date.now();
      stalls.push({ at: stoppedAt - t0, ms: s.ms, start: stoppedAt, end: null });
      await wait(s.ms);
      resume();
      if (done) return;
    }
  })();
  const { code, sig, error } = await closed;
  clearInterval(watchdog);
  await stalling;
  resume();
  signal('SIGCONT'); // anything the group left behind runs on, never stopped
  release();
  if (error) throw new Error(`could not run node --test: ${error.message}`);
  let base = root;
  try { base = realpathSync(root); } catch { /* as given */ }
  const tests = [];
  let ran = 0;
  for (const line of out.split('\n')) {
    if (line.startsWith(RAN)) { ran = Number(line.slice(RAN.length)) || 0; continue; }
    if (!line.startsWith(MARK)) continue;
    try {
      const t = JSON.parse(line.slice(MARK.length));
      tests.push({ ...t, file: t.file ? relative(base, t.file).split(sep).join('/') : null });
    } catch { /* not ours */ }
  }
  const wall = Date.now() - t0;
  return { seed, exitCode: code, signal: sig, timedOut, wall, paused, active: wall - paused, stalls, tests, ran, stderr: err.trim().split('\n').slice(-20).join('\n') };
}

/** Each test's key: its file, its name, and which of that file's tests of that name it is (names can repeat). */
const keyed = tests => {
  const seen = new Map();
  return tests.map(t => {
    const k = `${t.file ?? ''}\u0000${t.name}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return [`${k}\u0000${n}`, t];
  });
};

/**
 * A plain run's outcomes against a stalled run's: `named` passed plainly and
 * failed with stalls (it judges the wall clock); `both` failed in each (a
 * plain failure: stalls cannot judge it); `unbased` failed with stalls and
 * was inconclusive (or absent) without them: there is no pass to compare
 * with, so it is never named; `inconclusive` said the machine kept it from
 * judging with stalls; `missing` ran plainly and not with stalls.
 */
export function judge(plain, stalled) {
  const before = new Map(keyed(plain));
  const after = new Map(keyed(stalled));
  const named = [], both = [], unbased = [], inconclusive = [], missing = [];
  for (const [k, t] of after) {
    const p = before.get(k);
    if (t.outcome === 'inconclusive') inconclusive.push(t);
    if (t.outcome !== 'fail') continue;
    if (p?.outcome === 'pass') named.push({ ...t, plain: p.outcome });
    else if (p?.outcome === 'fail') both.push(t);
    else unbased.push({ ...t, plain: p?.outcome ?? null });
  }
  for (const [k, p] of before) if ((p.outcome === 'pass' || p.outcome === 'fail') && !after.has(k)) missing.push(p);
  return { named, both, unbased, inconclusive, missing };
}

/** A word for the shell: as it is when it is plainly safe, else single-quoted. */
export const shellWord = s => (/^[\w@%+=:,./-]+$/.test(String(s)) ? String(s) : `'${String(s).replaceAll("'", "'\\''")}'`);

/** The command that replays a run's stalls, each word quoted for the shell. */
export const replay = (files, seed, name) => `keel test ${files.map(shellWord).join(' ')}${name ? ` --name ${shellWord(name)}` : ''} --stalls --seed ${seed}`;

/** The reporter a stalled (or plain) run uses: one marked line per top-level test, at the end. */
export default async function* stallsReporter(source) {
  const top = topLevel({ errors: true });
  let ran = 0;
  for await (const e of source) {
    if (executed(process.cwd(), e)) ran++;
    top.push(e);
  }
  for (const t of top.tests) yield `${MARK}${JSON.stringify(t)}\n`;
  yield `${RAN}${ran}\n`;
}
