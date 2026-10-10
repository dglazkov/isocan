import { Suspense, lazy, useEffect, useState } from "react";
import { anchorOf, groundOf, isLiving, themeOf } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { groundMode } from "../lib/groundmode.ts";

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
 * without waiting on artwork; since living grounds phase 3 (9 Oct 2026) it is
 * Orbit, a living ground, and its still is a tile rendered from Orbit's own
 * shader, which cannot have a seam. A ground is now a file, not a component.
 */
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
/**
 * **A ground that moves** (living grounds phase 1): the WebGL host, its input
 * field and its sleep policy, in a chunk of their own — and each ground's
 * shaders in a chunk below that. Fetched only for a living theme with motion
 * allowed; under reduced motion the same ground is its painted still frame,
 * drawn by `Painted` like any other picture, and none of this is downloaded.
 */
const Living = lazy(() =>
  import("./themes/LivingGround.tsx").then((m) => ({ default: m.LivingGround })),
);

/** `prefers-reduced-motion: reduce`, live — a viewer who turns it on mid-
 *  session gets the still frame without a reload. */
function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function CanvasThemeLayer() {
  const project = useCanvasStore((s) => s.record);
  const reducedMotion = useReducedMotion();
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
   * **Living, or painted.** Every ground is a picture or a living ground with
   * a picture for its still, and one component draws all the pictures — the
   * switch that used to be here grew a line per theme, which is the shape
   * that made "farm waits for artwork" a code change rather than a file.
   */
  /**
   * **Living, or its still.** A living ground's still frame is a painted tile
   * like the four above, so "still" is not a second drawing path: it is
   * `Painted`, handed to the living layer to fall back on (no WebGL2, a failed
   * compile, a context lost twice) and drawn directly under reduced motion.
   */
  const painted = <Painted theme={theme} anchor={anchor} />;
  if (isLiving(theme) && groundMode({ reducedMotion, webgl2: null, compiled: null, losses: 0 }) === "living") {
    return (
      <Suspense fallback={null}>
        <Living theme={theme} anchor={anchor} still={painted} />
      </Suspense>
    );
  }
  return <Suspense fallback={null}>{painted}</Suspense>;
}
