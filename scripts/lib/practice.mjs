/**
 * **The practice page's checks, as pure functions.**
 *
 * `scripts/practice.mjs` gathers — files, git, GitHub, `measure.mjs` — and
 * hands the plain results here; everything that decides what counts as a leak
 * lives in this file and takes only those plain inputs, so
 * `test/practice.test.ts` can hold each check to a fixture tree without a
 * repository, a network or a clock. (`docs/projects/practice/design.md`,
 * "Where it leaks", is the list of rows; phase 0 is the page.)
 *
 * Every row is higher-is-worse unless it says `better: "higher"`, and a row
 * marked `better: "info"` is a reading, not a leak: it is printed, carries its
 * *was*, and never sorts above a real leak.
 */

/** The order the page's groups print in — the order of design.md's sections. */
export const GROUPS = ["records", "issues", "queues", "gates", "instruments", "build"];

const GROUP_TITLE = {
  records: "Records",
  issues: "Issues",
  queues: "Queues",
  gates: "Gates",
  instruments: "Instruments",
  build: "Build loop",
};

/** The phase words `/conduct` reads (`.claude/skills/conduct/SKILL.md`). Anything else is read by nothing. */
export const PHASE_WORDS = ["NOT STARTED", "PART-DONE", "CLOSED", "RETIRED"];

const DAY = 86_400_000;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`; null when either is not a day. */
export function daysBetween(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}/.test(to ?? "")) return null;
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / DAY);
}

/** `day` moved by `n` days (negative goes back). */
export function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** "fifty-three" → 53, "35" → 35, anything else → null. Prose states counts in words here. */
export function numberWord(text) {
  const s = String(text ?? "").trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  if (UNITS.includes(s)) return UNITS.indexOf(s);
  const [tens, unit] = s.split(/[-\s]/);
  const t = TENS.indexOf(tens ?? "");
  if (t < 2) return null;
  if (unit === undefined) return t * 10;
  const u = UNITS.indexOf(unit);
  return u >= 1 && u <= 9 ? t * 10 + u : null;
}

// ── records ──────────────────────────────────────────────────────────────

/** The `## Phase` sections of a phases.md and the word on each one's `**Status:**` line (null when none). */
export function phaseStatuses(text) {
  const out = [];
  let current = null;
  for (const line of String(text).split("\n")) {
    if (/^## Phase /.test(line)) {
      current = { title: line.slice(3).trim(), word: null };
      out.push(current);
      continue;
    }
    if (/^## /.test(line)) current = null;
    const m = /^\*\*Status:\s*([A-Z][A-Z -]*[A-Z])/.exec(line);
    if (m && current && current.word === null) {
      const raw = m[1].trim();
      current.word = PHASE_WORDS.find((w) => raw.startsWith(w)) ?? raw.split(/\s/)[0];
    }
  }
  return out;
}

/**
 * The lead of an index cell: its opening bold sentence when it has one, else
 * its first sentence. Read only that, because the rest of a cell is history —
 * "phase 3 was next on 2 Sep" further in is not a claim about today.
 */
function leadOf(cell) {
  const bold = /^\s*\*\*(.+?)\*\*/.exec(cell);
  if (bold) return bold[1];
  return cell.trim().split(/(?<=\.)\s/)[0] ?? "";
}

/** The index rows of `docs/projects/README.md`: project name → its "where it stands" cell. */
export function indexRows(indexText) {
  const rows = new Map();
  for (const line of String(indexText).split("\n")) {
    const m = /^\|\s*\[([\w-]+)\]\(\1\/?\)\s*\|/.exec(line);
    if (!m) continue;
    const cells = line.split("|").map((c) => c.trim());
    // ["", name, what, where, ""] — the last real cell is "where it stands".
    const where = cells.filter((c, i) => i > 0 && i < cells.length - 1).at(-1) ?? "";
    rows.set(m[1], where);
  }
  return rows;
}

const UNBUILT = /\bunbuilt\b|\bnot (?:yet )?(?:started|built)\b|\bNOT STARTED\b/i;
const ALL_CLOSED = /\ball\b[^.]*\b(?:closed|built)\b/i;
const BUILT_WORD = /(?<!un)(?<!not )(?<!not yet )\bbuilt\b|\bCLOSED\b/;

/**
 * **The index cell against front matter — a heuristic, and a conservative one.**
 *
 * The index is prose for a reader and front matter is what the roadmap reads,
 * so this cannot be exact; it flags only the lead of a cell saying the
 * opposite of the status: unbuilt/not started while front matter says
 * `partial` or `built`; "on branch" or "is next" while `built`; "all … closed"
 * while `partial`; built/CLOSED while `designed` or `open`. A cell that
 * understates (mindmap's "stages 1, 2 and 4" against four built) is missed.
 */
export function indexDisagreements(indexText, statusByProject) {
  const out = [];
  for (const [project, cell] of indexRows(indexText)) {
    const status = statusByProject.get(project);
    if (!status) continue;
    const lead = leadOf(cell);
    let why = null;
    if ((status === "built" || status === "partial") && UNBUILT.test(lead)) why = "index says unbuilt";
    else if (status === "built" && /\bon branch\b/i.test(lead)) why = "index says the work is on a branch";
    else if (status === "built" && /\bis next\b/i.test(lead)) why = "index says a phase is next";
    else if (status === "partial" && ALL_CLOSED.test(lead)) why = "index says all of it is closed";
    else if ((status === "designed" || status === "open") && BUILT_WORD.test(lead) && !UNBUILT.test(lead)) {
      why = "index says built";
    }
    if (why) out.push({ what: project, detail: `${why}; front matter says \`${status}\` — "${lead.slice(0, 80)}"` });
  }
  return out;
}

/** phases.md files with `## Phase` headings and not one `**Status:**` line — invisible to status.sh. */
export function missingStatusLines(files) {
  const out = [];
  for (const { path, text } of files) {
    const phases = phaseStatuses(text);
    if (phases.length > 0 && phases.every((p) => p.word === null)) {
      out.push({ what: path, detail: `${phases.length} phases, no Status line` });
    }
  }
  return out;
}

/** Status lines whose word is not in the vocabulary (DONE, mostly) — read by nothing. */
export function nonVocabularyStatus(files) {
  const out = [];
  for (const { path, text } of files) {
    for (const p of phaseStatuses(text)) {
      if (p.word !== null && !PHASE_WORDS.includes(p.word)) out.push({ what: path, detail: `${p.word}: ${p.title}` });
    }
  }
  return out;
}

/**
 * Front matter against the phases. All phases CLOSED or RETIRED but `partial`
 * (or `designed`) is a project that finished without saying so; any NOT
 * STARTED or PART-DONE but `built` is one that said so too early. Only the
 * vocabulary is read — a DONE counts for neither side.
 */
export function frontVsPhases(projects) {
  const out = [];
  for (const { name, status, phases } of projects) {
    const words = phaseStatuses(phases).map((p) => p.word).filter((w) => PHASE_WORDS.includes(w));
    if (words.length === 0) continue;
    const allShut = words.every((w) => w === "CLOSED" || w === "RETIRED");
    const open = words.filter((w) => w === "NOT STARTED" || w === "PART-DONE").length;
    if (allShut && (status === "partial" || status === "designed")) {
      out.push({ what: name, detail: `every phase CLOSED/RETIRED; front matter says \`${status}\`` });
    } else if (open > 0 && status === "built") {
      out.push({ what: name, detail: `${open} phase(s) NOT STARTED/PART-DONE; front matter says \`built\`` });
    }
  }
  return out;
}

/** Research notes whose filename the research index never mentions. */
export function unindexedResearch(names, readmeText) {
  return names
    .filter((n) => n.endsWith(".md") && n !== "README.md" && !readmeText.includes(n))
    .map((n) => ({ what: `docs/research/${n}` }));
}

/**
 * Changelog days in the window (`window` days before `day`, `day` itself left
 * out — tonight's entry is not owed yet) that had commits on main and have no
 * page, or a page still carrying the draft marker.
 */
export function changelogHoles({ commitsByDay, pages, day, window = 30 }) {
  const out = [];
  for (let back = window; back >= 1; back -= 1) {
    const d = addDays(day, -back);
    const commits = commitsByDay.get(d) ?? 0;
    const page = pages.get(d);
    if (page === undefined && commits > 0) out.push({ what: `docs/changelog/${d}.md`, detail: `missing — ${commits} commits` });
    else if (page !== undefined && page.includes("<!-- draft -->")) out.push({ what: `docs/changelog/${d}.md`, detail: "still a draft" });
  }
  return out;
}

// ── issues ───────────────────────────────────────────────────────────────

/** Every issue number a text names: `#N`, `issue: N`, or an `/issues/N` link. */
export function issuesNamed(text) {
  const found = new Set();
  for (const m of String(text).matchAll(/(?:^|[^\w&/])#(\d{1,5})\b/gm)) found.add(Number(m[1]));
  for (const m of String(text).matchAll(/^issue:\s*#?(\d+)\s*$/gm)) found.add(Number(m[1]));
  for (const m of String(text).matchAll(/\/issues\/(\d+)\b/g)) found.add(Number(m[1]));
  return found;
}

/** Open issues no doc names — on GitHub and nowhere in the repo's own account of the work. */
export function unnamedIssues(openIssues, docTexts) {
  const named = new Set();
  for (const t of docTexts) for (const n of issuesNamed(t)) named.add(n);
  return openIssues
    .filter((i) => !named.has(i.number))
    .sort((a, b) => a.number - b.number)
    .map((i) => ({ what: `#${i.number}`, detail: i.title }));
}

/** Projects whose front matter says the work is done (`built`, `superseded`) while their issue is still open. */
export function doneButOpen(projects, openIssues) {
  const open = new Set(openIssues.map((i) => i.number));
  return projects
    .filter((p) => (p.status === "built" || p.status === "superseded") && p.issue && open.has(p.issue))
    .map((p) => ({ what: `#${p.issue}`, detail: `${p.name} is \`${p.status}\`` }));
}

/** Open issues carrying no label at all. */
export function unlabelled(openIssues) {
  return openIssues
    .filter((i) => (i.labels ?? []).length === 0)
    .sort((a, b) => a.number - b.number)
    .map((i) => ({ what: `#${i.number}`, detail: i.title }));
}

/** Open PRs older than `days` on `day`, oldest first. */
export function stalePRs(prs, day, days = 14) {
  return prs
    .map((p) => ({ ...p, age: daysBetween(p.createdAt, day) ?? 0 }))
    .filter((p) => p.age > days)
    .sort((a, b) => b.age - a.age)
    .map((p) => ({ what: `#${p.number}`, detail: `${p.age} days — ${p.title}`, age: p.age }));
}

// ── queues ───────────────────────────────────────────────────────────────

/** Items with a date, aged on `day`, oldest first. `dated` is `[{ what, since, detail? }]`. */
function aged(dated, day) {
  return dated
    .map((d) => ({ ...d, age: daysBetween(d.since, day) }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1))
    .map((d) => ({ what: d.what, detail: [d.age === null ? "no date" : `${d.age} day${d.age === 1 ? "" : "s"}`, d.detail].filter(Boolean).join(" — "), age: d.age }));
}

const oldest = (offenders) => offenders.reduce((m, o) => (o.age !== null && o.age !== undefined && o.age > m ? o.age : m), 0);

/** Verify walks not yet walked (`unverified`), aged by their `since`. */
export function verifyQueue(walks, day) {
  return aged(walks.filter((w) => w.status === "unverified").map((w) => ({ what: w.path, since: w.since })), day);
}

/** Loop findings nobody has triaged, aged by the day they were filed (`added`). */
export function loopUntriaged(findings, day) {
  return aged(findings.filter((f) => f.decision === "untriaged").map((f) => ({ what: f.path, since: f.added })), day);
}

/** Persona review pages with unanswered findings: `[{ file, date, open }]`, aged by the run's date. */
export function personaUnanswered(pages, day) {
  const rows = aged(
    pages.filter((p) => p.open > 0).map((p) => ({ what: `docs/reviews/${p.file}`, since: p.date, detail: `${p.open} unanswered`, open: p.open })),
    day,
  );
  return rows;
}

/**
 * NOT STARTED and PART-DONE phases in phases.md files nobody has committed to
 * for more than `days` — `touched` is the file's last commit day (null when it
 * has none yet, which is not stale).
 */
export function stalePhases(projects, day, days = 14) {
  const out = [];
  for (const { name, path, phases, touched } of projects) {
    const age = touched ? daysBetween(touched, day) : null;
    if (age === null || age <= days) continue;
    const open = phaseStatuses(phases).filter((p) => p.word === "NOT STARTED" || p.word === "PART-DONE");
    if (open.length === 0) continue;
    out.push({ what: path ?? name, detail: `${open.length} open phase(s), untouched ${age} days`, age, n: open.length });
  }
  return out.sort((a, b) => b.age - a.age);
}

// ── gates ────────────────────────────────────────────────────────────────

/** The `CEILING` a ratchet test declares, read from its source. */
export function ceilingIn(source) {
  const m = /^const CEILING\s*=\s*([\d_]+);/m.exec(String(source));
  return m ? Number(m[1].replace(/_/g, "")) : null;
}

/** Untracked TypeScript under packages/ — files a ratchet reading `git ls-files` cannot see. */
export function untrackedSources(paths) {
  return paths.filter((p) => /^packages\/.*\.tsx?$/.test(p)).sort().map((p) => ({ what: p }));
}

/** The DEEP list's length in `test/deep.ts`, counted from its source. */
export function deepCount(deepSource) {
  const src = String(deepSource);
  const start = src.indexOf("export const DEEP");
  if (start < 0) return null;
  const end = src.indexOf("\n];", start);
  const body = src.slice(start, end < 0 ? undefined : end);
  return (body.match(/\{\s*file:\s*"/g) ?? []).length;
}

/**
 * The deep lane's size as each document states it, against `test/deep.ts`.
 * Each statement that disagrees is one offender; a statement that cannot be
 * found is one too, because a count nobody can read is not a count.
 */
export function deepCountsDisagree({ switchesText, agentsText, deepSource }) {
  const actual = deepCount(deepSource);
  const stated = [
    { what: "scripts/switches.mjs", n: numberWord(/the ([\w-]+) files\s+(?:\*\s+)?that spawn the CLI/.exec(switchesText ?? "")?.[1]) },
    { what: "AGENTS.md", n: numberWord(/files that spawn the CLI per case \(([\w-]+) on/.exec(agentsText ?? "")?.[1]) },
  ];
  return {
    actual,
    offenders: stated
      .filter((s) => s.n !== actual)
      .map((s) => ({ what: s.what, detail: s.n === null ? "states no count this check can read" : `says ${s.n}; test/deep.ts has ${actual}` })),
  };
}

// ── instruments ──────────────────────────────────────────────────────────

/** Personas whose front matter declares no `goal:` — nothing they report can move. */
export function personasWithoutGoal(personas) {
  return personas.filter((p) => !/^goal:/m.test(p.front ?? "")).map((p) => ({ what: p.path }));
}

/** How many pages the newest grades page graded, from its own sentence. */
export function gradedCount(gradePage) {
  const m = /\*\*(\d+) graded\*\*/.exec(String(gradePage ?? ""));
  return m ? Number(m[1]) : null;
}

/** The newest `YYYY-MM-DD` that starts a filename in the list, or null. */
export function newestDate(names) {
  const days = names.map((n) => /^(\d{4}-\d{2}-\d{2})/.exec(n)?.[1]).filter(Boolean).sort();
  return days.at(-1) ?? null;
}

/** One-shot instruments (`[{ what, names }]`) whose newest page is older than `days`, or missing. */
export function staleInstruments(instruments, day, days = 14) {
  return instruments
    .map((i) => {
      const last = newestDate(i.names);
      return { what: i.what, age: last ? daysBetween(last, day) : null, last };
    })
    .filter((i) => i.age === null || i.age > days)
    .sort((a, b) => (b.age ?? Infinity) - (a.age ?? Infinity))
    .map((i) => ({ what: i.what, detail: i.last ? `last ran ${i.last}, ${i.age} days ago` : "never ran", age: i.age }));
}

// ── build loop ───────────────────────────────────────────────────────────

/** Red runs and mean wall minutes over completed release runs: `[{ conclusion, startedAt, updatedAt, ... }]`. */
export function releaseStats(runs) {
  const red = runs.filter((r) => r.conclusion === "failure" || r.conclusion === "timed_out");
  const minutes = runs
    .map((r) => (Date.parse(r.updatedAt) - Date.parse(r.startedAt)) / 60_000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  return {
    total: runs.length,
    red: red.map((r) => ({ what: r.url ?? `run ${r.databaseId}`, detail: `${(r.createdAt ?? "").slice(0, 10)} — ${r.displayTitle ?? ""}`.trim() })),
    meanMinutes: minutes.length ? Math.round((minutes.reduce((a, b) => a + b, 0) / minutes.length) * 10) / 10 : null,
  };
}

const LEFT_BEHIND = /left behind|the rest|missed|forgot/i;

/** Rework-shaped commits among `[{ sha, subject }]`: fixes, left-behinds, reverts. */
export function commitStats(commits) {
  const pick = (test) => commits.filter((c) => test(c.subject)).map((c) => ({ what: c.sha.slice(0, 9), detail: c.subject }));
  return {
    fixes: pick((s) => /^fix\b/i.test(s)),
    leftBehind: pick((s) => LEFT_BEHIND.test(s)),
    reverts: pick((s) => /^revert\b/i.test(s)),
  };
}

// ── the page ─────────────────────────────────────────────────────────────

/**
 * One row. `count` null means the number could not be taken, and `note` says
 * why; such a row writes no number into front matter, so tomorrow's *was* is
 * blank rather than a zero nobody measured.
 */
export function row(group, key, label, count, offenders = [], extra = {}) {
  return { group, key: `${group}-${key}`, label, count, offenders, better: "lower", ...extra };
}

/** Whether a row got worse since `was`. */
export function worsened(r) {
  if (r.count === null || r.was === null || r.was === undefined || r.better === "info") return false;
  return r.better === "higher" ? r.count < r.was : r.count > r.was;
}

/** How bad a row is now, for sorting: the count for lower-is-better (the overshoot, for a row with a bound), the shortfall under target for higher. */
export function severity(r) {
  if (r.count === null || r.better === "info") return 0;
  if (r.better === "higher") return r.target !== undefined && r.count < r.target ? r.target - r.count : 0;
  // A ratchet under its ceiling is holding; what leaks is the overshoot.
  if (r.bound !== undefined) return Math.max(0, r.count - r.bound);
  return r.count;
}

/** Attach yesterday's numbers (`was`, a Map of front matter fields) and notice moved bounds. */
export function withWas(rows, was) {
  const num = (k) => (was && was.has(k) && /^-?[\d.]+$/.test(was.get(k)) ? Number(was.get(k)) : null);
  return rows.map((r) => {
    const out = { ...r, was: num(r.key) };
    if (r.bound !== undefined) {
      const before = num(`${r.key}-bound`);
      if (before !== null && before !== r.bound) out.boundMoved = { from: before, to: r.bound };
    }
    if (r.age !== undefined) out.ageWas = num(`${r.key}-oldest`);
    return out;
  });
}

/** Worst first: rows that got worse since *was*, then by how bad they are now. */
export function sortRows(rows) {
  return [...rows].sort((a, b) => Number(worsened(b)) - Number(worsened(a)) || severity(b) - severity(a) || a.key.localeCompare(b.key));
}

/** The front matter: the date and every number taken, as `key: value`. */
export function frontMatter(day, rows) {
  const lines = ["---", `date: ${day}`];
  for (const r of rows) {
    if (r.count === null) continue;
    lines.push(`${r.key}: ${r.count}`);
    if (r.bound !== undefined) lines.push(`${r.key}-bound: ${r.bound}`);
    if (r.age !== undefined && r.age !== null) lines.push(`${r.key}-oldest: ${r.age}`);
  }
  lines.push("---");
  return lines.join("\n");
}

const cellText = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function nowCell(r) {
  if (r.count === null) return "—";
  const parts = [String(r.count)];
  if (r.bound !== undefined) parts.push(r.better === "higher" ? `(ceiling ${r.bound})` : `/ ${r.bound}`);
  if (r.age !== undefined && r.age !== null) parts.push(`· oldest ${r.age} d`);
  return parts.join(" ");
}

function wasCell(r) {
  if (r.count === null) return "—";
  if (r.was === null || r.was === undefined) return "—";
  const arrow = worsened(r) ? " ▲ worse" : r.was === r.count ? "" : " ▼ better";
  return `${r.was}${r.better === "info" ? "" : arrow}`;
}

/**
 * The page. `skipped` is `[{ group, why }]` — whole groups (or parts) that
 * were not measured, said on the page rather than printed as zeroes.
 */
export function renderPage({ day, rows, previous, skipped = [] }) {
  const sorted = sortRows(rows);
  const leaks = sorted.filter((r) => severity(r) > 0);
  const worse = sorted.filter(worsened);
  const lines = [frontMatter(day, rows), "", `# Practice — ${day}`, ""];
  lines.push(
    `**${leaks.length} of ${rows.length} rows are leaking**, ${worse.length} worse than ${previous ? `[${previous}](${previous}.md)` : "the last page (there is none, so every *was* is blank)"}.`,
    "Worst first: a row that got worse since *was* outranks one that did not, then the bigger number.",
    "",
  );
  for (const s of skipped) lines.push(`> **Not measured — ${s.group}:** ${s.why}`, "");
  lines.push("| | Row | Now | Was | Top offender |", "| --- | --- | --- | --- | --- |");
  for (const r of sorted) {
    const top = r.count === null ? (r.note ?? "not measured") : (r.offenders[0] ? `${r.offenders[0].what}${r.offenders[0].detail ? ` — ${r.offenders[0].detail}` : ""}` : "");
    const flag = r.boundMoved ? ` **bound moved ${r.boundMoved.from} → ${r.boundMoved.to}**` : "";
    lines.push(`| ${GROUP_TITLE[r.group]} | ${cellText(r.label)}${flag} | ${nowCell(r)} | ${wasCell(r)} | ${cellText(top.slice(0, 140))} |`);
  }
  lines.push("");
  for (const g of GROUPS) {
    const group = sorted.filter((r) => r.group === g);
    if (group.length === 0) continue;
    lines.push(`## ${GROUP_TITLE[g]}`, "");
    for (const r of group) {
      const head = r.count === null ? `**${r.label}** — not measured: ${r.note ?? "no reading"}` : `**${r.label}** — ${nowCell(r)} (was ${r.was ?? "—"})`;
      lines.push(`### \`${r.key}\``, "", head, "");
      if (r.note && r.count !== null) lines.push(r.note, "");
      if (r.boundMoved) lines.push(`The bound moved from ${r.boundMoved.from} to ${r.boundMoved.to} since the last page — a number that improves by moving its bound says so.`, "");
      for (const o of r.offenders.slice(0, 5)) lines.push(`- \`${o.what}\`${o.detail ? ` — ${cellText(o.detail)}` : ""}`);
      if (r.offenders.length > 5) lines.push(`- …and ${r.offenders.length - 5} more`);
      if (r.offenders.length) lines.push("");
    }
  }
  lines.push(
    "---",
    "",
    "Written by `scripts/practice.mjs`. Deterministic: no model, nothing written",
    "outside `docs/practice/`. Rows marked *heuristic* can be wrong in both",
    "directions and say how. The morning lap reads this page and fixes one row.",
    "",
  );
  return lines.join("\n");
}

/** The rows as plain numbers, for `--json`. */
export function summary(day, rows) {
  return {
    date: day,
    rows: sortRows(rows).map((r) => ({
      key: r.key,
      label: r.label,
      count: r.count,
      was: r.was ?? null,
      worse: worsened(r),
      ...(r.bound !== undefined ? { bound: r.bound } : {}),
      ...(r.age !== undefined ? { oldest: r.age } : {}),
      offenders: r.offenders.slice(0, 5),
      ...(r.note ? { note: r.note } : {}),
    })),
  };
}

/**
 * **Every row, from plain inputs.** The script gathers `inputs`; this decides.
 * `inputs.issues` and `inputs.runs` are null when GitHub was not asked
 * (`--offline`) or could not answer — those rows are left out and `skipped`
 * says so, rather than printing zeroes nobody measured.
 */
export function assemble(inputs) {
  const { day } = inputs;
  const rows = [];
  const skipped = [];

  // records
  const r = inputs.records;
  rows.push(row("records", "index-disagrees", "index cell vs front matter (heuristic)", ...counted(indexDisagreements(r.index, r.statusByProject))));
  rows.push(row("records", "phases-no-status", "phases.md with `## Phase` and no Status line", ...counted(missingStatusLines(r.phases))));
  rows.push(row("records", "status-not-vocabulary", "Status words outside the vocabulary (DONE)", ...counted(nonVocabularyStatus(r.phases))));
  rows.push(row("records", "front-vs-phases", "front matter vs phases", ...counted(frontVsPhases(r.projects))));
  rows.push(row("records", "research-unindexed", "research notes missing from the research index", ...counted(unindexedResearch(r.researchNames, r.researchReadme))));
  rows.push(row("records", "changelog-holes", "changelog days (last 30) missing or still a draft", ...counted(changelogHoles({ commitsByDay: r.commitsByDay, pages: r.changelogPages, day }))));

  // issues
  if (inputs.issues) {
    const { open, prs, milestones } = inputs.issues;
    rows.push(row("issues", "unnamed", "open issues named nowhere under docs/ (heuristic)", ...counted(unnamedIssues(open, inputs.docTexts))));
    rows.push(row("issues", "done-but-open", "built/superseded projects whose issue is open", ...counted(doneButOpen(r.projects, open))));
    rows.push(row("issues", "unlabelled", "open issues with no label", ...counted(unlabelled(open)), { note: `of ${open.length} open` }));
    rows.push(row("issues", "milestones", "milestones (a reading: labels may be the answer instead)", milestones, [], { better: "info" }));
    const stale = stalePRs(prs, day);
    rows.push(row("issues", "stale-prs", "open PRs older than 14 days", stale.length, stale, { age: oldest(stale) }));
  } else {
    skipped.push({ group: "issues", why: inputs.issuesWhy ?? "GitHub was not asked (`--offline`)." });
  }

  // queues
  const q = inputs.queues;
  const v = verifyQueue(q.walks, day);
  rows.push(row("queues", "verify-unverified", "verify walks unverified", v.length, v, { age: oldest(v) }));
  const l = loopUntriaged(q.findings, day);
  rows.push(row("queues", "loop-untriaged", "Loop findings untriaged", l.length, l, { age: oldest(l) }));
  const p = personaUnanswered(q.reviewPages, day);
  const open = q.reviewPages.reduce((n, pg) => n + pg.open, 0);
  rows.push(row("queues", "persona-unanswered", "persona findings unanswered", open, p, { age: oldest(p) }));
  const s = stalePhases(r.projects, day);
  rows.push(row("queues", "stale-phases", "open phases untouched > 14 days", s.reduce((n, x) => n + x.n, 0), s, { age: oldest(s) }));

  // gates
  const g = inputs.gates;
  for (const m of g.ratchets) {
    if (m.value === null) {
      rows.push(row("gates", m.key, m.label, null, [], { note: m.why }));
      continue;
    }
    rows.push(row("gates", m.key, m.label, m.value, m.offenders ?? [], { bound: m.ceiling, note: `headroom ${m.ceiling - m.value}` }));
  }
  if (g.bundle.bytes === null) {
    rows.push(row("gates", "bundle-headroom", "bundle headroom, bytes under CEILING", null, [], { better: "higher", note: g.bundle.why }));
  } else {
    rows.push(
      row("gates", "bundle-headroom", "bundle headroom, bytes under CEILING", g.bundle.ceiling - g.bundle.bytes, [{ what: "scripts/bundle-ceiling.mjs", detail: `entry chunk ${g.bundle.bytes} of ${g.bundle.ceiling}` }], {
        better: "higher",
        target: 5000,
        bound: g.bundle.ceiling,
        note: "Target 5,000 is design.md's example, not a decision: the headroom policy is Dion's.",
      }),
    );
  }
  rows.push(row("gates", "untracked-ts", "untracked .ts/.tsx under packages/ — invisible to the ratchets", ...counted(untrackedSources(g.untracked))));
  const deep = deepCountsDisagree(g.deep);
  rows.push(row("gates", "deep-count-stale", "stated deep-file counts that disagree with test/deep.ts", deep.offenders.length, deep.offenders, { note: `test/deep.ts lists ${deep.actual}` }));

  // instruments
  const i = inputs.instruments;
  rows.push(row("instruments", "persona-no-goal", "personas with no goal number", ...counted(personasWithoutGoal(i.personas))));
  const graded = gradedCount(i.latestGrade?.text);
  rows.push(
    row("instruments", "grades-pages", "pages the latest grade page graded", graded, i.latestGrade ? [{ what: i.latestGrade.path }] : [], {
      better: "higher",
      target: 2,
      ...(graded === null ? { note: "no grade page, or none that says how many it graded" } : {}),
    }),
  );
  const st = staleInstruments(i.oneShots, day);
  rows.push(row("instruments", "one-shots-stale", "one-shot instruments not run in 14 days", st.length, st, { age: oldest(st) }));

  // build loop
  const b = inputs.build;
  if (b.runs) {
    const rs = releaseStats(b.runs);
    rows.push(row("build", "release-red", "release.yml red runs, last completed on main", rs.red.length, rs.red, { note: `of ${rs.total} completed runs` }));
    rows.push(row("build", "release-minutes", "release.yml mean wall minutes", rs.meanMinutes, [], { ...(rs.meanMinutes === null ? { note: "no runs" } : {}) }));
  } else {
    skipped.push({ group: "build loop (Actions)", why: b.runsWhy ?? "GitHub was not asked (`--offline`)." });
  }
  const cs = commitStats(b.commits);
  rows.push(row("build", "commits-14d", "commits on main, last 14 days", b.commits.length, [], { better: "info" }));
  rows.push(row("build", "fix-14d", "fix commits, last 14 days", ...counted(cs.fixes)));
  rows.push(row("build", "left-behind-14d", "left-behind commits (\"the rest\", \"missed\", \"forgot\"), last 14 days", ...counted(cs.leftBehind)));
  rows.push(row("build", "reverts-14d", "reverts, last 14 days", ...counted(cs.reverts)));

  return { rows: withWas(rows, inputs.was), skipped };
}

function counted(offenders) {
  return [offenders.length, offenders];
}
