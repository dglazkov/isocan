import type { Actor, InkStroke } from "@isocan/core";
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

export async function commitSketch(projectId: string, actor: Actor): Promise<string | null> {
  const strokes = useUiStore.getState().sketch;
  // A commit already running owns these strokes — a second one would upload
  // the same ink again and land a duplicate item. (The idle timer, ⏎, and
  // leaving the canvas can all fire within a few hundred ms of each other.)
  if (inFlight || strokes.length === 0) return null;
  inFlight = true;
  try {
    return await place(projectId, actor, strokes);
  } finally {
    inFlight = false;
  }
}

async function place(projectId: string, actor: Actor, strokes: InkStroke[]): Promise<string> {
  const itemId = await addDrawing(projectId, actor, strokes);
  // Only drop what we placed: a stroke drawn while the upload was in flight
  // stays wet and becomes the next drawing.
  const { sketch, clearSketch, beginStroke, select } = useUiStore.getState();
  const placed = new Set(strokes);
  const survivors = sketch.filter((stroke) => !placed.has(stroke));
  clearSketch();
  for (const stroke of survivors) beginStroke(stroke);
  select(itemId);
  return itemId;
}

/** Place the ink from a caller with nowhere to await — the settle timer, ⏎,
 * leaving the canvas. A failure leaves the strokes on screen and says so, so
 * ink is never lost to a dropped daemon. */
export function placeSketch(projectId: string, actor: Actor): void {
  void commitSketch(projectId, actor)
    .then(() => useUiStore.getState().setSketchError(null))
    .catch((err: Error) => {
      console.error("could not place the drawing", err);
      useUiStore.getState().setSketchError(err.message);
    });
}
