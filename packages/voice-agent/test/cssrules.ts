import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * One reader for THIS package's stylesheet, and a copy of the app's parser.
 *
 * The copy is deliberate rather than lazy. `packages/web/test/cssrules.ts`
 * binds its `css` to the APP's sheet and its ten callers are the app's design
 * guards; teaching it to read this package's sheet would mean passing a path
 * through guards that do not want one, and importing across packages out of
 * another package's `test/` directory is the coupling this package exists to
 * remove. The parser below is the app's, kept in step deliberately: it is the
 * difference between a check that sees nine media-block rules and one that
 * sees a pseudo-rule.
 *
 * One reader for a stylesheet, for the guards that were each parsing it
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

// `import.meta.dirname`, and not `new URL(…, import.meta.url)`: Vite rewrites
// the URL form into a dev-server URL under this package's jsdom tests, and
// `readFileSync` then refuses it with "The URL must be of scheme file" — a
// failure that shows in one test file and not the next. See `page.ts`.
export const css = readFileSync(path.join(import.meta.dirname, "..", "src", "voice.css"), "utf8");

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
