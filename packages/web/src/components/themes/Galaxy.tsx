import type { ThemeAnchor } from "@isocan/core";
import { useUiStore } from "../../stores/uiStore.ts";

/**
 * **Deep space, generated rather than drawn** (#195).
 *
 * The first theme, and it is first for a reason: a canvas is INFINITE, so a
 * background cannot be a picture with edges — pan far enough and you find
 * them. A starfield is the one ground that has no edges by construction, so
 * it proves the mechanism the painted themes then follow, at the cost of no
 * download and no artist.
 *
 * ## It lives in world space, and that is the whole design
 *
 * The stars pan and zoom WITH the canvas, the way the mind map's SVG does:
 * "it inherits `.world`'s transform and pans, zooms and scales with the nodes
 * without a single listener". Fixing it to the viewport would be cheaper and
 * would look fine on a still screen — and would be wrong for the request,
 * because the ground would slide under the items as you pan and nothing would
 * ever be *in* a place. A pen only holds sheep if the field stays put.
 *
 * ## Three layers, and none of them repaint
 *
 * Tiled `radial-gradient`s: sizes of star at different densities, offset so
 * the eye does not find the repeat. `background-size` is multiplied by the
 * scale and `background-position` by the pan, exactly as `CursorGlow` already
 * aligns the dot grid — so panning is the compositor moving a painted layer,
 * not this drawing a thousand stars a frame. That matters: a ground that
 * repaints on every pan spends the frames the canvas needs.
 *
 * ## It never catches a click
 *
 * `pointer-events: none` in the stylesheet, for the reason the mind map's
 * drawing states: it is a picture ABOUT the canvas, and catching a click
 * would make the canvas unreachable in a band nobody can see.
 *
 * ## What made it a galaxy rather than a starfield (8 Sep 2026)
 *
 * > "the space background is a lil boring... is there a way to spice it up
 * > and make it feel even more like a galaxy?"
 *
 * He is right, and the diagnosis is specific rather than "add more": the
 * first version had **one colour, one kind of star, and no structure**. Three
 * fields of identical white dots at three densities is a *starfield* — it is
 * what the night sky looks like through a small telescope, and a galaxy is
 * the thing you cannot see that way. Three things were missing, and each is
 * a layer that still never repaints:
 *
 * - **Colour.** Real stars are not white. Hot ones read blue, cool ones amber,
 *   and giving each field a temperature is what stops a field of dots reading
 *   as a texture — it is the cheapest of the three and does the most.
 * - **Depth.** Every star was a hard dot of one size. A handful of near stars
 *   with a halo, over a dust of far ones too faint to resolve, is what says
 *   the sky has a front and a back.
 * - **Structure.** The thing that actually makes a picture a galaxy: clouds.
 *   Nebulae are enormous and soft, so they tile at thousands of world units
 *   against the stars' hundreds, and they sit UNDER the stars — `::before` to
 *   the stars' `::after` — because a cloud in front of the stars is fog.
 *
 * The restraint is the same one the ocean states: *a background somebody has
 * to turn off to read the canvas is not a background.* The clouds are capped
 * so that three overlapping at full strength still land at #2a244a — a dark
 * enough ground that a white card, a yellow text node and a green pen stroke
 * all keep what they had. Measured rather than guessed, and asserted in
 * `packages/web/test/galaxy.test.ts` so a later "spice it up" cannot quietly
 * spend the legibility.
 */

/**
 * **A star's temperature, as the colour a dot is filled with.**
 *
 * Named rather than inline because the point of the change is that these are
 * three DIFFERENT lights: white for the near dust, blue-white for the hot
 * ones, amber for the cool giants. Written as literals with their alphas
 * applied per field, so the fields differ in brightness without differing in
 * hue by accident.
 */
const WHITE = "255, 255, 255";
const HOT = "198, 216, 255";
const COOL = "255, 224, 186";

/**
 * Five fields at co-prime-ish spacings, so nothing lines up and there is
 * no visible grid in something meant to be a sky.
 *
 * **A world-space tile cannot read well at every zoom, and this is the
 * trade.** Sized for reading zoom — roughly 100% — where a viewport holds a
 * few dozen stars and it looks like a sky. Two earlier attempts each failed
 * at one end: 260–730 units was a woven fabric at 5%, and 940–2330 showed
 * one star at 114%.
 *
 * So the spacing serves the zoom people work at, and the LAYER FADES when
 * they zoom out past it. That is honest about what the two zooms are for: a
 * canvas at 5% is being read for its structure, and a sky that turns into a
 * texture at that scale is competing with the thing you zoomed out to see.
 * Fading is also free — one opacity on a composited layer, no repaint.
 *
 * `halo` is what gives the sky a front: a second, much wider and much
 * fainter stop on the same gradient, so a near star bleeds into the space
 * around it the way a bright one does through an atmosphere. Only the two
 * sparsest fields carry one — a halo on the dust would be a haze, and the
 * whole point of the dust is that it is behind everything.
 */
export const STARS = [
  /* The far dust: below the size where a dot resolves, which is exactly
     what makes it read as distance rather than as more stars. */
  { size: 155, dot: 0.7, tint: WHITE, alpha: 0.34, halo: 0, dx: 0, dy: 0 },
  { size: 230, dot: 1.1, tint: WHITE, alpha: 0.9, halo: 0, dx: 40, dy: 90 },
  { size: 370, dot: 1.5, tint: HOT, alpha: 0.72, halo: 0, dx: 70, dy: 130 },
  { size: 590, dot: 2.1, tint: COOL, alpha: 0.62, halo: 0.1, dx: 250, dy: 40 },
  /* The near few. Rare enough that a viewport holds a handful, bright
     enough that they are what the eye lands on first. */
  { size: 910, dot: 2.6, tint: HOT, alpha: 0.95, halo: 0.16, dx: 430, dy: 610 },
];

/**
 * **The clouds**, in world units an order of magnitude above the stars —
 * a nebula that tiled at star spacing would be a pattern, and the one thing
 * a nebula must not look like is wallpaper.
 *
 * Ellipses rather than circles, at three angles-by-position, because a
 * round cloud reads as a spotlight. Each fades to `transparent` well inside
 * its own tile so the tiles meet in empty space rather than at a seam.
 *
 * The alphas are the legibility budget, and they are deliberately small.
 * Three overlapping at full strength composite to #2a244a over
 * `--theme-space` — dark enough that everything standing on the canvas
 * keeps the contrast it had on plain space.
 *
 * **The sizes are bounded by the zoom, not by taste.** `MAX_SCALE` is 8, so a
 * world-space tile is drawn at eight times its number: the largest star field
 * already reaches 7,280px there and has shipped that way since #195, which is
 * the only evidence in hand that a tile this size is free. 3,400 reaches
 * 27,200px, and the reason that is believed to be fine — a CSS gradient is a
 * shader with a local matrix, not a rasterised bitmap — is a claim about the
 * engine rather than a measurement of this app. It was chosen down from 4,300
 * for that reason alone. If a galaxy ever feels heavy at high zoom, this is
 * the first thing to suspect and `--clouds-size` is where to look.
 */
export const NEBULA = [
  { size: 1900, dx: 0, dy: 0, at: "30% 35%", radius: "58% 42%", rgb: "86, 64, 170", alpha: 0.24 },
  { size: 2500, dx: 900, dy: 400, at: "72% 62%", radius: "46% 56%", rgb: "24, 86, 140", alpha: 0.2 },
  { size: 3400, dx: 1500, dy: 1100, at: "45% 76%", radius: "62% 36%", rgb: "150, 52, 110", alpha: 0.14 },
];

export function Galaxy({ anchor }: { anchor: ThemeAnchor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);
  /**
   * Pinned to the window: the sky does not move and does not scale, so items
   * travel across it. Everything below still runs — one branch, at the three
   * places the viewport actually enters — rather than a second component, so
   * the two behaviours cannot drift into two starfields.
   */
  const pinned = anchor === "window";

  /**
   * Full strength at half zoom and above; gone by a tenth, where the canvas is
   * being read as a map and the stars would only be noise.
   *
   * The clouds fade on the same curve and for a second reason of their own: a
   * 2,600-unit tile is 260px at a tenth, so the repeat a person cannot find at
   * reading zoom is the only thing they would see. One value rather than two
   * curves — the ground going quiet when you stand back is one behaviour.
   *
   * A pinned sky never fades: its density does not change with the zoom,
   * because it is not in the canvas — so there is no scale at which it turns
   * into a texture, and nothing to protect the reader from.
   */
  const fade = pinned ? 1 : Math.max(0, Math.min(1, (scale - 0.1) / 0.4));

  return (
    <div
      className="canvas-theme canvas-theme-galaxy"
      style={
        {
          // The stars and the clouds are handed to `::after` and `::before` as
          // custom properties so the ground, the clouds and the stars are three
          // layers: the fade belongs to the drawn ones alone, and painting the
          // gradients here as well would draw every one of them twice.
          "--star-fade": String(fade),
          "--stars": STARS
            .map((f) =>
              f.halo > 0
                ? `radial-gradient(circle at ${f.dot}px ${f.dot}px, rgba(${f.tint},${f.alpha}) ${f.dot}px, rgba(${f.tint},${f.halo}) ${f.dot + 1.4}px, transparent ${f.dot + 4.2}px)`
                : `radial-gradient(circle at ${f.dot}px ${f.dot}px, rgba(${f.tint},${f.alpha}) ${f.dot}px, transparent ${f.dot + 0.6}px)`,
            )
            .join(", "),
          "--stars-size": STARS
            .map((f) => {
              const size = pinned ? f.size / 3 : f.size * scale;
              return `${size}px ${size}px`;
            })
            .join(", "),
          "--stars-pos": STARS
            .map((f) => (pinned ? `${f.dx / 3}px ${f.dy / 3}px` : `${tx + f.dx * scale}px ${ty + f.dy * scale}px`))
            .join(", "),
          "--clouds": NEBULA
            .map(
              (c) =>
                `radial-gradient(ellipse ${c.radius} at ${c.at}, rgba(${c.rgb},${c.alpha}), transparent 70%)`,
            )
            .join(", "),
          "--clouds-size": NEBULA
            .map((c) => {
              const size = pinned ? c.size / 3 : c.size * scale;
              return `${size}px ${size}px`;
            })
            .join(", "),
          "--clouds-pos": NEBULA
            .map((c) => (pinned ? `${c.dx / 3}px ${c.dy / 3}px` : `${tx + c.dx * scale}px ${ty + c.dy * scale}px`))
            .join(", "),
        } as React.CSSProperties
      }
    />
  );
}
