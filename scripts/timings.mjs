#!/usr/bin/env node
/**
 * **Where the time goes, read back.**
 *
 *   node scripts/timings.mjs           what runs cost on THIS machine
 *   node scripts/timings.mjs --ci      what they cost on the runner, per step
 *   node scripts/timings.mjs --ci 20   over the last 20 release runs
 *
 * Two halves, because they are two different machines and averaging them
 * would hide both. The local half is written by every vitest run
 * (`test/timing-reporter.ts`) into `.isocan/timings.jsonl`, which is ignored
 * and per person on purpose: a 14-core laptop and a 2-core runner do not
 * belong in one number, and the question somebody actually has is whether the
 * thing in front of them is getting worse.
 *
 * The CI half stores nothing at all. GitHub already keeps every step's start
 * and finish, so this asks for them rather than keeping a second copy that
 * could disagree — the same argument the roadmap makes for being a view.
 *
 * **Why this exists.** Every number in this repository's commit messages about
 * its own speed was found by hand: eslint timed with a stopwatch, step
 * durations pulled out of the API during one investigation, churn counted with
 * `git log` on an evening somebody happened to look. Each of those took an
 * afternoon and none of them was written anywhere the next person could read,
 * so the next person did it again. Scaling the work means the answer has to be
 * a command.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ciTiming } from "./lib/ci-timings.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);

/** Local runs, as `test/timings.ts` wrote them. Parsing is duplicated here
 *  rather than imported because this is a plain script and that is a `.ts`
 *  module the suite owns; the shape is three fields and a date. */
function localRuns() {
  try {
    return readFileSync(path.join(repo, ".isocan", "timings.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const mins = (s) => (s >= 90 ? `${(s / 60).toFixed(1)}m` : `${s}s`);

function local() {
  const runs = localRuns();
  if (!runs.length) {
    console.log("No runs recorded on this machine yet. They land here as the suite runs.");
    return;
  }
  const kind = (run) => (run.filtered ? "filtered" : run.shard ? `${run.lane} shard` : run.lane);
  const groups = new Map();
  for (const run of runs) groups.set(kind(run), [...(groups.get(kind(run)) ?? []), run]);
  const week = Date.now() - 7 * 24 * 3600 * 1000;
  console.log(`${runs.length} runs on this machine\n`);
  for (const name of [...groups.keys()].sort()) {
    const all = groups.get(name);
    const recent = all.filter((run) => Date.parse(run.at) >= week).map((r) => r.ms);
    const earlier = all.filter((run) => Date.parse(run.at) < week).map((r) => r.ms);
    const drift =
      recent.length && earlier.length
        ? `  ${median(recent) > median(earlier) ? "▲ slower" : "▼ faster"} than before this week`
        : "";
    console.log(
      `${name.padEnd(13)}${String(all.length).padStart(4)} runs   median ${secs(median(all.map((r) => r.ms))).padStart(7)}` +
        `   worst ${secs(Math.max(...all.map((r) => r.ms))).padStart(7)}   last ${secs(all.at(-1).ms).padStart(7)}${drift}`,
    );
  }
  console.log("\nfiltered runs are somebody asking one question; the lanes are the gate.");
}

/** The runner's own numbers, asked for rather than kept. */
function ci(limit) {
  const runs = JSON.parse(
    execFileSync("gh", ["run", "list", "--workflow=release.yml", "-L", String(limit), "--json", "databaseId,conclusion,headSha,createdAt"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 60_000,
    }),
  ).filter((run) => run.conclusion === "success");
  if (!runs.length) {
    console.log("No successful release runs to read.");
    return;
  }
  const steps = new Map();
  const timings = [];
  for (const run of runs) {
    let jobs;
    try {
      jobs = JSON.parse(
        execFileSync("gh", ["api", "--paginate", "--slurp", `repos/{owner}/{repo}/actions/runs/${run.databaseId}/jobs?per_page=100`], {
          cwd: repo,
          encoding: "utf8",
          timeout: 60_000,
        }),
      ).flatMap((page) => page.jobs);
    } catch {
      continue; // a run whose logs have aged out
    }
    const timing = ciTiming(run, jobs);
    if (!timing) continue;
    timings.push(timing);
    for (const job of jobs) {
      for (const step of job.steps ?? []) {
        if (!step.started_at || !step.completed_at) continue;
        const took = (Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000;
        const key = `${job.name} · ${step.name}`;
        steps.set(key, [...(steps.get(key) ?? []), took]);
      }
    }
  }
  const rows = [...steps.entries()]
    .map(([name, times]) => ({ name, median: median(times), runs: times.length }))
    .sort((a, b) => b.median - a.median);
  if (!timings.length) {
    console.log("No completed job timings could be read.");
    return;
  }
  console.log(`${timings.length} successful release runs with job timings · medians\n`);
  for (const [key, label] of [["queue", "initial queue"], ["execution", "execution (parallel jobs overlap)"],
    ["elapsed", "created → release complete"], ["green", "created → green step complete"]]) {
    const values = timings.map((timing) => timing[key]).filter((value) => value !== null);
    if (values.length) console.log(`${mins(Math.round(median(values))).padStart(6)}  ${label}`);
  }
  console.log("\nPer-step medians (overlapping work, not shares of elapsed time):\n");
  for (const row of rows.filter((one) => one.median >= 1)) {
    console.log(`${mins(Math.round(row.median)).padStart(6)}  ${row.name}`);
  }
  console.log("\nThe green step may decline a stale ref; its completion is not proof of a deployment.");
}

if (argv.includes("--ci")) {
  const limit = Number(argv.find((arg) => /^\d+$/.test(arg))) || 10;
  ci(limit);
} else {
  local();
}
