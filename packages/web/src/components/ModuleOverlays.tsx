import { useMemo } from "react";
import type { Actor, OverlayRegion } from "@isocan/core";
import { modules } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { webHostFor } from "../lib/modulehost.ts";

/**
 * **Screen-space chrome a module contributes** (#156, 9 Sep 2026).
 *
 * The twin of `ModuleUnderlays`, mounted outside `.world` so a module can put
 * a tray or a dock on the screen rather than only draw beneath the work.
 *
 * ## The region is the whole design
 *
 * An underlay is safe to hand out freely because it is under everything, in
 * world units: the worst a module can do there is draw beneath the canvas. An
 * overlay is the app's own chrome space, and the failure it invites is the
 * one the rail and the dock avoid by having fixed lists — two modules that
 * both position themselves float on top of each other, and the person cannot
 * tell whose is whose or move either.
 *
 * So a module names an EDGE and the shell owns where that edge is. Two
 * overlays in one region stack in module order. A module cannot put anything
 * over the middle of the canvas, which is the work.
 *
 * ## It is chrome, so it can be turned off
 *
 * Nothing here yet, and it is the first thing this owes: every other floating
 * thing on this surface is in `lib/hideable.ts` and can be switched off from
 * Settings or a right-click. An overlay arrives because a module is loaded,
 * which is not the same as somebody choosing it — the experiment gate is
 * standing in for that today and is a coarser answer than the one this wants.
 */
export function ModuleOverlays({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  // Re-render when a runtime module arrives, and when an experiment is
  // switched on — `modules()` is a function for exactly these two reasons.
  useUiStore((s) => s.modulesGeneration);
  useUiStore((s) => s.experiments);
  const host = useMemo(() => webHostFor(canvasId, actor), [canvasId, actor]);
  if (!canvas) return null;

  const regions: OverlayRegion[] = ["left", "right"];
  return (
    <>
      {regions.map((region) => {
        const here = modules().flatMap((m) =>
          (m.overlays ?? [])
            .filter((o) => o.region === region)
            .map((o) => ({ module: m.core.name, overlay: o })),
        );
        if (here.length === 0) return null;
        return (
          <div key={region} className={`module-overlays module-overlays-${region}`}>
            {here.map(({ module, overlay }) => {
              const Body = overlay.component;
              return (
                <div
                  key={`${module}:${overlay.label}`}
                  /* `floats` is the rule for anything that floats over the
                     canvas — one ground, one hairline, one radius, one
                     shadow — so a module's tray looks like the app's own
                     chrome rather than like a module's idea of chrome. */
                  className="module-overlay floats"
                  aria-label={overlay.label}
                >
                  <Body canvasId={canvasId} canvas={canvas} host={host} />
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
