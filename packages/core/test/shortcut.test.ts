import { describe, expect, it } from "vitest";
import { applePlatform, cmdKey, modifierClick, shiftKey, shortcut } from "../src/index.ts";

/**
 * **The label, not the key.** The handlers accept `metaKey || ctrlKey` and
 * always did; what was wrong was seventy-odd strings spelling `⌘` at people
 * who do not have one.
 */
describe("the modifier key, named for the person reading it", () => {
  const mac = "MacIntel";
  const win = "Win32";

  it("says ⌘ on an Apple keyboard and Ctrl everywhere else", () => {
    expect(cmdKey(mac)).toBe("⌘");
    expect(cmdKey(win)).toBe("Ctrl");
    expect(cmdKey("Linux x86_64")).toBe("Ctrl");
    expect(shiftKey(mac)).toBe("⇧");
    expect(shiftKey(win)).toBe("Shift");
  });

  it("knows an iPhone and an iPad are Apple keyboards too", () => {
    for (const hint of ["iPhone", "iPad", "MacIntel", "macOS"]) {
      expect(applePlatform(hint), hint).toBe(true);
    }
  });

  it("joins the way each platform joins, which is not the same shape", () => {
    // A Mac runs the glyphs together; Windows joins with `+`. Translating
    // only the word would give `Ctrl+⇧Z`, which is neither convention.
    expect(shortcut("Z", { hint: mac })).toBe("⌘Z");
    expect(shortcut("Z", { hint: win })).toBe("Ctrl+Z");
    expect(shortcut("Z", { shift: true, hint: mac })).toBe("⇧⌘Z");
    expect(shortcut("Z", { shift: true, hint: win })).toBe("Ctrl+Shift+Z");
  });

  it("spells out the keys a Mac draws as a glyph", () => {
    // `⏎` is a symbol people read on a Mac and a mystery on a keyboard whose
    // key says Enter.
    expect(shortcut("⏎", { hint: mac })).toBe("⌘⏎");
    expect(shortcut("⏎", { hint: win })).toBe("Ctrl+Enter");
    expect(shortcut("⌫", { hint: win })).toBe("Ctrl+Backspace");
  });

  it("says Ctrl when it cannot see a platform, rather than claiming a Mac", () => {
    // Rendered on a server or in a test there is no navigator. A label that
    // guesses wrong is worse than the commoner one.
    expect(cmdKey("")).toBe("Ctrl");
    expect(modifierClick("")).toBe("Ctrl-click");
    expect(modifierClick(mac)).toBe("⌘-click");
  });
});
