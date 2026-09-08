#!/usr/bin/env node
/**
 * **What each persona says about when it runs, against when it actually ran.**
 *
 *   node scripts/cadence.mjs           # the table
 *   node scripts/cadence.mjs --json
 *
 * #206 phase 1. A persona's `trigger` is a claim about the future that, until
 * this file, nothing ever reconciled against the past — so a cron that
 * silently stops is indistinguishable from a quiet week, and a declaration
 * that was never true is indistinguishable from one that is.
 *
 * ## What reading it found, 7 Sep 2026
 *
 * **Nothing schedules from `trigger`.** `.github/workflows/persona.yml` holds
 * one hardcoded cron and runs `persona-run.mjs --all`; the only readers of
 * `trigger` in the tree are `isocan persona ls` and the board's panel, and
 * both only DISPLAY it. Three of nine declarations were false and none of
 * them could have been noticed:
 *
 * - `design-auditor` declared `trigger` **twice** — YAML takes the last key,
 *   so the file said 08:23 while the workflow ran it at 08:43, and the 08:43
 *   line above it was dead text.
 * - `market-researcher` declared **nothing**, so `readTrigger` called it
 *   `manual`, while it ran every night for nine nights.
 * - `journeys` declares Mondays and runs nightly with the rest.
 *
 * The first two are fixed in the files. The third is not, because it is a
 * choice about how often the journeys should walk rather than a typo, and
 * this reading exists to put it in front of somebody rather than to answer
 * it.
 *
 * ## Why this reports and does not fail
 *
 * The staleness column depends on the world: a run happened last night and
 * its pull request is open, so every persona reads a day behind through no
 * fault of its own. A guard that reddens for that teaches people to ignore
 * it. The FACTS about the declaration — declared twice, not declared at all —
 * are guarded, in `test/cadence.test.ts`, because those are true or false in
 * the tree and nowhere else.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();
const { PERSONA_DIR, parsePersona } = await import("@isocan/core");

const repo = fileURLToPath(new URL("..", import.meta.url));
const REVIEWS = path.join(repo, "docs/reviews");
const WORKFLOW = path.join(repo, ".github/workflows/persona.yml");

/** A dated run page: `2026-09-06-reviewer.md`, with an optional suffix for a
 *  second run in one day. The same shape `scripts/reviews.mjs` reads. */
const PAGE = /^(\d{4}-\d{2}-\d{2})[a-z]?-([a-z-]+)\.md$/;

/**
 * **How many times each persona file declares `trigger`.**
 *
 * Read from the RAW front matter, not from `parsePersona`, and that is the
 * whole point: the parser builds a map, so a key written twice is silently the
 * last one. Asking the parser how many triggers a file has is asking the thing
 * that cannot tell.
 */
export function declaredTriggers(dir = path.join(repo, PERSONA_DIR)) {
  const out = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const src = readFileSync(path.join(dir, file), "utf8");
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)?.[1] ?? "";
    // Top-level keys only: a `trigger:` indented under something else is not
    // a second declaration, and there is no `# comment` counted either.
    const count = front
      .split("\n")
      .filter((line) => /^trigger\s*:/.test(line)).length;
    out.set(file.replace(/\.md$/, ""), { count, persona: parsePersona(src, file) });
  }
  return out;
}

/** Every cron `.github/workflows/persona.yml` actually fires on. */
export function firedCrons(file = WORKFLOW) {
  const src = readFileSync(file, "utf8");
  const schedule = /schedule:\s*\n([\s\S]*?)(?:\n\s{2}\w|\n\w)/.exec(src)?.[1] ?? "";
  return [...schedule.matchAll(/^\s*-\s*cron:\s*["']?([^"'\n#]+?)["']?\s*$/gm)].map((m) => m[1].trim());
}

/** The newest dated page each persona wrote, or null. */
export function lastRuns(dir = REVIEWS) {
  const out = new Map();
  for (const file of readdirSync(dir)) {
    const m = PAGE.exec(file);
    if (!m) continue;
    const [, date, name] = m;
    if (!out.has(name) || out.get(name) < date) out.set(name, date);
  }
  return out;
}

/**
 * One row per persona: what it says, what fires it, when it last wrote, and
 * the verdict — which is about the DECLARATION, not about the number.
 */
export function cadenceRows(today = new Date()) {
  const declared = declaredTriggers();
  const fires = firedCrons();
  const last = lastRuns();
  const rows = [];
  for (const [name, { count, persona }] of [...declared].sort()) {
    const trigger = persona.trigger;
    const cron = trigger?.kind === "schedule" ? trigger.cron : null;
    const ran = last.get(name) ?? null;
    const age = ran ? Math.floor((today.getTime() - Date.parse(`${ran}T00:00:00Z`)) / 86_400_000) : null;
    let verdict = "agrees";
    if (count > 1) verdict = "declared twice";
    else if (count === 0) verdict = ran ? "runs, declares nothing" : "not declared";
    else if (cron === null) verdict = ran ? `runs, declares ${trigger?.kind}` : trigger?.kind ?? "manual";
    else if (!fires.includes(cron)) verdict = "declares a cron nothing fires";
    rows.push({ name, cron, declaredTimes: count, firedBy: fires, lastRan: ran, ageDays: age, verdict });
  }
  return rows;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = cadenceRows();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`the workflow fires: ${firedCrons().join(", ") || "(nothing)"}\n`);
    for (const r of rows) {
      const when = r.lastRan ? `${r.lastRan} (${r.ageDays}d)` : "never";
      console.log(`${r.name.padEnd(18)} ${String(r.cron ?? "—").padEnd(14)} last ${when.padEnd(20)} ${r.verdict}`);
    }
  }
}
