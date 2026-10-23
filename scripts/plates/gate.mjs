// One gate result per commit, shared by every pass (plates phase 79; plates
// practice `night`; managed: plates render rewrites it). The design is plates's
// docs/research/2026-10-16-delivery.md, items 7 and 9 of "What is common".
//
//   node scripts/plates/gate.mjs [--ci] [--json]
//
// The gate, once per commit. Before running the project's check, it asks
// whether CI has already given this commit's result, and whether this commit
// needs the suite at all:
//
//   reused   an exact, clean, completed, successful result for HEAD, from the
//            gate workflow .plates/plates.json names (ci.gateWorkflow), a push to
//            the default branch, completed within 24 hours by default
//            (ci.gateReuse: "24-hours"). "until-change" removes only that age
//            limit; all evidence checks still apply. Its
//            plates-test-runs artifact holds the gate's own record: the same
//            command (its hash), this commit and tree, a clean tree, exit 0,
//            and test runs under it that ran at least one test and failed
//            none. Anything less runs the gate; the reason is said.
//   skipped  "skipped: docs only": every path changed since the last fully
//            tested commit (the newest first-parent ancestor with a reused-
//            grade result, at any age) is in .plates/plates.json
//            "delivery": { "docsOnly": [..] }. Never against the parent: a
//            code commit whose run was cancelled is never covered by a docs
//            commit after it. Recorded in .plates/test-runs as kind gate-skip.
//   ran      the check, through the test ledger's outer launcher
//            (test-ledger.mjs timedCommand), as `test-ledger.mjs --gate` runs it.
//
// --ci is CI's own gate step (check.yml): it produces the result, so it never
// reuses one; it may still skip a docs-only commit. Without --ci it is the
// loop's gate step and a project's pre-push hook ("pre-push": "node
// scripts/plates/gate.mjs"). The night's gate measure (improve.mjs gateRun)
// reuses through reusableGate below, and runs its own gate otherwise.
//
// Where reuse cannot apply, and why: a dirty tree (the loop's tree after a
// pull that changed findings) is never reused; a candidate branch (climb's
// and tend's guards, the robot's judge) is a tree CI never tested, so it runs
// its own gate. A judge's base gate tests the default branch's commit, but the
// judge job holds no token by design (the agent's code runs there), so it
// runs its own as well (docs/guide/the-night-shift.md, "One gate result").
//
// Exit codes: the gate's own (0 passed, reused or skipped; otherwise the
// check's exit), 2 a bad configuration or usage.
//
// It reads GitHub only through gh (PLATES_GH stands in for it), read-only, and
// an artifact's bytes only through the test history's bounded ZIP reader.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readCiGate, LEDGER_ARTIFACT } from './ci.mjs';
import { archiveEntries, unpack } from './test-history.mjs';
import { timedCommand, record, where, sha12 } from './test-ledger.mjs';
import { gateWorkflowOf, gateEnv, isMain, main } from './lib.mjs';

export const CHECK = 'npm run check';
export const DAY = 86_400_000;
/** What a docs-only commit records instead of running the suite. */
export const DOCS_ONLY = 'skipped: docs only';
/** How far back (first-parent commits) the docs-only rule looks for the last fully tested commit. */
export const DOCS_DEPTH = 20;
/** The largest plates-test-runs archive read: the test history's own bound. */
const MAX_BYTES = 256 * 1024 * 1024;
/**
 * Paths that are never docs only, whatever "delivery".docsOnly says (PR #174
 * review): what runs or configures the gate. Every file under .github/
 * (workflows and actions) and scripts/plates/ (plates's scripts); the repo's
 * own config files; a package manifest, lockfile or package-manager config at
 * any depth; and each file plates manages, as the committed .plates/lock.json
 * names it (a changed lock is itself protected, so a commit cannot drop a
 * file from it and skip the suite in the same breath).
 */
export const PROTECTED_DIRS = Object.freeze(['.github/', 'scripts/plates/']);
export const PROTECTED_FILES = Object.freeze(['.plates/plates.json', '.plates/lock.json', '.nvmrc', '.node-version', '.tool-versions']);
export const PROTECTED_NAMES = Object.freeze(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'bun.lock', 'bun.lockb', '.npmrc', '.yarnrc', '.yarnrc.yml']);
/** Extensions of files that run or configure: a glob whose last segment can end in one reaches code (config time). */
const CODE_EXTENSIONS = Object.freeze(['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'json', 'yml', 'yaml', 'sh', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'css', 'scss', 'html', 'vue', 'svelte', 'sql', 'toml', 'lock', 'lockb']);
/**
 * What docs only can ever be (PR #174 review, second finding), decided per
 * changed file whatever the list says: a text doc anywhere (DOC_EXTENSIONS),
 * or an image under docs/ (DOCS_IMAGES). Nothing else: no code or config
 * extension, no unknown one, no file without an extension (LICENSE, a
 * Makefile, a script), never a file git marks executable (100755) or a
 * symlink (120000). An allowlist, so an extension nobody listed runs the suite.
 */
export const DOC_EXTENSIONS = Object.freeze(['md', 'mdx', 'markdown', 'txt', 'rst', 'adoc', 'asciidoc']);
export const DOCS_IMAGES = Object.freeze(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg']);
const extOf = path => { const name = path.split('/').at(-1), dot = name.lastIndexOf('.'); return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''; };

/** Whether a changed file can be docs only: its extension and its git mode at HEAD (null when deleted) say, never the list. */
export function docsFile(path, mode) {
  if (mode !== null && mode !== undefined && mode !== '100644') return false;
  const ext = extOf(path);
  return DOC_EXTENSIONS.includes(ext) || (path.startsWith('docs/') && DOCS_IMAGES.includes(ext));
}

/** Whether a changed path is protected: never docs only. `managed` is plates's managed paths (lockedPaths). */
export function protectedPath(path, managed = []) {
  const name = path.split('/').pop();
  return PROTECTED_DIRS.some(d => path.startsWith(d)) || PROTECTED_FILES.includes(path) || PROTECTED_NAMES.includes(name) || managed.includes(path);
}

/** A glob segment as a regex (`**` kept as itself): what that segment of a path it matches can be. */
const segment = seg => seg === '**' ? '**' : new RegExp(`^${seg.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/**
 * What protected path an entry reaches, structurally, or null. A directory
 * entry or a glob's literal head overlaps a protected directory (either
 * contains the other); a protected file is matched as itself, a managed one
 * when the entry names it exactly; an
 * exact entry's name, or a glob's last segment, that can be a protected name
 * or end in a code extension reaches every such file. A plain directory entry
 * ("docs/") may hold a nested package.json: protectedPath refuses that file
 * when it changes.
 */
function reaches(entry, managed) {
  const glob = entry.includes('*');
  const head = glob ? entry.slice(0, entry.indexOf('*')) : entry;
  for (const d of PROTECTED_DIRS) {
    if (entry.endsWith('/') || glob ? head && (d.startsWith(head) || head.startsWith(d)) : entry.startsWith(d)) return d;
  }
  const test = matcher(entry);
  for (const f of PROTECTED_FILES) if (test(f)) return f;
  // A managed file is refused when named; "docs/" may hold plates's templates, which protectedPath refuses when they change.
  if (managed.includes(entry)) return entry;
  if (entry.endsWith('/')) return null;
  const last = glob ? segment(entry.split('/').at(-1)) : null;
  const can = name => last === null ? entry.split('/').at(-1) === name : last === '**' || last.test(name);
  for (const name of PROTECTED_NAMES) if (can(name)) return name;
  if (glob) for (const ext of CODE_EXTENSIONS) if (can(`acme.${ext}`)) return `any .${ext} file`;
  // An exact entry names one file, and a glob's literal tail its extension: either must be a text doc (docsFile).
  if (!glob && !docsFile(entry, null)) return `${entry}, which is not a text doc (${DOC_EXTENSIONS.map(e => `.${e}`).join(' ')})`;
  const tail = glob ? entry.slice(entry.lastIndexOf('*') + 1) : '';
  if (glob && tail.includes('.') && !docsFile(`docs/acme${tail.slice(tail.lastIndexOf('.'))}`, null)) return `files ending ${tail}, which are not text docs`;
  return null;
}

export class GateError extends Error {
  constructor(message, exitCode = 2) { super(message); this.exitCode = exitCode; }
}

// ---- docs only -------------------------------------------------------------------

/** A docs-only entry as a test: "dir/" a prefix, a glob (`*` within a segment, `**` across), else one exact path. */
function matcher(entry) {
  if (entry.endsWith('/')) return p => p.startsWith(entry);
  if (!entry.includes('*')) return p => p === entry;
  const re = new RegExp(`^${entry.split('**').map(part => part.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')}$`);
  return p => re.test(p);
}

/**
 * .plates/plates.json "delivery": { "docsOnly": [path] }: { paths, test } when
 * set, null when not, or a throw (exit 2) naming what is wrong. An entry is
 * repo-relative, never `..`, and never reaches a protected path (reaches:
 * the PROTECTED_* sets, and `managed`, plates's files from .plates/lock.json).
 */
export function docsOnlyOf(config, { managed = [] } = {}) {
  const d = config?.delivery;
  if (d === undefined || d?.docsOnly === undefined) return null;
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new GateError('.plates/plates.json "delivery" must be an object');
  const list = d.docsOnly;
  if (!Array.isArray(list) || !list.length || list.some(p => typeof p !== 'string' || !p.trim() || p !== p.trim() || p.startsWith('/') || p.split('/').some(s => s === '..' || s === '.') || p.includes('\\'))) {
    throw new GateError('.plates/plates.json "delivery".docsOnly must be a list of repo-relative paths ("docs/", "README.md", "**/*.md")');
  }
  const tests = list.map(matcher);
  const test = p => tests.some(t => t(p));
  for (const entry of list) {
    const reached = reaches(entry, managed);
    if (reached) throw new GateError(`.plates/plates.json "delivery".docsOnly ${JSON.stringify(entry)} reaches ${reached}: a docs-only list never covers code, plates's scripts, workflows or the gate's own files`);
  }
  return { paths: list, test };
}

// ---- git ---------------------------------------------------------------------------

function git(root, env, args) {
  const r = spawnSync(env.PLATES_GIT || 'git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new GateError(`could not run git: ${r.error.message}`);
  return r;
}
const gitOut = (root, env, args) => { const r = git(root, env, args); return r.status === 0 ? r.stdout.trim() : null; };

/** HEAD's commit and tree, and whether the tree is clean (untracked files count, as the night's reuse always did). */
export function revision(root, env = process.env) {
  const sha = gitOut(root, env, ['rev-parse', 'HEAD']) ?? '';
  const tree = sha ? gitOut(root, env, ['rev-parse', 'HEAD^{tree}']) ?? '' : '';
  const status = sha ? gitOut(root, env, ['status', '--porcelain', '--untracked-files=all']) : null;
  return { sha, tree, clean: status === '' };
}

/**
 * plates's managed paths, from HEAD's committed .plates/lock.json ("AGENTS.md#night"
 * is AGENTS.md): the committed lock, never the working tree's. [] without a
 * lock; a throw (exit 2) when it cannot be read, since then nothing is known safe.
 */
export function lockedPaths(root, env = process.env) {
  const r = git(root, env, ['show', 'HEAD:.plates/lock.json']);
  if (r.status !== 0) return [];
  let files;
  try { files = JSON.parse(r.stdout).files; } catch { throw new GateError('.plates/lock.json is not JSON: which files plates manages cannot be told, so nothing is docs only'); }
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new GateError('.plates/lock.json has no "files": which files plates manages cannot be told');
  return [...new Set(Object.keys(files).map(k => k.split('#')[0]))];
}

// ---- the ledger's evidence ---------------------------------------------------------

const ran = t => t?.outcome === 'pass' || t?.outcome === 'fail';
const notGate = r => !['gate', 'gate-skip', 'stalls'].includes(r?.kind);

/**
 * Whether a CI run's ledger records are a passing gate of `command` on
 * exactly `sha` and `tree`: { kind: 'ledger', gate, tests } (its test runs
 * kept, not enumerated, as `.runs`), or { reason }. Never weaker than running
 * it: another command, another tree, a dirty tree, a narrowed run, a run with
 * no test (the ledger's "no test ran" rule) or a failed test is no result.
 */
export function ledgerEvidence(records, { sha, tree, command }) {
  const hash = sha12(command);
  const gates = records.filter(r => r?.kind === 'gate' && r.commit === sha);
  if (!gates.length) return { reason: `the ${LEDGER_ARTIFACT} artifact holds no gate record of ${sha.slice(0, 7)} (the gate step runs scripts/plates/gate.mjs --ci or test-ledger.mjs --gate)` };
  if (gates.length > 1) return { reason: `the ${LEDGER_ARTIFACT} artifact holds ${gates.length} gate records of ${sha.slice(0, 7)}: which one is CI's cannot be told` };
  const g = gates[0];
  if (g.tree !== tree) return { reason: "CI's gate record names another tree" };
  if (g.dirty !== false) return { reason: "CI's gate ran on a dirty (or unknown) tree" };
  if (g.commandHash !== hash || g.gateSource !== 'configured-check' || g.provenance?.outerCommandHash !== hash) return { reason: `CI's gate ran another command than \`${command}\`` };
  if (g.completed !== true || typeof g.invocationId !== 'string' || !g.invocationId || g.provenance?.invocationId !== g.invocationId) return { reason: "CI's gate record is incomplete" };
  if (g.status !== 0) return { reason: `CI's gate exited ${g.status ?? g.signal ?? 'unknown'}` };
  const runs = records.filter(r => notGate(r) && r.parentInvocationId === g.invocationId && Array.isArray(r.tests));
  if (runs.some(r => r.commit !== sha || r.tree !== tree || r.dirty !== false)) return { reason: "a test run under CI's gate names another commit or tree, or a dirty one" };
  if (runs.some(r => r.filtered)) return { reason: "a test run under CI's gate was narrowed (--test-name-pattern, --test-only)" };
  const tests = runs.flatMap(r => r.tests);
  if (!tests.some(ran)) return { reason: "no test ran under CI's gate (the ledger's \"no test ran\" rule): a green run of nothing is not a gate that passed" };
  const failed = tests.filter(t => t?.outcome === 'fail').length;
  if (failed) return { reason: `${failed} test${failed === 1 ? '' : 's'} failed under CI's gate though it exited 0` };
  const evidence = { kind: 'ledger', gate: g.invocationId, tests: tests.filter(ran).length };
  Object.defineProperty(evidence, 'runs', { value: runs, enumerable: false });
  return evidence;
}

/** The artifact's bytes through gh (read-only), as the test history downloads them. */
function ghDownload(repo, env) {
  return id => {
    const r = spawnSync(env.PLATES_GH || 'gh', ['api', `repos/${repo}/actions/artifacts/${id}/zip`], { env, encoding: 'buffer', timeout: 60_000, maxBuffer: MAX_BYTES });
    if (r.error || r.status !== 0) throw new Error('artifact download unavailable');
    return r.stdout;
  };
}

/** readCiGate's verify: the run's one plates-test-runs artifact, read in bounds, then ledgerEvidence. */
function ledgerVerifier({ repo, sha, tree, command, download }) {
  return async ({ client, run }) => {
    if (run.conclusion !== 'success') return { reason: `CI's run on ${sha.slice(0, 7)} concluded ${run.conclusion}: only a success is reused` };
    try {
      const listed = await client.pages(`repos/${repo}/actions/runs/${run.id}/artifacts`, 'artifacts', 'runPages');
      if (!client.coverage.complete) return { reason: "the CI run's artifact list is incomplete" };
      const named = listed.filter(a => a?.name === LEDGER_ARTIFACT);
      if (named.length !== 1) return { reason: named.length ? `the CI run kept ${named.length} ${LEDGER_ARTIFACT} artifacts: which is the gate's cannot be told` : `the CI run kept no ${LEDGER_ARTIFACT} artifact (its workflow needs the test ledger's upload step)` };
      const a = named[0];
      if (a.expired !== false || a.workflow_run?.id !== run.id || a.workflow_run?.head_sha !== sha || !Number.isSafeInteger(a.size_in_bytes) || a.size_in_bytes < 1 || a.size_in_bytes > MAX_BYTES) return { reason: `the ${LEDGER_ARTIFACT} artifact is expired, oversized or not this run's` };
      const zip = await download(a.id);
      if (a.digest != null && (!/^sha256:[a-f0-9]{64}$/.test(a.digest) || `sha256:${createHash('sha256').update(zip).digest('hex')}` !== a.digest)) return { reason: `the ${LEDGER_ARTIFACT} archive does not match its digest` };
      const { entries } = archiveEntries(zip, MAX_BYTES);
      const records = entries.filter(e => e.name.endsWith('.json') && !e.name.includes('/')).map(e => { try { return JSON.parse(unpack(zip, e)); } catch { return null; } }).filter(Boolean);
      return ledgerEvidence(records, { sha, tree, command });
    } catch (e) { return { reason: `the ${LEDGER_ARTIFACT} artifact is unreadable (${String(e?.message ?? e).split('\n')[0]})` }; }
  };
}

/** The reuse policy changes age alone; even an explicit window must validate it. */
function gateReuseAge(config) {
  const policy = config?.ci?.gateReuse;
  if (policy === undefined || policy === '24-hours') return DAY;
  if (policy === 'until-change') return Infinity;
  throw new GateError('.plates/plates.json "ci".gateReuse must be "24-hours" or "until-change"');
}

/**
 * CI's result for `sha` (its tree `tree`), reused only as the module's
 * header says: { reused: true, source: 'github-actions', workflow, runId,
 * attempt, sha, conclusion, ageMs, completedAt, status: 0, tests,
 * testEvidence } or { reused: false, reason }. Needs .plates/plates.json `repo`
 * and an explicit ci.gateWorkflow (discovery never authorizes reuse).
 * `maxAgeMs` overrides ci.gateReuse (24 hours by default, Infinity for
 * "until-change"); the docs-only rule's base has none. Policy is always validated.
 */
export async function ciResult({ config, sha, tree, clean, env = process.env, now = Date.now(), maxAgeMs, request, download, limits }) {
  const policyAge = gateReuseAge(config);
  if (maxAgeMs === undefined) maxAgeMs = policyAge;
  const named = gateWorkflowOf(config);
  if (named?.problem) throw new GateError(named.problem);
  if (!named) return { reused: false, reason: 'no explicitly configured CI workflow (.plates/plates.json ci.gateWorkflow)' };
  if (!config.repo) return { reused: false, reason: 'no repo in .plates/plates.json' };
  const command = config.check ?? CHECK;
  const r = await readCiGate({ repo: config.repo, workflow: named.name, sha, clean, env, now, maxAgeMs, limits, request,
    verify: ledgerVerifier({ repo: config.repo, sha, tree, command, download: download ?? ghDownload(config.repo, env) }) });
  if (!r.reused) return r;
  return { ...r, tests: r.testEvidence.tests };
}

/** The same, for the checkout's HEAD: what the night's gate measure and this script's default mode ask. */
export async function reusableGate({ root, config, env = process.env, now = Date.now(), request, download }) {
  const { sha, tree, clean } = revision(root, env);
  return ciResult({ config, sha, tree, clean, env, now, request, download });
}

/**
 * The docs-only rule: { skip: true, base, changed } when HEAD (clean) changes
 * only docsOnly paths since the newest first-parent ancestor CI fully tested,
 * else { skip: false, reason }. Walks at most DOCS_DEPTH ancestors and stops
 * at the first that is not docs-only away from HEAD: any older base would
 * carry that change too.
 */
export async function docsOnlySkip({ root, config, env = process.env, now = Date.now(), request, download, depth = DOCS_DEPTH }) {
  if (!docsOnlyOf(config)) return { skip: false, reason: 'no "delivery".docsOnly in .plates/plates.json' };
  const managed = lockedPaths(root, env);
  const docs = docsOnlyOf(config, { managed });
  // Every path's mode at a commit ("100755" an executable, "120000" a symlink): HEAD's once, each base's as it is tried.
  const modesAt = rev => new Map((gitOut(root, env, ['ls-tree', '-r', '-z', '--full-tree', rev]) ?? '').split('\0').filter(Boolean).map(l => { const tab = l.indexOf('\t'); return [l.slice(tab + 1), l.split(' ')[0]]; }));
  const modes = modesAt('HEAD');
  const { sha, clean } = revision(root, env);
  if (!sha || !clean) return { skip: false, reason: 'the tree is dirty or has no commit: docs-only is decided for a commit' };
  const ancestors = (gitOut(root, env, ['rev-list', '--first-parent', `--max-count=${depth + 1}`, 'HEAD']) ?? '').split('\n').filter(Boolean).slice(1);
  for (const base of ancestors) {
    const changed = (gitOut(root, env, ['diff', '--name-only', '--no-renames', '-z', base, sha]) ?? '\0code').split('\0').filter(Boolean);
    // A protected path is never docs only, even when a pattern reached it: the config check is the first line, this the last.
    const guarded = changed.filter(p => protectedPath(p, managed));
    if (guarded.length) return { skip: false, reason: `${guarded[0]}${guarded.length > 1 ? ` and ${guarded.length - 1} more` : ''} changed since ${base.slice(0, 7)} and is protected (it runs or configures the gate): never docs only` };
    // Each file by its own extension and its mode on both sides (plates#177): deleting an executable or a
    // symlink, or removing an executable bit, is not a text doc changing, whatever the list says.
    const before = modesAt(base);
    const notDocs = changed.filter(p => !docsFile(p, modes.get(p) ?? null) || !docsFile(p, before.get(p) ?? null));
    if (notDocs.length) return { skip: false, reason: `${notDocs[0]}${notDocs.length > 1 ? ` and ${notDocs.length - 1} more` : ''} changed since ${base.slice(0, 7)} and is not a text doc (an extension of ${DOC_EXTENSIONS.join(', ')}, or an image under docs/, never executable): not docs only` };
    const code = changed.filter(p => !docs.test(p));
    if (code.length) return { skip: false, reason: `${code[0]}${code.length > 1 ? ` and ${code.length - 1} more` : ''} changed since ${base.slice(0, 7)}, the newest commit CI could have tested before it: not docs only` };
    const tree = gitOut(root, env, ['rev-parse', `${base}^{tree}`]) ?? '';
    const tested = await ciResult({ config, sha: base, tree, clean: true, env, now, maxAgeMs: Infinity, request, download });
    if (tested.reused) return { skip: true, base, changed, runId: tested.runId };
  }
  return { skip: false, reason: `no fully tested commit within ${depth} first-parent commits of HEAD that it is docs-only away from` };
}

/** The gate-skip record a docs-only commit leaves in .plates/test-runs (never a test run, never a gate time). */
export async function recordSkip(root, { skip, command }) {
  const at = where(root);
  return record(root, { ...at, kind: 'gate-skip', runner: 'gate', dir: '.', config: null, skipped: DOCS_ONLY, base: skip.base, changed: skip.changed.length,
    commandHash: sha12(command), gateSource: 'configured-check', completed: true, status: 0, date: new Date().toISOString(), tests: [] });
}

/**
 * The gate, once: reuse CI's result (not with ci), else skip a docs-only
 * commit, else run the check. { action: reused|skipped|ran, status, reason?, … }.
 */
export async function gate({ root, config, env = process.env, ci = false, now = Date.now(), stdio = 'inherit', request, download }) {
  gateReuseAge(config);
  const command = config.check ?? CHECK;
  const reasons = [];
  if (!ci) {
    const reuse = await reusableGate({ root, config, env, now, request, download });
    if (reuse.reused) return { action: 'reused', command, status: 0, ...reuse };
    reasons.push(`not reused: ${reuse.reason}`);
  }
  const skip = await docsOnlySkip({ root, config, env, now, request, download });
  if (skip.skip) {
    await recordSkip(root, { skip, command });
    return { action: 'skipped', command, status: 0, skipped: DOCS_ONLY, base: skip.base, changed: skip.changed };
  }
  if (docsOnlyOf(config)) reasons.push(`not skipped: ${skip.reason}`);
  // Never a test runner's context (lesson 14); the project's .plates/plates.json `env` over it. CI's step
  // holds GH_TOKEN for the docs-only read alone: the check runs without it, as it did before this script.
  const own = ci ? Object.fromEntries(Object.entries(env).filter(([k]) => k !== 'GH_TOKEN')) : env;
  const r = await timedCommand(command, { cwd: root, env: gateEnv(own, config), preparedEnv: true, configured: true, stdio });
  if (r.error) throw new GateError(`could not run \`${command}\`: ${r.error.message}`);
  return { action: 'ran', command, status: r.status ?? 1, signal: r.signal ?? null, ms: r.ms, reasons };
}

/** What the gate says it did, one line. */
export function gateLine(g) {
  if (g.action === 'reused') return `plates gate: reused CI's result for ${g.sha.slice(0, 7)} (${g.workflow} run ${g.runId}, attempt ${g.attempt}, ${Math.round(g.ageMs / 60000)} minutes old): \`${g.command}\` passed with ${g.tests} tests; not run here`;
  if (g.action === 'skipped') return `plates gate: ${DOCS_ONLY}: the ${g.changed.length} path${g.changed.length === 1 ? '' : 's'} changed since ${g.base.slice(0, 7)} (the last fully tested commit) are all in "delivery".docsOnly`;
  return `plates gate: ran \`${g.command}\`: exit ${g.status}${g.reasons.length ? ` (${g.reasons.join('; ')})` : ''}`;
}

if (isMain(import.meta)) {
  await main(async args => {
    const ci = args.includes('--ci');
    const unknown = args.filter(a => a !== '--ci');
    if (unknown.length) throw new GateError(`unknown argument ${unknown[0]}; usage: node scripts/plates/gate.mjs [--ci] [--json]`);
    const root = process.cwd();
    let config;
    try { config = JSON.parse(await readFile(join(root, '.plates', 'plates.json'), 'utf8')); }
    catch (e) { throw new GateError(`cannot read .plates/plates.json (${e.code ?? 'invalid JSON'})`); }
    if (config.check !== undefined && (typeof config.check !== 'string' || !config.check.trim())) throw new GateError('.plates/plates.json "check" must be a shell command');
    const g = await gate({ root, config, ci, stdio: process.argv.includes('--json') ? [0, 2, 2] : 'inherit' }); // under --json the check's own output goes to stderr
    return { data: g, text: gateLine(g), exitCode: g.status };
  });
}
