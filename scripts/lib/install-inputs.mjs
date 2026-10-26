import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Shared by the producer and read-only planner: a stage list alone does not
 * identify the workflow, test switches, setup implementation or harness. */
export function installInputDigests(root = fileURLToPath(new URL("../../", import.meta.url))) {
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const digest = (files) => hash(JSON.stringify(files.map((file) => [file, hash(readFileSync(path.join(root, file)))])));
  return {
    lock: digest(["package-lock.json"]),
    setup: digest(["package.json", ".nvmrc", ".github/actions/suite-setup/action.yml", "scripts/install-watchdog.mjs", "scripts/lib/install-watchdog.mjs", "scripts/lib/install-inputs.mjs", "scripts/prepare.mjs"]),
    manifest: digest([".github/workflows/pr.yml", ".github/workflows/release.yml", "scripts/test-ci.mjs", "scripts/switches.mjs", "vitest.config.ts", "test/deep.ts", "test/shard-sequencer.ts", "test/shard-weights.json"]),
  };
}
