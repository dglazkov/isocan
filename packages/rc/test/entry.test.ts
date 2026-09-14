import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as rc from "../src/index.ts";

/**
 * **`rc.mjs` mirrors the surface it fronts** — the room module's copy of
 * `packages/api/test/entry.test.ts`. The root entry re-exports `@isocan/rc` by
 * a hand-kept name list (a static `export *` cannot see the loader), so this
 * runs it in a real subprocess and holds its names equal to the package's.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("the isocan/rc module entry", () => {
  it("re-exports exactly @isocan/rc's runtime surface, resolved as isocan/rc", () => {
    // By the package's own name, from inside the package (Node's
    // self-reference), so the manifest's `./rc` export is what resolves it.
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import("isocan/rc"); console.log(JSON.stringify(Object.keys(m).sort()));`,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    expect(probe.status, probe.stderr).toBe(0);
    expect(JSON.parse(probe.stdout.trim())).toEqual(Object.keys(rc).sort());
  });

  it("the manifest exports ./rc beside ., at files the tree carries", () => {
    const manifest = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8")) as {
      exports: Record<string, { types: string; browser: string; default: string }>;
    };
    expect(manifest.exports["."]).toBeDefined();
    // `browser` ahead of `default` (room phase 4): a browser-platform bundler
    // in the checkout takes the source entry, Node takes `rc.mjs`. Key order
    // is what a resolver reads, so the order is asserted, not only the values.
    expect(Object.entries(manifest.exports["./rc"]!)).toEqual([
      ["types", "./packages/rc/src/index.ts"],
      ["browser", "./packages/rc/src/index.ts"],
      ["default", "./rc.mjs"],
    ]);
    for (const target of [manifest.exports["./rc"]!.types, manifest.exports["./rc"]!.browser, manifest.exports["./rc"]!.default]) {
      expect(existsSync(path.join(repo, target)), `${target} missing`).toBe(true);
    }
  });
});
