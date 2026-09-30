import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { CONTRAST_BODY, contrastRatio } from "../src/contrast.ts";
import { SPOKEN_COLOURS, itemColour, spokenColour } from "../src/colour.ts";
import { PAPERS, TEXT_COLOURS, TEXT_COLOR_PROP, TEXT_PROPERTIES, textColourOf, textFontFrom, textInkOf } from "../src/textnode.ts";
import {
  TEXT_COLOUR_SHADES,
  TEXT_SURFACES,
  textColourFrom,
  textColourWarnings,
  textLookPatch,
  textLookProperties,
} from "../src/textcolour.ts";

const actor = { id: "usr_a", name: "A" };
const node = (properties: Record<string, string>): Item => ({
  id: "itm_1",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  title: "t",
  description: "",
  properties: { kind: "text", ...properties },
  versions: [],
  currentVersionId: "",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
});

describe("the text colours are the spoken ones", () => {
  it("are words from colour.ts, minus the two no shade can keep", () => {
    for (const c of TEXT_COLOURS) expect(SPOKEN_COLOURS).toContain(c);
    expect(TEXT_COLOURS).not.toContain("black");
    expect(TEXT_COLOURS).not.toContain("white");
    expect(Object.keys(TEXT_COLOUR_SHADES).sort()).toEqual([...TEXT_COLOURS].sort());
  });
});

/**
 * **Adapted, and measured.** Every named colour has a shade per surface, and
 * each is held at body-text contrast against every surface it can land on —
 * the ground in its theme, and every paper in both themes. The canvas shades
 * must still say their own name, or "the red one" is pink in the dark.
 */
describe("a named colour reads wherever it lands", () => {
  for (const colour of TEXT_COLOURS) {
    const shade = TEXT_COLOUR_SHADES[colour];
    it(`${colour}: on the light ground, the dark ground, and every paper in both themes`, () => {
      expect(contrastRatio(shade.light, TEXT_SURFACES.light.ground)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
      expect(contrastRatio(shade.dark, TEXT_SURFACES.dark.ground)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
      for (const theme of ["light", "dark"] as const) {
        for (const paper of PAPERS) {
          const on = TEXT_SURFACES[theme].papers[paper];
          expect(contrastRatio(shade.paper, on)!, `${colour} on ${theme} ${paper}`).toBeGreaterThanOrEqual(CONTRAST_BODY);
        }
      }
    });
    it(`${colour}: still says its own name on the canvas, in both themes`, () => {
      expect(spokenColour(shade.light)).toBe(colour);
      expect(spokenColour(shade.dark)).toBe(colour);
    });
  }

  it("would not read if the light shade were used on graphite — the adaptation is doing work", () => {
    const failing = TEXT_COLOURS.filter(
      (c) => contrastRatio(TEXT_COLOUR_SHADES[c].light, TEXT_SURFACES.dark.ground)! < CONTRAST_BODY,
    );
    expect(failing.length).toBeGreaterThan(TEXT_COLOURS.length / 2);
  });
});

describe("reading a colour somebody typed", () => {
  it("takes a name in any case, grey as gray, auto as the theme's ink", () => {
    expect(textColourFrom("Red")).toBe("red");
    expect(textColourFrom("gray")).toBe("grey");
    expect(textColourFrom("auto")).toBe("auto");
    expect(textColourFrom(" AUTO ")).toBe("auto");
  });

  it("takes a hex with or without the mark, and spells it one way", () => {
    expect(textColourFrom("#FF8800")).toBe("#ff8800");
    expect(textColourFrom("f80")).toBe("#ff8800");
    expect(textColourFrom("#1f3fd0")).toBe("#1f3fd0");
  });

  it("refuses what it cannot draw, rather than guessing", () => {
    for (const bad of ["black", "white", "chartreuse", "#12345", "rgb(0,0,0)", "var(--ink)"]) {
      expect(textColourFrom(bad), bad).toBeNull();
    }
  });

  it("reads the property back, treating a bad value as the theme's ink", () => {
    expect(textColourOf({ [TEXT_COLOR_PROP]: "blue" })).toBe("blue");
    expect(textColourOf({ [TEXT_COLOR_PROP]: "#ABCDEF" })).toBe("#abcdef");
    expect(textColourOf({ [TEXT_COLOR_PROP]: "mauve" })).toBeNull();
    expect(textColourOf({})).toBeNull();
  });
});

describe("what the canvas draws", () => {
  it("is a token for a name — the stylesheet picks the theme's shade — and the paper's token on paper", () => {
    expect(textInkOf(node({ [TEXT_COLOR_PROP]: "red" }))).toBe("var(--text-red)");
    expect(textInkOf(node({ [TEXT_COLOR_PROP]: "red", paper: "yellow" }))).toBe("var(--paper-text-red)");
  });

  it("is the hex itself for a hex, and nothing — the theme's ink — otherwise", () => {
    expect(textInkOf(node({ [TEXT_COLOR_PROP]: "#aa3300" }))).toBe("#aa3300");
    expect(textInkOf(node({}))).toBeUndefined();
    expect(textInkOf(node({ [TEXT_COLOR_PROP]: "url(x)" }))).toBeUndefined();
    expect(textInkOf(node({ [TEXT_COLOR_PROP]: "black" }))).toBeUndefined();
  });

  it("makes a coloured caption answer to its colour — 'the red one'", () => {
    expect(itemColour({ properties: { kind: "text", [TEXT_COLOR_PROP]: "red" } })).toBe("red");
    expect(itemColour({ properties: { kind: "text", [TEXT_COLOR_PROP]: "#1f70db" } })).toBe("blue");
    // The words are read before the paper they sit on.
    expect(itemColour({ properties: { kind: "text", [TEXT_COLOR_PROP]: "green", paper: "yellow" } })).toBe("green");
  });
});

describe("a hex is drawn exactly, and warned about where it will not read", () => {
  it("says nothing for a name", () => {
    for (const c of TEXT_COLOURS) {
      expect(textColourWarnings(c, null)).toEqual([]);
      expect(textColourWarnings(c, "yellow")).toEqual([]);
    }
  });

  it("names the theme a pale hex vanishes in, and the one a dark hex does", () => {
    const pale = textColourWarnings("#f0f0f0", null);
    expect(pale).toHaveLength(1);
    expect(pale[0]).toMatch(/light theme/);
    const dark = textColourWarnings("#202020", null);
    expect(dark).toHaveLength(1);
    expect(dark[0]).toMatch(/dark theme/);
  });

  it("measures against the paper, not the ground, when it is on one", () => {
    expect(textColourWarnings("#202020", "yellow")).toEqual([]);
    expect(textColourWarnings("#f0f0f0", "yellow")).toHaveLength(2);
  });
});

describe("one spelling of a look, for both surfaces", () => {
  it("writes the defaults as absence", () => {
    expect(textLookPatch({ style: "body", face: "sans", paper: null, colour: null, font: null })).toEqual({
      properties: {},
      removeProperties: ["textStyle", "textFace", "textColor", "textFont", "paper"],
    });
    expect(textLookProperties({ style: "body", face: "sans", paper: null })).toEqual(TEXT_PROPERTIES);
  });

  it("leaves a colour and a font alone when the caller does not mention them", () => {
    // `null` takes them off; left out, a restyle from something that predates
    // them cannot wipe a colour somebody chose.
    expect(textLookPatch({ style: "heading", face: "sans", paper: null }).removeProperties).toEqual(["textFace", "paper"]);
  });

  it("writes a font with its face, so an older client draws the right kind of letter", () => {
    const patch = textLookPatch({ style: "title", face: "sans", paper: null, colour: "blue", font: textFontFrom("Lora") });
    expect(patch.properties).toEqual({ textStyle: "title", textFace: "serif", textColor: "blue", textFont: "Lora" });
    expect(patch.removeProperties).toEqual(["paper"]);
  });
});
