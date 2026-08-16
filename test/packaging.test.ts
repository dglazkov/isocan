import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The repo is the package: `npx github:dglazkov/isocan` and
 * `npm i -g github:dglazkov/isocan` install this tree directly, no registry
 * involved (#42). Three things make that work, and each was learned the hard
 * way — this file remembers them.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (rel: string) =>
  JSON.parse(await fs.readFile(path.join(repo, rel), "utf8"));

describe("installable straight from git", () => {
  it("the root package is the CLI: a bin, and the deps a git install must resolve", async () => {
    const pkg = await readJson("package.json");
    expect(pkg.bin?.isocan).toBe("packages/cli/bin/isocan.js");
    // A git install resolves the ROOT package's dependencies only, so what
    // the CLI needs at runtime has to be listed here too.
    const cli = await readJson("packages/cli/package.json");
    const server = await readJson("packages/server/package.json");
    for (const dep of Object.keys({ ...cli.dependencies, ...server.dependencies })) {
      if (dep.startsWith("@isocan/")) continue; // resolved by path, see below
      expect(pkg.dependencies, `${dep} is missing from the root package`).toHaveProperty(dep);
    }
  });

  it("never depends on its own workspaces — link deps break every reinstall", async () => {
    // `"@isocan/core": "file:packages/core"` reads as harmless and installs
    // fine ONCE. Reinstalling over it leaves npm rebuilding a link whose
    // target it just deleted: "Cannot destructure property 'package' of
    // 'node.target'". bin/workspace-loader.mjs resolves them by path instead.
    const pkg = await readJson("package.json");
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(declared.filter((name) => name.startsWith("@isocan/"))).toEqual([]);

    const loader = await fs.readFile(
      path.join(repo, "packages/cli/bin/workspace-loader.mjs"),
      "utf8",
    );
    for (const name of ["@isocan/core", "@isocan/server"]) expect(loader).toContain(name);
  });

  it("ships the built web app, which .gitignore would otherwise drop", async () => {
    // `prepare` builds packages/web/dist at install time; .npmignore exists
    // solely so pack-time ignore rules don't then throw it away, leaving a
    // daemon that serves an empty page.
    const pkg = await readJson("package.json");
    expect(pkg.scripts.prepare).toContain("prepare.mjs");
    const npmignore = await fs.readFile(path.join(repo, ".npmignore"), "utf8");
    expect(npmignore).not.toMatch(/^\s*dist\s*$/m);
    const gitignore = await fs.readFile(path.join(repo, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^dist$/m); // still an artifact, still uncommitted
  });
});
