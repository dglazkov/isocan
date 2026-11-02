import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * **A test that commits a fixture must not read the developer's git config**
 * (lessons.md #105). A global gitignore is personal — `dist/` is a common line
 * — and `git add .` honours it silently, so a fixture repository on one laptop
 * is missing files it has everywhere else, and the test is red there and green
 * on CI. Any test file that builds a repository with `git commit` runs its git
 * with `GIT_CONFIG_GLOBAL` pointed away (and `GIT_CONFIG_NOSYSTEM`), so what it
 * commits is what it wrote.
 */
const root = path.resolve(import.meta.dirname, "..");

const testFiles = execFileSync("git", ["ls-files", "--", "*.test.ts"], { cwd: root, encoding: "utf8", timeout: 10_000 })
  .split("\n")
  .filter((f) => f && !f.includes("node_modules"));

/** A file that spawns git itself AND passes it a `commit`. */
const commitsFixtures = (src: string): boolean =>
  /\b(spawn|spawnSync|execFile|execFileSync)\(\s*"git"/.test(src) && /"commit"/.test(src);

describe("tests that commit a git fixture", () => {
  const found = testFiles.filter((f) => commitsFixtures(fs.readFileSync(path.join(root, f), "utf8")));

  it("are found at all, so this cannot pass by matching nothing", () => {
    expect(found).toContain("packages/cli/test/documents.test.ts");
  });

  it("run git without the developer's global or system config", () => {
    const leaky = found.filter((f) => {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      return !(src.includes("GIT_CONFIG_GLOBAL") && src.includes("GIT_CONFIG_NOSYSTEM"));
    });
    expect(leaky, "set GIT_CONFIG_GLOBAL=/dev/null and GIT_CONFIG_NOSYSTEM=1 in these tests' git env").toEqual([]);
  });
});
