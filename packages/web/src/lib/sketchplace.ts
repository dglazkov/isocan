import type { Actor, CanvasContents, InkStroke } from "@isocan/core";
import { annotationTargetFor, inkBounds } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { showingSketch } from "./sketch.ts";
import { addDrawing } from "./upload.ts";

/**
 * The half of `sketch.ts` that places ink, loaded the first time there is ink
 * to place (cleanup RH-2, 27 Sep 2026: queueing the commits and keeping failed
 * ink for its own canvas cost 432 bytes, and a first visit that never draws
 * should not download them). Only `sketch.ts` reaches this file, and only
 * through `import()` — a static import anywhere would put it back in the entry
 * chunk and leave the wrapper as pure cost.
 */

/** Strokes a commit has taken and not yet settled: each is placed by exactly
 * one commit, so the idle timer, ⏎ and leaving — which can all fire within a
 * few hundred ms of each other — never upload the same ink twice. */
const taken = new Set<InkStroke>();
/** Commits run one after another instead of refusing each other (cleanup
 * RH-2, 27 Sep 2026). Refusing was how ink drawn during an upload outlived
 * leaving the canvas: the leave was turned away, the strokes stayed wet into
 * the next canvas, and ITS settle timer placed them there. */
let queue: Promise<unknown> = Promise.resolve();
/** Ink that failed to place, and why, until its canvas is showing to say so.
 * Ink whose canvas was left cannot stay on screen (that screen is another
 * canvas's now), so it waits here for its own. */
const stranded = new Map<string, { strokes: InkStroke[]; error: string }>();

export async function commitSketch(canvasId: string, actor: Actor, ink: InkStroke[]): Promise<string | null> {
  // Everything up to `return` runs in the caller's tick, so nothing else can
  // take these strokes in between.
  const strokes = ink.filter((stroke) => !taken.has(stroke));
  if (strokes.length === 0) return null;
  for (const stroke of strokes) taken.add(stroke);
  // Read now, not when the queue reaches it — and only if the store still
  // holds this canvas (a leave's first load can outlast the next canvas's
  // connect): ink drawn on A must not annotate an item on B.
  const open = useCanvasStore.getState();
  const run = queue
    .then(() => place(canvasId, actor, strokes, open.canvasId === canvasId ? open.canvas : null))
    .catch((err: Error) => {
      // A failure leaves the ink in front of the canvas it belongs to, saying
      // why: at once if that canvas is showing, on its next arrival if not.
      const { sketch } = useUiStore.getState();
      const gone = strokes.filter((stroke) => !sketch.includes(stroke));
      stranded.set(canvasId, { strokes: [...(stranded.get(canvasId)?.strokes ?? []), ...gone], error: err.message });
      restoreSketch(canvasId);
      throw err;
    })
    .finally(() => {
      for (const stroke of strokes) taken.delete(stroke);
    });
  queue = run.catch(() => {});
  return run;
}

/** Whatever failed to place on this canvas comes back into the sketch, saying
 * why — only while the canvas is the one showing, or it would be another's. */
export function restoreSketch(canvasId: string): void {
  const kept = stranded.get(canvasId);
  if (!kept || showingSketch() !== canvasId) return;
  stranded.delete(canvasId);
  const ui = useUiStore.getState();
  for (const stroke of kept.strokes) ui.beginStroke(stroke);
  ui.setSketchError(kept.error);
}

async function place(canvasId: string, actor: Actor, strokes: InkStroke[], canvas: CanvasContents | null): Promise<string> {
  // Ink drawn over something is ABOUT that something: an annotation, which can
  // be pointed at, acted on, and cleared. Ink on bare canvas is just a drawing.
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
  // stays wet and becomes the next drawing. Dropped WHEREVER the tab is now
  // (cleanup RH-2, 27 Sep 2026): these strokes are an item on `canvasId` from
  // the moment the op landed, and returning before this line — as it once did
  // for a person who left within the settle window — left them wet for the
  // next canvas's settle timer or leave handler to place again, there.
  const placed = new Set(strokes);
  useUiStore.setState((s) => ({ sketch: s.sketch.filter((stroke) => !placed.has(stroke)) }));
  // What follows is about the screen, and only the canvas it was drawn on
  // has the item to select or the target to comment on.
  if (useCanvasStore.getState().canvasId !== canvasId) return itemId;
  useUiStore.getState().select(itemId);
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

/** The lazy half of `placeSketch`. `left` is the ink a leave took from the
 * sketch; without it this is the settle timer, ⏎ or Retry, which place what is
 * wet now — unless the canvas was left while this module loaded, in which case
 * the leave already took its ink, and what is wet now belongs to the next one. */
export function placeInk(canvasId: string, actor: Actor, left: InkStroke[] | null): void {
  if (!left && showingSketch() !== canvasId) return;
  void commitSketch(canvasId, actor, left ?? useUiStore.getState().sketch).then(
    () => showingSketch() === canvasId && useUiStore.getState().setSketchError(null),
    (err: Error) => console.error("could not place the drawing", err),
  );
}
