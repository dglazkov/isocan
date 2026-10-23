#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { installInputDigests } from "./lib/install-inputs.mjs";

const sha = (value) => typeof value === "string" && /^[a-f0-9]{40,64}$/.test(value);
const text = (value) => typeof value === "string" && value.length > 0;
const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = (value) => typeof value === "string" && /^[1-9]\d*$/.test(value);
const validInputs = (input) => input && input.clean === true &&
  [input.head, input.tree, input.lock, input.setup, input.manifest].every(sha) &&
  same(input.flags, ["ci"]) && input.runtime &&
  /^v\d+\.\d+\.\d+$/.test(input.runtime.node) && /^\d+\.\d+\.\d+$/.test(input.runtime.npm) &&
  ["linux", "darwin"].includes(input.runtime.platform) && ["x64", "arm64"].includes(input.runtime.arch);
const sameInputs = (a, b) => ["head", "tree", "lock", "setup", "manifest", "flags", "runtime"].every((key) => same(a[key], b[key]));
const retainedInputs = (input) => ({ clean: input.clean, head: input.head, tree: input.tree,
  lock: input.lock, setup: input.setup, manifest: input.manifest, flags: [...input.flags],
  runtime: { node: input.runtime.node, npm: input.runtime.npm, platform: input.runtime.platform, arch: input.runtime.arch } });

function currentStages() {
  const manifests = ["pr", "release"].map((name) => {
    const source = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");
    const matrix = /shard: \[([\d, ]+)\]/.exec(source)?.[1].split(",").map((n) => Number(n.trim()));
    if (!matrix?.length || !/^  checks:/m.test(source) || new Set(matrix).size !== matrix.length || matrix.some((n, i) => n !== i + 1)) return null;
    return ["checks", ...matrix.map((n) => `suite-${n}`)];
  });
  return manifests[0] && same(manifests[0], manifests[1]) ? manifests[0] : null;
}

/** A read-only proposal over explicitly supplied retained GitHub evidence.
 * Artifact provenance must be checked by the operator against GitHub; this
 * function is not an attestation verifier and never starts or authorizes work. */
export function installRetryPlan(evidence) {
  const refuse = (reason) => ({ schema: 1, eligible: false, reason, retries: [], retainedSuccesses: [] });
  if (!evidence || evidence.schema !== 1 || evidence.repository !== "dglazkov/isocan") return refuse("unsupported evidence");
  const { original, candidate, jobs, expectedStages } = evidence;
  if (!original || !candidate || original.attempt !== 1 || candidate.attempt !== 2 ||
      !id(original.runId) || candidate.runId !== original.runId ||
      candidate.parentAttempt !== 1) return refuse("only one explicit retry of the original run is eligible");
  if (!validInputs(original.inputs) || !validInputs(candidate.inputs) || !sameInputs(original.inputs, candidate.inputs)) {
    return refuse("missing or changed immutable inputs; rerun the complete gate");
  }
  const local = installInputDigests();
  if (["lock", "setup", "manifest"].some((key) => original.inputs[key] !== local[key])) {
    return refuse("retained inputs do not match this checkout's setup and stage manifests");
  }
  const stages = currentStages();
  if (!stages || !Array.isArray(expectedStages) || !same([...expectedStages].sort(), [...stages].sort()) ||
      !expectedStages.every(text) || new Set(expectedStages).size !== expectedStages.length ||
      !Array.isArray(jobs) || jobs.length !== expectedStages.length ||
      new Set(jobs.map((job) => job.stage)).size !== expectedStages.length ||
      new Set(jobs.map((job) => job.jobId)).size !== expectedStages.length ||
      jobs.some((job) => !expectedStages.includes(job.stage))) return refuse("missing or duplicate stage evidence");
  const retries = [];
  const retainedSuccesses = [];
  for (const job of jobs) {
    if (!id(job.jobId) || !date(job.startedAt) || !date(job.completedAt) || Date.parse(job.completedAt) < Date.parse(job.startedAt) ||
        job.attempt !== 1 || job.runId !== original.runId || !validInputs(job.inputs) || !sameInputs(job.inputs, original.inputs)) {
      return refuse("incomplete job identity, timing or inputs");
    }
    if (job.conclusion === "success") {
      retainedSuccesses.push({ jobId: job.jobId, stage: job.stage, runId: job.runId,
        attempt: job.attempt, startedAt: job.startedAt, completedAt: job.completedAt,
        conclusion: job.conclusion, inputs: retainedInputs(job.inputs) });
      continue;
    }
    const proof = job.diagnostic;
    if (job.conclusion !== "failure" || job.failedStep !== "install" || job.productStepsStarted !== false ||
        !proof || proof.schema !== 1 || proof.status !== "timed_out" || proof.wrapperExitCode !== 124 ||
        proof.run?.id !== original.runId || proof.run?.attempt !== 1 || proof.run?.stage !== job.stage ||
        !validInputs(proof.inputs) || !sameInputs(proof.inputs, original.inputs) ||
        !Array.isArray(proof.snapshots) || !proof.snapshots.some((snapshot) => snapshot.phase === "before-term") || !date(proof.killSentAt) ||
        !proof.installer || !(proof.installer.exitCode === null && ["SIGTERM", "SIGKILL"].includes(proof.installer.signal) || proof.installer.exitCode === 0 && proof.installer.signal === null) ||
        !job.provenance || job.provenance.source !== "github-actions-artifact" || !id(job.provenance.artifactId) ||
        job.provenance.runId !== original.runId || job.provenance.attempt !== 1 ||
        job.provenance.jobId !== job.jobId || job.provenance.stage !== job.stage ||
        job.operatorClassification !== "transient-setup-only") {
      return refuse("failure is not a reviewed setup-only timeout with retained provenance");
    }
    retries.push({ stage: job.stage, jobId: job.jobId, runId: original.runId,
      parentAttempt: 1, nextAttempt: 2, diagnosticArtifactId: job.provenance.artifactId });
  }
  if (retries.length !== 1) return refuse("exactly one failed setup job is required for a targeted retry");
  return { schema: 1, eligible: true, recommendationOnly: true,
    reason: "one reviewed setup timeout; operator must verify retained evidence against GitHub before retry",
    retries, retainedSuccesses };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("usage");
    const result = installRetryPlan(JSON.parse(readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.eligible ? 0 : 1;
  } catch {
    console.error("install retry plan: expected one valid retained-evidence JSON file");
    process.exitCode = 1;
  }
}
