import { existsSync, readFileSync, statSync, promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildStamp,
  describeBuild,
  gitHead,
  plausibleSha,
  stalenessOf,
  upgradeVerdict,
  type BuildStamp,
  type HomeBuild,
} from "../src/build.ts";

/** This checkout's root — the directory `buildStamp` resolves for itself. */
const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

/**
 * Where this checkout's REFS live, which is not always where its `.git` is.
 *
 * In a worktree `.git` is a file naming a per-worktree gitdir, and that gitdir
 * names the shared one in `commondir`. Probing `<root>/.git/reftable` therefore
 * answers "not reftable" for every worktree of a reftable repo, and the test
 * below would then demand a sha that `gitHead` is right to withhold. Same walk
 * as `gitHead`'s, for the same reason.
 */
function gitCommonDir(): string {
  let dir = path.join(repoRoot, ".git");
  if (statSync(dir).isFile()) {
    const pointer = readFileSync(dir, "utf8").match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();
    if (!pointer) return dir;
    dir = path.resolve(repoRoot, pointer);
    try {
      const common = readFileSync(path.join(dir, "commondir"), "utf8").trim();
      if (common) dir = path.resolve(dir, common);
    } catch {
      // A gitdir without a commondir keeps its refs where it is.
    }
  }
  return dir;
}

/** A stamp with the fields a test does not care about filled in. */
const stampOf = (over: Partial<BuildStamp>): BuildStamp => ({
  version: "0.1.0",
  root: "/opt/isocan",
  codeAt: "2026-08-16T00:00:00.000Z",
  commit: null,
  builtAt: null,
  ...over,
});

/**
 * The daemon outlives the command that started it, so "which build is holding
 * the port" is a question every upgrade asks. Before the stamp, `/healthz`
 * answered "0.1.0" forever and no build could tell itself from another.
 */
describe("build stamp", () => {
  it("names this copy: a version, a root, and when its code was written", () => {
    const stamp = buildStamp();
    expect(stamp.version).toMatch(/^\d+\.\d+\.\d+/);
    // The property is "it names THIS copy", not "the directory is spelled
    // isocan" — which a worktree, a second clone or an npx cache directory all
    // fail while the stamp is perfectly correct.
    expect(stamp.root).toBe(repoRoot);
    expect(Number.isNaN(Date.parse(stamp.codeAt))).toBe(false);
  });

  it("a daemon from another copy is stale, and the message says which", () => {
    const mine = stampOf({ root: "/opt/new", codeAt: "2026-08-16T00:00:00.000Z" });
    const verdict = stalenessOf(
      { root: "/tmp/_npx/abc/node_modules/isocan", codeAt: mine.codeAt, startedAt: "2026-08-16T01:00:00.000Z" },
      mine,
    );
    expect(verdict.stale).toBe(true);
    expect(verdict.why).toContain("another copy");
  });

  it("the same copy is stale once its code is newer than the daemon", () => {
    const mine = stampOf({ root: "/opt/isocan", codeAt: "2026-08-16T12:00:00.000Z" });
    // Upgraded in place at noon; the daemon has been up since morning.
    expect(
      stalenessOf({ root: mine.root, codeAt: mine.codeAt, startedAt: "2026-08-16T09:00:00.000Z" }, mine)
        .stale,
    ).toBe(true);
    // Started after the code landed: this is the build it is running.
    expect(
      stalenessOf({ root: mine.root, codeAt: mine.codeAt, startedAt: "2026-08-16T12:30:00.000Z" }, mine)
        .stale,
    ).toBe(false);
  });

  /**
   * `version` is `0.1.0` on every build this project has shipped, so the field
   * named after the question is the one with no information in it. The sha is
   * what actually identifies a build — and what a person comparing two
   * machines, or an agent asked what it is running, needs.
   */
  it("names the commit it was built from — where the checkout can say", () => {
    const stamp = buildStamp();
    // A checkout reads `.git`; an install reads the manifest the release
    // branch stamps. But not every checkout CAN say: on reftable
    // (`extensions.refStorage = reftable`) the refs are binary tables and
    // `gitHead`'s documented answer is null — this repo's own dev machine is
    // that shape, which is how the first version of this test was caught
    // asserting a promise the feature cannot keep. The guard is shape-aware
    // rather than weakened: a readable checkout must name the sha, and a
    // reftable one must say nothing rather than something wrong.
    const reftable = existsSync(path.join(gitCommonDir(), "reftable"));
    if (reftable) {
      expect(stamp.commit).toBeNull();
      expect(describeBuild(stamp)).toBe(stamp.version);
    } else {
      expect(stamp.commit).toMatch(/^[0-9a-f]{7}$/);
      expect(describeBuild(stamp)).toContain(stamp.commit!);
    }
  });

  /**
   * **The four shapes `gitHead` claims to survive, built on disk and asked.**
   *
   * Written after the worktree one turned out not to be survived at all: it
   * returned null, which is indistinguishable from "this copy cannot say" and
   * so read as correct for as long as nobody checked. Every agent working in
   * this repo works in a worktree, so that null was `commit: null` on every
   * development copy — and no upgrade verdict on any of them.
   */
  describe("reading .git by hand", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    let scratch: string;

    beforeEach(async () => {
      scratch = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-githead-"));
    });
    afterEach(async () => {
      await fsp.rm(scratch, { recursive: true, force: true });
    });

    /** A clone: `.git` is a directory, and the ref is a loose file. */
    async function clone(at: string): Promise<string> {
      const dot = path.join(at, ".git", "refs", "heads");
      await fsp.mkdir(dot, { recursive: true });
      await fsp.writeFile(path.join(at, ".git", "HEAD"), "ref: refs/heads/main\n");
      await fsp.writeFile(path.join(dot, "main"), `${sha}\n`);
      return at;
    }

    it("reads a plain clone", async () => {
      const at = await clone(path.join(scratch, "clone"));
      expect(gitHead(at)?.commit).toBe(sha.slice(0, 7));
    });

    it("reads a detached HEAD, which names the sha outright", async () => {
      const at = path.join(scratch, "detached");
      await fsp.mkdir(path.join(at, ".git"), { recursive: true });
      await fsp.writeFile(path.join(at, ".git", "HEAD"), `${sha}\n`);
      expect(gitHead(at)?.commit).toBe(sha.slice(0, 7));
    });

    it("reads a repo whose refs `git gc` has packed", async () => {
      const at = path.join(scratch, "packed");
      await fsp.mkdir(path.join(at, ".git"), { recursive: true });
      await fsp.writeFile(path.join(at, ".git", "HEAD"), "ref: refs/heads/main\n");
      await fsp.writeFile(
        path.join(at, ".git", "packed-refs"),
        `# pack-refs with: peeled fully-peeled sorted\n${sha} refs/heads/main\n`,
      );
      expect(gitHead(at)?.commit).toBe(sha.slice(0, 7));
    });

    /**
     * The shape that was broken. A worktree's `.git` is a FILE naming a
     * per-worktree directory; that directory holds its own HEAD and a
     * `commondir` pointing at the repository, where the refs actually live.
     * Reading only the near half finds HEAD and then finds nothing.
     */
    it("reads a worktree, whose HEAD is its own and whose refs are not", async () => {
      const repo = await clone(path.join(scratch, "repo"));
      const gitdir = path.join(repo, ".git", "worktrees", "feature");
      await fsp.mkdir(gitdir, { recursive: true });
      await fsp.writeFile(path.join(gitdir, "HEAD"), "ref: refs/heads/feature\n");
      await fsp.writeFile(path.join(gitdir, "commondir"), "../..\n");
      // The branch lives in the REPOSITORY, which is the whole point.
      await fsp.writeFile(path.join(repo, ".git", "refs", "heads", "feature"), `${sha}\n`);

      const at = path.join(scratch, "tree");
      await fsp.mkdir(at, { recursive: true });
      await fsp.writeFile(path.join(at, ".git"), `gitdir: ${gitdir}\n`);
      expect(gitHead(at)?.commit).toBe(sha.slice(0, 7));
    });

    it("reads a worktree whose shared refs are packed", async () => {
      const repo = path.join(scratch, "repo2");
      await fsp.mkdir(path.join(repo, ".git"), { recursive: true });
      await fsp.writeFile(
        path.join(repo, ".git", "packed-refs"),
        `${sha} refs/heads/feature\n`,
      );
      const gitdir = path.join(repo, ".git", "worktrees", "feature");
      await fsp.mkdir(gitdir, { recursive: true });
      await fsp.writeFile(path.join(gitdir, "HEAD"), "ref: refs/heads/feature\n");
      await fsp.writeFile(path.join(gitdir, "commondir"), "../..\n");

      const at = path.join(scratch, "tree2");
      await fsp.mkdir(at, { recursive: true });
      await fsp.writeFile(path.join(at, ".git"), `gitdir: ${gitdir}\n`);
      expect(gitHead(at)?.commit).toBe(sha.slice(0, 7));
    });

    /** Reftable: the honest answer is null, and it must stay null rather than
     * become `.invalid` chased as a branch name. */
    it("says nothing at all on reftable, rather than something wrong", async () => {
      const at = path.join(scratch, "reftable");
      await fsp.mkdir(path.join(at, ".git", "reftable"), { recursive: true });
      await fsp.writeFile(path.join(at, ".git", "HEAD"), "ref: refs/heads/.invalid\n");
      expect(gitHead(at)).toBeNull();
    });

    it("says nothing when the ref is nowhere to be found", async () => {
      const at = path.join(scratch, "dangling");
      await fsp.mkdir(path.join(at, ".git"), { recursive: true });
      await fsp.writeFile(path.join(at, ".git", "HEAD"), "ref: refs/heads/gone\n");
      expect(gitHead(at)).toBeNull();
    });
  });

  it("says which build a daemon is running when the two shas disagree", () => {
    const verdict = stalenessOf(
      { root: "/opt/isocan", startedAt: "2026-08-16T09:00:00.000Z", commit: "abc1234" },
      stampOf({ commit: "def5678" }),
    );
    expect(verdict.stale).toBe(true);
    expect(verdict.why).toContain("abc1234");
    expect(verdict.why).toContain("def5678");
  });

  it("carries the version alone when nothing on disk can name a build", () => {
    expect(describeBuild({ version: "0.1.0" })).toBe("0.1.0");
    expect(describeBuild({ version: "0.1.0", commit: "abc1234", builtAt: "2026-08-25T21:51:54.000Z" }))
      .toBe("0.1.0 (abc1234, 2026-08-25)");
  });

  /**
   * **The producer and the consumer of an install's identity, pinned
   * together.**
   *
   * A checkout reads `.git`, so every test above passes whether or not the
   * release branch stamps anything — and an INSTALL has no `.git` at all. If
   * these two spellings drift, installs quietly go back to being unable to say
   * which build they are, and nothing anywhere fails. That is the same shape
   * of silence this file exists to end.
   */
  it("stamps the manifest with exactly the keys `buildStamp` reads", async () => {
    // By URL rather than by literal specifier: the script is plain JS with no
    // declarations, and a literal would have the typechecker demand some.
    const script = new URL("../../../scripts/release.mjs", import.meta.url).href;
    const { releaseManifest } = (await import(script)) as {
      releaseManifest: (pkg: object, commit?: string, builtAt?: string) => { isocan?: unknown };
    };
    const manifest = releaseManifest(
      { name: "isocan", version: "0.1.0", workspaces: ["packages/*"], scripts: { prepare: "x" } },
      "abc1234",
      "2026-08-25T21:51:54+00:00",
    );
    expect(manifest.isocan).toEqual({ commit: "abc1234", builtAt: "2026-08-25T21:51:54+00:00" });
    // And a build cut without them stamps nothing rather than nulls: absent is
    // how `buildStamp` spells "this copy cannot say".
    expect(releaseManifest({ name: "isocan", version: "0.1.0" })).not.toHaveProperty("isocan");
  });

  it("a daemon too old to have a stamp is stale by definition", () => {
    const verdict = stalenessOf({ startedAt: "2026-08-16T09:00:00.000Z" });
    expect(verdict.stale).toBe(true);
    expect(verdict.why).toContain("predates");
  });
});

/**
 * Auto-upgrade phase 1: the container's stamp is a build-arg, so the gate
 * that turns it into an identity is the whole feature. The image defaults the
 * arg to a word; a word is not a commit, and reporting one as if it were is
 * the false-success the project's standing lessons name.
 */
describe("the build-arg gate (plausibleSha)", () => {
  it("passes a real sha through, shortened to release.mjs's seven", () => {
    expect(plausibleSha("a1b2c3d4e5f6")).toBe("a1b2c3d");
    expect(plausibleSha("abc1234")).toBe("abc1234");
    // A 40-char sha is the git default; seven is the stamp's shape.
    expect(plausibleSha("0".repeat(40))).toBe("0000000");
  });

  it("maps every not-a-commit the image can hold to null", () => {
    // The Dockerfile's default, local-e2e's tag, empty and unset — the exact
    // values the design enumerates as 'this copy cannot say'.
    expect(plausibleSha("unknown")).toBe(null);
    expect(plausibleSha("e2e-1724692800")).toBe(null);
    expect(plausibleSha("")).toBe(null);
    expect(plausibleSha(undefined)).toBe(null);
    // A tag ref is not a sha either; only hex passes.
    expect(plausibleSha("v0.1.0")).toBe(null);
    expect(plausibleSha("main")).toBe(null);
  });
});

/**
 * **Auto-upgrade phase 2: the third kind of stale.**
 *
 * `stalenessOf` compares a CLI with the daemon holding its port.
 * `upgradeVerdict` asks the same question one hop further out — does this
 * daemon disagree with the home it forwards writes to — and the whole of the
 * care is in what it refuses to answer. The recurring defect this project has
 * met six times is a system that returns a cheerful success when it was given
 * nothing to compare against, so every case below where a side cannot name its
 * build asserts the ABSENCE of a verdict rather than the wording of one.
 */
describe("the verdict against the home (upgradeVerdict)", () => {
  const home = (over: Partial<HomeBuild> = {}): HomeBuild => ({
    url: "https://isocan.io",
    commit: "a1b2c3d",
    builtAt: "2026-08-25T09:00:00.000Z",
    ...over,
  });

  it("names both builds, both dates and the home when they differ", () => {
    const verdict = upgradeVerdict(
      home(),
      stampOf({ commit: "04279b2", builtAt: "2026-08-12T09:00:00.000Z" }),
    );
    expect(verdict).toMatchObject({
      available: true,
      direction: "behind",
      home: "https://isocan.io",
      homeCommit: "a1b2c3d",
      homeBuiltAt: "2026-08-25T09:00:00.000Z",
      mine: "04279b2",
      mineBuiltAt: "2026-08-12T09:00:00.000Z",
    });
    // The sentence a person reads: facts, both builds, no instruction.
    expect(verdict?.why).toBe(
      "this copy is 04279b2 (2026-08-12); your home https://isocan.io runs a1b2c3d (2026-08-25)",
    );
  });

  it("says so plainly when the home was asked and this copy is current", () => {
    const verdict = upgradeVerdict(home(), stampOf({ commit: "a1b2c3d" }));
    // A verdict, not an absence — "asked and current" and "could not ask" are
    // different answers, and only one of them may be reported as reassurance.
    expect(verdict).toMatchObject({ available: false, direction: null, why: "" });
  });

  it("produces NO verdict when the home cannot say which build it is", () => {
    // Today's production image, and every image built before phase 1.
    expect(upgradeVerdict(home({ commit: null }), stampOf({ commit: "04279b2" }))).toBe(null);
  });

  it("produces NO verdict when this copy cannot say, or when no home answered", () => {
    expect(upgradeVerdict(home(), stampOf({ commit: null }))).toBe(null);
    // Offline, homeless, never asked: one answer for all of them.
    expect(upgradeVerdict(null, stampOf({ commit: "04279b2" }))).toBe(null);
  });

  /**
   * Shas identify builds; dates order them. A home that is BEHIND its CLI is a
   * real shape — a pinned or lagging image — and it is a notice, never a
   * downgrade, so the direction has to be reported rather than assumed.
   */
  it("orders the two builds only when both dates say so", () => {
    const older = { commit: "04279b2", builtAt: "2026-08-12T09:00:00.000Z" };
    expect(upgradeVerdict(home(older), stampOf({ commit: "a1b2c3d", builtAt: "2026-08-25T09:00:00.000Z" }))?.direction)
      .toBe("ahead");
    // One side undated: they differ, and nothing orders them.
    expect(upgradeVerdict(home({ builtAt: null }), stampOf(older))?.direction).toBe(null);
    // Two builds cut the same second are two builds, and neither is older.
    expect(
      upgradeVerdict(
        home({ builtAt: older.builtAt }),
        stampOf({ commit: "04279b2", builtAt: older.builtAt }),
      )?.direction,
    ).toBe(null);
  });

  it("says the sha alone when a build carries no date", () => {
    const verdict = upgradeVerdict(home({ builtAt: null }), stampOf({ commit: "04279b2" }));
    expect(verdict?.why).toBe("this copy is 04279b2; your home https://isocan.io runs a1b2c3d");
  });
});
