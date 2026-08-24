import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { worldToScreen, threadWorldPos } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor, spreadOverlaps, statusLine } from "../lib/presence.ts";

const LERP_HUMAN = 0.22; // real cursors track tightly
const LERP_AGENT = 0.11; // CLI hops glide slower so they read as deliberate motion
const WANDER_LERP = 0.07; // slower, deliberate drift while "working"
const SNAP_DISTANCE = 1600; // world units — teleport instead of gliding across the map

interface Anim {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Next waypoint decision, ms timestamp (wander only). */
  nextAt: number;
}

/**
 * Remote cursors, Figma-style: pointer + name chip + optional status line,
 * screen-space, eased client-side toward each session's latest position.
 *
 * Sessions with a "working" activity get simulated motion rendered entirely
 * here: the cursor wanders the item's bounds with human-ish waypoints,
 * thinking pauses, and micro-stutter. The daemon only stores the fact of
 * working — every client animates it locally at 60fps with zero traffic.
 */
export function CursorLayer() {
  const colors = useActorColors();
  const sessions = useCanvasStore((s) => s.sessions);
  const viewport = useUiStore((s) => s.viewport);
  const animated = useRef(new Map<string, Anim>());
  const [, force] = useState(0);

  const visible = sessions.filter(
    (session) => session.cursor !== null || session.activity !== null,
  );

  useEffect(() => {
    if (visible.length === 0) return;
    let raf = 0;
    const step = () => {
      const now = performance.now();
      const { sessions: current, canvas } = useCanvasStore.getState();
      const live = new Set<string>();
      let moving = false;

      // Stacked cursors — everyone the same summons landed on one thread —
      // fan out so each face stays visible. Working sessions are excluded:
      // their wander already tells them apart.
      const stillTargets = new Map<string, { x: number; y: number }>();
      for (const session of current) {
        if (session.cursor && session.activity?.kind !== "working") {
          stillTargets.set(session.sessionId, session.cursor);
        }
      }
      const spread = spreadOverlaps(stillTargets);

      for (const session of current) {
        // Wander area: the anchored item's bounds, or a synthetic patch
        // around a freestanding work point.
        let workingBounds: { x: number; y: number; width: number; height: number } | undefined;
        if (session.activity?.kind === "working") {
          if ("itemId" in session.activity) {
            workingBounds = canvas?.items[session.activity.itemId];
          } else if ("threadId" in session.activity) {
            // Around the pin: the thread is what they are working ON.
            const thread = canvas?.threads[session.activity.threadId];
            const at = thread && canvas ? threadWorldPos(canvas, thread) : null;
            if (at) workingBounds = { x: at.x - 90, y: at.y - 60, width: 180, height: 120 };
          } else {
            workingBounds = {
              x: session.activity.x - 110,
              y: session.activity.y - 75,
              width: 220,
              height: 150,
            };
          }
        }
        if (!session.cursor && !workingBounds) continue;
        live.add(session.sessionId);

        const home = spread.get(session.sessionId) ??
          session.cursor ?? {
            x: workingBounds!.x + workingBounds!.width / 2,
            y: workingBounds!.y + workingBounds!.height / 2,
          };
        let rec = animated.current.get(session.sessionId);
        if (!rec || Math.hypot(home.x - rec.x, home.y - rec.y) > SNAP_DISTANCE) {
          rec = { x: home.x, y: home.y, tx: home.x, ty: home.y, nextAt: 0 };
          animated.current.set(session.sessionId, rec);
        }

        if (workingBounds) {
          if (now >= rec.nextAt) {
            if (Math.random() < 0.22) {
              // thinking pause — hold position a beat
              rec.nextAt = now + 500 + Math.random() * 900;
            } else {
              // next waypoint: biased toward the item's edges and corners
              const pad = 12;
              const t = Math.random();
              const along = Math.random();
              const w = workingBounds.width + pad * 2;
              const h = workingBounds.height + pad * 2;
              const ox = workingBounds.x - pad;
              const oy = workingBounds.y - pad;
              if (t < 0.7) {
                // edge band
                const edge = Math.floor(Math.random() * 4);
                rec.tx = edge < 2 ? ox + along * w : edge === 2 ? ox : ox + w;
                rec.ty = edge === 0 ? oy : edge === 1 ? oy + h : oy + along * h;
              } else {
                // interior point
                rec.tx = ox + 0.15 * w + Math.random() * 0.7 * w;
                rec.ty = oy + 0.15 * h + Math.random() * 0.7 * h;
              }
              rec.nextAt = now + 350 + Math.random() * 900;
            }
          }
        } else {
          rec.tx = home.x;
          rec.ty = home.y;
        }

        const rate = workingBounds ? WANDER_LERP : session.kind === "web" ? LERP_HUMAN : LERP_AGENT;
        const dx = rec.tx - rec.x;
        const dy = rec.ty - rec.y;
        if (Math.hypot(dx, dy) > 0.5) {
          rec.x += dx * rate;
          rec.y += dy * rate;
          // micro-stutter while working — a hand, not a tween
          if (workingBounds) {
            rec.x += (Math.random() - 0.5) * 0.9;
            rec.y += (Math.random() - 0.5) * 0.9;
          }
          moving = true;
        } else if (workingBounds) {
          moving = true; // keep the loop alive through pauses
        }
      }

      for (const key of animated.current.keys()) {
        if (!live.has(key)) animated.current.delete(key);
      }
      if (moving) force((n) => n + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible.length]);

  // A quiet agent produces no roster traffic and no motion, so nothing above
  // would re-render — tick slowly to keep "quiet 40s" aging honestly.
  useEffect(() => {
    if (visible.length === 0) return;
    const timer = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(timer);
  }, [visible.length]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 25 }}>
      {visible.map((session) => {
        const rec = animated.current.get(session.sessionId);
        const fallback = session.cursor;
        if (!rec && !fallback) return null;
        const pos = rec ?? fallback!;
        const screen = worldToScreen(viewport, pos.x, pos.y);
        const color = actorColorIn(colors, session.actor.id);
        const name = session.label ?? session.actor.name;
        // Say only what we know: the session's status if it has one, and
        // for how long it has been quiet once it goes silent — a thinking
        // agent must not look frozen, but we never invent a verb for it.
        const quiet = quietFor(session);
        const line = [statusLine(session), quiet && `quiet ${quiet}`]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={session.sessionId}
            className={`remote-cursor${quiet ? " quiet" : ""}`}
            style={{ left: screen.x, top: screen.y }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20">
              <path d="M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z" fill={color} strokeWidth="1" />
            </svg>
            <span className="cursor-chip" style={{ background: color }}>
              {name}
              {line && <em>{line}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
