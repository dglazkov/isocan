import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **A workspace the lock file has never heard of stops CI before a test runs.**
 *
 * `npm ci` refuses outright when `package.json` and `package-lock.json`
 * disagree about which packages exist — it does not install what it can and
 * warn. So a new package under `packages/` that never reached the lock file
 * fails `suite-setup` in under two seconds, on the commit that decides a
 * release, with `Missing: @isocan/<name> from lock file`.
 *
 * **Nothing local sees it, which is why this exists.** `npm test` runs against
 * a `node_modules` that already has the package linked, because whoever added
 * it ran `npm install` at some point. The lock file is load-bearing in exactly
 * one place — a clean install — and nobody does one of those on a laptop. The
 * anatomy module landed with 542 green files and 5,286 passing tests and still
 * broke `main`.
 *
 * It happened because `package-lock.json` conflicts on every rebase in this
 * repo: `prepare` rewrites cosmetic `"peer": true` markers on every checkout,
 * so the file is usually pure noise and the reflex is to take the other side.
 * It is pure noise right up until the change adds a package.
 *
 * The check is a comparison of two lists and reads no network: every directory
 * the `workspaces` globs match, against the keys of the lock file's own
 * `packages` map. `npm ci` compares rather more than this, so a green case
 * here is not a promise that an install works — it is a promise about the one
 * mismatch that has actually cost a red main.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string): unknown => JSON.parse(readFileSync(path.join(repo, rel), "utf8"));

/** The directories `workspaces` actually names, resolved one glob level deep. */
function workspaceDirs(): string[] {
  const globs = ((read("package.json") as { workspaces?: string[] }).workspaces ?? []) as string[];
  return globs.flatMap((glob) => {
    if (!glob.endsWith("/*")) return existsSync(path.join(repo, glob, "package.json")) ? [glob] : [];
    const parent = glob.slice(0, -2);
    return readdirSync(path.join(repo, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(path.join(repo, parent, entry.name, "package.json")))
      .map((entry) => `${parent}/${entry.name}`);
  });
}

describe("the lock file knows every workspace", () => {
  const dirs = workspaceDirs();
  const lock = read("package-lock.json") as { packages: Record<string, { name?: string }> };

  it("finds the workspaces at all — a search over nothing always passes", () => {
    // `syncexec.test.ts`'s lesson, one directory over: a glob that matches
    // nothing makes every assertion below vacuously true.
    expect(dirs.length, "no workspace directories found; the finder is broken, not the tree").toBeGreaterThan(10);
    expect(dirs).toContain("packages/core");
  });

  it("has an entry for each of them", () => {
    const missing = dirs.filter((dir) => !lock.packages[dir]);
    expect(
      missing,
      "`npm ci` refuses this outright: run `npm install` and commit package-lock.json",
    ).toEqual([]);
  });

  /**
   * **The image plans its tree from manifests, not from the lock alone.**
   *
   * The Dockerfile copies every workspace manifest by name BEFORE `npm ci`, so
   * the install can plan before any source lands — its own comment says every
   * one has to be there. Modules were held to that by `test/modules.test.ts`
   * after one shipped without a line and no image built for two merges while
   * dev and prod sat still (5 Sep 2026). The top-level packages were held by
   * nothing: `api`, `mcp`, `rc` and `voice-agent` had no line at all, and
   * `voice-agent` arrived on 14 Sep to the same silence.
   *
   * Here rather than beside the modules guard because this is where the
   * workspaces are already enumerated, so the list cannot be the stale half.
   */
  it("is copied into the image before npm ci, every one of them", () => {
    const dockerfile = readFileSync(path.join(repo, "Dockerfile"), "utf8");
    const missing = dirs.filter((dir) => !dockerfile.includes(`COPY ${dir}/package.json`));
    expect(
      missing,
      "add `COPY <dir>/package.json <dir>/package.json` to the Dockerfile, above `npm ci`",
    ).toEqual([]);
  });

  it("names each one the same way its package.json does", () => {
    const wrong = dirs
      .map((dir) => ({
        dir,
        declared: (read(`${dir}/package.json`) as { name?: string }).name,
        locked: lock.packages[dir]?.name,
      }))
      .filter((row) => row.declared !== row.locked)
      .map((row) => `${row.dir}: package.json says ${row.declared}, the lock says ${row.locked}`);
    expect(wrong, "a renamed package is the same failure wearing a different hat").toEqual([]);
  });

  it("resolves each workspace under node_modules, the way an install will", () => {
    const unresolved = dirs
      .map((dir) => ({ dir, name: (read(`${dir}/package.json`) as { name?: string }).name }))
      .filter((row) => row.name && lock.packages[`node_modules/${row.name}`]?.resolved !== row.dir)
      .map((row) => `${row.name} does not resolve to ${row.dir}`);
    expect(unresolved, "the link npm makes at install time is recorded in the lock file too").toEqual([]);
  });
});
