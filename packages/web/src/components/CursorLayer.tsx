import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { worldToScreen } from "../lib/viewport.ts";
import { actorColor } from "../lib/colors.ts";

const LERP = 0.22;
const SNAP_DISTANCE = 800; // world units — teleport instead of gliding across the map

/**
 * Remote cursors, Figma-style: pointer + name chip + optional status line,
 * screen-space, eased client-side toward each session's latest position so
 * even sparse CLI waypoints read as motion.
 */
export function CursorLayer() {
  const sessions = useCanvasStore((s) => s.sessions);
  const viewport = useUiStore((s) => s.viewport);
  const animated = useRef(new Map<string, { x: number; y: number }>());
  const [, force] = useState(0);

  const withCursor = sessions.filter((session) => session.cursor !== null);

  useEffect(() => {
    if (withCursor.length === 0) return;
    let raf = 0;
    const step = () => {
      const current = useCanvasStore.getState().sessions;
      const live = new Set<string>();
      let moving = false;
      for (const session of current) {
        if (!session.cursor) continue;
        live.add(session.sessionId);
        const target = session.cursor;
        const pos = animated.current.get(session.sessionId);
        if (!pos || Math.hypot(target.x - pos.x, target.y - pos.y) > SNAP_DISTANCE) {
          animated.current.set(session.sessionId, { ...target });
          moving = true;
          continue;
        }
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        if (Math.hypot(dx, dy) > 0.5) {
          pos.x += dx * LERP;
          pos.y += dy * LERP;
          moving = true;
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
  }, [withCursor.length]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 25 }}>
      {withCursor.map((session) => {
        const pos = animated.current.get(session.sessionId) ?? session.cursor!;
        const screen = worldToScreen(viewport, pos.x, pos.y);
        const color = actorColor(session.actor.id);
        const name = session.label ?? session.actor.name;
        return (
          <div
            key={session.sessionId}
            className="remote-cursor"
            style={{ left: screen.x, top: screen.y }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20">
              <path d="M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z" fill={color} stroke="#fff" strokeWidth="1" />
            </svg>
            <span className="cursor-chip" style={{ background: color }}>
              {name}
              {session.status && <em>{session.status}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
