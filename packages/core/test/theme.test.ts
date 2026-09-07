import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_ANCHOR_PROP,
  anchorOf,
  anchorPatch,
  THEME_PROP,
  themeCursor,
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

describe("the cursor a ground gives everybody", () => {
  /**
   * The half of #195 its own title names — *"and a cursor that belongs to
   * it"* — and the half that shipped without being built. Dion found it:
   * "the cursors also haven't changed? Eg for space galaxy they didn't change
   * to a rocket."
   */
  it("gives every ground a shape of its own", () => {
    const shapes = new Set(THEMES.map((t) => themeCursor(t)));
    expect(shapes.size, "no two grounds share a cursor").toBe(THEMES.length);
    for (const theme of THEMES) {
      expect(themeCursor(theme), `${theme} has a path`).toMatch(/^M[\d.]/);
      expect(themeCursor(theme), `${theme} is not the plain arrow`).not.toBe(themeCursor(null));
    }
  });

  it("leaves a canvas with no ground wearing the arrow it always had", () => {
    // The shape people know, unchanged. A cursor that changes on a canvas
    // nobody themed would be a costume nobody asked for.
    expect(themeCursor(null)).toBe("M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z");
  });

  it("starts every cursor at the hotspot, so the thing still points", () => {
    /* A cursor's tip is where the click lands. A shape whose mass sits below
       and right of (1.5, 0.5) is a decoration you have to aim; every path
       here begins there for that reason — including the sparkle, whose long
       upper-left ray is a pointer before it is a star. */
    for (const theme of [...THEMES, null]) {
      expect(themeCursor(theme).startsWith("M1.5 0.5"), `${theme} points`).toBe(true);
    }
  });

  it("carries no colour of its own", () => {
    /* The constraint the issue is emphatic about: seven IDENTITY_COLORS also
       land on items during remote selection, so a cursor that brought its own
       colour would delete the one signal saying who is who. "A sheep tinted
       with your colour is delightful; a sheep that makes six people identical
       is a regression dressed as a feature." */
    for (const theme of [...THEMES, null]) {
      expect(themeCursor(theme)).not.toMatch(/#|rgb|fill|hsl/);
    }
  });
});
