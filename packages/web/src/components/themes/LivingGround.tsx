import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CanvasTheme, ThemeAnchor } from "@isocan/core";
import { useCanvasStore } from "../../stores/canvasStore.ts";
import { useUiStore } from "../../stores/uiStore.ts";
import { groundView, itemRects, toGround } from "../../lib/groundfield.ts";
import { groundCursors } from "../../lib/groundcursors.ts";
import { isAgentActor, useActorKinds } from "../../lib/actorkinds.ts";
import { currentMotion, onMotion } from "../../lib/groundmotion.ts";
import type { LivingGround as Ground } from "./livingkit.ts";
import { GroundHost } from "./GroundHost.ts";
import "./meadow.css";

/**
 * **A ground that moves** (living grounds phase 1).
 *
 * The React half of the living layer, and deliberately thin: it mounts one
 * canvas, starts a `GroundHost` on it, and wires the host to what the browser
 * already knows — the viewport, the items, this viewer's pointer and every
 * presence cursor CursorLayer draws (people and agents, phase 2). None of
 * those reach React state; each is a subscription that writes into the host,
 * so panning a meadow re-renders nothing.
 *
 * Loaded only by `CanvasThemeLayer`, only for a living theme, and only when
 * reduced motion is off — so a canvas on any other ground, and a viewer who
 * asked for stillness, download none of this. A viewer who chose Motion ▸
 * Still in the menu (phase 4) gets this module and its still, but never a
 * WebGL context or a ground's chunk: the choice is read here, not in the
 * entry chunk, so it costs a first visit nothing.
 *
 * When the host gives up (no WebGL2, a shader that will not compile, a context
 * lost twice) it says so once, and this renders `still` instead: the ground's
 * painted still frame, which is the same field at rest.
 */

/** Each ground is its own chunk, fetched only by a canvas wearing it. */
const GROUNDS: Partial<Record<CanvasTheme, () => Promise<Ground>>> = {
  meadow: () => import("./meadow.ts").then((m) => m.createMeadow()),
  night: () => import("./night.ts").then((m) => m.createNight()),
  // Orbit is how Galaxy is drawn (phases.md, 9 Oct): the stored theme stays
  // `galaxy`, so every canvas wearing it became living with no migration.
  galaxy: () => import("./orbit.ts").then((m) => m.createOrbit()),
  snow: () => import("./snow.ts").then((m) => m.createSnow()),
  aurora: () => import("./aurora.ts").then((m) => m.createAurora()),
  pond: () => import("./pond.ts").then((m) => m.createPond()),
  zen: () => import("./zen.ts").then((m) => m.createZen()),
};

/** What the `meadow` journey reads off the canvas element. */
export interface GroundProbe {
  frames: () => number;
  trailAt: (worldX: number, worldY: number) => number;
  /** Is this viewer's pointer resting over the ground, and is its button
   *  held — the eddy window's and the reversal's inputs (the `orbit` journey). */
  resting: () => boolean;
  held: () => boolean;
  /** The ground's own readback near a canvas-relative screen point. */
  near: (sx: number, sy: number, r: number) => { count: number; radial: number } | null;
  /** Night's woken fireflies right now (0 on any other ground). */
  fireflies: () => number;
  /** Snow's pack at a world point, 0..1: how trodden, read back from its own
   *  texture, which outlives the host's trail (0 on any other ground). */
  trodden: (worldX: number, worldY: number) => number;
  /** Aurora's lean over a canvas-relative screen column (0 on any other ground). */
  lean: (sx: number) => number;
}

export function LivingGround({ theme, anchor, still }: { theme: CanvasTheme; anchor: ThemeAnchor; still: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [isStill, setStill] = useState(false);
  const pinned = anchor === "window";
  // This viewer's Motion (phase 4): Still is the painted still and no WebGL
  // at all; Calm and Full differ only in what the host hands the ground.
  const motion = useSyncExternalStore(onMotion, currentMotion);
  // Who is an agent, for `AGENT_WEIGHT` — the same recorded fact the cursor's
  // mark reads. A ref, so a late answer does not restart the ground.
  const kinds = useActorKinds();
  const kindsRef = useRef(kinds);
  useEffect(() => {
    kindsRef.current = kinds;
  }, [kinds]);

  useEffect(() => {
    if (motion === "still") return;
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
      host = new GroundHost(canvas, ground, { onStill: () => setStill(true), motion });
      const h = host;
      const viewOf = () => groundView(useUiStore.getState().viewport, pinned);
      const items = () => {
        const s = useCanvasStore.getState();
        const contents = s.past?.canvas ?? s.canvas;
        const list = contents ? Object.values(contents.items) : [];
        const ids: string[] = [];
        const rects = itemRects(list, useUiStore.getState().viewport, viewOf(), canvas.clientWidth, canvas.clientHeight, undefined, ids);
        h.setItems(rects, ids);
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
      let held = false;
      const move = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) {
          h.rest(false);
          return;
        }
        const dist = Number.isNaN(lastX) ? 0 : Math.hypot(sx - lastX, sy - lastY);
        lastX = sx;
        lastY = sy;
        const wasHeld = held;
        held = (e.buttons & 1) === 1;
        // The browser's own move after a load or a layout goes nowhere: it
        // says where the pointer is (kept above, for a press) but is not a
        // hand on the canvas, so it wakes nothing — under Calm an untouched
        // ground must draw nothing at all.
        if (dist === 0 && held === wasHeld) return;
        const at = toGround(h.currentView, sx, sy);
        h.pointer("self", at.x, at.y, dist, held);
        // Resting needs a real move first: the browser's own synthetic move
        // after a layout (distance 0) is not a hand on the canvas.
        if (dist > 0) h.rest(true);
      };
      window.addEventListener("pointermove", move, { passive: true });
      off.push(() => window.removeEventListener("pointermove", move));
      // A press or release with no move still changes the pull (Orbit's held
      // button reverses it), so both feed the pointer where it already is.
      const press = (e: PointerEvent) => {
        if (Number.isNaN(lastX)) return;
        held = (e.buttons & 1) === 1;
        const at = toGround(h.currentView, lastX, lastY);
        h.pointer("self", at.x, at.y, 0, held);
      };
      window.addEventListener("pointerdown", press, { passive: true });
      window.addEventListener("pointerup", press, { passive: true });
      off.push(() => window.removeEventListener("pointerdown", press));
      off.push(() => window.removeEventListener("pointerup", press));
      // The pointer left the window, or the window lost focus: not resting.
      const leave = (e: PointerEvent) => {
        if (!e.relatedTarget) h.rest(false);
      };
      const blur = () => h.rest(false);
      document.addEventListener("pointerout", leave, { passive: true });
      window.addEventListener("blur", blur);
      off.push(() => document.removeEventListener("pointerout", leave));
      off.push(() => window.removeEventListener("blur", blur));

      // Every presence cursor CursorLayer draws, at the world point it has
      // eased to. Nothing new is sent: these are positions this tab already
      // holds, from presence updates it already receives.
      const feed = (sid: string, at: { x: number; y: number } | null) => {
        if (!at) return h.forget(sid);
        const vp = useUiStore.getState().viewport;
        const g = toGround(h.currentView, at.x * vp.scale + vp.tx, at.y * vp.scale + vp.ty);
        const session = useCanvasStore.getState().sessions.find((s) => s.sessionId === sid);
        h.presence(sid, g.x, g.y, !!session && isAgentActor(kindsRef.current, session.actor.id));
      };
      groundCursors.feed = feed;
      off.push(() => {
        if (groundCursors.feed === feed) groundCursors.feed = null;
      });

      const probe: GroundProbe = {
        frames: () => h.frames,
        trailAt: (wx, wy) => {
          const vp = useUiStore.getState().viewport;
          const g = toGround(h.currentView, wx * vp.scale + vp.tx, wy * vp.scale + vp.ty);
          return h.trailValue(g.x, g.y);
        },
        resting: () => h.isResting,
        held: () => held,
        near: (sx, sy, r) => h.readback(sx, sy, r),
        fireflies: () => (ground as Ground & { flies?: () => number }).flies?.() ?? 0,
        trodden: (wx, wy) => {
          const vp = useUiStore.getState().viewport;
          const g = toGround(h.currentView, wx * vp.scale + vp.tx, wy * vp.scale + vp.ty);
          return (ground as Ground & { trodden?: (x: number, y: number) => number }).trodden?.(g.x, g.y) ?? 0;
        },
        lean: (sx) => (ground as Ground & { lean?: (x: number) => number }).lean?.(sx) ?? 0,
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
  }, [theme, pinned, motion]);

  if (isStill || motion === "still") return <>{still}</>;
  return (
    <div className={`canvas-theme canvas-theme-${theme}`}>
      <canvas ref={ref} className="ground-canvas" aria-hidden="true" />
    </div>
  );
}
