import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS, SHORTCUT_GROUPS, shortcutsAsText, shortcutsIn } from "@isocan/core";

/**
 * The help panel is only worth opening if it is true.
 *
 * A documented key that no handler implements is worse than an undocumented
 * one: it sends somebody pressing a key that does nothing and wondering what
 * they broke. So the letter keys the list promises are checked against the
 * code that would have to answer them. This cannot prove the DESCRIPTION is
 * right — only a person can — but it catches the failure that actually
 * happens: a shortcut is moved or dropped and the list is not.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const handlers = read("../src/pages/CanvasPage.tsx") + read("../src/components/CanvasViewport.tsx");

describe("every documented key exists", () => {
  const letters = SHORTCUTS.flatMap((s) => s.keys).filter((key) => /^[A-Z]$/.test(key));

  it("names some letter keys at all (the test would pass vacuously otherwise)", () => {
    expect(letters.length).toBeGreaterThanOrEqual(5);
  });

  it.each(letters)("something answers %s", (key) => {
    // Either the key-name form (e.key === "v") or the code form (KeyV).
    const byKey = new RegExp(`=== "${key.toLowerCase()}"`).test(handlers);
    const byCode = handlers.includes(`Key${key}`);
    expect(byKey || byCode, `no handler found for ${key}`).toBe(true);
  });

  it("documents F2, Escape, Delete and the fan-out key the badge promises", () => {
    for (const key of ["F2", "Escape", "Delete"]) {
      expect(handlers, key).toContain(`"${key}"`);
    }
    expect(SHORTCUTS.some((s) => s.keys.includes("F"))).toBe(true);
  });

  it("documents ? itself, which is how anyone finds the rest", () => {
    expect(SHORTCUTS.some((s) => s.keys.includes("?"))).toBe(true);
    expect(handlers).toContain('e.key === "?"');
  });
});

describe("the list is readable", () => {
  it("puts every shortcut in a group the panel renders", () => {
    for (const shortcut of SHORTCUTS) {
      expect(SHORTCUT_GROUPS, shortcut.does).toContain(shortcut.group);
    }
  });

  it("leaves no group empty", () => {
    for (const group of SHORTCUT_GROUPS) expect(shortcutsIn(group).length, group).toBeGreaterThan(0);
  });

  it("says what each one does, in the imperative", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.length, shortcut.does).toBeGreaterThan(0);
      expect(shortcut.does.length).toBeGreaterThan(3);
      // "Opens the…" describes the app; "Open the…" tells you what you get.
      // A pattern-match on trailing "s" is not this rule — "Address someone"
      // and "This list" are both fine — so the check names the forms instead.
      for (const narration of ["Opens", "Shows", "Toggles", "Lets you", "Allows", "Displays"]) {
        expect(shortcut.does.startsWith(`${narration} `), shortcut.does).toBe(false);
      }
    }
  });

  it("renders as text for a terminal or a comment", () => {
    const text = shortcutsAsText();
    for (const group of SHORTCUT_GROUPS) expect(text).toContain(group);
    expect(text).toContain("⌘K");
  });
});
