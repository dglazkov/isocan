import type { CanvasTheme, ThemeAnchor } from "@isocan/core";
import { useUiStore } from "../../stores/uiStore.ts";

/**
 * **A ground somebody painted** (#195, art delivered 8 Sep 2026).
 *
 * > "I have new tiles for the backgrounds… Can you bring them into the
 * > system?"
 *
 * One component for every painted ground, where there were two hand-written
 * ones and two grounds that could not exist at all. `docs/theme-art-prompts.md`
 * promised this exact shape a fortnight ago — *"the grounds ship procedurally
 * generated today; that was a deliberate stopgap, and the switch was built to
 * take a painted tile without rework, so anything produced from these is a
 * drop-in replacement, not a migration"* — and this is the drop-in. `Ocean.tsx`
 * and `Mountains.tsx` are gone; `Galaxy.tsx` stays, because the painted space
 * tile has a seam and a generated sky cannot.
 *
 * ## It aligns exactly the way the starfield does
 *
 * `background-size` multiplied by the scale, `background-position` offset by
 * the pan — so the ground pans and zooms WITH the items and a field stays
 * under whatever is standing in it. The alignment is the starfield's, deliberately:
 * one arithmetic for every world-space ground, so a painted one and a
 * generated one cannot drift into two ideas of where the world is.
 *
 * ## It does not fade, and that is the difference from a generated ground
 *
 * The starfield fades out below half zoom because its tiles are hundreds of
 * world units and turn into a woven texture when you stand back. A painted
 * tile is thousands of units across and holds a PICTURE — fields, ridges,
 * swells — which is exactly what a person zoomed out to see the shape of.
 * Fading it would remove the map at the zoom where a map is most useful.
 *
 * ## Bytes, and why they are not in the bundle
 *
 * Each tile is a file in `public/grounds/`, fetched by URL when a canvas
 * wears that ground and never otherwise — so the entry chunk `bundle-bytes`
 * bounds is untouched, and a canvas on the dot grid downloads none of them.
 * They are 1024² JPEGs at quality 82: 139KB to 663KB, down from the 118KB–5.3MB
 * originals. The heavy ones were 2048² and resampling to 1024 was measured
 * not to widen a single seam (edge gaps identical, 1–3 of 255), which is the
 * only thing a resample could have cost here.
 */

/** Where each ground's picture lives, and how much world it covers.
 *
 *  `world` is the side of one tile in canvas units, and it is a composition
 *  decision per picture rather than one number: it sets both how big the
 *  subject reads against an item and how often the tile repeats on a screen.
 *  Mountains is the largest because it is the one tile with a RECOGNISABLE
 *  landmark — a radial massif that the eye finds the second it appears twice —
 *  so its tile is sized to put the repeat off the edge of a working viewport.
 *  Desert is the smallest because sand ripples are grain: a repeat nobody can
 *  pick out of a uniform field costs nothing. */
export const PAINTED: Partial<Record<CanvasTheme, { file: string; world: number }>> = {
  ocean: { file: "ocean", world: 1400 },
  mountains: { file: "mountains", world: 2200 },
  farm: { file: "farm", world: 1600 },
  desert: { file: "desert", world: 900 },
};

export function PaintedGround({ theme, anchor }: { theme: CanvasTheme; anchor: ThemeAnchor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);
  /**
   * Pinned to the window: the picture does not move and does not scale, so
   * items travel across it. A third of the world size, matching what the
   * starfield does for the same reason — a pinned ground's density cannot
   * depend on a zoom it is not in, so it needs a size of its own.
   */
  const pinned = anchor === "window";
  const art = PAINTED[theme];
  if (art === undefined) return null;

  const side = pinned ? art.world / 3 : art.world * scale;
  return (
    <div
      className={`canvas-theme canvas-theme-painted canvas-theme-${theme}`}
      style={
        {
          "--tile": `url(/grounds/${art.file}.jpg)`,
          "--tile-size": `${side}px ${side}px`,
          "--tile-pos": pinned ? "0 0" : `${tx}px ${ty}px`,
        } as React.CSSProperties
      }
    />
  );
}
