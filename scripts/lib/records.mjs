import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** The Status words a phases.md uses, mapped to keel/front-matter status. */
export const PHASE_WORDS = Object.freeze({
  CLOSED: "built",
  "PART-DONE": "partial",
  "NOT STARTED": "planned",
  RETIRED: "superseded",
});

/** Primary doc order for a project directory (first found wins). */
export const PRIMARY_DOCS = Object.freeze(["journey.md", "design.md", "plan.md", "phases.md"]);

const PHASE_HEAD = /^## (?:Phase (\d+(?:\.\d+)?)\b|(\d+(?:\.\d+)?)\.\s)(.*)$/;
const STATUS_LINE = /^\*\*Status:\s*([A-Z][A-Z-]*(?: [A-Z][A-Z-]+)*)/;

/**
 * The phase sections of a phases.md (`## Phase N …` or `## N. …`), outside
 * fenced code: [{ id, title, heading, word, status, line }]. Matches
 * `phaseSections` in `scripts/keel/lib.mjs`.
 */
export function phaseSections(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const out = [];
  let fence = false;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const h = PHASE_HEAD.exec(lines[i]);
    if (h) {
      const heading = h[3].trim();
      current = {
        id: h[1] ?? h[2],
        title: heading.replace(/^[—:–-]\s*/, "").replace(/\s*✅\s*$/, "").trim(),
        heading,
        word: null,
        status: "unknown",
        line: i + 1,
      };
      out.push(current);
      continue;
    }
    if (/^## /.test(lines[i])) {
      current = null;
      continue;
    }
    const s = current && current.word === null ? STATUS_LINE.exec(lines[i]) : null;
    if (s) {
      current.word = s[1];
      current.status = PHASE_WORDS[current.word] ?? "unknown";
    }
  }
  return out;
}

/**
 * Research index completeness: every `docs/research/*.md` (except `README.md`)
 * must be linked in `docs/research/README.md`.
 */
export function checkResearchIndex(researchFiles, indexText) {
  const out = [];
  const text = String(indexText ?? "");
  for (const name of researchFiles) {
    if (name === "README.md" || !name.endsWith(".md")) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linked = new RegExp(`\\]\\((?:\\./|docs/research/)?${escaped}(?:#[^)]*)?\\)`).test(text);
    if (!linked) {
      out.push({
        rule: "research-unindexed",
        path: "docs/research/README.md",
        detail: `docs/research/README.md does not link docs/research/${name}`,
      });
    }
  }
  return out;
}

/**
 * Phase Status vocabulary & completeness: every `docs/projects/<p>/phases.md`
 * with phase headings must have a `**Status: <WORD>` line on every phase using
 * only `NOT STARTED`, `PART-DONE`, `CLOSED`, `RETIRED`.
 */
export function checkPhaseStatuses(projects) {
  const out = [];
  for (const p of projects) {
    if (!p.phases?.length) continue;
    if (p.phases.every((x) => x.word === null)) {
      out.push({
        rule: "phase-status",
        path: p.phasesPath,
        detail: `${p.phasesPath}: ${p.phases.length} phase${p.phases.length === 1 ? "" : "s"}, no **Status: line`,
      });
      continue;
    }
    for (const x of p.phases) {
      if (x.word === null) {
        out.push({
          rule: "phase-status",
          path: `${p.phasesPath}:${x.line}`,
          detail: `${p.name} phase ${x.id} has no **Status: line`,
        });
      } else if (!PHASE_WORDS[x.word]) {
        out.push({
          rule: "phase-status",
          path: `${p.phasesPath}:${x.line}`,
          detail: `${p.name} phase ${x.id} says ${x.word} (expected NOT STARTED, PART-DONE, CLOSED, or RETIRED)`,
        });
      }
    }
  }
  return out;
}

/**
 * Front matter vs phases: `status: built` with any `NOT STARTED`/`PART-DONE`
 * phase fails; `status: partial` or `status: designed` with all phases
 * `CLOSED`/`RETIRED` fails.
 */
export function checkFrontMatterVsPhases(projects) {
  const out = [];
  for (const p of projects) {
    const known = (p.phases ?? []).filter((x) => x.status !== "unknown");
    if (!known.length) continue;
    const open = known.filter((x) => x.status === "planned" || x.status === "partial");
    if (p.status === "built" && open.length > 0) {
      out.push({
        rule: "front-matter-vs-phases",
        path: p.primary,
        detail: `${p.name}: ${open.length} phase${open.length === 1 ? "" : "s"} open in ${p.phasesPath}; front matter says built`,
      });
    } else if ((p.status === "partial" || p.status === "designed") && open.length === 0) {
      out.push({
        rule: "front-matter-vs-phases",
        path: p.primary,
        detail: `${p.name}: every phase closed or retired in ${p.phasesPath}; front matter says ${p.status}`,
      });
    }
  }
  return out;
}

/**
 * Split a Markdown table row on unescaped `|` outside backtick code spans.
 * Returns null if the line does not start and end with `|`.
 */
export function splitTableRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const masked = trimmed.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
  const pipes = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "|" && masked[i - 1] !== "\\") pipes.push(i);
  }
  if (pipes.length < 2) return null;
  const cells = [];
  for (let i = 0; i < pipes.length - 1; i++) {
    cells.push(trimmed.slice(pipes[i] + 1, pipes[i + 1]).trim());
  }
  return cells;
}

/**
 * Parse `docs/projects/README.md` into project rows (`Map<name, row>`) and
 * structural table problems (missing/malformed/split/duplicate rows).
 */
export function parseProjectsIndex(indexText) {
  const lines = String(indexText ?? "").split(/\r?\n/);
  const rows = new Map();
  const problems = [];
  let fence = false;
  let sawTable = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const trimmed = raw.trim();
    if (!trimmed.startsWith("|")) continue;
    const lineNo = i + 1;
    const cells = splitTableRow(trimmed);
    if (!cells || cells.length !== 3) {
      problems.push({
        rule: "projects-index-row",
        path: `docs/projects/README.md:${lineNo}`,
        detail: `docs/projects/README.md:${lineNo}: malformed or split table row (${cells ? `${cells.length} columns` : "unclosed row"})`,
      });
      continue;
    }
    if (cells[0] === "Project" && cells[1] === "What it is" && cells[2] === "Where it stands") {
      sawTable = true;
      continue;
    }
    if (/^---+$/.test(cells[0].replace(/\s+/g, ""))) continue;

    const m = /^\[([a-z0-9-]+)\]\(([a-z0-9-]+)\/\)$/.exec(cells[0]);
    if (!m || m[1] !== m[2]) {
      problems.push({
        rule: "projects-index-row",
        path: `docs/projects/README.md:${lineNo}`,
        detail: `docs/projects/README.md:${lineNo}: malformed project link cell "${cells[0]}" (expected [<project>](<project>/))`,
      });
      continue;
    }
    const name = m[1];
    if (rows.has(name)) {
      problems.push({
        rule: "projects-index-row",
        path: `docs/projects/README.md:${lineNo}`,
        detail: `docs/projects/README.md:${lineNo}: duplicate row for project ${name}`,
      });
      continue;
    }
    rows.set(name, { name, what: cells[1], where: cells[2], line: lineNo });
  }

  if (!sawTable) {
    problems.push({
      rule: "projects-index-row",
      path: "docs/projects/README.md",
      detail: "docs/projects/README.md: missing '| Project | What it is | Where it stands |' table",
    });
  }
  return { rows, problems };
}

/**
 * The lead of a "Where it stands" cell: its opening `**...**` bold span when
 * present, otherwise its first sentence.
 */
export function leadOf(cell) {
  const trimmed = String(cell ?? "").trim();
  const bold = /^\*\*([^*]+)\*\*/.exec(trimmed);
  if (bold) return bold[1].trim();
  return (trimmed.split(/(?<=\.)\s+/)[0] ?? trimmed).trim();
}

const NUMBER_WORDS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
});

function expandSpec(spec) {
  const ids = [];
  const norm = String(spec ?? "")
    .replace(/\s+and\s+/gi, ",")
    .trim();
  for (const part of norm.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const range = /^(\d+(?:\.\d+)?)\s*(?:[–-]|to)\s*(\d+(?:\.\d+)?)$/i.exec(piece);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 50) {
        for (let n = start; n <= end; n++) ids.push(String(n));
      } else {
        ids.push(range[1], range[2]);
      }
    } else if (/^\d+(?:\.\d+)?$/.test(piece)) {
      ids.push(piece);
    }
  }
  return ids;
}

/**
 * Extract the built/closed/done phase or stage set from a lead sentence.
 * Returns `{ all: boolean, count: number | null, ids: string[] }`.
 */
export function extractBuiltSet(text) {
  const str = String(text ?? "");
  const univ =
    /\b(all|every|both)(?:\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+))?\s+(?:phases?|stages?|steps?)(?:\s*\(([^)]+)\))?\s+(?:are\s+|were\s+|now\s+)?(?:built|closed|done)\b/i.exec(
      str,
    );
  if (univ) {
    const quantifier = univ[1].toLowerCase();
    const rawCount = univ[2]?.toLowerCase();
    const count =
      quantifier === "both"
        ? 2
        : rawCount
          ? (NUMBER_WORDS[rawCount] ?? (Number.isFinite(Number(rawCount)) ? Number(rawCount) : null))
          : null;
    const ids = univ[3] ? expandSpec(univ[3]) : [];
    return { all: true, count, ids };
  }

  const ids = [];
  const seen = new Set();
  const re =
    /\b(phases|stages|steps|phase|stage|step)\s+(\d+(?:\.\d+)?(?:\s*(?:[–-]|to)\s*\d+(?:\.\d+)?|(?:\s*,\s*\d+(?:\.\d+)?)+(?:\s+and\s+\d+(?:\.\d+)?)?|\s+and\s+\d+(?:\.\d+)?)?)\s+(?:are\s+|were\s+|now\s+)?(?:built|closed|done)\b/gi;
  for (const m of str.matchAll(re)) {
    const noun = m[1].toLowerCase();
    const expanded = expandSpec(m[2]);
    // Skip standalone milestone highlights like "Phase 14 closed ... phase 10.5 closed"
    // that do not start from phase 0 or 1 and have no prior cumulative range.
    if (
      (noun === "phase" || noun === "stage" || noun === "step") &&
      seen.size === 0 &&
      expanded.length === 1 &&
      expanded[0] !== "0" &&
      expanded[0] !== "1"
    ) {
      continue;
    }
    for (const id of expanded) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return { all: false, count: null, ids };
}

function hasAnySet(s) {
  return Boolean(s && (s.all || s.ids.length > 0));
}

function sameIds(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function isContiguousIntegerRun(ids) {
  if (!ids.length || !ids.every((id) => /^\d+$/.test(id))) return false;
  const nums = ids.map(Number);
  if (nums[0] !== 0 && nums[0] !== 1) return false;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
}

function setsAgree(a, b) {
  if (!hasAnySet(a) || !hasAnySet(b)) return true;
  if (a.all && b.all) {
    if (a.count !== null && b.count !== null && a.count !== b.count) return false;
    if (a.ids.length > 0 && b.ids.length > 0 && !sameIds(a.ids, b.ids)) return false;
    return true;
  }
  if (a.all !== b.all) {
    const allSet = a.all ? a : b;
    const expSet = a.all ? b : a;
    if (allSet.ids.length > 0) return sameIds(allSet.ids, expSet.ids);
    if (allSet.count !== null) {
      return allSet.count === expSet.ids.length && isContiguousIntegerRun(expSet.ids);
    }
    return isContiguousIntegerRun(expSet.ids);
  }
  return sameIds(a.ids, b.ids);
}

function formatSet(s) {
  if (s.all) {
    const c = s.count !== null ? ` (${s.count})` : "";
    const ids = s.ids.length ? ` [${s.ids.join(", ")}]` : "";
    return `all${c}${ids}`;
  }
  return `[${s.ids.join(", ")}]`;
}

function extractNoteSet(note) {
  if (!note) return { all: false, count: null, ids: [] };
  const firstSentence = String(note).split(/(?<=\.)\s+/)[0] ?? String(note);
  const first = extractBuiltSet(firstSentence);
  if (first.all) return first;
  // Accumulate explicit phase/stage closures across the note (e.g. "stages 1 and 2 built ... Phase 3 closed"),
  // without letting a trailing universal clause override an opening partial range.
  const full = extractBuiltSet(String(note).replace(/\b(?:all|every|both)\b/gi, ""));
  return hasAnySet(full) ? full : extractBuiltSet(String(note));
}

function checkLeadVsPhases(project, leadSet) {
  if (!hasAnySet(leadSet) || !project.phases?.length) return null;
  const byId = new Map();
  for (const sec of project.phases) {
    if (!byId.has(sec.id)) byId.set(sec.id, []);
    byId.get(sec.id).push(sec);
  }
  const active = [];
  for (const [id, secs] of byId) {
    if (secs.some((s) => s.status === "unknown")) return null;
    if (secs.every((s) => s.word === "RETIRED")) continue;
    const closed = secs.every((s) => s.word === "CLOSED" || s.word === "RETIRED") && secs.some((s) => s.word === "CLOSED");
    active.push({ id, closed });
  }
  if (!active.length) return null;
  const closedIds = active.filter((x) => x.closed).map((x) => x.id);

  if (leadSet.all) {
    const open = active.filter((x) => !x.closed);
    if (open.length > 0) {
      return `${project.name}: index cell claims all phases closed/built, but phase(s) ${open.map((x) => x.id).join(", ")} are open in ${project.phasesPath}`;
    }
    if (leadSet.count !== null && leadSet.count !== closedIds.length) {
      return `${project.name}: index cell claims ${leadSet.count} phases closed/built, but ${project.phasesPath} has ${closedIds.length} active closed phases (${closedIds.join(", ")})`;
    }
    if (leadSet.ids.length > 0 && !sameIds(leadSet.ids, closedIds)) {
      return `${project.name}: index cell names phases [${leadSet.ids.join(", ")}], but ${project.phasesPath} has [${closedIds.join(", ")}]`;
    }
    return null;
  }

  const byActive = new Map(active.map((x) => [x.id, x.closed]));
  const notClosed = leadSet.ids.filter((id) => byActive.get(id) !== true);
  if (notClosed.length > 0) {
    return `${project.name}: index cell claims phase(s) ${notClosed.join(", ")} built/closed, but ${project.phasesPath} does not have them CLOSED`;
  }

  const hasFractional = leadSet.ids.some((id) => id.includes("."));
  const cmpActive = hasFractional ? active : active.filter((x) => !x.id.includes("."));
  const startIdx = cmpActive.findIndex((x) => x.id === leadSet.ids[0]);
  if (startIdx >= 0) {
    const priorClosed = cmpActive.slice(0, startIdx).filter((x) => x.closed);
    const contiguousClosed = [];
    for (let i = startIdx; i < cmpActive.length; i++) {
      if (!cmpActive[i].closed) break;
      contiguousClosed.push(cmpActive[i].id);
    }
    if (priorClosed.length > 0 || !sameIds(leadSet.ids, contiguousClosed)) {
      const actual = [...priorClosed.map((x) => x.id), ...contiguousClosed];
      return `${project.name}: index cell claims phases [${leadSet.ids.join(", ")}] built/closed, but ${project.phasesPath} has [${actual.join(", ")}] CLOSED`;
    }
  }
  return null;
}

function checkLeadVsStatus(project, lead) {
  const status = project.status;
  if (!status) return null;

  if (status === "built") {
    if (
      /\b(partial|partly|part-done|unbuilt|not built|nothing built|docs-only)\b|\bon branch\b|\bis next\b/i.test(lead)
    ) {
      return `${project.name}: index cell lead "${lead}" contradicts front matter status: built`;
    }
  } else if (status === "partial") {
    if (/\b(unbuilt|not built|nothing built|docs-only)\b/i.test(lead)) {
      return `${project.name}: index cell lead "${lead}" claims unbuilt while front matter says status: partial`;
    }
    if (
      /\b(?:all|every|both)\s+(?:[\w()-]+\s+)*(?:phases?|stages?|steps?)\b[^.;]*\b(?:closed|done)\b|^(?:done|closed)\b|\b(?:all|every)\s+(?:closed|done)\b/i.test(
        lead,
      )
    ) {
      return `${project.name}: index cell lead "${lead}" claims all closed/done while front matter says status: partial`;
    }
  } else if (status === "designed" || status === "open") {
    if (/(?<!\b(?:not|nothing|never)\s)\bbuilt\b|\b(closed|done|part-done|partly)\b/i.test(lead)) {
      return `${project.name}: index cell lead "${lead}" claims built/closed while front matter says status: ${status}`;
    }
  } else if (status === "superseded") {
    if (!/\b(superseded|removed)\b/i.test(lead)) {
      return `${project.name}: index cell lead "${lead}" does not say Superseded or Removed while front matter says status: superseded`;
    }
  }
  return null;
}

/**
 * Projects index (`docs/projects/README.md`) vs front matter & phases:
 * 1. Well-formed 3-column table rows, no stray/split rows, 1 row per project.
 * 2. "Where it stands" cell lead agrees with front matter `status`.
 * 3. Named closed/built phase or stage set/range agrees with `phases.md` and
 *    front matter `note`.
 */
export function checkProjectsIndex(projects, indexText) {
  const { rows, problems } = parseProjectsIndex(indexText);
  const out = [...problems];
  const byName = new Map(projects.map((p) => [p.name, p]));

  for (const p of projects) {
    const row = rows.get(p.name);
    if (!row) {
      out.push({
        rule: "projects-index-missing",
        path: "docs/projects/README.md",
        detail: `docs/projects/README.md has no row for project ${p.name}`,
      });
      continue;
    }
    const lead = leadOf(row.where);
    const statusProblem = checkLeadVsStatus(p, lead);
    if (statusProblem) {
      out.push({
        rule: "projects-index-status",
        path: `docs/projects/README.md:${row.line}`,
        detail: statusProblem,
      });
    }

    const leadSet = extractBuiltSet(lead);
    const phasesProblem = checkLeadVsPhases(p, leadSet);
    if (phasesProblem) {
      out.push({
        rule: "projects-index-phases",
        path: `docs/projects/README.md:${row.line}`,
        detail: phasesProblem,
      });
    }

    const noteSet = extractNoteSet(p.note);
    if (hasAnySet(leadSet) && hasAnySet(noteSet) && !setsAgree(leadSet, noteSet)) {
      out.push({
        rule: "projects-index-note",
        path: `docs/projects/README.md:${row.line}`,
        detail: `${p.name}: index cell lead claims ${formatSet(leadSet)} built/closed, but ${p.primary} note says ${formatSet(noteSet)}`,
      });
    }
  }

  for (const [name, row] of rows) {
    if (!byName.has(name)) {
      out.push({
        rule: "projects-index-unknown",
        path: `docs/projects/README.md:${row.line}`,
        detail: `docs/projects/README.md:${row.line} names unknown project ${name}`,
      });
    }
  }

  return out;
}

/**
 * Read project and research records from `root` using core's `docStatus` reader.
 */
export function readRepoRecords(root, docStatus) {
  const rdir = path.join(root, "docs/research");
  const researchFiles = existsSync(rdir)
    ? readdirSync(rdir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .sort()
    : [];
  const researchIndex = existsSync(path.join(rdir, "README.md"))
    ? readFileSync(path.join(rdir, "README.md"), "utf8")
    : "";

  const pdir = path.join(root, "docs/projects");
  const projects = [];
  if (existsSync(pdir)) {
    for (const d of readdirSync(pdir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const primaryName = PRIMARY_DOCS.find((f) => existsSync(path.join(pdir, d.name, f)));
      if (!primaryName) continue;
      const primaryRel = `docs/projects/${d.name}/${primaryName}`;
      const fm = docStatus(readFileSync(path.join(root, primaryRel), "utf8"));
      const phasesRel = `docs/projects/${d.name}/phases.md`;
      const phasesFull = path.join(root, phasesRel);
      const phases = existsSync(phasesFull) ? phaseSections(readFileSync(phasesFull, "utf8")) : null;
      projects.push({
        name: d.name,
        primary: primaryRel,
        status: fm.status ?? null,
        note: fm.note ?? null,
        phasesPath: phases ? phasesRel : null,
        phases,
      });
    }
  }
  const projectsIndex = existsSync(path.join(pdir, "README.md"))
    ? readFileSync(path.join(pdir, "README.md"), "utf8")
    : "";

  return { researchFiles, researchIndex, projects, projectsIndex };
}

/**
 * Run all four record checks on `root` using core's `docStatus` reader.
 */
export function checkRepoRecords(root, docStatus) {
  const { researchFiles, researchIndex, projects, projectsIndex } = readRepoRecords(root, docStatus);
  return [
    ...checkResearchIndex(researchFiles, researchIndex),
    ...checkPhaseStatuses(projects),
    ...checkFrontMatterVsPhases(projects),
    ...checkProjectsIndex(projects, projectsIndex),
  ];
}
