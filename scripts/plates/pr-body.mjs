import { writeName } from './names.mjs';
// The body of every pull request plates opens (plates practice `night`; managed:
// plates render rewrites it). A PR asks a person for a minute; the body is
// built so that minute is enough (plates phase 39; docs/research/
// 2026-10-06-pr-and-retro.md, "The PR a person reads"). Three sections, in
// this order, from structured input, deterministically, with no model:
//
//   ## Summary       a picture, never prose: a file tree of the changed paths,
//                    or the caller's table. A one-line `lead` may precede it.
//   ## Evidence      what was measured: the gate's line, rows of before and
//                    after. None is written as "Evidence: none recorded.";
//                    the section is never dropped.
//   ## Merge danger  the door, derived from the change's door class (phase
//                    145): reversible or windowed (undoable for a stated
//                    window) is a two-way door, irreversible a one-way door
//                    (something leaves the repo), and the line names the
//                    class; then the blast radius in Real surfaces terms
//                    (phase 32), and any changed output with why it is
//                    harmless (phase 36).
//
// then the caller's notes, then the keel-impact block (phase 26) last.
//
//   node scripts/plates/pr-body.mjs --input <json> [--files <list>] [--json]
//
// --input is prBody's argument as JSON; --files is a file of paths, one per
// line, that becomes summary.files (the paths a commit actually carries).
// The body goes to stdout. Bad input is exit 2, naming what is wrong.
//
// The idea is Matt Pocock's /pr (skills v1.3, aihero.dev), in plates's terms;
// no text is copied.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMain, main } from './lib.mjs';

/** Real surfaces (phase 32): the same terms as the phases practice's scripts/roadmap.mjs SURFACES. */
export const SURFACES = Object.freeze(['published package', 'workflow shell', 'adopted project', "owner's machine", 'GitHub API', 'fleet over time']);
export const DOORS = Object.freeze({ 'two-way': 'Two-way door', 'one-way': 'One-way door' });
/** Door classes (phase 145) and the door each makes: the same words as plates's lib/doors.mjs; a test holds them equal. */
export const DOOR_CLASSES = Object.freeze({ reversible: 'two-way', windowed: 'two-way', irreversible: 'one-way' });
export const NO_EVIDENCE = 'Evidence: none recorded.';

export class PrBodyError extends Error {
  constructor(message) { super(message); this.exitCode = 2; }
}
const fail = message => { throw new PrBodyError(`pr-body: ${message}`); };
const text = (v, where) => (typeof v === 'string' && v.trim() ? v.trim() : fail(`${where} must be non-empty text`));
const cell = v => (v === undefined || v === null || v === '' ? '—' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));
const table = (head, rows) => [`| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)];

/**
 * The changed paths as a tree, grouped by top directory: directories first,
 * a directory with one directory inside it shown as one node (`.github/workflows/`).
 * files: [path | { path, note }].
 */
export function fileTree(files) {
  const root = new Map();
  for (const f of files) {
    const path = typeof f === 'string' ? f : f?.path;
    const parts = text(path, 'summary.files[]').replace(/^\.\//, '').split('/').filter(Boolean);
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.has(`${dir}/`)) node.set(`${dir}/`, new Map());
      node = node.get(`${dir}/`);
    }
    node.set(parts.at(-1), typeof f === 'object' && f.note ? String(f.note) : '');
  }
  const out = [];
  const walk = (node, prefix) => {
    const keys = [...node.keys()].sort((a, b) => (b.endsWith('/') - a.endsWith('/')) || a.localeCompare(b));
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      let name = k, child = node.get(k);
      while (child instanceof Map && child.size === 1 && [...child.keys()][0].endsWith('/')) {
        const [only] = child.keys();
        name += only; child = child.get(only);
      }
      const label = child instanceof Map ? name : `${name}${child ? `  (${child})` : ''}`;
      out.push(`${prefix}${last ? '└── ' : '├── '}${label}`);
      if (child instanceof Map) walk(child, `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  walk(root, '');
  return out.join('\n');
}

function summary(s) {
  if (!s || typeof s !== 'object') fail('summary is required: { files } or { table }');
  const lead = s.lead === undefined ? [] : [text(s.lead, 'summary.lead'), ''];
  if (s.lead !== undefined && s.lead.trim().includes('\n')) fail('summary.lead is one line; the picture says the rest');
  if (Array.isArray(s.files)) {
    return [...lead, ...(s.files.length ? ['```text', fileTree(s.files), '```'] : ['No files changed.'])];
  }
  if (s.table && typeof s.table === 'object') {
    const { head, rows } = s.table;
    if (!Array.isArray(head) || !head.length || !Array.isArray(rows) || rows.some(r => !Array.isArray(r) || r.length !== head.length)) fail('summary.table is { head: [..], rows: [[..]] }, every row as wide as head');
    return [...lead, ...table(head, rows)];
  }
  return fail('summary is { files } or { table }, never prose');
}

function evidence(e = {}) {
  const ev = Array.isArray(e) ? { rows: e } : (e ?? {});
  const rows = ev.rows ?? [];
  if (!Array.isArray(rows)) fail('evidence.rows must be a list');
  rows.forEach((r, i) => text(r?.what, `evidence.rows[${i}].what`));
  const gate = ev.gate === undefined ? null : text(ev.gate, 'evidence.gate');
  if (!gate && !rows.length) return [NO_EVIDENCE];
  const [before, after] = ev.columns ?? ['Before', 'After'];
  return [
    ...(gate ? [`Gate: ${gate}`] : []),
    ...(gate && rows.length ? [''] : []),
    ...(rows.length ? table(['What', before, after], rows.map(r => [r.what, r.before, r.after])) : []),
  ];
}

/**
 * The change's door class: danger.class (reversible, windowed with its window,
 * irreversible). An older caller's danger.door alone reads as its class
 * (two-way reversible, one-way irreversible); both given must agree.
 */
function doorClass(d) {
  const classes = Object.keys(DOOR_CLASSES).join(', ');
  if (d.door !== undefined && !Object.hasOwn(DOORS, d.door)) fail(`danger.door is "${d.door}"; use two-way or one-way`);
  if (d.class === undefined) {
    if (d.door === undefined) fail(`danger.class is required: ${classes}`);
    return { cls: d.door === 'one-way' ? 'irreversible' : 'reversible', door: d.door };
  }
  if (!Object.hasOwn(DOOR_CLASSES, d.class)) fail(`danger.class is "${d.class}"; use ${classes}`);
  const door = DOOR_CLASSES[d.class];
  if (d.door !== undefined && d.door !== door) fail(`danger.door ${d.door} contradicts danger.class ${d.class} (a ${door} door)`);
  if (d.class === 'windowed') return { cls: d.class, door, window: text(d.window, 'danger.window (a windowed door states its window)') };
  if (d.window !== undefined) fail(`danger.window is only for a windowed door, not ${d.class}`);
  return { cls: d.class, door };
}

function danger(d) {
  if (!d || typeof d !== 'object') fail('danger is required: { class, why, surfaces }');
  const { cls, door: kind, window } = doorClass(d);
  const why = text(d.why, 'danger.why');
  const surfaces = d.surfaces ?? [];
  if (!Array.isArray(surfaces)) fail('danger.surfaces must be a list of Real surfaces terms');
  const named = surfaces.map(s => SURFACES.find(k => k.toLowerCase() === String(s).trim().toLowerCase()) ?? fail(`"${s}" is not a surface; use one of ${SURFACES.join(', ')}, or none`));
  const radius = named.length ? [...new Set(named)].join(', ') : `this repo's ${d.within ? text(d.within, 'danger.within') : 'files'} only`;
  // A changed output the person must judge (a climb build-time night's build output): each path with why it is harmless.
  const changed = d.changed ?? [];
  if (!Array.isArray(changed)) fail('danger.changed must be a list of { path, why }');
  const listed = changed.map((c, i) => `- \`${text(c?.path, `danger.changed[${i}].path`)}\`: ${text(c?.why, `danger.changed[${i}].why`)}`);
  const lead = d.changedLead ? text(d.changedLead, 'danger.changedLead') : 'Changed, and why it is harmless (the person decides):';
  const door = [`${DOORS[kind]} (${cls}${window ? `, ${window}` : ''}): ${why}`, '', `Blast radius: ${radius}.`];
  return listed.length ? [...door, '', lead, '', ...listed] : door;
}

function notes(n) {
  if (n === undefined || n === null) return [];
  const list = (Array.isArray(n) ? n : [n]).map((x, i) => text(x, `notes[${i}]`));
  return list.length ? ['', '## Notes', '', list.join('\n\n')] : [];
}

function impact(i) {
  if (i === undefined || i === null) return [];
  if (!i.declaration || typeof i.declaration !== 'object') fail('impact is { note?, declaration }');
  return ['', '## Record impact', '', ...(i.note ? [text(i.note, 'impact.note'), ''] : []), '```' + writeName('fence:keel-impact'), JSON.stringify(i.declaration), '```'];
}

/** The body: Summary, Evidence, Merge danger, then notes, then the keel-impact block. Throws PrBodyError on bad input. */
export function prBody({ summary: s, evidence: e, danger: d, notes: n, impact: i } = {}) {
  return [
    '## Summary', '', ...summary(s), '',
    '## Evidence', '', ...evidence(e), '',
    '## Merge danger', '', ...danger(d),
    ...notes(n),
    ...impact(i),
    '',
  ].join('\n');
}

export function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const flag = { '--input': 'input', '--files': 'files' }[args[i]];
    if (!flag || args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new PrBodyError(`pr-body: unexpected ${args[i]}; usage: node scripts/plates/pr-body.mjs --input <json> [--files <list>] [--json]`);
    out[flag] = resolve(args[++i]);
  }
  if (!out.input) throw new PrBodyError('pr-body: --input <json> is required');
  return out;
}

if (isMain(import.meta)) {
  await main(async args => {
    const opts = parseArgs(args);
    let input;
    try { input = JSON.parse(await readFile(opts.input, 'utf8')); } catch (e) { throw new PrBodyError(`pr-body: ${opts.input}: ${e.message}`); }
    if (opts.files) input.summary = { ...input.summary, files: (await readFile(opts.files, 'utf8')).split('\n').map(l => l.trim()).filter(Boolean) };
    const body = prBody(input);
    return { data: { body }, text: body.trimEnd() };
  });
}
