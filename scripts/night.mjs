#!/usr/bin/env node
/**
 * **The night, and the morning comment** — step 2 of the night shift
 * (`docs/research/2026-08-24-the-night-shift.md`), run after step 3: one
 * agent, one canvas, one comment in the Chat saying what the night measured
 * and what it landed. Three lines, `#Title` handles, a summary with handles
 * rather than a report — a person reads it in the time it takes to decide.
 *
 *   node scripts/night.mjs --canvas <ref> [--canvas <ref>…] [--dry-run] [--model m]
 *   npm run night -- --canvas "Lake House"
 *
 * Per canvas: the converge lane runs (`converge-night.mjs`, one item wide,
 * verified before it lands), then the comment. The night is its own actor —
 * **Night**, harness `night`, one stable session key — so the morning can
 * tell the night's work from a person's, `isocan evals converge` can say
 * who landed what, and the registry knows it for an agent. Claim it once on
 * the machine that runs this:
 *
 *   ISOCAN_HARNESS=night ISOCAN_SESSION_ID=isocan-night isocan identity --name Night --session
 *
 * **The budget is enforced here, not hoped for.** One landing per canvas per
 * night is what the lane allows; this posts exactly one comment per canvas,
 * and a dry run posts nothing at all. Forty comments is a backlog, and a
 * backlog is what this loop exists to prevent.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

// The board's trick: register tsx so the workspace's TypeScript sources
// import directly, then load the API — dynamic, so the register runs first.
register();
const { connect } = await import("@isocan/api");

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const refs = argv.flatMap((a, i) => (a === "--canvas" && argv[i + 1] ? [argv[i + 1]] : []));
const dry = argv.includes("--dry-run");
const model = (() => { const i = argv.indexOf("--model"); return i >= 0 ? argv[i + 1] : undefined; })();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

if (refs.length === 0) { console.error("usage: night.mjs --canvas <ref> [--canvas <ref>…] [--dry-run] [--model m]"); process.exit(2); }

/** One actor for every night, whoever set it off — the board's discipline. */
export const NIGHT_IDENTITY = { session: process.env.ISOCAN_NIGHT_SESSION ?? "isocan-night", harness: "night" };
const CLAIM = `ISOCAN_HARNESS=${NIGHT_IDENTITY.harness} ISOCAN_SESSION_ID=${NIGHT_IDENTITY.session} isocan identity --name Night --session`;

let home;
try {
  home = await connect({ identity: NIGHT_IDENTITY });
} catch (err) {
  console.error(`night: cannot be Night here — ${(err && err.message) || err}\nclaim it once: ${CLAIM}`);
  process.exit(2);
}

/** The lane, as a subprocess, acting as Night: its CLI calls read the same
 *  two variables `connect({ identity })` spells as an argument. */
function runLane(canvasId, page) {
  const args = [path.join(repo, "scripts/converge-night.mjs"), "--canvas", canvasId, "--page", page];
  if (dry) args.push("--dry-run");
  if (model) args.push("--model", model);
  const res = spawnSync("node", args, {
    encoding: "utf8",
    timeout: 20 * 60_000,
    env: { ...process.env, ISOCAN_HARNESS: NIGHT_IDENTITY.harness, ISOCAN_SESSION_ID: NIGHT_IDENTITY.session },
    maxBuffer: 1 << 26,
  });
  let md = "";
  try { md = readFileSync(page, "utf8"); } catch {}
  return { ok: res.status === 0, md, stderr: (res.stderr || "").slice(-400) };
}

/** Three lines from the lane's page — the summary with handles. */
function morning(md, lane) {
  const graded = md.match(/(\d+) screens graded; (\d+) with a check/);
  const picked = md.match(/## Picked: (.+?) \((itm_[\w-]+)\)/);
  const landed = md.match(/\*\*Landed\*\* as version `(ver_[\w-]+)`/);
  const failing = md.match(/Failing before: (.+)\./);
  const first = graded
    ? `Night · ${day}: graded ${graded[1]} screen${graded[1] === "1" ? "" : "s"}; ${graded[2]} had a check I know how to fix.`
    : `Night · ${day}: the lane could not run here${lane.stderr ? ` — ${lane.stderr.split("\n").filter(Boolean).at(-1)}` : ""}.`;
  let second;
  if (landed && picked) second = `Landed one: #${picked[1]} — ${(failing?.[1] ?? "a failing check").replace(/\*\*/g, "")} now passes, nothing else moved. Say no by bringing the previous version back (fan out with F and pick it).`;
  else if (picked && /\*\*Discarded\.\*\*/.test(md)) second = `Tried #${picked[1]} and threw it away: the fix did not move every number the right way, so nobody sees it.`;
  else if (picked && dry) second = `Would have picked #${picked[1]} (${(failing?.[1] ?? "").replace(/\*\*/g, "")}) — dry run, nothing touched.`;
  else if (/Nothing to converge/.test(md)) second = "Nothing to fix: every screen passes the checks I know, or the ones that fail were touched last night.";
  else second = "Nothing landed.";
  const third = "`isocan evals converge` keeps the score; `isocan activity` is the long version.";
  return [first, second, third].join("\n");
}

const results = [];
for (const ref of refs) {
  const canvas = await home.canvas(ref);
  const page = path.join(repo, "docs/converge", `${day}-${canvas.id}.md`);
  const lane = runLane(canvas.id, page);
  const text = morning(lane.md, lane);
  results.push({ canvas: canvas.title, id: canvas.id, page: path.relative(repo, page), posted: !dry, text });
  if (!dry) await canvas.notify(text);
  console.log(`\n${canvas.title} (${canvas.id})${dry ? " — dry run, not posted" : ""}\n${text}`);
}
console.log(`\n${results.length} canvas${results.length === 1 ? "" : "es"}, ${dry ? "nothing posted" : "one comment each"}; pages in docs/converge/`);
