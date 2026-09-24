import { afterEach, describe, expect, it } from "vitest";
import { markShortcuts, registerModule, shortcutsAsText, unregisterModule } from "../src/index.ts";

/**
 * **A module's mark key is a listed key** (24 Sep 2026): the wireframes' ⇧K
 * was in the app's help panel and missing from `isocan shortcuts`, because
 * the panel read the loaded modules' marks and the text list did not. Both
 * now read `markShortcuts`. Synthetic: an Acme module with a star mark.
 */

const ACME = "@acme/stars";

afterEach(() => unregisterModule(ACME));

describe("markShortcuts", () => {
  it("lists a loaded module's mark key, in the words the help panel uses, and nothing when none is loaded", () => {
    expect(markShortcuts().some((s) => s.keys.includes("⇧J"))).toBe(false);
    registerModule({ name: ACME, marks: [{ property: "acmeStar", emoji: "★", title: "Starred", on: "Star", off: "Unstar", key: "J" }] });
    expect(markShortcuts()).toContainEqual({ keys: ["⇧J"], does: "★ Star or unstar the selection", group: "Items", note: "A property on the item, so anybody can take it off" });
    expect(shortcutsAsText()).toMatch(/Items\n[\s\S]*⇧J\s+★ Star or unstar the selection/);
  });

  it("leaves out a mark with no key", () => {
    registerModule({ name: ACME, marks: [{ property: "acmeStar", emoji: "★", title: "Starred", on: "Star", off: "Unstar" }] });
    expect(markShortcuts().some((s) => s.does.startsWith("★"))).toBe(false);
  });
});
