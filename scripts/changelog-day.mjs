#!/usr/bin/env node
/**
 * The raw material for a day's changelog entry, from the history.
 *
 * This script does the part a machine can be right about: which commits landed
 * on a given day, how much they touched, who wrote them, and what each one
 * SAID — subject and body, because in this repo the body carries the argument
 * and the argument is the part worth keeping.
 *
 * It does not write the prose. A day's entry is a judgement about what
 * mattered, and a script that guesses at that produces a page nobody reads.
 * So the file it writes is honest about its own state: a header, the stats,
 * and every commit in full, marked as a draft for a person or an agent to turn
 * into an entry. If the file already exists it is left alone — a written entry
 * is never overwritten by a machine.
 *
 *   node scripts/changelog-day.mjs            # yesterday, in ZONE
 *   node scripts/changelog-day.mjs 2026-08-19 # a specific day
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The day boundary people mean. GitHub's cron is UTC and nobody lives there. */
const ZONE = process.env.CHANGELOG_TZ ?? "America/Los_Angeles";
const DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "docs/changelog");

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trimEnd();

function yesterdayIn(zone) {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: zone }));
  local.setDate(local.getDate() - 1);
  return [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, "0"),
    String(local.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The one line of CI coupling, and it is here rather than in the workflow so
 * that "which day did we write up" has a single answer. A shell pipeline
 * guessing the date back out of `git status` is a second implementation of
 * this decision, and second implementations drift.
 */
const report = (value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `day=${value}\n`);
};

const day = (process.argv[2] || "").trim() || yesterdayIn(ZONE);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error(`not a date: ${day}`);
  process.exit(2);
}

// --since/--until with a timezone offset is the only honest way to ask git for
// "that day where the people were", rather than that day in UTC.
const since = `${day} 00:00`;
const until = `${day} 23:59:59`;
const range = ["--since", since, "--until", until, "--no-merges", "--date=short"];

const shas = git("log", ...range, "--format=%H").split("\n").filter(Boolean);
if (shas.length === 0) {
  console.log(`${day}: nothing landed`);
  report("");
  process.exit(0);
}

const file = path.join(DIR, `${day}.md`);
if (existsSync(file)) {
  const written = readFileSync(file, "utf8");
  // A draft is fair game to refresh; a written entry is not.
  if (!written.includes("<!-- draft -->")) {
    console.log(`${day}: already written (${file})`);
    report("");
    process.exit(0);
  }
}

const stat = git("log", ...range, "--shortstat", "--format=%H")
  .split("\n")
  .filter((line) => line.includes("changed"))
  .reduce(
    (acc, line) => {
      const files = /(\d+) files? changed/.exec(line);
      const ins = /(\d+) insertions?/.exec(line);
      const del = /(\d+) deletions?/.exec(line);
      return {
        files: acc.files + (files ? +files[1] : 0),
        ins: acc.ins + (ins ? +ins[1] : 0),
        del: acc.del + (del ? +del[1] : 0),
      };
    },
    { files: 0, ins: 0, del: 0 },
  );

const authors = [...new Set(git("log", ...range, "--format=%an").split("\n").filter(Boolean))];
const commits = shas.map((sha) => ({
  sha: sha.slice(0, 7),
  subject: git("show", "-s", "--format=%s", sha),
  body: git("show", "-s", "--format=%b", sha).replace(/\n*Co-Authored-By:.*$/gs, "").trim(),
}));

const number = (n) => n.toLocaleString("en-US");
const lines = [
  "<!-- draft -->",
  "",
  `# ${day}`,
  "",
  `**${day}** · ${commits.length} commit${commits.length === 1 ? "" : "s"} · ` +
    `${stat.files} files · +${number(stat.ins)}/−${number(stat.del)} · ${authors.join(", ")}`,
  "",
  "> Draft. The commits are below with what they said; the entry is the part a",
  "> person or an agent writes — what mattered, and why. Delete this line and",
  "> the `<!-- draft -->` marker when it is written, and add a row to the index.",
  "",
  "## What landed",
  "",
];
for (const commit of commits) {
  lines.push(`### ${commit.subject}`, "", `\`${commit.sha}\``, "");
  if (commit.body) lines.push(commit.body, "");
}

mkdirSync(DIR, { recursive: true });
writeFileSync(file, `${lines.join("\n")}\n`);
report(day);
console.log(`${day}: ${commits.length} commits → ${path.relative(process.cwd(), file)}`);
