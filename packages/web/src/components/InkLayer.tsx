import type { Actor } from "@isocan/core";
import { inkBounds, inkPath } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { placeSketch } from "../lib/sketch.ts";

/**
 * Wet ink — strokes the Pen has laid down that are not an item yet. It lives
 * inside `.world`, so the strokes are drawn in world coordinates and the
 * canvas transform pans and zooms them exactly as it will once they dry.
 *
 * The layer is sized to the ink's own world bounding box — the very box the
 * placed item will occupy — and its viewBox is that same box, so a point's
 * world coordinates are its coordinates here. Sizing it matters: SVG treats a
 * zero width or height on the root as "do not render this element", so a
 * 0×0 coordinate space with visible overflow lays out and measures correctly
 * and then paints nothing at all.
 */
export function InkLayer() {
  const sketch = useUiStore((s) => s.sketch);
  const bounds = inkBounds(sketch);
  if (!bounds) return null;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return (
    <svg
      className="ink-layer"
      aria-hidden
      style={{ left: bounds.minX, top: bounds.minY, width, height }}
      viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
    >
      {sketch.map((stroke, i) => (
        <path
          key={i}
          d={inkPath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * The bar under the canvas, in the two states where ink needs a word.
 *
 * HOLDING P: the ink is being kept open on purpose, so say so and count what
 * is riding on it. Nothing is shown for an ordinary drawing — strokes simply
 * become an item a moment after you lift the pen — but a mode you cannot see
 * is a mode you will not trust with twenty strokes.
 *
 * FAILED: the placement did not land. The ink is still on screen, still yours,
 * and one button away from another try.
 */
export function SketchBar({ projectId, actor }: { projectId: string; actor: Actor }) {
  const colors = useActorColors();
  const error = useUiStore((s) => s.sketchError);
  const strokes = useUiStore((s) => s.sketch.length);
  const inkColor = useUiStore((s) => s.inkColor);
  const session = useUiStore((s) => s.penSession);
  const dot = inkColor ?? actorColorIn(colors, actor.id);
  if (session && !error) {
    return (
      <div className="sketch-bar">
        <span className="sketch-dot sketch-dot-live" style={{ background: dot }} />
        <span className="sketch-label">
          {strokes === 0
            ? "one drawing — keep holding P"
            : `one drawing · ${strokes} stroke${strokes === 1 ? "" : "s"} — let go of P to place it`}
        </span>
      </div>
    );
  }
  if (!error || strokes === 0) return null;
  return (
    <div className="sketch-bar">
      <span className="sketch-dot" style={{ background: dot }} />
      <span className="sketch-label">
        couldn't place this drawing — {error}
      </span>
      <button
        className="btn primary"
        title="Try to place the drawing again"
        onClick={() => placeSketch(projectId, actor)}
      >
        Retry
      </button>
      <button
        className="btn"
        title="Throw this ink away"
        onClick={() => useUiStore.getState().clearSketch()}
      >
        Discard
      </button>
    </div>
  );
}
