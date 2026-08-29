import type { Viewport } from "./viewport.ts";
import { type DockState, dockEdges } from "./stage.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Opening the rail pans the canvas. It does not reflow it.**
 *
 * The rail floats above the canvas, so nothing about the layout changes when
 * it opens and no item moves. What DOES change is which part of the canvas a
 * person can see: a 344px strip down the left goes behind frosted glass. The
 * old behaviour was to let it — you opened the Chat and whatever you were
 * reading went under it.
 *
 * So the camera slides by exactly the strip's width, and what you were
 * looking at comes out from under the rail instead of being covered by it.
 * Closing pans back to exactly where you were.
 *
 * That is the difference a docked column cannot offer. Docking TAKES width
 * from the canvas; floating BORROWS a pan, and gives it back.
 *
 * **The distance is `dockEdges`, never a fresh measurement.** What the rail
 * occupies is already derived in one place, for framing and for the stage
 * rect, and a second derivation here is how the pan and the framing would
 * come to disagree about the same rail. It also means the cases nobody
 * thinks about answer themselves: swapping Chat for Files changes no width,
 * so the delta is zero and the canvas does not twitch; widening a CLOSED
 * rail moves nothing, because a closed rail occupies nothing.
 */
export function railPan(before: DockState, after: DockState): number {
  return dockEdges(after).left - dockEdges(before).left;
}

/**
 * `followViewport`, not `setViewport`.
 *
 * Every `setViewport` caller is a person taking the wheel — a wheel, a drag,
 * a zoom button, a jump — and it drops follow mode for exactly that reason.
 * Opening a panel is not taking the wheel. Someone watching a colleague move
 * around a canvas who opens the Chat to ask them a question should still be
 * watching them afterwards; dropping follow here would make the Chat button
 * a "stop following" button that does not say so.
 */
function pan(dx: number, viewport: Viewport): void {
  useUiStore.getState().followViewport({ ...viewport, tx: viewport.tx + dx });
}

/**
 * Pan for a dock change that has ALREADY been applied to the store — capture
 * the state before you touch it, call this after.
 *
 * Reading `after` from the store rather than taking it as an argument is
 * deliberate: it is the state that actually landed, including any clamping
 * the setter did on the way through, so the pan can never be computed from a
 * width the panel did not end up with.
 */
export function panForDockChange(before: DockState, durationMs = 0): void {
  const ui = useUiStore.getState();
  const dx = railPan(before, ui);
  if (dx === 0) return;
  if (durationMs <= 0 || skipAnimation()) {
    pan(dx, ui.viewport);
    return;
  }
  glidePan(dx, durationMs);
}

/**
 * Two reasons to skip the animation, and the second one is not an
 * accessibility setting.
 *
 * A hidden tab cannot see an animation, and somebody who asked for less motion
 * has asked for this one too.
 *
 * The hidden-tab half used to matter far more than it does: when this eased
 * in a `requestAnimationFrame` loop, a pan started in a hidden tab STOPPED
 * half-applied and finished whenever the tab was next brought forward.
 * Handing the motion to CSS removed that failure at the root — the viewport
 * now moves in one update and the transition is decoration — so this is a
 * courtesy rather than a guard against a stall. It stays because animating
 * for somebody who cannot see it is still pointless.
 */
function skipAnimation(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof document !== "undefined" && document.hidden) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * **The eased version, for the one-step cases: opening and closing.**
 *
 * A drag does NOT come through here. While the resizer is under a hand the
 * pan has to track it frame for frame — an ease would make the canvas trail
 * the edge and settle a fifth of a second after the person stopped, which is
 * the same complaint the minimap's `resizing-panel` rule already answers.
 *
 * **CSS, not `requestAnimationFrame`, and that is the whole fix.**
 *
 * The first version stepped `tx` in a rAF loop. Every frame was a React
 * render of the entire canvas — and it ran at exactly the moment the Chat
 * panel was mounting, with its markdown and its message list. The two
 * competed, frames were dropped, and the canvas arrived in four or five
 * visible jumps. Reported as "a janky jumpy move in chunks vs a smooth
 * animation", which is precisely what a dropped-frame animation looks like.
 *
 * A transform transition is handled by the compositor. The viewport moves in
 * ONE state update, the browser animates the layer, and the panel can take as
 * long as it likes to mount without the motion knowing about it. The class
 * comes off when the transition is done so that panning and zooming — which
 * must never lag the hand — are untouched.
 */
function glidePan(dx: number, durationMs: number): void {
  const ui = useUiStore.getState();
  ui.setRailPanning(true);
  pan(dx, ui.viewport);
  clearTimeout(settling);
  settling = setTimeout(() => useUiStore.getState().setRailPanning(false), durationMs + 40);
}

let settling: ReturnType<typeof setTimeout> | undefined;

/** How long the one-step open/close pan takes. Matches the rail's own CSS
 *  transition, so the panel and the canvas arrive together. */
export const RAIL_PAN_MS = 180;
