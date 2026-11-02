import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withoutComments } from "./source.ts";

/**
 * **A ratchet that reports a bound the tree in front of it has already moved.**
 *
 * `persona ls` answers with the BOUND directory's personas, and that is right:
 * standing anywhere inside a bound project, "the roles here" means that
 * project's roles, not none. A git worktree breaks the assumption behind it —
 * it is a second copy of the source, bound to the first — so `ratchet.mjs` run
 * from a worktree read the MAIN checkout's `.agents/personas` while measuring
 * the worktree's code.
 *
 * On 14 Sep 2026 that printed `op-types: 36, past at most 35` from a tree whose
 * own persona file said 36, because the bound checkout was parked on an older
 * commit. A ratchet miss is meant to be news. News that is an artefact of where
 * the command ran is worse than no news, because it teaches the reader to skim
 * past the real ones.
 *
 * `--root` fixes it without touching the default, which is the property this
 * file cares about most: every existing invocation must still mean exactly
 * what it meant before.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");

/** A directory holding one persona with a bound nobody else uses. */
function treeWithBound(value: number): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "isocan-persona-"));
  mkdirSync(path.join(dir, ".agents/personas"), { recursive: true });
  writeFileSync(
    path.join(dir, ".agents/personas/scout.md"),
    [
      "---",
      "name: scout",
      "goals:",
      "  - name: things counted here",
      `    at most: ${value}`,
      "    measured by: node scripts/measure.mjs nothing",
      "---",
      "",
      "A persona that exists to be read from somewhere.",
      "",
    ].join("\n"),
  );
  return dir;
}

const personas = (cwd: string, ...args: string[]): any =>
  JSON.parse(
    execFileSync("node", [cli, "--json", "persona", ...args, "ls"], {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
    }),
  );

const boundOf = (rows: any[], name = "scout"): number | null => {
  const persona = rows.find((row: any) => row.name === name);
  return persona?.goals?.[0]?.bound?.value ?? null;
};

describe("persona --root", () => {
  it("reads the directory it is given, not the one the shell is in", () => {
    const here = treeWithBound(7);
    const there = treeWithBound(99);
    try {
      // Standing in `here`, asking for `there`.
      expect(boundOf(personas(here, "--root", there))).toBe(99);
      // And the other way, so the answer is the flag and not the fixture.
      expect(boundOf(personas(there, "--root", here))).toBe(7);
    } finally {
      rmSync(here, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(there, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("changes nothing when it is not passed", () => {
    // The whole safety argument for the flag: an unbound directory still
    // falls back to cwd exactly as it did before.
    const here = treeWithBound(7);
    try {
      expect(boundOf(personas(here))).toBe(7);
    } finally {
      rmSync(here, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("the ratchet measures this checkout against this checkout", () => {
  const ratchet = withoutComments(readFileSync(path.join(repo, "scripts/ratchet.mjs"), "utf8"));

  it("asks for its own repo root rather than the bound one", () => {
    expect(
      ratchet,
      "without --root the ratchet reads the bound checkout's bounds from a worktree",
    ).toMatch(/"persona",\s*"--root",\s*repo/);
  });

  it("still reads through the CLI, so there is one parser", () => {
    // The roadmap's lesson: a second parser drifts from the first.
    expect(ratchet).toMatch(/execFileSync\("node", \[cli,/);
  });
});
