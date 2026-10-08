#!/usr/bin/env node
/**
 * **The roadmap, derived.**
 *
 * It used to be written: `docs/projects/README.md` carried a "where it stands"
 * column, research docs carried a `**Where this stands, …**` paragraph, and an
 * artifact outside the repo restated both. Three copies, kept in step by hand,
 * and the third went stale silently because nothing read it.
 *
 * `docs/research/2026-08-26-attaching-a-directory.md` is what that costs: on
 * the day this was written it held **two contradictory verdicts, both dated
 * the same day** — "not built" at the top and "1, 2 and 3 are built" in the
 * middle. Neither was lying; one was just older, and nothing could tell.
 *
 * So status lives in the doc, in front matter, where it cannot drift from the
 * thing it describes — and this reads it. `docs/ROADMAP.md` is generated and
 * says so; editing it by hand is editing the wrong file.
 *
 *   node scripts/roadmap.mjs           # write docs/ROADMAP.md
 *   node scripts/roadmap.mjs --check   # fail if it is out of date, for CI
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
import { checkRepoRecords } from "./lib/records.mjs";

const repo = process.env.ISOCAN_REPO_ROOT ?? fileURLToPath(new URL("..", import.meta.url));

/** The roadmap's own canvas on isocan.io — the one the README and the guides link. */
const ROADMAP_CANVAS = "prj_OE-AuGl119";
const GITHUB_DOCS = "https://github.com/dglazkov/isocan/blob/main/docs/";

/**
 * **One reader, and now one process.**
 *
 * Front matter is read through core's `docStatus` so there is ONE reader: a
 * second little parser here is how the roadmap would come to disagree with the
 * thing it is a view of, which is the bug it exists to fix. That has not
 * changed and must not.
 *
 * What changed is HOW it reaches that reader. It used to spawn the whole CLI
 * — `isocan --json doc status <file>` — once per document, and the CLI
 * registers tsx and transpiles 11,800 lines of `main.ts` plus core, api and
 * server on every spawn. Measured 6 Sep 2026: 571ms a spawn, 62 documents,
 * ~35 seconds, which was `roadmap.test.ts` being the slowest test in the suite
 * by an order of magnitude and paid on every run.
 *
 * So this registers tsx ONCE and imports the same function the CLI would have
 * called. One reader still, because the reader was never the CLI — it was
 * `docStatus`, and this calls it directly rather than through eleven thousand
 * lines of command definitions that have nothing to do with front matter.
 */
register();
registerLoader("../packages/cli/bin/workspace-loader.mjs", import.meta.url);
const { docStatus, statusProblems, verifyStatus, verifyProblems, parseFinding, projectCounts, loopSummary } = await import("@isocan/core");

function statusOf(file) {
  const status = docStatus(readFileSync(path.join(repo, file), "utf8"));
  return { ...status, problems: statusProblems(status) };
}

const ORDER = ["journey.md", "design.md", "plan.md", "phases.md"];

/**
 * The link a row carries must resolve from WHERE THE LINK LIVES — this page is
 * `docs/ROADMAP.md`, so `docs/research/x.md` is the one path that cannot work:
 * it sends the reader to `docs/docs/research/x.md`. Every other doc in this
 * directory (`architecture.md`, `decisions.md`) already writes `research/…` and
 * `projects/…`, which is the same file this reads, one directory up.
 */
const href = (rel) => rel.replace(/^docs\//, "");

function collect() {
  const docs = [];
  const rdir = path.join(repo, "docs/research");
  for (const name of readdirSync(rdir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
    const rel = `docs/research/${name}`;
    docs.push({ kind: "research", rel, title: titleOf(path.join(repo, rel)), ...statusOf(rel) });
  }
  const pdir = path.join(repo, "docs/projects");
  for (const name of readdirSync(pdir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const primary = ORDER.find((f) => existsSync(path.join(pdir, name, f)));
    if (!primary) continue;
    const rel = `docs/projects/${name}/${primary}`;
    docs.push({ kind: "project", rel, title: name, ...statusOf(rel) });
  }
  return docs;
}

/** The first heading, which is the doc's own name for itself. */
function titleOf(file) {
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("# "));
  return line ? line.slice(2).trim() : path.basename(file);
}

/**
 * **What needs a person**, from `docs/verify/` — each walk's own front matter,
 * through core's `verifyStatus`. It opens the page because it is the one list
 * here that no commit can shorten: everything else on the roadmap is waiting
 * on somebody building, and this is waiting on somebody *using*. A walk with
 * front matter that says too little to start from fails `--check`, the way a
 * stale roadmap does — a person handed a walk should not have to guess.
 */
function walks() {
  const vdir = path.join(repo, "docs/verify");
  return readdirSync(vdir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((name) => {
      const rel = `docs/verify/${name}`;
      const walk = verifyStatus(readFileSync(path.join(repo, rel), "utf8"));
      return { rel, title: titleOf(path.join(repo, rel)), ...walk, problems: verifyProblems(walk) };
    });
}

/**
 * **Loop's findings, counted against the projects they belong to.** They live in
 * `docs/loop/`, one file each, and are read through core like every other doc
 * here. A project row says how many are waiting on a decision and how many are
 * accepted as its work, so the one page that says where things stand says this
 * too, and it cannot disagree with `docs/LOOP.md` because both are derived.
 */
function loopFindings() {
  const dir = path.join(repo, "docs/loop");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .sort()
    .map((n) => parseFinding(readFileSync(path.join(dir, n), "utf8"), n.replace(/\.md$/, "")));
}
const findings = loopFindings();
const perProject = projectCounts(findings);
const loopNote = (d) => {
  const c = d.kind === "project" ? perProject.get(d.title) : undefined;
  if (!c) return "";
  const parts = [c.proposed && `${c.proposed} to decide`, c.accepted && `${c.accepted} accepted`].filter(Boolean);
  return parts.length ? ` · Loop: [${parts.join(", ")}](LOOP.md)` : "";
};

const docs = collect();
const queue = walks();
const owed = queue.filter((w) => w.status !== "works");
const done = queue.filter((w) => w.status === "works");
const byState = {};
for (const d of docs) (byState[d.status] ??= []).push(d);
const count = (s) => (byState[s] ?? []).length;
const left = count("open") + count("designed") + count("partial") + count("blocked");

const LABEL = {
  built: "Built",
  noted: "Noted — read, owing nothing",
  partial: "Partly built",
  designed: "Designed, not built",
  blocked: "Blocked",
  open: "No verdict recorded",
  superseded: "Superseded",
};

const lines = [
  "<!-- Generated by scripts/roadmap.mjs. Do not edit — edit the front matter",
  "     of the document itself, which is where its status lives. -->",
  "# Roadmap",
  "",
  "Every research note and every project, by where it stands. **Derived**: the",
  "status of a thing lives in that thing's front matter, so it cannot drift from",
  "what it describes. Run `node scripts/roadmap.mjs` after changing one.",
  "",
  "The same board lives on a canvas, [\\[isocan\\] Roadmap](https://isocan.io/p/prj_OE-AuGl119),",
  "open to anyone with the address. It is this page, published by",
  "`node scripts/roadmap.mjs --publish` from the post-commit hook on any machine",
  "that opted in with `.isocan/roadmap.json`; a publish that fails never fails a",
  "commit or a build, and says so in `.isocan/roadmap.log`.",
  "",
  `**${count("built")} built · ${left} still open** — of which ${count("partial")} partly`,
  `built, ${count("designed")} designed, ${count("blocked")} blocked, and`,
  `**${count("open")} with no verdict recorded at all**, which is the number worth`,
  "watching: an untriaged doc is not a doc nobody needs, it is a doc nobody has",
  "read lately.",
  "",
  `${count("noted")} more are \`noted\` — read, absorbed, owing nothing — and`,
  `${count("superseded")} superseded. Neither counts as done: reading is not building,`,
  "and the done column should not be flattered by either.",
  "",
  ...(findings.length
    ? [
        `**[Loop findings](LOOP.md): ${loopSummary(findings)}.** Stitch Loop mines the code; a`,
        "finding is its claim, checked against the code, ranked by us. Each project row",
        "below counts the findings that name it.",
        "",
      ]
    : []),
];

/*
 * Four columns, like every other table here, so the board on the canvas
 * (`scripts/canvas-board.mjs`) reads this section with the parser it already
 * has. Broken first — a walk that found a bug outranks one nobody has run.
 */
lines.push(
  `## What needs a person <sub>${owed.length}</sub>`,
  "",
  "Built and shipped, and never once exercised by a human being — the part no",
  "commit can do. Each is a walk in [`verify/`](verify/README.md), written by",
  "whoever built the thing for somebody who knows nothing about it.",
  ...(done.length ? [`${done.length} more ${done.length === 1 ? "has" : "have"} been walked and worked.`] : []),
  "",
  "| | What has never been exercised | Since | What you need |",
  "| --- | --- | --- | --- |",
);
for (const w of [...owed].sort((a, b) => (a.status === b.status ? a.rel.localeCompare(b.rel) : a.status === "broken" ? -1 : 1))) {
  const issue = w.issue ? ` · [#${w.issue}](https://github.com/dglazkov/isocan/issues/${w.issue})` : "";
  lines.push(`| **${w.status}** | [${w.title}](${href(w.rel)}) — ${w.never ?? ""} | ${w.since ?? "—"} | ${w.needs ?? ""}${issue} |`);
}
lines.push("");

for (const state of ["blocked", "partial", "designed", "open", "built", "noted", "superseded"]) {
  const group = byState[state];
  if (!group || group.length === 0) continue;
  lines.push(`## ${LABEL[state]} <sub>${group.length}</sub>`, "");
  lines.push("| | What | Since | |", "| --- | --- | --- | --- |");
  for (const d of group.sort((a, b) => a.title.localeCompare(b.title))) {
    const why = d.blockedBy ? `blocked by ${d.blockedBy}` : (d.note ?? "");
    const see = d.see.length ? ` · see ${d.see.join(", ")}` : "";
    // The issue that follows the work, when the doc names one. A link, so the
    // roadmap is one click from where the work actually moves.
    const issue = d.issue ? ` · [#${d.issue}](https://github.com/dglazkov/isocan/issues/${d.issue})` : "";
    lines.push(
      `| ${d.kind === "project" ? "**project**" : "research"} | [${d.title}](${href(d.rel)}) | ${d.since ?? "—"} | ${why}${see}${issue}${loopNote(d)} |`,
    );
  }
  lines.push("");
}

const page = lines.join("\n");
const out = path.join(repo, "docs/ROADMAP.md");

const vague = queue.filter((w) => w.problems.length);
if (vague.length) {
  for (const w of vague) console.error(`${w.rel}: ${w.problems.join("; ")}`);
  process.exit(1);
}

const recordProblems = checkRepoRecords(repo, docStatus);
if (recordProblems.length) {
  for (const p of recordProblems) console.error(p.detail);
  process.exit(1);
}

if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== page) {
    console.error("docs/ROADMAP.md is out of date — run `node scripts/roadmap.mjs`");
    process.exit(1);
  }
  console.log("docs/ROADMAP.md is current");
  process.exit(0);
}

writeFileSync(out, page);
console.log(`docs/ROADMAP.md — ${docs.length} docs, ${count("built")} built, ${left} open, ${owed.length} need a person`);

if (process.argv.includes("--publish")) {
  // One line a person can act on, not a stack: this is what `.isocan/roadmap.log` shows.
  await publishToCanvas(page).catch((err) => {
    console.error(`roadmap card not published: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

/**
 * **The canvas copy, generated like the file** (7 Oct 2026). The roadmap's
 * canvas, [isocan] Roadmap, was a hand-kept copy that said it "should say
 * what `main` says" with nothing making it — the same second copy this
 * script was written to end. `--publish` puts this page on that canvas as one
 * card, edited in place and left alone when unchanged (`scripts/lib/panel.mjs`,
 * the board's own mechanism), as the Board actor.
 *
 * **It can never make the build red.** It runs only when asked: from the
 * post-commit hook on a machine that opted in (`.isocan/roadmap.json`), which
 * exits 0 whatever happens, or by hand. `--check`, the tests and CI never
 * reach it — CI cannot reach a canvas anyway — so an unreachable home or a
 * canvas somebody else changed costs a line in `.isocan/roadmap.log`, not a
 * red tick.
 *
 *   node scripts/roadmap.mjs --publish                 # write the file, then the card
 *   node scripts/roadmap.mjs --publish --dry-run       # write the card to a temp file only
 *   node scripts/roadmap.mjs --publish --canvas prj_…  # another canvas (default: the roadmap's)
 *   node scripts/roadmap.mjs --publish --as-me         # as you, not as Board
 */
async function publishToCanvas(markdown) {
  const argv = process.argv;
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const target =
    arg("--canvas") ??
    process.env.ISOCAN_ROADMAP_CANVAS ??
    (() => {
      const f = path.join(repo, ".isocan", "roadmap.json");
      return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).canvas : undefined;
    })() ??
    ROADMAP_CANVAS;
  const card = canvasCard(markdown, execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim());
  const { panelPublisher } = await import("./lib/panel.mjs");
  if (argv.includes("--dry-run")) {
    const dir = mkdtempSync(path.join(tmpdir(), "isocan-roadmap-"));
    const { publish } = await panelPublisher({ canvas: null, dryDir: dir, key: "roadmap" });
    await publish("roadmap", "Roadmap", card, null, { mime: "text/markdown", ext: "md" });
    return;
  }
  const { connect } = await import("@isocan/api");
  const { BOARD_IDENTITY } = await import("./board-identity.mjs");
  const home = await connect(argv.includes("--as-me") ? {} : { identity: BOARD_IDENTITY });
  const canvas = await home.canvas(target);
  const { publish, changed } = await panelPublisher({ canvas, keepVersions: 30, key: "roadmap" });
  await publish("roadmap", "Roadmap", card, null, { mime: "text/markdown", ext: "md" });
  console.log(changed.length ? `roadmap card ${changed[0].what} on ${target}` : `roadmap card unchanged on ${target}`);
}

/**
 * The page as a card reads it: the generator's HTML comment becomes a line
 * saying where it came from, and every relative link — written to resolve
 * from `docs/` — points at the file on GitHub, because on a canvas there is
 * no `docs/` to resolve from.
 */
function canvasCard(markdown, sha) {
  const body = markdown
    .replace(/^<!--[\s\S]*?-->\n/, "")
    .replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, rel) => `](${GITHUB_DOCS}${rel})`);
  return (
    `> Generated from \`main\` at [\`${sha}\`](https://github.com/dglazkov/isocan/commit/${sha}) by ` +
    "`scripts/roadmap.mjs --publish`. Edit a document's front matter, not this card.\n\n" +
    body
  );
}
