#!/usr/bin/env node
/** Explicit dry-run/model modes; the default is an argument error, never a paid invocation. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_SPEC } from "./lib/design-lint-eval-model.mjs";

/** Validate all mode/budget arguments before loading browser or daemon code. */
export function parseEvalArgs(args) {
  const options = { mode: null, outputDir: null, seed: "design-lint-pilot-v1", model: null, budgetUsd: null, summarize: null, ratings: null, continueFrom: null };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]; if (seen.has(key)) throw new Error(`Duplicate option ${key}`); seen.add(key);
    if (key === "--dry-run") { options.mode = "dry-run"; continue; }
    if (!["--out", "--seed", "--model", "--budget-usd", "--summarize", "--ratings", "--continue-from"].includes(key) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Unknown or incomplete option ${key}`);
    const value = args[++i];
    if (key === "--out") options.outputDir = path.resolve(value);
    else if (key === "--seed") options.seed = value;
    else if (key === "--model") options.model = value;
    else if (key === "--budget-usd") options.budgetUsd = Number(value);
    else if (key === "--summarize") options.summarize = path.resolve(value);
    else if (key === "--continue-from") options.continueFrom = path.resolve(value);
    else options.ratings = path.resolve(value);
  }
  if (options.summarize) {
    if (options.mode || options.model || options.budgetUsd !== null || options.outputDir || options.continueFrom || seen.has("--seed")) throw new Error("--summarize accepts only an optional --ratings file.");
    return options;
  }
  if (options.ratings) throw new Error("--ratings requires --summarize.");
  if (options.mode === "dry-run") {
    if (options.model || options.budgetUsd !== null || options.continueFrom) throw new Error("Dry run cannot select a model, monetary allowance or continuation.");
  } else {
    if (options.model !== MODEL_SPEC.model || !Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) throw new Error("Choose --dry-run, or explicit --model claude-sonnet-5 with an approved --budget-usd cap.");
    options.mode = "model";
  }
  if (!options.outputDir) throw new Error("A new --out evidence directory is required.");
  return options;
}

/** Ratings ingestion only reads prior evidence and writes a new summary; it never runs a provider. */
export async function summarizeRun(directory, ratingsFile) {
  const report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
  const ratings = ratingsFile ? JSON.parse(await readFile(ratingsFile, "utf8")) : null;
  let armKey = null;
  try { armKey = JSON.parse(await readFile(path.join(directory, "arm-key.json"), "utf8")); } catch { /* Missing human pairing remains unavailable to the scorer. */ }
  const { summarizeEvaluation } = await import("./lib/design-lint-eval-score.mjs");
  const summary = summarizeEvaluation({ records: report.records ?? [], mode: report.mode, ratings, armKey });
  await writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  return summary;
}

async function main() {
  try {
    const options = parseEvalArgs(process.argv.slice(2));
    if (options.summarize) { console.log(JSON.stringify(await summarizeRun(options.summarize, options.ratings), null, 2)); return; }
    const { runEvaluation } = await import("./lib/design-lint-eval-runner.mjs");
    const result = await runEvaluation(options);
    await summarizeRun(options.outputDir, null);
    console.log(JSON.stringify({ outputDir: options.outputDir, status: result.status, runs: result.runs.length, modelCalls: result.modelCalls, modelCallsThisRun: result.modelCallsThisRun, modelLift: result.modelLift, stopReason: result.stopReason ?? null }, null, 2));
    if (result.status !== "completed") process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
