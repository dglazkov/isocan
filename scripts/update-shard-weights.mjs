#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Refresh the scheduling snapshot from one complete successful deep CI run.
 * Download test-profile-* artifacts, then pass their JSON paths here. Missing
 * shards, filtered runs and mixed revisions are refused before anything writes.
 * The snapshot is reviewed with code, never restored independently per runner.
 */
export function snapshotFrom(profiles) {
  if (!profiles.length) throw new Error("pass every test-profile.json from one successful sharded CI run");
  const first = profiles[0];
  if (!first.revision || !first.ciRun) throw new Error("profiles need a source revision and CI run identity");
  const count = Number(first.shard?.split("/")[1]);
  if (!Number.isInteger(count) || count < 1 || profiles.length !== count) throw new Error("missing shard profiles");
  const seen = new Set();
  const weights = {};
  for (const profile of profiles) {
    if (profile.revision !== first.revision || profile.ciRun !== first.ciRun || profile.workers !== first.workers ||
        profile.node !== first.node || profile.platform !== first.platform) {
      throw new Error("profiles must come from the same revision and runtime");
    }
    if (profile.lane !== "deep" || profile.filtered || profile.dirty || profile.failed !== 0 || profile.errors !== 0 || profile.reason !== "passed") {
      throw new Error("only complete successful deep runs can refresh shard weights");
    }
    const match = /^(\d+)\/(\d+)$/.exec(profile.shard ?? "");
    const index = Number(match?.[1]);
    if (!match || Number(match[2]) !== count || index < 1 || index > count || seen.has(index)) throw new Error("invalid or duplicate shard");
    seen.add(index);
    if (!Array.isArray(profile.fileDurations) || profile.fileDurations.length !== profile.files) throw new Error("incomplete file timings");
    for (const { file, ms, passed } of profile.fileDurations) {
      if (!file || Object.hasOwn(weights, file) || !Number.isFinite(ms) || ms < 0 || !passed) throw new Error(`invalid or duplicate timing: ${file}`);
      weights[file] = Math.max(1, ms);
    }
  }
  return {
    source: "Complete CI test-profile artifacts; refresh with node scripts/update-shard-weights.mjs <profiles...>",
    revision: first.revision,
    ciRun: first.ciRun,
    measuredAt: profiles.map((profile) => profile.at).sort().at(-1),
    weights: Object.fromEntries(Object.entries(weights).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = snapshotFrom(process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, "utf8"))));
  const target = fileURLToPath(new URL("../test/shard-weights.json", import.meta.url));
  writeFileSync(target, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`${Object.keys(snapshot.weights).length} file weights from ${snapshot.revision} → ${target}`);
}
