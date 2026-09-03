#!/usr/bin/env node
/**
 * **Skill lift, not vibes** — Stage 5 of `docs/projects/evals/plan.md`.
 *
 * Three numbers per skill, never one: does it FIRE (the agent did the thing
 * the skill is for), does it HELP (the same task with and without the skill,
 * same fixture, same model, and the difference in what the graders say), and
 * what does it COST (turns, tokens, dollars, seconds). A skill with +3%
 * quality and +80% cost is a bad trade that a quality-only score hides.
 *
 *   node scripts/lift.mjs --skill isocan-collab [--tasks a,b,c] [--model m] [--max-turns 25] [--out dir] [--page docs/lift/x.md]
 *   node scripts/lift.mjs --skill sprint [--model m]
 *   node scripts/lift.mjs --skill isocan-collab --dry-run       # the plumbing, no model
 *
 * **How a run is held equal.** Every condition gets the same scratch canvas
 * shape (a fresh canvas at the home, the golden fixture placed as an item,
 * the ask posted as a comment anchored to it, a working directory bound to
 * the canvas with the file copied in), the same prompt, the same model and
 * turn budget, the same tools — `Read`, `Write`, `Edit`, `Glob`, `Grep`, and
 * `Bash` restricted to `isocan …`. The ONLY difference is the skill: for
 * `isocan-collab`, its SKILL.md appended to the system prompt; for `sprint`,
 * the `/sprint` command's own text (what an agent receives when a person
 * types it) instead of a plain sentence asking for the same thing.
 *
 * **What is graded.** For `isocan-collab`, two artifacts per run: the item's
 * current version on the canvas (the deliverable the skill is FOR), and the
 * file in the working directory (what an agent without the skill tends to
 * produce). Both go through `golden.mjs`; the canvas one is the lift that
 * counts, and "fires" is whether the item gained a version at all. For
 * `sprint`, the canvas after the run: eleven sheets in reading order and a
 * brief, which is what the skill's setup step promises.
 *
 * **Nothing here is scored.** Pass/fail per check, counts, and dollars,
 * printed side by side, so the reader can see a skill that helps a little
 * and costs a lot. The model is recorded from the run's own report, because
 * lift is not a property of the skill alone.
 *
 * Scratch canvases are deleted at the end (recoverable by hand, as `canvas
 * delete` says). The agent runs with permissions bypassed INSIDE a temp
 * directory and with Bash limited to isocan — a deliberately narrow room.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSuite, repo } from "./lib/golden.mjs";

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const skill = arg("--skill");
const dry = argv.includes("--dry-run");
const model = arg("--model");
const maxTurns = Number(arg("--max-turns") ?? 25);
const out = arg("--out") ?? mkdtempSync(path.join(tmpdir(), "lift-"));
const page = arg("--page");
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const golden = path.join(repo, "scripts/golden.mjs");
const PILOT = ["revise-heading", "create-empty-state", "repair-contrast", "arrange-sections"];

if (!["isocan-collab", "sprint"].includes(skill)) {
  console.error("usage: lift.mjs --skill isocan-collab|sprint [--tasks a,b] [--model m] [--max-turns n] [--out dir] [--page file] [--dry-run]");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const iso = (args, opts = {}) => execFileSync("node", [cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const isoJson = (args, opts) => JSON.parse(iso([...args, "--json"], opts));

/** One agent run in `cwd`, as `claude -p`; the report is the CLI's own JSON. */
function runAgent(cwd, prompt, systemFile) {
  const args = ["-p", prompt, "--output-format", "json", "--max-turns", String(maxTurns), "--permission-mode", "bypassPermissions",
    "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "Bash(isocan:*)"];
  if (model) args.push("--model", model);
  if (systemFile) args.push("--append-system-prompt-file", systemFile);
  const started = Date.now();
  const res = spawnSync("claude", args, { cwd, encoding: "utf8", timeout: 8 * 60_000, env: { ...process.env, CLAUDECODE: "" }, maxBuffer: 1 << 26 });
  const secs = Math.round((Date.now() - started) / 1000);
  let report = {};
  try { report = JSON.parse(res.stdout); } catch { report = { parse_error: (res.stdout || "").slice(0, 200), stderr: (res.stderr || "").slice(0, 400) }; }
  const usage = report.usage ?? {};
  const tokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  return {
    turns: report.num_turns ?? null,
    tokens,
    usd: report.total_cost_usd ?? null,
    secs,
    model: Object.keys(report.modelUsage ?? {}).filter((m) => !/haiku/.test(m)).join("+") || null,
    stop: report.terminal_reason ?? report.stop_reason ?? (res.status === null ? "timeout" : `exit ${res.status}`),
    error: report.parse_error ? `${report.parse_error} ${report.stderr}`.trim() : null,
  };
}

/** golden.mjs's verdict on one artifact. */
function grade(taskId, file) {
  if (!file || !existsSync(file)) return { pass: false, n: 0, of: 0, missing: true };
  const res = spawnSync("node", [golden, "--task", taskId, "--file", file, "--json"], { encoding: "utf8", timeout: 240_000 });
  try {
    const g = JSON.parse(res.stdout).graded[0];
    const rows = g.rows.filter((r) => r.ok !== null);
    return { pass: g.pass, n: rows.filter((r) => r.ok).length, of: rows.length, failed: rows.filter((r) => !r.ok).map((r) => r.name) };
  } catch { return { pass: false, n: 0, of: 0, error: (res.stderr || res.stdout || "").slice(0, 200) }; }
}

const results = [];

if (skill === "isocan-collab") {
  const suite = loadSuite();
  const wanted = (arg("--tasks") ?? PILOT.join(",")).split(",").filter(Boolean);
  const skillFile = path.join(repo, ".agents/skills/isocan-collab/SKILL.md");
  for (const id of wanted) {
    const task = suite.tasks.find((t) => t.id === id);
    if (!task) { console.error(`no golden task ${id}`); process.exit(2); }
    if (task.type === "markdown") { console.error(`${id}: a markdown task has no item to version — skipped`); continue; }
    for (const cond of ["without", "with"]) {
      const label = `${id} · ${cond}`;
      const { canvasId } = isoJson(["canvas", "create", `lift · ${id} · ${cond}`]);
      const workdir = path.join(out, `${id}-${cond}`);
      mkdirSync(workdir, { recursive: true });
      const fileName = path.basename(task.fixture);
      cpSync(task.fixturePath, path.join(workdir, fileName));
      const added = isoJson(["add", task.fixturePath, "--canvas", canvasId, "--title", task.id, "--at", "0,0"]);
      const itemId = added.itemId ?? added.id;
      iso(["comment", "add", "--canvas", canvasId, "--item", itemId, task.ask]);
      iso(["use", canvasId], { cwd: workdir });
      const prompt = `This directory is bound to an isocan canvas. The item ${itemId} ("${task.id}") on it has a comment asking for a change: "${task.ask}". ` +
        `Make the change. The item's file is also here as ./${fileName}. The deliverable is the changed screen on the canvas, as a new version of that item. ` +
        // Said to BOTH conditions, because the collab skill's lap ends by
        // parking on `isocan wait` for the next comment — right for a
        // session, and in a one-shot run it waited out the whole budget
        // after the work was done (measured: 900 s, deliverable landed at
        // minute two). The control has to end the same way the treatment
        // does, so both are told this is a one-shot job.
        `This is a one-shot job: when the new version is on the canvas and you have replied to the comment, stop — do not park or wait for further feedback.`;
      const before = Date.now();
      const agent = dry ? { turns: 0, tokens: 0, usd: 0, secs: 0, model: "dry-run", stop: "dry" } : runAgent(workdir, prompt, cond === "with" ? skillFile : null);
      // Artifacts: the canvas's current version of the item, and the file.
      const snapshot = isoJson(["ls", "--canvas", canvasId]);
      const items = snapshot.items ?? snapshot;
      const item = items.find((i) => i.id === itemId);
      const versions = item?.versions?.length ?? 0;
      const fromCanvas = path.join(workdir, "from-canvas.html");
      try { iso(["get", itemId, fromCanvas, "--canvas", canvasId]); } catch {}
      const threads = isoJson(["comment", "list", "--canvas", canvasId]);
      const replies = (Array.isArray(threads) ? threads : threads.threads ?? []).reduce((s, t) => s + Math.max(0, (t.comments?.length ?? 1) - 1), 0);
      const row = {
        skill, task: id, kind: task.kind, cond, canvasId, itemId,
        fires: versions > 1,
        replied: replies > 0,
        canvas: grade(id, versions > 1 ? fromCanvas : null),
        file: grade(id, path.join(workdir, fileName)),
        ...agent,
        wall: Math.round((Date.now() - before) / 1000),
      };
      results.push(row);
      console.log(`${label}: ${row.fires ? "landed on the canvas" : "no new version"}${row.replied ? ", replied" : ""}; canvas ${row.canvas.n}/${row.canvas.of}${row.canvas.pass ? " PASS" : ""}; file ${row.file.n}/${row.file.of}${row.file.pass ? " PASS" : ""}; ${row.turns ?? "?"} turns, $${row.usd?.toFixed?.(2) ?? "?"}, ${row.secs}s, ${row.model ?? ""}${row.error ? `  ERROR ${row.error}` : ""}`);
      try { iso(["canvas", "delete", canvasId, "--force"]); } catch {}
    }
  }
}

if (skill === "sprint") {
  const commandText = iso(["command", "show", "sprint"]);
  const withFile = path.join(out, "sprint-command.md");
  writeFileSync(withFile, commandText);
  for (const cond of ["without", "with"]) {
    const { canvasId } = isoJson(["canvas", "create", `lift · sprint · ${cond}`]);
    const workdir = path.join(out, `sprint-${cond}`);
    mkdirSync(workdir, { recursive: true });
    iso(["use", canvasId], { cwd: workdir });
    const prompt = cond === "with"
      ? "A person on this canvas typed: /sprint"
      : "A person on this canvas asked: set this canvas up for a five-day design sprint, so a team can start tomorrow morning.";
    const before = Date.now();
    const agent = dry ? { turns: 0, tokens: 0, usd: 0, secs: 0, model: "dry-run", stop: "dry" } : runAgent(workdir, prompt, cond === "with" ? withFile : null);
    let areas = [];
    try { const a = isoJson(["area", "ls", "--canvas", canvasId]); areas = Array.isArray(a) ? a : a.areas ?? []; } catch {}
    let items = [];
    try { const s = isoJson(["ls", "--canvas", canvasId]); items = s.items ?? s; } catch {}
    const names = areas.map((a) => (a.title ?? a.name ?? "").toLowerCase());
    const phases = ["brief", "map", "target", "sketch", "vote", "storyboard", "prototype", "test", "wrap"];
    const phasesLaid = phases.filter((p) => names.some((n) => n.includes(p))).length;
    const brief = items.some((i) => /brief/i.test(i.title ?? "") || i.properties?.board !== undefined || i.properties?.sprint !== undefined);
    const row = {
      skill, cond, canvasId,
      fires: areas.length >= 11,
      areas: areas.length, phasesLaid, brief,
      pass: areas.length >= 11 && phasesLaid >= 8 && brief,
      ...agent,
      wall: Math.round((Date.now() - before) / 1000),
    };
    results.push(row);
    console.log(`sprint · ${cond}: ${row.areas} sheets, ${row.phasesLaid}/9 phases named, brief ${row.brief ? "yes" : "no"}${row.pass ? "  PASS" : ""}; ${row.turns ?? "?"} turns, $${row.usd?.toFixed?.(2) ?? "?"}, ${row.secs}s, ${row.model ?? ""}${row.error ? `  ERROR ${row.error}` : ""}`);
    try { iso(["canvas", "delete", canvasId, "--force"]); } catch {}
  }
}

// ---- the three numbers ----

const byCond = (cond) => results.filter((r) => r.cond === cond);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const summary = {};
for (const cond of ["without", "with"]) {
  const rows = byCond(cond);
  summary[cond] = {
    runs: rows.length,
    fires: rows.filter((r) => r.fires).length,
    pass: rows.filter((r) => (skill === "sprint" ? r.pass : r.canvas.pass)).length,
    filePass: skill === "sprint" ? null : rows.filter((r) => r.file.pass).length,
    meanTurns: mean(rows.map((r) => r.turns).filter((n) => n !== null)),
    meanUsd: mean(rows.map((r) => r.usd).filter((n) => n !== null)),
    meanSecs: mean(rows.map((r) => r.secs)),
    models: [...new Set(rows.map((r) => r.model).filter(Boolean))],
  };
}
const fmt = (n, d = 2) => (n === null || n === undefined ? "—" : typeof n === "number" ? n.toFixed(d) : String(n));
const lines = [];
lines.push(`# Skill lift — ${skill}`, "", `Measured ${new Date().toISOString().slice(0, 10)}${model ? `, model asked for: ${model}` : ""}. Same fixtures, same prompt, same tools and turn budget (${maxTurns}); the skill is the only difference. Not a score.`, "");
lines.push("| | without | with |", "| --- | --- | --- |");
lines.push(`| runs | ${summary.without.runs} | ${summary.with.runs} |`);
lines.push(`| **fires** — ${skill === "sprint" ? "eleven sheets laid" : "the item gained a version"} | ${summary.without.fires} | ${summary.with.fires} |`);
lines.push(`| **helps** — ${skill === "sprint" ? "board complete" : "canvas version passes its golden task"} | ${summary.without.pass} | ${summary.with.pass} |`);
if (skill !== "sprint") lines.push(`| the file passes (whatever reached the canvas) | ${summary.without.filePass} | ${summary.with.filePass} |`);
lines.push(`| **costs** — mean turns | ${fmt(summary.without.meanTurns, 1)} | ${fmt(summary.with.meanTurns, 1)} |`);
lines.push(`| mean $ | ${fmt(summary.without.meanUsd)} | ${fmt(summary.with.meanUsd)} |`);
lines.push(`| mean seconds | ${fmt(summary.without.meanSecs, 0)} | ${fmt(summary.with.meanSecs, 0)} |`);
lines.push(`| model, as reported | ${summary.without.models.join(", ") || "—"} | ${summary.with.models.join(", ") || "—"} |`, "");
lines.push("## Every run", "");
if (skill === "sprint") {
  lines.push("| condition | sheets | phases named | brief | pass | turns | $ | s | stop |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results) lines.push(`| ${r.cond} | ${r.areas} | ${r.phasesLaid}/9 | ${r.brief ? "yes" : "no"} | ${r.pass ? "yes" : "no"} | ${fmt(r.turns, 0)} | ${fmt(r.usd)} | ${r.secs} | ${r.stop} |`);
} else {
  lines.push("| task | kind | condition | landed | replied | canvas | file | turns | $ | s | stop |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results) lines.push(`| ${r.task} | ${r.kind} | ${r.cond} | ${r.fires ? "yes" : "no"} | ${r.replied ? "yes" : "no"} | ${r.canvas.n}/${r.canvas.of}${r.canvas.pass ? " ✓" : ""} | ${r.file.n}/${r.file.of}${r.file.pass ? " ✓" : ""} | ${fmt(r.turns, 0)} | ${fmt(r.usd)} | ${r.secs} | ${r.stop} |`);
  const failed = results.flatMap((r) => (r.canvas.failed ?? []).map((f) => `${r.task} · ${r.cond}: ${f}`));
  if (failed.length) lines.push("", "Checks the canvas version failed:", "", ...failed.map((f) => `- ${f}`));
}
const md = lines.join("\n") + "\n";
writeFileSync(path.join(out, "lift.json"), JSON.stringify({ skill, model: model ?? null, maxTurns, summary, results }, null, 2));
writeFileSync(path.join(out, "lift.md"), md);
if (page) { mkdirSync(path.dirname(page), { recursive: true }); writeFileSync(page, md); }
console.log(`\n${md}\nwritten to ${out}${page ? ` and ${page}` : ""}`);
