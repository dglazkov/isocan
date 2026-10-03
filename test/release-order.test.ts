import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.resolve(import.meta.dirname, "../scripts/release-order.sh");
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};
let scratch: string;
let repo: string;
let remote: string;
let a: string;
let b: string;
let c: string;

function git(...args: string[]): string {
  const done = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: repo, env, encoding: "utf8" });
  if (done.status !== 0) throw new Error(`${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
}
function push(ref: string, commit: string): void {
  git("push", "origin", `${commit}:refs/heads/${ref}`);
}
function release(source: string, previous?: string): string {
  const tree = git("rev-parse", `${source}^{tree}`);
  const commit = git("commit-tree", tree, ...(previous ? ["-p", previous] : []), "-p", source, "-m", "Synthetic release");
  push("release", commit);
  return commit;
}
function run(head: string, checkout = head) {
  git("checkout", "--detach", checkout);
  return spawnSync("bash", [script, head], { cwd: repo, env, encoding: "utf8" });
}
function decision(head: string, promote: boolean, publish: boolean): void {
  const done = run(head);
  expect(done.status, done.stderr).toBe(0);
  expect(done.stdout).toBe(`promote=${promote}\npublish=${publish}\n`);
}

beforeEach(() => {
  scratch = mkdtempSync(path.join(os.tmpdir(), "isocan-release-order-"));
  repo = scratch;
  remote = path.join(scratch, "origin.git");
  git("init", "--bare", remote);
  git("init", "-b", "main", path.join(scratch, "work"));
  repo = path.join(scratch, "work");
  git("remote", "add", "origin", remote);
  git("commit", "--allow-empty", "-m", "Source A");
  a = git("rev-parse", "HEAD");
  git("commit", "--allow-empty", "-m", "Source B");
  b = git("rev-parse", "HEAD");
  git("commit", "--allow-empty", "-m", "Source C");
  c = git("rev-parse", "HEAD");
  push("main", c);
});
afterEach(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe("publication follows source ancestry, even when gates finish out of order", () => {
  it("bootstraps absent refs and drops stale tracking refs", () => {
    git("update-ref", "refs/remotes/origin/green", c);
    git("update-ref", "refs/remotes/origin/release", c);
    decision(b, true, true);
    expect(git("for-each-ref", "--format=%(refname)", "refs/remotes/origin")).toBe("refs/remotes/origin/main");
  });

  it("publishes a passed commit without waiting for newer, still untested main", () => {
    push("green", a);
    release(a);
    decision(b, true, true); // main is C; C need not be green for B to ship.
  });

  it("refreshes refs and skips B when C finished first, although a B release could fast-forward", () => {
    const first = release(a);
    push("green", a);
    git("fetch", "origin");
    const newer = release(c, first);
    push("green", c);
    // Make checkout's snapshot stale, as it could be before waiting on the lock.
    git("update-ref", "refs/remotes/origin/green", a);
    git("update-ref", "refs/remotes/origin/release", first);
    decision(b, false, false);
    expect(git("rev-parse", "refs/remotes/origin/release")).toBe(newer);
    // A plain fast-forward guard alone cannot protect generated content:
    // this commit is legal Git ancestry even though its source moves C -> B.
    const rollback = git("commit-tree", `${b}^{tree}`, "-p", newer, "-p", b, "-m", "Stale synthetic build");
    expect(git("merge-base", newer, rollback)).toBe(newer);
    expect(git("ls-remote", "origin", "refs/heads/release")).toBe(`${newer}\trefs/heads/release`);
  });

  it("retries failed CLI publication at green, but skips an older candidate", () => {
    release(a);
    push("green", c);
    decision(b, false, false);
    decision(c, false, true);
  });

  it("can promote an already released source without rebuilding it", () => {
    push("green", a);
    const first = release(a);
    release(c, first);
    decision(b, true, false); // Even with green behind, CLI content cannot go C -> B.
    decision(c, true, false);
    push("green", c);
    decision(c, false, false);
  });

  it("rejects the wrong checkout and a source outside main", () => {
    const wrong = run(b, c);
    expect(wrong.status).not.toBe(0);
    expect(wrong.stderr).toContain("checkout differs");
    expect(wrong.stdout).toBe("");
    const other = git("commit-tree", `${a}^{tree}`, "-p", a, "-m", "Unmerged source");
    const done = run(other);
    expect(done.status).not.toBe(0);
    expect(done.stderr).toContain("is not on origin/main");
    expect(done.stdout).toBe("");
  });

  it.each(["green", "release"])("fails closed on divergent %s history", (ref) => {
    const other = git("commit-tree", `${a}^{tree}`, "-p", a, "-m", "Divergent source");
    if (ref === "green") push("green", other);
    else release(other);
    const done = run(b);
    expect(done.status).not.toBe(0);
    expect(done.stderr).toContain("have diverged");
    expect(done.stdout).toBe("");
  });

  it("does not treat an unreadable remote as an absent first release", () => {
    git("remote", "set-url", "origin", path.join(scratch, "missing.git"));
    const done = run(b);
    expect(done.status).not.toBe(0);
    expect(done.stdout).toBe("");
  });

  it("requires main and the generated release's parent layout", () => {
    const invalid = git("commit-tree", `${a}^{tree}`, "-m", "Not a generated release");
    push("release", invalid);
    const malformed = run(b);
    expect(malformed.status).not.toBe(0);
    expect(malformed.stderr).toContain("unexpected parent layout");
    expect(malformed.stdout).toBe("");
    git("push", "origin", ":refs/heads/main");
    const missing = run(b);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("origin/main is missing");
    expect(missing.stdout).toBe("");
  });
});
