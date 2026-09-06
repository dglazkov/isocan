import { Suspense, lazy } from "react";
import { anchorOf, themeOf } from "@isocan/core";
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
 * The painted themes named in #195 — farm, mountains, ocean — are not here
 * yet. Galaxy is generated, which is why it is first: it proves the layer,
 * the world-space alignment and the chunking without waiting on artwork.
 * Adding one is a file beside `Galaxy.tsx` and a line in this switch.
 */
const Galaxy = lazy(() => import("./themes/Galaxy.tsx").then((m) => ({ default: m.Galaxy })));

export function CanvasThemeLayer() {
  const project = useCanvasStore((s) => s.project);
  const theme = project ? themeOf(project) : null;
  const anchor = project ? anchorOf(project) : "world";
  if (theme === null) return null;
  return (
    <Suspense fallback={null}>
      {theme === "galaxy" && <Galaxy anchor={anchor} />}
      {/* farm, mountains and ocean are painted and not built yet: the canvas
          keeps its dot grid until they are, rather than showing a blank. */}
    </Suspense>
  );
}
