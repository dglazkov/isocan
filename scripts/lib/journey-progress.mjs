/** Durable progress for the browser walk, including an unfinished rig's verdict. */
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Run each journey in an owned rig and checkpoint before every fallible stage. */
export async function walkJourneys(journeys, { rig, checkpoint = null, report = () => {} }) {
  const results = [];
  const progress = {
    version: 1, selected: journeys.map((journey) => journey.name),
    startedAt: new Date().toISOString(), complete: false, active: null, results,
  };
  const save = () => {
    if (!checkpoint) return;
    const temporary = `${checkpoint}.tmp-${process.pid}`;
    try {
      writeFileSync(temporary, JSON.stringify({ ...progress, updatedAt: new Date().toISOString(), failing: results.filter((result) => !result.ok).length }, null, 2) + "\n", { mode: 0o600 });
      renameSync(temporary, checkpoint);
    } finally { rmSync(temporary, { force: true }); }
  };
  const why = (error) => error instanceof Error ? error.message : String(error);
  save(); // Even a failure to start the first rig leaves incomplete evidence.
  for (const journey of journeys) {
    progress.active = { name: journey.name, stage: "setup" };
    save();
    report({ stage: "setup", journey });
    const booted = Date.now();
    let r;
    try { r = await rig(); }
    catch (error) {
      const result = { name: journey.name, what: journey.what, ok: false, ms: Date.now() - booted, why: `the rig did not start: ${why(error)}`, cleanupComplete: true, cleanupMs: 0 };
      results.push(result);
      progress.active = null; save(); report({ stage: "result", result });
      continue;
    }
    const started = Date.now();
    const result = { name: journey.name, what: journey.what, setupMs: started - booted, cleanupComplete: false };
    // A failed checkpoint write must still close the rig we already own.
    try {
      progress.active.stage = "walk"; save();
      try {
        const proof = await journey.run(r);
        Object.assign(result, { ok: true, ms: Date.now() - started, ...(proof ? { proof } : {}) });
      } catch (error) {
        Object.assign(result, { ok: false, ms: Date.now() - started, why: why(error) });
      }
      results.push(result);
      progress.active.stage = "cleanup";
      save(); // The assertion failure is durable BEFORE close can hang or fail.
      report({ stage: "cleanup", result });
    } finally {
      const cleanupStarted = Date.now();
      try { await r.close(); }
      catch (error) {
        Object.assign(result, {
          ok: false,
          why: result.ok ? `the walk passed, then its rig would not stop: ${why(error)}`
            : `${result.why ?? "the walk did not complete"}; its rig would not stop: ${why(error)}`,
        });
      }
      result.cleanupComplete = true;
      result.cleanupMs = Date.now() - cleanupStarted;
      progress.active = null;
      save();
    }
    report({ stage: "result", result });
  }
  progress.complete = true; save();
  return results;
}

/** Refuse missing, incomplete or inconsistent evidence even when the process exited zero. */
export function verifyJourneyCheckpoint(file) {
  const checkpoint = JSON.parse(readFileSync(file, "utf8"));
  const { selected, results } = checkpoint;
  if (checkpoint.version !== 1 || checkpoint.complete !== true || checkpoint.active !== null
    || !Array.isArray(selected) || selected.length === 0 || selected.some((name) => typeof name !== "string")
    || new Set(selected).size !== selected.length || !Array.isArray(results) || results.length !== selected.length
    || results.some((result, index) => result.name !== selected[index] || typeof result.ok !== "boolean" || result.cleanupComplete !== true)
    || checkpoint.failing !== results.filter((result) => !result.ok).length) {
    throw new Error("journey checkpoint is incomplete or inconsistent");
  }
  if (checkpoint.failing) throw new Error(`journey checkpoint records ${checkpoint.failing} failing journey(s)`);
  return checkpoint;
}

// The workflow calls the same verifier the interruption regressions exercise.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "--check" || !process.argv[3]) throw new Error("usage: journey-progress.mjs --check <checkpoint.json>");
    verifyJourneyCheckpoint(process.argv[3]);
  } catch (error) {
    console.error(`Journey evidence failed: ${error.message}`);
    process.exitCode = 1;
  }
}
