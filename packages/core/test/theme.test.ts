import { describe, expect, it } from "vitest";
import {
  CURSORS,
  CURSOR_PROP,
  canvasCursorName,
  cursorLabel,
  cursorOf,
  cursorPatch,
  isCursor,
  noCursorPatch,
  GROUND_MAX_BYTES,
  GROUND_PROP,
  GROUND_SCRIM,
  groundIsPlace,
  groundOf,
  groundPatch,
  hasGround,
  noGroundPatch,
  THEMES,
  THEME_ANCHOR_PROP,
  anchorOf,
  anchorPatch,
  THEME_PROP,
  themeCursorName,
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
    // Every key a ground can leave: "none" is one answer to "what is this
    // canvas standing on", not one answer per kind of ground (#204 phase 2).
    expect(noThemePatch().removeProperties).toEqual([THEME_PROP, GROUND_PROP, THEME_ANCHOR_PROP]);
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
  it("gives every ground a cursor of its own", () => {
    /* Distinctness is the point and it survives the move to names: two grounds
       sharing a pointer is two grounds you cannot tell apart by pointing. The
       PATHS moved to `web/src/lib/cursorart.ts` on 9 Sep — a cursor is only
       fetched when a ground is worn — so what they look like is asserted
       there, and what a ground CHOOSES is asserted here. */
    const worn = new Set(THEMES.map((t) => themeCursorName(t)));
    expect(worn.size, "no two grounds share a cursor").toBe(THEMES.length);
    for (const theme of THEMES) {
      expect(themeCursorName(theme), `${theme} is not the plain arrow`).not.toBe("arrow");
      expect(CURSORS, `${theme} names a shape this build can draw`).toContain(themeCursorName(theme));
    }
  });

  it("leaves a canvas with no ground wearing the arrow it always had", () => {
    // The pointer people know, unchanged. A cursor that changes on a canvas
    // nobody themed would be a costume nobody asked for.
    expect(themeCursorName(null)).toBe("arrow");
  });
});

/**
 * **A ground of your own** (#204 phase 2).
 *
 * > "For the background feature… there should be a 'custom' setting where the
 * > user can set a tile and cursor and then it takes on its own?"
 *
 * The three seeded grounds are generated: they cost nothing, tile forever by
 * construction, and are dark on purpose so white cards read on them. A picture
 * somebody supplies is none of those, and the rules below are what make it
 * safe anyway.
 */
describe("a picture somebody supplied", () => {
  const wearing = (properties: Record<string, string>) => ({ properties });
  const hash = "a".repeat(64);

  it("is read by its shape, so nothing has to register the key", () => {
    /* `blobsInProperties` retains a blob named by ANY property whose value is
       a 64-character hex string, so this key needs no registration anywhere —
       and the parse insists on the same shape for the same reason. A property
       hand-edited to a filename should show the ground it always showed, not
       a broken picture. */
    expect(groundOf(wearing({ [GROUND_PROP]: hash }))).toBe(hash);
    expect(groundOf(wearing({ [GROUND_PROP]: "sunset.jpg" }))).toBeNull();
    expect(groundOf(wearing({ [GROUND_PROP]: hash.toUpperCase() }))).toBeNull();
    expect(groundOf(wearing({}))).toBeNull();
  });

  it("is a canvas's ONE ground: each patch drops the other", () => {
    // A canvas that is a galaxy AND a photograph is not a feature, it is a
    // bug somebody has to explain — the same argument `THEME_PROP` makes
    // about being one property rather than two.
    expect(groundPatch(hash).removeProperties).toContain(THEME_PROP);
    expect(themePatch("galaxy").removeProperties).toContain(GROUND_PROP);
    expect(noThemePatch().removeProperties).toEqual(
      expect.arrayContaining([THEME_PROP, GROUND_PROP, THEME_ANCHOR_PROP]),
    );
  });

  it("writes no anchor — the pinning is in how it is drawn", () => {
    /**
     * The bug this replaced, caught by running the two commands in a row and
     * reading the properties back: `groundPatch` wrote `themeAnchor: window`
     * beside the hash, so setting a picture and then choosing Space Galaxy
     * left the GALAXY pinned — by a choice nobody made, that nothing said, and
     * that could only be undone by unticking something you never ticked.
     *
     * An implicit choice written down as an explicit one outlives the thing
     * that implied it.
     */
    expect(groundPatch(hash).properties).toEqual({ [GROUND_PROP]: hash });
    expect(Object.keys(groundPatch(hash).properties ?? {})).not.toContain(THEME_ANCHOR_PROP);
    // And a deliberate pin survives a change of seeded ground, which is the
    // other half: only the IMPLICIT one is refused a home.
    expect(themePatch("ocean").removeProperties).not.toContain(THEME_ANCHOR_PROP);
  });

  it("is never a place, whatever an anchor says", () => {
    /* A picture is drawn once and `cover`, so it does not pan — calling it a
       place would be a lie the dot grid pays for. A seeded ground answers with
       its anchor, as it always has. */
    expect(groundIsPlace(wearing({ [GROUND_PROP]: hash }))).toBe(false);
    expect(groundIsPlace(wearing({ [GROUND_PROP]: hash, [THEME_ANCHOR_PROP]: "world" }))).toBe(false);
    expect(groundIsPlace(wearing({ [THEME_PROP]: "galaxy" }))).toBe(true);
    expect(groundIsPlace(wearing({ [THEME_PROP]: "galaxy", [THEME_ANCHOR_PROP]: "window" }))).toBe(false);
    expect(groundIsPlace(wearing({}))).toBe(false);
  });

  it("answers `hasGround` for either kind", () => {
    /* The one question the viewport asks before downloading a chunk to draw a
       ground. Asked as a disjunction at the call site, it grows a third arm in
       whichever file somebody remembers — and it nearly shipped gated on
       `themeOf` alone, which would have drawn nothing at all for a picture. */
    expect(hasGround(wearing({ [GROUND_PROP]: hash }))).toBe(true);
    expect(hasGround(wearing({ [THEME_PROP]: "ocean" }))).toBe(true);
    expect(hasGround(wearing({}))).toBe(false);
  });

  it("comes off leaving nothing behind", () => {
    expect(noGroundPatch()).toEqual({ removeProperties: [GROUND_PROP] });
  });

  it("keeps a scrim past the contrast floor, and a stated weight", () => {
    /**
     * The floor is 3:1 for a white card against the worst case, a pure white
     * image: `1.05 / (L + 0.05) >= 3` with `L` the sRGB-transfer luminance of
     * `1 - a`, which solves to `a >= 0.42`. This asserts the derivation rather
     * than the constant, so somebody lowering the scrim has to break the
     * reason and not just the number.
     */
    const luminance = (v: number) => ((v + 0.055) / 1.055) ** 2.4;
    const worstCard = 1.05 / (luminance(1 - GROUND_SCRIM) + 0.05);
    expect(worstCard).toBeGreaterThanOrEqual(3);
    // And past the floor on purpose: a floor is not a design, and at 0.42 a
    // busy photograph still competes with the work standing on it.
    expect(worstCard).toBeGreaterThan(6);
    // A number, because the cost is real: everybody on the canvas downloads
    // this on every cold load, forever.
    expect(GROUND_MAX_BYTES).toBeGreaterThan(0);
  });
});

/**
 * **A cursor you choose, when the ground is a picture** (#204 phase 3).
 *
 * The other half of *"the user can set a tile and cursor"*. The tile shipped
 * on 7 Sep and a canvas standing on somebody's photograph still got the plain
 * arrow, because `themeCursor` derives the pointer from the THEME and a
 * picture has no theme name to derive from.
 */
describe("the pointer a canvas wears", () => {
  const wearing = (properties: Record<string, string>) => ({ properties });
  const hash = "a".repeat(64);

  it("lets a seeded ground name its own cursor, and refuses to be overruled", () => {
    /**
     * `THEME_PROP`'s invariant, enforced here rather than hoped for: a theme
     * names the ground AND the cursor because "galaxy" is the fact, and two
     * properties would let a canvas be a farm with rockets. So a `cursor`
     * property set beside a seeded theme changes nothing.
     */
    const galaxy = wearing({ [THEME_PROP]: "galaxy", [CURSOR_PROP]: "fish" });
    expect(canvasCursorName(galaxy)).toBe(themeCursorName("galaxy"));
    expect(canvasCursorName(galaxy)).not.toBe("fish");
  });

  it("reads the chosen one where the ground is a picture, which names nothing", () => {
    const own = wearing({ [GROUND_PROP]: hash, [CURSOR_PROP]: "crescent" });
    expect(canvasCursorName(own)).toBe("crescent");
  });

  it("is the plain arrow when nothing has been chosen", () => {
    expect(canvasCursorName(wearing({ [GROUND_PROP]: hash }))).toBe("arrow");
    expect(canvasCursorName(wearing({}))).toBe("arrow");
  });

  it("refuses a name nothing can draw", () => {
    /**
     * `THEMES`' reason: a canvas wearing a name this build cannot draw would
     * be a pointer that vanishes.
     *
     * **This case used "sheep" as its impossible name until 9 Sep 2026**, when
     * the sheep was drawn and the fixture became real. Worth a sentence rather
     * than a silent swap: a negative test whose example can quietly turn
     * positive is a test that stops asserting anything, and the only reason it
     * failed loudly here is that `isCursor` is a parse over a closed list.
     */
    expect(cursorOf(wearing({ [CURSOR_PROP]: "tractor" }))).toBeNull();
    expect(isCursor("tractor")).toBe(false);
    expect(canvasCursorName(wearing({ [GROUND_PROP]: hash, [CURSOR_PROP]: "tractor" }))).toBe("arrow");
  });

  it("stores a choice and removes it again", () => {
    expect(cursorPatch("drop").properties).toEqual({ [CURSOR_PROP]: "drop" });
    expect(noCursorPatch()).toEqual({ removeProperties: [CURSOR_PROP] });
  });

  it("names every shape it offers, in words a picker can show", () => {
    /* The paths moved to the surface that draws them; what stays here is that
       every name in the library is a name and not an id. `cursorart.test.ts`
       holds the silhouettes. */
    for (const c of CURSORS) expect(cursorLabel(c)).toMatch(/^[A-Z]/);
    expect(new Set(CURSORS.map(cursorLabel)).size, "no two cursors share a word").toBe(CURSORS.length);
  });
});
