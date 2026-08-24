import type { Actor, InkStroke } from "@isocan/core";
import { annotationTargetFor, inkBounds } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { addDrawing } from "./upload.ts";

/**
 * Ink → a canvas item. Strokes are local for the moment it takes to lift the
 * pen and settle (CanvasViewport arms the timer); placing them is an ordinary
 * `item.add`, so from that moment the drawing belongs to everyone — the web
 * app, the CLI, undo, the oplog. Nobody has to ask for that to happen.
 *
 * The strokes are cleared only once the op lands. Until then the ink layer
 * keeps showing them, so a failed upload leaves the drawing on screen instead
 * of swallowing it.
 */
let inFlight = false;

export async function commitSketch(canvasId: string, actor: Actor): Promise<string | null> {
  const strokes = useUiStore.getState().sketch;
  // A commit already running owns these strokes — a second one would upload
  // the same ink again and land a duplicate item. (The idle timer, ⏎, and
  // leaving the canvas can all fire within a few hundred ms of each other.)
  if (inFlight || strokes.length === 0) return null;
  inFlight = true;
  try {
    return await place(canvasId, actor, strokes);
  } finally {
    inFlight = false;
  }
}

async function place(canvasId: string, actor: Actor, strokes: InkStroke[]): Promise<string> {
  // Ink drawn over something is ABOUT that something: an annotation, which can
  // be pointed at, acted on, and cleared. Ink on bare canvas is just a drawing.
  const canvas = useCanvasStore.getState().canvas;
  const bounds = inkBounds(strokes);
  const target =
    canvas && bounds
      ? annotationTargetFor(
          { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY },
          Object.values(canvas.items),
        )
      : null;
  const itemId = await addDrawing(canvasId, actor, strokes, target);
  // Only drop what we placed: a stroke drawn while the upload was in flight
  // stays wet and becomes the next drawing.
  const { sketch, clearSketch, beginStroke, select } = useUiStore.getState();
  const placed = new Set(strokes);
  const survivors = sketch.filter((stroke) => !placed.has(stroke));
  clearSketch();
  for (const stroke of survivors) beginStroke(stroke);
  select(itemId);
  // An annotation is half a sentence until you say what it means, so the
  // composer opens on the spot — anchored to the TARGET, so an agent parked on
  // that item hears it, and dismissable with Escape if the ink says enough.
  if (target && bounds) {
    useUiStore.getState().setPendingComment({
      x: (bounds.minX + bounds.maxX) / 2 - target.x,
      y: bounds.minY - target.y,
      anchorItemId: target.id,
      aboutItemId: itemId,
    });
  }
  return itemId;
}

/** Place the ink from a caller with nowhere to await — the settle timer, ⏎,
 * leaving the canvas. A failure leaves the strokes on screen and says so, so
 * ink is never lost to a dropped daemon. */
export function placeSketch(canvasId: string, actor: Actor): void {
  void commitSketch(canvasId, actor)
    .then(() => useUiStore.getState().setSketchError(null))
    .catch((err: Error) => {
      console.error("could not place the drawing", err);
      useUiStore.getState().setSketchError(err.message);
    });
}
