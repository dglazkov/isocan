#!/usr/bin/env node
/**
 * **Draft a route for every real ask that has none** (local-judge phase 1).
 *
 *   node scripts/local-judge/draft.mjs [--readings <file.json>] [--dir <dir>]
 *
 * A draft is never a label: it is what the review page shows a person first,
 * with where it came from beside it. Two sources, said on every row:
 *
 * - `agent-reading` — an agent read the ask and chose a route. `--readings`
 *   is a local JSON object `{ "<ask id>": "<route>" }` (kept outside any
 *   repository, like the set itself).
 * - `categoriseAsk` — no reading: the regex classifier's category, mapped
 *   (`baselineRoute`). Scoring judge A against these is circular, and the
 *   harness's DRAFT LABELS heading is there to say so.
 *
 * A row a person has reviewed is never touched. Prints counts only.
 */
import path from "node:path";
import { register } from "tsx/esm/api";
import { ASKS_FILE, argOf, judgeDir, readJson, refuseInRepo, writeJsonAtomic } from "./lib.mjs";

const arg = argOf(process.argv.slice(2));
const dir = path.resolve(arg("--dir", judgeDir()));
refuseInRepo(dir);
register();
const { baselineRoute, isRoute } = await import("@isocan/core/intent-route");

const file = path.join(dir, ASKS_FILE);
const asks = readJson(file, null);
if (!asks) throw new Error(`no real set at ${file} — \`node scripts/local-judge/export.mjs\` writes it`);
const readingsFile = arg("--readings", null);
const readings = readingsFile ? readJson(path.resolve(readingsFile), {}) : {};
for (const [id, r] of Object.entries(readings)) if (!isRoute(r)) throw new Error(`reading for ${id} is "${r}", not one of the seven routes`);

let fromReading = 0;
let fromBaseline = 0;
for (const row of asks.rows) {
  if (row.reviewedBy === "person") continue;
  if (readings[row.id]) {
    row.draft = { route: readings[row.id], source: "agent-reading", agreesWithCategoriseAsk: readings[row.id] === baselineRoute(row.body) };
    fromReading++;
  } else if (!row.draft) {
    row.draft = { route: baselineRoute(row.body), source: "categoriseAsk" };
    fromBaseline++;
  }
}
writeJsonAtomic(file, asks);
const byRoute = asks.rows.reduce((acc, r) => ((acc[r.draft?.route ?? "none"] = (acc[r.draft?.route ?? "none"] ?? 0) + 1), acc), {});
console.log(JSON.stringify({ file, rows: asks.rows.length, fromReading, fromBaseline, reviewed: asks.rows.filter((r) => r.reviewedBy === "person").length, draftsByRoute: byRoute }, null, 2));
