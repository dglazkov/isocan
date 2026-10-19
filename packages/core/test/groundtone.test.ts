import { describe, expect, it } from "vitest";
import { contrastRatio } from "../src/contrast.ts";
import { TEXT_SURFACES } from "../src/textcolour.ts";
import { GROUND_SCRIM, THEMES, groundPatch, themePatch } from "../src/theme.ts";
import { CONTRAST_UI } from "../src/contrast.ts";
import { sampledGround } from "../src/groundsample.ts";
import {
  BRIGHTEST_PICTURE,
  bestInk,
  haloOf,
  GROUND_INK,
  GROUND_MEAN,
  groundColour,
  toneOfColour,
  toneOfGround,
} from "../src/groundtone.ts";

/**
 * The tone function is pure, so its cases are arithmetic: the expected tones
 * are design.md's table, and each is what the ink sets decide, not a
 * luminance cut. The stylesheet half (GROUND_MEAN against `--theme-*`, every
 * ink token on every ground) is `web/test/groundcontrast.test.ts`.
 */

const canvasOn = (theme: (typeof THEMES)[number]) => ({
  properties: themePatch(theme).properties as Record<string, string>,
});
const picture = { properties: groundPatch("a".repeat(64)).properties as Record<string, string> };

describe("the tone of a ground", () => {
  it("is dark for the nine dark grounds, light for Snow and Zen, mid for Desert", () => {
    const tones = Object.fromEntries(THEMES.map((t) => [t, toneOfGround(canvasOn(t), "light")]));
    expect(tones).toEqual({
      galaxy: "dark",
      ocean: "dark",
      mountains: "dark",
      farm: "dark",
      desert: "mid",
      meadow: "dark",
      night: "dark",
      snow: "light",
      aurora: "dark",
      pond: "dark",
      zen: "light",
    });
  });

  it("does not depend on the app's theme for a ground of its own", () => {
    for (const theme of THEMES) {
      expect(toneOfGround(canvasOn(theme), "dark")).toBe(toneOfGround(canvasOn(theme), "light"));
    }
  });

  it("is the app's own tone on the dot grid, so a plain canvas is today's picture", () => {
    expect(toneOfGround({}, "light")).toBe("light");
    expect(toneOfGround({}, "dark")).toBe("dark");
    expect(toneOfGround(null, "dark")).toBe("dark");
    expect(groundColour({}, "light")).toBe(TEXT_SURFACES.light.ground);
    expect(groundColour(null, "dark")).toBe(TEXT_SURFACES.dark.ground);
  });

  it("takes a picture at its brightest until it has been sampled", () => {
    expect(BRIGHTEST_PICTURE).toBe("#4d4d4d");
    expect(groundColour(picture, "light")).toBe(BRIGHTEST_PICTURE);
    expect(toneOfGround(picture, "light")).toBe("dark");
    // A pale picture sampled under a lighter scrim than today's would be read
    // for what it is, which is the point of looking rather than assuming.
    expect(toneOfGround(picture, "dark", "#e0e0e0")).toBe("light");
    expect(groundColour(picture, "dark", "#123456")).toBe("#123456");
  });

  it("derives the brightest picture from the scrim, not from a constant", () => {
    const v = Math.round(255 * (1 - GROUND_SCRIM));
    expect(parseInt(BRIGHTEST_PICTURE.slice(1, 3), 16)).toBe(v);
  });

  it("is decided by the ink sets, so it never says dark where the dark ink fails", () => {
    // Ocean: a luminance cut would get the side right and the ink wrong —
    // today's muted #8b929d is 3.07 there. The lifted muted ink clears it.
    expect(contrastRatio("#8b929d", GROUND_MEAN.ocean)).toBeLessThan(4.5);
    expect(toneOfColour(GROUND_MEAN.ocean)).toBe("dark");
    expect(contrastRatio(GROUND_INK.dark.muted, GROUND_MEAN.ocean)).toBeGreaterThanOrEqual(4.5);
    // Desert: white 4.11, the light set's ink 3.70 — neither family holds.
    expect(contrastRatio("#ffffff", GROUND_MEAN.desert)).toBe(4.11);
    expect(contrastRatio(GROUND_INK.light.ink, GROUND_MEAN.desert)).toBe(3.7);
    expect(toneOfColour(GROUND_MEAN.desert)).toBe("mid");
    // Something that is not a colour reads as neither, never as a side.
    expect(toneOfColour("not a colour")).toBe("mid");
  });
});

/** A 16×16 RGBA picture, as a canvas hands it back: `at(x)` is a column's grey. */
const picturePixels = (at: (x: number) => number) => {
  const out: number[] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out.push(at(x), at(x), at(x), 255);
  return new Uint8ClampedArray(out);
};

describe("a picture, sampled", () => {
  it("lands on the worst case for flat white under today's scrim, and black on black", () => {
    expect(sampledGround(picturePixels(() => 255))).toBe(BRIGHTEST_PICTURE);
    expect(sampledGround(picturePixels(() => 0))).toBe("#000000");
  });

  it("averages in linear light: half white and half black is not an sRGB half", () => {
    // Linear mean 0.5 → sRGB 0.735 → under 0.7 black, 56: #383838. An sRGB
    // average would say 127 → 38, a third darker than what the eye sees.
    expect(sampledGround(picturePixels((x) => (x < 8 ? 255 : 0)))).toBe("#383838");
  });

  it("takes a look: under a lighter scrim a white picture is a light ground", () => {
    /* The path design §4 builds for: nothing ships with 0.2, but the rule
       is "take a look", so a pale picture under a pale scrim is read for what
       it is and gets the dark ink — no table to update. */
    const pale = sampledGround(picturePixels(() => 255), 0.2);
    expect(pale).toBe("#cccccc");
    expect(toneOfColour(pale)).toBe("light");
    expect(toneOfGround(picture, "dark", pale)).toBe("light");
  });
});

describe("the best ink on a ground no family holds", () => {
  it("is black for Desert's words — the higher ink, measured", () => {
    expect(bestInk(GROUND_MEAN.desert, "ink")).toBe("#000000");
    expect(contrastRatio("#000000", GROUND_MEAN.desert)).toBe(5.11);
    expect(contrastRatio("#ffffff", GROUND_MEAN.desert)).toBe(4.11);
    expect(haloOf("#000000")).toBe("#ffffff");
    expect(haloOf("#ffffff")).toBe("#000000");
  });

  it("walks the better accent to the nearest colour that clears the ring's floor", () => {
    // The light accent is 2.99 on Desert; one step darker is 3.
    expect(contrastRatio(GROUND_INK.light.accent, GROUND_MEAN.desert)).toBe(2.99);
    const ring = bestInk(GROUND_MEAN.desert, "accent", CONTRAST_UI);
    expect(ring).toBe("#182889");
    expect(contrastRatio(ring, GROUND_MEAN.desert)).toBeGreaterThanOrEqual(CONTRAST_UI);
  });

  it("returns a set's own ink unchanged where it already clears", () => {
    expect(bestInk(GROUND_MEAN.ocean, "muted")).toBe(GROUND_INK.dark.muted);
    expect(bestInk(GROUND_MEAN.snow, "accent")).toBe(GROUND_INK.light.accent);
  });
});

