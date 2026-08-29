#!/usr/bin/env node
/**
 * **The nightly grading run** — step 1 of the night shift
 * (`docs/research/2026-08-24-the-night-shift.md`), and the one everything else
 * there waits on. It answers *is anything already broken* before anything
 * tries to fix it.
 *
 * It writes a dated page and **nothing else**. No canvas is written to, no
 * item is changed, no comment is posted. A grader that also repairs is a
 * grader whose readings you cannot trust, because it has an interest in what
 * it found.
 *
 *   node scripts/grade-night.mjs                 # the pages this repo ships
 *   node scripts/grade-night.mjs --canvases      # every screen in the isocan home
 *   node scripts/grade-night.mjs --day 2026-08-29
 *
 * **Two subjects, and only one of them can be reached from CI.** The screens
 * worth grading live on canvases, and canvases live in somebody's isocan home
 * on their own machine — a GitHub runner has none and never will. So the
 * scheduled run grades what a runner CAN reach honestly: the pages this
 * repository ships to people. `--canvases` is the same run pointed at the home,
 * for the machine where the work actually is. The page says which it graded,
 * because a report that does not name its subject is a number without a
 * question.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const grader = path.join(repo, "scripts", "grade.mjs");
const cli = path.join(repo, "packages/cli/bin/isocan.js");

/** The day in the timezone the people are in, not the one the runner is in —
 *  the same choice `changelog-day.mjs` makes, for the same reason. */
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

const day = arg("--day") ?? today();

/**
 * **The selftest is a gate, not a step.**
 *
 * Every check must fire on a page built to break all of them, and if any stays
 * silent the run reports NOTHING. A grader that reports zeros when it breaks is
 * worse than no grader because it is believed — and a nightly page full of
 * zeroes, arriving every morning, is that belief on a schedule.
 */
function gradersWork() {
  try {
    execFileSync("node", [grader, "--selftest"], { stdio: "inherit" });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function gradeFiles(files) {
  const out = [];
  for (const file of files) {
    const json = execFileSync("node", [grader, "--file", file, "--json"], { encoding: "utf8" });
    out.push(...JSON.parse(json));
  }
  return out;
}

function gradeCanvases() {
  const rows = JSON.parse(
    execFileSync("node", [cli, "--json", "canvas", "list", "--all"], { encoding: "utf8" }),
  );
  const out = [];
  for (const canvas of rows) {
    const json = execFileSync("node", [grader, "--project", canvas.id, "--json"], {
      encoding: "utf8",
    });
    for (const g of JSON.parse(json)) out.push({ ...g, canvas: canvas.title });
  }
  return out;
}

/**
 * The pages this repository actually ships to people.
 *
 * Not the fixtures — `deliberately-bad.html` exists to fail, and grading it
 * nightly would be a page of failures nobody should act on. And **not the
 * built app's `index.html`**, which was in this list for one run: opened as a
 * file it is an empty div and a script tag, React never runs, and it scored a
 * clean 8/8 for having nothing on it. A perfect score for a blank page is the
 * silent zero wearing a rosette.
 */
function shipped() {
  return [path.join(repo, "docs/index.html")].filter((p) => existsSync(p));
}

// The check names come from the grader's own output rather than a list kept
// here: a check added there and forgotten here would be a column that quietly
// stopped existing.
function checksOf(graded) {
  const names = new Set();
  for (const g of graded) for (const name of Object.keys(g.checks ?? {})) names.add(name);
  return [...names];
}

const broken = gradersWork();
const subject = argv.includes("--canvases") ? "canvases" : "shipped";
let graded = [];
if (!broken) graded = subject === "canvases" ? gradeCanvases() : gradeFiles(shipped());

const failing = graded.flatMap((g) =>
  Object.entries(g.checks ?? {})
    .filter(([, ok]) => !ok)
    .map(([name]) => ({ file: g.file, canvas: g.canvas, name })),
);

const dir = path.join(repo, "docs/grades");
mkdirSync(dir, { recursive: true });
const page = path.join(dir, `${day}.md`);

const lines = [`# Grades — ${day}`, ""];
if (broken) {
  lines.push(
    "**The graders did not pass their own selftest, so nothing was graded.**",
    "",
    "A grader that reports zeros when it breaks is worse than no grader,",
    "because it is believed. Fix `scripts/grade.mjs` before reading anything",
    "into a quiet morning.",
    "",
    "```",
    broken,
    "```",
    "",
  );
} else {
  lines.push(
    subject === "canvases"
      ? `Every HTML item on every canvas in this home: **${graded.length} graded**.`
      : `The pages this repository ships: **${graded.length} graded**.`,
    "",
    `**${failing.length} failing checks** across ${checksOf(graded).length} checks per page.`,
    "",
  );
  if (graded.length === 0) {
    lines.push("Nothing to grade — no HTML pages were found.", "");
  } else {
    lines.push("| Page | Checks passing | Failing |", "| --- | --- | --- |");
    for (const g of graded) {
      const entries = Object.entries(g.checks ?? {});
      const passing = entries.filter(([, ok]) => ok).length;
      const failed = entries.filter(([, ok]) => !ok).map(([name]) => name);
      const name = g.canvas ? `${g.canvas} · ${path.basename(g.file)}` : path.relative(repo, g.file);
      lines.push(`| ${name} | ${passing}/${entries.length} | ${failed.join(", ") || "—"} |`);
    }
    lines.push("");
  }
  // The detail behind the counts, because a count is not actionable and this
  // page exists to be acted on.
  for (const g of graded) {
    const worst = g.worstContrast ?? [];
    const stretched = g.stretchedDetail ?? [];
    const small = g.smallTargetDetail ?? [];
    if (worst.length === 0 && stretched.length === 0 && small.length === 0 && (g.slop ?? []).length === 0) {
      continue;
    }
    lines.push(`## ${g.canvas ? `${g.canvas} · ` : ""}${path.basename(g.file)}`, "");
    for (const f of worst) lines.push(`- contrast ${f.ratio} (needs ${f.need}) — "${f.text}"`);
    for (const st of stretched) {
      lines.push(`- stretched \`${st.src}\` — natural ${st.natural}, rendered ${st.rendered}`);
    }
    for (const t of small) lines.push(`- target ${t.size} — \`${t.where}\` "${t.text}"`);
    for (const tell of g.slop ?? []) lines.push(`- tell: ${tell}`);
    lines.push("");
  }
}
lines.push(
  "---",
  "",
  "Written by `scripts/grade-night.mjs`. Deterministic: every check here is",
  "reproducible, costs nothing per run, and cannot drift. **Nothing was",
  "written to any canvas.**",
  "",
);

writeFileSync(page, lines.join("\n"));
console.log(path.relative(repo, page));
// The day is the workflow's to name; the exit code is not a verdict on the
// pages. A failing check is news, not a build break — the page IS the report.
process.exit(broken ? 1 : 0);
