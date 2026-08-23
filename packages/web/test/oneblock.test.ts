import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

/** Selectors, with comments removed so a commented-out rule is not a rule. */
function bareClassSelectors(text: string): string[] {
  const found: string[] = [];
  for (const rule of text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|\})\s*([^{}@]+?)\{/g)) {
    for (const selector of rule[1]!.split(",")) {
      const trimmed = selector.trim();
      if (/^\.[A-Za-z0-9_-]+$/.test(trimmed)) found.push(trimmed);
    }
  }
  return found;
}

describe("the stylesheet", () => {
  it("declares each class once, unscoped", () => {
    const counts = new Map<string, number>();
    for (const selector of bareClassSelectors(css)) {
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
