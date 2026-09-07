import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../src", import.meta.url));

/**
 * **A hook that returns a fresh array or object every call is a loaded gun.**
 *
 * The worst bug this app has shipped, and it took two commits by two people
 * to make, neither of them wrong on its own:
 *
 * - **5 Sep**, modules phase 4: `useCommands` ended with
 *   `return withModuleCommands(...)` — a NEW array on every call. Harmless
 *   that day, because nothing cared about its identity.
 * - **6 Sep**, extensions stages 1–2: `useCanvasTools` put that value in an
 *   effect's dependency list, and the effect ends in `setTools(read)`.
 *
 * Render makes a new array → the deps look changed → the effect runs →
 * `setTools` with a new array → render. Forever, on every open canvas, from
 * the moment the page loaded. A canvas sitting untouched measured **68% idle**
 * and every isocan tab in the Task Manager sat at 76–117% CPU. Clicking the
 * canvas switcher mounted a second consumer into the looping tree, which made
 * each turn heavy enough to starve input and raise *Page Unresponsive*.
 *
 * ## Why nothing caught it
 *
 * `react-hooks/exhaustive-deps` is already enforced here (`lint.test.ts`) and
 * had nothing to say: the dependency WAS listed. The rule checks that deps are
 * complete, never that they are stable, and no warning fires at the seam
 * between a hook that returns fresh values and an effect that depends on one.
 * The two halves also lived in different files written a day apart, so no
 * reviewer saw both.
 *
 * So the guard is on the FIRST half, where the cost is one `useMemo` and the
 * rule is simple enough to state: **a hook that returns a non-primitive
 * returns the same one until its inputs change.** That holds whether or not
 * anybody has yet written the effect that would make it fatal — which is the
 * point, because the effect arrives a day later in another file.
 *
 * The other half is a measurement rather than a test, and `docs/reviews/
 * lessons.md` #37 records it: a CPU profile of a canvas at rest. A page doing
 * nothing should be doing nothing, and *idle* is the number — 68% before this
 * was fixed, 100% after. That catches any loop, including whatever shape this
 * file cannot see.
 */

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The `return` that ends an exported hook, with the hook's name.
 *
 * Deliberately simple: the last top-level `return` in the function body, found
 * by indentation, because every hook here is written that way and a real
 * parser for one rule is a second thing to keep right.
 */
function hookReturns(text: string): { name: string; line: number; code: string }[] {
  const lines = text.split("\n");
  const found: { name: string; line: number; code: string }[] = [];
  let name: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const declares = /^export function (use[A-Za-z0-9_]*)/.exec(lines[i]!);
    if (declares) {
      name = declares[1]!;
      continue;
    }
    if (name === null) continue;
    if (/^}/.test(lines[i]!)) {
      name = null;
      continue;
    }
    // A return at the function's own indentation, not one nested in a branch.
    if (/^  return /.test(lines[i]!)) {
      found.push({ name, line: i + 1, code: lines[i]!.trim() });
    }
  }
  return found;
}

/**
 * Returns that are stable by construction: a primitive, a value that came out
 * of a memo or a store field, or a call whose result the caller cannot hold
 * onto in a dependency array anyway.
 */
const STABLE =
  /^return (useMemo|useCallback|useSyncExternalStore|useState|useRef|Boolean|Number|String|null|true|false|undefined|[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z0-9_$]+)*\s*;)/;

/** A comparison or a membership test yields a boolean, which has no identity
 *  to be unstable — `useOnWall` reads as a call only because it ends in one. */
const BOOLEANISH = /(===|!==|&&|\|\||[^=<>!]>=?[^=]|[^=<>!]<=?[^=]|\.(has|includes|some|every|startsWith|endsWith)\()/;

/**
 * Hooks whose fresh return is known and accepted, each with the reason.
 *
 * An entry here is a promise that nobody puts the value in a dependency array,
 * which is exactly the promise that failed in September — so the list is meant
 * to stay short, and the fix is almost always `useMemo` rather than a line
 * here.
 */
const ALLOWED = new Map<string, string>([
  // Zustand selectors: the store compares with Object.is and re-renders only
  // when the selected value actually changes, so the identity a caller sees is
  // the store's, not a fresh one built per render.
  ["useActorColor", "zustand selector — the store owns the identity"],
  ["useActorColors", "zustand selector — returns a store field"],
  ["useActorNames", "zustand selector — returns a store field"],
  ["useCanEdit", "zustand selector — boolean"],
  ["useChromeHidden", "zustand selector — boolean"],
  ["useHasReactions", "zustand selector — boolean"],
  ["useAnswerable", "a Set held in module state, not rebuilt per render"],
  ["useRcParked", "boolean off the same module state"],
  ["useAnsweredAt", "a number — when the poll last answered; no identity to be unstable"],
  ["useVotesHiddenOn", "boolean"],
  ["useContentOrigin", "a string"],
  // A ref holds the built frame across renders on purpose: rebuilding the src
  // would remount the iframe and lose the page inside it, so the identity is
  // already the point of the hook rather than an oversight (`lib/frame.ts`).
  ["useFrameSrc", "a ref holds the frame across renders — that IS the mechanism"],
]);

describe("a hook returns the same value until its inputs change", () => {
  it("has no unmemoised object or array escaping an exported hook", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(src)) {
      for (const found of hookReturns(readFileSync(file, "utf8"))) {
        if (STABLE.test(found.code) || BOOLEANISH.test(found.code)) continue;
        if (ALLOWED.has(found.name)) continue;
        offenders.push(`${path.relative(src, file)}:${found.line} ${found.name} — ${found.code}`);
      }
    }
    expect(
      offenders,
      "Each of these returns a fresh value every render. That is harmless until\n" +
        "somebody puts it in a dependency array — and then it is an infinite\n" +
        "render loop that no lint rule reports, in a file the author never opened.\n" +
        "Wrap it in useMemo, or add it to ALLOWED with the reason it is stable.",
    ).toEqual([]);
  });

  it("keeps the allowances honest", () => {
    // An entry that no longer matches anything is a claim about code that has
    // moved on, and the next person reads it as still true.
    const names = new Set<string>();
    for (const file of tsFiles(src)) {
      for (const found of hookReturns(readFileSync(file, "utf8"))) names.add(found.name);
    }
    const stale = [...ALLOWED.keys()].filter((name) => !names.has(name));
    expect(stale, "these hooks no longer exist or no longer return a bare value").toEqual([]);
  });
});
