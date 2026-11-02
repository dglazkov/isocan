import { describe, expect, it } from "vitest";
import { SHORTCUTS, applePlatform, cmdKey, modifierClick, renderKeys, shiftKey, shortcut } from "../src/index.ts";

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

/**
 * **The table is authored in Mac glyphs and translated on the way out.**
 *
 * This is the half that only fails on somebody else's machine, which is how
 * it got to CI: a sweep converted one of the two places `⌘O` was spelled, the
 * two agreed on a Mac and disagreed on Linux, and `switcher.test.ts` — whose
 * whole subject is that the key prints the same everywhere — went red there
 * and nowhere else.
 */
describe("a shortcut from the table, written for the platform reading it", () => {
  const win = "Win32";

  it("leaves the Mac spelling alone on a Mac", () => {
    expect(renderKeys("⌘O", "MacIntel")).toBe("⌘O");
    expect(renderKeys("⇧⌘Z", "MacIntel")).toBe("⇧⌘Z");
  });

  it("writes the modifiers in the order the other platforms write them", () => {
    // Ctrl first, whatever order the glyphs were typed in.
    expect(renderKeys("⌘O", win)).toBe("Ctrl+O");
    expect(renderKeys("⇧⌘Z", win)).toBe("Ctrl+Shift+Z");
    expect(renderKeys("⌥A", win)).toBe("Alt+A");
    expect(renderKeys("⇧1", win)).toBe("Shift+1");
  });

  it("leaves a bare key bare — most of the table has no modifier at all", () => {
    expect(renderKeys("W", win)).toBe("W");
    expect(renderKeys("Esc", win)).toBe("Esc");
  });

  it("leaves no glyph untranslated anywhere in the real table", () => {
    /* The guard against a modifier nobody thought about. A glyph this does
       not know would sail through and be printed at somebody who has no such
       key — which is the whole bug, surviving the fix for it.

       `Ctrl++` is what this caught the first time: `⌘+` joined with a plus,
       where the key IS a plus. That reads as a typo and is ambiguous about
       which plus you press, so a separator key joins with a space. */
    for (const row of SHORTCUTS) {
      for (const key of row.keys) {
        const out = renderKeys(key, win);
        expect(out, `${row.does}: ${key}`).not.toBe("");
        expect(out, `${row.does}: ${key} left a glyph`).not.toMatch(/[⌘⇧⌥⌃]/);
        expect(out, `${row.does}: ${key} doubled a separator`).not.toContain("++");
      }
    }
  });

  it("writes a shortcut whose key is a separator with a space", () => {
    expect(renderKeys("⌘+", win)).toBe("Ctrl +");
    expect(renderKeys("⌘−", win)).toBe("Ctrl −");
  });

  it("knows a terminal on a Mac is still a Mac", () => {
    // `isocan shortcuts` prints into a terminal, which has no navigator at
    // all — and node calls it "darwin".
    expect(applePlatform("darwin")).toBe(true);
    expect(renderKeys("⌘O", "darwin")).toBe("⌘O");
    expect(renderKeys("⌘O", "linux")).toBe("Ctrl+O");
  });
});
