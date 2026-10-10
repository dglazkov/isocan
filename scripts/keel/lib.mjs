// What the night shift's scripts share (keel practice `night`; managed: keel
// render rewrites it). Node built-ins only: this runs in the project's own
// checkout, with no keel anywhere (keel docs/design.md §6, "Projects run on
// their own"). keel's own CLI imports these same functions, so a rule is
// written once.
//
//   lockDrift(root)          managed files whose bytes are not what keel wrote
//                            (.keel/lock.json); `behind` needs keel's templates
//                            and is keel-side only (keel doctor)
//   phaseLints(root, parse, specProblems)  a phase the roadmap parser rejects
//                            or its --check refuses, a duplicate phase
//                            number, a goal no phase serves
//   claudeMdLint(text)       a CLAUDE.md that is more than a pointer
//   lessonsTableShapes(text, path)  prose between numbered rows, a second
//                            header row, a stranded row (keel doctor reads
//                            these from here too)
//   lessonsTableSplit(text, path)  a blank line inside the lessons table:
//                            the numbered rows after it render as text
//   parseLessons(text)       the lesson rows of a lessons table, and which
//                            column is the guard (keel lessons, fleet, learn
//                            and improve all read the table with this one);
//                            keel's catalogue's fifth column, Where, too
//   lessonFingerprint(project, row)  a row's identity in .keel/sent.json, the
//                            one keel lessons files under and improve counts by
//   unsentLessons(root, config)  the rows of the lessons table not yet sent home
//   secondCopies(root, …)    a second copy of a managed skill (lesson 1)
//   gateEnv(env, config)     the environment the project's gate runs in:
//                            NODE_TEST_* stripped (lesson 14), .keel/keel.json
//                            `env` merged over it
//   healthDirOf(config)      where the night's health pages go: .keel/keel.json
//                            `health`, default docs/health (improve writes,
//                            the workflow commits, drain, fleet and loose-ends
//                            read it; one reader)
//   healthPage, healthOutside, healthDirIn(root, config)
//                            the dated page's name; a health directory that
//                            resolves outside the repo (a symlink) is refused
//   healthLints(root, config)  a bad `health` (health-config), or a health
//                            directory git ignores (health-ignored): the night
//                            writes its page and never commits it (a promise:
//                            git answers while the caller reads on)
//   platformLints(root, config)  a tracked test file that runs a macOS-only
//                            (or Windows-only) tool with no platform skip
//                            (platform-guard, phase 65); .keel/keel.json
//                            `platformTools` adds tools
//   readProjectRecords(root) the projects shape, read only: docs/projects/<p>/
//                            with its primary doc's status and issue, and its
//                            phases.md's sections (phaseSections); with
//                            recordsDisagree, statusUnknown, changelogGaps,
//                            issuesNamed, the record measures' rules
//   gateWorkflowOf(config)   the gate workflow a project names (gateWorkflow)
//   reviewConfigOf(config), reviewFragment, reviewComments(pr, reviewers)
//                            a PR's review comments and which are answered
//                            (keel review and reviews_unanswered: one rule);
//                            repoReviewArgs, readRepoReviews, windowPrs, unansweredPrs:
//                            the repo-wide read, page by page (the night and
//                            keel loose-ends); IncompleteRead: never a count;
//                            windowFragment, fromWindow, prReviewArgs: it asks
//                            only what "unanswered" needs, and reads alone a
//                            PR the window did not cover whole
//   RATE_LIMIT, rateSpend(), graphqlData(stdout, spend)
//                            what each GraphQL query cost of the hour's
//                            allowance, and what is left
//   budgetPasses(config), budgetSince(history, …), budgetUse(runs, pass,
//                            { since }), budgetLine(entries): each budgeted
//                            pass's agent-step minutes in its last runs
//                            since its budget became today's, which ran
//                            out, and a suggestion
//                            (BUDGET_STEPS: workflow → its agent step's name
//                            and its "Did the agent run?" check's)
//   AGENTS, agentOf(config, key), passAgentProblems(config, key), codexVerdict,
//   AGENT_GIT_DIR, agentGitArgs(cwd)
//                            which agent runs a pass (.keel/keel.json "agents",
//                            and "agent" on crossReview, climb and tend):
//                            each provider an adapter, keel's rules its own
//                            (phase 45); authorOf(head), reviewerOf(…): a PR
//                            is reviewed by a provider other than its author;
//                            commitAuthorOf, pushAuthorsOf, pushReviewerOf: so
//                            is a push to main (phase 60), by its commits
//   main(meta, fn)           run a script: --json or text, and its exit code
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, readdir, lstat, readlink } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCK = '.keel/lock.json';
export const CLAUDE_MD_LINES = 3;
const SKIP = new Set(['.git', 'node_modules']);

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const read = path => readFile(path, 'utf8').catch(e => ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(e.code) ? null : Promise.reject(e));
export const info = path => lstat(path).catch(e => ['ENOENT', 'ENOTDIR'].includes(e.code) ? null : Promise.reject(e));

/** The inside of a <!-- keel:begin id --> … <!-- keel:end id --> block, or null. */
export function blockBody(text, id) {
  if (text === null) return null;
  const begin = `<!-- keel:begin ${id} -->`, end = `<!-- keel:end ${id} -->`;
  const b = text.indexOf(begin), e = text.indexOf(end);
  if (b < 0 || e < 0 || e < b || text.indexOf(begin, b + 1) >= 0) return null;
  const from = text.indexOf('\n', b) + 1;
  return !from || from > e ? null : text.slice(from, e);
}

/** The project's .keel/lock.json, or null when it has none. */
export async function readLock(root) {
  const text = await read(join(root, LOCK));
  if (text === null) return null;
  const lock = JSON.parse(text);
  if (!lock || typeof lock.files !== 'object') throw new Error(`${LOCK}: needs "files"`);
  return lock;
}

/** A lock key, `path` or `path#block`, as { path, block }. */
export function splitKey(key) {
  const m = /^(.*)#([a-z0-9-]+)$/.exec(key);
  return m ? { path: m[1], block: m[2] } : { path: key, block: null };
}

/**
 * Drift by the lock alone: every target keel wrote whose bytes now differ
 * (`edited`; missing counts). A managed link that became a real directory or
 * file is a lint, symlink-replaced. Returns { drift, lint }, or null with no lock.
 */
export async function lockDrift(root) {
  const lock = await readLock(root);
  if (!lock) return null;
  const drift = [], lint = [];
  for (const key of Object.keys(lock.files).sort()) {
    const { practice, sha256: locked } = lock.files[key];
    const { path, block } = splitKey(key);
    const target = join(root, path);
    let now;
    if (block) now = blockBody(await read(target), block);
    else {
      const i = await info(target);
      if (!i) now = null;
      else if (i.isSymbolicLink()) now = await readlink(target);
      else if (i.isDirectory()) {
        lint.push({ rule: 'symlink-replaced', path, message: `${path} was written by keel as a symlink (${practice}); it is a real directory, so it no longer follows the managed copy` });
        continue;
      } else now = await read(target);
    }
    if (now === null || sha256(now) !== locked) drift.push({ path: key, practice, state: 'edited', ...(now === null ? { missing: true } : {}) });
  }
  return { drift, lint };
}

/** Every file under root, not following symlinks, skipping .git, node_modules and nested keel projects. */
export async function walk(root, dir = root, found = []) {
  let names;
  try { names = await readdir(dir, { withFileTypes: true }); } catch { return found; }
  if (dir !== root && names.some(d => d.name === '.keel') && await info(join(dir, '.keel', 'keel.json'))) return found;
  for (const d of names) {
    if (SKIP.has(d.name)) continue;
    const path = join(dir, d.name);
    if (d.isDirectory()) await walk(root, path, found);
    else if (d.isFile()) found.push(relative(root, path).split(sep).join('/'));
  }
  return found;
}

export const skillName = text => /^---\r?\n[\s\S]*?^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(text ?? '')?.[1] ?? null;

/**
 * A second copy of a managed skill: any SKILL.md outside .agents/skills/
 * naming one. `skills` maps a skill's name to { path, practice }. On keel
 * itself (`self`), practices/ holds the templates, the source, not copies.
 */
export async function secondCopies(root, skills, { self = false } = {}) {
  const lint = [];
  if (!skills.size) return lint;
  for (const path of await walk(root)) {
    if (!path.endsWith('SKILL.md') || path.startsWith('.agents/skills/')) continue;
    if (self && path.startsWith('practices/')) continue;
    const name = skillName(await read(join(root, path)));
    const managed = skills.get(name);
    if (managed) lint.push({ rule: 'second-copy', path, message: `a second copy of the ${name} skill (${managed.practice}); the one copy is ${managed.path}, reached by symlink — a copy ages (lesson 1)` });
  }
  return lint;
}

/** The managed skills a lock names, by their name in the project's copy. */
export async function lockedSkills(root, lock) {
  const skills = new Map();
  for (const [key, e] of Object.entries(lock?.files ?? {})) {
    const m = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(key);
    if (m) skills.set(skillName(await read(join(root, key))) ?? m[1], { path: key, practice: e.practice });
  }
  return skills;
}

/** CLAUDE.md as more than a pointer to AGENTS.md: a lint, or null. */
export function claudeMdLint(text) {
  const lines = text === null ? 0 : text.split('\n').filter(l => l.trim()).length;
  return lines > CLAUDE_MD_LINES
    ? { rule: 'claude-md-pointer', path: 'CLAUDE.md', message: `CLAUDE.md has ${lines} non-empty lines; it should be a pointer to AGENTS.md (at most ${CLAUDE_MD_LINES}), so there is one guide` }
    : null;
}

/**
 * A lessons table split by a blank line: Markdown ends a table at the first
 * blank line, so every numbered row after it renders as raw text and the
 * lessons in it are hidden. One lint per split, naming its lines. `path` is
 * the configured lessons file (.keel/keel.json "lessons", default
 * docs/lessons.md).
 */
export function lessonsTableSplit(text, path = 'docs/lessons.md') {
  if (text === null || text === undefined) return [];
  const lines = text.split('\n'), lint = [];
  let last = -1; // the last line that starts with |, while only blank lines follow it
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('|')) {
      if (last >= 0 && i > last + 1 && /^\|\s*\d+\s*\|/.test(l)) {
        const blank = last + 2 === i ? `line ${i}` : `lines ${last + 2}–${i}`;
        lint.push({ rule: 'lessons-table-split', path, message: `a blank line (${blank}) splits the lessons table: the rows from line ${i + 1} on render as text, not as the table; remove the blank ${i - last - 1 === 1 ? 'line' : 'lines'}` });
      }
      last = i;
    } else if (l.trim()) last = -1;
  }
  return lint;
}

/**
 * The ways a lessons table ends before its last row, beyond a blank line
 * (lessonsTableSplit, above, covers that one): prose between numbered
 * rows, a second header row, and a numbered row stranded after the table's
 * section ends; and a row an unescaped `|` splits into more cells than the
 * header has. Each is a lessons-table-split lint naming its line. The table
 * is the first one whose header's first cell is `#`, else the first table; a
 * second header is one whose first cell matches it. After a table of another
 * kind, a numbered row may be that table's kind of thing, and is left alone.
 */
export function lessonsTableShapes(text, path = 'docs/lessons.md') {
  if (text === null || text === undefined) return [];
  const lines = text.split('\n');
  const row = l => l.trimStart().startsWith('|');
  const numbered = l => /^\s*\|\s*\d+\s*\|/.test(l);
  const separator = l => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  const first = l => l.trim().replace(/^\|/, '').split('|')[0].trim();
  const header = i => row(lines[i]) && !separator(lines[i]) && i + 1 < lines.length && separator(lines[i + 1]);
  const heads = lines.map((_, i) => i).filter(header);
  const h = heads.find(i => first(lines[i]) === '#') ?? heads[0];
  if (h === undefined) return [];
  const sameHeader = i => first(lines[i]) === first(lines[h]);
  let e = h + 2;
  while (e < lines.length && row(lines[e])) e++;
  const lint = [], say = message => lint.push({ rule: 'lessons-table-split', path, message });
  // A row wider than its header: an unescaped `|` in a cell (even inside backticks) splits it, and the
  // cells past the header's are dropped when it renders, and shift what a reader parses (ledger's lesson 28).
  const width = cells(lines[h]).length;
  for (let i = h + 2; i < e; i++) {
    const n = cells(lines[i]).length;
    if (n > width) say(`row ${first(lines[i]) || '?'} (line ${i + 1}) has ${n} cells against the header's ${width}: an unescaped \`|\` splits a cell (backticks do not protect it), so its text shifts and the rest is dropped; escape each \`|\` inside a cell as \`\\|\``);
  }
  let section = true, prose = null, foreign = false;
  for (let i = e; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,6}\s/.test(l)) { section = false; prose = null; continue; }
    if (row(l)) {
      if (header(i)) {
        if (!sameHeader(i)) foreign = true; // another table: numbered rows after it may be its kind, not lessons
        else say(`a second header row (line ${i + 1}) starts a second table after the lessons table ended at line ${e}: its rows are not counted as lessons; join its rows to the first table and remove the header and separator`);
        i++;
      } else if (numbered(l) && !foreign) {
        if (section && prose !== null) say(`prose between numbered rows (line ${prose + 1}) ends the lessons table at line ${e}: the rows from line ${i + 1} on render as text and are not counted as lessons; move the prose below the table or into a row`);
        else if (!section) say(`a numbered row (line ${i + 1}) is stranded after the lessons table ended at line ${e}, under a later heading: it is not counted as a lesson; move it into the table`);
      }
      while (i + 1 < lines.length && row(lines[i + 1])) i++;
      prose = null;
      continue;
    }
    if (l.trim() && prose === null) prose = i;
  }
  return lint;
}

/** Cells of a markdown table row, split on unescaped pipes, trimmed. */
export function cells(line) {
  const body = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return body.split(/(?<!\\)\|/).map(c => c.trim());
}
const isSeparator = line => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line.trim());

/**
 * The lesson rows of a lessons table: the first table whose header is
 * numbered (`| # | shape | cost | guard |`), has three columns
 * (`| shape | cost | guard |`, numbered by position), or names a guard
 * column. The guard column is the header cell containing "guard", in any
 * case and position (ledger's `Guard`, cajones' `Guard / status`); `guard`
 * is its index, -1 when the table has none, and each row's guard is then
 * the last column. A header cell `Where` (keel's catalogue only: the stacks a
 * lesson applies to, empty for every stack) is `where`, its index, -1 when
 * the table has none; each row's `where` is that cell, '' without one. The
 * shape alone makes a fingerprint, so the column moves none. Returns
 * { numbered, guard, where, rows: [{ n, line, shape, cost, guard, where }] };
 * `line` is 1-based, for permalinks.
 */
export function parseLessons(text) {
  const lines = (text ?? '').split('\n');
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].trim().startsWith('|') || !isSeparator(lines[i + 1])) continue;
    const head = cells(lines[i]);
    const numbered = head.length >= 4 && /^(#|n|no\.?)$/i.test(head[0]);
    const guard = head.findIndex(c => /guard/i.test(c));
    if (!numbered && head.length !== 3 && guard < 0) continue;
    const from = numbered ? 1 : 0; // the shape's column
    const at = guard >= 0 ? guard : from + 2;
    const where = head.findIndex(c => /^where$/i.test(c));
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      const c = cells(lines[j]);
      if (numbered && !/^\d+$/.test(c[0])) continue;
      if (c.length < Math.max(at, from + 2) + 1 || (!numbered && !c[from])) continue;
      // An unescaped pipe in the last column splits it; the guard keeps the
      // rest. A Where column after the guard stays the row's last cell.
      const last = where === head.length - 1 && at === head.length - 2;
      const g = at === head.length - 1 ? c.slice(at).join(' | ') : last ? c.slice(at, Math.max(at + 1, c.length - 1)).join(' | ') : c[at];
      const w = where < 0 ? '' : last ? (c.length > at + 1 ? c[c.length - 1] : '') : c[where] ?? '';
      rows.push({ n: numbered ? Number(c[0]) : rows.length + 1, line: j + 1, shape: c[from], cost: c[from + 1], guard: g, where: w });
    }
    return { numbered, guard, where, rows };
  }
  return { numbered: false, guard: -1, where: -1, rows: [] };
}

/** What keel lessons has sent home: { "<fingerprint>": { issue, at } }. */
export const SENT = '.keel/sent.json';
/** The project's lessons table: .keel/keel.json `lessons`, else docs/lessons.md. */
export const lessonsPathOf = config => typeof config?.lessons === 'string' && config.lessons ? config.lessons : 'docs/lessons.md';
/** The project in a fingerprint: the config's repo (owner/name), else its name. */
export const lessonProject = config => /^[\w.-]+\/[\w.-]+$/.test(config?.repo ?? '') ? config.repo : config?.name ?? null;
export const normaliseShape = shape => shape.replace(/\s+/g, ' ').trim();
/**
 * A lesson row's fingerprint: <project>/lesson/<n>/<8 hex of sha256(its shape,
 * whitespace collapsed)>. keel lessons files under it, fleet and improve count
 * by it: one definition (lesson 7). A reworded or renumbered row is new.
 */
export const lessonFingerprint = (project, row) => `${project}/lesson/${row.n}/${sha256(normaliseShape(row.shape)).slice(0, 8)}`;

/**
 * The lesson rows not yet in .keel/sent.json: { path, rows, unsent:
 * [{ n, fingerprint }] }, or { na } when there is no lessons table or no
 * project to name. A sent.json that is not JSON throws (a broken instrument).
 */
export async function unsentLessons(root, config) {
  const path = lessonsPathOf(config);
  const text = await read(join(root, path));
  if (text === null) return { na: `no ${path}: no lessons table to send from` };
  const project = lessonProject(config);
  if (!project) return { na: '.keel/keel.json names neither repo nor name, so a lesson has no fingerprint' };
  const raw = await read(join(root, SENT));
  let sent = {};
  if (raw !== null) {
    try { sent = JSON.parse(raw); } catch { throw new Error(`${SENT} is not JSON`); }
    if (!sent || typeof sent !== 'object' || Array.isArray(sent)) throw new Error(`${SENT} must be an object of fingerprint → { issue, at }`);
  }
  const { rows } = parseLessons(text);
  const unsent = rows.map(r => ({ n: r.n, fingerprint: lessonFingerprint(project, r) })).filter(r => !Object.hasOwn(sent, r.fingerprint));
  return { path, project, rows: rows.length, unsent };
}

/**
 * Phases the roadmap's parser rejects, or its --check refuses as a spec
 * (specProblems, when the project's roadmap.mjs has it: template text, a
 * spec: 2 box naming no check), duplicate numbers, and goals with no phase.
 */
export async function phaseLints(root, parsePhase, specProblems) {
  const lint = [];
  const dir = join(root, 'docs', 'phases');
  const names = (await readdir(dir).catch(() => [])).filter(n => n.endsWith('.md') && n !== 'README.md').sort();
  const phases = [];
  for (const file of names) {
    const raw = await read(join(dir, file));
    try { phases.push(parsePhase(file, raw)); }
    catch (e) { lint.push({ rule: 'phase', path: `docs/phases/${file}`, message: e.message }); continue; }
    for (const message of specProblems?.(file, raw) ?? []) lint.push({ rule: 'phase', path: `docs/phases/${file}`, message });
  }
  let goals = [];
  try { goals = JSON.parse((await read(join(root, 'docs', 'goals.json'))) ?? '[]'); } catch { goals = []; }
  const seen = new Map();
  for (const p of phases) {
    if (seen.has(p.id)) lint.push({ rule: 'phase', path: `docs/phases/${p.file}`, message: `duplicate phase number ${p.id}: ${seen.get(p.id)} and ${p.file}; renumber one` });
    else seen.set(p.id, p.file);
  }
  if (Array.isArray(goals)) for (const g of goals) {
    if (g?.id && !g.retired && !phases.some(p => p.goal === g.id)) lint.push({ rule: 'goal-without-phase', path: 'docs/goals.json', message: `${g.id}: no phase serves this goal` });
  }
  return lint;
}

// ---- the projects shape, and the records beside it ---------------------------
//
// A project that keeps its phases per project (.keel/keel.json `"phases":
// {"shape": "projects"}`): docs/projects/<p>/phases.md holds `## Phase N`
// sections, each with a `**Status: WORD**` line, and the project's own status
// and issue are its primary doc's front matter (`status:`, `issue:`). Read
// only; nothing here writes. Adapted from isocan's scripts/lib/practice.mjs
// (github.com/dglazkov/isocan, 2 Oct 2026, Apache-2.0): the logic, not its
// isocan-only rows.

/** The Status words a projects-shaped phases.md uses, and the keel status each one is. */
export const PHASE_WORDS = Object.freeze({ CLOSED: 'built', 'PART-DONE': 'partial', 'NOT STARTED': 'planned', RETIRED: 'superseded' });
/** The doc that carries a project's status, first found wins. */
export const PRIMARY_DOCS = Object.freeze(['journey.md', 'design.md', 'plan.md', 'phases.md']);
export const PROJECTS_DIR = 'docs/projects';
export const shapeOf = config => config?.phases?.shape === 'projects' ? 'projects' : 'files';

/** A document's front matter as a Map of flat `key: value` lines (quotes stripped), or null when it has none. */
export function frontMatter(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const kv = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return kv;
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (m) kv.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''));
  }
  return null;
}

/** An `issue:` value as a number: "#134" and "134" are issue 134; anything else is none. */
export const issueNumber = v => /^#?\d+$/.test(v ?? '') ? Number(String(v).replace(/^#/, '')) : null;

const PHASE_HEAD = /^## (?:Phase (\d+(?:\.\d+)?)\b|(\d+(?:\.\d+)?)\.\s)(.*)$/;
const STATUS_LINE = /^\*\*Status:\s*([A-Z][A-Z-]*(?: [A-Z][A-Z-]+)*)/;

/**
 * The phase sections of a phases.md (`## Phase N …`, or `## N. …`), outside
 * fenced code: [{ id, title, heading, word, status, line }]. `heading` is the
 * text after the number as written; `word` is the first Status line's word
 * (null with none); `status` is keel's reading of it, `unknown` for a word
 * outside PHASE_WORDS or no line at all. The one reader of the shape: keel's
 * lib/phases-projects.mjs (next, status, doctor) reads phases.md through it.
 */
export function phaseSections(text) {
  const lines = String(text ?? '').split(/\r?\n/), out = [];
  let fence = false, current = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const h = PHASE_HEAD.exec(lines[i]);
    if (h) {
      const heading = h[3].trim();
      current = { id: h[1] ?? h[2], title: heading.replace(/^[—:–-]\s*/, '').replace(/\s*✅\s*$/, '').trim(), heading, word: null, status: 'unknown', line: i + 1 };
      out.push(current);
      continue;
    }
    if (/^## /.test(lines[i])) { current = null; continue; }
    const s = current && current.word === null ? STATUS_LINE.exec(lines[i]) : null;
    if (s) {
      current.word = s[1];
      current.status = PHASE_WORDS[current.word] ?? 'unknown';
    }
  }
  return out;
}

/**
 * Every directory under docs/projects with a primary doc: [{ name, primary,
 * status, issue, phasesPath, phases }] by name. `status` and `issue` are the
 * primary doc's front matter (null when absent); `phases` is phaseSections of
 * its phases.md, null when it has none. Null when there is no docs/projects.
 */
export async function readProjectRecords(root) {
  let dirs;
  try { dirs = await readdir(join(root, PROJECTS_DIR), { withFileTypes: true }); }
  catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) return null; throw e; }
  const out = [];
  for (const d of dirs.filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = `${PROJECTS_DIR}/${d.name}`;
    let primary = null, front = null;
    for (const f of PRIMARY_DOCS) {
      const text = await read(join(root, dir, f));
      if (text !== null) { primary = `${dir}/${f}`; front = frontMatter(text); break; }
    }
    if (!primary) continue;
    const phasesText = await read(join(root, dir, 'phases.md'));
    out.push({
      name: d.name, primary, status: front?.get('status') || null, issue: issueNumber(front?.get('issue')),
      phasesPath: phasesText === null ? null : `${dir}/phases.md`, phases: phasesText === null ? null : phaseSections(phasesText),
    });
  }
  return out;
}

/**
 * Front matter against the phases: `built` while a phase is NOT STARTED or
 * PART-DONE, or `partial` (or `designed`) while every phase is CLOSED or
 * RETIRED. Only vocabulary words count; a project with none is not judged.
 */
export function recordsDisagree(projects) {
  const out = [];
  for (const p of projects) {
    const known = (p.phases ?? []).filter(x => x.status !== 'unknown');
    if (!known.length) continue;
    const open = known.filter(x => x.status === 'planned' || x.status === 'partial');
    if (p.status === 'built' && open.length) out.push({ project: p.name, path: p.primary, detail: `${p.name}: ${open.length} phase${open.length === 1 ? '' : 's'} open; front matter says built` });
    else if ((p.status === 'partial' || p.status === 'designed') && !open.length) out.push({ project: p.name, path: p.primary, detail: `${p.name}: every phase closed or retired; front matter says ${p.status}` });
  }
  return out;
}

/**
 * Status lines no reader understands: a word outside PHASE_WORDS (one per
 * phase), a phase with no Status line while others in its file have one (one
 * per phase: that phase is invisible), and a phases.md with phase headings and
 * not one Status line (one per file, the whole file's phases invisible).
 */
export function statusUnknown(projects) {
  const out = [];
  for (const p of projects) {
    if (!p.phases?.length) continue;
    if (p.phases.every(x => x.word === null)) { out.push({ path: p.phasesPath, detail: `${p.phasesPath}: ${p.phases.length} phase${p.phases.length === 1 ? '' : 's'}, no Status line` }); continue; }
    for (const x of p.phases) {
      if (x.word === null) out.push({ path: `${p.phasesPath}:${x.line}`, detail: `${p.name} phase ${x.id} has no Status line` });
      else if (!PHASE_WORDS[x.word]) out.push({ path: `${p.phasesPath}:${x.line}`, detail: `${p.name} phase ${x.id} says ${x.word}` });
    }
  }
  return out;
}

/** `day` moved by n days, both YYYY-MM-DD. */
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The marker a changelog page carries until somebody writes it. */
export const CHANGELOG_DRAFT = '<!-- draft -->';

/**
 * Changelog days in the `window` days before `day` (`day` itself left out:
 * tonight's entry is not owed yet) with commits and no page, or a page still
 * carrying the draft marker. `commits` maps YYYY-MM-DD → count; `pages` maps
 * YYYY-MM-DD → the page's text.
 */
export function changelogGaps({ commits, pages, day, window = 30 }) {
  const out = [];
  for (let back = window; back >= 1; back--) {
    const d = addDays(day, -back);
    const page = pages.get(d), n = commits.get(d) ?? 0;
    if (page === undefined && n > 0) out.push({ day: d, detail: `${d} missing (${n} commit${n === 1 ? '' : 's'})` });
    else if (page !== undefined && page.includes(CHANGELOG_DRAFT)) out.push({ day: d, detail: `${d} still a draft` });
  }
  return out;
}

/** Every issue number a text names: `#N`, an `issue: N` line, or an `/issues/N` link. */
export function issuesNamed(text) {
  const found = new Set();
  for (const m of String(text).matchAll(/(?:^|[^\w&/])#(\d{1,6})\b/gm)) found.add(Number(m[1]));
  for (const m of String(text).matchAll(/^issue:\s*["']?#?(\d+)["']?\s*$/gm)) found.add(Number(m[1]));
  for (const m of String(text).matchAll(/\/issues\/(\d+)\b/g)) found.add(Number(m[1]));
  return found;
}

// ---- the gate's workflow -------------------------------------------------------

/**
 * The workflow a project names as its gate (.keel/keel.json `gateWorkflow`,
 * the name GitHub shows, e.g. isocan's `release`): { name }, { problem } when
 * the value is not a name (said, never ignored), or null when it names none.
 * fleet and improve both read it here.
 */
export function gateWorkflowOf(config) {
  const top = config?.gateWorkflow, nested = config?.ci?.gateWorkflow;
  if (top === undefined && nested === undefined) return null;
  for (const value of [top, nested]) if (value !== undefined && (typeof value !== 'string' || !value.trim())) return { problem: `.keel/keel.json "gateWorkflow" must be a workflow's name (also accepted as "ci".gateWorkflow)` };
  if (top !== undefined && nested !== undefined && top.trim() !== nested.trim()) return { problem: 'conflicting gateWorkflow and ci.gateWorkflow names' };
  return { name: (nested ?? top).trim() };
}

// ---- the health pages' directory ---------------------------------------------

/** Where health pages go when .keel/keel.json names no `health`. */
export const HEALTH_DIR = 'docs/health';

/**
 * What is wrong with .keel/keel.json `health`: a directory inside the repo,
 * relative, with no `..`, `.` or empty segment, no backslash, glob or
 * whitespace (the workflow hands it to a shell), no leading `:` (git
 * pathspec magic), not under .git/ or .github/, and not .keel itself. Absent
 * is fine (the default). Returns a list of messages.
 */
export function healthProblems(config) {
  const h = config?.health;
  if (h === undefined) return [];
  const bad = why => [`"health" ${why} (got ${JSON.stringify(h)}); it names the directory health pages go in, relative to the repo, like "${HEALTH_DIR}"`];
  if (typeof h !== 'string' || !h) return bad('must be a non-empty string');
  if (h.startsWith('/') || /^[A-Za-z]:/.test(h)) return bad('must be relative to the repo, not absolute');
  if (/[\\*?[\]\s]/.test(h)) return bad('cannot hold a backslash, glob or whitespace');
  // git reads a leading `:` as pathspec magic (`:(top)`, `:!x`), even after `--`.
  if (h.startsWith(':')) return bad('cannot start with `:` (git reads it as pathspec magic)');
  const segs = h.replace(/\/$/, '').split('/');
  if (segs.some(s => s === '..')) return bad('cannot leave the repo (`..`)');
  if (segs.some(s => s === '.' || s === '')) return bad('cannot hold an empty or `.` segment');
  if (segs[0] === '.git' || segs[0] === '.github') return bad(`cannot be under ${segs[0]}/`);
  // The night's drain merges whatever is under it unread: never keel's own config.
  if (segs.length === 1 && segs[0] === '.keel') return bad('cannot be .keel itself (it holds keel.json); use a directory inside it, like ".keel/health"');
  return [];
}

/** The project's health directory, no trailing slash: `health`, else docs/health. A bad `health` throws. */
export function healthDirOf(config) {
  const problems = healthProblems(config);
  if (problems.length) throw new Error(`.keel/keel.json: ${problems[0]}`);
  return config?.health === undefined ? HEALTH_DIR : config.health.replace(/\/$/, '');
}

/** A dated health page's name: the page improve writes, and the name every probe of the directory uses. */
export const healthPage = (dir, date) => `${dir}/${date}.md`;

/**
 * Whether the health directory, as it stands on disk under `root`, resolves
 * outside the repo: a symlinked component that points elsewhere. Reads the
 * deepest part of the path that exists (what is not there yet is created
 * inside it). Returns the message, or null.
 */
export function healthOutside(root, dir) {
  let base;
  try { base = realpathSync(root); } catch { return null; }
  const segs = dir.split('/');
  for (let n = segs.length; n > 0; n--) {
    let real;
    try { real = realpathSync(join(root, ...segs.slice(0, n))); } catch { continue; }
    const rel = relative(base, real);
    if (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) return null;
    return `${dir} resolves outside the repo (${segs.slice(0, n).join('/')} → ${real}): the night writes its pages only inside it; make "health" a real directory in the repo`;
  }
  return null;
}

/** healthDirOf, and the directory must not resolve outside `root` (a symlink): either throws. */
export function healthDirIn(root, config) {
  const dir = healthDirOf(config);
  const outside = healthOutside(root, dir);
  if (outside) throw new Error(`.keel/keel.json: "health": ${outside}`);
  return dir;
}

/**
 * The health directory's lints, for a project with the night practice or a
 * `health` setting: health-config when `health` is not a plain directory in
 * the repo; health-ignored when git ignores a page in it (`git check-ignore`),
 * so the night writes the page and its PR never carries it (ledger, phase 33).
 * Outside a git repository there is nothing to ignore.
 */
export async function healthLints(root, config, day = new Date().toISOString().slice(0, 10)) {
  if (!(config?.practices ?? []).includes('night') && config?.health === undefined) return [];
  const problems = healthProblems(config);
  if (problems.length) return problems.map(message => ({ rule: 'health-config', path: '.keel/keel.json', message }));
  const dir = healthDirOf(config);
  const outside = healthOutside(root, dir);
  if (outside) return [{ rule: 'health-config', path: dir, message: outside }];
  // The page this run writes (its date), as improve writes it: an ignore rule for pages (`2026-*.md`) is caught, not just one for the directory.
  const ignored = await new Promise(done => execFile('git', ['check-ignore', '-q', '--', healthPage(dir, day)], { cwd: root, encoding: 'utf8' }, e => done(!e)));
  if (!ignored) return [];
  return [{ rule: 'health-ignored', path: dir, message: `${dir} is git-ignored here, so the night writes its health page and never commits it; set "health" in .keel/keel.json to a directory that is not ignored (like ".keel/health")` }];
}

// ---- the platform guard (phase 65) ---------------------------------------------
//
// The gate runs on the owner's Mac; CI runs on Linux. A test that calls a
// macOS-only tool passes the one and fails the other, unless it says so with a
// platform skip. The lint reads tracked test files (*.test.*, *.spec.*, and
// anything under a test/, tests/ or __tests__/ directory) and counts a tool
// only where it runs as a command: the first argument (or array) of a process
// runner the file imports (child_process's spawn, exec, execFile, execa, zx's
// $, a promisify of one), a shell's script (`sh -c`), at a command's position
// outside the shell's quotes; or a line of a shell script. Prose, test names,
// comments and a helper of the file's own never count. A command is cleared
// only by a guard that covers it, in the right direction: its test's
// `skip: process.platform !== 'darwin'`, an `if` on the platform, or an early
// return; a guard elsewhere in the file clears nothing else.
//
// A word `%` in a tool stands for a format argument: BSD stat's
// `stat -f %z` is macOS-only, GNU stat's `stat -f .` (file system status) is
// not.

/** Tools that run on one platform only, by process.platform's name. */
export const PLATFORM_TOOLS = Object.freeze({
  darwin: Object.freeze(['ditto', 'hdiutil', 'launchctl', 'codesign', 'osascript', 'mdls', 'stat -f %', 'defaults write', 'pbcopy', 'security']),
  win32: Object.freeze(['powershell', 'reg.exe']),
});
export const PLATFORM_NAMES = Object.freeze({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' });

/** What is wrong with .keel/keel.json "platformTools": a tool name (macOS) or { tool, platform }. */
export function platformToolProblems(list) {
  if (list === undefined) return [];
  const shape = `"platformTools" must be a list of tool names (macOS-only) or { "tool": "<name>", "platform": "${Object.keys(PLATFORM_NAMES).join('" | "')}" }`;
  if (!Array.isArray(list)) return [shape];
  return list.some(t => typeof t === 'string' ? !t.trim()
    : !t || typeof t.tool !== 'string' || !t.tool.trim() || !Object.hasOwn(PLATFORM_NAMES, t.platform)) ? [shape] : [];
}

/** keel's tools and the project's ("platformTools"), by platform. */
export function platformTools(config) {
  const out = Object.fromEntries(Object.entries(PLATFORM_TOOLS).map(([p, tools]) => [p, [...tools]]));
  if (platformToolProblems(config?.platformTools).length) return out;
  for (const t of config?.platformTools ?? []) {
    const [tool, platform] = typeof t === 'string' ? [t.trim(), 'darwin'] : [t.tool.trim(), t.platform];
    if (!(out[platform] ??= []).includes(tool)) out[platform].push(tool);
  }
  return out;
}

/** A tracked file the platform guard reads: a test file, in a language that runs commands. */
export const isTestFile = path => /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[^/]+$/.test(path) && /\.(?:[cm]?[jt]sx?|sh|bash|zsh)$/.test(path);

/**
 * A JS file's string literals, and its text with comments blanked (same
 * length, so positions agree). A light scanner, not a parser: enough to tell
 * a command from a comment.
 */
export function scanSource(text) {
  const strings = [];
  let code = '', i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (c === '/' && d === '/') { const e = text.indexOf('\n', i); const stop = e < 0 ? n : e; code += ' '.repeat(stop - i); i = stop; continue; }
    if (c === '/' && d === '*') { const e = text.indexOf('*/', i + 2); const stop = e < 0 ? n : e + 2; code += text.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, value = '';
      while (j < n && text[j] !== c) {
        if (text[j] === '\\') { value += text[j + 1] ?? ''; j += 2; continue; }
        if (c !== '`' && text[j] === '\n') break;
        if (c === '`' && text[j] === '$' && text[j + 1] === '{') {
          let depth = 0, k = j + 1;
          for (; k < n; k++) { if (text[k] === '{') depth++; else if (text[k] === '}' && --depth === 0) break; }
          value += text.slice(j, k + 1); j = k + 1; continue;
        }
        value += text[j++];
      }
      const stop = Math.min(n, j + 1);
      strings.push({ value, start: i, end: stop });
      code += text.slice(i, stop);
      i = stop; continue;
    }
    code += c; i++;
  }
  return { code, strings };
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- what runs a process -------------------------------------------------------

const CHILD_PROCESS = /^(?:node:)?child_process$/;
const CP_RUNNERS = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync'];
const EXECA_RUNNERS = ['execa', 'execaSync', 'execaCommand', 'execaCommandSync', '$'];

/**
 * The names in a file that run a process: what it imports or requires from
 * child_process (spawn, exec, execFile and their Sync forms, under any local
 * name, or the module's namespace), execa's runners, zx's $, and a
 * promisify() of one of them. A helper of the file's own named `run` or `sh`
 * runs nothing here.
 */
export function runnersOf(code) {
  const names = new Set(), spaces = new Set(), tags = new Set();
  const take = (module, list, sep) => {
    for (const item of list.split(',').map(x => x.trim()).filter(Boolean)) {
      const [from, to = from] = item.split(sep).map(x => x.trim());
      if (CHILD_PROCESS.test(module) && CP_RUNNERS.includes(from)) names.add(to);
      if (module === 'execa' && EXECA_RUNNERS.includes(from)) (from === '$' ? tags : names).add(to);
      if (module === 'zx' && from === '$') tags.add(to);
    }
  };
  for (const m of code.matchAll(/\bimport\s*(?:([\w$]+)\s*,?\s*)?(?:\*\s*as\s+([\w$]+)\s*)?(?:\{([^}]*)\}\s*)?from\s*['"]([^'"]+)['"]/g)) {
    const [, def, star, list, module] = m;
    if (CHILD_PROCESS.test(module)) { if (def) spaces.add(def); if (star) spaces.add(star); }
    if (list) take(module, list, /\s+as\s+/);
  }
  if (/\bimport\s*['"]zx\/globals['"]/.test(code)) tags.add('$');
  for (const [, list, module] of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) take(module, list, ':');
  for (const [, name, module] of code.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:await\s+)?(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) if (CHILD_PROCESS.test(module)) spaces.add(name);
  const callee = () => [...[...names].map(n => `(?<![\\w$.])${escapeRe(n)}`), ...(spaces.size ? [`(?<![\\w$.])(?:${[...spaces].map(escapeRe).join('|')})\\.(?:${CP_RUNNERS.join('|')})`] : [])].join('|');
  // const run = promisify(execFile): run runs a process too.
  for (let round = 0; round < 2 && (names.size || spaces.size); round++) {
    for (const [, name] of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:util\\.)?promisify\\(\\s*(?:${callee()})\\s*\\)`, 'g'))) names.add(name);
  }
  return { names, spaces, tags, callee: names.size || spaces.size ? callee() : null };
}

/** The text before a string literal that makes it a command, for a file's runners; null when it has none. */
function commandBefore({ callee, tags }) {
  const alts = [];
  if (callee) {
    const call = `(?:${callee}|(?<![\\w$.])(?:util\\.)?promisify\\(\\s*(?:${callee})\\s*\\))`;
    alts.push(`${call}\\s*\\(\\s*(?:\\[\\s*)?`);
    // A shell's script: execFile('sh', ['-c', '<script>']).
    alts.push(`${call}\\s*\\(\\s*['"][^'"\\n]*['"]\\s*,\\s*\\[\\s*['"](?:-\\w*c|/c|-Command)['"]\\s*,\\s*`);
  }
  if (tags.size) alts.push(`(?<![\\w$.])(?:${[...tags].map(escapeRe).join('|')})\\s*`);
  return alts.length ? new RegExp(`(?:${alts.join('|')})$`) : null;
}

// ---- a tool at a command's position -----------------------------------------------

/**
 * A shell string with what its quotes hold blanked (same length): a `;` or
 * `&&` inside quotes separates nothing. $(…) and `…` inside double quotes
 * run, so they are kept.
 */
export function shellMask(s) {
  let out = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q === "'") { out += c === "'" ? (q = null, c) : ' '; continue; }
    if (c === '\\') { out += s[i + 1] === undefined ? ' ' : '  '; i++; continue; }
    if (q === '"') {
      if (c === '"') { q = null; out += c; continue; }
      if ((c === '$' && s[i + 1] === '(') || c === '`') {
        let k = i + 1;
        if (c === '`') k = s.indexOf('`', i + 1);
        else for (let depth = 0; k < s.length; k++) { if (s[k] === '(') depth++; else if (s[k] === ')' && --depth === 0) break; }
        if (k < 0) k = s.length - 1;
        out += s.slice(i, k + 1); i = k; continue;
      }
      out += c === '\n' ? c : ' '; continue;
    }
    if (c === "'" || c === '"') q = c;
    out += c;
  }
  return out;
}

/**
 * How a tool is recognised: its first word at a command's position in a
 * shell string (outside quotes), then its other words; a word `%` stands for
 * a format argument (`stat -f %z` is BSD stat; GNU's `stat -f .` is not).
 */
export function toolMatcher(tool, platform = 'darwin') {
  const words = tool.trim().split(/\s+/);
  const flags = platform === 'win32' ? 'i' : '';
  const exe = platform === 'win32' && !/\.exe$/i.test(words[0]) ? '(?:\\.exe)?' : '';
  const end = '(?=$|[\\s;&|)\'"`])';
  const word = w => w === '%' ? '[\'"]?%' : `${escapeRe(w)}${end}`;
  const head = new RegExp(`(?:^|[;&|(\\n]|\\$\\(|\\b(?:sudo|xcrun|env|exec|command|time|nohup|if|then|else|elif|do|while|until)\\s|!\\s)\\s*(?:[A-Za-z_]\\w*=(?:'[^']*'|"[^"]*"|[^\\s;&|]*)\\s+)*((?:[\\w.~-]*/)*)${escapeRe(words[0])}${exe}${end}`, `gd${flags}`);
  const whole = new RegExp(`(?:[\\w.~-]*/)*${escapeRe(words[0])}${exe}${words.slice(1).map(w => `\\s+${word(w)}`).join('')}${words.length === 1 ? end : ''}`, `y${flags}`);
  const first = new RegExp(`^(?:[\\w.~-]*/)*${escapeRe(words[0])}${exe}$`, flags);
  return {
    words,
    /** Whether a shell string runs the tool. */
    inShell(text) {
      for (const m of shellMask(text).matchAll(head)) {
        whole.lastIndex = m.indices[1][0];
        if (whole.test(text)) return true;
      }
      return false;
    },
    /** Whether a literal is the tool's own name (the array form's first element). */
    isName: value => first.test(value.trim()),
    /** Whether a following array element is the tool's word `i`. */
    isWord: (i, value) => words[i] === '%' ? value.startsWith('%') : flags ? value.toLowerCase() === words[i].toLowerCase() : value === words[i],
  };
}

// ---- what a guard covers ----------------------------------------------------------

const PLATFORM_EXPR = String.raw`(?:process\.platform|os\.platform\(\)|\bplatform\(\))`;
const SHELL_PLATFORM = { darwin: 'Darwin', linux: 'Linux', win32: '(?:MINGW|MSYS|CYGWIN)\\w*' };

/** Each bracket pair in code whose strings are blanked: [{ open, close, ch }]. */
function bracketPairs(bare) {
  const pairs = [], stack = [], match = { ')': '(', ']': '[', '}': '{' };
  for (let i = 0; i < bare.length; i++) {
    const c = bare[i];
    if (c === '(' || c === '[' || c === '{') stack.push({ open: i, ch: c });
    else if (match[c]) {
      while (stack.length && stack.at(-1).ch !== match[c]) stack.pop();
      const top = stack.pop();
      if (top) pairs.push({ ...top, close: i });
    }
  }
  return pairs;
}

/** An expression's top-level parts around `op` (&& or ||), outside brackets and quotes. */
function splitTop(e, op) {
  const parts = [];
  let depth = 0, q = null, from = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (!depth && e.startsWith(op, i)) { parts.push(e.slice(from, i)); from = i + op.length; i += op.length - 1; }
  }
  return [...parts, e.slice(from)].map(p => p.trim());
}

const balanced = e => { let d = 0; for (const c of e) { if (c === '(') d++; else if (c === ')' && --d < 0) return false; } return d === 0; };
const isLiteral = e => /^(['"`])[^'"`]+\1$/.test(e.trim()) || /^true$/.test(e.trim());

/**
 * What an expression says about running on `platform`: 'on' (true only
 * there), 'off' (false there), or null (it cannot tell). A comparison of
 * process.platform with it, a negation, or a name assigned one (aliases).
 * A comparison with another platform says nothing: `=== 'linux'` false
 * still leaves Windows, so it never guards a darwin tool.
 */
function sense(expr, platform, aliases, depth = 0) {
  let e = expr.trim();
  while (e.startsWith('(') && e.endsWith(')') && balanced(e.slice(1, -1))) e = e.slice(1, -1).trim();
  if (depth > 4 || !e) return null;
  if (/^!(?!=)/.test(e)) { const s = sense(e.slice(1), platform, aliases, depth + 1); return s === 'on' ? 'off' : s === 'off' ? 'on' : null; }
  const left = new RegExp(`^${PLATFORM_EXPR}\\s*([!=])==?\\s*(['"\`])(\\w+)\\2$`).exec(e);
  const right = new RegExp(`^(['"\`])(\\w+)\\1\\s*([!=])==?\\s*${PLATFORM_EXPR}$`).exec(e);
  const [op, name] = left ? [left[1], left[3]] : right ? [right[3], right[2]] : [];
  if (op) return name === platform ? (op === '=' ? 'on' : 'off') : null;
  if (/^[\w$]+$/.test(e) && aliases.has(e)) return sense(aliases.get(e), platform, aliases, depth + 1);
  return null;
}

/** A skip's value as its condition: `cond && 'why'` and `cond ? 'why' : false` are cond. */
function skipCondition(value) {
  const ternary = /^([\s\S]*?)\?\s*(?:(['"`])[^'"`]*\2|true)\s*:\s*(?:false|undefined|null|0|''|"")$/.exec(value.trim());
  const cond = ternary ? ternary[1] : value;
  return splitTop(cond, '&&').filter(p => !isLiteral(p)).join(' && ');
}

/**
 * True when cond holding means the code runs only on the platform. && binds
 * tighter than ||, so cond is split on || first: every branch must hold only
 * on the platform (one of its && parts is the platform's own test). In
 * `darwin && ready || force`, force runs it anywhere: no guard.
 */
const onWhenTrue = (cond, platform, aliases) => sense(cond, platform, aliases) === 'on'
  || splitTop(cond, '||').every(branch => sense(branch, platform, aliases) === 'on' || splitTop(branch, '&&').some(p => sense(p, platform, aliases) === 'on'));
/** True when cond failing means the code runs only on the platform: one || branch is the platform's own test, ruled out. */
const onWhenFalse = (cond, platform, aliases) => sense(cond, platform, aliases) === 'off' || splitTop(cond, '||').some(p => sense(p, platform, aliases) === 'off');

/**
 * The ranges of a JS file that run only on `platform`: [[start, end], …].
 *   test('…', { skip: process.platform !== 'darwin' }, …)  the call
 *   describe.skipIf(process.platform !== 'darwin')(…)      the call after it
 *   it.runIf(process.platform === 'darwin')(…)             the same
 *   if (process.platform === 'darwin') { … }               the branch
 *   if (process.platform !== 'darwin') return;             the rest of the block
 *     (or process.exit(), or a skip then return; at the top: the rest of the file)
 * A skip whose direction runs the code elsewhere (skip: process.platform ===
 * 'darwin') covers nothing; so does one for another platform.
 */
export function guardRanges(code, bare, platform) {
  const pairs = bracketPairs(bare);
  const closeOf = open => pairs.find(p => p.open === open)?.close ?? -1;
  const enclosing = (pos, ch) => pairs.filter(p => p.ch === ch && p.open < pos && pos < p.close).sort((a, b) => b.open - a.open)[0];
  const aliases = new Map();
  for (const m of bare.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*/g)) {
    const from = m.index + m[0].length;
    let to = from, depth = 0;
    for (; to < bare.length; to++) { const c = bare[to]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) { if (--depth < 0) break; } else if (!depth && (c === ';' || c === '\n' || c === ',')) break; }
    aliases.set(m[1], code.slice(from, to));
  }
  const exprEnd = from => { let depth = 0, i = from; for (; i < bare.length; i++) { const c = bare[i]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) { if (--depth < 0) break; } else if (!depth && c === ',') break; } return i; };
  const ranges = [];
  for (const m of bare.matchAll(/\bskip\s*:\s*/g)) {
    const from = m.index + m[0].length, cond = skipCondition(code.slice(from, exprEnd(from)));
    const call = enclosing(m.index, '(');
    if (call && onWhenFalse(cond, platform, aliases)) ranges.push([call.open, call.close]);
  }
  for (const m of bare.matchAll(/\.(skipIf|runIf)\s*\(/g)) {
    const open = m.index + m[0].length - 1, close = closeOf(open);
    if (close < 0) continue;
    const cond = code.slice(open + 1, close);
    if (!(m[1] === 'skipIf' ? onWhenFalse(cond, platform, aliases) : onWhenTrue(cond, platform, aliases))) continue;
    const next = /^\s*\(/.exec(bare.slice(close + 1));
    if (next) { const o = close + 1 + next[0].length - 1; ranges.push([o, closeOf(o)]); }
  }
  for (const m of bare.matchAll(/\bif\s*\(/g)) {
    const open = m.index + m[0].length - 1, close = closeOf(open);
    if (close < 0) continue;
    const cond = code.slice(open + 1, close);
    const lead = /^\s*/.exec(bare.slice(close + 1))[0].length, start = close + 1 + lead;
    let end;
    if (bare[start] === '{') end = closeOf(start);
    else { const semi = bare.indexOf(';', start), line = bare.indexOf('\n', start); end = [semi, line].filter(i => i >= 0).reduce((a, b) => Math.min(a, b), bare.length); }
    if (end < 0) continue;
    if (onWhenTrue(cond, platform, aliases)) { ranges.push([start, end]); continue; }
    const body = code.slice(bare[start] === '{' ? start + 1 : start, end).trim();
    // An exit stops the rest: return, process.exit(), or a skip followed by return. A bare
    // t.skip() marks the test skipped and runs on (node's test runner), so it clears nothing.
    if (onWhenFalse(cond, platform, aliases) && /^(?:return\b|process\.exit\s*\(|[\w$.]*\bskip\s*\([^()]*\)\s*;?\s*return\b)/.test(body)) {
      const block = enclosing(m.index, '{');
      ranges.push([end, block ? block.close : bare.length]);
    }
  }
  return ranges;
}

/** The lines of a shell script that run only on `platform` (`[ "$(uname)" = Darwin ] || exit 0`, or inside `if [ … = Darwin ]; then … fi`): [[from, to], …] by line. */
export function shellGuardRanges(lines, platform) {
  const name = SHELL_PLATFORM[platform];
  if (!name) return [];
  const eq = new RegExp(`(?:^|[^!])==?\\s*["']?${name}["']?`), neq = new RegExp(`!=\\s*["']?${name}["']?`);
  const fiOf = i => { let depth = 0; for (let k = i; k < lines.length; k++) { if (/^\s*if\b/.test(lines[k])) depth++; if (/(^|[\s;])fi\b/.test(lines[k]) && --depth === 0) return k; } return lines.length - 1; };
  const elseOf = (i, fi) => {
    let depth = 0;
    for (let k = i; k < fi; k++) {
      if (k > i && depth === 1 && /^\s*(?:else|elif)\b/.test(lines[k])) return k - 1;
      if (/^\s*if\b/.test(lines[k])) depth++;
      if (/(^|[\s;])fi\b/.test(lines[k])) depth--;
    }
    return fi;
  };
  const ranges = [];
  lines.forEach((line, i) => {
    if (!/uname/.test(line) || !new RegExp(name).test(line)) return;
    const isEq = eq.test(line), isNeq = neq.test(line);
    if ((isEq && /\|\|\s*exit\b/.test(line)) || (isNeq && /&&\s*exit\b/.test(line))) { ranges.push([i, lines.length - 1]); return; }
    if (!/^\s*if\b/.test(line)) return;
    const fi = fiOf(i);
    // Only the then branch: an else (or elif) at this if's depth runs off the platform.
    // A one-line if with its own else (or elif) holds both branches on one line: no range.
    if (isEq && /\b(?:else|elif)\b/.test(line.slice(line.search(/\bthen\b/) + 1))) return;
    if (isEq) ranges.push([i, elseOf(i, fi)]);
    else if (isNeq && (/\bthen\s+exit\b/.test(line) || lines.slice(i + 1, fi).every(l => /^\s*(?:exit|return)\b/.test(l) || !l.trim()))) ranges.push([fi, lines.length - 1]);
  });
  return ranges;
}

/**
 * The platform-only tools a test file's text runs as commands, by platform:
 * { darwin: ['hdiutil'], … } (a platform with none is absent). A command a
 * guard for its platform covers (guardRanges) is left out; a guard elsewhere
 * in the file covers nothing else.
 */
export function platformCalls(text, path, tools = PLATFORM_TOOLS) {
  const found = {};
  const add = (platform, tool) => { if (!(found[platform] ??= []).includes(tool)) found[platform].push(tool); };
  const matchers = Object.entries(tools).flatMap(([platform, list]) => list.map(tool => ({ platform, tool, m: toolMatcher(tool, platform) })));
  if (/\.(?:sh|bash|zsh)$/.test(path)) {
    const lines = text.split('\n').map(line => line.startsWith('#!') ? '' : line.replace(/(^|\s)#.*$/, '$1'));
    const guards = {};
    lines.forEach((line, i) => {
      for (const { platform, tool, m } of matchers) {
        if (!m.inShell(line.trim())) continue;
        guards[platform] ??= shellGuardRanges(lines, platform);
        if (!guards[platform].some(([a, b]) => a <= i && i <= b)) add(platform, tool);
      }
    });
    return found;
  }
  const { code, strings } = scanSource(text);
  const before = commandBefore(runnersOf(code));
  if (!before) return found;
  const chars = code.split('');
  for (const s of strings) for (let k = s.start + 1; k < s.end - 1; k++) if (chars[k] !== '\n') chars[k] = ' ';
  const bare = chars.join('');
  const guards = {};
  strings.forEach((s, at) => {
    if (!before.test(code.slice(Math.max(0, s.start - 300), s.start))) return;
    for (const { platform, tool, m } of matchers) {
      let runs = m.inShell(s.value.trim());
      // The array form: ('defaults', ['write', …]), ('stat', ['-f', '%z', …]).
      if (!runs && m.words.length > 1 && m.isName(s.value)) {
        runs = true;
        for (let w = 1, prev = s; w < m.words.length && runs; w++) {
          const next = strings[at + w];
          runs = Boolean(next) && /^\s*,\s*\[?\s*$/.test(code.slice(prev.end, next.start)) && m.isWord(w, next.value);
          prev = next;
        }
      }
      if (!runs) continue;
      guards[platform] ??= guardRanges(code, bare, platform);
      if (!guards[platform].some(([a, b]) => a <= s.start && s.start <= b)) add(platform, tool);
    }
  });
  return found;
}

/** The repo's tracked files: git ls-files, or every file (walk) outside a git repository. */
export async function trackedFiles(root) {
  const listed = await new Promise(done => execFile('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (e, out) => done(e ? null : out)));
  return listed === null ? walk(root) : listed.split('\0').filter(Boolean);
}

/**
 * platform-guard: a tracked test file that runs a platform-only tool with no
 * skip for that platform, one lint per file and platform; a bad
 * "platformTools" is one lint on .keel/keel.json.
 */
export async function platformLints(root, config) {
  const problems = platformToolProblems(config?.platformTools);
  const lint = problems.map(message => ({ rule: 'platform-guard', path: '.keel/keel.json', message }));
  const tools = platformTools(config);
  for (const path of (await trackedFiles(root)).filter(isTestFile).sort()) {
    const text = await read(join(root, path)).catch(() => null);
    if (text === null || text.length > 1_000_000) continue;
    for (const [platform, used] of Object.entries(platformCalls(text, path, tools))) {
      const name = PLATFORM_NAMES[platform] ?? platform;
      lint.push({ rule: 'platform-guard', path, message: `runs ${used.map(t => t.replace(/ %$/, ' <format>')).join(', ')} (${name} only) with no ${platform} skip: it passes on a ${name} machine and fails on the others (a Linux CI). Say so: test('…', { skip: process.platform !== '${platform}' }, …)` });
    }
  }
  return lint;
}

// ---- the climb's night ---------------------------------------------------------

/**
 * The newest climb night's record (the climb practice's scripts/keel/climb.mjs
 * writes it; the night's workflow fetches the newest `keel-climb` artifact
 * from the default branch into this path before improve runs).
 */
export const CLIMB_NIGHT = '.keel/climb/night.json';

/**
 * The health page's one line about the newest climb night, or null when
 * climb is off (no "climb" in .keel/keel.json) or never ran (no record). Not a
 * measure: no bound, nothing to ratchet. `night` is the parsed record, or
 * undefined when the file is absent, or the string 'unreadable'.
 */
export function climbLine(config, night) {
  if (config?.climb === undefined || night === undefined || night === null) return null;
  if (typeof night !== 'object' || !Array.isArray(night.tried) || typeof night.job !== 'string' || typeof night.date !== 'string') return `Climb: the newest record (${CLIMB_NIGHT}) is unreadable; see the last keel-climb run.`;
  const kept = night.tried.filter(a => a?.verdict === 'keep').length;
  if (kept) return `Climb: ${night.date} ${night.job}: kept ${kept}, ${Number.isInteger(night.pr) ? `PR #${night.pr}` : `no PR opened${night.gate ? '' : ' (the guard did not pass)'}`}.`;
  const none = night.job === 'hygiene' ? 'none proven steady' : `none beat the noise${Number.isFinite(night.margin) ? ` (margin ${Math.round(night.margin * 100)}%)` : ''}`;
  const why = night.tried.length ? `${night.tried.length} tried, ${none}` : 'nothing was tried';
  return `Climb: ${night.date} ${night.job}: kept nothing (${why}).`;
}

/** A climb job's PR branch prefix. */
export const CLIMB_PREFIX = 'keel-climb/';
/** Closed-unmerged PRs in a row that make a climb job propose its own retirement (phase 36). */
export const RETIRE_AFTER = 3;

/**
 * The climb jobs whose last RETIRE_AFTER `keel-climb/<job>/` PRs (newest by
 * createdAt, from gh's list of EVERY state: `--state all`) were all closed
 * unmerged: [{ job, prs }]. A merged or an open PR among the newest three
 * breaks the streak; a closed-only list never shows an open one, so it would
 * reach past it to older closed PRs. A person reading three and merging none is the
 * verdict; reopening one, or merging the next, lifts it.
 * `prs`: [{ headRefName, number, createdAt, mergedAt, state }].
 */
/** gh's state when it is given (CLOSED, not MERGED or OPEN); without one, no merge time. */
const closedUnmerged = p => (p.state === undefined ? !p.mergedAt : String(p.state).toUpperCase() === 'CLOSED' && !p.mergedAt);

export function climbRetiring(prs, jobs) {
  const out = [];
  for (const job of jobs) {
    const mine = prs.filter(p => typeof p?.headRefName === 'string' && p.headRefName.startsWith(`${CLIMB_PREFIX}${job}/`))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, RETIRE_AFTER);
    if (mine.length === RETIRE_AFTER && mine.every(closedUnmerged)) out.push({ job, prs: mine.map(p => p.number) });
  }
  return out;
}

/** The health page's line for a job that proposes its own retirement. */
export const retireLine = ({ job, prs }) => `Climb: \`${job}\` proposes its own retirement: its last ${RETIRE_AFTER} ${CLIMB_PREFIX}${job}/ PRs (${prs.map(n => `#${n}`).join(', ')}) were closed unmerged. Remove it from "climb".jobs, or reopen one; until then climb nights skip it.`;

/** The climb night's record under root: the object, undefined when absent, 'unreadable' otherwise. */
export async function readClimbNight(root) {
  const text = await read(join(root, CLIMB_NIGHT));
  if (text === null) return undefined;
  try { return JSON.parse(text); } catch { return 'unreadable'; }
}

// ---- the tend pass ------------------------------------------------------------

/**
 * The newest tend pass's record (the climb practice's scripts/keel/tend.mjs
 * writes it; the night's workflow fetches the newest `keel-tend` artifact
 * from the default branch into this path before improve runs).
 */
export const TEND_PASS = '.keel/tend/pass.json';

/**
 * The health page's one line about the newest tend pass, or null when tend is
 * off (no "tend" in .keel/keel.json) or never ran. What it resolved, its PR,
 * and each finding it left unresolved, named, with what it tried. `pass` is
 * the parsed record, undefined when absent, or the string 'unreadable'.
 */
export function tendLine(config, pass) {
  if (config?.tend === undefined || pass === undefined || pass === null) return null;
  const w = pass?.worksheet;
  if (typeof pass !== 'object' || typeof pass.date !== 'string' || !Array.isArray(w?.findings)) return `Tend: the newest record (${TEND_PASS}) is unreadable; see the last keel-tend run.`;
  if (typeof pass.line !== 'string') return `Tend: ${pass.date}: ${w.findings.length} finding${w.findings.length === 1 ? '' : 's'} on the worksheet; the pass did not finish (${pass.gate ? 'no report' : 'the tend guard or the gate did not pass'}); see the last keel-tend run.`;
  const resolved = Array.isArray(pass.resolved) ? pass.resolved.length : 0;
  const proposed = Array.isArray(pass.proposed) ? pass.proposed.length : 0;
  const left = Array.isArray(pass.unresolved) ? pass.unresolved : [];
  const pr = Number.isInteger(pass.pr) ? `PR #${pass.pr}` : resolved ? 'no PR opened' : 'nothing to merge';
  const named = left.slice(0, 5).map(u => `\`${u.id}\`${u.tried ? ` (tried: ${String(u.tried).replace(/\s+/g, ' ').slice(0, 120)})` : ' (not tried)'}`);
  return `Tend: ${pass.date}: resolved ${resolved} of ${w.findings.length}, ${proposed} proposed for the owner, ${pr}${left.length ? `; unresolved: ${named.join(', ')}${left.length > 5 ? `, and ${left.length - 5} more` : ''}` : ''}.`;
}

/** The tend pass's record under root: the object, undefined when absent, 'unreadable' otherwise. */
export async function readTendPass(root) {
  const text = await read(join(root, TEND_PASS));
  if (text === null) return undefined;
  try { return JSON.parse(text); } catch { return 'unreadable'; }
}

// ---- budget use (keel phase 43) -----------------------------------------------
//
// Each budgeted pass that is on (its key in .keel/keel.json) shows the minutes
// its agent step used in its last runs, from GitHub's own record of the runs
// (the step's startedAt to completedAt), which ran out, and a suggestion. A
// line, never a measure (a budget used fully is not unhealthy: lesson 6), and
// never a change: the budget is money, and a person sets it.

/**
 * Each workflow's agent step (the one that uses claude-code-action) and the
 * step right after it that says whether the agent ran, by name. The agent
 * step is continue-on-error, so it says success even when the agent never
 * started; its check step's failure says that. tests/workflows.test.mjs
 * holds this equal to the shipped workflows.
 */
const AGENT_CHECK = 'Did the agent run?';
export const BUDGET_STEPS = Object.freeze({
  'keel-tend.yml': Object.freeze({ agent: 'Tend', check: AGENT_CHECK }),
  'keel-climb.yml': Object.freeze({ agent: 'Climb', check: AGENT_CHECK }),
  'keel-cross-review.yml': Object.freeze({ agent: 'Review', check: AGENT_CHECK }),
});
/**
 * The budgeted passes, in the line's order: the config key that turns each on,
 * its workflow, the default minutes (tend.mjs TEND_DEFAULTS, climb.mjs DEFAULTS,
 * cross-review.mjs DEFAULTS), and whether its runs are on the default branch
 * (cross-review runs on its PR's branch).
 */
export const BUDGET_PASSES = Object.freeze([
  { pass: 'tend', key: 'tend', workflow: 'keel-tend.yml', minutes: 30, branch: true, defaults: [['0.0.0', 30]] },
  { pass: 'climb', key: 'climb', workflow: 'keel-climb.yml', minutes: 45, branch: true, defaults: [['0.0.0', 45]] },
  { pass: 'cross-review', key: 'crossReview', workflow: 'keel-cross-review.yml', minutes: 15, branch: false, defaults: [['0.0.0', 15]] },
]);
// `defaults`: [practice version, the default from it], oldest first. Changing a
// pass's default appends an entry (a test holds the newest equal to `minutes`),
// so a config left to the default is read with the default of its own version.
/** The window: at most this many runs with the agent step. */
export const BUDGET_RUNS = 8;
/** Fewer runs than this is too few to say. */
export const BUDGET_MIN = 4;
/** Runs examined per pass before the read stops looking for more with the step. */
export const BUDGET_EXAMINE = 20;
/** Past configs (.keel/keel.json at a commit) read per night to find since when each budget is today's. */
export const BUDGET_HISTORY = 10;

/** The budgeted passes that are on: [{ pass, workflow, step, check, minutes, branch }], with today's budget. */
export function budgetPasses(config) {
  return BUDGET_PASSES.filter(p => config?.[p.key] !== undefined && config[p.key] !== null)
    .map(p => ({ pass: p.pass, key: p.key, workflow: p.workflow, step: BUDGET_STEPS[p.workflow].agent, check: BUDGET_STEPS[p.workflow].check, minutes: budgetOf(config, p), raw: budgetRaw(config, p), branch: p.branch }));
}

/** A pass's budget in a config: its budget.minutes, else its default (a missing key too). `pass`: a BUDGET_PASSES entry (or one with its key). */
export function budgetOf(config, pass) {
  const def = BUDGET_PASSES.find(p => p.key === pass.key) ?? pass;
  const m = config?.[def.key]?.budget?.minutes;
  return Number.isFinite(m) && m > 0 ? m : def.minutes;
}

const versionParts = v => String(v ?? '').split('.').map(n => Number.parseInt(n, 10) || 0);
const versionAtMost = (a, b) => { const x = versionParts(a), y = versionParts(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0); return true; };

/** A pass's budget as that config ran it: 'off' when the pass is not on there; its budget.minutes; else the default of the config's own practice version (a default can change between releases), never today's. */
export function budgetRaw(config, pass) {
  if (config?.[pass.key] === undefined || config?.[pass.key] === null) return 'off';
  const m = config[pass.key]?.budget?.minutes;
  if (Number.isFinite(m) && m > 0) return m;
  const def = pass.defaults ? pass : BUDGET_PASSES.find(p => p.key === pass.key) ?? pass;
  const table = def.defaults ?? [['0.0.0', def.minutes]];
  return (config?.practice ? table.filter(([v]) => versionAtMost(v, config.practice)).at(-1) : null)?.[1] ?? table[0][1];
}

/**
 * Since when the budget has been today's (phase 43): a run under an older
 * budget is not judged against today's. `history` is the config at each
 * commit that touched .keel/keel.json on the default branch, newest first:
 * [{ date, config }]. The since is the date of the oldest commit in the
 * unbroken run of commits with today's budget as written (budgetRaw); null
 * when the whole history was read and none differs (no cutoff). When the
 * history read stopped short (`complete: false`: a cap, a full page), the
 * oldest commit read is the since: older runs may be another budget. When
 * the newest commit already differs (today's budget is not committed yet),
 * the since is now: no run is under it.
 */
export function budgetSince(history, pass, raw, { complete = true, now = new Date().toISOString() } = {}) {
  let since = null;
  for (const h of history) {
    if (budgetRaw(h.config, pass) !== raw) return since ?? now;
    since = h.date;
  }
  return complete ? null : since ?? now;
}

const stamp = (s, a, b) => Date.parse(s?.[a] ?? s?.[b] ?? '');

/**
 * One run's agent step: { seconds, ranOut } or null when the run never reached
 * it (no such step, skipped, or no times) or the agent never started (its
 * check step, `check`, concluded failure; a run without that step, from
 * before it existed, is counted). `jobs` is the run's jobs as the API gives
 * them (steps with name, started_at/startedAt, completed_at/completedAt,
 * conclusion). Ran out: cancelled or timed out, or used the budget less one minute.
 */
export function stepUse(jobs, { step, check, minutes }) {
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    if (check && steps.some(s => s?.name === check && s.conclusion === 'failure')) return null;
    for (const s of steps) {
      if (s?.name !== step || s.conclusion === 'skipped') continue;
      const from = stamp(s, 'started_at', 'startedAt'), to = stamp(s, 'completed_at', 'completedAt');
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
      const seconds = (to - from) / 1000;
      return { seconds, ranOut: s.conclusion === 'cancelled' || s.conclusion === 'timed_out' || seconds >= (minutes - 1) * 60 };
    }
  }
  return null;
}

/**
 * From the runs, newest first (each { jobs }): the agent step's use in the
 * last BUDGET_RUNS that reached it, and the suggestion. extend when half or
 * more ran out; shorten to N when none used more than half the budget (N the
 * most used, rounded up to 5, at least 5, and below the budget); hold
 * otherwise; too few to say below BUDGET_MIN. `since` (budgetSince): runs
 * created before it were under an older budget and are not counted.
 * { used: [{ minutes, ranOut }], ranOut, suggestion }.
 */
export function budgetUse(runs, { step, check, minutes }, { since = null } = {}) {
  const uses = [];
  const from = since ? Date.parse(since) : -Infinity;
  for (const r of Array.isArray(runs) ? runs : []) {
    // A run under an older budget (created before today's) is not judged against it.
    if (since && !(Date.parse(r?.created_at ?? '') >= from)) continue;
    const u = stepUse(r?.jobs, { step, check, minutes });
    if (u) uses.push(u);
    if (uses.length === BUDGET_RUNS) break;
  }
  const ranOut = uses.filter(u => u.ranOut).length;
  let suggestion;
  if (uses.length < BUDGET_MIN) suggestion = 'too few to say';
  else if (ranOut * 2 >= uses.length) suggestion = 'extend';
  else {
    const most = Math.max(...uses.map(u => u.seconds)) / 60;
    const n = Math.max(5, Math.ceil(most / 5) * 5);
    suggestion = most <= minutes / 2 && n < minutes ? `shorten to ${n}` : 'hold';
  }
  return { used: uses.map(u => ({ minutes: Math.round(u.seconds / 60), ranOut: u.ranOut })), ranOut, suggestion };
}

/** One pass's entry on the Budget line: its use, or n/a with why (`na`). */
export function budgetEntry({ pass, minutes, na, use, since = null }) {
  if (na) return `${pass} n/a (${na}) of ${minutes} min`;
  const { used, ranOut, suggestion } = use;
  const of = `of ${minutes} min${since ? ` since ${String(since).slice(0, 10)}` : ''}`;
  if (!used.length) return `${pass}: no runs yet ${of} (too few to say)`;
  const shown = used.map(u => `${u.minutes}${u.ranOut ? '⏱' : ''}`).join(', ');
  return `${pass} ${shown} ${of} (${suggestion === 'too few to say' ? `last ${used.length} run${used.length === 1 ? '' : 's'}; ${suggestion}` : `last ${used.length}: ${ranOut || 'none'} ran out; ${suggestion}`})`;
}

/** The health page's Budget line from each on pass's entry, or null with no pass on. */
export const budgetLine = entries => entries.length ? `Budget: ${entries.map(budgetEntry).join(' · ')}` : null;

// ---- review comments (keel phase 41) -------------------------------------------
//
// A review thread is answered when its newest comment is by someone other
// than the author of its first comment (or a named reviewer): resolving it is
// not an answer, and a reviewer's follow-up reopens it. A named reviewer's
// conversation comment, and any reviewer's review body (a review's top-level
// text), is answered by a later conversation comment from someone else that
// quotes a line of it (`> `), links its URL or names its id: a later unrelated
// comment is not an answer. A status board (a comment or review body opening
// with a hidden <!-- marker -->, which a bot edits in place, as Codex's review
// summary does) is listed and owes no answer. A list longer than its page is
// an incomplete read, never a count. keel review and the night's
// reviews_unanswered read this one rule. Reading is deterministic; whether a
// comment is right is the answerer's judgement, recorded in the reply.

export const REVIEW_WAIT = 10;
export const REVIEW_LABEL = 'keel:wait-for-review';
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?$/;

/** .keel/keel.json "review": { reviewers, wait } with defaults (none named, 10 minutes), or { problem }. */
export function reviewConfigOf(config) {
  const r = config?.review;
  if (r === undefined) return { reviewers: [], wait: REVIEW_WAIT };
  const bad = why => ({ problem: `.keel/keel.json "review" ${why}` });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return bad('must be an object: {"reviewers": ["<login>"], "wait": <minutes>}');
  const extra = Object.keys(r).find(k => !['reviewers', 'wait'].includes(k));
  if (extra) return bad(`has an unknown key "${extra}" (reviewers, wait)`);
  const reviewers = r.reviewers ?? [];
  if (!Array.isArray(reviewers) || reviewers.some(x => typeof x !== 'string' || !LOGIN.test(x))) return bad('"reviewers" must be a list of GitHub logins');
  const wait = r.wait ?? REVIEW_WAIT;
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait <= 0 || wait > 120) return bad('"wait" must be minutes, more than 0 and at most 120');
  return { reviewers, wait };
}

/** A login as both APIs agree on it: REST says `codex[bot]`, GraphQL `codex`. */
export const sameLogin = (a, b) => normLogin(a) === normLogin(b) && normLogin(a) !== '';
const normLogin = s => String(s ?? '').replace(/\[bot\]$/i, '').toLowerCase();

/** A read that came back short (a list longer than its page): never a count. keel review exits 2; the night is n/a. */
export class IncompleteRead extends Error {
  constructor(message) { super(message); this.incomplete = true; }
}

/**
 * The PullRequest fields the review read needs, as a GraphQL fragment: one
 * page of `threads` review threads, `replies` comments in each, `comments`
 * conversation comments and `reviews` review bodies. keel review reads a
 * smaller window first and this full one only when a list overflows it.
 */
export const reviewFragment = ({ threads = 100, replies = 100, comments = 100, reviews = 100 } = {}) => `fragment KeelReview on PullRequest {
  number title url state mergedAt updatedAt headRefName headRefOid body repository { nameWithOwner } headRepository { nameWithOwner } author { __typename login }
  reviewThreads(first: ${threads}) { pageInfo { hasNextPage } nodes { id isResolved path line
    comments(first: ${replies}) { pageInfo { hasNextPage } nodes { databaseId author { login } body createdAt url } } } }
  comments(first: ${comments}) { pageInfo { hasNextPage } nodes { id databaseId author { __typename login } body createdAt url } }
  reviews(first: ${reviews}) { pageInfo { hasNextPage endCursor } nodes { id databaseId author { __typename login } commit { oid } body state submittedAt url } }
}`;

// ---- what a read costs (GitHub's GraphQL allowance) -----------------------------
//
// GitHub prices a GraphQL query by the nodes it COULD return: each nested
// connection's first/last multiplies the requests its parent's page may need,
// summed and divided by 100. Every keel query asks rateLimit too (free), so the
// caller can say what it spent and what is left: the owner's allowance is
// shared by every tool on their login, and keel's reads once spent all of it.

/** The selection every keel GraphQL query carries: what this query cost, and what is left of the hour's allowance. */
export const RATE_LIMIT = 'rateLimit { cost remaining resetAt }';

/** A tally of GraphQL spend over several queries: { cost, queries, remaining, resetAt }; add(rateLimit) after each. */
export function rateSpend() {
  const s = {
    cost: 0, queries: 0, remaining: null, resetAt: null,
    add(rl) {
      if (!rl || typeof rl !== 'object') return s;
      s.queries++;
      if (Number.isFinite(rl.cost)) s.cost += rl.cost;
      // The lowest seen is the latest: queries in parallel may answer out of order.
      if (Number.isFinite(rl.remaining) && (s.remaining === null || rl.remaining < s.remaining || (rl.resetAt && s.resetAt && rl.resetAt > s.resetAt))) { s.remaining = rl.remaining; s.resetAt = rl.resetAt ?? s.resetAt; }
      return s;
    },
    toJSON: () => ({ cost: s.cost, queries: s.queries, remaining: s.remaining, resetAt: s.resetAt }),
  };
  return s;
}

/** gh api graphql's stdout as its data: throws on no JSON or a GraphQL error; records the query's rateLimit in `spend`. */
export function graphqlData(stdout, spend) {
  let out;
  try { out = JSON.parse(stdout); } catch { throw new Error('gh api graphql did not print JSON'); }
  // A partial answer (data beside errors) can null a page's flags or a list: never read as whole.
  if (Array.isArray(out?.errors) && out.errors.length) throw new Error(`gh api graphql: ${out.errors[0]?.message ?? 'an error'}`);
  spend?.add(out?.data?.rateLimit);
  return out?.data;
}

const plain = line => String(line).replace(/<[^>]*>/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim();
const plainLines = body => String(body ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n').map(plain).filter(Boolean);
const firstLine = body => plainLines(body)[0]?.slice(0, 140) ?? '';
/** A bot's status board (a sticky comment it edits in place, opened by a hidden <!-- marker -->): listed, never owed an answer. */
const isStatus = body => /^\s*<!--/.test(String(body ?? ''));
// Robot author and reviewer share the Actions identity. Only the exact posted
// envelope, tied to this PR's canonical delivery association, is an exception.
function robotReview(pr, review) {
  const bot = author => author?.__typename === 'Bot' && sameLogin(author.login, 'github-actions[bot]');
  if (!bot(pr.author) || !bot(review.author)) return null;
  if ((String(review.body ?? '').match(/<!-- keel:robot-review/g) ?? []).length !== 1) return null;
  const envelope = /^<!-- keel:robot-review ((?:[a-f0-9]{40}|[a-f0-9]{64})) (claude|codex) -->\nReviewed by (claude|codex); built by (claude|codex)\.\n\n([\s\S]+)$/.exec(review.body ?? '');
  if (!envelope || envelope[2] !== envelope[3] || envelope[2] === envelope[4] || review.commit?.oid !== envelope[1]) return null;
  const marks = [...String(pr.body ?? '').matchAll(/^<!-- keel:robot-delivery (.+) -->$/gm)];
  if (marks.length !== 1) return null;
  let mark;
  try { mark = JSON.parse(marks[0][1]); } catch { return null; }
  const {version,repo,issueNumber,instanceId,author,headSha,cursor} = mark ?? {};
  if (version !== 1 || !/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || repo.split('/').some(part => part === '.' || part === '..') || !Number.isSafeInteger(pr.number) || pr.number < 1 || !Number.isSafeInteger(issueNumber) || issueNumber < 1 || !/^[A-Za-z0-9_-]{1,128}$/.test(instanceId ?? '') || !Number.isSafeInteger(cursor) || cursor < 0 || author !== envelope[4] || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(headSha ?? '') || pr.headRefName !== `keel/robot-${issueNumber}` || pr.repository?.nameWithOwner !== repo || pr.headRepository?.nameWithOwner !== repo || pr.url !== `https://github.com/${repo}/pull/${pr.number}`) return null;
  if (marks[0][1] !== JSON.stringify({version,repo,issueNumber,instanceId,author,headSha,cursor})) return null;
  if (headSha !== envelope[1]) {
    // A later review must have its own immutable bot receipt. A short window
    // cannot prove absence, uniqueness, or that nobody answered the finding.
    if (!Array.isArray(pr.comments?.nodes) || pr.comments.pageInfo?.hasNextPage !== false || pr.comments.pageInfo?.hasPreviousPage) throw new IncompleteRead('robot continuation comments are incomplete');
    const matches = new Set();
    for (const c of pr.comments.nodes) {
      if (!bot(c.author) || !String(c.body ?? '').includes('<!-- keel:robot-continuation')) continue;
      const fail = () => { throw new Error('robot continuation metadata is malformed or inconsistent'); };
      if (!Number.isSafeInteger(c.databaseId) || c.databaseId < 1 || c.url !== `${pr.url}#issuecomment-${c.databaseId}` || (c.body.match(/<!-- keel:robot-continuation/g) ?? []).length !== 1) fail();
      const m = /^<!-- keel:robot-continuation (.+) -->\nTrusted robot continuation\.\n\n/.exec(c.body);
      if (!m) fail();
      let v;
      try { v = JSON.parse(m[1]); } catch { fail(); }
      const a = v?.authorization;
      if (!v || !a || !Number.isSafeInteger(a.receiptId) || a.receiptId < 1 || !/^[a-f0-9]{64}$/.test(a.bodyHash ?? '') || !/^[a-f0-9]{64}$/.test(a.policyHash ?? '') || !/^[A-Za-z0-9-]+$/.test(a.writer ?? '')) fail();
      const canonical = {version:1,repo,prNumber:pr.number,issueNumber,instanceId,author,headSha:v.headSha,cursor:v.cursor,authorization:{receiptId:a.receiptId,bodyHash:a.bodyHash,writer:a.writer,policyHash:a.policyHash}};
      if (JSON.stringify(canonical) !== m[1] || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v.headSha ?? '') || !Number.isSafeInteger(v.cursor) || v.cursor < cursor) fail();
      if (v.headSha === envelope[1]) matches.add(m[1]);
    }
    if (matches.size !== 1) throw new Error('robot review exact-head continuation metadata is missing or conflicting');
  }
  const text = envelope[5].trim();
  return { text, status: false };
}
/** Whether `body` answers comment `c`: it names c's id, links c's URL, or quotes (`> `) a line of it. */
export function references(body, c) {
  const text = String(body ?? '');
  if ((c.id && text.includes(c.id)) || (c.url && text.includes(c.url))) return true;
  const lines = plainLines(c.body), all = lines.join(' ');
  return text.split('\n').filter(l => /^\s*>/.test(l)).map(plain).some(q => q && (lines.includes(q) || (q.length >= 12 && all.includes(q))));
}
const loginOf = x => x?.author?.login ?? 'ghost';
const page = (conn, what, pr) => {
  if (conn?.pageInfo?.hasNextPage) throw new IncompleteRead(`#${pr.number} has more ${what} than one page; the read is incomplete`);
  return conn?.nodes;
};

/**
 * Every review comment on one PR (GraphQL, through reviewFragment), with
 * whether it is answered: [{ kind: 'thread'|'comment'|'review', id,
 * databaseId, author, at, path, line, text, url, answered, resolved, status }].
 * A thread is answered when its newest comment is by someone other than its
 * first author or a named reviewer (resolving it is not an answer). A named
 * reviewer's conversation comment, and any reviewer's review body, is answered
 * by a later conversation comment from someone else that quotes a line of it,
 * links it, or names its id. Throws IncompleteRead when any list is longer
 * than its page: a comment not read is never counted as answered.
 */
export function reviewComments(pr, reviewers = []) {
  if (!pr || typeof pr !== 'object' || !pr.reviewThreads || !Array.isArray(pr.reviewThreads.nodes)) throw new Error('the pull request came back without its review threads');
  // A connection GitHub could not read comes back null beside other data: never an empty list.
  for (const [k, what] of [['comments', 'conversation comments'], ['reviews', 'reviews']]) if (pr[k] !== undefined && !Array.isArray(pr[k]?.nodes)) throw new Error(`the pull request came back without its ${what}`);
  const isNamed = login => reviewers.some(r => sameLogin(r, login));
  const out = [];
  for (const t of page(pr.reviewThreads, 'review threads', pr)) {
    const comments = page(t?.comments, 'comments in a review thread', pr) ?? [];
    const first = comments[0];
    if (!first) continue;
    const by = loginOf(first);
    // The newest comment decides: a reviewer's follow-up reopens it.
    const last = loginOf(comments.at(-1));
    const answered = comments.length > 1 && !sameLogin(last, by) && !isNamed(last);
    // Reopened: aged from the first comment after the last answer, so a follow-up gets its own day.
    const lastAnswer = comments.findLastIndex(c => !sameLogin(loginOf(c), by) && !isNamed(loginOf(c)));
    const since = answered || lastAnswer < 0 ? first : comments[lastAnswer + 1];
    out.push({ kind: 'thread', id: t.id, databaseId: first.databaseId, author: by, at: since.createdAt, path: t.path ?? null, line: t.line ?? null,
      text: firstLine(first.body), url: first.url, resolved: !!t.isResolved, answered });
  }
  const reviews = (page(pr.reviews, 'reviews', pr) ?? []).filter(r => String(r?.body ?? '').trim() && (robotReview(pr, r) || !(pr.author?.login && sameLogin(loginOf(r), pr.author.login))));
  if (!reviewers.length && !reviews.length) return out;
  const convo = page(pr.comments, 'conversation comments', pr);
  if (!Array.isArray(convo)) throw new Error('the pull request came back without its conversation comments');
  const entry = (kind, c, at) => {
    const robot = kind === 'review' ? robotReview(pr, c) : null;
    const by = loginOf(c), status = robot ? robot.status : isStatus(c.body), after = Date.parse(at);
    const replied = convo.some(o => Date.parse(o.createdAt) > after && !sameLogin(loginOf(o), by) && !isNamed(loginOf(o)) && references(o.body, c));
    return { kind, id: c.id, databaseId: c.databaseId, author: by, at, path: null, line: null, text: firstLine(robot ? robot.text : c.body), url: c.url, resolved: false, status, answered: status || replied };
  };
  for (const r of reviews) out.push(entry('review', r, r.submittedAt));
  for (const c of convo) if (isNamed(loginOf(c))) out.push(entry('comment', c, c.createdAt));
  return out;
}

/**
 * The repo-wide read (reviews_unanswered, loose-ends, the board): open PRs and
 * recently merged ones, REVIEW_PRS a page, REVIEW_PAGES pages at most, each PR
 * through the windowed fragment below.
 */
export const REVIEW_DAYS = 7;
export const REVIEW_PRS = 25;
export const REVIEW_PAGES = 8;
/**
 * The window: what "unanswered" needs and no more. A thread is decided by its
 * first author and its newest comments, so each thread brings its newest
 * WINDOW_TAIL comments and how many it has (a thread of at most WINDOW_TAIL is
 * whole); the newest WINDOW_CONVO conversation comments and WINDOW_BODIES
 * review bodies. A PR the window does not cover whole (more threads, a longer
 * thread, older comments) is read alone with the full fragment (readRepoReviews),
 * never counted as answered.
 */
export const WINDOW_THREADS = 20;
export const WINDOW_TAIL = 4;
export const WINDOW_CONVO = 20;
export const WINDOW_BODIES = 10;
/** At most this many PRs a repo are read alone; past it the read is incomplete. */
export const SOLO_READS = 6;
const NODE = 'databaseId author { __typename login } body createdAt url';
export const windowFragment = () => `fragment KeelReviewWindow on PullRequest {
  keelWindow: __typename number title url state mergedAt updatedAt headRefName headRefOid body repository { nameWithOwner } headRepository { nameWithOwner } author { __typename login }
  reviewThreads(first: ${WINDOW_THREADS}) { pageInfo { hasNextPage } nodes { id isResolved path line
    tail: comments(last: ${WINDOW_TAIL}) { totalCount nodes { ${NODE} } } } }
  comments(last: ${WINDOW_CONVO}) { pageInfo { hasPreviousPage } nodes { id ${NODE} } }
  reviews(last: ${WINDOW_BODIES}) { pageInfo { hasPreviousPage } nodes { id databaseId author { __typename login } commit { oid } body state submittedAt url } }
}`;
export const repoReviewQuery = () => `query($owner: String!, $name: String!, $open: Boolean!, $merged: Boolean!, $openAfter: String, $mergedAfter: String) { ${RATE_LIMIT} repository(owner: $owner, name: $name) {
  open: pullRequests(states: OPEN, first: ${REVIEW_PRS}, after: $openAfter, orderBy: { field: UPDATED_AT, direction: DESC }) @include(if: $open) { pageInfo { hasNextPage endCursor } nodes { ...KeelReviewWindow } }
  merged: pullRequests(states: MERGED, first: ${REVIEW_PRS}, after: $mergedAfter, orderBy: { field: UPDATED_AT, direction: DESC }) @include(if: $merged) { pageInfo { hasNextPage endCursor } nodes { ...KeelReviewWindow } } } }
${windowFragment()}`;
/** gh's arguments for one page of the repo-wide read. */
export const repoReviewArgs = (repo, { open, merged, openAfter, mergedAfter }) => {
  const [owner, name] = String(repo).split('/');
  return ['api', 'graphql', '-f', `query=${repoReviewQuery()}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `open=${open}`, '-F', `merged=${merged}`,
    ...(openAfter ? ['-f', `openAfter=${openAfter}`] : []), ...(mergedAfter ? ['-f', `mergedAfter=${mergedAfter}`] : [])];
};
/** One PR with the full fragment: the read for a PR the window did not cover. */
export const prReviewQuery = (sizes = {}) => `query($owner: String!, $name: String!, $number: Int!) { ${RATE_LIMIT}
  repository(owner: $owner, name: $name) { pullRequest(number: $number) { ...KeelReview } } }
${reviewFragment(sizes)}`;
/**
 * gh's arguments for the PR's review bodies after `after` (a page's
 * endCursor): a PR answered thread by thread passes 100 reviews, since each
 * reply is one, and keel review reads every page rather than refuse.
 */
export const moreReviewsArgs = (repo, number, after) => {
  const [owner, name] = String(repo).split('/');
  const query = `query($owner: String!, $name: String!, $number: Int!, $after: String!) { ${RATE_LIMIT}
  repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviews(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { id databaseId author { __typename login } commit { oid } body state submittedAt url } } } } }`;
  return ['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`, '-f', `after=${after}`];
};
/** gh's arguments for one PR's full read. */
export const prReviewArgs = (repo, number, sizes) => {
  const [owner, name] = String(repo).split('/');
  return ['api', 'graphql', '-f', `query=${prReviewQuery(sizes)}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`];
};

/**
 * A PR read through the window, as the full fragment's shape, and whether the
 * window covered it whole: { pr, whole }. A thread of at most WINDOW_TAIL
 * comments is whole; a longer one, more threads than the page, or (when they
 * can matter: a reviewer named, or a review body) older conversation comments
 * or review bodies than the window are not, and keep a list saying there is
 * more, so reviewComments refuses it rather than count it. A PR already in the
 * full shape (no window) passes through.
 */
export function fromWindow(pr, reviewers = []) {
  if (!pr || typeof pr !== 'object' || pr.keelWindow === undefined) return { pr, whole: true };
  const { keelWindow, ...rest } = pr;
  let whole = !rest.reviewThreads?.pageInfo?.hasNextPage;
  const threads = (rest.reviewThreads?.nodes ?? []).map(t => {
    if (!t?.tail) return t;
    const { tail, ...th } = t;
    const nodes = tail.nodes ?? [];
    const all = Number.isFinite(tail.totalCount) ? tail.totalCount <= nodes.length : false;
    if (!all) whole = false;
    return { ...th, comments: { pageInfo: { hasNextPage: !all }, nodes } };
  });
  // A missing connection stays missing, so reviewComments refuses it.
  const list = conn => conn && Array.isArray(conn.nodes) ? { pageInfo: { hasNextPage: !!conn.pageInfo?.hasPreviousPage }, nodes: conn.nodes } : conn;
  const comments = list(rest.comments), reviews = list(rest.reviews);
  const bodies = (reviews?.nodes ?? []).some(r => String(r?.body ?? '').trim() && (String(r.body).startsWith('<!-- keel:robot-review ') || !(rest.author?.login && sameLogin(r?.author?.login, rest.author.login))));
  if (reviews?.pageInfo.hasNextPage) whole = false;
  if ((reviewers.length || bodies) && (!comments || comments.pageInfo.hasNextPage)) whole = false;
  return { pr: { ...rest, reviewThreads: { pageInfo: { hasNextPage: !!rest.reviewThreads?.pageInfo?.hasNextPage }, nodes: threads }, comments, reviews }, whole };
}

/** Merged PRs come newest-updated first: past one updated before `since`, none was merged in the window. */
const mergedMore = (merged, since) => {
  if (!merged.pageInfo?.hasNextPage) return false;
  const last = merged.nodes.at(-1)?.updatedAt;
  return !(typeof last === 'string' && last < since);
};

/**
 * The repo-wide read, page by page: `read(vars)` runs one page (repoReviewArgs)
 * and returns its data.repository. Returns { open, merged } as one page would
 * be, its pageInfo saying whether anything is left unread (unansweredPrs
 * refuses that), each PR in the full fragment's shape (fromWindow). A PR in
 * the window's span (open, or merged in REVIEW_DAYS) that the window did not
 * cover whole is read alone by `readPr(number)` (prReviewArgs; its
 * data.repository.pullRequest), SOLO_READS at most; without readPr, or past
 * that, it stays as read and reviewComments refuses it: never a count.
 */
export async function readRepoReviews(read, date, { readPr, reviewers = [] } = {}) {
  const since = addDays(date, -REVIEW_DAYS);
  const lists = { open: { pageInfo: { hasNextPage: true }, nodes: [] }, merged: { pageInfo: { hasNextPage: true }, nodes: [] } };
  for (let i = 0; i < REVIEW_PAGES; i++) {
    const want = { open: !!lists.open.pageInfo.hasNextPage, merged: i === 0 || mergedMore(lists.merged, since) };
    if (!want.open && !want.merged) break;
    const repository = await read({ ...want, openAfter: lists.open.pageInfo.endCursor ?? null, mergedAfter: lists.merged.pageInfo.endCursor ?? null });
    if (!repository) throw new Error('the read came back without the repository');
    for (const k of ['open', 'merged']) {
      if (!want[k]) continue;
      const got = repository[k];
      if (!Array.isArray(got?.nodes)) throw new Error('the read came back without the repository\'s pull requests');
      lists[k] = { pageInfo: { hasNextPage: !!got.pageInfo?.hasNextPage, endCursor: got.pageInfo?.endCursor ?? null }, nodes: [...lists[k].nodes, ...got.nodes] };
      if (got.pageInfo?.hasNextPage && !got.pageInfo?.endCursor) throw new IncompleteRead(`the ${k} pull requests came back with more pages and no cursor; the read is incomplete`);
    }
  }
  let solo = 0;
  for (const k of ['open', 'merged']) {
    lists[k].nodes = await Promise.all(lists[k].nodes.map(async node => {
      const { pr, whole } = fromWindow(node, reviewers);
      const inSpan = k === 'open' || (typeof pr?.mergedAt === 'string' && pr.mergedAt.slice(0, 10) >= since);
      if (whole || !inSpan || !readPr || solo >= SOLO_READS) return pr;
      solo++;
      const full = await readPr(pr.number);
      if (!full || typeof full !== 'object') throw new Error(`the read of #${pr.number} came back without the pull request`);
      return full;
    }));
  }
  return lists;
}

/**
 * From the repo-wide read (readRepoReviews): each PR (open, or merged in the
 * last REVIEW_DAYS days) with comments unanswered for a day or more, by
 * calendar day against `date` (YYYY-MM-DD). Throws on a malformed read, and
 * IncompleteRead on one with pull requests left unread: never a zero.
 */
export function unansweredPrs(repository, reviewers, date) {
  const { open, merged } = windowPrs(repository, date);
  const prs = [];
  for (const pr of [...open, ...merged]) {
    const left = reviewComments(pr, reviewers).filter(c => !c.answered && /^\d{4}-\d{2}-\d{2}/.test(c.at ?? '') && c.at.slice(0, 10) <= addDays(date, -1));
    if (left.length) prs.push({ number: pr.number, title: pr.title, state: pr.state === 'MERGED' ? 'merged' : 'open', url: pr.url, author: pr.author ? `${pr.author.__typename === 'Bot' ? 'app/' : ''}${pr.author.login}` : null, unanswered: left.length, oldest: left.map(c => c.at.slice(0, 10)).sort()[0] });
  }
  return { prs, open: open.length, merged: merged.length };
}

/**
 * The PRs the repo-wide read covers (readRepoReviews): { open, merged }, the
 * merged ones those merged in the last REVIEW_DAYS days. Throws on a malformed
 * read, and IncompleteRead on one with pull requests left unread.
 */
export function windowPrs(repository, date) {
  if (!repository || !Array.isArray(repository.open?.nodes) || !Array.isArray(repository.merged?.nodes)) throw new Error('the read came back without the repository\'s pull requests');
  const since = addDays(date, -REVIEW_DAYS);
  if (repository.open.pageInfo?.hasNextPage) throw new IncompleteRead(`more than ${repository.open.nodes.length} open pull requests; the read is incomplete`);
  if (mergedMore(repository.merged, since)) throw new IncompleteRead(`more pull requests merged in ${REVIEW_DAYS} days than ${repository.merged.nodes.length} read; the read is incomplete`);
  return { open: repository.open.nodes, merged: repository.merged.nodes.filter(p => typeof p?.mergedAt === 'string' && p.mergedAt.slice(0, 10) >= since) };
}

// ---- the gate's environment -------------------------------------------------

export const ENV_KEY = /^[A-Z_][A-Z0-9_]*$/;

/**
 * What is wrong with .keel/keel.json `setup` (a shell command, run before the
 * gate by the night's workflows), `setupToken` (the NAME of a repo secret the
 * night's Install step hands `setup` as GH_TOKEN, for a `gh repo clone` of a
 * private repo; never a value) and `env` (a flat map applied wherever keel
 * runs the gate). All are optional. Returns a list of messages.
 */
export function setupEnvProblems(config) {
  const problems = [];
  if (config?.setup !== undefined && (typeof config.setup !== 'string' || !config.setup.trim())) problems.push('"setup" must be a non-empty shell command');
  const token = config?.setupToken;
  if (token !== undefined) {
    if (typeof token !== 'string' || !ENV_KEY.test(token)) problems.push(`"setupToken" must name a repo secret (${ENV_KEY.source}), never hold a token`);
    else if (token.startsWith('GITHUB_')) problems.push('"setupToken" cannot start with GITHUB_ (GitHub reserves those secret names; the default token is used when setupToken is absent)');
    if (config?.setup === undefined) problems.push('"setupToken" is set but there is no "setup" to hand it to');
  }
  const env = config?.env;
  if (env === undefined) return problems;
  if (!env || typeof env !== 'object' || Array.isArray(env)) return [...problems, '"env" must be an object of NAME: "value"'];
  for (const [k, v] of Object.entries(env)) {
    if (!ENV_KEY.test(k)) problems.push(`"env" key ${JSON.stringify(k)} is not an environment variable name (${ENV_KEY.source})`);
    if (typeof v !== 'string') problems.push(`"env" ${k} must be a string`);
  }
  return problems;
}

/**
 * The environment the project's gate runs in. Never a test runner's context:
 * its node --test would skip every file and pass (lesson 14). The project's
 * `env` goes over it, so a gate that must not sync or push (ledger's
 * LEDGER_AUTOSYNC=0) never does from a keel run. A bad `env` throws.
 */
export function gateEnv(env, config) {
  const problems = setupEnvProblems({ env: config?.env });
  if (problems.length) throw new Error(`.keel/keel.json: ${problems.join('; ')}`);
  // KEEL_AGENT_GIT is climb.mjs's own (phase 47): a gate never inherits it, so a project's tests run git as they always do.
  const base = Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('NODE_TEST_') && k !== 'KEEL_AGENT_GIT'));
  return { ...base, ...(config?.env ?? {}) };
}

// ---- running a script --------------------------------------------------------

/** True when `meta` is the module node was started with. */
export function isMain(meta) {
  if (!process.argv[1]) return false;
  const real = p => { try { return realpathSync(p); } catch { return resolve(p); } };
  return real(process.argv[1]) === real(fileURLToPath(meta.url));
}

/** The project root of a script at scripts/keel/<name>.mjs. */
export const rootOf = meta => resolve(fileURLToPath(meta.url), '..', '..', '..');

/**
 * Run fn(args) → { data, text, exitCode? }; print data under --json, text
 * otherwise. An error prints and exits with its exitCode (default 1).
 */
export async function main(fn, argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  try {
    const r = await fn(argv.filter(a => a !== '--json'));
    process.stdout.write(json ? `${JSON.stringify(r.data, null, 2)}\n` : `${r.text}\n`);
    process.exitCode = r.exitCode ?? 0;
  } catch (error) {
    const message = String(error?.message ?? error).split('\n')[0];
    if (json) process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    else process.stderr.write(`${message}\n`);
    process.exitCode = error?.exitCode ?? 1;
  }
}

// ---- agents: providers behind keel's rules (phase 45) ---------------------------
//
// A provider is an adapter; the rules are keel's. .keel/keel.json names the
// providers a project uses ("agents": { "claude": {}, "codex": {} }) and each
// pass names which one runs it ("agent" on crossReview, climb and tend,
// default claude). The adapter says what differs: the action and its major,
// its secrets, how "read-only" and "may edit the tree" are said to it, where
// its final message and its error are read, and who its comments carry.
// What does not differ is tested once per provider (tests/workflows.test.mjs):
// the agent's step is time-boxed, read-only where the pass reads, holds no
// token that writes, and a script (never the agent) posts and pushes.
// tests/agents.test.mjs holds these adapters to the shipped workflows.

/** The passes an agent runs, by their .keel/keel.json key. */
export const AGENT_PASSES = Object.freeze(['crossReview', 'climb', 'tend']);
/** A pass that names no agent runs this one, as it did before phase 45. */
export const DEFAULT_AGENT = 'claude';
/** Who posts a cross-review's findings since phase 45: the workflow's own step, with the job's token, for every provider. */
export const FINDINGS_POSTER = 'github-actions[bot]';

/**
 * The git dir Codex commits to on a climb or a tend pass (keel phase 47):
 * its workspace-write sandbox keeps .git read-only by name, so the agent job
 * gives it a clone at this path inside the workspace, and keel's step after
 * it takes only the objects and the one ref (never this dir's config or
 * hooks, which the agent could write).
 */
export const AGENT_GIT_DIR = '.keel/agent-git';

/**
 * The git options that point a command run in `cwd` at the agent's git dir:
 * [] unless env.KEEL_AGENT_GIT names a relative path inside `cwd` that holds a
 * git dir (a HEAD). Relative only, so a worktree (whose own .git file points
 * home) never resolves it, and a gate's child git never sees it in GIT_DIR.
 */
export function agentGitArgs(cwd, env = process.env) {
  const d = env?.KEEL_AGENT_GIT;
  if (typeof d !== 'string' || !d || isAbsolute(d) || d.split(/[\\/]/).includes('..')) return [];
  const dir = resolve(cwd, d);
  return existsSync(join(dir, 'HEAD')) ? [`--git-dir=${dir}`, `--work-tree=${resolve(cwd)}`] : [];
}

/**
 * The providers. `readOnly` and `editTree` are the inputs the agent step
 * gives the action for a pass that only reads (cross-review) and for one that
 * edits the checkout (climb, tend's agent job); null where the provider cannot
 * hold that pass's rules, with `refused` saying why per pass.
 */
export const AGENTS = Object.freeze({
  claude: Object.freeze({
    name: 'Claude',
    // The head-branch prefix of the PRs it writes: claude-code-action's branch_prefix default.
    branch: 'claude/',
    action: 'anthropics/claude-code-action', major: 'v1',
    // Either one: a subscription's token or an API key.
    secrets: Object.freeze(['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY']),
    readOnly: Object.freeze({ allowedTools: Object.freeze(['Read', 'Grep', 'Glob', 'Bash(gh pr diff:*)', 'Bash(gh pr view:*)']) }),
    editTree: Object.freeze({ github_token: '${{ github.token }}' }),
    final: 'the execution file (the step\'s execution_file output): its last "result" message\'s text',
    error: 'that result message: is_error, its turns and its result text',
    login: 'claude[bot]',
    // Phase 60: a commit is Claude's when its author's or a Co-authored-by trailer's email is one of these
    // (claude-code-action's commits; Claude Code's "Co-Authored-By: Claude … <noreply@anthropic.com>").
    // An email, never a name: a person may be named Claude (keel#65).
    commits: Object.freeze({ emails: /^(?:noreply@anthropic\.com|(?:\d+\+)?claude\[bot\]@users\.noreply\.github\.com)$/i }),
    passes: Object.freeze(['crossReview', 'climb', 'tend']),
    refused: Object.freeze({}),
  }),
  codex: Object.freeze({
    name: 'Codex',
    // Codex's cloud names every PR branch codex/<slug>; it is not configurable.
    branch: 'codex/',
    action: 'openai/codex-action', major: 'v1',
    secrets: Object.freeze(['OPENAI_API_KEY']),
    // drop-sudo keeps the key out of the agent's reach; read-only: no write, no network.
    readOnly: Object.freeze({ sandbox: 'read-only', 'safety-strategy': 'drop-sudo' }),
    // Phase 47: it may write the workspace (never danger-full-access, never unsafe), and commits to AGENT_GIT_DIR.
    editTree: Object.freeze({ sandbox: 'workspace-write', 'safety-strategy': 'drop-sudo' }),
    final: 'the action\'s output-file ($RUNNER_TEMP/codex-final-message.md), its final message',
    error: 'none is written: the step\'s outcome, and an empty or missing final message',
    // codex-action posts nothing; keel's step posts what it says.
    login: null,
    // Phase 60: a commit is Codex's when its author or a Co-authored-by trailer is one of these (Codex cloud's connector, the Codex CLI).
    commits: Object.freeze({ emails: /^(?:noreply@openai\.com|codex@openai\.com|(?:\d+\+)?(?:chatgpt-codex-connector|codex)\[bot\]@users\.noreply\.github\.com)$/i }),
    passes: Object.freeze(['crossReview', 'climb', 'tend']),
    refused: Object.freeze({}),
  }),
});

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** What is wrong with .keel/keel.json "agents": [string]. Absent is fine: claude alone. */
export function agentsProblems(config) {
  const a = config?.agents;
  if (a === undefined) return [];
  if (!isObject(a) || !Object.keys(a).length) return [`"agents" must name the providers this project uses: { ${Object.keys(AGENTS).map(n => `"${n}": {}`).join(', ')} }`];
  const out = [];
  for (const [name, v] of Object.entries(a)) {
    if (!Object.hasOwn(AGENTS, name)) out.push(`"agents" names an unknown provider ${JSON.stringify(name)} (known: ${Object.keys(AGENTS).join(', ')})`);
    else if (!isObject(v) || Object.keys(v).length) out.push(`"agents".${name} must be {} (a provider takes no settings yet)`);
  }
  return out;
}

/** The providers a project lists, in its order: "agents"' keys, or claude alone with no "agents". */
export const listedAgents = config => (isObject(config?.agents) ? Object.keys(config.agents) : [DEFAULT_AGENT]);

/** Who wrote a PR: the provider whose `branch` its head ref starts with, else null. */
export const authorOf = (head, agents = AGENTS) => Object.keys(agents).find(n => agents[n].branch && String(head ?? '').startsWith(agents[n].branch)) ?? null;

/**
 * Every provider a "for" prefix's PRs can be written by: a prefix that
 * starts with a provider's branch ("claude/x-"), or that a branch starts
 * with ("claude", "c": it matches claude/ heads, and codex/ too). `unknown`:
 * it can also match a head no provider's branch names. Pure.
 */
export function prefixAuthors(prefix, agents = AGENTS) {
  const p = String(prefix ?? '');
  const authors = Object.keys(agents).filter(n => agents[n].branch && (p.startsWith(agents[n].branch) || agents[n].branch.startsWith(p)));
  return { authors, unknown: !Object.keys(agents).some(n => agents[n].branch && p.startsWith(agents[n].branch)) };
}

/**
 * Who reviews a PR (the owner's rule, phase 45): another provider than the
 * one that wrote it, whenever one is available. The author is the provider
 * whose branch its head starts with; the reviewer is the first provider
 * "agents" lists (in order) that is not the author, can review, and has its
 * secret (`has`: { claude: true, codex: false }; not given, every listed
 * one counts as having it). Only when none is available does the author
 * review its own PR (`self`: true), and only when it is listed and has its
 * secret. With nobody available, the first other listed (or the author)
 * is named, and the caller says its secret is missing. A PR no provider's
 * branch names is reviewed by "crossReview".agent, default claude.
 * { author, reviewer, self, why }: reviewer null when none can. Pure.
 */
export function reviewerOf({ config, head, has, agents = AGENTS }) {
  const author = authorOf(head, agents);
  const listed = listedAgents(config).filter(n => agents[n]?.passes.includes('crossReview'));
  const available = n => !has || has[n] !== false;
  if (!author) {
    const reviewer = agentOf(config, 'crossReview');
    return { author, reviewer, self: false, why: `no provider's branch names ${head}: reviewed by ${reviewer} (${config?.crossReview?.agent !== undefined ? '"crossReview".agent' : 'the default'})` };
  }
  const others = listed.filter(n => n !== author);
  const other = others.find(available);
  const wrote = `written by ${author} (${agents[author].branch})`;
  if (other) return { author, reviewer: other, self: false, why: `${wrote}: reviewed by ${other}, the first other provider "agents" lists${others[0] !== other ? ` with its secret set (${others.slice(0, others.indexOf(other)).join(', ')} has none)` : ''}` };
  if (listed.includes(author) && available(author)) {
    const reason = selfReason({ author, listed, has, agents });
    return { author, reviewer: author, self: true, reason, why: `${wrote}: reviewed by ${author}, its own provider: ${reason}` };
  }
  const reviewer = others[0] ?? (listed.includes(author) ? author : null);
  return { author, reviewer, self: reviewer === author, why: reviewer ? `${wrote}: reviewed by ${reviewer}, but no provider listed has its secret set` : `${wrote}, and "agents" lists no provider to review it` };
}

// ---- who wrote a push (phase 60) -------------------------------------------------
//
// A project that ships to main opens no PR, so no branch says who wrote the
// code. Its commits do: each one's author, and its Co-authored-by trailers.

/** The Co-authored-by trailers of a commit message: [{ name, email }]. Pure. */
export function coAuthorsOf(message) {
  return trailerValues(trailerBlock(message), 'co-authored-by').map(personOf).filter(Boolean);
}

/**
 * A commit message's trailer block, as git reads one (git interpret-trailers):
 * its last paragraph, when every line of it is a `Key: value` trailer or a
 * continuation of one. A `Co-authored-by:` line quoted in the body is not a
 * trailer (keel#65). Pure.
 */
export function trailerBlock(message) {
  const paras = String(message ?? '').replace(/\r\n/g, '\n').trim().split(/\n[ \t]*\n/);
  if (paras.length < 2) return [];
  const lines = paras.at(-1).split('\n');
  return lines.every((l, i) => /^[A-Za-z0-9-]+:[ \t]*\S/.test(l) || (i > 0 && /^[ \t]+\S/.test(l))) ? lines : [];
}
/** The values of one trailer key (any case) in a trailer block. */
const trailerValues = (lines, key) => lines.filter(l => l.toLowerCase().startsWith(`${key}:`)).map(l => l.slice(key.length + 1).trim());
/** `Name <email>` → { name, email }, or null. */
const personOf = v => { const m = /^(.*?)[ \t]*<([^>\n]*)>$/.exec(String(v ?? '').trim()); return m ? { name: m[1].trim(), email: m[2].trim() } : null; };

/**
 * Who wrote a commit: the providers whose identity its author's email, or a
 * Co-authored-by trailer's, is (an adapter's `commits.emails`; a name alone
 * is never evidence: a person may be named Claude), in the adapters' order;
 * [] for a person's. `commit`: { name, email, coAuthors?, message }:
 * `coAuthors` is git's own parse of the trailers (`%(trailers:key=Co-authored-by)`,
 * gitOf's), else the message's trailer block is read here. Pure.
 */
export function commitAuthorOf(commit, agents = AGENTS) {
  const trailers = Array.isArray(commit?.coAuthors) ? commit.coAuthors.map(personOf).filter(Boolean) : coAuthorsOf(commit?.message);
  const emails = [commit?.email ?? '', ...trailers.map(p => p.email)];
  return Object.keys(agents).filter(n => agents[n].commits && emails.some(e => agents[n].commits.emails.test(e)));
}

/** Every provider that wrote one of a push's commits, in the adapters' order; [] when people wrote them all. Pure. */
export function pushAuthorsOf(commits, agents = AGENTS) {
  const wrote = new Set((commits ?? []).flatMap(c => commitAuthorOf(c, agents)));
  return Object.keys(agents).filter(n => wrote.has(n));
}

/**
 * Who reviews a push to main (phase 60), by the owner's rule for a PR: a
 * provider other than the ones that wrote its commits, whenever one is
 * available. The reviewer is the first provider "agents" lists that wrote
 * none of them, can review, and has its secret (`has`, as for reviewerOf).
 * A person's push (no provider in its authors or trailers) is reviewed by
 * the first listed. Only when no provider that wrote none of it is
 * available does one review its own (`self`, with the reason). { authors,
 * author, reviewer, self, reason?, why }: `author` is the one provider that
 * wrote it (the reviewer itself when it reviews its own), else null. Pure.
 */
export function pushReviewerOf({ config, commits, has, agents = AGENTS }) {
  const authors = pushAuthorsOf(commits, agents);
  const listed = listedAgents(config).filter(n => agents[n]?.passes.includes('crossReview'));
  const available = n => !has || has[n] !== false;
  const author = authors.length === 1 ? authors[0] : null;
  const wrote = authors.length ? `written by ${authors.join(' and ')} (its commits' authors and trailers)` : 'written by a person (no provider in its commits\' authors or trailers)';
  const others = listed.filter(n => !authors.includes(n));
  const other = others.find(available);
  if (other) {
    const skipped = others.slice(0, others.indexOf(other));
    return { authors, author, reviewer: other, self: false, why: `${wrote}: reviewed by ${other}, the first ${authors.length ? 'other ' : ''}provider "agents" lists${skipped.length ? ` with its secret set (${skipped.join(', ')} has none)` : ''}` };
  }
  const own = listed.find(n => authors.includes(n) && available(n));
  if (own) {
    const alsoWrote = listed.filter(n => n !== own && authors.includes(n));
    const reason = alsoWrote.length ? `every other provider listed wrote some of it too (${alsoWrote.join(', ')})` : selfReason({ author: own, listed, has, agents });
    return { authors, author: own, reviewer: own, self: true, reason, why: `${wrote}: reviewed by ${own}, its own provider: ${reason}` };
  }
  const reviewer = others[0] ?? listed.find(n => authors.includes(n)) ?? null;
  return { authors, author, reviewer, self: reviewer !== null && authors.includes(reviewer), why: reviewer ? `${wrote}: reviewed by ${reviewer}, but no provider listed has its secret set` : `${wrote}, and "agents" lists no provider to review it` };
}

/** The label on every push's tracking issue (cross-review.mjs opens them; keel review reads them). */
export const PUSH_LABEL = 'keel:review-after';
/** A push's tracking issue's title. */
export const pushTitle = sha => `keel review after ${String(sha ?? '').slice(0, 7)}`;
/**
 * The record a push review leaves as its tracking issue's first line, a
 * hidden comment: { from, to, alone, agent, findings: [{ id, severity, path,
 * line, text, url? }] }. `<` and `>` are escaped, so nothing in it ends the
 * comment. recordOf reads it back (null when absent or not a record). Pure.
 */
export const recordText = record => `<!-- ${PUSH_LABEL} ${JSON.stringify(record).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')} -->`;
export function recordOf(body) {
  // The body's first line alone (keel#65): the rest holds the agent's summary and findings, which could
  // spell a marker of their own; a pending issue starts with its own marker, so it is never a record.
  const m = new RegExp(`^<!-- ${PUSH_LABEL} (\\{[^\\n]*\\}) -->(?:\\r?\\n|$)`).exec(String(body ?? ''));
  if (!m) return null;
  try { const r = JSON.parse(m[1]); return r && typeof r === 'object' && /^[0-9a-f]{40}$/.test(r.to ?? '') ? r : null; } catch { return null; }
}
/** An issue the cross-review workflow opened (its token's bot), never a person's: only those are the record. */
export const byWorkflow = issue => /^(?:app\/)?github-actions(?:\[bot\])?$/.test(String(issue?.author?.login ?? ''));

/** A provider's secret, as a person sets it: CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY). */
export const secretText = (name, agents = AGENTS) => {
  const [first, ...rest] = agents[name]?.secrets ?? [];
  return first ? `${first}${rest.length ? ` (or ${rest.join(', ')})` : ''}` : '(no secret)';
};

/**
 * Why a PR's own provider reviews it, said exactly: no other provider is
 * listed, or each other listed one is named with the secret it lacks
 * ("codex is listed but its secret OPENAI_API_KEY is not set"). Pure.
 */
export function selfReason({ author, listed, has, agents = AGENTS }) {
  const others = listed.filter(n => n !== author && agents[n]?.passes.includes('crossReview'));
  if (!others.length) return 'no other provider is listed';
  const missing = others.filter(n => has && has[n] === false);
  return missing.map(n => `${n} is listed but its secret ${secretText(n, agents)} is not set`).join('; ') || 'no other is available';
}

/** The agent a pass names, or the default. Unvalidated: passAgentProblems says what is wrong with it. */
export const agentOf = (config, key) => (isObject(config?.[key]) && config[key].agent !== undefined ? config[key].agent : DEFAULT_AGENT);

/**
 * What is wrong with the agent pass `key` runs, "agents" included: [string].
 * A pass that is off (no key) has none. The agent must be a known provider,
 * listed in "agents" (with no "agents", claude alone is listed), and able to
 * hold the pass's rules.
 */
export function passAgentProblems(config, key) {
  if (!AGENT_PASSES.includes(key)) throw new Error(`passAgentProblems: ${key} is not a pass an agent runs`);
  const out = agentsProblems(config);
  const c = config?.[key];
  if (!isObject(c)) return out;
  const named = c.agent !== undefined;
  const agent = agentOf(config, key);
  if (typeof agent !== 'string' || !Object.hasOwn(AGENTS, agent)) return [...out, `"${key}".agent must be one of ${Object.keys(AGENTS).join(', ')} (got ${JSON.stringify(agent)})`];
  const listed = listedAgents(config);
  if (key === 'crossReview') return [...out, ...crossReviewerProblems(config, { agents: AGENTS })];
  if (!listed.includes(agent)) out.push(named ? `"${key}".agent is ${agent}, which "agents" does not list (${listed.join(', ')})` : `"${key}" runs ${agent} (no "agent" names another), which "agents" does not list (${listed.join(', ')}); list it, or name the pass's agent`);
  if (!AGENTS[agent].passes.includes(key)) out.push(`"${key}".agent is ${agent}: ${AGENTS[agent].refused[key] ?? `${agent} does not run ${key}`}`);
  return out;
}

/**
 * What is wrong with who reviews cross-review's PRs: [string]. A prefix
 * that matches a provider's branches and branches no provider names
 * ("claude", "c": prefixAuthors) is refused, since it cannot say who wrote
 * a PR. A prefix whose author has no other provider listed is not wrong: its
 * author reviews it (the fallback). "agent" (for PRs no provider's branch
 * names) is listed and can review, and is never
 * the author of a prefix in "for" while another provider is listed to
 * review it. `agent` known is checked by the caller. Pure; `agents` is the
 * adapter list (a test passes its own).
 */
export function crossReviewerProblems(config, { agents = AGENTS } = {}) {
  const c = config?.crossReview;
  if (!isObject(c)) return [];
  const out = [];
  const listed = listedAgents(config);
  const reviewers = listed.filter(n => agents[n]?.passes.includes('crossReview'));
  const prefixes = Array.isArray(c.for) ? c.for.filter(p => typeof p === 'string') : [];
  const of = new Map(prefixes.map(p => [p, prefixAuthors(p, agents)]));
  // A prefix that matches a provider's branches and branches no provider names ("claude", "c") cannot say who wrote a PR: refused.
  for (const [p, { authors, unknown }] of of) if (authors.length && unknown) {
    out.push(`"crossReview".for has ${p}: ${p} matches ${authors.map(n => `${n}'s branches`).join(' and ')} and others (e.g. ${p}-fix); name the provider's branch exactly (${authors.map(n => agents[n].branch).join(', ')}) or a prefix no provider's branch shares`);
  }
  const agent = agentOf(config, 'crossReview');
  const named = c.agent !== undefined;
  // "agent" reviews only PRs no provider's branch names; naming a prefix's author is self-review by choice,
  // wrong when another provider is listed to review them (alone, the author is the fallback anyway).
  for (const [p, { authors, unknown }] of of) if (named && !unknown && authors.includes(agent) && reviewers.some(n => n !== agent)) out.push(`"crossReview".agent is ${agent}, who writes the ${p} PRs "for" names, and another provider is listed to review them: a PR is reviewed by its own provider only when no other is available ("agent" is only for PRs no provider's branch names)`);
  const unknown = [...of].filter(([, a]) => a.unknown && !a.authors.length).map(([p]) => p);
  if (named || unknown.length) {
    const why = unknown.length ? ` (it reviews ${unknown.join(', ')}, which no provider's branch names)` : '';
    if (!listed.includes(agent)) out.push(named ? `"crossReview".agent is ${agent}, which "agents" does not list (${listed.join(', ')})${why}` : `"crossReview" reviews ${unknown.join(', ')} with ${agent} (the default: no provider's branch names them), which "agents" does not list (${listed.join(', ')}); list it, or name "crossReview".agent`);
    else if (!agents[agent]?.passes.includes('crossReview')) out.push(`"crossReview".agent is ${agent}, which does not review`);
  }
  return out;
}

/**
 * Whether a Codex agent step did its work, pure: { ok, line }. codex-action
 * writes no execution log keel can read, so its outcome and its final message
 * (the output-file) are the evidence: a step that failed, or ended with no
 * final message, before its budget ran out never ran (red, one line: lesson
 * 29); running out the budget is not red (past the larger of the budget
 * less a minute and nine tenths of it: agentVerdict's rule, duo#83). The final message is never
 * printed: keel's logs are public.
 */
export function codexVerdict({ outcome, message, elapsedSec, minutes }) {
  const budget = minutes * 60;
  const said = typeof message === 'string' ? message.trim() : '';
  const took = Number.isFinite(elapsedSec) ? `${Math.round(elapsedSec)} s` : 'an unknown time';
  if (outcome !== 'success' && Number.isFinite(elapsedSec) && Number.isFinite(budget) && elapsedSec > 0 && elapsedSec >= Math.max(budget - 60, budget * 0.9)) return { ok: true, timedOut: true, line: `the agent ran out its budget (${minutes} min, ${Math.round(elapsedSec)} s elapsed): what it kept is judged` };
  if (outcome === 'success' && said) return { ok: true, line: `the agent ran: Codex wrote its final message (${said.length} chars) in ${took}` };
  const check = 'check OPENAI_API_KEY, the model, and that the run\'s actor has write access (codex-action refuses anyone else)';
  if (outcome === 'success') return { ok: false, line: `Codex did not start: the agent step succeeded after ${took} with no final message, before its ${minutes}-minute budget; ${check}. Nothing is judged or posted.` };
  return { ok: false, line: `Codex ${said ? 'stopped with an error' : 'did not start'}: the agent step ended ${outcome || 'without an outcome'} after ${took}, before its ${minutes}-minute budget, ${said ? 'with a final message' : 'with no final message'}; ${check}. Nothing is judged or posted.` };
}
