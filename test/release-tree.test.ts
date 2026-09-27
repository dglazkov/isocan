import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assembleReleaseTree,
  buildReleaseArtifacts,
  CLI_BUNDLE,
  extractTree,
  unresolvedImports,
  worktreeTree,
} from "../scripts/release.mjs";

/**
 * **What ships is what runs** (cleanup phase 4, TR-4 and DC-1, 27 Sep 2026).
 *
 * The release was checked by its drop LIST and never by the tree the list
 * left. On 18 Sep the sources left the release branch and three scripts that
 * imported them stayed, so `isocan canvas shot` and every PDF export died
 * with ERR_MODULE_NOT_FOUND on every install — and left Chrome running — for
 * nine days, while every guard here was green.
 *
 * So this builds the release tree the way `npm run release` does — the same
 * `buildReleaseArtifacts` and `assembleReleaseTree`, over the working tree
 * rather than HEAD so it judges the change in front of it — extracts it the
 * way an install lays it out, and then asks it the questions an install asks:
 * does every import resolve, and do the files a CLI verb spawns START.
 *
 * Deep lane: it is a web build, a `tsc` emit and three esbuild runs before
 * the first case, and it spawns the bundled CLI.
 */

const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "isocan-release-tree-")));
let tree = "";

beforeAll(async () => {
  const out = path.join(scratch, "out");
  const artifacts = await buildReleaseArtifacts(out);
  const hash = await assembleReleaseTree({ base: await worktreeTree(), out, artifacts, sourceCommit: "deadbee" });
  tree = await extractTree(hash, path.join(scratch, "tree"));
}, 300_000);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("the release tree", () => {
  it("imports nothing it does not carry", async () => {
    // Red on the tree of 27 Sep's `#release`: canvas-shot's `@isocan/*` and
    // `.ts` imports, browser.mjs's `ws`, and the voice agent's tsx launcher.
    expect(await unresolvedImports(tree)).toEqual([]);
  }, 120_000);

  it("starts every script a CLI verb spawns — the paths the CLI names, as an install has them", () => {
    // `packagePath("scripts/…")` in packages/cli/src/main.ts. Run with no
    // arguments each prints its usage and exits 2 — which it can only reach
    // after its whole module graph has loaded, so exit 2 IS "it starts", and
    // ERR_MODULE_NOT_FOUND (exit 1) is the failure this file exists for.
    for (const script of ["scripts/canvas-shot.mjs", "scripts/deck-export.mjs"]) {
      const done = spawnSync(process.execPath, [path.join(tree, script)], { encoding: "utf8", cwd: scratch });
      expect(done.stderr, `${script} did not start`).not.toMatch(/ERR_MODULE_NOT_FOUND/);
      expect(done.stderr).toMatch(/usage:/);
      expect(done.status, `${script}\n${done.stderr}`).toBe(2);
    }
  }, 60_000);

  it("runs the CLI it declares, and knows which build it is", () => {
    const done = spawnSync(process.execPath, [path.join(tree, CLI_BUNDLE), "--version"], { encoding: "utf8", cwd: scratch });
    expect(done.status, done.stderr).toBe(0);
    expect(done.stdout).toContain("deadbee");
  }, 60_000);
});
