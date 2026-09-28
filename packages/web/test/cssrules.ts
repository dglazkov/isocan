import { type Dirent, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One reader for the stylesheet, for the ten guards that were each parsing it
 * themselves.
 *
 * Ten files read `styles.css`; eight of them opened with the identical line
 * (`const bare = css.replace(/\/\*[\s\S]*?\*\//g, "")`) and then wrote their
 * own rule splitter. That is what a stylesheet guarded by several authors in
 * one day looks like, and it cost something real rather than being untidy:
 *
 * **Not one of the ten handled `@media`.** The shared shape,
 * `/([^{}]+)\{([^}]*)\}/g`, cannot nest — and `[^}]*` happily eats a `{` — so
 * for every one of the nine media blocks in this sheet the prelude and the
 * FIRST rule inside it were folded into a single pseudo-rule whose selector is
 * the literal text `@media (prefers-reduced-motion: reduce)`. Nine rules
 * invisible to every check that works per-selector, including
 * `.item.entered`, `.minimap-item`, `.cursor-glow` and `.front-row`.
 *
 * It was not theoretical. `scale.test.ts` partitions the sheet into the app's
 * scale and the front page's by selector; `.front-row` lives inside
 * `@media (max-width: 720px)`, so its selector read as `@media …`, and a
 * front-page-only spacing step failed the APP's count — telling whoever added
 * it to reuse a step from the wrong scale.
 *
 * So: one parser, media-aware, in one place. A guard that wants something
 * narrower can filter what comes out; a guard that writes its own regex is
 * back to ten answers to one question.
 */

export const css = readFileSync(
  fileURLToPath(new URL("../src/styles.css", import.meta.url)),
  "utf8",
);

/** One stylesheet the app page can load, by repo-relative path. */
export interface Sheet {
  /** e.g. `packages/web/src/components/phone.css` — what a failure names. */
  file: string;
  text: string;
}

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

function cssUnder(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(path.join(REPO, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return cssUnder(rel);
    return e.name.endsWith(".css") ? [rel] : [];
  });
}

/**
 * Every stylesheet the app page loads, `styles.css` first.
 *
 * **BC-6/BC-4, 27 Sep 2026.** Every guard read `styles.css` and nothing else,
 * so the twenty sheets split out beside their components — and the modules'
 * — were checked by nobody: `phone.css` covered the whole screen in
 * `var(--page)`, `yourbench.css` and the talk module asked for `var(--muted)`
 * ten times, two design panels for `--radius-lg`. None is defined anywhere,
 * so each declaration was silently dropped (see `tokens.test.ts`). The list
 * is found on disk rather than written down, so a new sheet is read the day
 * it is added: `components/**.css`, every module's `src/` and `assets/`
 * sheets, and a module component that carries its own `<style>{…}` string
 * (the talk module) as the whole file, because that is where its CSS is.
 */
export const sheets: Sheet[] = (() => {
  const files = [
    "packages/web/src/styles.css",
    ...cssUnder("packages/web/src/components").sort(),
  ];
  const modules = readdirSync(path.join(REPO, "packages/modules"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const m of modules) {
    files.push(...cssUnder(`packages/modules/${m}/src`).sort());
    files.push(...cssUnder(`packages/modules/${m}/assets`).sort());
    const src = path.join(REPO, `packages/modules/${m}/src`);
    let names: string[] = [];
    try {
      names = readdirSync(src);
    } catch {
      continue;
    }
    for (const n of names.filter((n) => n.endsWith(".tsx")).sort()) {
      const text = readFileSync(path.join(src, n), "utf8");
      if (/<style>\{/.test(text)) files.push(`packages/modules/${m}/src/${n}`);
    }
  }
  return files.map((file) => {
    const text = readFileSync(path.join(REPO, file), "utf8");
    return { file, text: file.endsWith(".tsx") ? templateCss(text) : text };
  });
})();

/**
 * A component's CSS strings, everything else blanked to spaces with the
 * newlines kept, so a line number in a failure is the line in the `.tsx`.
 * Only template literals that hold a rule (`selector { … }`) are kept, and
 * their `${…}` interpolations are blanked too — the braces of a `${METER_CSS}`
 * are JavaScript, not a block, and every parser here counts braces.
 */
function templateCss(source: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let out = "";
  let last = 0;
  for (const m of source.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    const body = m[1]!;
    const start = m.index!;
    out += blank(source.slice(last, start + 1));
    out += /[^{}]\{[^{}]*:[^{}]*\}/.test(body.replace(/\$\{[^}]*\}/g, "")) ? body.replace(/\$\{[^}]*\}/g, blank) : blank(body);
    out += " ";
    last = start + m[0].length;
  }
  return out + blank(source.slice(last));
}

/**
 * **The CSS a page has once these components have loaded**: `styles.css`,
 * then each named sheet from `components/`, in the order the page gets them.
 *
 * Cleanup phase 6, 27 Sep 2026: a dozen sections moved out of `styles.css`
 * into sheets that ship with their lazy component, and the guards that read
 * those rules read `styles.css` alone. They read this instead — the eager
 * sheet still first, so a guard about which rule wins still reads the cascade
 * the page has. A name that matches no sheet throws, so a renamed sheet fails
 * the guard loudly rather than leaving it reading nothing.
 */
export function loadedWith(...names: string[]): string {
  return [
    css,
    ...names.map((name) => {
      const sheet = sheets.find((s) => s.file === `packages/web/src/components/${name}`);
      if (!sheet) throw new Error(`no sheet packages/web/src/components/${name}`);
      return sheet.text;
    }),
  ].join("\n");
}

/** The web app's own sheets — `styles.css` and the ones beside its components —
 * for a guard about the app's design system rather than any CSS at all. A
 * module brings its own look; the tokens it borrows are held by the guard
 * that reads `sheets`. */
export const appSheets: Sheet[] = sheets.filter((s) => s.file.startsWith("packages/web/"));

export interface Rule {
  /** The selector list as written, whitespace collapsed. */
  selector: string;
  /** The declarations between its braces. */
  body: string;
  /** The `@media`/`@supports` preludes it sits inside, outermost first —
   * empty for a rule at the top level. A guard that must know whether a rule
   * is conditional asks this instead of finding `@media` in its selector. */
  at: string[];
}

/** The sheet with comments blanked, newlines preserved so a line number in a
 * failure still points at the real line. Comments discuss measurements at
 * length; they do not set them. */
export function withoutComments(text: string = css): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Every rule in the sheet, including the ones inside at-rules.
 *
 * A brace-counting walk rather than a regex, because the thing that has to be
 * got right — a block inside a block — is the thing a regex cannot express.
 * `@keyframes` percentages come out as ordinary rules nested under the
 * keyframes prelude, which is what they are.
 */
export function rules(text: string = css): Rule[] {
  const src = withoutComments(text);
  const out: Rule[] = [];
  const stack: string[] = [];
  let head = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      const prelude = head.trim().replace(/\s+/g, " ");
      head = "";
      // An at-rule opens a scope; anything else opens a rule whose body runs
      // to its matching brace.
      if (prelude.startsWith("@") && !prelude.startsWith("@font-face")) {
        stack.push(prelude);
        continue;
      }
      let depth = 1;
      let j = i + 1;
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
      }
      out.push({ selector: prelude, body: src.slice(i + 1, j - 1), at: [...stack] });
      i = j - 1;
    } else if (ch === "}") {
      stack.pop();
      head = "";
    } else {
      head += ch;
    }
  }
  return out;
}

/** Every selector in a rule's list, e.g. `.a, .b` → ["a", "b"] as written. */
export function selectorsOf(rule: Rule): string[] {
  return rule.selector.split(",").map((one) => one.trim()).filter(Boolean);
}
