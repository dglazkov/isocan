import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import * as api from "../src/index.ts";

/**
 * **The module entry mirrors the surface it fronts** (iso-api phase 4).
 *
 * `index.mjs` at the repo root is what `import { connect } from "isocan"`
 * actually loads on an installed copy, and it re-exports `@isocan/api` by
 * NAME — dynamically, because the loaders it registers must run before the
 * package can resolve, so `export * from` is structurally unavailable. A
 * hand-kept name list drifts the day the surface grows a name, which is why
 * this test exists: it runs the entry in a real subprocess (registration is
 * process-global and does not belong inside the suite's worker) and holds its
 * export names equal to the package's own.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

describe("the isocan module entry", () => {
  it("re-exports exactly @isocan/api's runtime surface", () => {
    const entry = pathToFileURL(path.join(repo, "index.mjs")).href;
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(entry)}); console.log(JSON.stringify(Object.keys(m).sort()));`,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    expect(probe.status, probe.stderr).toBe(0);
    const entryNames = JSON.parse(probe.stdout.trim()) as string[];
    const surfaceNames = Object.keys(api).sort();
    expect(entryNames).toEqual(surfaceNames);
  });

  it("the manifest's exports entry points at files the tree carries", () => {
    // The release branch is HEAD's tree plus the built web app, so what this
    // checkout carries is what an install carries (scripts/release.mjs). The
    // `types` condition aims an editor at the package's TypeScript source —
    // the reference manual that cannot go stale — and the default at the
    // loader-registering entry above.
    const manifest = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8")) as {
      exports: Record<string, { types: string; default: string }>;
    };
    const root = manifest.exports["."];
    expect(root).toBeDefined();
    expect(root!.types).toBe("./packages/api/src/index.ts");
    expect(root!.default).toBe("./index.mjs");
    for (const target of [root!.types, root!.default]) {
      expect(existsSync(path.join(repo, target)), `${target} missing`).toBe(true);
    }
  });

  it("the release manifest moves the types condition to the compiled declarations", async () => {
    // An install has no workspace links and tsserver refuses `.ts` sources in
    // node_modules (measured 31 Aug: TS5097 and TS2307 on every api file), so
    // the release ships `types/` (release.mjs's emitTypes) and its manifest
    // must aim the editor there. The default stays the loader-registering
    // entry: runtime still runs the sources.
    const { releaseManifest } = (await import("../../../scripts/release.mjs")) as {
      releaseManifest: (pkg: object) => { exports: Record<string, { types: string; default: string }> };
    };
    const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8")) as object;
    const shipped = releaseManifest(pkg).exports["."];
    expect(shipped).toEqual({
      types: "./types/api/src/index.d.ts",
      default: "./index.mjs",
    });
  });
});
