import type { Actor } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * Ink → a canvas item. Strokes are local for the moment it takes to lift the
 * pen and settle (CanvasViewport arms the timer); placing them is an ordinary
 * `item.add`, so from that moment the drawing belongs to everyone — the web
 * app, the CLI, undo, the oplog. Nobody has to ask for that to happen.
 *
 * The strokes are cleared only once the op lands. Until then the ink layer
 * keeps showing them, so a failed upload leaves the drawing on screen instead
 * of swallowing it.
 *
 * This file is the eager half: what has to happen in the caller's own tick —
 * which canvas is showing, and what a leave takes with it. The placing itself
 * is `sketchplace.ts`, loaded the first time there is ink to place.
 */

/** The canvas whose ink is on screen — set on arrival, cleared on leaving. */
let showing: string | null = null;
export const showingSketch = (): string | null => showing;

let placing: Promise<typeof import("./sketchplace.ts")> | undefined;
const loadPlacing = () => (placing ??= import("./sketchplace.ts"));

/** Place the ink from a caller with nowhere to await — the settle timer, ⏎,
 * leaving the canvas. A failure leaves the strokes on screen and says so, so
 * ink is never lost to a dropped daemon.
 *
 * **Leaving takes all of the canvas's ink with it, to that canvas** (cleanup
 * RH-2, 27 Sep 2026): the sketch is emptied HERE, in the leave's own tick, so
 * the next canvas starts with none of it whether or not the placing half has
 * loaded — and a strand of ink still uploading is dropped too, because its own
 * commit places it where it was drawn. What either one says when it settles
 * is said only while its canvas is the one showing. */
export function placeSketch(canvasId: string, actor: Actor, leaving = false): void {
  const { sketch } = useUiStore.getState();
  if (leaving) {
    showing = null;
    useUiStore.setState({ sketch: [] });
  }
  if (sketch.length) void loadPlacing().then((m) => m.placeInk(canvasId, actor, leaving ? sketch : null));
}

/** A canvas came on screen: its ink is the one being drawn, and whatever
 * failed to place after it was last left comes back, saying why. Nothing can
 * have failed before the placing half loaded, so there is nothing to load. */
export function arriveSketch(canvasId: string): void {
  showing = canvasId;
  void placing?.then((m) => m.restoreSketch(canvasId));
}
