// A health proposal in plain words (phase 153). The night's report writer and
// the workspace decision page share this, so a new report and an older one read
// the same way: what is wrong, what is being decided, what each answer does,
// whether it is still true, and what is recommended.
//
// The plain block never carries a measure id, a file path or raw error text;
// the technical first line and the measures table keep those. It is generated
// from the measure's own description, state, value and bound, never by a model:
// a vague description gives a vague sentence.
//
// Accept, Decline and doing nothing say what the code does: a decision is a
// record line on the report (plates walk decide, or the workspace), nothing
// starts by itself, and the night proposes from fresh measures every night, so
// a declined problem that is still there can come back. The newest report's
// proposal is the one listed as waiting.
//
// Zero dependencies; pure functions.

export const PLAIN_LABELS = Object.freeze({
  wrong: 'In plain words', deciding: 'You\'re deciding', accept: 'If you accept', decline: 'If you decline', nothing: 'If you do nothing', recommend: 'Recommended',
});
const KEYS = Object.keys(PLAIN_LABELS);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 2026-10-30 → "30 October 2026"; anything else unchanged. */
export function plainDay(date) {
  if (!DAY.test(date ?? '')) return String(date ?? '');
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** What kind of failure stopped a measure, without its command or message. */
export function failureClass(detail) {
  const s = String(detail ?? '');
  if (/\bgh\b|github|graphql|api\.github/i.test(s)) return 'a GitHub read failed';
  if (/timed? ?out|timeout|ETIMEDOUT/i.test(s)) return 'it ran out of time';
  if (/permission|denied|EACCES|EPERM|\b40[13]\b/i.test(s)) return 'it was not allowed to read something it needs';
  if (/command failed|\bexit(?:s|ed)?\b|spawn|ENOENT|not found/i.test(s)) return 'a command it runs failed';
  if (/JSON|parse|malformed|invalid|unreadable|not an? /i.test(s)) return 'a file it reads could not be understood';
  return 'it stopped with an error';
}

/** A measure's description without ids, paths, code or asides. */
export function plainWhat(what) {
  let s = String(what ?? '');
  for (let previous = ''; previous !== s;) { previous = s; s = s.replace(/\([^()]*\)/g, ''); }
  s = s.split(/;|:\s/)[0]
    .replace(/`[^`]*`/g, '').replace(/[`*_]{2,}|`/g, '')
    .replace(/(^|\s)[^\s,;]*[\/\\][^\s,;]*/g, '$1project files')
    .replace(/(^|\s)\.[^\s]+/g, '$1project settings')
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/gi, '')
    .replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.]+$/, '');
  return s || 'this measure';
}

const quoted = what => `“${plainWhat(what)}”`;
const limit = (m, bound) => m.better === 'higher' ? `it needs at least ${bound}` : `it allows at most ${bound}`;
const finite = v => typeof v === 'number' && Number.isFinite(v);

/** The recommendation for a proposal whose measure is back within its bound. */
export const fixedRecommendation = date => ({ choice: 'decline', reason: `This fixed itself on ${plainDay(date)}: a newer night report shows the check back within its limit, so there is nothing left to build.` });

/**
 * The plain block for one measure, as an object of sentences. `m` is a measure
 * result or a parsed table row: { what, state, value, bound, better, detail }.
 * `date` is the report's date; `fixedOn` the date a newer report showed it
 * within its bound (then Decline is recommended).
 */
export function plainProposal(m, { date = null, fixedOn = null } = {}) {
  const on = date ? ` on ${plainDay(date)}` : '';
  const broken = m.state === 'broken', outside = m.state === 'outside';
  const wrong = broken
    ? `The nightly check for ${quoted(m.what)} could not run${on}: ${failureClass(m.detail)}. A check that cannot run is not a pass, so nobody knows whether this is fine until it runs again.`
    : outside
      ? `The nightly check for ${quoted(m.what)} found ${finite(m.value) ? m.value : 'a value'}${on}, and ${finite(m.bound) ? limit(m, m.bound) : 'that is outside its limit'}.`
      : `The nightly check for ${quoted(m.what)} was within its limit${on}.`;
  const deciding = broken
    ? 'Whether to plan work (a phase) to get this check running again, or to set it aside.'
    : 'Whether to plan work (a phase) to bring this back within its limit, or to set it aside.';
  const recommend = fixedOn ? fixedRecommendation(fixedOn)
    : broken ? { choice: 'accept', reason: 'Until this check runs again, nobody can tell whether anything here is wrong.' }
    : outside ? { choice: 'accept', reason: `It is outside its limit${finite(m.value) && finite(m.bound) ? ` (${m.value} against ${m.bound})` : ''}, and planned work is how it gets fixed.` }
    : { choice: 'decline', reason: 'The check is within its limit, so there is nothing to build.' };
  return {
    wrong, deciding,
    accept: '“Accepted” and your reason are written on this report. Nothing starts by itself: someone then opens a phase for the work.',
    decline: '“Declined” and your reason (required) are written on this report, and it stops being listed as waiting for you. If the problem is still there, a later night can propose it again.',
    nothing: 'Nothing changes and nothing is fixed. It stays undecided; once a newer night report exists, that report’s proposal is the one listed as waiting for you.',
    recommend,
  };
}

const choiceWord = c => c === 'decline' ? 'Decline' : 'Accept';
/** The plain block as report markdown: one list item per label. */
export function formatPlain(plain) {
  return KEYS.map(k => `- **${PLAIN_LABELS[k]}:** ${k === 'recommend' ? `${choiceWord(plain.recommend.choice)}. ${plain.recommend.reason}` : plain[k]}`).join('\n');
}

const LINE = new RegExp(`^- \\*\\*(${Object.values(PLAIN_LABELS).map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):\\*\\* (.+)$`, 'gm');
/** The plain block in a proposal's text, or null when it has none (an older report) or an incomplete one. */
export function parsePlain(text) {
  const found = {};
  for (const [, label, value] of String(text ?? '').matchAll(LINE)) {
    const key = KEYS.find(k => PLAIN_LABELS[k] === label);
    if (found[key] === undefined) found[key] = value.trim();
  }
  if (!KEYS.every(k => found[k])) return null;
  const r = /^(Accept|Decline)\.\s+(.+)$/.exec(found.recommend);
  if (!r) return null;
  return { ...found, recommend: { choice: r[1].toLowerCase(), reason: r[2] } };
}

/** The proposal's text without its plain block (for showing the technical part on its own). */
export const withoutPlain = text => String(text ?? '').replace(LINE, '').replace(/\n{3,}/g, '\n\n').trim();

const cellsOf = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
/** One measure's row in a report's table: { id, what, value, bound, better, state, detail }, or null. */
export function measureRow(text, id) {
  const line = String(text ?? '').split('\n').find(l => l.startsWith(`| \`${id}\` — `));
  if (!line) return null;
  const c = cellsOf(line);
  if (c.length < 5) return null;
  const b = /^([≤≥])\s*(-?\d+(?:\.\d+)?)$/.exec(c[2]);
  return {
    id, what: c[0].slice(`\`${id}\` — `.length), value: /^-?\d+(?:\.\d+)?$/.test(c[1]) ? Number(c[1]) : null,
    bound: b ? Number(b[2]) : null, better: b?.[1] === '≥' ? 'higher' : 'lower', state: c[3], detail: c.slice(4).join(' | '),
  };
}

/**
 * Is the proposal still true? `newer` holds the reports after the proposal's
 * own that the caller could read, oldest first and ending at the newest
 * ({ date, text }); empty when the proposal's report is the newest.
 * { state: 'newest' | 'fixed' | 'still' | 'unchecked', date, fixedOn }: date is
 * the newest report's; fixedOn the first of the trailing run of reports where
 * the measure is ok.
 */
export function freshness(id, newer) {
  const newest = newer?.at(-1);
  if (!newest) return { state: 'newest', date: null, fixedOn: null };
  const row = measureRow(newest.text, id);
  if (!row || !['ok', 'outside', 'broken'].includes(row.state)) return { state: 'unchecked', date: newest.date, fixedOn: null };
  return row.state === 'ok' ? { state: 'fixed', date: newest.date, fixedOn: fixedSince(id, newer) } : { state: 'still', date: newest.date, fixedOn: null };
}

/**
 * The date a measure went back within its bound, from reports newer than the
 * proposal's (oldest first): the first of the trailing run of reports where it
 * is ok, or null when the newest does not show it ok.
 */
export function fixedSince(id, reports) {
  let since = null;
  for (const r of reports ?? []) since = measureRow(r.text, id)?.state === 'ok' ? since ?? r.date : null;
  return since;
}

/** freshness() as one sentence for the reader. */
export function freshnessText(f) {
  if (!f) return null;
  if (f.state === 'newest') return 'This is the newest night report, so this is how things stood at its last run.';
  if (f.state === 'fixed') return `This fixed itself on ${plainDay(f.fixedOn ?? f.date)}: the newest night report (${plainDay(f.date)}) shows the check back within its limit.`;
  if (f.state === 'still') return `Still true: the newest night report (${plainDay(f.date)}) still shows this problem.`;
  return `Couldn’t check whether this is still true: the newest night report (${plainDay(f.date)}) ${f.reason === 'too_large' ? 'is too large to open here (over 256 KiB)' : 'could not be read, or does not show this check'}.`;
}
