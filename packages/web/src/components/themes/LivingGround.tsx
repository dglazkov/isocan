import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CanvasTheme, ThemeAnchor } from "@isocan/core";
import { useCanvasStore } from "../../stores/canvasStore.ts";
import { useUiStore } from "../../stores/uiStore.ts";
import { groundView, itemRects, toGround } from "../../lib/groundfield.ts";
import type { LivingGround as Ground } from "./livingkit.ts";
import { GroundHost } from "./GroundHost.ts";
import "./meadow.css";

/**
 * **A ground that moves** (living grounds phase 1).
 *
 * The React half of the living layer, and deliberately thin: it mounts one
 * canvas, starts a `GroundHost` on it, and wires the host to what the browser
 * already knows — the viewport, the items, this viewer's pointer. None of
 * those reach React state; each is a subscription that writes into the host,
 * so panning a meadow re-renders nothing.
 *
 * Loaded only by `CanvasThemeLayer`, only for a living theme, and only when
 * reduced motion is off — so a canvas on any other ground, and a viewer who
 * asked for stillness, download none of this.
 *
 * When the host gives up (no WebGL2, a shader that will not compile, a context
 * lost twice) it says so once, and this renders `still` instead: the ground's
 * painted still frame, which is the same field at rest.
 */

/** Each ground is its own chunk, fetched only by a canvas wearing it. */
const GROUNDS: Partial<Record<CanvasTheme, () => Promise<Ground>>> = {
  meadow: () => import("./meadow.ts").then((m) => m.createMeadow()),
};

/** What the `meadow` journey reads off the canvas element. */
export interface GroundProbe {
  frames: () => number;
  trailAt: (worldX: number, worldY: number) => number;
}

export function LivingGround({ theme, anchor, still }: { theme: CanvasTheme; anchor: ThemeAnchor; still: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [isStill, setStill] = useState(false);
  const pinned = anchor === "window";

  useEffect(() => {
    const canvas = ref.current;
    const load = GROUNDS[theme];
    if (!canvas || !load) {
      setStill(true);
      return;
    }
    let host: GroundHost | null = null;
    let gone = false;
    const off: (() => void)[] = [];

    void load().then((ground) => {
      if (gone) return;
      host = new GroundHost(canvas, ground, { onStill: () => setStill(true) });
      const h = host;
      const viewOf = () => groundView(useUiStore.getState().viewport, pinned);
      const items = () => {
        const s = useCanvasStore.getState();
        const contents = s.past?.canvas ?? s.canvas;
        const list = contents ? Object.values(contents.items) : [];
        h.setItems(itemRects(list, useUiStore.getState().viewport, viewOf(), canvas.clientWidth, canvas.clientHeight));
      };
      h.setView(viewOf());
      items();

      off.push(
        useUiStore.subscribe((s, prev) => {
          if (s.viewport === prev.viewport) return;
          h.setView(viewOf());
          items();
        }),
      );
      off.push(
        useCanvasStore.subscribe((s, prev) => {
          if (s.canvas === prev.canvas && s.past === prev.past) return;
          items();
        }),
      );

      const resize = new ResizeObserver(() => {
        h.resize();
        items();
      });
      resize.observe(canvas);
      off.push(() => resize.disconnect());

      let lastX = NaN;
      let lastY = NaN;
      const move = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) return;
        const dist = Number.isNaN(lastX) ? 0 : Math.hypot(sx - lastX, sy - lastY);
        lastX = sx;
        lastY = sy;
        const at = toGround(h.currentView, sx, sy);
        h.pointer("self", at.x, at.y, dist, (e.buttons & 1) === 1);
      };
      window.addEventListener("pointermove", move, { passive: true });
      off.push(() => window.removeEventListener("pointermove", move));

      const probe: GroundProbe = {
        frames: () => h.frames,
        trailAt: (wx, wy) => {
          const vp = useUiStore.getState().viewport;
          const g = toGround(h.currentView, wx * vp.scale + vp.tx, wy * vp.scale + vp.ty);
          return h.trailValue(g.x, g.y);
        },
      };
      (canvas as HTMLCanvasElement & { groundProbe?: GroundProbe }).groundProbe = probe;
    }, () => {
      if (!gone) setStill(true);
    });

    return () => {
      gone = true;
      for (const f of off) f();
      host?.dispose();
    };
  }, [theme, pinned]);

  if (isStill) return <>{still}</>;
  return (
    <div className={`canvas-theme canvas-theme-${theme}`}>
      <canvas ref={ref} className="ground-canvas" aria-hidden="true" />
    </div>
  );
}
