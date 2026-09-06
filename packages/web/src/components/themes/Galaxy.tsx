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
 * Tiled `radial-gradient`s: three sizes of star at three densities, offset so
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
 */
export function Galaxy() {
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);

  /**
   * Three fields at co-prime-ish spacings, so nothing lines up and there is
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
   */
  const fields = [
    { size: 230, dot: 1.1, alpha: 0.9, dx: 0, dy: 0 },
    { size: 370, dot: 1.5, alpha: 0.62, dx: 70, dy: 130 },
    { size: 590, dot: 2.1, alpha: 0.42, dx: 250, dy: 40 },
  ];

  /** Full strength at half zoom and above; gone by a tenth, where the canvas
   *  is being read as a map and the stars would only be noise. */
  const fade = Math.max(0, Math.min(1, (scale - 0.1) / 0.4));

  return (
    <div
      className="canvas-theme canvas-theme-galaxy"
      style={
        {
          // The stars are handed to `::after` as custom properties so the
          // ground and the stars are two layers: the fade belongs to the
          // stars alone, and painting the gradients here as well would draw
          // every one of them twice.
          "--star-fade": String(fade),
          "--stars": fields
            .map(
              (f) =>
                `radial-gradient(circle at ${f.dot}px ${f.dot}px, rgba(255,255,255,${f.alpha}) ${f.dot}px, transparent ${f.dot + 0.6}px)`,
            )
            .join(", "),
          "--stars-size": fields.map((f) => `${f.size * scale}px ${f.size * scale}px`).join(", "),
          "--stars-pos": fields
            .map((f) => `${tx + f.dx * scale}px ${ty + f.dy * scale}px`)
            .join(", "),
        } as React.CSSProperties
      }
    />
  );
}
