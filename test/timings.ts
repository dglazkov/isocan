import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runningDeep } from "./deep.ts";

/**
 * **How long a unit of work takes here, written down as it happens.**
 *
 * Everything this repository knows about its own speed has been archaeology:
 * somebody times `eslint` by hand, reads step durations out of the GitHub API,
 * greps `git log` for churn, writes the number in a commit message, and the
 * next person re-derives all of it. The answer to "what is slowing us down"
 * should be a file you read, not an afternoon you spend.
 *
 * So every vitest run records itself. Not a new command to remember and not a
 * flag to pass — `test/timing-reporter.ts` is wired into `vitest.config.ts`,
 * so `npm test`, `npm run test:deep`, `npm run test:ci`, a shard on CI and a
 * single filtered file on a laptop all leave the same kind of line behind.
 *
 * **Local, per machine, and never committed.** It lands in `.isocan/`, which
 * is already ignored — which is the point rather than a shortcut. A committed
 * timings file would be written by every run and conflict on every rebase,
 * which is precisely the problem `scripts/mergegen.mjs` exists to solve one
 * directory over. And the interesting question is not "how fast is this repo
 * in the abstract" but "how fast is it on the machine in front of me, and is
 * that getting worse" — a 14-core laptop and a 2-core runner do not belong in
 * one average. CI's own numbers come from `scripts/timings.mjs --ci`, which
 * reads them from the runs GitHub already kept.
 *
 * Nothing here may ever fail a test run. A timing file is a convenience; a
 * suite that goes red because it could not write one is not.
 */
export interface RunRecord {
  /** When the run finished, ISO. */
  at: string;
  /** `deep` when the lane ran, `fast` when it was left out. */
  lane: "deep" | "fast";
  /** `1/4` on a sharded CI run, absent otherwise. */
  shard?: string;
  /** A run that named files on the command line: a person asking one question. */
  filtered: boolean;
  files: number;
  tests: number;
  failed: number;
  /** Wall clock, which is what somebody actually waited. */
  ms: number;
}

const repo = fileURLToPath(new URL("..", import.meta.url));
export const TIMINGS = path.join(repo, ".isocan", "timings.jsonl");

/**
 * Append one run. Silent on any trouble — see the header.
 *
 * **It starts on a fresh line even when the last one never finished.** A run
 * killed mid-write leaves a partial line with no newline, and appending
 * straight onto that glues the next record to it: one corrupt line instead of
 * one corrupt line and one good one. Found by this file's own guard, which is
 * the argument for asserting that a broken line costs only itself.
 */
export function record(entry: RunRecord, file = TIMINGS): void {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    let lead = "";
    try {
      const existing = readFileSync(file, "utf8");
      if (existing && !existing.endsWith("\n")) lead = "\n";
    } catch {
      /* No file yet, which needs no newline in front of it. */
    }
    appendFileSync(file, `${lead}${JSON.stringify(entry)}\n`);
  } catch {
    /* A read-only checkout, a full disk, a sandbox: none of them are this
       run's problem to report. */
  }
}

export function read(file = TIMINGS): RunRecord[] {
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as RunRecord];
        } catch {
          return []; // a half-written line from a killed run
        }
      });
  } catch {
    return [];
  }
}

/** What a run should be called in a report — the thing that makes two numbers comparable. */
export function kindOf(run: RunRecord): string {
  if (run.filtered) return "filtered";
  if (run.shard) return `${run.lane} shard`;
  return run.lane;
}

export const median = (values: readonly number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
};

/**
 * **The report: what each kind of run costs, and whether it is getting worse.**
 *
 * Median rather than mean, because one run under a full machine is not the
 * experience and would drag an average around. `worst` is there so a flake's
 * true cost is visible; `last` so "did the thing I just changed help" has an
 * answer without arithmetic.
 */
export function summarize(runs: readonly RunRecord[], now = new Date()): string {
  if (!runs.length) return "no runs recorded yet — they land here as the suite runs.";
  const byKind = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const kind = kindOf(run);
    byKind.set(kind, [...(byKind.get(kind) ?? []), run]);
  }
  const week = now.getTime() - 7 * 24 * 3600 * 1000;
  const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  const lines = [`${runs.length} runs recorded, ${[...byKind.keys()].sort().join(", ")}`, ""];
  for (const kind of [...byKind.keys()].sort()) {
    const all = byKind.get(kind)!;
    const recent = all.filter((run) => Date.parse(run.at) >= week);
    const earlier = all.filter((run) => Date.parse(run.at) < week);
    const drift =
      recent.length && earlier.length
        ? ` · ${median(recent.map((r) => r.ms)) > median(earlier.map((r) => r.ms)) ? "slower" : "faster"} than before`
        : "";
    lines.push(
      `${kind.padEnd(12)} ${String(all.length).padStart(4)} runs  median ${secs(median(all.map((r) => r.ms)))}` +
        `  worst ${secs(Math.max(...all.map((r) => r.ms)))}  last ${secs(all.at(-1)!.ms)}${drift}`,
    );
  }
  return lines.join("\n");
}

/** The lane a run is in, asked the way the lane itself asks. */
export const laneOf = (env: NodeJS.ProcessEnv = process.env): "deep" | "fast" =>
  runningDeep(env) ? "deep" : "fast";
