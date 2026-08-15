import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { itemsBounds, screenToWorld, type Box } from "../lib/viewport.ts";

const MAP_W = 168;
const MAP_H = 108;
const PAD = 8;

/** Full-canvas preview: item rects + the current viewport rectangle. Click or
 * drag to move the view. */
export function Minimap() {
  const canvas = useCanvasStore((s) => s.canvas);
  const viewport = useUiStore((s) => s.viewport);
  if (!canvas) return null;

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
  );
}
