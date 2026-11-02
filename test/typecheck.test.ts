import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * **Every test file is read by a compiler `npm run typecheck` runs** (cleanup
 * phase 6, TR-12, 27 Sep 2026).
 *
 * Each workspace's tsconfig took in its own `test/`, and the root `test/` —
 * the deep lane, the ratchets, the release and packaging checks — had no
 * tsconfig at all. Its first typecheck found 168 errors, and one of them was a
 * test that tested nothing: `design-lint-repo.test.ts` handed `it.each` bare
 * arrays, which it spreads into the callback's arguments, so the case meant to
 * pass `["--repo", "/tmp/acme"]` passed the string `"--repo"` and was green
 * for a reason nobody wrote.
 *
 * So the question is asked of the files rather than of the configs: which
 * TypeScript under a `test/` directory does no typecheck script compile? The
 * configs are the ones the scripts name — the root's `-p`, and each
 * workspace's `tsc --noEmit` (its `tsconfig.json`) or its own `-p` — read by
 * TypeScript's own parser, so an `include` means here what it means to `tsc`.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));

/** The configs a `typecheck` script compiles, relative to its package. */
function configsOf(script: string | undefined): string[] {
  if (!script) return [];
  return script
    .split("&&")
    .map((step) => step.trim())
    .filter((step) => /^tsc\b/.test(step))
    .map((step) => /-p\s+(\S+)/.exec(step)?.[1] ?? "tsconfig.json");
}

/** Every file a config compiles, as absolute paths. */
function compiledBy(config: string): string[] {
  const read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error) throw new Error(`${config}: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`);
  return ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(config)).fileNames.map((file) => path.resolve(file));
}

const packageJson = (dir: string) =>
  JSON.parse(readFileSync(path.join(repo, dir, "package.json"), "utf8")) as { scripts?: Record<string, string>; workspaces?: string[] };

describe("the typecheck", () => {
  it("runs the root test/ config, beside every workspace's", () => {
    const script = packageJson(".").scripts?.["typecheck"] ?? "";
    expect(script, "the root typecheck still runs the workspaces").toContain("--workspaces");
    expect(configsOf(script), "npm run typecheck no longer compiles test/").toContain("tsconfig.test.json");
  });

  it("leaves no test file uncompiled", () => {
    const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 30_000,
    }).split("\n");
    const tests = tracked.filter((file) => /(^|\/)test\//.test(file) && !/\/fixtures\//.test(file) && /\.tsx?$/.test(file));
    expect(tests.length, "found no test sources — the reading is broken, not the repo clean").toBeGreaterThan(500);

    const workspaces = tracked
      .filter((file) => /^packages\/(modules\/)?[^/]+\/package\.json$/.test(file))
      .map((file) => path.dirname(file));
    const configs = [
      ...configsOf(packageJson(".").scripts?.["typecheck"]).map((config) => path.join(repo, config)),
      ...workspaces.flatMap((dir) => configsOf(packageJson(dir).scripts?.["typecheck"]).map((config) => path.join(repo, dir, config))),
    ];
    const compiled = new Set(configs.flatMap(compiledBy));
    const unread = tests.filter((file) => !compiled.has(path.join(repo, file)));
    expect(
      unread,
      "no config that `npm run typecheck` runs compiles these — add their directory to the nearest tsconfig's include",
    ).toEqual([]);
  }, 60_000);
});
