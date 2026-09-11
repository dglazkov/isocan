import { Suspense, lazy } from "react";
import { anchorOf, groundOf, themeOf } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The ground a canvas stands on** (#195).
 *
 * One layer, under everything, chosen by the canvas's `theme` property. A
 * canvas with no theme renders nothing at all — not an empty div, not a
 * transparent picture — so the dot grid every canvas has today is byte-for-
 * byte what it was.
 *
 * ## Every theme is its own chunk
 *
 * `bundle-bytes` bounds what a first visit downloads, and the entry chunk has
 * been raised twice in one day already. Theme art is exactly the sort of
 * thing that would land in it by default and never be noticed — so each one
 * is `lazy`, and a canvas without a theme fetches none of them. `fallback` is
 * nothing, because the ground arriving a frame late is invisible in a way a
 * missing item never would be.
 *
 * The painted themes #195 named — farm, mountains, ocean — arrived on 8 Sep
 * 2026, along with a desert nobody had asked for. Galaxy was generated first
 * because it proved the layer, the world-space alignment and the chunking
 * without waiting on artwork, and it is generated STILL because the space
 * tile that came back has a seam. A ground is now a file, not a component.
 */
const Galaxy = lazy(() => import("./themes/Galaxy.tsx").then((m) => ({ default: m.Galaxy })));
/**
 * **One chunk for every painted ground**, where there was one per procedural
 * theme. The art is not in the chunk — each tile is a file in `public/grounds/`
 * fetched by URL — so this splits a component, not megabytes, and a canvas
 * wearing no ground still fetches neither.
 */
const Painted = lazy(() =>
  import("./themes/PaintedGround.tsx").then((m) => ({ default: m.PaintedGround })),
);
const CustomGround = lazy(() =>
  import("./themes/CustomGround.tsx").then((m) => ({ default: m.CustomGround })),
);

export function CanvasThemeLayer() {
  const project = useCanvasStore((s) => s.project);
  const theme = project ? themeOf(project) : null;
  const anchor = project ? anchorOf(project) : "world";
  /**
   * **A picture wins over a name, and core makes sure there is never both**
   * (#204 phase 2). `themePatch` drops the ground and `groundPatch` drops the
   * theme, so this order is a tiebreak that should never be reached — it is
   * written down anyway, because a canvas hand-edited into wearing two grounds
   * should draw one of them rather than both, stacked, at half a frame each.
   */
  const ground = project ? groundOf(project) : null;
  if (ground !== null && project) {
    return (
      <Suspense fallback={null}>
        <CustomGround canvasId={project.id} hash={ground} />
      </Suspense>
    );
  }
  if (theme === null) return null;
  /**
   * **Generated, or painted.** Galaxy is the only ground still drawn in code,
   * and it is not a leftover: the painted space tile has a visible seam and an
   * infinite canvas finds a seam within one pan, while a generated sky cannot
   * have one. Everything else is a picture, and one component draws all of
   * them — the switch that used to be here grew a line per theme, which is the
   * shape that made "farm waits for artwork" a code change rather than a file.
   */
  return (
    <Suspense fallback={null}>
      {theme === "galaxy" ? <Galaxy anchor={anchor} /> : <Painted theme={theme} anchor={anchor} />}
    </Suspense>
  );
}
