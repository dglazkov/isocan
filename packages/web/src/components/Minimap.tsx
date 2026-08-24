import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { itemsBounds, screenToWorld, type Box } from "../lib/viewport.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor, sessionLocus } from "../lib/presence.ts";


const MAP_W = 168;
const MAP_H = 108;
const PAD = 8;

/**
 * Full-canvas preview: item rects, everyone's presence dot, and the current
 * viewport rectangle. Click or drag to move the view.
 *
 * It folds away into its corner for anyone who would rather have the canvas:
 * the map slides down and out, leaving a small handle anchored where it was,
 * and the handle slides it back. The choice is remembered per browser.
 */
export function Minimap() {
  const colors = useActorColors();
  const open = useUiStore((s) => s.minimapOpen);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const viewport = useUiStore((s) => s.viewport);
  const followSessionId = useUiStore((s) => s.followSessionId);
  // A docked panel takes the corner the map stands in, and a map behind a
  // panel is a control you cannot see or click. Same answer the edge radar
  // gives: stand at the wall the panel leaves, not at the window's.
  const panelOpen = useUiStore((s) => s.mainPanelOpen || s.filesPanelOpen);
  if (!canvas) return null;

  // Everyone with a place to stand — an on-call session has none.
  const standing = sessions.flatMap((session) => {
    const locus = sessionLocus(session, canvas);
    return locus ? [{ session, locus }] : [];
  });

  const itemBox = itemsBounds(canvas);
  // Viewport's world-space rectangle.
  const vpTopLeft = screenToWorld(viewport, 0, 0);
  const vpBottomRight = screenToWorld(viewport, window.innerWidth, window.innerHeight);
  const world: Box = itemBox
    ? {
        minX: Math.min(itemBox.minX, vpTopLeft.x),
        minY: Math.min(itemBox.minY, vpTopLeft.y),
        maxX: Math.max(itemBox.maxX, vpBottomRight.x),
        maxY: Math.max(itemBox.maxY, vpBottomRight.y),
      }
    : { minX: vpTopLeft.x, minY: vpTopLeft.y, maxX: vpBottomRight.x, maxY: vpBottomRight.y };
  // An agent working past the edge of everything must still land on the map —
  // that is the whole point of the dot (#39).
  for (const { locus } of standing) {
    world.minX = Math.min(world.minX, locus.x);
    world.minY = Math.min(world.minY, locus.y);
    world.maxX = Math.max(world.maxX, locus.x);
    world.maxY = Math.max(world.maxY, locus.y);
  }

  const scale = Math.min(
    (MAP_W - PAD * 2) / Math.max(world.maxX - world.minX, 1),
    (MAP_H - PAD * 2) / Math.max(world.maxY - world.minY, 1),
  );
  const mapX = (wx: number) => PAD + (wx - world.minX) * scale;
  const mapY = (wy: number) => PAD + (wy - world.minY) * scale;

  function centerViewAt(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - rect.left - PAD) / scale + world.minX;
    const wy = (e.clientY - rect.top - PAD) / scale + world.minY;
    const ui = useUiStore.getState();
    const vp = ui.viewport;
    ui.setViewport({
      ...vp,
      tx: window.innerWidth / 2 - wx * vp.scale,
      ty: window.innerHeight / 2 - wy * vp.scale,
    });
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    centerViewAt(e);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.buttons & 1) centerViewAt(e);
  }

  return (
    <div
      className={`minimap-dock${open ? "" : " folded"}`}
      style={{ left: (panelOpen ? panelWidth : 0) + 14 }}
    >
      <button
        className="minimap-handle"
        title="Show the minimap"
        aria-label="Show the minimap"
        aria-expanded={open}
        onClick={() => useUiStore.getState().setMinimapOpen(true)}
      >
        {MAP_GLYPH}
      </button>
      <div className="minimap-panel">
        <button
          className="minimap-fold"
          title="Hide the minimap"
          aria-label="Hide the minimap"
          onClick={() => useUiStore.getState().setMinimapOpen(false)}
        >
          ⌄
        </button>
        <svg
          className="minimap"
          width={MAP_W}
          height={MAP_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          {Object.values(canvas.items).map((item) => (
        <rect
          key={item.id}
          x={mapX(item.x)}
          y={mapY(item.y)}
          width={Math.max(item.width * scale, 2)}
          height={Math.max(item.height * scale, 2)}
          fill="#c6c9c0"
          rx={1}
        />
      ))}
          {standing.map(({ session, locus }) => (
        <circle
          key={session.sessionId}
          className={`minimap-dot${session.activity ? " working" : ""}${
            quietFor(session) ? " quiet" : ""
          }`}
          cx={mapX(locus.x)}
          cy={mapY(locus.y)}
          r={3}
          fill={actorColorIn(colors, session.actor.id)}
          stroke={session.sessionId === followSessionId ? "#1f3fd0" : "#fff"}
          strokeWidth={1.2}
        >
          <title>{session.label ?? session.actor.name}</title>
        </circle>
      ))}
          <rect
            x={mapX(vpTopLeft.x)}
            y={mapY(vpTopLeft.y)}
            width={(vpBottomRight.x - vpTopLeft.x) * scale}
            height={(vpBottomRight.y - vpTopLeft.y) * scale}
            fill="none"
            stroke="#1f3fd0"
            strokeWidth={1.5}
            rx={2}
          />
        </svg>
      </div>
    </div>
  );
}

const MAP_GLYPH = (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M1.5 4.2 5.8 2.4v9.4L1.5 13.6zM5.8 2.4l4.4 1.8v9.4L5.8 11.8zM10.2 4.2l4.3-1.8v9.4l-4.3 1.8z" />
  </svg>
);
