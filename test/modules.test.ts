import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A module is removable, mechanically** (`docs/projects/modules/design.md`).
 *
 * The design's acceptance is literal — delete the directory and the two list
 * entries, and the build, the suite and `--help` agree the feature never
 * existed. That was run by hand once; this holds the half a test can hold
 * every time: a module's name appears outside its own directory only in the
 * two lists, the lockfile and the docs. The first file that imports a module
 * by name from anywhere else has made it a shell file in a different
 * directory, and this says so.
 *
 * And the other half of "both surfaces": a module in one list and not the
 * other is the web-only feature AGENTS.md forbids, in a box.
 */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = path.join(repo, "packages/modules");
const WEB_LIST = "packages/web/src/modules.ts";
const CLI_LIST = "packages/cli/src/modules.ts";

function moduleNames(): string[] {
  return readdirSync(modulesDir).filter((d) => existsSync(path.join(modulesDir, d, "package.json")));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|json|css|md)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("modules", () => {
  const names = moduleNames();

  it("exist — the parse has something to hold", () => {
    expect(names).toContain("mindmap");
  });

  for (const name of names) {
    const pkg = JSON.parse(readFileSync(path.join(modulesDir, name, "package.json"), "utf8"));
    const spec: string = pkg.name;

    it(`${spec} is named outside its directory only by the two lists`, () => {
      const elsewhere = walk(path.join(repo, "packages"))
        .filter((f) => !f.startsWith(path.join(modulesDir, name)))
        .filter((f) => readFileSync(f, "utf8").includes(spec))
        .map((f) => path.relative(repo, f))
        .filter((f) => f !== WEB_LIST && f !== CLI_LIST)
        // The manifest of a package that depends on it is a declaration, not an import.
        .filter((f) => !f.endsWith("package.json"));
      expect(elsewhere, `${spec} leaked out of its directory into: ${elsewhere.join(", ")}`).toEqual([]);
    });

    it(`${spec} is in both lists, or neither`, () => {
      const inWeb = readFileSync(path.join(repo, WEB_LIST), "utf8").includes(`${spec}/web`);
      const inCli = readFileSync(path.join(repo, CLI_LIST), "utf8").includes(`${spec}/cli`);
      expect({ inWeb, inCli }).toEqual(inWeb ? { inWeb: true, inCli: true } : { inWeb: false, inCli: false });
    });

    it(`${spec} carries a guide section for the verbs it registers`, () => {
      const cli = path.join(modulesDir, name, "src/cli.ts");
      if (!existsSync(cli)) return;
      const verbs = [...readFileSync(cli, "utf8").matchAll(/\.command\("([a-z-]+)/g)].map((m) => m[1]);
      const guide = path.join(modulesDir, name, "agent-guide.md");
      expect(existsSync(guide), `${spec} registers ${verbs.join(", ")} and ships no agent-guide.md`).toBe(true);
    });
  }
});
