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
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The cheap tier's decisions — whether to pay for a model, what to ask it, what
// it cost, what goes to the expensive tier — live beside this as pure
// functions, so they are tested without a paid call.
import {
  escalation,
  machineIdle,
  readReport,
  readVerdicts,
  smallPassArgs,
  smallPassPrompt,
  smallPassWanted,
} from "./lib/persona-tier.mjs";
// The bound the report announces is the bound the guard enforces — imported
// rather than retyped, so a raised `ANSWER_DAYS` cannot leave every page
// promising the old number.
import { ANSWER_DAYS } from "./reviews.mjs";
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
  // `--root`: THIS checkout's personas, for the reason `scripts/ratchet.mjs`
  // gives — from a git worktree the binding hands back the MAIN checkout's
  // `.agents/personas`, and a run would take its numbers against somebody
  // else's bounds (and not see a persona added in the worktree at all).
  const out = execSync(`node ${JSON.stringify(cli)} --json persona --root ${JSON.stringify(repo)} ls`, {
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

/**
 * **What the number is measured against, when it is a debt rather than a size.**
 *
 * Read through the same `take`, so a goal's `against` is as honest as its
 * `measured by`: a command that will not run reports a BROKEN INSTRUMENT
 * rather than a missing basis, because a report that quietly drops which
 * ceiling it is 0-past is the report `scripts/reviews.mjs` could not tell
 * apart from the night before.
 */
function basisOf(goal) {
  if (!goal.against) return {};
  const got = take({ measuredBy: goal.against });
  return got.broken ? { broken: `\`${goal.against}\` — ${got.broken}` } : { basis: got.value };
}

const met = (goal, value) =>
  goal.bound.kind === "at most" ? value <= goal.bound.value : value >= goal.bound.value;

/**
 * **The offenders behind a missed number**, when its instrument can name them.
 *
 * `measure.mjs` metrics may declare `--names`; anything else has no second
 * half and the small pass gets the number alone. Capped, because a list the
 * model is handed is a list the budget pays to read.
 */
function namesOf(goal) {
  if (!/scripts\/measure\.mjs\s+\S+\s*$/.test(goal.measuredBy)) return [];
  try {
    return execSync(`${goal.measuredBy} --names`, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    return [];
  }
}

/**
 * **The small pass: one bounded call to the persona's own model.**
 *
 * Skipped — not failed — when the harness is not installed or there is no key,
 * because a machine that cannot call a model is not a small model that could
 * not do the job, and only the second is worth handing to anybody.
 */
function smallPass(persona, missed) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "no ANTHROPIC_API_KEY in the environment" };
  const bin = process.env.CLAUDE_BIN ?? "claude";
  const res = spawnSync(bin, smallPassArgs(persona, smallPassPrompt(persona, missed)), {
    cwd: repo,
    encoding: "utf8",
    timeout: 5 * 60_000,
    maxBuffer: 1 << 24,
    // Nested inside a Claude Code session (a person running this by hand from
    // one), the child would otherwise think it is that session.
    env: { ...process.env, CLAUDECODE: "" },
  });
  if (res.error?.code === "ENOENT") return { skipped: `\`${bin}\` is not installed here` };
  let report = null;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    report = null;
  }
  return readReport(report, persona.budget);
}

const money = (usd) => (usd === null ? "unknown" : `$${usd.toFixed(4)}`);

function runOne(persona) {
  const readings = persona.goals.map((goal) => {
    const reading = { goal, ...take(goal) };
    return reading.broken ? reading : { ...reading, ...basisOf(goal) };
  });
  const broken = readings.filter((r) => r.broken);
  const missed = readings.filter((r) => !r.broken && !met(r.goal, r.value));
  for (const r of missed) r.missed = true;

  // The cheap tier, when this persona is one: see `scripts/lib/persona-tier.mjs`.
  const tier = smallPassWanted(persona, readings);
  let pass = null;
  let handoff = null;
  if (tier.run) {
    for (const r of missed) r.names = namesOf(r.goal);
    pass = smallPass(persona, missed);
    if (!pass.skipped) handoff = escalation(persona, missed, pass);
  }

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
      // `at most 0 of 721200` — a bound of 0 on a DEBT says nothing about which
      // number the debt is against, and the whole reading is that number.
      const target =
        `${r.goal.bound.kind} ${r.goal.bound.value}${unit}` +
        (r.basis === undefined ? "" : ` of ${r.basis}${unit}`);
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
   * **The small pass, with what it cost beside what it was allowed.** Written
   * for every persona that declares a budget, including the nights it did not
   * run — "held, $0" is the cheap tier's best result and the one that shows
   * whether the tier is cheap at all.
   */
  if (persona.budget) {
    const allowed = [
      persona.budget.usdPerRun !== undefined ? `$${persona.budget.usdPerRun}` : null,
      persona.budget.turnsPerRun !== undefined ? `${persona.budget.turnsPerRun} turns` : null,
    ].filter(Boolean).join(", ");
    lines.push("## The small pass", "");
    if (!tier.run) {
      lines.push(`Not run: ${tier.why}. Spent $0 of ${allowed}.`, "");
    } else if (pass.skipped) {
      lines.push(`Not run: ${pass.skipped}. The finding below waits for a person as any other does.`, "");
    } else {
      lines.push(
        `\`${persona.model}\`${persona.effort ? ` at ${persona.effort}` : ""}` +
          `${pass.models.length ? ` (${pass.models.join(", ")})` : ""}: ` +
          `**${money(pass.usd)}** in ${pass.turns ?? "?"} turn${pass.turns === 1 ? "" : "s"}, of ${allowed}` +
          `${pass.overBudget ? " — **over budget**" : ""}.`,
        "",
      );
      const verdicts = readVerdicts(pass.text);
      if (verdicts.fixes.length) {
        lines.push("Proposed, not applied:", "");
        for (const f of verdicts.fixes) lines.push(`- ${f.what} ⇒ ${f.proposal}`);
        lines.push("");
      }
    }
  }

  /**
   * **The hand-off, on the page that made it.** The bold line is what
   * `escalatedTo` in core reads, so `isocan persona runs <target>` can show the
   * expensive persona what was handed to it — change one, change both.
   */
  if (handoff) {
    lines.push(
      "## Escalation",
      "",
      `**Escalated to \`${handoff.to}\`** — what the small pass could not settle` +
        (handoff.reasons.length ? ` (${handoff.reasons.join("; ")})` : "") + ":",
      "",
      ...handoff.items.map((i) => `- ${i}`),
      "",
    );
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
      ? missed.map(
          (r) =>
            `| ${r.goal.name} is ${r.value}${r.goal.unit ?? ""}, ` +
            `past ${r.goal.bound.value}${r.goal.unit ?? ""}` +
            // The number the bound is relative to, when it has one. It is not
            // decoration: `scripts/reviews.mjs` reads it to decide whether an
            // answer given at one ceiling still covers a night at another, and
            // without it a bound of 0 makes every night's overshoot look like
            // the same question at the same number forever.
            (r.basis === undefined ? "" : ` of ${r.basis}${r.goal.unit ?? ""}`) +
            // Who is to decide it, when the small pass handed it on. After
            // the number, so `reviews.mjs`'s reading of "X is N, past B" is
            // unchanged.
            (handoff ? ` — escalated to ${handoff.to}` : "") +
            " | unanswered |",
        )
      : ["| — | — |"]),
    // A declared cost that was exceeded is a finding in its own right: a
    // bound nothing answers for is a comment.
    ...(pass?.overBudget
      ? [`| the small pass spent ${money(pass.usd)} in ${pass.turns ?? "?"} turns, past its budget | unanswered |`]
      : []),
    "",
    `\`unanswered\` until somebody writes \`accepted\` or \`rejected\`. **After ${ANSWER_DAYS} days`,
    "an unanswered row fails `npm test`** — the queue can fail, so a correct report",
    "cannot be quietly ignored the way six nights of them were (#197).",
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
  return {
    persona,
    page: path.relative(repo, page),
    broken: broken.length,
    missed: missed.length,
    ...(pass && !pass.skipped ? { usd: pass.usd } : {}),
    ...(handoff ? { escalatedTo: handoff.to } : {}),
  };
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

/**
 * **`--idle`: the second door, for a machine that is on and not busy.**
 *
 * Runs every persona whose trigger declares `idle: machine <n>m`, and only if
 * this machine has been idle that long (`machineIdle`). Meant to be fired
 * often and cheaply — by launchd, cron, or a person's loop — and to do
 * nothing most of the time. A busy machine is not an error: it prints why
 * and exits 0, because the whole point of the trigger is to stay out of the
 * way. `idle: canvas` is refused here, by name: a repo run has no canvas to be
 * idle, and pretending the machine's idleness answers it is the conflation
 * the design names.
 */
if (argv.includes("--idle")) {
  const idlers = all.filter((p) => p.trigger?.idle);
  const ready = [];
  for (const p of idlers) {
    if (p.trigger.idle.scope !== "machine") {
      console.log(`${p.name}: declares canvas idleness, which a repo run cannot answer — skipped`);
      continue;
    }
    const got = machineIdle({ loadavg: os.loadavg(), cpus: os.cpus().length, minutes: p.trigger.idle.minutes });
    if (got.idle) ready.push(p);
    else {
      console.log(
        `${p.name}: machine busy — ${got.window}-minute load ${got.load.toFixed(2)}, idle below ${got.limit.toFixed(2)}`,
      );
    }
  }
  if (idlers.length === 0) console.log("no persona declares an idle trigger");
  if (ready.length === 0) process.exit(0);
  argv.push("--only", ready.map((p) => p.name).join(","));
}

const only = arg("--only")?.split(",");
const wanted = only
  ? all.filter((p) => only.includes(p.name))
  : argv.includes("--all")
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
      `${out.missed} missed, ${out.broken} broken` +
      (out.usd !== undefined ? `, small pass ${money(out.usd)}` : "") +
      (out.escalatedTo ? `, escalated to ${out.escalatedTo}` : ""),
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
