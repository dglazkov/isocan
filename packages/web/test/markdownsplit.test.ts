import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The split undoes itself silently, so it gets a test.**
 *
 * The markdown stack — micromark, mdast, hast, property-information — measured
 * ~175 KB of a 758 KB entry chunk, and `lib/markdown.tsx` moves it behind a
 * `React.lazy` boundary so a first visit does not download it.
 *
 * One `import ReactMarkdown from "react-markdown"` anywhere on the eager side
 * puts all of it back, and **nothing about the app would look wrong**: every
 * component still renders, every test still passes, and the only symptom is a
 * number in a nightly nobody reads that day. That is the shape lesson #14
 * names — a regression with no reachable failure — so the forcing function is
 * here instead.
 *
 * `remark-gfm` counts as much as the renderer does: it is a value, not a type,
 * so importing it eagerly beside a lazy `ReactMarkdown` keeps
 * `micromark-extension-gfm` in the entry chunk and leaves the boundary
 * decorative. That is why callers pass `breaks` as a flag and never a plugin.
 */

const src = fileURLToPath(new URL("../src", import.meta.url));
/** The one module allowed to reach the parser. Everything else goes through
 * `lib/markdown.tsx`, which is lazy. */
const FAR_SIDE = path.join(src, "lib/markdown-body.tsx");
const EAGER = /from\s+"(react-markdown|remark-gfm|remark-breaks)"/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("markdown stays behind its lazy boundary", () => {
  const files = walk(src);

  it("finds the source tree it means to check", () => {
    // Without this the sweep below passes vacuously the day the path moves.
    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain(FAR_SIDE);
  });

  it("only markdown-body.tsx imports the parser", () => {
    const offenders = files
      .filter((f) => f !== FAR_SIDE)
      .filter((f) => EAGER.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(src, f));
    expect(
      offenders,
      "import { Markdown } from lib/markdown.tsx instead — a direct import puts ~175 KB back in the entry chunk",
    ).toEqual([]);
  });

  it("markdown-body.tsx is reached only through import(), never a static import", () => {
    // The other half: the far side may hold the parser, but if anything
    // imports the far side statically then it is not far at all.
    const bad = files
      .filter((f) => f !== FAR_SIDE)
      .filter((f) => /from\s+"[^"]*markdown-body/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(src, f));
    expect(bad).toEqual([]);
  });

  it("the boundary module really is lazy, and offers a preload", () => {
    const boundary = readFileSync(path.join(src, "lib/markdown.tsx"), "utf8");
    expect(boundary).toMatch(/lazy\(\(\)\s*=>\s*import\("\.\/markdown-body\.tsx"\)\)/);
    expect(boundary).toContain("export function preloadMarkdown");
  });
});
