#!/usr/bin/env node
/** Phase-0 offline preparation only. There is intentionally no --model or provider mode. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES, loadCorpus, loadBaseline, createManifest, renderBaselineEnvelope, validateDryManifest, validateManifestInputs, validateResultSet } from "./lib/design-partner-eval.mjs";

export function parseArgs(args) {
  const options = { mode: null, out: null, fixtures: FIXTURES, includeC: null, study: "full", seed: "design-partner-v1", entrance: null, baseline: null, validate: null, manifest: null };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error(`Duplicate option: ${key}`); seen.add(key);
    if (key === "--dry-run") { options.mode = "dry-run"; continue; }
    const mapping = { "--out": "out", "--fixtures": "fixtures", "--include-c": "includeC", "--study": "study", "--seed": "seed", "--entrance": "entrance", "--baseline": "baseline", "--validate": "validate", "--manifest": "manifest" };
    if (!mapping[key] || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Unknown or incomplete option: ${key}`);
    options[mapping[key]] = args[++i];
  }
  if (Number(options.mode === "dry-run") + Number(options.baseline !== null) + Number(options.validate !== null) !== 1) throw new Error("Choose exactly --dry-run, --baseline <case>, or --validate <file>. No paid execution mode exists.");
  if (options.baseline && !["canvas-chat", "external-agent"].includes(options.entrance)) throw new Error("--baseline requires --entrance canvas-chat or external-agent");
  if (!options.baseline && options.entrance) throw new Error("--entrance belongs to --baseline");
  if (options.manifest && !options.validate) throw new Error("--manifest belongs to actual --validate");
  if (options.mode !== "dry-run" && ["--include-c", "--study", "--seed"].some(key => seen.has(key))) throw new Error("Matrix options belong to --dry-run");
  return options;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    let output;
    if (options.validate) {
      const value = JSON.parse(await readFile(options.validate, "utf8"));
      if (value.kind === "design-partner-manifest") output = await validateManifestInputs(value, options.fixtures);
      else {
        if (!options.manifest) throw new Error("Actual results require the exact --manifest <file>");
        const manifest = JSON.parse(await readFile(options.manifest, "utf8"));
        output = await validateResultSet(value, manifest, path.dirname(path.resolve(options.validate)), options.fixtures);
      }
    } else {
      const [corpus, baseline] = await Promise.all([loadCorpus(options.fixtures), loadBaseline(options.fixtures)]);
      if (options.mode === "dry-run") { output = createManifest(corpus, baseline, options); validateDryManifest(output); }
      else {
        const task = corpus.tasks.find(row => row.id === options.baseline);
        if (!task) throw new Error(`Unknown fixture: ${options.baseline}`);
        output = await renderBaselineEnvelope(task, options.entrance, baseline);
      }
    }
    const encoded = JSON.stringify(output, null, 2) + "\n";
    if (options.out) { await writeFile(options.out, encoded, { flag: "wx" }); console.log(JSON.stringify({ path: path.resolve(options.out), kind: output.kind, plannedRuns: output.plannedRuns ?? null, providerCalls: 0 })); }
    else process.stdout.write(encoded);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
