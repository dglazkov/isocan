import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sheets } from "./cssrules.ts";

/**
 * **Which source could put a class on the page**, for the two guards that ask
 * of a stylesheet rule "does anything render this?" (`deadrules.test.ts`) and
 * "does the first visit render this?" (`lazycss.test.ts`). One walk, so the
 * two cannot disagree about what "used" means (lessons.md #5).
 *
 * Read the only way the tree can answer without a browser: a class is used by
 * a file when that file contains the class as a word. Every `.ts`, `.tsx`,
 * `.js`, `.mjs` and `.html` under a package's `src/` and a module's `assets/`,
 * plus the app's `index.html`. Deliberately generous — a class named in a
 * comment, a test id or a server string counts — so both guards are wrong
 * only in the safe direction: what they call dead is dead, and what they call
 * lazy-only is lazy-only.
 */

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

function sourcesUnder(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(path.join(REPO, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === "node_modules" || e.name === "dist") return [];
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourcesUnder(rel);
    return /\.(tsx?|mjs|js|html)$/.test(e.name) ? [rel] : [];
  });
}

const dirsIn = (dir: string) =>
  readdirSync(path.join(REPO, dir), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `${dir}/${e.name}`);

export interface Source {
  /** Repo-relative, e.g. `packages/web/src/components/StageEditor.tsx`. */
  file: string;
  /** Every word in it that could be a class name. */
  words: Set<string>;
}

/**
 * Every source, with its words. A component that carries its own
 * `<style>{…}` string (the talk module) is read with that CSS blanked out —
 * otherwise every rule in it would name its own class and count as used.
 */
export const sources: Source[] = [
  "packages/web/index.html",
  ...dirsIn("packages").flatMap((p) => sourcesUnder(`${p}/src`)),
  ...dirsIn("packages/modules").flatMap((m) => [...sourcesUnder(`${m}/src`), ...sourcesUnder(`${m}/assets`)]),
].map((file) => {
  let text = readFileSync(path.join(REPO, file), "utf8");
  const sheet = sheets.find((s) => s.file === file);
  if (sheet) text = text.replace(/\S/g, (ch, i: number) => (/\s/.test(sheet.text[i] ?? " ") ? ch : " "));
  return { file, words: new Set(text.match(/[A-Za-z0-9_-]+/g) ?? []) };
});

/**
 * Classes the app does not write because a library does. CodeMirror builds
 * its own DOM (`.cm-editor`, `.cm-gutters`…); the stylesheet reaches it only
 * under `.stage-editor-cm`, and that scope is what the guards still check.
 */
const LIBRARY = [/^cm-/];

/** The classes a selector requires, without their dots. */
export function classesOf(selector: string): string[] {
  return (selector.match(/\.[A-Za-z_-][A-Za-z0-9_-]*/g) ?? []).map((c) => c.slice(1));
}

/**
 * A test for "does any of `from` name this class?".
 *
 * **A class built at runtime is used by its stem.** `kind-${kind}`,
 * `paper-${colour}`, `edge-bar-${side}` never appear whole; what the source
 * holds is the stem with its hyphen, and every class that starts (or ends)
 * with one is taken as a member of that family. Three characters at least,
 * so a bare `q-` cannot vouch for the whole questionnaire.
 */
export function namedBy(from: readonly Source[]): (cls: string) => boolean {
  const words = new Set(from.flatMap((s) => [...s.words]));
  const heads = [...words].filter((w) => w.length > 2 && w.endsWith("-"));
  const tails = [...words].filter((w) => w.length > 2 && w.startsWith("-"));
  return (cls) =>
    words.has(cls) ||
    LIBRARY.some((lib) => lib.test(cls)) ||
    heads.some((h) => cls.startsWith(h)) ||
    tails.some((t) => cls.endsWith(t));
}

/**
 * The web app's files a first visit loads: every file `main.tsx` reaches by
 * static `import`/`export … from`, never through `import()`. A type-only
 * import carries no code and is not followed.
 *
 * Read from the text rather than the build, so the suite does not have to
 * run Vite — and it errs the safe way: an import the bundler tree-shakes away
 * still counts here, so a file it calls eager may in fact be lazy, never the
 * reverse. On 27 Sep 2026 it named 157 files where the built entry held 146,
 * and every one of the 146 was among them.
 */
export function eagerWebFiles(): Set<string> {
  const eager = new Set<string>();
  const visit = (rel: string) => {
    if (eager.has(rel)) return;
    eager.add(rel);
    const text = readFileSync(path.join(REPO, rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      const spec = m[1]!;
      if (!spec.startsWith(".")) continue;
      const next = path.posix.join(path.posix.dirname(rel), spec);
      if (/\.(tsx?|js)$/.test(next) && existsSync(path.join(REPO, next))) visit(next);
    }
  };
  visit("packages/web/src/main.tsx");
  return eager;
}
