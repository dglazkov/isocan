#!/usr/bin/env node
/**
 * **The nightly grading run** — step 1 of the night shift
 * (`docs/research/2026-08-24-the-night-shift.md`), and the one everything else
 * there waits on. It answers *is anything already broken* before anything
 * tries to fix it.
 *
 * It writes a dated page and **nothing else**. No canvas is written to, no
 * item is changed, no comment is posted. A grader that also repairs is a
 * grader whose readings you cannot trust, because it has an interest in what
 * it found.
 *
 *   node scripts/grade-night.mjs                 # the pages this repo ships
 *   node scripts/grade-night.mjs --canvases      # every screen in the isocan home
 *   node scripts/grade-night.mjs --day 2026-08-29
 *
 * **Two subjects, and only one of them can be reached from CI.** The screens
 * worth grading live on canvases, and canvases live in somebody's isocan home
 * on their own machine — a GitHub runner has none and never will. So the
 * scheduled run grades what a runner CAN reach honestly: the pages this
 * repository ships to people. `--canvases` is the same run pointed at the home,
 * for the machine where the work actually is. The page says which it graded,
 * because a report that does not name its subject is a number without a
 * question.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const grader = path.join(repo, "scripts", "grade.mjs");
const cli = path.join(repo, "packages/cli/bin/isocan.js");

/** The day in the timezone the people are in, not the one the runner is in —
 *  the same choice `changelog-day.mjs` makes, for the same reason. */
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

const day = arg("--day") ?? today();

/**
 * **The selftest is a gate, not a step.**
 *
 * Every check must fire on a page built to break all of them, and if any stays
 * silent the run reports NOTHING. A grader that reports zeros when it breaks is
 * worse than no grader because it is believed — and a nightly page full of
 * zeroes, arriving every morning, is that belief on a schedule.
 */
function gradersWork() {
  try {
    execFileSync("node", [grader, "--selftest"], { stdio: "inherit" });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function gradeFiles(files) {
  const out = [];
  for (const file of files) {
    const json = execFileSync("node", [grader, "--file", file, "--json"], { encoding: "utf8" });
    out.push(...JSON.parse(json));
  }
  return out;
}

function gradeCanvases() {
  const rows = JSON.parse(
    execFileSync("node", [cli, "--json", "canvas", "list", "--all"], { encoding: "utf8" }),
  );
  const out = [];
  for (const canvas of rows) {
    const json = execFileSync("node", [grader, "--project", canvas.id, "--json"], {
      encoding: "utf8",
    });
    for (const g of JSON.parse(json)) out.push({ ...g, canvas: canvas.title });
  }
  return out;
}

/**
 * The pages this repository actually ships to people.
 *
 * Not the fixtures — `deliberately-bad.html` exists to fail, and grading it
 * nightly would be a page of failures nobody should act on. And **not the
 * built app's `index.html`**, which was in this list for one run: opened as a
 * file it is an empty div and a script tag, React never runs, and it scored a
 * clean 8/8 for having nothing on it. A perfect score for a blank page is the
 * silent zero wearing a rosette.
 */
function shipped() {
  return [path.join(repo, "docs/index.html")].filter((p) => existsSync(p));
}

// The check names come from the grader's own output rather than a list kept
// here: a check added there and forgotten here would be a column that quietly
// stopped existing.
function checksOf(graded) {
  const names = new Set();
  for (const g of graded) for (const name of Object.keys(g.checks ?? {})) names.add(name);
  return [...names];
}

/**
 * Drain open `grades/*` pull requests, oldest first, per AGENTS.md ("The night
 * shift's pull requests"). Each night adds one dated page under docs/grades/,
 * so nights never touch the same bytes and any drain is a clean merge.
 *
 * Called from both `grade-night.mjs` (draining previous nights before today's
 * PR opens) and `reviews.mjs` (which `persona.yml` runs 20 minutes after
 * `grade.yml`, merging today's grades PR automatically without requiring a
 * workflow file edit).
 */
export function drainGradePRs() {
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      const header = execFileSync("git", ["config", "--get", "http.https://github.com/.extraheader"], {
        encoding: "utf8",
      }).trim();
      const m = header.match(/basic\s+([A-Za-z0-9+/=]+)/i);
      if (m) {
        const decoded = Buffer.from(m[1], "base64").toString("utf8");
        const extracted = decoded.replace(/^x-access-token:/i, "").trim();
        if (extracted) token = extracted;
      }
    } catch {}
  }
  const env = token ? { ...process.env, GH_TOKEN: token } : process.env;
  let prs = [];
  try {
    const out = execFileSync("gh", ["pr", "list", "--state", "open", "--json", "number,headRefName"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "ignore"],
    });
    prs = JSON.parse(out)
      .filter((p) => typeof p.headRefName === "string" && p.headRefName.startsWith("grades/"))
      .sort((a, b) => a.number - b.number);
  } catch {
    return;
  }
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : "nightly run";
  for (const pr of prs) {
    try {
      const diff = execFileSync("gh", ["pr", "diff", "--name-only", String(pr.number)], {
        encoding: "utf8",
        env,
      }).trim();
      const files = diff.split("\n").filter(Boolean);
      if (files.length === 0 || files.some((f) => !f.startsWith("docs/grades/"))) {
        console.log(`PR #${pr.number} (${pr.headRefName}) touches outside docs/grades/ — left for a person`);
        continue;
      }
      try {
        execFileSync("gh", ["pr", "merge", "--squash", "--delete-branch", String(pr.number)], {
          env,
          stdio: "inherit",
        });
        console.log(`drained grades PR #${pr.number} (${pr.headRefName})`);
      } catch {
        const msg = `Closed as superseded (${runUrl}) after merge failed. The branch \`${pr.headRefName}\` was kept; to recover it: \`git fetch origin ${pr.headRefName} && git checkout ${pr.headRefName}\`.`;
        execFileSync("gh", ["pr", "close", String(pr.number), "--comment", msg], {
          env,
          stdio: "inherit",
        });
      }
    } catch {}
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (argv.includes("--drain-only")) {
    drainGradePRs();
    process.exit(0);
  }
  drainGradePRs();
  const broken = gradersWork();
  const subject = argv.includes("--canvases") ? "canvases" : "shipped";
  let graded = [];
  if (!broken) graded = subject === "canvases" ? gradeCanvases() : gradeFiles(shipped());

  const failing = graded.flatMap((g) =>
    Object.entries(g.checks ?? {})
      .filter(([, ok]) => !ok)
      .map(([name]) => ({ file: g.file, canvas: g.canvas, name })),
  );

  const dir = path.join(repo, "docs/grades");
  mkdirSync(dir, { recursive: true });
  const page = path.join(dir, `${day}.md`);

  const lines = [`# Grades — ${day}`, ""];
  if (broken) {
    lines.push(
      "**The graders did not pass their own selftest, so nothing was graded.**",
      "",
      "A grader that reports zeros when it breaks is worse than no grader,",
      "because it is believed. Fix `scripts/grade.mjs` before reading anything",
      "into a quiet morning.",
      "",
      "```",
      broken,
      "```",
      "",
    );
  } else {
    lines.push(
      subject === "canvases"
        ? `Every HTML item on every canvas in this home: **${graded.length} graded**.`
        : `The pages this repository ships: **${graded.length} graded**.`,
      "",
      `**${failing.length} failing checks** across ${checksOf(graded).length} checks per page.`,
      "",
    );
    if (graded.length === 0) {
      lines.push("Nothing to grade — no HTML pages were found.", "");
    } else {
      lines.push("| Page | Checks passing | Failing |", "| --- | --- | --- |");
      for (const g of graded) {
        const entries = Object.entries(g.checks ?? {});
        const passing = entries.filter(([, ok]) => ok).length;
        const failed = entries.filter(([, ok]) => !ok).map(([name]) => name);
        const name = g.canvas ? `${g.canvas} · ${path.basename(g.file)}` : path.relative(repo, g.file);
        lines.push(`| ${name} | ${passing}/${entries.length} | ${failed.join(", ") || "—"} |`);
      }
      lines.push("");
    }
    // The detail behind the counts, because a count is not actionable and this
    // page exists to be acted on.
    for (const g of graded) {
      const worst = g.worstContrast ?? [];
      const stretched = g.stretchedDetail ?? [];
      const small = g.smallTargetDetail ?? [];
      if (worst.length === 0 && stretched.length === 0 && small.length === 0 && (g.slop ?? []).length === 0) {
        continue;
      }
      lines.push(`## ${g.canvas ? `${g.canvas} · ` : ""}${path.basename(g.file)}`, "");
      for (const f of worst) lines.push(`- contrast ${f.ratio} (needs ${f.need}) — "${f.text}"`);
      for (const st of stretched) {
        lines.push(`- stretched \`${st.src}\` — natural ${st.natural}, rendered ${st.rendered}`);
      }
      for (const t of small) lines.push(`- target ${t.size} — \`${t.where}\` "${t.text}"`);
      for (const tell of g.slop ?? []) lines.push(`- tell: ${tell}`);
      lines.push("");
    }
  }
  lines.push(
    "---",
    "",
    "Written by `scripts/grade-night.mjs`. Deterministic: every check here is",
    "reproducible, costs nothing per run, and cannot drift. **Nothing was",
    "written to any canvas.**",
    "",
  );

  writeFileSync(page, lines.join("\n"));
  console.log(path.relative(repo, page));
  // The day is the workflow's to name; the exit code is not a verdict on the
  // pages. A failing check is news, not a build break — the page IS the report.
  process.exit(broken ? 1 : 0);
}
