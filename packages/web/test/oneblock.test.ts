import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rules, selectorsOf } from "./cssrules.ts";

/**
 * One canonical block per class.
 *
 * This is here because of a specific accident, twice. A search-and-replace
 * meant for one rule matched the same class in its SCOPED forms too, and each
 * time it left the tail behind as a bare selector:
 *
 *     .identity-known-row .face-mark { width: 22px; ... }
 *   → .identity-known-row .face.live .face-mark { ...ring... }
 *     .face-mark { width: 22px; ... }        ← now sizes every face in the app
 *
 * The worst of them dropped `.face.away`, so the dimming that means "not here"
 * was applied to everybody — a canvas full of people all rendered as absent.
 * Nothing failed. The build was clean, the tests passed, and the only symptom
 * was that a room of live faces looked ghostly.
 *
 * A bare one-class selector is the canonical block for that class, so there is
 * exactly one of it. A second one is either a scope that fell off or a section
 * pasted twice, and both are worth failing the build over — which is cheaper
 * than noticing by eye that the wrong people look absent.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/**
 * Every bare one-class selector at the TOP LEVEL of the sheet.
 *
 * Parsed by `cssrules.ts`, which can see inside at-rules — the regex here
 * before it could not, and excluded them by accident rather than on purpose
 * (`[^{}@]+?` refused any prelude containing `@`, so a media block's contents
 * were skipped along with its prelude).
 *
 * **Accident and intent land in the same place here, and the intent is worth
 * stating.** A conditional override is not a second canonical block — it is
 * what a media query IS. Eight classes in this sheet have exactly that shape:
 * `.minimap-item`, `.cursor-glow`, `.onit-dot`, `.front-row` and the rest each
 * declare themselves once at the top level and once again under
 * `prefers-reduced-motion`. Counting the second as a duplicate would fail the
 * build for doing the right thing.
 *
 * So: `at.length === 0`, said out loud, rather than inherited from a regex
 * that happened to choke on `@`.
 */
function bareClassSelectors(text: string = css): string[] {
  const found: string[] = [];
  for (const rule of rules(text)) {
    if (rule.at.length > 0) continue;
    for (const selector of selectorsOf(rule)) {
      if (/^\.[A-Za-z0-9_-]+$/.test(selector)) found.push(selector);
    }
  }
  return found;
}

describe("the stylesheet", () => {
  it("declares each class once, unscoped", () => {
    const selectors = bareClassSelectors(css);
    // The parser has to have found something. Everything below is "how many
    // times does each of these appear", and the answer for a list of nothing
    // is a clean bill of health — so a regex that stops matching turns this
    // guard off silently, which is lessons.md #8 exactly. The sibling
    // "state classes" case already asserts its own parse; this one did not.
    expect(selectors.length, "no bare class selectors found — the parser is wrong").toBeGreaterThan(
      100,
    );
    const counts = new Map<string, number>();
    for (const selector of selectors) {
      counts.set(selector, (counts.get(selector) ?? 0) + 1);
    }
    const twice = [...counts].filter(([, n]) => n > 1).map(([selector]) => selector);
    expect(twice, "a lost scope or a section pasted twice").toEqual([]);
  });

  it("dims a face only where a face is away", () => {
    // The rule that broke, named directly: absence is a claim about one person
    // and it must never be made about the room.
    for (const rule of css.matchAll(/([^{}]*\.face-mark[^{}]*)\{([^}]*)\}/g)) {
      if (/opacity|grayscale/.test(rule[2]!)) expect(rule[1]!).toContain(".away");
    }
  });
});

/**
 * The other half of the same accident, and the half the count above cannot
 * see. `.declares each class once` only fires when the class ALREADY has a
 * canonical bare block, so the leftover is a second one. Drop the scope from
 * a class that has only ever appeared scoped — 57 of them in this file — and
 * the leftover is the FIRST bare block for that class, count 1, green.
 *
 * A modifier is the case where that is never acceptable: `.away`, `.active`,
 * `.selected` are claims about a state OF something, meaningless alone, and a
 * stranded bare one would decorate anything in the app that happens to carry
 * the word. Which classes are modifiers is read off the stylesheet itself —
 * anything chained onto another class, `.face.away` — so this is an invariant
 * and not a list somebody has to remember to update.
 */
function modifierClasses(text: string): Set<string> {
  const modifiers = new Set<string>();
  for (const rule of text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|\})\s*([^{}@]+?)\{/g)) {
    for (const selector of rule[1]!.split(",")) {
      for (const compound of selector.trim().split(/[\s>+~]+/)) {
        const classes = compound.match(/\.[A-Za-z0-9_-]+/g) ?? [];
        for (const cls of classes.slice(1)) modifiers.add(cls);
      }
    }
  }
  return modifiers;
}

describe("state classes", () => {
  it("never get a rule of their own", () => {
    const modifiers = modifierClasses(css);
    expect(modifiers.size, "no chained modifiers found — the parser is wrong").toBeGreaterThan(10);
    const bare = new Set(bareClassSelectors(css));
    const stranded = [...modifiers].filter((cls) => bare.has(cls));
    expect(stranded, "a state class with an unscoped rule — a scope that fell off").toEqual([]);
  });
});

describe("the named cursor", () => {
  /**
   * `OwnCursor` shows itself exactly where the computed cursor is `none`,
   * which only works because one rule in the app turns the cursor off. A
   * second one somewhere else would be a place the chip claims as its own
   * without anybody deciding that.
   */
  it("is switched off in exactly one place", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const off = [...bare.matchAll(/([^{}]*)\{[^}]*cursor:\s*none/g)].map((m) => m[1]!.trim());
    expect(off).toEqual([".canvas-viewport.own-cursor-on"]);
  });
});
