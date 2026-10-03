#!/usr/bin/env node
/**
 * **Drain a nightly workflow's older pull requests**, oldest first, per
 * AGENTS.md ("The night shift's pull requests"): a workflow's queue never
 * holds more than one open PR, the newest run's.
 *
 * For the workflows whose nights each add one dated page in their own
 * directory — grades (`docs/grades/`), the practice page (`docs/practice/`) —
 * nights never touch the same bytes, so any drain is a clean merge. Each open
 * PR on the branch prefix is merged if its diff stays inside the directory,
 * closed as superseded (branch kept, the comment says how to recover it) if
 * the merge fails, and left for a person if it reaches outside.
 *
 *   node scripts/lib/drain.mjs <branch-prefix> <dir/> [--except <branch>]
 *
 * Factored out of `grade-night.mjs` when the practice page became the second
 * workflow of this shape (practice phase 0).
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The token `gh` should use: the environment's, or the one actions/checkout left in git config. */
function ghEnv() {
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
  return token ? { ...process.env, GH_TOKEN: token } : process.env;
}

/**
 * Drain open PRs whose head branch starts with `prefix`, oldest first, merging
 * each whose diff is wholly under `dir`. `except` names a branch to leave
 * alone — the run's own, when it decides about that one itself.
 */
export function drainPRs({ prefix, dir, except }) {
  const env = ghEnv();
  let prs = [];
  try {
    const out = execFileSync("gh", ["pr", "list", "--state", "open", "--json", "number,headRefName"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "ignore"],
    });
    prs = JSON.parse(out)
      .filter((p) => typeof p.headRefName === "string" && p.headRefName.startsWith(prefix) && p.headRefName !== except)
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
      if (files.length === 0 || files.some((f) => !f.startsWith(dir))) {
        console.log(`PR #${pr.number} (${pr.headRefName}) touches outside ${dir} — left for a person`);
        continue;
      }
      try {
        execFileSync("gh", ["pr", "merge", "--squash", "--delete-branch", String(pr.number)], {
          env,
          stdio: "inherit",
        });
        console.log(`drained ${prefix} PR #${pr.number} (${pr.headRefName})`);
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
  const [prefix, dir] = process.argv.slice(2);
  const i = process.argv.indexOf("--except");
  if (!prefix || !dir || prefix.startsWith("--") || dir.startsWith("--")) {
    console.error("usage: node scripts/lib/drain.mjs <branch-prefix> <dir/> [--except <branch>]");
    process.exit(2);
  }
  drainPRs({ prefix, dir, except: i >= 0 ? process.argv[i + 1] : undefined });
}
