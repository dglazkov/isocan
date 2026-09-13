import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **A `lazy()` call must sit below the import that names it**, and only the
 * dev server can tell you when it does not.
 *
 * Rollup hoists imported bindings above everything, so a call written above
 * its own import builds and ships and passes CI. Vite's dev transform does
 * not: it rewrites `import { lazy } from "react"` into a binding at the
 * import's own position, so a call above it reads the binding inside its
 * temporal dead zone and every page throws *Cannot access 'lazy' before
 * initialization*. `npm run dev` was broken this way for a day
 * (`CanvasPage.tsx`, canvas-groups phase 2) while the suite stayed green —
 * which is the whole reason this file exists rather than a comment.
 *
 * The check is deliberately about ORDER inside one file, not about `lazy`
 * being used at all: a lazy route is the pattern this app leans on for every
 * rare surface, and the boundary tests elsewhere want more of them, not less.
 */
const web = fileURLToPath(new URL("../src", import.meta.url));

async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(full)));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The line a call sits on, ignoring comments — a sentence about `lazy(` is
 *  not a call, and this test has several of its own. */
const callLine = (lines: string[]): number =>
  lines.findIndex((line) => {
    const code = line.replace(/^\s*(\*|\/\/|\/\*).*/, "");
    return /(?<![\w.])lazy\s*\(/.test(code);
  });

describe("a lazy() call sits below the import that names it", () => {
  it("holds in every web source file", async () => {
    const wrong: string[] = [];
    for (const file of await sources(web)) {
      const lines = (await fs.readFile(file, "utf8")).split("\n");
      const importedAt = lines.findIndex((line) => /^\s*import\s.*\blazy\b.*from\s+"react"/.test(line));
      if (importedAt < 0) continue;
      const calledAt = callLine(lines);
      if (calledAt >= 0 && calledAt < importedAt) {
        wrong.push(`${path.relative(web, file)}: lazy() on line ${calledAt + 1}, imported on line ${importedAt + 1}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("would catch the shape it exists for", () => {
    const broken = [
      `const Panel = lazy(() => import("./Panel.tsx"));`,
      `import { lazy } from "react";`,
    ];
    const importedAt = broken.findIndex((line) => /^\s*import\s.*\blazy\b.*from\s+"react"/.test(line));
    expect(callLine(broken)).toBeLessThan(importedAt);

    const fixed = [broken[1], broken[0]];
    const fixedImport = fixed.findIndex((line) => /^\s*import\s.*\blazy\b.*from\s+"react"/.test(line));
    expect(callLine(fixed)).toBeGreaterThan(fixedImport);
  });
});
