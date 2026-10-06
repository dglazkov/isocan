#!/usr/bin/env node
/**
 * **isocan's measures, as a Loop context.** Prints JSON to stdout; keel's
 * `scripts/loop.mjs push` runs this (`.keel/keel.json` "loop" "contexts",
 * source `isocan:measures`) and sends what it prints to Loop.
 *
 *   node scripts/loop-measures.mjs
 *
 * The measures that are cheap, deterministic and about the code — read through
 * `measure.mjs`, the one place those numbers are defined. An instrument that
 * would not run is reported as such, never as a zero. The telemetry context is
 * the repo's own numbers rather than an oplog digest on purpose: that would
 * carry what people did on their canvases to a third party, and that is a
 * decision, not a default.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const MEASURES = [
  ["op-types", "operations in the vocabulary; every one is a fact both surfaces must speak"],
  ["web-only-ops", "operations a person can send and an agent cannot; the isomorphism, as a number"],
  ["core-runtime-deps", "runtime dependencies of @isocan/core; the reducer must stay portable"],
  ["colour-literals", "colours written as literals where a token exists"],
  ["unused-exports", "exports nothing outside their own file uses"],
  ["undocumented-exports", "exports with no comment above them"],
  ["registry-lines", "lines in the files every feature must edit"],
  ["copy-tells", "user-facing strings that trip a greppable copy rule"],
];

function measures() {
  const out = MEASURES.map(([name, meaning]) => {
    try {
      const value = Number(execFileSync(process.execPath, [path.join(ROOT, "scripts", "measure.mjs"), name], { cwd: ROOT, encoding: "utf8", timeout: 240_000 }).trim());
      return Number.isFinite(value) ? { measure: name, meaning, value } : { measure: name, meaning, error: "instrument printed no number" };
    } catch {
      return { measure: name, meaning, error: "instrument would not run" };
    }
  });
  return {
    kind: "isocan-measures",
    guidance:
      "Deterministic counts taken from the repository on one day, each reproducible with `node scripts/measure.mjs <measure>`. " +
      "A measure with an `error` did not run and says nothing. Ratchet-style counts (unused, undocumented, colour literals) " +
      "matter as a direction over days, not as one reading.",
    day: new Date().toISOString().slice(0, 10),
    measures: out,
  };
}

process.stdout.write(JSON.stringify(measures()) + "\n");
