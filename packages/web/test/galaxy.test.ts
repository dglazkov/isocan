import { describe, expect, it } from "vitest";

import { NEBULA, STARS } from "../src/components/themes/Galaxy.tsx";
import { css, rules, selectorsOf } from "./cssrules.ts";

/**
 * **A background somebody has to turn off to read the canvas is not a
 * background.**
 *
 * The sentence is the ocean theme's, and it is the whole reason this file
 * exists. On 8 Sep 2026 Dion asked for the space ground to be *"even more like
 * a galaxy"*, which is an invitation to spend exactly the thing that sentence
 * protects: every step towards a better picture — colour, glow, nebulae — is a
 * step towards a ground that competes with what is standing on it.
 *
 * So the budget is measured rather than eyeballed, and it is measured from the
 * component's own tables rather than a copy of them (lesson #5: a guard that
 * restates the rule can only test itself). Raise an alpha, add a fourth cloud,
 * pick a brighter hue, and this arithmetic moves with it — which is the point.
 * A later "spice it up" is welcome; a later "spice it up" that quietly costs a
 * pen stroke its contrast is what fails here.
 *
 * The stacking is asserted too, because it is the difference between a nebula
 * and fog: clouds under the stars, both under the world, neither catching a
 * pointer.
 */

type Rgb = [number, number, number];

/** `--theme-space`, read from the sheet rather than pasted. */
function space(): Rgb {
  const value = /--theme-space:\s*(#[0-9a-f]{6})/i.exec(css);
  expect(value, "--theme-space must be declared").toBeTruthy();
  const hex = value![1]!.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function over(rgb: Rgb, alpha: number, ground: Rgb): Rgb {
  return ground.map((v, i) => rgb[i]! * alpha + v * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  return rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i]! * c, 0);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The darkest thing the sky can become: every cloud overlapping, each at its
 *  full strength, composited in the order they are painted. */
function brightestSky(): Rgb {
  return NEBULA.reduce<Rgb>(
    (ground, cloud) => over(cloud.rgb.split(",").map(Number) as Rgb, cloud.alpha, ground),
    space(),
  );
}

/* What actually stands on a canvas, and what each one needs to keep. A white
   card is every item's surface; the text node is the paper a sticky note is
   drawn on; the pen colours are strokes laid directly on the ground with no
   surface at all, which makes them the case that fails first. */
const STANDING: Array<[string, Rgb, number]> = [
  ["an item's card", [255, 255, 255], 10],
  ["a text node", [253, 243, 199], 10],
  ["a green pen stroke", [43, 138, 62], 2.4],
  ["a red pen stroke", [201, 60, 60], 2.4],
];

describe("the galaxy is a picture the canvas can still be read on", () => {
  it("keeps everything standing on it legible, at the sky's brightest", () => {
    const sky = brightestSky();
    for (const [what, colour, floor] of STANDING) {
      expect(ratio(colour, sky), `${what} on the brightest sky`).toBeGreaterThanOrEqual(floor);
    }
  });

  it("keeps the faintest stars visible through the thickest cloud", () => {
    /**
     * The failure mode a brighter nebula actually has, and it is not the
     * items — they sit on their own surfaces. It is the sky eating itself.
     * The far dust is 34% of the way from the ground to white, so it brightens
     * WITH the cloud under it: push the clouds far enough and the dust becomes
     * a slightly paler cloud, the depth goes, and what is left is fog with a
     * few bright stars in it. Measured on the brightest sky the tables can
     * make, where the loss would happen first.
     */
    const sky = brightestSky();
    const dust = STARS.reduce((faintest, f) => (f.alpha < faintest.alpha ? f : faintest), STARS[0]!);
    const lit = over(dust.tint.split(",").map(Number) as Rgb, dust.alpha, sky);
    expect(ratio(lit, sky), "the far dust has dissolved into the cloud").toBeGreaterThanOrEqual(2.2);
  });

  it("paints the clouds under the stars, and both under the world", () => {
    /* A cloud over the stars is fog. `::before` paints before `::after` at the
       same z, so the order is the pseudo-element rather than a z-index — and
       that is exactly the sort of thing that emerges from stacking and is
       silently reversed by a later edit. */
    const before = rules().find((r) => selectorsOf(r).includes(".canvas-theme-galaxy::before"));
    const after = rules().find((r) => selectorsOf(r).includes(".canvas-theme-galaxy::after"));
    expect(before, "the clouds must have a layer").toBeTruthy();
    expect(after, "the stars must have a layer").toBeTruthy();
    expect(before!.body).toContain("var(--clouds)");
    expect(after!.body).toContain("var(--stars)");
    const layer = rules().find((r) => selectorsOf(r).includes(".canvas-theme"));
    expect(layer!.body, "the whole ground stays under the world and out of the way").toContain(
      "pointer-events: none",
    );
  });

  it("declares every value its component writes, so a missing one is visible", () => {
    /**
     * The reason the star values are declared in the sheet as well as written
     * by the component, stated in the stylesheet and now enforced: `var()`
     * with no definition drops the whole declaration silently, so a component
     * that stopped setting one would give a rule nobody could see was gone.
     * The clouds arrived with the same three values and want the same net.
     */
    const rule = rules().find((r) => selectorsOf(r).includes(".canvas-theme-galaxy"));
    for (const name of ["--stars", "--stars-size", "--stars-pos", "--clouds", "--clouds-size", "--clouds-pos"]) {
      expect(rule!.body, `${name} needs a safe default`).toContain(`${name}:`);
    }
  });

  it("fades the clouds with the stars rather than on a curve of their own", () => {
    /* A 1,900-unit tile is 190px at a tenth zoom, so a nebula that outlived
       the stars would be the one thing a person saw repeating. One value: the
       ground going quiet when you stand back is one behaviour. */
    const before = rules().find((r) => selectorsOf(r).includes(".canvas-theme-galaxy::before"));
    expect(before!.body).toContain("opacity: var(--star-fade");
  });

  it("has a sky with a front and a back", () => {
    /* The finding behind the change: identical dots at three densities is a
       texture. Depth is more than one size AND more than one temperature, and
       a halo only where a star is near enough to have one. */
    expect(new Set(STARS.map((f) => f.dot)).size, "one dot size is a texture").toBeGreaterThan(3);
    expect(new Set(STARS.map((f) => f.tint)).size, "one colour is a texture").toBeGreaterThan(1);
    expect(STARS.filter((f) => f.halo > 0).length, "a halo on every star is a haze").toBeLessThan(
      STARS.length / 2,
    );
    /* Sparser fields carry the halo: a glow on the dust is fog by another
       name, and the dust is the layer that says "far". */
    for (const field of STARS.filter((f) => f.halo > 0)) {
      expect(field.size, "only the rare stars glow").toBeGreaterThan(500);
    }
  });
});
