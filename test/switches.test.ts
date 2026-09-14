import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CI_SWITCHES, SWITCHES, ciEnv, enforcedLines } from "../scripts/switches.mjs";

/**
 * **The guard on the list of anti-skip switches.**
 *
 * Three suites here can decide at runtime that they cannot run, and each has a
 * variable that turns that decision into a failure. The list used to live in
 * two `env:` blocks — `release.yml` and `pr.yml`, the same eleven lines of
 * comment in each — and two copies of a list is a list that drifts, silently,
 * in the direction where pull requests stay green while main goes red.
 *
 * So `scripts/switches.mjs` holds it, `npm run test:ci` sets it, and both
 * workflows run that. These cases keep that arrangement from quietly coming
 * apart: a workflow that goes back to setting one by hand, a switch nobody
 * reads, a variable in the tree with no entry. The last is the one sheep's
 * `RING_ON_CI` is really about — silence must not be able to add a switch, or
 * to leave one off CI.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string): string => readFileSync(path.join(repo, rel), "utf8");

/**
 * Every file in the tree, tracked and not — `--others` matters here for the
 * same reason it does in `deeplist.test.ts`: a switch being introduced right
 * now, in a file not yet committed, is exactly when you want to be told it has
 * no entry. Without it this case passed while `scripts/switches.mjs` itself
 * was still untracked, which is how it was found.
 */
const tracked = (): string[] =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30_000,
  }).split("\n");
const workflows = [".github/workflows/release.yml", ".github/workflows/pr.yml"];

describe("the anti-skip switches", () => {
  it("are set by the one command both workflows run", () => {
    for (const workflow of workflows) {
      /* Arguments allowed, and only arguments. `release.yml` shards with
         `-- --shard=N/4`; what this case is about is that the suite goes
         through the command that sets the switches, not that it is called
         bare. A `vitest` invoked directly would run tests AND let the
         emulator, bundle and deep suites skip themselves inside it. */
      expect(read(workflow), `${workflow} should run the suite through npm run test:ci`).toMatch(
        /^\s*- run: npm run test:ci(\s+--.*)?\s*$/m,
      );
    }
  });

  it("are set nowhere by hand — the copy that drifts", () => {
    for (const workflow of workflows) {
      const lines = read(workflow)
        .split("\n")
        .filter((line) => /ISOCAN_REQUIRE_/.test(line) && !/^\s*#/.test(line));
      expect(lines, `${workflow} sets a switch itself; put it in scripts/switches.mjs`).toEqual([]);
    }
  });

  it("account for every ISOCAN_REQUIRE_ variable in the tree", () => {
    const declared = new Set(SWITCHES.map((s) => s.name));
    const found = new Set<string>();
    const files = tracked().filter((file) => /\.(ts|tsx|mjs|js|yml|yaml)$/.test(file) && !file.startsWith("docs/"));
    for (const file of files) {
      let source = "";
      try {
        source = read(file);
      } catch {
        continue; // staged-deleted, or a symlink into a worktree that is gone
      }
      for (const match of source.matchAll(/ISOCAN_REQUIRE_[A-Z0-9_]+/g)) found.add(match[0]);
    }
    const undeclared = [...found].filter((name) => !declared.has(name));
    expect(undeclared, "a switch nothing declares: add it to scripts/switches.mjs, with its reason").toEqual([]);
  });

  it("are each actually read by something — a switch nobody reads is a wish", () => {
    // docs/reviews/lessons.md #13: `scripts/grade.mjs --selftest` was a good
    // guard that no test, script or workflow invoked. A variable declared here
    // and read nowhere would be the same shape, one level down.
    const sources = tracked().filter(
      (file) => /\.(ts|tsx|mjs|js)$/.test(file) && file !== "scripts/switches.mjs" && file !== "test/switches.test.ts",
    );
    const reads = (file: string, name: string): boolean => {
      try {
        return new RegExp(`${name}\\b`).test(read(file));
      } catch {
        return false;
      }
    };
    const unread = SWITCHES.filter((s) => !sources.some((file) => reads(file, s.name))).map((s) => s.name);
    expect(unread, "declared and read by no suite: either wire it up or take it out").toEqual([]);
  });

  it("each carry the argument the workflows used to repeat", () => {
    for (const s of SWITCHES) {
      expect(s.why.length, `${s.name} needs a reason, not an entry`).toBeGreaterThan(80);
      expect(s.covers.length, `${s.name} should say what skips without it`).toBeGreaterThan(10);
      expect(s.locally, `${s.name} should say what a person types`).toMatch(/npm/);
    }
  });

  it("turn into the environment test:ci sets, and say so before the suites", () => {
    expect(ciEnv()).toEqual(Object.fromEntries(CI_SWITCHES.map((s) => [s.name, "1"])));
    expect(Object.values(ciEnv()).every((v) => v === "1")).toBe(true);
    const said = enforcedLines().join("\n");
    for (const s of CI_SWITCHES) expect(said).toContain(s.name);
  });
});
