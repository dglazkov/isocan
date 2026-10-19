import { describe, expect, it } from "vitest";
import {
  BRIGHTEST_PICTURE,
  type CanvasTheme,
  GROUND_INK,
  GROUND_INK_FLOOR,
  GROUND_MEAN,
  type GroundInkRole,
  type GroundTone,
  THEMES,
  TEXT_SURFACES,
  contrastRatio,
  groundColour,
  groundPatch,
  themePatch,
  toneOfGround,
} from "@isocan/core";

import { groundToken } from "../src/lib/groundtoken.ts";
import { css } from "./cssrules.ts";

/**
 * **Every ink on the ground, measured on every ground** (smart contrast,
 * design §6) — the forcing function.
 *
 * Chrome drawn straight onto the canvas took its ink from the app's theme,
 * and a canvas's ground does not follow the app's theme: the dark app's
 * muted name measured 3.07 on Ocean and 2.70 on the brightest picture, and a
 * chromeless note's words 1.19 on Snow. Core's `toneOfGround` now decides
 * which ink family a ground takes, by the ink sets themselves; this file is
 * what makes that decision hold for every ground the build can draw. A new
 * ground cannot ship without a mean in core that matches its stylesheet
 * token, a tone, and every ground-ink token passing on it.
 *
 * Modelled on `textcolour.test.ts` (shades held at 4.5:1 per surface) and
 * `groundtoken.test.ts` (a row for every ground). "The inventory holds" — the
 * tier, not the app's tokens, on everything in `groundtext.ts` — is phase 2's,
 * when the tier exists to hold.
 */

const canvasOn = (theme: CanvasTheme) => ({
  properties: themePatch(theme).properties as Record<string, string>,
});
const picture = { properties: groundPatch("a".repeat(64)).properties as Record<string, string> };

/**
 * The grounds no ink family reads on, each with why that is acceptable.
 * Adding a ground here is a decision, so it carries its reason; a ground that
 * lands in `mid` without one fails below.
 */
const MID: Partial<Record<CanvasTheme, string>> = {
  desert:
    "white 4.11, the light ink 3.70: neither family holds on #ab703b. Decided 19 Oct 2026 " +
    "(design.md, end): chrome stands on a glass plate; text nodes take the higher ink plus a halo.",
};

/** Every ground the guard measures: the seeded ones, the dot grid in both app
 *  themes, and a picture at its brightest. */
const GROUNDS: { name: string; colour: string; tone: GroundTone }[] = [
  ...THEMES.map((t) => ({ name: t, colour: groundColour(canvasOn(t), "light"), tone: toneOfGround(canvasOn(t), "light") })),
  { name: "dot grid (light app)", colour: groundColour({}, "light"), tone: toneOfGround({}, "light") },
  { name: "dot grid (dark app)", colour: groundColour({}, "dark"), tone: toneOfGround({}, "dark") },
  { name: "picture (brightest)", colour: groundColour(picture, "light"), tone: toneOfGround(picture, "light") },
];

describe("the tone of every ground", () => {
  it("takes the tone the design measured", () => {
    expect(Object.fromEntries(GROUNDS.map((g) => [g.name, g.tone]))).toEqual({
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
      "dot grid (light app)": "light",
      "dot grid (dark app)": "dark",
      "picture (brightest)": "dark",
    });
  });

  it("lets no seeded ground be mid without a reason", () => {
    const unexplained = GROUNDS.filter((g) => g.tone === "mid" && !MID[g.name as CanvasTheme]).map((g) => g.name);
    expect(unexplained, "a ground no ink reads on — give it a reason in MID, or a mean an ink can read").toEqual([]);
    // …and no reason outlives the ground it was for.
    const stale = Object.keys(MID).filter((t) => toneOfGround(canvasOn(t as CanvasTheme), "light") !== "mid");
    expect(stale, "these are no longer mid — delete their reason").toEqual([]);
  });

  it("measures the dot grid and the picture where core says they are", () => {
    expect(groundColour({}, "light")).toBe(TEXT_SURFACES.light.ground);
    expect(groundColour({}, "dark")).toBe(TEXT_SURFACES.dark.ground);
    expect(groundColour(picture, "light")).toBe(BRIGHTEST_PICTURE);
  });
});

describe("every ground-ink token reads on every ground of its tone", () => {
  for (const g of GROUNDS) {
    if (g.tone === "mid") continue; // the plate's ink is the app's, measured on glass
    it(`${g.name} (${g.colour}, ${g.tone})`, () => {
      const set = GROUND_INK[g.tone as "dark" | "light"];
      const short = (Object.keys(GROUND_INK_FLOOR) as GroundInkRole[])
        .map((role) => ({ role, ink: set[role], ratio: contrastRatio(set[role], g.colour) ?? 0, need: GROUND_INK_FLOOR[role] }))
        .filter((m) => m.ratio < m.need)
        .map((m) => `${m.role} ${m.ink} is ${m.ratio}:1, needs ${m.need}`);
      expect(short).toEqual([]);
    });
  }
});

describe("core's ground means are the stylesheet's", () => {
  /** A token's value inside one theme block. Both blocks declare the
   *  `--theme-*` means, because a ground is the same picture in either app
   *  theme; both are read, so neither can drift. */
  const BLOCKS = {
    light: /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s,
    dark: /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s,
  };
  for (const [app, block] of Object.entries(BLOCKS)) {
    it(`GROUND_MEAN equals the --theme-* values in the ${app} block`, () => {
      const scope = block.exec(css)?.[1];
      expect(scope, `no ${app} :root block`).toBeTruthy();
      for (const theme of THEMES) {
        /* The token comes from `groundToken`, the same table the top fade
           paints with, so core, the fade and the ground name one colour. */
        const token = groundToken(canvasOn(theme))!;
        const value = new RegExp(`${token}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(scope!)?.[1];
        expect(value, `${token} is not declared in the ${app} block`).toBeTruthy();
        expect(GROUND_MEAN[theme], `${theme}: core says ${GROUND_MEAN[theme]}, ${token} says ${value}`).toBe(value!.toLowerCase());
      }
    });
  }
});
