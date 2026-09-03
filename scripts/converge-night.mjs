#!/usr/bin/env node
/**
 * **The converge lane, one item wide** — step 3 of the night shift
 * (`docs/research/2026-08-24-the-night-shift.md`): one measured fix per
 * night, landed as a version, with the before and after in the reply, kept
 * or reverted by a person in the morning.
 *
 *   node scripts/converge-night.mjs --canvas <ref> [--dry-run] [--page docs/converge/<day>.md] [--model m]
 *
 * **What it may touch.** One item. It grades every screen on the canvas with
 * `grade.mjs`, picks the one with the most failing deterministic checks that
 * the lane has not touched in the last day, and asks an agent to fix exactly
 * those checks — in a temp directory, with `Read`, `Edit` and `Write` and
 * nothing else — then grades the result. It lands ONLY if every check it
 * set out to fix now passes, no other check regressed, and the visible words
 * are unchanged; otherwise the attempt is thrown away and the page says so.
 * A change the graders cannot vouch for is not this lane's to make.
 *
 * **How it lands, and how it is undone.** A new version on the item's stack
 * (`isocan edit`), a `converged` property recording the version and the
 * time (what `isocan evals converge` reads), and a reply on the item saying
 * the number before and after and how to say no: pick the previous version.
 * Undo is per-actor, so nothing here can ever revert a person's morning.
 *
 * **Why the budget is one.** Three converge items is a morning; forty is a
 * backlog, and a backlog is what this loop exists to prevent. One is where
 * the accept rate starts being measured, and the battery decides whether
 * tomorrow may do two.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { repo, visibleText } from "./lib/golden.mjs";

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const canvasRef = arg("--canvas");
const dry = argv.includes("--dry-run");
const model = arg("--model");
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const grader = path.join(repo, "scripts/grade.mjs");
const day = arg("--day") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const page = arg("--page") ?? path.join(repo, "docs/converge", `${day}.md`);

if (!canvasRef) { console.error("usage: converge-night.mjs --canvas <ref> [--dry-run] [--page file] [--model m]"); process.exit(2); }

const iso = (args, opts = {}) => execFileSync("node", [cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const isoJson = (args, opts) => JSON.parse(iso([...args, "--json"], opts));

/** The checks this lane is allowed to chase: mechanical, and fixable in the file. */
const TARGETS = ["no contrast failures", "every control named", "images have alt", "no stretched images", "no sideways scroll"];

function gradeFile(file) {
  const out = execFileSync("node", [grader, "--file", file, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
  return JSON.parse(out)[0];
}
const failing = (g) => TARGETS.filter((name) => g.checks[name] === false);

// ---- pick one ----

const canvas = isoJson(["canvas", "show", canvasRef]);
const canvasId = canvas.id ?? canvas.canvasId;
const listing = isoJson(["ls", "--canvas", canvasId]);
const items = (listing.items ?? listing).filter((i) => {
  const current = (i.versions ?? []).find((v) => v.id === i.currentVersionId) ?? (i.versions ?? []).at(-1);
  return current?.mimeType === "text/html";
});
const scratch = mkdtempSync(path.join(tmpdir(), "converge-"));
const recent = (item) => (item.properties?.converged ?? "").split(",").some((one) => { const at = one.indexOf("@"); return at >= 0 && Date.now() - Date.parse(one.slice(at + 1)) < 24 * 3600e3; });

const candidates = [];
for (const item of items) {
  if (recent(item)) continue; // one item wide, and never the same item two nights running
  // Under its own filename, so the version this lands keeps the name the
  // stack already has rather than the item's id.
  const current = (item.versions ?? []).find((v) => v.id === item.currentVersionId) ?? (item.versions ?? []).at(-1);
  const dir = path.join(scratch, item.id);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, current?.filename ?? `${item.id}.html`);
  iso(["get", item.id, file, "--canvas", canvasId]);
  const before = gradeFile(file);
  if (!before.renders) continue; // a page that does not render is a repair, not a converge
  const fails = failing(before);
  if (fails.length) candidates.push({ item, file, before, fails });
}
candidates.sort((a, b) => b.fails.length - a.fails.length);

const lines = [`# Converge lane — ${day}`, "", `Canvas **${canvas.title ?? canvasId}** (${canvasId}). ${items.length} screens graded; ${candidates.length} with a check this lane may chase.${dry ? " Dry run: nothing landed." : ""}`, ""];

if (candidates.length === 0) {
  lines.push("Nothing to converge: every screen passes the checks this lane knows how to fix, or the ones that fail were touched last night.");
  finish(0);
}

const pick = candidates[0];
const { item, file, before, fails } = pick;
lines.push(`## Picked: ${item.title} (${item.id})`, "", `Failing before: ${fails.map((f) => `**${f}**`).join(", ")}.`, "");
const detail = [];
if (before.checks["no contrast failures"] === false) detail.push(`contrast: ${Object.entries(before.contrastFailures).map(([w, n]) => `${n} at ${w}px`).join(", ")}; worst: ${before.worstContrast.slice(0, 5).map((c) => `${c.ratio} (needs ${c.need}) "${c.text}"`).join("; ")}`);
if (before.checks["every control named"] === false) detail.push(`${before.namelessControls} controls without an accessible name`);
if (before.checks["images have alt"] === false) detail.push(`${before.imagesWithoutAlt} images without alt`);
if (before.checks["no stretched images"] === false) detail.push(`stretched: ${before.stretchedDetail.map((s) => `${s.src} natural ${s.natural} rendered ${s.rendered}`).join("; ")}`);
if (before.checks["no sideways scroll"] === false) detail.push(`sideways scroll at ${before.sidewaysAt.join(", ")}px`);
lines.push(...detail.map((d) => `- ${d}`), "");

// ---- the attempt ----

const wordsBefore = visibleText(readFileSync(file, "utf8"));
const prompt = `The file ./${path.basename(file)} is a finished screen. A deterministic grader fails it on: ${fails.join("; ")}. Details: ${detail.join(" | ")}. ` +
  `Fix exactly these, in place, with the smallest change that does it: adjust colours toward the design tokens already in the file, add accessible names, add alt text, let images keep their aspect ratio, let the layout fit narrow widths. ` +
  `Do not change any visible words, remove anything, or restyle beyond what the fix needs. Edit the file and stop.`;
let agent = { turns: null, usd: null, secs: 0, model: null, stop: "dry" };
if (!dry) {
  const args = ["-p", prompt, "--output-format", "json", "--max-turns", "15", "--permission-mode", "bypassPermissions", "--allowedTools", "Read", "Edit", "Write"];
  if (model) args.push("--model", model);
  const started = Date.now();
  const res = spawnSync("claude", args, { cwd: scratch, encoding: "utf8", timeout: 8 * 60_000, env: { ...process.env, CLAUDECODE: "" }, maxBuffer: 1 << 26 });
  let report = {};
  try { report = JSON.parse(res.stdout); } catch { report = {}; }
  agent = { turns: report.num_turns ?? null, usd: report.total_cost_usd ?? null, secs: Math.round((Date.now() - started) / 1000), model: Object.keys(report.modelUsage ?? {}).filter((m) => !/haiku/.test(m)).join("+") || null, stop: report.terminal_reason ?? (res.status === null ? "timeout" : `exit ${res.status}`) };
}

// ---- the verdict ----

const after = dry ? before : gradeFile(file);
const stillFailing = fails.filter((name) => after.checks[name] !== true);
const regressed = Object.entries(after.checks).filter(([name, ok]) => ok === false && before.checks[name] !== false).map(([name]) => name);
const sameWords = visibleText(readFileSync(file, "utf8")) === wordsBefore;
const verdict = !dry && stillFailing.length === 0 && regressed.length === 0 && sameWords && after.renders;

lines.push(`## After`, "");
lines.push(`Agent: ${agent.turns ?? "—"} turns, ${agent.usd === null ? "—" : `$${agent.usd.toFixed(2)}`}, ${agent.secs}s, ${agent.model ?? "—"}, ${agent.stop}.`, "");
lines.push(`| check | before | after |`, `| --- | --- | --- |`);
for (const name of Object.keys(before.checks)) lines.push(`| ${name} | ${before.checks[name] ? "ok" : "FAIL"} | ${after.checks[name] ? "ok" : "FAIL"} |`);
lines.push("");
if (!sameWords) lines.push("- the visible words changed — not this lane's to land");
if (regressed.length) lines.push(`- regressed: ${regressed.join(", ")}`);
if (stillFailing.length) lines.push(`- still failing: ${stillFailing.join(", ")}`);
lines.push("");

if (!verdict) {
  lines.push(dry ? "**Dry run — nothing landed.**" : "**Discarded.** The attempt did not move every number it set out to move without moving another the wrong way, so nobody sees it. That is the lane working, not failing.");
  finish(0);
}

// ---- landing ----

// `edit` answers in words ("new version ver_… of itm_… (2 total)"), not JSON.
const edited = iso(["edit", item.id, file, "--canvas", canvasId]);
const stack = (isoJson(["ls", "--canvas", canvasId]).items ?? []).find((i) => i.id === item.id);
const versionId = edited.match(/ver_[\w-]+/)?.[0] ?? stack?.currentVersionId;
const at = new Date().toISOString();
const existing = item.properties?.converged ?? "";
iso(["set", item.id, "--prop", `converged=${existing && existing.trim() ? `${existing.trim()},` : ""}${versionId}@${at}`, "--canvas", canvasId]);
const summary = fails.map((name) => {
  if (name === "no contrast failures") return `contrast failures ${Object.values(before.contrastFailures).reduce((a, b) => a + b, 0)} → 0`;
  if (name === "every control named") return `nameless controls ${before.namelessControls} → 0`;
  if (name === "images have alt") return `images without alt ${before.imagesWithoutAlt} → 0`;
  if (name === "no stretched images") return `stretched images ${before.stretchedImages} → 0`;
  return `sideways scroll at ${before.sidewaysAt.join("/")}px → none`;
}).join("; ");
iso(["comment", "add", "--canvas", canvasId, "--item", item.id,
  `Converge · ${day}: ${summary}. Nothing else moved — same words, no other check changed. Keep it by doing nothing; say no by bringing the previous version back (fan out with F and pick it, or \`isocan version promote ${item.id} ${stack?.versions?.at(-2)?.id ?? "<previous>"}\`). \`isocan evals converge\` keeps the score.`]);
lines.push(`**Landed** as version \`${versionId}\` on ${item.title}, with a reply saying how to say no. \`isocan evals converge\` reads the verdict.`);
finish(0);

function finish(code) {
  mkdirSync(path.dirname(page), { recursive: true });
  const md = lines.join("\n") + "\n";
  writeFileSync(page, md);
  console.log(md);
  console.log(`page: ${path.relative(process.cwd(), page)}`);
  process.exit(code);
}
