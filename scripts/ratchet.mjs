#!/usr/bin/env node
/**
 * **Every persona's numbers, taken now, and only the ones that moved the wrong
 * way reported.**
 *
 * This is the mechanical half of review-on-push. It runs on every push,
 * answers in a couple of minutes, and costs no model — because the part of a
 * review that can be CERTAIN should never wait for the part that cannot.
 *
 * A missed bound is news and not a build break: `review.yml` does not gate
 * anything on this, it says something. A check that goes red on hygiene would
 * be turned off inside a week, and then the numbers would drift with nothing
 * watching — which is worse than never having had it.
 *
 * **The model pass is the nightly**, not this. Running a persona's judgement on
 * every push is the volume failure `docs/research/2026-08-24-the-night-shift.md`
 * names: a morning of forty items is worse than no night shift, because it
 * turns sleep into a queue.
 *
 *   node scripts/ratchet.mjs           # every persona
 *   node scripts/ratchet.mjs --quiet   # print only misses; silent when clean
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const quiet = process.argv.includes("--quiet");

/** Read through the CLI so there is one parser — the roadmap's lesson. */
const personas = JSON.parse(
  execFileSync("node", [cli, "--json", "persona", "ls"], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);

const met = (goal, value) =>
  goal.bound.kind === "at most" ? value <= goal.bound.value : value >= goal.bound.value;

const misses = [];
const broken = [];
for (const persona of personas) {
  for (const goal of persona.goals) {
    let out;
    try {
      out = execFileSync(goal.measuredBy, {
        cwd: repo,
        encoding: "utf8",
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      /**
       * A command that will not run is never read as a zero. "0 failures" and
       * "nothing could be measured" look identical in a report that does not
       * separate them, and this week produced four instruments that reported
       * the first while meaning the second.
       */
      broken.push({ persona: persona.name, goal, why: String(err.message).slice(0, 120) });
      continue;
    }
    const value = Number(out.trim().split(/\s+/).pop());
    if (!Number.isFinite(value)) {
      broken.push({ persona: persona.name, goal, why: `not a number: ${out.trim().slice(0, 60)}` });
      continue;
    }
    if (!met(goal, value)) misses.push({ persona: persona.name, goal, value });
  }
}

const unit = (g) => g.unit ?? "";
const lines = [];
for (const m of misses) {
  lines.push(
    `**${m.persona}** — ${m.goal.name}: **${m.value}${unit(m.goal)}**, ` +
      `past ${m.goal.bound.kind} ${m.goal.bound.value}${unit(m.goal)}` +
      (m.goal.baseline ? ` (was ${m.goal.baseline.value}${unit(m.goal)} on ${m.goal.baseline.at})` : "") +
      `\n  \`${m.goal.measuredBy}\``,
  );
}
for (const b of broken) {
  lines.push(`**${b.persona}** — \`${b.goal.measuredBy}\` could not be run: ${b.why}`);
}

if (lines.length === 0) {
  if (!quiet) console.log("every persona's numbers held");
  process.exit(0);
}
console.log(lines.join("\n\n"));
/**
 * Exit 1 so a caller can branch on it. `review.yml` uses that to decide whether
 * to SAY something, not whether to fail — the distinction the charter draws
 * between news and a build break.
 */
process.exit(1);
