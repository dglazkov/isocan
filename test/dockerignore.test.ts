import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **The home image carries no package's dev scripts** (cleanup phase 4, TR-8,
 * 27 Sep 2026).
 *
 * `.dockerignore` excluded `packages/*\/scripts` and said why: a package's
 * `scripts/` is dev tooling, and one of them talks to a real bucket. But the
 * modules are packages one level deeper, and `packages/*` does not reach
 * `packages/modules/wireframe/scripts/calibrate.ts` — a `--budget`-capped run
 * against a paid model — which therefore rode into every home image. The rule was
 * written for the packages that existed the day it was written.
 *
 * So this reads the rule from the file and the directories from git, and
 * asks Docker's question of each: is this path excluded?
 */

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * Docker's matcher, as far as `.dockerignore` uses it: patterns are paths from
 * the context root, `*` and `?` stay inside one segment, `**` spans any number
 * of them, a leading `/` is ignored, a pattern excludes a directory and
 * everything under it, a `!` line re-includes, and the last match wins.
 */
function dockerExcludes(patterns: readonly string[], file: string): boolean {
  const escape = (segment: string) =>
    segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  let excluded = false;
  for (const raw of patterns) {
    const negate = raw.startsWith("!");
    const parts = (negate ? raw.slice(1) : raw).replace(/^\/+/, "").replace(/\/+$/, "").split("/");
    const source = parts
      .map((segment, i) => {
        const last = i === parts.length - 1;
        if (segment === "**") return last ? ".*" : "(?:[^/]+/)*";
        return escape(segment) + (last ? "" : "/");
      })
      .join("");
    // A pattern matches the path itself or any directory above it.
    if (new RegExp(`^${source}(?:/.*)?$`).test(file)) excluded = !negate;
  }
  return excluded;
}

function patterns(): string[] {
  return readFileSync(path.join(repo, ".dockerignore"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe(".dockerignore", () => {
  it("excludes every package's scripts/, the modules' included", () => {
    const dirs = new Set(
      execFileSync("git", ["ls-files", "packages"], { cwd: repo, encoding: "utf8", timeout: 20_000 })
        .split("\n")
        .map((file) => /^(packages\/.*?\/scripts)\//.exec(file)?.[1])
        .filter((dir): dir is string => Boolean(dir)),
    );
    // Not a silent zero: the finding's own file is one of them.
    expect([...dirs]).toContain("packages/modules/wireframe/scripts");
    const shipped = [...dirs].filter((dir) => !dockerExcludes(patterns(), `${dir}/x.ts`));
    expect(shipped, "in the home image's build context").toEqual([]);
  });

  it("matches the way Docker does, on the shapes the file uses", () => {
    expect(dockerExcludes(["packages/*/scripts"], "packages/cloudstore/scripts/x.ts")).toBe(true);
    expect(dockerExcludes(["packages/*/scripts"], "packages/modules/judge/scripts/x.ts")).toBe(false);
    expect(dockerExcludes(["packages/**/scripts"], "packages/modules/judge/scripts/x.ts")).toBe(true);
    expect(dockerExcludes(["**/test"], "packages/core/test/a.test.ts")).toBe(true);
    expect(dockerExcludes(["docs"], "docs/a.md")).toBe(true);
    expect(dockerExcludes(["docs"], "packages/docs/a.md")).toBe(false);
    expect(dockerExcludes(["docs", "!docs/keep.md"], "docs/keep.md")).toBe(false);
    // The root `scripts/` stays, on purpose: `prepare` names a file in it.
    expect(dockerExcludes(patterns(), "scripts/prepare.mjs")).toBe(false);
  });
});
