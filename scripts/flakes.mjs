#!/usr/bin/env node
/**
 * **How often the suite fails when nothing is wrong, and which tests do it.**
 *
 *   node scripts/flakes.mjs              # six runs
 *   node scripts/flakes.mjs --runs 12
 *   node scripts/flakes.mjs --json
 *
 * A green suite run says the code is fine. It does not say the suite is
 * RELIABLE, and until now that difference has been carried entirely by
 * people's memory of having re-run something — which is the least reliable
 * instrument in the building and the one that makes a real failure easy to
 * dismiss as "probably flaky".
 *
 * `docs/research/2026-08-29-the-flake-family.md` fought this family across
 * seven witnesses and reached the conclusion this script exists to act on:
 *
 * > The next round should add to what a failure RECORDS, not to what we
 * > believe about it.
 *
 * So: run the whole suite N times against an unchanged tree, and record every
 * test that failed in any of them. A test that fails in some runs and passes
 * in others cannot be failing because of the code — the code did not change —
 * so the list this prints is exactly the flake set, by name, with a rate.
 *
 * **N runs, not a retry.** Vitest's `retry` would make these disappear, which
 * is the opposite of what is wanted: a flake that is retried away is a flake
 * nobody can count. Nothing here changes how the suite runs.
 *
 * **Not a push-time goal.** Six runs is about twelve minutes, and
 * `scripts/ratchet.mjs` takes every persona's goals on every push —
 * `test/journeys.test.ts` already refuses a goal that would buy a browser walk
 * per commit, for the same reason. This belongs on a cadence, beside the
 * journeys.
 *
 * The exit code is the honest one: **non-zero when anything flaked**, so a
 * cadence that runs this has something that can fail.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const RUNS = Number(arg("--runs", "6"));
const JSON_OUT = argv.includes("--json");

if (!Number.isInteger(RUNS) || RUNS < 2) {
  console.error("--runs needs an integer of 2 or more: one run cannot tell a flake from a failure");
  process.exit(2);
}

const scratch = mkdtempSync(path.join(tmpdir(), "isocan-flakes-"));

/** One run, as `{ ok, failures: [{ file, test }] }`. A run that could not
 *  produce a report at all is its own kind of news and is not silently a
 *  pass. */
function runOnce(i) {
  const out = path.join(scratch, `run-${i}.json`);
  let ok = true;
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], {
      cwd: repo,
      stdio: "ignore",
      env: { ...process.env, CI: process.env.CI ?? "" },
    });
  } catch {
    ok = false;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(out, "utf8"));
  } catch {
    return { ok: false, unreadable: true, failures: [] };
  }
  const failures = [];
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status === "failed") {
        failures.push({
          file: path.relative(repo, file.name),
          test: assertion.fullName,
          // The first line only: a stack is noise in a tally, and the first
          // line is what tells ENOTEMPTY from an assertion.
          why: (assertion.failureMessages?.[0] ?? "").split("\n")[0].slice(0, 160),
        });
      }
    }
  }
  return { ok, failures };
}

const runs = [];
for (let i = 1; i <= RUNS; i += 1) {
  if (!JSON_OUT) process.stderr.write(`run ${i}/${RUNS}… `);
  const result = runOnce(i);
  runs.push(result);
  if (!JSON_OUT) process.stderr.write(`${result.failures.length} failed\n`);
}
rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

/** By test, because the same test failing twice for two reasons is still one
 *  thing to fix, and two tests failing once each is two. */
const byTest = new Map();
for (const run of runs) {
  for (const failure of run.failures) {
    const key = `${failure.file} › ${failure.test}`;
    const seen = byTest.get(key) ?? { ...failure, runs: 0, whys: new Set() };
    seen.runs += 1;
    seen.whys.add(failure.why);
    byTest.set(key, seen);
  }
}

const flaked = [...byTest.entries()]
  .map(([key, v]) => ({ key, runs: v.runs, of: RUNS, whys: [...v.whys] }))
  .sort((a, b) => b.runs - a.runs || a.key.localeCompare(b.key));

const greenRuns = runs.filter((r) => r.failures.length === 0 && !r.unreadable).length;
const rate = ((RUNS - greenRuns) / RUNS) * 100;

if (JSON_OUT) {
  console.log(JSON.stringify({ runs: RUNS, greenRuns, rate, flaked }, null, 2));
} else {
  console.log(`\n${greenRuns}/${RUNS} runs green — ${rate.toFixed(0)}% of runs had a failure.\n`);
  if (flaked.length === 0) {
    console.log("Nothing failed in any run.");
  } else {
    /**
     * **A test that failed EVERY run is not a flake, it is broken** — and
     * saying so is the difference between a list somebody acts on and a list
     * somebody re-runs. Kept in the table rather than filtered out, because a
     * broken test hiding in a flake report is the worse failure.
     */
    for (const one of flaked) {
      const verdict = one.runs === RUNS ? "BROKEN — failed every run" : `flaked ${one.runs}/${one.of}`;
      console.log(`${verdict}\n  ${one.key}`);
      for (const why of one.whys) console.log(`    ${why}`);
      console.log("");
    }
  }
}
process.exit(flaked.length === 0 ? 0 : 1);
