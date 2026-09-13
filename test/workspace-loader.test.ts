import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Every `@isocan/*` the CLI depends on resolves on an INSTALLED copy.**
 *
 * `packages/cli/bin/workspace-loader.mjs` maps package names to sibling
 * sources by hand, because an install from git has no workspace links to
 * follow (#47). A checkout does have them — so a package missing from that
 * map works perfectly here and fails only for somebody who ran
 * `npm i -g github:dglazkov/isocan#release`, at the moment they run the
 * command that needs it.
 *
 * That is the same shape as the Dockerfile's missing-manifest trap: green
 * everywhere the author looks, broken everywhere it ships. `@isocan/mcp` was
 * added on 9 Sep and hit it (#220, phase 2), which is why this exists rather
 * than a comment asking the next person to remember.
 */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOADER = "packages/cli/bin/workspace-loader.mjs";

describe("the workspace loader", () => {
  it("maps every @isocan/* the CLI declares as a dependency", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repo, "packages/cli/package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const declared = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith("@isocan/"),
    );
    const loader = readFileSync(path.join(repo, LOADER), "utf8");
    const missing = declared.filter((name) => !loader.includes(`["${name}",`));
    expect(
      missing,
      `add these to ${LOADER}'s \`sources\` map — without a line there they resolve in a ` +
        "checkout (workspace links) and fail on an installed copy, which is the only place " +
        "anybody would find out",
    ).toEqual([]);
  });

  it("maps them to files that exist", () => {
    // A path typo has the same failure signature and the same audience.
    const loader = readFileSync(path.join(repo, LOADER), "utf8");
    const entries = [...loader.matchAll(/\["(@isocan\/[a-z-]+)", new URL\("([^"]+)"/g)];
    expect(entries.length).toBeGreaterThan(0);
    for (const [, name, relative] of entries) {
      const resolved = path.resolve(repo, "packages/cli/bin", relative!);
      expect(existsSync(resolved), `${name} points at ${relative}, which is not there`).toBe(true);
    }
  });
});
