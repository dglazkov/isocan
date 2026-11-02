#!/usr/bin/env node
/** Explicit study instrumentation. Every mode except run makes zero model/provider calls. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "./lib/design-partner-eval.mjs";
import { STUDY_SOURCES, prepareRuntimeSource, inspectRuntime, materializeStudyRuntime, openStudyRunRuntime, studyHash, studyJson } from "./lib/design-partner-runtime.mjs";
import { prepareExecutionManifest, validateExecutionManifest } from "./lib/design-partner-execution.mjs";
import { prepareNativeProfile, executeNativeStudyRun } from "./lib/design-partner-native.mjs";
import { answerStudyQuestion } from "./lib/design-partner-tools.mjs";
import { collectStudyResult, assessStudyResult, validateStudyResultEvidence } from "./lib/design-partner-results.mjs";
import { prepareBlindReview, serveBlindReview, analyzeBlindReview, partnershipInstruments } from "./lib/design-partner-review.mjs";

const repository = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const help = `Design-partner study instrumentation (provider calls only in explicit run):
  prepare-source --condition A|B --out NEW --dependencies ROOT
  inspect --condition A|B --source DIR
  materialize --condition A|B --source DIR --out NEW [--fixtures DIR]
  profile --binary PATH [--out FILE]              # help/version/hash only
  manifest --dry FILE --baseline DIR --candidate DIR --a-map FILE --b-map FILE --profile FILE --limits FILE --out NEW
  validate --manifest FILE [--fixtures DIR]        # never authorizes a run
  run --manifest FILE --authorization FILE --run-id ID --journal DIR --runtime NEW --out NEW [--output ITEM]
  collect --manifest FILE --attempt FILE --config FILE --out NEW --evidence-root DIR [--output ITEM]
  assess --manifest FILE --record FILE --plan FILE --out NEW --evidence-root DIR
  evidence --manifest FILE --record FILE --evidence-root DIR
  answer --question FILE --evaluator ID --disposition mapped|repeated|unmapped|declined [--fact ID] [--reason TEXT] [--response FILE --config FILE]
  review --manifest FILE --records FILE --evidence-root DIR --out NEW --key FILE --raters ID,ID,ID [--contrast A,B]
  serve-review --directory DIR                     # owned local review only
  analyze --manifest FILE --records FILE --key FILE --ratings FILE --review-root DIR --evidence-root DIR [--partnership FILE]
  partnership [--out FILE]                         # copies the committed empty assignment instrument
All run identities and reservations are immutable. Unknown accounting blocks the next launch; there is no retry mode. Compatible --bare API-key authentication and separate explicit provision are required; OAuth readiness is not sufficient. No credentials are accepted as CLI arguments.
`;
const flagNames = new Set(["condition", "out", "dependencies", "source", "fixtures", "binary", "dry", "baseline", "candidate", "a-map", "b-map", "profile", "limits", "manifest", "authorization", "run-id", "journal", "runtime", "output", "attempt", "config", "evidence-root", "record", "plan", "question", "evaluator", "disposition", "fact", "reason", "response", "records", "key", "raters", "contrast", "directory", "ratings", "review-root", "partnership"]);
const json = async filename => JSON.parse(await fs.readFile(filename, "utf8"));
async function main(argv) {
  const [mode, ...args] = argv;
  if (!mode || ["--help", "help"].includes(mode)) { process.stdout.write(help); return; }
  const opts = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]; if (!flag?.startsWith("--") || !flagNames.has(flag.slice(2)) || args[index + 1] === undefined || args[index + 1].startsWith("--") || Object.hasOwn(opts, flag.slice(2))) throw new Error(`Unknown, duplicate or incomplete option: ${flag}`);
    opts[flag.slice(2)] = args[index + 1];
  }
  const need = name => { if (!opts[name]) throw new Error(`--${name} is required`); return opts[name]; };
  const fixtures = opts.fixtures ?? path.join(repository, "test/fixtures/design-partner");
  const runtime = async condition => { if (!["A", "B"].includes(condition)) throw new Error("Condition must be A or B"); return inspectRuntime({ repository, revision: STUDY_SOURCES[condition], directory: need("source") }); };
  let result, written = false;
  if (mode === "prepare-source") result = await prepareRuntimeSource({ repository, revision: STUDY_SOURCES[need("condition")], directory: need("out"), dependencies: need("dependencies") });
  else if (mode === "inspect") result = await runtime(need("condition"));
  else if (mode === "materialize") result = await materializeStudyRuntime({ runtime: await runtime(need("condition")), directory: need("out"), fixtures });
  else if (mode === "profile") result = await prepareNativeProfile({ cwd: repository, binaryPath: opts.binary });
  else if (mode === "manifest") {
    const runtimes = { A: await inspectRuntime({ repository, revision: STUDY_SOURCES.A, directory: need("baseline") }), B: await inspectRuntime({ repository, revision: STUDY_SOURCES.B, directory: need("candidate") }) };
    const materializations = await Promise.all(["A", "B"].map(async condition => ({ condition, path: path.resolve(need(condition === "A" ? "a-map" : "b-map")), sha256: studyHash(await fs.readFile(need(condition === "A" ? "a-map" : "b-map"))) })));
    const profile = await json(need("profile")); result = prepareExecutionManifest({ dry: await json(need("dry")), runtimes, materializations, profile: profile.profile ?? profile, limits: await json(need("limits")) });
    await validateExecutionManifest(result, { repository, fixtures });
  } else if (mode === "validate") result = await validateExecutionManifest(await json(need("manifest")), { repository, fixtures });
  else if (mode === "run") {
    const manifest = await json(need("manifest")), authorization = await json(need("authorization"));
    await validateExecutionManifest(manifest, { repository, fixtures, execution: true, authorization });
    const owned = await openStudyRunRuntime({ manifest, runId: need("run-id"), directory: need("runtime") });
    try {
      await fs.writeFile(path.join(opts.runtime, "runtime-config.json"), studyJson(owned.config), { flag: "wx", mode: 0o600 });
      const attempt = await executeNativeStudyRun({ mode: "execute", manifest, authorization, repository, fixtures, journal: need("journal"), runId: opts["run-id"], runtimeConfig: owned.config });
      let outputItemId = opts.output ?? null;
      if (!outputItemId) { try { outputItemId = (await json(path.join(owned.config.workspace, "RESULT.json"))).outputItemId ?? null; } catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; } }
      result = await collectStudyResult({ manifest, attemptFile: path.join(opts.journal, `attempt-${attempt.attemptId}.json`), runtimeConfig: owned.config, outputItemId, directory: need("out"), evidenceRoot: path.resolve(opts.journal, "..") }); written = true;
    } finally { await owned.close(); }
  } else if (mode === "collect") { result = await collectStudyResult({ manifest: await json(need("manifest")), attemptFile: need("attempt"), runtimeConfig: await json(need("config")), outputItemId: opts.output ?? null, directory: need("out"), evidenceRoot: need("evidence-root") }); written = true; }
  else if (mode === "assess") { result = await assessStudyResult({ record: await json(need("record")), manifest: await json(need("manifest")), corpus: await loadCorpus(fixtures), evidenceRoot: need("evidence-root"), directory: need("out"), plan: await json(need("plan")) }); await fs.writeFile(path.join(opts.out, "assessed-result.json"), studyJson(result), { flag: "wx" }); written = true; }
  else if (mode === "evidence") result = await validateStudyResultEvidence(await json(need("record")), { manifest: await json(need("manifest")), evidenceRoot: need("evidence-root") });
  else if (mode === "answer") result = await answerStudyQuestion({ corpus: await loadCorpus(fixtures), questionFile: need("question"), evaluatorId: need("evaluator"), disposition: need("disposition"), factId: opts.fact ?? null, reason: opts.reason ?? null, responseFile: opts.response ?? null, runtimeConfigFile: opts.config ?? null });
  else if (mode === "review") { result = await prepareBlindReview({ manifest: await json(need("manifest")), corpus: await loadCorpus(fixtures), records: await json(need("records")), evidenceRoot: need("evidence-root"), directory: need("out"), keyFile: need("key"), raterIds: need("raters").split(","), contrast: (opts.contrast ?? "A,B").split(",") }); written = true; }
  else if (mode === "serve-review") { const service = await serveBlindReview({ directory: need("directory") }); process.stdout.write(studyJson({ url: service.url })); await new Promise(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); }); await service.close(); return; }
  else if (mode === "analyze") result = await analyzeBlindReview({ manifest: await json(need("manifest")), corpus: await loadCorpus(fixtures), records: await json(need("records")), key: await json(need("key")), reviews: await json(need("ratings")), evidenceRoot: need("evidence-root"), reviewRoot: need("review-root"), partnership: opts.partnership ? await json(opts.partnership) : null });
  else if (mode === "partnership") result = await partnershipInstruments();
  else throw new Error(`Unknown mode: ${mode}`);
  if (opts.out && !written && !["prepare-source", "materialize"].includes(mode)) await fs.writeFile(opts.out, studyJson(result), { flag: "wx" });
  process.stdout.write(studyJson(result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
