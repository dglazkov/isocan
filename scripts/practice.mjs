#!/usr/bin/env node
/**
 * **The practice page** — one deterministic page a night that reads every
 * instrument this repo keeps and counts where they leak
 * (`docs/projects/practice/design.md`, "Where it leaks").
 *
 *   node scripts/practice.mjs                    # write docs/practice/<today>.md
 *   node scripts/practice.mjs --json             # the numbers, as JSON (still writes the page)
 *   node scripts/practice.mjs --offline          # skip GitHub: no issues rows, no Actions rows
 *   node scripts/practice.mjs --day 2026-10-02   # the page for that day
 *   node scripts/practice.mjs --no-write         # compute and print, write nothing
 *
 * This file GATHERS — the tree, git, `gh`, `measure.mjs` — and
 * `scripts/lib/practice.mjs` decides, from plain inputs, so every check is
 * tested against a fixture rather than against this repository on the day
 * the test ran. No model, nothing written to a canvas, nothing written
 * outside `docs/practice/`. Every number goes into the page's front matter,
 * which is how tomorrow's page reads it back as *was*.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
import { CEILING } from "./bundle-ceiling.mjs";
import { isAnswered, reviewPages } from "./reviews.mjs";
import { assemble, ceilingIn, renderPage, sortRows, summary, severity, worsened } from "./lib/practice.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));

// Front matter through core's one reader, the way roadmap.mjs reaches it.
register();
registerLoader("../packages/cli/bin/workspace-loader.mjs", import.meta.url);
const { docStatus, verifyStatus, parseFinding, splitFrontMatter, frontMatterFields } = await import("@isocan/core");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const offline = argv.includes("--offline");

/** The day where the people are, as `grade-night.mjs` and the changelog choose it. */
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const day = arg("--day") ?? today();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error(`not a date: ${day}`);
  process.exit(2);
}

const read = (rel) => readFileSync(path.join(repo, rel), "utf8");
const ls = (rel) => (existsSync(path.join(repo, rel)) ? readdirSync(path.join(repo, rel)) : []);
const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
const git = (...args) => run("git", args).trimEnd();
const gh = (...args) => JSON.parse(run("gh", args));

// ── records ──────────────────────────────────────────────────────────────

const ORDER = ["journey.md", "design.md", "plan.md", "phases.md"];
const projects = [];
for (const name of ls("docs/projects").sort()) {
  const dir = `docs/projects/${name}`;
  const primary = ORDER.find((f) => existsSync(path.join(repo, dir, f)));
  if (!primary) continue;
  const status = docStatus(read(`${dir}/${primary}`));
  const phasesRel = `${dir}/phases.md`;
  const hasPhases = existsSync(path.join(repo, phasesRel));
  projects.push({
    name,
    path: phasesRel,
    status: status.status,
    issue: status.issue,
    phases: hasPhases ? read(phasesRel) : "",
    touched: hasPhases ? git("log", "-1", "--format=%cs", "--", phasesRel) || null : null,
  });
}

const mainRef = (() => {
  try {
    git("rev-parse", "--verify", "--quiet", "main");
    return "main";
  } catch {
    return "HEAD";
  }
})();

/** Commits on main per Pacific day, for the 30 days the changelog row reads. */
function commitsByDay() {
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - 32 * 86_400_000).toISOString().slice(0, 10);
  const out = run("git", ["log", mainRef, "--no-merges", `--since=${since}`, "--format=%ad", "--date=format-local:%Y-%m-%d"], {
    TZ: "America/Los_Angeles",
  });
  const counts = new Map();
  for (const d of out.split("\n").filter(Boolean)) counts.set(d, (counts.get(d) ?? 0) + 1);
  return counts;
}

const changelogPages = new Map(
  ls("docs/changelog")
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .map((n) => [n.slice(0, 10), read(`docs/changelog/${n}`)]),
);

const records = {
  index: read("docs/projects/README.md"),
  statusByProject: new Map(projects.map((p) => [p.name, p.status])),
  phases: projects.filter((p) => p.phases).map((p) => ({ path: p.path, text: p.phases })),
  projects,
  researchNames: ls("docs/research").filter((n) => n.endsWith(".md")),
  researchReadme: read("docs/research/README.md"),
  commitsByDay: commitsByDay(),
  changelogPages,
};

// ── docs/ text, for which issues are named anywhere ──────────────────────

function markdownUnder(rel, skip) {
  const out = [];
  for (const entry of readdirSync(path.join(repo, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (skip.includes(child)) continue;
    if (entry.isDirectory()) out.push(...markdownUnder(child, skip));
    else if (entry.name.endsWith(".md")) out.push(read(child));
  }
  return out;
}
// This page names issues itself; reading it back would make every issue it
// lists as unnamed named by tomorrow.
const docTexts = markdownUnder("docs", ["docs/practice"]);

// ── GitHub ───────────────────────────────────────────────────────────────

let issues = null;
let issuesWhy;
let runs = null;
let runsWhy;
if (!offline) {
  try {
    issues = {
      open: gh("issue", "list", "--state", "open", "--limit", "1000", "--json", "number,title,labels,updatedAt"),
      prs: gh("pr", "list", "--state", "open", "--limit", "200", "--json", "number,title,createdAt,headRefName"),
      milestones: Number(run("gh", ["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100", "--jq", "length"]).trim()),
    };
  } catch (err) {
    issuesWhy = `\`gh\` could not answer: ${String(err.stderr || err.message).split("\n")[0]}`;
  }
  try {
    runs = gh("run", "list", "--workflow", "release.yml", "--branch", "main", "--status", "completed", "--limit", "40",
      "--json", "conclusion,startedAt,updatedAt,createdAt,displayTitle,databaseId,url");
  } catch (err) {
    runsWhy = `\`gh\` could not answer: ${String(err.stderr || err.message).split("\n")[0]}`;
  }
}

// ── queues ───────────────────────────────────────────────────────────────

const walks = ls("docs/verify")
  .filter((n) => n.endsWith(".md") && n !== "README.md")
  .map((n) => ({ path: `docs/verify/${n}`, ...verifyStatus(read(`docs/verify/${n}`)) }));

const findings = ls("docs/loop")
  .filter((n) => n.endsWith(".md") && n !== "README.md")
  .map((n) => {
    const rel = `docs/loop/${n}`;
    const f = parseFinding(read(rel), n.replace(/\.md$/, ""));
    // An untriaged finding has no `since`; the day it was filed is the day git added it.
    const added = f.decision === "untriaged" ? git("log", "--diff-filter=A", "--format=%cs", "--", rel).split("\n").filter(Boolean).at(-1) ?? day : f.since;
    return { path: rel, decision: f.decision, added };
  });

const reviews = reviewPages().map((p) => ({ file: p.file, date: p.date, open: p.findings.filter((f) => !isAnswered(f.outcome)).length }));

// ── gates ────────────────────────────────────────────────────────────────

/** One metric, through measure.mjs, which is the command that takes it. */
function measure(name, names = false) {
  return run("node", ["scripts/measure.mjs", name, ...(names ? ["--names"] : [])]).trim();
}

function ratchet(key, label, metric, testFile) {
  const ceiling = ceilingIn(read(testFile));
  try {
    const value = Number(measure(metric));
    const offenders = measure(metric, true)
      .split("\n")
      .filter(Boolean)
      .map((line) => ({ what: line.trim() }));
    if (ceiling === null) return { key, label, value: null, why: `no CEILING in ${testFile}` };
    return { key, label, value, ceiling, offenders };
  } catch (err) {
    return { key, label, value: null, why: `measure.mjs ${metric} would not run: ${String(err.message).split("\n")[0]}` };
  }
}

const bundle = (() => {
  try {
    return { bytes: Number(measure("bundle-bytes")), ceiling: CEILING };
  } catch {
    return { bytes: null, why: "no built packages/web/dist — `npm run build` first" };
  }
})();

const gates = {
  ratchets: [
    ratchet("unused-exports", "unused exports vs ceiling", "unused-exports", "test/unused-exports.test.ts"),
    ratchet("undocumented-exports", "undocumented exports vs ceiling", "undocumented-exports", "test/undocumented-exports.test.ts"),
  ],
  bundle,
  untracked: git("ls-files", "--others", "--exclude-standard", "--", "packages").split("\n").filter(Boolean),
  deep: { switchesText: read("scripts/switches.mjs"), agentsText: read("AGENTS.md"), deepSource: read("test/deep.ts") },
};

// ── instruments ──────────────────────────────────────────────────────────

const personas = ls(".agents/personas")
  .filter((n) => n.endsWith(".md"))
  .map((n) => ({ path: `.agents/personas/${n}`, front: splitFrontMatter(read(`.agents/personas/${n}`))?.front ?? "" }));
const gradeDays = ls("docs/grades").filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n)).sort();
const latestGrade = gradeDays.length ? { path: `docs/grades/${gradeDays.at(-1)}`, text: read(`docs/grades/${gradeDays.at(-1)}`) } : null;
const instruments = {
  personas,
  latestGrade,
  oneShots: ["docs/lift", "docs/calibration", "docs/converge"].map((what) => ({ what, names: ls(what) })),
};

// ── build loop ───────────────────────────────────────────────────────────

const fortnight = new Date(Date.parse(`${day}T00:00:00Z`) - 14 * 86_400_000).toISOString().slice(0, 10);
const commits = git("log", mainRef, "--no-merges", `--since=${fortnight}`, "--format=%H%x09%s")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [sha, ...rest] = line.split("\t");
    return { sha, subject: rest.join("\t") };
  });

// ── was ──────────────────────────────────────────────────────────────────

const earlier = ls("docs/practice")
  .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n) && n.slice(0, 10) < day)
  .sort();
const previous = earlier.at(-1)?.slice(0, 10) ?? null;
const was = previous ? frontMatterFields(splitFrontMatter(read(`docs/practice/${previous}.md`))?.front ?? "") : new Map();

const { rows, skipped } = assemble({
  day,
  records,
  docTexts,
  issues,
  issuesWhy,
  queues: { walks, findings, reviewPages: reviews },
  gates,
  instruments,
  build: { runs, runsWhy, commits },
  was,
});

const page = renderPage({ day, rows, previous, skipped });
if (!argv.includes("--no-write")) {
  mkdirSync(path.join(repo, "docs/practice"), { recursive: true });
  writeFileSync(path.join(repo, `docs/practice/${day}.md`), page);
}

if (argv.includes("--json")) {
  console.log(JSON.stringify({ ...summary(day, rows), previous, skipped }, null, 2));
} else {
  const leaks = rows.filter((r) => severity(r) > 0);
  console.log(`docs/practice/${day}.md — ${rows.length} rows, ${leaks.length} leaking, ${rows.filter(worsened).length} worse than ${previous ?? "(no earlier page)"}`);
  for (const s of skipped) console.log(`  not measured: ${s.group} — ${s.why}`);
  for (const r of sortRows(rows).filter((x) => severity(x) > 0).slice(0, 10)) {
    console.log(`  ${String(r.count).padStart(6)}  ${r.key}${r.was !== null && r.was !== undefined ? ` (was ${r.was})` : ""}`);
  }
}
