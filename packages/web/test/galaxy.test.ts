import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NEBULA, SKY_CAP, SPACE, STAR_TINTS, TILE, layout } from "../src/components/themes/orbit.ts";
import { PAINTED } from "../src/components/themes/PaintedGround.tsx";
import { css } from "./cssrules.ts";

/**
 * **A background somebody has to turn off to read the canvas is not a
 * background.**
 *
 * The sentence is the ocean theme's, and it is the whole reason this file
 * exists. On 8 Sep 2026 Dion asked for the space ground to be *"even more like
 * a galaxy"*, and on 9 Oct it became Orbit — stars that answer every cursor.
 * Each step towards a better picture is a step towards a ground that competes
 * with what is standing on it, so the budget is measured from the ground's own
 * tables (`orbit.ts`, the numbers its shader is written from), not a copy.
 *
 * And since 9 Oct, the thing Orbit's phase fixed: its stars are WORLD
 * anchored. Where a star rests is a pure function of the view, so zooming out
 * and back cannot gather them toward the centre (the bench's flaw).
 */

type Rgb = [number, number, number];

/** `--theme-space`, read from the sheet rather than pasted — and the shader's
 *  own space colour must be the same one. */
function space(): Rgb {
  const value = /--theme-space:\s*(#[0-9a-f]{6})/i.exec(css);
  expect(value, "--theme-space must be declared").toBeTruthy();
  const hex = value![1]!.replace("#", "");
  const sheet = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  expect(SPACE, "Orbit's space is the sheet's space").toEqual(sheet);
  return sheet;
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
    (ground, cloud) => over(cloud.rgb, cloud.alpha, ground),
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

  it("caps the sky the shader draws at a colour that keeps every item legible", () => {
    /* The shader clamps the composited sky at SKY_CAP whatever the noise does,
       so the cap itself must pass the same floors. */
    for (const [what, colour, floor] of STANDING) {
      expect(ratio(colour, SKY_CAP), `${what} on the capped sky`).toBeGreaterThanOrEqual(floor);
    }
  });

  it("keeps the CSS Galaxy's three star temperatures", () => {
    expect(STAR_TINTS).toHaveLength(3);
    expect(new Set(STAR_TINTS.map((t) => t.join())).size).toBe(3);
  });

  it("tiles its still at the period every hash wraps at", () => {
    expect(PAINTED.galaxy?.world).toBe(TILE);
    expect(PAINTED.galaxy?.fade, "the still fades with zoom, as the CSS Galaxy did").toBe(true);
  });
});

describe("Orbit's stars live in the world", () => {
  const W = 1440;
  const H = 900;
  /** Where each drawn level's window sits, as world rects — the stars a view
   *  draws are exactly the lattice cells in these windows. */
  const windows = (view: { scale: number; tx: number; ty: number }) =>
    layout(view, W, H).regions.map((r) => ({ level: r.level, ox: r.ox, oy: r.oy, alpha: r.alpha.toFixed(9), k: r.k.toFixed(9) }));

  it("gives the same view the same stars, whatever happened in between", () => {
    const start = { scale: 1, tx: -120, ty: 40 };
    const before = windows(start);
    // Zoom out three times about the centre, and back.
    let v = start;
    for (let i = 0; i < 3; i++) {
      const r = 1 / 3;
      v = { scale: v.scale * r, tx: W / 2 - (W / 2 - v.tx) * r, ty: H / 2 - (H / 2 - v.ty) * r };
      windows(v);
      v = { scale: v.scale / r, tx: W / 2 - (W / 2 - v.tx) / r, ty: H / 2 - (H / 2 - v.ty) / r };
    }
    expect(v.scale).toBeCloseTo(1, 9);
    expect(windows(v)).toEqual(before);
  });

  it("holds the screen's star density across a zoom", () => {
    /* Stars per screen, from the cell sizes: each level contributes
       alpha × (screen area / cell² on screen). Within 20% from 5% to 800%. */
    const density = (scale: number) =>
      layout({ scale, tx: 0, ty: 0 }, W, H).regions.reduce((sum, r) => sum + (r.alpha * W * H) / (r.cell * scale) ** 2, 0);
    const at1 = density(1);
    for (const s of [0.05, 0.1, 0.33, 0.5, 0.71, 1.4, 2, 3, 8]) {
      expect(Math.abs(density(s) / at1 - 1), `density at ${s}`).toBeLessThan(0.2);
    }
  });

  it("moves the stars with a pan like the items, the far ones a little slower", () => {
    const a = layout({ scale: 1, tx: 0, ty: 0 }, W, H).regions;
    for (const r of a) {
      expect(r.k).toBeGreaterThanOrEqual(0.86);
      expect(r.k).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...a.map((r) => r.k)) - Math.min(...a.map((r) => r.k))).toBeGreaterThan(0.05);
  });

  it("is loaded only by the living layer, never from the first paint", () => {
    const living = readFileSync(fileURLToPath(new URL("../src/components/themes/LivingGround.tsx", import.meta.url)), "utf8");
    expect(living).toMatch(/import\("\.\/orbit\.ts"\)/);
    expect(living).not.toMatch(/^import .*orbit\.ts/m);
  });
});
