#!/usr/bin/env node
/**
 * **A persona run: take its numbers, write them down, change nothing else.**
 *
 * Step 4 of `docs/projects/personas/design.md`, which is the night shift's
 * step 2 — *"one agent, one canvas, posts one summary. No changes at all.
 * Proves the ritual before trusting it with work."*
 *
 *   node scripts/persona-run.mjs design-auditor
 *   node scripts/persona-run.mjs --all
 *
 * **It may not touch the persona.** Not a nicety: a persona's goal is the line
 * it is judged against, and a runner that can edit its own goal is a runner
 * that can pass by lowering the bar. Nothing here writes to `.agents/`, and a
 * test asserts it. Baselines move when a PERSON moves them.
 *
 * **A missed goal is news, not a build break.** The page is the report, and a
 * run that goes red every morning trains everybody to stop looking. This exits
 * non-zero for exactly one reason: an instrument that would not run — because
 * a number nobody could take is the one thing a page must not report as fine.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * **The personas are read through the CLI, not parsed again here.**
 *
 * `@isocan/core` is TypeScript and this is a plain script, so the tempting
 * shortcut is a second little front-matter reader — which is exactly the thing
 * the whole design forbids: one persona would then say two things depending on
 * who asked. `isocan --json persona show` IS core's parse, so this script and
 * `isocan persona ls` and the app's panel cannot disagree.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** The day in the timezone the people are in, not the runner's. */
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const day = arg("--day") ?? today();
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: repo, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

const PERSONA_DIR = ".agents/personas";
const cli = path.join(repo, "packages/cli/bin/isocan.js");

function personas() {
  const out = execSync(`node ${JSON.stringify(cli)} --json persona ls`, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out);
}

/**
 * Run one goal's command and read the number off stdout.
 *
 * A command that fails, or prints something that is not a number, is a BROKEN
 * INSTRUMENT and says so — it is never read as zero. That distinction is the
 * whole of this file's honesty: "0 contrast failures" and "nothing could be
 * measured" look identical in a report that does not separate them, and this
 * week produced three instruments that reported the first while meaning the
 * second.
 */
function take(goal) {
  let out;
  try {
    out = execSync(goal.measuredBy, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return { broken: `the command failed: ${String(err.stderr ?? err.message).trim().slice(0, 200)}` };
  }
  const value = Number(out.trim().split(/\s+/).pop());
  if (!Number.isFinite(value)) {
    return { broken: `expected a number on stdout, got ${JSON.stringify(out.trim().slice(0, 80))}` };
  }
  return { value };
}

const met = (goal, value) =>
  goal.bound.kind === "at most" ? value <= goal.bound.value : value >= goal.bound.value;

function runOne(persona) {
  const readings = persona.goals.map((goal) => ({ goal, ...take(goal) }));
  const broken = readings.filter((r) => r.broken);
  const missed = readings.filter((r) => !r.broken && !met(r.goal, r.value));
  const lines = [`# ${persona.name} — ${day}`, ""];
  lines.push(`Run by \`scripts/persona-run.mjs\` at \`${commit}\`. **Nothing was changed.**`, "");

  if (persona.goals.length === 0) {
    lines.push(
      "**This persona has no goal**, so a run cannot say whether anything got better",
      "or worse. It reports prose or it reports nothing, and a page of prose written",
      "by a schedule is the thing the night shift's budget rule exists to prevent.",
      "",
      "Give it a number, or take it off the schedule.",
      "",
    );
  } else {
    lines.push("| Goal | Target | Now | Verdict |", "| --- | --- | --- | --- |");
    for (const r of readings) {
      const unit = r.goal.unit ?? "";
      const target = `${r.goal.bound.kind} ${r.goal.bound.value}${unit}`;
      if (r.broken) {
        lines.push(`| ${r.goal.name} | ${target} | — | **instrument broken** |`);
      } else {
        const ok = met(r.goal, r.value);
        // Against the BASELINE as well as the bound: a number inside its bound
        // that moved the wrong way is the thing a pass/fail column hides.
        const was = r.goal.baseline?.value;
        const drift =
          was === undefined || was === r.value
            ? ""
            : ` (was ${was}${unit} on ${r.goal.baseline.at})`;
        lines.push(`| ${r.goal.name} | ${target} | ${r.value}${unit}${drift} | ${ok ? "held" : "**MISSED**"} |`);
      }
    }
    lines.push("");
    for (const r of broken) lines.push(`- \`${r.goal.measuredBy}\` — ${r.broken}`);
    if (broken.length) lines.push("");
  }

  /**
   * **The outcome column, empty on purpose** — step 5 of the design, and it is
   * deliberately not a score. An accept rate over five findings is noise, and a
   * trust score that governs autonomy before it means anything is a way to lose
   * trust in trust. Record the outcomes from the first run; compute nothing
   * from them until there are enough to argue about.
   */
  lines.push(
    "## Findings",
    "",
    "| Finding | Outcome |",
    "| --- | --- |",
    ...(missed.length
      ? missed.map((r) => `| ${r.goal.name} is ${r.value}${r.goal.unit ?? ""}, past ${r.goal.bound.value}${r.goal.unit ?? ""} | unanswered |`)
      : ["| — | — |"]),
    "",
    "`unanswered` until somebody writes `accepted` or `rejected`. Nothing counts",
    "them yet, and nothing should until there are enough to mean something.",
    "",
    "---",
    "",
    `Read \`${persona.runs ?? "docs/reviews/"}README.md\` before the next run: a finding that keeps`,
    "reappearing is a finding that needs a guard, not a third mention.",
    "",
  );

  const dir = path.join(repo, persona.runs ?? "docs/reviews/");
  mkdirSync(dir, { recursive: true });
  const page = path.join(dir, `${day}-${persona.name}.md`);
  writeFileSync(page, lines.join("\n"));
  return { persona, page: path.relative(repo, page), broken: broken.length, missed: missed.length };
}

/** Every persona file's bytes, so "did the run touch one" is answerable
 *  precisely rather than by asking git what is dirty. */
function snapshotPersonas() {
  const dir = path.join(repo, PERSONA_DIR);
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    out.set(file, readFileSync(path.join(dir, file), "utf8"));
  }
  return out;
}
const before = snapshotPersonas();

const all = personas();
const wanted = argv.includes("--all")
  ? all
  : all.filter((p) => p.name === argv.find((a) => !a.startsWith("--")));
if (wanted.length === 0) {
  console.error(
    `no such persona — there is ${all.map((p) => p.name).join(", ")} (or --all)`,
  );
  process.exit(2);
}

let brokenTotal = 0;
for (const persona of wanted) {
  const out = runOne(persona);
  brokenTotal += out.broken;
  console.log(
    `${out.page} — ${persona.goals.length} goal${persona.goals.length === 1 ? "" : "s"}, ` +
      `${out.missed} missed, ${out.broken} broken`,
  );
}
/**
 * **Belt: the runner leaves the personas exactly as it found them.**
 *
 * Compared against a snapshot taken before the run, NOT against `git status` —
 * which was the first version and could not tell "the runner changed this"
 * from "this was already edited". It accused the runner of a change somebody
 * else had made, on the first run that had a dirty tree, which is the same
 * shape as every other instrument that answered a question it had not asked.
 */
const after = snapshotPersonas();
const changed = [...after.keys()].filter((f) => after.get(f) !== before.get(f));
const vanished = [...before.keys()].filter((f) => !after.has(f));
if (changed.length || vanished.length) {
  console.error(
    "\nthe run modified a persona, which it must never do — a runner that can " +
      "edit its own goal can pass by lowering the bar:\n  " +
      [...changed, ...vanished.map((f) => `${f} (deleted)`)].join("\n  "),
  );
  process.exit(1);
}
process.exit(brokenTotal > 0 ? 1 : 0);
