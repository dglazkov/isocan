#!/usr/bin/env node
/**
 * **The changelog's queue, drained** — the machinery AGENTS.md ("The night
 * shift's pull requests") says owns the floor and the door, which until this
 * script was a paragraph and not a program: the 22 Sep draft sat open for
 * five days waiting on somebody to remember it.
 *
 * A changelog PR is the one machine PR that waits for a writer, because an
 * entry is a judgement and a later day does not make it stale. So this never
 * merges a fresh one. It does two things:
 *
 * - **The door.** When the day's page already exists on `main` — somebody
 *   wrote it by hand — the run closes its own PR and says so. Closing keeps
 *   the branch; the comment says how to get it back.
 * - **The floor.** A PR still open after three days is merged *as it is*: a
 *   draft keeps its marker, and gets an index row saying it is a draft, since
 *   a draft nobody wrote up beats a missing day, and a merged draft on `main`
 *   stays editable where a closed PR does not. The merge is checked, not
 *   trusted: `test/changelog.test.ts` runs against the branch first, and a
 *   red run leaves the PR for a person.
 *
 * Bounds: only `changelog/<day>` branches the workflow itself opened, and only
 * a diff entirely under `docs/changelog/`. Anything else is left alone.
 *
 *   node scripts/changelog-drain.mjs            # act
 *   node scripts/changelog-drain.mjs --dry-run  # say what it would do
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** How long a changelog PR waits for a writer before it is merged as it stands. */
export const FLOOR_DAYS = 3;

/** The author the workflow's PRs carry: `GITHUB_TOKEN` opens them as the Actions app. */
const BOTS = new Set(["app/github-actions", "github-actions[bot]", "github-actions"]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * What to do with each open PR. Pure: the PRs as `gh pr list --json` gives
 * them (`number`, `headRefName`, `author.login`, `createdAt`, `files[].path`),
 * the days whose page is already on `main`, and the time now.
 *
 * @returns {{ number: number, day: string | null, act: "close" | "merge" | "wait" | "leave", why: string }[]}
 */
export function drainPlan(prs, pagesOnMain, now = new Date()) {
  const written = new Set(pagesOnMain);
  return prs.map((pr) => {
    const day = /^changelog\/(\d{4}-\d{2}-\d{2})$/.exec(pr.headRefName ?? "")?.[1] ?? null;
    const base = { number: pr.number, day };
    if (!day) return { ...base, act: "leave", why: "not a changelog/<day> branch" };
    if (!BOTS.has(pr.author?.login ?? "")) return { ...base, act: "leave", why: `opened by ${pr.author?.login ?? "somebody"}, not the workflow` };
    const files = (pr.files ?? []).map((f) => f.path);
    if (files.length === 0 || files.some((f) => !f.startsWith("docs/changelog/"))) return { ...base, act: "leave", why: "touches more than docs/changelog/" };
    if (written.has(day)) return { ...base, act: "close", why: `docs/changelog/${day}.md is already on main` };
    const days = (now.getTime() - new Date(pr.createdAt).getTime()) / 86_400_000;
    if (days >= FLOOR_DAYS) return { ...base, act: "merge", why: `open ${Math.floor(days)} days` };
    return { ...base, act: "wait", why: `open ${days.toFixed(1)} days; merged as it stands after ${FLOOR_DAYS}` };
  });
}

/**
 * The index with a row for `day` saying it is a draft, newest at the top —
 * or the index unchanged when the day is already linked (a written entry
 * brings its own row).
 */
export function indexWithDraftRow(index, day) {
  if (index.includes(`(${day}.md)`)) return index;
  const [, month, date] = day.split("-");
  const row = `| **[${Number(date)} ${MONTHS[Number(month) - 1]}](${day}.md)** | *Draft* | Not written up yet: the day's commits, quoted in full. Whoever writes the entry replaces this row. |`;
  const lines = index.split("\n");
  const rows = lines.map((line, i) => ({ i, day: /^\| \*\*\[[^\]]+\]\((\d{4}-\d{2}-\d{2})\.md\)\*\*/.exec(line)?.[1] })).filter((r) => r.day);
  if (rows.length === 0) throw new Error("docs/changelog/README.md has no day rows to place a draft among");
  const older = rows.find((r) => r.day < day);
  const at = older ? older.i : rows[rows.length - 1].i + 1;
  lines.splice(at, 0, row);
  return lines.join("\n");
}

const repo = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts }).trimEnd();
const git = (...args) => run("git", args);
const gh = (...args) => run("gh", args);

function pagesOnMain() {
  git("fetch", "--quiet", "origin", "main");
  return git("ls-tree", "--name-only", "origin/main", "docs/changelog/")
    .split("\n")
    .map((f) => /(\d{4}-\d{2}-\d{2})\.md$/.exec(f)?.[1])
    .filter(Boolean);
}

let installed = false;
/** `test/changelog.test.ts` against the working tree; true when it passes. */
function checked() {
  if (!installed) {
    run("npm", ["ci", "--no-audit", "--no-fund"], { stdio: ["ignore", "ignore", "inherit"] });
    installed = true;
  }
  try {
    run("npx", ["vitest", "run", "test/changelog.test.ts"], { stdio: ["ignore", "inherit", "inherit"] });
    return true;
  } catch {
    return false;
  }
}

function close({ number, day, why }) {
  gh("pr", "close", String(number), "--comment",
    `Closed by the changelog drain: ${why}, written by hand, which is the better entry. ` +
    `The branch \`changelog/${day}\` is kept — reopen this PR, or \`git checkout changelog/${day}\`, to get the draft back.`);
}

function merge({ number, day, why }) {
  const branch = `changelog/${day}`;
  git("fetch", "--quiet", "origin", branch);
  git("checkout", "--quiet", "-B", branch, `origin/${branch}`);
  try {
    // Up to date with main first, so the index row lands on today's index, not the one the draft was cut from.
    git("merge", "--quiet", "--no-edit", "origin/main");
  } catch {
    git("merge", "--abort");
    return `left for a person: ${branch} does not merge cleanly with main`;
  }
  const indexPath = path.join(repo, "docs/changelog/README.md");
  const page = path.join(repo, `docs/changelog/${day}.md`);
  const draft = existsSync(page) && readFileSync(page, "utf8").startsWith("<!-- draft -->");
  const before = readFileSync(indexPath, "utf8");
  const after = indexWithDraftRow(before, day);
  if (after !== before) {
    writeFileSync(indexPath, after);
    git("add", "docs/changelog/README.md");
    git("commit", "--quiet", "-m", `Changelog: ${day}, indexed as a draft`);
  }
  if (!checked()) return `left for a person: test/changelog.test.ts is red on ${branch}`;
  git("push", "--quiet", "origin", `HEAD:${branch}`);
  gh("pr", "comment", String(number), "--body",
    `Merged by the changelog drain: ${why} with nobody writing it up${draft ? ", so it lands as a draft, marker intact and the index row saying so" : ""}. ` +
    `A merged page on main stays editable — write the entry there whenever somebody can.`);
  gh("pr", "merge", String(number), "--squash", "--delete-branch");
  return "merged";
}

function main() {
  const dry = process.argv.includes("--dry-run");
  // Every open PR, narrowed here rather than by GitHub's search syntax; the oldest first.
  const prs = JSON.parse(gh("pr", "list", "--state", "open", "--json", "number,headRefName,author,createdAt,files", "--limit", "200"))
    .filter((pr) => pr.headRefName.startsWith("changelog/"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const plan = drainPlan(prs, pagesOnMain());
  if (plan.length === 0) console.log("no open changelog PRs");
  const start = git("rev-parse", "--abbrev-ref", "HEAD");
  for (const step of plan) {
    const said = `#${step.number} ${step.day ?? "?"}: ${step.act} — ${step.why}`;
    if (dry || step.act === "wait" || step.act === "leave") {
      console.log(said);
      continue;
    }
    if (step.act === "close") {
      close(step);
      console.log(`${said} — closed`);
    } else {
      console.log(`${said} — ${merge(step)}`);
      git("checkout", "--quiet", start);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
