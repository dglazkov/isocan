#!/usr/bin/env node
/**
 * **Calibrate a judge against the choices people already made.**
 *
 * Stage 4 of docs/projects/evals/plan.md: "calibrate against human labels, and
 * report the agreement" — and "the human labels are already here": every
 * time somebody made an EARLIER version of an item current again while later
 * ones existed, they looked at N things and kept one. `isocan evals pairs`
 * harvests those. This script shows a judge each pair, with the order
 * shuffled so position teaches it nothing, asks which a careful reviewer
 * would keep and why, and reports how often it agreed with the person —
 * with Cohen's κ against the coin the shuffle makes chance into, and the cost.
 *
 * The number is published on a dated page beside the method, because a
 * judge whose agreement has never been measured is a number with a
 * decorative relationship to quality — and a judge measured on a dozen pairs
 * is a first reading, which the page says in as many words.
 *
 *   node scripts/calibrate.mjs --all                 # every canvas at the home
 *   node scripts/calibrate.mjs --canvas prj_x --canvas prj_y
 *   node scripts/calibrate.mjs --all --dry-run       # list the comparisons, ask nothing
 *
 * It reads through the CLI — pairs, items, files — so it needs no badge of
 * its own and no API; the judge is `claude -p` with Read as its only tool,
 * the way the converge lane runs its agent. NOTHING IS WRITTEN TO ANY CANVAS.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const args = (name) => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
const all = argv.includes("--all");
const dry = argv.includes("--dry-run");
/** The first run's other lesson: 16 of 30 comparisons at one home were an
 *  agent keeping its own earlier take. A person's choice is the label; an
 *  agent's is something else, kept out unless asked for. */
const includeAgents = argv.includes("--include-agents");
/** Choosers to leave out by name or id. The registry calls an actor an agent
 *  only when its claim came through an agent's harness; an agent that
 *  drives the CLI as itself wears a person's harness and reads as a person
 *  (Admiral One, 4 Sep), so the honest tool is to say so by name. */
const excluded = new Set(args("--exclude"));
const model = arg("--model");
const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;
const day = arg("--day") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const page = arg("--page") ?? path.join(repo, "docs/calibration", `${day}.md`);
const cli = path.join(repo, "packages/cli/bin/isocan.js");

const iso = (a, opts = {}) => execFileSync("node", [cli, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26, ...opts });
const isoJson = (a, opts) => JSON.parse(iso([...a, "--json"], opts));

let canvases = args("--canvas");
if (all) canvases = isoJson(["canvas", "list", "--all"]).map((c) => c.id);
if (canvases.length === 0) { console.error("usage: calibrate.mjs (--all | --canvas <ref> ...) [--dry-run] [--limit n] [--model m] [--page file] [--exclude <actor>]... [--include-agents]"); process.exit(2); }

/** What a judge can be shown: text it can read, or an image it can look at.
 *  Video and the rest are skipped and counted, not guessed at. */
const judgeable = (mime) => /^(text\/|image\/|application\/(json|svg))/.test(mime);
const ext = (filename, mime) => path.extname(filename) || (mime.startsWith("image/") ? `.${mime.split("/")[1]}` : ".txt");

// ---- the comparisons: one per (chosen, not-chosen) at the moment of the choice ----

const scratch = mkdtempSync(path.join(tmpdir(), "calibrate-"));
const comparisons = [];
const skipped = [];
const byAgents = [];
let seed = 7;
const flip = () => { seed = (seed * 48271) % 2147483647; return seed % 2 === 0; };

for (const canvasId of canvases) {
  let pairs;
  try { pairs = isoJson(["evals", "pairs", "--canvas", canvasId]); } catch { continue; }
  if (pairs.length === 0) continue;
  const items = new Map(isoJson(["ls", "--canvas", canvasId]).map((item) => [item.id, item]));
  const title = (() => { try { return isoJson(["canvas", "list", "--all"]).find((c) => c.id === canvasId)?.title ?? canvasId; } catch { return canvasId; } })();
  for (const pair of pairs) {
    if ((pair.chosenByKind === "agent" && !includeAgents) || excluded.has(pair.chosenBy) || excluded.has(pair.chosenById)) {
      byAgents.push({ canvasId, itemId: pair.itemId, title: pair.title, who: pair.chosenBy, n: pair.against.length, why: pair.chosenByKind === "agent" ? "the registry says agent" : "excluded by name" });
      continue;
    }
    const item = items.get(pair.itemId);
    if (!item) { skipped.push({ canvasId, itemId: pair.itemId, why: "item no longer on the canvas" }); continue; }
    const version = (id) => item.versions.find((v) => v.id === id);
    const chosen = version(pair.chosen);
    if (!chosen) { skipped.push({ canvasId, itemId: pair.itemId, why: "chosen version gone" }); continue; }
    for (const otherId of pair.against) {
      const other = version(otherId);
      if (!other) { skipped.push({ canvasId, itemId: pair.itemId, why: `version ${otherId} gone` }); continue; }
      if (!judgeable(chosen.mimeType) || !judgeable(other.mimeType)) { skipped.push({ canvasId, itemId: pair.itemId, why: `${chosen.mimeType} / ${other.mimeType} — not something a judge can read` }); continue; }
      // The first run's lesson: two versions with the same bytes are not a
      // choice, and asking a judge to pick between them buys a coin flip.
      if (chosen.blobHash === other.blobHash) { skipped.push({ canvasId, itemId: pair.itemId, why: `${chosen.id} and ${other.id} are the same bytes — no choice to judge` }); continue; }
      if (comparisons.length >= limit) break;
      // Shuffled: the human's pick is A or B by a coin, so a judge that always
      // says A scores chance, and chance is what κ is measured against.
      const humanIsA = flip();
      const dir = path.join(scratch, `${comparisons.length + 1}`);
      mkdirSync(dir);
      const files = {
        A: path.join(dir, `A${ext(humanIsA ? chosen.filename : other.filename, humanIsA ? chosen.mimeType : other.mimeType)}`),
        B: path.join(dir, `B${ext(humanIsA ? other.filename : chosen.filename, humanIsA ? other.mimeType : chosen.mimeType)}`),
      };
      if (!dry) {
        iso(["get", pair.itemId, files.A, "--rev", humanIsA ? chosen.id : other.id, "--canvas", canvasId]);
        iso(["get", pair.itemId, files.B, "--rev", humanIsA ? other.id : chosen.id, "--canvas", canvasId]);
      }
      comparisons.push({ canvasId, canvasTitle: title, itemId: pair.itemId, itemTitle: pair.title, chosenBy: pair.chosenBy, chosenAt: pair.chosenAt, chosen: chosen.id, other: other.id, mime: chosen.mimeType, humanIsA, dir, files });
    }
  }
}

// ---- the judge ----

function ask(c) {
  const prompt =
    `Two versions of one item on a design canvas, titled "${c.itemTitle}". They are the files ./${path.basename(c.files.A)} (A) and ./${path.basename(c.files.B)} (B) in this directory; read both (an image is a screen — look at it). ` +
    `A careful reviewer looked at both and kept exactly one. Your job is to say which, and to be wrong out loud rather than vaguely right: first state the strongest case AGAINST each version, citing a specific line, element, colour or word; then pick. ` +
    `If you cannot tell them apart in any way a reviewer would care about, say so and pick with low confidence. ` +
    `Answer with ONE JSON object and nothing else: {"pick":"A"|"B","confidence":<0..1>,"because":["<a cited reason>", ...]}`;
  const a = ["-p", prompt, "--output-format", "json", "--max-turns", "8", "--permission-mode", "bypassPermissions", "--allowedTools", "Read"];
  if (model) a.push("--model", model);
  const started = Date.now();
  const res = spawnSync("claude", a, { cwd: c.dir, encoding: "utf8", timeout: 6 * 60_000, env: { ...process.env, CLAUDECODE: "" }, maxBuffer: 1 << 26 });
  let report = {};
  try { report = JSON.parse(res.stdout); } catch { report = {}; }
  const text = typeof report.result === "string" ? report.result : "";
  let verdict = null;
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { verdict = JSON.parse(m[0]); } catch { verdict = null; } }
  return {
    pick: verdict?.pick === "A" || verdict?.pick === "B" ? verdict.pick : null,
    confidence: typeof verdict?.confidence === "number" ? verdict.confidence : null,
    because: Array.isArray(verdict?.because) ? verdict.because.filter((s) => typeof s === "string") : [],
    usd: report.total_cost_usd ?? null,
    turns: report.num_turns ?? null,
    secs: Math.round((Date.now() - started) / 1000),
    model: Object.keys(report.modelUsage ?? {}).filter((mm) => !/haiku/.test(mm)).join("+") || null,
    stop: report.terminal_reason ?? (res.status === null ? "timeout" : res.status === 0 ? "completed" : `exit ${res.status}`),
  };
}

for (const c of comparisons) {
  c.judge = dry ? null : ask(c);
  if (c.judge) {
    c.agrees = c.judge.pick === null ? null : c.judge.pick === (c.humanIsA ? "A" : "B");
    console.error(`${c.canvasTitle} · ${c.itemTitle}: judge ${c.judge.pick ?? "—"} (${c.judge.confidence ?? "—"}), person ${c.humanIsA ? "A" : "B"} → ${c.agrees === null ? "no answer" : c.agrees ? "agree" : "DISAGREE"}`);
  }
}

// ---- the reading ----

const answered = comparisons.filter((c) => c.agrees !== null && c.judge);
const agreed = answered.filter((c) => c.agrees).length;
const acc = answered.length ? agreed / answered.length : null;
// Two raters, two labels, and the shuffle makes the judge's marginal a coin
// in expectation, so chance agreement is 1/2 and κ = 2·acc − 1.
const kappa = acc === null ? null : 2 * acc - 1;
const usd = comparisons.reduce((s, c) => s + (c.judge?.usd ?? 0), 0);
const pairCount = new Set(comparisons.map((c) => `${c.itemId}:${c.chosenAt}`)).size;

const lines = [];
lines.push(`# Judge calibration — ${day}`, "");
lines.push(
  `${canvases.length} canvas${canvases.length === 1 ? "" : "es"} read; **${pairCount} preference pair${pairCount === 1 ? "" : "s"}** (a person keeping an earlier version while later ones existed), ` +
    `**${comparisons.length} comparison${comparisons.length === 1 ? "" : "s"}** (the kept version against each it beat), ${skipped.length} skipped` +
    (byAgents.length > 0 ? `, and ${byAgents.length} pair${byAgents.length === 1 ? "" : "s"} where the chooser was an agent left out (${byAgents.reduce((s, p) => s + p.n, 0)} comparisons; \`--include-agents\` reads them)` : "") +
    ".",
  "",
);
if (dry) {
  lines.push("Dry run — the comparisons are listed and the judge was not asked.", "");
} else {
  lines.push(
    `**Agreement ${acc === null ? "—" : `${agreed}/${answered.length} = ${(acc * 100).toFixed(0)}%`} · κ ${kappa === null ? "—" : kappa.toFixed(2)}** against chance 0.5 (the shuffle) · $${usd.toFixed(2)} · ${comparisons.filter((c) => c.judge?.pick === null).length} unanswered.`,
    "",
    answered.length < 30
      ? `**A first reading, not a calibration.** ${answered.length} comparisons cannot separate a judge from a coin with any confidence (κ's standard error here is about ±${answered.length ? (1 / Math.sqrt(answered.length)).toFixed(2) : "—"}); the plan says a judge is *calibrated or not shipped*, and this is the harness that will say which once /variation puts more pairs in the log. What it can already show is the disagreements, one by one.`
      : `${answered.length} comparisons — enough to read.`,
    "",
  );
}
lines.push("## Method", "");
lines.push(
  "`isocan evals pairs` per canvas; each kept version against each version it beat at that moment; the two files fetched with `isocan get --rev` and shown to `claude -p` (Read only, up to 8 turns) as A and B in a shuffled order, asked to argue against each before picking, and to cite. Agreement is judge-pick equals person-pick; κ = 2·agreement − 1 because the shuffle makes chance a coin. Nothing is written to any canvas.",
  "",
);
lines.push("## Comparisons", "");
lines.push("| canvas | item | person kept | judge | agrees | conf | run | first reason |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const c of comparisons) {
  const j = c.judge;
  lines.push(
    `| ${c.canvasTitle} | ${c.itemTitle} (${c.mime}) | ${c.chosen} over ${c.other}, by ${c.chosenBy} | ${j ? (j.pick ? `${j.pick} (${j.pick === (c.humanIsA ? "A" : "B") ? "the kept one" : "the other"})` : "no answer") : "—"} | ${j ? (c.agrees === null ? "—" : c.agrees ? "yes" : "**no**") : "—"} | ${j?.confidence ?? "—"} | ${j ? `${j.turns ?? "—"} turns, ${j.secs}s, ${j.stop}` : "—"} | ${j?.because?.[0] ? j.because[0].replace(/\|/g, "\\|").slice(0, 160) : "—"} |`,
  );
}
if (skipped.length > 0) {
  lines.push("", "## Skipped", "");
  for (const s of skipped) lines.push(`- ${s.canvasId} / ${s.itemId}: ${s.why}`);
}
if (byAgents.length > 0) {
  lines.push("", "## Chosen by an agent, not read", "");
  lines.push("A pair is a human label only when a person made the choice; these are an agent keeping its own earlier take.", "");
  for (const p of byAgents) lines.push(`- ${p.canvasId} / ${p.title}: ${p.who} kept one over ${p.n} (${p.why})`);
}
if (!dry) {
  lines.push("", "## Cost", "");
  lines.push(`$${usd.toFixed(2)} for ${comparisons.length} comparisons; ${comparisons.map((c) => c.judge?.model).filter(Boolean)[0] ?? "—"}.`);
}

mkdirSync(path.dirname(page), { recursive: true });
writeFileSync(page, lines.join("\n") + "\n");
console.log(`wrote ${page}`);
if (!dry) console.log(`agreement ${acc === null ? "—" : `${agreed}/${answered.length}`} · κ ${kappa === null ? "—" : kappa.toFixed(2)} · $${usd.toFixed(2)}`);
