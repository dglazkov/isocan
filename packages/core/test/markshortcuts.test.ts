import { afterEach, describe, expect, it } from "vitest";
import { markShortcuts, registerModule, shortcutsAsText, unregisterModule } from "../src/index.ts";
import { renderKeys } from "../src/shortcut.ts";

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
    expect(markShortcuts()).toContainEqual({ keys: ["⇧J"], does: "★ Star, or unstar — on the selection", group: "Items", note: "A property on the item, so anybody can take it off" });
    // The text list spells keys for the platform it runs on: ⇧J on a Mac,
    // Shift+J on the Linux runner (lessons #89). Red on CI four runs in a row
    // while green on every Mac that ran it.
    const key = renderKeys("⇧J").replace(/[+]/g, "\\+");
    expect(shortcutsAsText()).toMatch(new RegExp(`Items\\n[\\s\\S]*${key}\\s+★ Star, or unstar — on the selection`));
  });

  it("leaves out a mark with no key", () => {
    registerModule({ name: ACME, marks: [{ property: "acmeStar", emoji: "★", title: "Starred", on: "Star", off: "Unstar" }] });
    expect(markShortcuts().some((s) => s.does.startsWith("★"))).toBe(false);
  });
});
