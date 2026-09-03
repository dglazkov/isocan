#!/usr/bin/env node
/**
 * **Golden tasks** — Stage 3 of `docs/projects/evals/plan.md`.
 *
 * Twenty tasks in `evals/golden/v1/`, weighted by what people actually ask
 * agents for (the Stage 1 note): revise first, then create, then restyle and
 * repair. Each is a synthetic starting screen, an ask in plain words, and
 * checks a machine can make. This file runs the checks:
 *
 *   node scripts/golden.mjs --list
 *   node scripts/golden.mjs --task revise-heading --file out.html
 *   node scripts/golden.mjs --dir runs/2026-09-03          # <dir>/<task id>.html|.md
 *   node scripts/golden.mjs --selftest [--no-browser]
 *
 * The file checks live in `lib/golden.mjs`; the screen checks are
 * `grade.mjs`'s, asked for by name, so a task never re-derives contrast or
 * sideways scroll. Counts and pass/fail, never a weighted score — the same
 * rule as the grader, for the same reason.
 *
 * **`--selftest` is the suite's own test, and it runs both directions.** For
 * every task the reference answer must pass every check and the untouched
 * fixture must fail at least one. A task whose fixture passes is not asking
 * for anything; a task whose answer fails is asking for something its own
 * author could not do. Either is a broken instrument, and lesson #8 says
 * what a broken instrument that keeps reporting is worth.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileChecks, loadSuite, repo, screenChecksOf } from "./lib/golden.mjs";

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const asJson = argv.includes("--json");
const noBrowser = argv.includes("--no-browser");
const grader = path.join(repo, "scripts", "grade.mjs");

const suite = loadSuite();

/** grade.mjs's verdicts for one file, by check name. */
function screen(file) {
  const out = execFileSync("node", [grader, "--file", file, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
  const graded = JSON.parse(out)[0];
  return { checks: graded.checks, detail: graded };
}

/** Every check of a task against one output file → rows of { name, ok, why }. */
function gradeOutput(task, file, browser = !noBrowser) {
  const output = readFileSync(file, "utf8");
  const fixture = readFileSync(task.fixturePath, "utf8");
  const rows = fileChecks(task, output, fixture);
  const wanted = screenChecksOf(task);
  if (wanted.length && task.type !== "markdown") {
    if (!browser) rows.push(...wanted.map((name) => ({ name: `screen: ${name}`, ok: null, why: "not run (--no-browser)" })));
    else {
      const { checks, detail } = screen(file);
      for (const name of wanted) {
        if (!(name in checks)) throw new Error(`golden: ${task.id} asks grade.mjs for a check it does not have: ${name}`);
        const why = !checks[name]
          ? name === "no contrast failures" ? (detail.worstContrast ?? []).slice(0, 2).map((c) => `${c.ratio} "${c.text}"`).join("; ")
          : name === "no sideways scroll" ? `at ${detail.sidewaysAt.join(", ")}`
          : name === "renders" ? (detail.pageErrors ?? []).join(" | ")
          : ""
          : "";
        rows.push({ name: `screen: ${name}`, ok: checks[name], why });
      }
    }
  }
  return rows;
}

const passed = (rows) => rows.every((r) => r.ok !== false);
const pad = (s, n) => String(s).padEnd(n);

function print(task, file, rows) {
  const n = rows.filter((r) => r.ok === true).length, of = rows.filter((r) => r.ok !== null).length;
  console.log(`\n${task.id}  (${task.kind})  ${path.relative(process.cwd(), file)}  —  ${n}/${of}${passed(rows) ? "  PASS" : "  FAIL"}`);
  for (const r of rows) console.log(`  ${r.ok === null ? "skip" : r.ok ? "ok  " : "FAIL"} ${r.name}${r.why ? `  — ${r.why}` : ""}`);
}

// ---- entry ----

if (argv.includes("--list")) {
  console.log(`golden v${suite.version} — ${suite.tasks.length} tasks`);
  for (const t of suite.tasks) console.log(`  ${pad(t.id, 24)} ${pad(t.kind, 12)} ${t.ask}`);
  process.exit(0);
}

if (argv.includes("--selftest")) {
  const problems = [];
  const results = [];
  for (const task of suite.tasks) {
    const answer = gradeOutput(task, task.answerPath);
    const fixture = gradeOutput(task, task.fixturePath);
    const answerOk = passed(answer);
    const fixtureFails = fixture.some((r) => r.ok === false);
    results.push({ id: task.id, answerOk, fixtureFails });
    if (!answerOk) problems.push(`${task.id}: the reference answer fails ${answer.filter((r) => r.ok === false).map((r) => r.name).join(", ")}`);
    if (!fixtureFails) problems.push(`${task.id}: the untouched fixture passes every check — the task asks for nothing`);
    if (!asJson) console.log(`  ${answerOk ? "ok  " : "FAIL"} answer passes   ${fixtureFails ? "ok  " : "FAIL"} fixture fails   ${task.id}`);
  }
  if (asJson) console.log(JSON.stringify({ version: suite.version, results, problems }, null, 2));
  if (problems.length) { console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`); process.exit(1); }
  console.log(`\nall ${suite.tasks.length} tasks measure something${noBrowser ? " (file checks only — screen checks skipped)" : ""}`);
  process.exit(0);
}

const one = arg("--task");
const file = arg("--file");
const dir = arg("--dir");
let runs = [];
if (one && file) {
  const task = suite.tasks.find((t) => t.id === one);
  if (!task) { console.error(`no task ${one} — --list names them`); process.exit(2); }
  runs = [[task, file]];
} else if (dir) {
  for (const task of suite.tasks) {
    const ext = task.type === "markdown" ? ".md" : ".html";
    const f = path.join(dir, `${task.id}${ext}`);
    if (existsSync(f)) runs.push([task, f]);
  }
  if (runs.length === 0) { console.error(`${dir}: nothing named after a task (<id>.html or <id>.md)`); process.exit(2); }
} else {
  console.error("usage: golden.mjs --list | --task <id> --file <path> | --dir <dir> | --selftest [--no-browser] [--json]");
  process.exit(2);
}

const graded = runs.map(([task, f]) => ({ task: task.id, kind: task.kind, file: f, rows: gradeOutput(task, f) }));
if (asJson) console.log(JSON.stringify({ version: suite.version, graded: graded.map((g) => ({ ...g, pass: passed(g.rows) })) }, null, 2));
else {
  for (const g of graded) print(suite.tasks.find((t) => t.id === g.task), g.file, g.rows);
  const failing = graded.filter((g) => !passed(g.rows)).length;
  console.log(`\n${graded.length} graded, ${failing} failing`);
}
process.exit(graded.some((g) => !passed(g.rows)) ? 1 : 0);
