import { spawnSync } from "node:child_process";
import { gitRemote } from "./gitrepo.ts";

/**
 * **Committing a backup, and pushing it somewhere.**
 *
 * `isocan export --commit` and `--git <remote>` are git run for you, not a
 * git of our own: every step is a command a person could type, in the
 * directory the export was written to, and a failure is git's own message.
 *
 * Two things this is careful about, both learned elsewhere in this repo:
 *
 * **Only the paths the export wrote are added.** `git add -A` in a directory
 * that turns out to be somebody's project (`--to .`) would sweep their
 * unrelated changes into a commit about a backup, under a message that says
 * nothing about them. The export knows what it wrote; that list is what is
 * staged.
 *
 * **An existing `origin` is never re-pointed.** A remote that differs from
 * the one asked for is refused by name rather than replaced — the same
 * cheerful-wrong-address failure `gitrepo.ts` guards against, arriving from
 * the other side.
 */

export interface GitBackupOptions {
  /** The export directory. If it is not inside a repository, one is made. */
  dir: string;
  /** What the export wrote, relative to `dir` — what gets staged. */
  paths: string[];
  message: string;
  /** `owner/name` or any git URL. Sets `origin` when there is none. */
  remote?: string;
  /** Push `HEAD` to `origin` after committing. */
  push: boolean;
}

export interface GitBackupReport {
  /** The repository's top level. */
  repo: string;
  /** False when nothing the export wrote had changed. */
  committed: boolean;
  commit?: string;
  /** The remote pushed to, when one was. */
  pushed?: string;
  initialized: boolean;
}

function git(dir: string, args: string[]): { ok: boolean; out: string; err: string } {
  const result = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  if (result.error) {
    throw new Error(`git is not available (${result.error.message}) — install it, or export without --commit/--git`);
  }
  return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}

export function gitBackup(options: GitBackupOptions): GitBackupReport {
  const { dir, paths, message } = options;
  let initialized = false;
  let repo = git(dir, ["rev-parse", "--show-toplevel"]).out;
  if (!repo) {
    const init = git(dir, ["init", "-q"]);
    if (!init.ok) throw new Error(`git init failed in ${dir}: ${init.err}`);
    initialized = true;
    repo = git(dir, ["rev-parse", "--show-toplevel"]).out;
  }

  if (options.remote) {
    const wanted = gitRemote(options.remote);
    const current = git(dir, ["remote", "get-url", "origin"]);
    if (!current.ok) {
      const added = git(dir, ["remote", "add", "origin", wanted]);
      if (!added.ok) throw new Error(`could not add remote ${wanted}: ${added.err}`);
    } else if (current.out !== wanted) {
      throw new Error(
        `${repo} already pushes to ${current.out}, not ${wanted} — ` +
          "run without --git to push where it already goes, or change the remote yourself",
      );
    }
  }

  if (paths.length > 0) {
    const added = git(dir, ["add", "--", ...paths]);
    if (!added.ok) throw new Error(`git add failed: ${added.err}`);
  }
  const staged = git(dir, ["diff", "--cached", "--quiet"]);
  let committed = false;
  if (!staged.ok) {
    const commit = git(dir, ["commit", "-q", "-m", message]);
    if (!commit.ok) {
      throw new Error(
        `git commit failed: ${commit.err || commit.out}` +
          (/please tell me who you are|identity unknown/i.test(commit.err + commit.out)
            ? "\n  git needs a name and email here: git config user.name / user.email"
            : ""),
      );
    }
    committed = true;
  }
  const commit = git(dir, ["rev-parse", "--short", "HEAD"]);

  let pushed: string | undefined;
  if (options.push) {
    const origin = git(dir, ["remote", "get-url", "origin"]);
    if (!origin.ok) {
      throw new Error(`${repo} has no origin to push to — pass --git <remote> the first time`);
    }
    const push = git(dir, ["push", "-q", "-u", "origin", "HEAD"]);
    if (!push.ok) throw new Error(`git push to ${origin.out} failed: ${push.err}`);
    pushed = origin.out;
  }

  return {
    repo,
    committed,
    ...(commit.ok ? { commit: commit.out } : {}),
    ...(pushed !== undefined ? { pushed } : {}),
    initialized,
  };
}
