import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * **The room module runs without Node** (docs/projects/room/design.md,
 * "Distribution and the boundary"; journey 3's acceptance inside the suite).
 *
 * Two methods, because each misses what the other sees. The walk (the method
 * of `packages/api/test/boundary.test.ts`) reads every file `index.ts` reaches,
 * following relative imports and `@isocan/*` workspaces into their sources, and
 * names the line that imports `node:` or `@isocan/server`. The bundle (the
 * method of `packages/api/test/context-reader.test.ts`) builds the entry for
 * the browser platform, which also covers the npm packages the walk does not
 * follow.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const entry = path.join(repo, "packages", "rc", "src", "index.ts");

describe("the room module's boundary", () => {
  it("nothing reachable from the entry imports node:* or @isocan/server", () => {
    const reached = closureOf(entry);
    // Every source file in the module is swept too, reachable or not: a file
    // that is not imported today is one import away from being reached.
    const files = new Set([...reached, ...sourceFiles(path.join(repo, "packages", "rc", "src"))]);
    const offenders: string[] = [];
    for (const file of files) {
      for (const { line, specifier } of importsOf(file)) {
        if (specifier.startsWith("node:") || specifier === "@isocan/server" || specifier.startsWith("@isocan/server/")) {
          offenders.push(`${path.relative(repo, file)}:${line}: ${specifier}`);
        }
      }
    }
    expect(reached.map((f) => path.relative(repo, f))).toContain("packages/core/src/index.ts");
    expect(
      offenders,
      `isocan/rc is for hosts with no Node — nothing it reaches may import node:* or @isocan/server:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("bundles for the browser platform with no node: in the output", async () => {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      logLevel: "silent",
    });
    expect(result.outputFiles[0]!.text).not.toMatch(/node:/);
  });

  it("names no node: external, even when a bundler is told node: may stay external", async () => {
    // Journey 3's one-line bundle reads the externals. With `node:*` allowed
    // to stay external the build succeeds either way, so the externals list is
    // the only place an import of one would show.
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      logLevel: "silent",
      metafile: true,
      external: ["node:*"],
    });
    const externals = Object.values(result.metafile.inputs)
      .flatMap((input) => input.imports)
      .filter((imported) => imported.external)
      .map((imported) => imported.path);
    expect(externals.filter((p) => p.startsWith("node:"))).toEqual([]);
  });
});

/** Every import specifier in a file, with its line — static, side-effect,
 * re-export and dynamic forms. Comment lines are skipped: doc comments talk
 * about the imports this module must not make. */
function importsOf(file: string): { line: number; specifier: string }[] {
  const found: { line: number; specifier: string }[] = [];
  for (const [i, text] of readFileSync(file, "utf8").split("\n").entries()) {
    const lead = text.trimStart();
    if (lead.startsWith("//") || lead.startsWith("*") || lead.startsWith("/*")) continue;
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
      found.push({ line: i + 1, specifier: m[1]! });
    }
  }
  return found;
}

/** `start` and every file it reaches through relative imports and `@isocan/*`
 * workspace entries (resolved through each workspace's own `exports`). npm
 * packages are left to the bundle test. */
function closureOf(start: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const { specifier } of importsOf(file)) {
      const target = specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : specifier.startsWith("@isocan/")
          ? workspaceSource(specifier)
          : null;
      if (target && existsSync(target)) walk(target);
    }
  };
  walk(start);
  return [...seen];
}

function workspaceSource(specifier: string): string | null {
  const [, name, ...rest] = specifier.split("/");
  const sub = rest.length ? `./${rest.join("/")}` : ".";
  for (const dir of [path.join(repo, "packages", name!), path.join(repo, "packages", "modules", name!)]) {
    const manifest = path.join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const exports = (JSON.parse(readFileSync(manifest, "utf8")) as { exports?: Record<string, string> }).exports ?? {};
    const target = exports[sub];
    if (typeof target === "string") return path.join(dir, target);
  }
  return null;
}

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) found.push(full);
    }
  };
  walk(root);
  return found;
}
