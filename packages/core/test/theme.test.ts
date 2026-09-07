import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_ANCHOR_PROP,
  anchorOf,
  anchorPatch,
  THEME_PROP,
  themeLabel,
  isTheme,
  noThemePatch,
  themeOf,
  themePatch,
} from "../src/theme.ts";

/**
 * **A canvas wears one ground, and an unknown one is no ground** (#195).
 *
 * The behaviour worth holding is what happens at the edges, because the
 * middle is a property lookup. A canvas with nothing set is the dot grid,
 * which is what every canvas is today — so there is no migration. And a
 * canvas written by a NEWER build, naming a ground this one cannot draw,
 * shows the dot grid rather than a blank rectangle: forward compatibility for
 * a value the picker will keep growing.
 */
describe("what ground a canvas stands on", () => {
  it("is nothing at all until somebody chooses one", () => {
    expect(themeOf({ properties: {} })).toBeNull();
    expect(themeOf({})).toBeNull();
  });

  it("reads an unknown ground as none, not as itself", () => {
    // A newer build's theme, seen by this one. The canvas keeps the grid it
    // has always had; the alternative is a class nothing styles, which is a
    // blank screen with no way to explain itself.
    expect(themeOf({ properties: { [THEME_PROP]: "volcano" } })).toBeNull();
    expect(isTheme("volcano")).toBe(false);
  });

  it("puts one on and takes it off, leaving nothing behind", () => {
    expect(themePatch("galaxy").properties?.[THEME_PROP]).toBe("galaxy");
    // A removal rather than a "none" value: a canvas with no theme must be
    // byte-for-byte a canvas that never had one.
    expect(noThemePatch().removeProperties).toEqual([THEME_PROP]);
    expect(noThemePatch().properties).toBeUndefined();
  });


  it("names every ground for a person, not just for a program", () => {
    /* The ids are the interface — `isocan canvas background galaxy` takes one
       — but a menu that says "galaxy" is a menu showing you its variable. The
       labels live beside the ids so a second surface cannot invent a second
       word for the same ground. */
    for (const theme of THEMES) {
      const label = themeLabel(theme);
      expect(label, `${theme} needs a name`).toBeTruthy();
      expect(label[0], `${theme}'s name is written for a reader`).toBe(label[0]!.toUpperCase());
    }
    expect(themeLabel("galaxy")).toBe("Space Galaxy");
  });

  it("keeps galaxy first, because it is the one that needs no artist", () => {
    // A generated starfield tiles infinitely by construction and costs no
    // download — which is why it is the theme that proves the layer while the
    // painted ones are still being drawn.
    expect(THEMES[0]).toBe("galaxy");
  });
});

/**
 * **A ground is either a place or a backdrop**, and the difference is what you
 * can do with it: a field that travels stays under whatever is standing in it,
 * so a pen is somewhere you can come back to; a sky that stays put is
 * atmosphere you move across.
 */
describe("how a ground behaves", () => {
  it("travels with the canvas unless told otherwise", () => {
    // Every canvas already wearing a ground keeps behaving as it did.
    expect(anchorOf({ properties: {} })).toBe("world");
    expect(anchorOf({})).toBe("world");
  });

  it("can be pinned to the window", () => {
    expect(anchorOf({ properties: { [THEME_ANCHOR_PROP]: "window" } })).toBe("window");
  });

  it("reads anything it does not know as travelling", () => {
    expect(anchorOf({ properties: { [THEME_ANCHOR_PROP]: "sideways" } })).toBe("world");
  });

  it("stores only the unusual one, so the common case leaves nothing behind", () => {
    expect(anchorPatch("window").properties?.[THEME_ANCHOR_PROP]).toBe("window");
    expect(anchorPatch("world").removeProperties).toEqual([THEME_ANCHOR_PROP]);
    expect(anchorPatch("world").properties).toBeUndefined();
  });
});
