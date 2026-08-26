import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildStamp,
  describeBuild,
  plausibleSha,
  stalenessOf,
  type BuildStamp,
} from "../src/build.ts";

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
    expect(stamp.root).toMatch(/isocan$/);
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
    const reftable = existsSync(
      path.join(fileURLToPath(new URL("../../..", import.meta.url)), ".git", "reftable"),
    );
    if (reftable) {
      expect(stamp.commit).toBeNull();
      expect(describeBuild(stamp)).toBe(stamp.version);
    } else {
      expect(stamp.commit).toMatch(/^[0-9a-f]{7}$/);
      expect(describeBuild(stamp)).toContain(stamp.commit!);
    }
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
