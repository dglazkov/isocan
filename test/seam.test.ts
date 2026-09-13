import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The seam cannot grow a method the conformance suites do not exercise.
 *
 * Two backings is the moment this becomes possible to get wrong: somebody
 * adds a method to `Store`, implements it on `FileStore`, tests it in
 * `store.test.ts`, and the cloud backing gets an implementation nobody ever
 * runs. The suite stays green and the hosted home breaks in a way that only
 * production can find.
 *
 * So it is a build failure instead. This file is the same family as
 * `packaging.test.ts` and `surface.test.ts`: this repo's best habit is
 * turning a convention into a forcing function, and this is where that
 * applies next. It needs no emulator and no cloud — it reads source.
 *
 * There is a second thing it guards, cheaply, and it is the one phase 1
 * established: `store.ts` and `desk.ts` have NO RUNTIME IMPORT AT ALL. That
 * makes "the engine compiles against the interface and nothing else" a grep
 * rather than a promise, and phase 4 doubles the stakes — those two files are
 * now the whole contract between a workspace that carries Google's client
 * libraries and one that must never see them.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => fs.readFile(path.join(repo, rel), "utf8");

/** Required method names, including every named parent supplied with the
 * seam's source. An unresolved parent fails rather than hiding its methods. */
function methodsOf(source: string, interfaceName: string): string[] {
  const names = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const declaration = new RegExp(`export interface ${name}(?:\\s+extends\\s+([^{}]+?))?\\s*\\{`).exec(source);
    expect(declaration, `${name} not found`).not.toBeNull();
    const start = declaration!.index;
    const end = source.indexOf("\n}", start);
    expect(end, `${name} body not found`).toBeGreaterThan(start);
    const body = source.slice(start + declaration![0].length, end);
    for (const parent of declaration![1]?.split(",") ?? []) {
      const inherited = parent.trim();
      expect(inherited, `unsupported parent of ${name}`).toMatch(/^\w+$/);
      visit(inherited);
    }
    for (const match of body.matchAll(/^\s{2}(\w+)\s*\(/gm)) names.add(match[1]!);
  };
  visit(interfaceName);
  return [...names];
}

describe("the storage seam", () => {
  it("counts inherited methods and refuses a missing parent declaration", () => {
    const parent = "export interface Parent {\n  inherited(): void;\n}";
    const child = "export interface Child extends Parent {\n  own(): void;\n}";
    expect(methodsOf(`${parent}\n${child}`, "Child")).toEqual(["inherited", "own"]);
    expect(() => methodsOf(child, "Child")).toThrow("Parent not found");
  });

  it("every Store method is exercised by the shared conformance suite", async () => {
    const methods = methodsOf(await read("packages/server/src/store.ts"), "Store");
    // A sanity floor: if the regex ever stops finding methods, this test must
    // fail rather than pass vacuously.
    expect(methods.length).toBeGreaterThan(15);
    const suite = await read("test/conformance/store-conformance.ts");
    for (const method of methods) {
      expect(suite, `Store.${method} is not exercised by the conformance suite`).toContain(
        `store.${method}(`,
      );
    }
  });

  it("every Desk method is exercised by the shared conformance suite", async () => {
    const sources = await Promise.all(["packages/server/src/desk.ts", "packages/server/src/personal-desk.ts"].map(read));
    const methods = methodsOf(sources.join("\n"), "Desk");
    expect(methods.length).toBeGreaterThan(10);
    const suite = await read("test/conformance/desk-conformance.ts");
    for (const method of methods) {
      expect(suite, `Desk.${method} is not exercised by the conformance suite`).toContain(
        `desk.${method}(`,
      );
    }
  });

  it("both conformance suites are actually run against BOTH backings", async () => {
    const callers: Record<string, string[]> = {
      storeConformance: ["packages/server/test/store.test.ts", "packages/cloudstore/test/cloud-store.test.ts"],
      deskConformance: ["packages/server/test/desk.test.ts", "packages/cloudstore/test/cloud-desk.test.ts"],
    };
    for (const [suite, files] of Object.entries(callers)) {
      for (const file of files) {
        expect(await read(file), `${file} should call ${suite}`).toContain(`${suite}(`);
      }
    }
  });

  it("store.ts and desk.ts still have no runtime import at all", async () => {
    for (const file of ["packages/server/src/store.ts", "packages/server/src/desk.ts", "packages/server/src/personal-desk.ts"]) {
      const source = await read(file);
      // `[\s\S]` on purpose: these files' imports are multi-line, and a regex
      // that only saw single-line ones would pass by not looking.
      const imports = [...source.matchAll(/^import\s+([\s\S]*?)\s+from\s+/gm)].map((m) => m[1]!);
      expect(imports.length, `${file} should import something`).toBeGreaterThan(0);
      for (const clause of imports) {
        expect(clause.startsWith("type "), `${file} has a RUNTIME import: ${clause}`).toBe(true);
      }
      // …and no side-effect imports either, which the clause check cannot see.
      expect(source).not.toMatch(/^import\s+["']/m);
    }
  });

  it("daemon.ts is still the one place a backing is reached for", async () => {
    // By MODULE PATH, because that is what a runtime coupling actually is;
    // the class names appear in prose all over these files and should.
    const backings = ["./file-store.ts", "./file-desk.ts", "@isocan/cloudstore"];
    const allowed = new Set(["daemon.ts", "index.ts"]);
    const server = path.join(repo, "packages/server/src");
    let checked = 0;
    for (const file of await fs.readdir(server)) {
      if (!file.endsWith(".ts") || allowed.has(file)) continue;
      checked += 1;
      const source = await fs.readFile(path.join(server, file), "utf8");
      for (const backing of backings) {
        expect(source, `${file} reaches for ${backing}`).not.toContain(`from "${backing}"`);
        expect(source, `${file} reaches for ${backing}`).not.toContain(`import("${backing}")`);
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
