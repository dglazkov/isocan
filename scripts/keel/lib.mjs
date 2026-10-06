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
//   healthLints(root, config)  a bad `health` (health-config), or a health
//                            directory git ignores (health-ignored): the night
//                            writes its page and never commits it (a promise:
//                            git answers while the caller reads on)
//   readProjectRecords(root) the projects shape, read only: docs/projects/<p>/
//                            with its primary doc's status and issue, and its
//                            phases.md's sections (phaseSections); with
//                            recordsDisagree, statusUnknown, changelogGaps,
//                            issuesNamed, the record measures' rules
//   gateWorkflowOf(config)   the gate workflow a project names (gateWorkflow)
//   main(meta, fn)           run a script: --json or text, and its exit code
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, readdir, lstat, readlink } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
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
 * section ends. Each is a lessons-table-split lint naming its line. The table
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
 * phase), and a phases.md with phase headings and not one Status line (one
 * per file: its phases are invisible).
 */
export function statusUnknown(projects) {
  const out = [];
  for (const p of projects) {
    if (!p.phases?.length) continue;
    if (p.phases.every(x => x.word === null)) { out.push({ path: p.phasesPath, detail: `${p.phasesPath}: ${p.phases.length} phase${p.phases.length === 1 ? '' : 's'}, no Status line` }); continue; }
    for (const x of p.phases) if (x.word !== null && !PHASE_WORDS[x.word]) out.push({ path: `${p.phasesPath}:${x.line}`, detail: `${p.name} phase ${x.id} says ${x.word}` });
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
  const g = config?.gateWorkflow;
  if (g === undefined) return null;
  if (typeof g === 'string' && g.trim()) return { name: g.trim() };
  return { problem: '.keel/keel.json "gateWorkflow" must be a workflow\'s name, as GitHub shows it' };
}

// ---- the health pages' directory ---------------------------------------------

/** Where health pages go when .keel/keel.json names no `health`. */
export const HEALTH_DIR = 'docs/health';

/**
 * What is wrong with .keel/keel.json `health`: a directory inside the repo,
 * relative, with no `..`, `.` or empty segment, no backslash, glob or
 * whitespace (the workflow hands it to a shell), not under .git/ or
 * .github/, and not .keel itself. Absent is fine (the default). Returns a list of messages.
 */
export function healthProblems(config) {
  const h = config?.health;
  if (h === undefined) return [];
  const bad = why => [`"health" ${why} (got ${JSON.stringify(h)}); it names the directory health pages go in, relative to the repo, like "${HEALTH_DIR}"`];
  if (typeof h !== 'string' || !h) return bad('must be a non-empty string');
  if (h.startsWith('/') || /^[A-Za-z]:/.test(h)) return bad('must be relative to the repo, not absolute');
  if (/[\\*?[\]\s]/.test(h)) return bad('cannot hold a backslash, glob or whitespace');
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

/**
 * The health directory's lints, for a project with the night practice or a
 * `health` setting: health-config when `health` is not a plain directory in
 * the repo; health-ignored when git ignores a page in it (`git check-ignore`),
 * so the night writes the page and its PR never carries it (ledger, phase 33).
 * Outside a git repository there is nothing to ignore.
 */
export async function healthLints(root, config) {
  if (!(config?.practices ?? []).includes('night') && config?.health === undefined) return [];
  const problems = healthProblems(config);
  if (problems.length) return problems.map(message => ({ rule: 'health-config', path: '.keel/keel.json', message }));
  const dir = healthDirOf(config);
  const ignored = await new Promise(done => execFile('git', ['check-ignore', '-q', '--', `${dir}/x.md`], { cwd: root, encoding: 'utf8' }, e => done(!e)));
  if (!ignored) return [];
  return [{ rule: 'health-ignored', path: dir, message: `${dir} is git-ignored here, so the night writes its health page and never commits it; set "health" in .keel/keel.json to a directory that is not ignored (like ".keel/health")` }];
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
 * createdAt, from gh's closed list) were all closed unmerged: [{ job, prs }].
 * A person reading three and merging none is the verdict; reopening one, or
 * merging the next, lifts it. `prs`: [{ headRefName, number, createdAt, mergedAt }].
 */
export function climbRetiring(prs, jobs) {
  const out = [];
  for (const job of jobs) {
    const mine = prs.filter(p => typeof p?.headRefName === 'string' && p.headRefName.startsWith(`${CLIMB_PREFIX}${job}/`))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, RETIRE_AFTER);
    if (mine.length === RETIRE_AFTER && mine.every(p => !p.mergedAt)) out.push({ job, prs: mine.map(p => p.number) });
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
  const base = Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('NODE_TEST_')));
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
