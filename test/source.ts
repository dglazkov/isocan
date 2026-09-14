/**
 * **Reading source in a test, without the regex that eats code.**
 *
 * Twenty-odd tests here read a `.ts`/`.tsx` file and assert on what is in it —
 * a hook called before an early return, a handler still wired to a key, a
 * refusal sentence that has not drifted. Every one of them has to remove the
 * prose first, or it asserts on something a comment happens to mention.
 *
 * They all did it the same way: `source.replace(/\/\*[\s\S]*?\*\//g, "")`.
 * That regex cannot tell a comment from a `/*` inside a STRING, and this
 * repository has several — a route wildcard (`` `${CANVAS_ROUTE}/*` ``), a
 * bundler pragma inside a quoted import, a stylesheet fragment built in a
 * template literal. Where one appears, the strip runs from there to the next
 * `*​/` anywhere below and deletes everything between, code included.
 *
 * It fails silently in the direction that matters. `switcher.test.ts` passed
 * for months with a swallowed region that happened to end above the line it
 * asserted on; one ordinary comment added further down moved the closer, the
 * region grew, and a case that was never about comments went red. The worse
 * direction never goes red at all: the swallowed region takes an assertion's
 * SUBJECT with it, and `toContain` starts matching something else, or a
 * `not.toMatch` passes because the thing it forbids is simply gone.
 *
 * So: **by line, never by span.** Lessons #66.
 *
 * ```ts
 * withoutComments('const a = `x/*y`; // note')  // → 'const a = `x/*y`;'
 * ```
 *
 * **What it deliberately does not do.** A block comment that opens *after*
 * real code on the same line keeps that line whole, comment text and all —
 * `foo(); /* why *​/` stays as written. Removing it would mean parsing
 * JavaScript, and the point of this helper is to never need to. The residue
 * is safe in the only way that counts: leftover prose can make an assertion
 * FAIL, loudly, where a swallowed subject makes one pass while proving
 * nothing. When a test trips over that, the fix is to assert on something
 * narrower, not to reach back for the span regex.
 *
 * **CSS is not this.** A stylesheet has no strings that can hold `/*` and no
 * `//` at all, so the span regex is correct there and the ~20 tests that
 * strip CSS keep using it. This is for source.
 */

/** True once the line opens a block comment it does not also close. */
const opensBlock = (trimmed: string): boolean =>
  (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) && !trimmed.includes("*/");

/** A whole-line comment: `//`, a JSDoc continuation, or a one-line block. */
const isProse = (trimmed: string): boolean =>
  trimmed.startsWith("//") ||
  trimmed.startsWith("*") ||
  ((trimmed.startsWith("/*") || trimmed.startsWith("{/*")) && trimmed.includes("*/"));

/**
 * The source with its comment LINES removed — block comments (including JSX's
 * `{/* … *​/}`), JSDoc continuations and `//` lines. A `/*` that is not at the
 * start of a line is left exactly where it is, because at that position it is
 * far more often a string than a comment.
 */
export function withoutComments(source: string): string {
  const kept: string[] = [];
  let inBlock = false;
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes("*/")) inBlock = false;
      continue;
    }
    if (opensBlock(trimmed)) {
      inBlock = true;
      continue;
    }
    if (isProse(trimmed)) continue;
    kept.push(line);
  }
  return kept.join("\n");
}
