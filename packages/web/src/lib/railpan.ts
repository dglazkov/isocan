import type { Viewport } from "./viewport.ts";
import { type DockState, dockEdges } from "./stage.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { smoothEase } from "./zoomactions.ts";

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
 * `requestAnimationFrame` does not fire in a hidden tab. An eased pan started
 * while nobody is looking does not run slowly — it STOPS, half applied, and
 * finishes whenever the tab is next brought forward, so somebody returns to a
 * canvas that slides out from under them for no reason they can see. An
 * animation for a person who cannot see it is a delayed jump at best.
 *
 * Found by the harness rather than by reasoning: the browser pane these
 * phases are built in reports `document.hidden === true`, which is also why
 * phase 1's blur-under-motion number could never be taken there.
 */
function skipAnimation(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof document !== "undefined" && document.hidden) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

let panning = 0;

/**
 * The eased version, for the one-step cases: opening and closing.
 *
 * A drag does NOT come through here. While the resizer is under a hand the
 * pan has to track it frame for frame — an ease would make the canvas trail
 * the edge and settle a fifth of a second after the person stopped, which is
 * the same complaint the minimap's `resizing-panel` rule already exists to
 * answer.
 *
 * It cannot reuse `glideTo`: that animates toward an absolute target through
 * `setViewport`, and both halves are wrong here. This pans by a DELTA — the
 * person may pan or zoom mid-animation and their input must survive rather
 * than being overwritten by a target computed before they moved — and it goes
 * through `followViewport` so follow survives. The easing curve is shared, so
 * the two motions still feel like one app.
 */
function glidePan(dx: number, durationMs: number): void {
  cancelAnimationFrame(panning);
  const started = performance.now();
  let applied = 0;
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / durationMs);
    const target = dx * smoothEase(progress);
    const ui = useUiStore.getState();
    // The STEP, not the total: whatever else moved the camera this frame is
    // left alone, so a person who grabs the wheel mid-open keeps their pan.
    pan(target - applied, ui.viewport);
    applied = target;
    if (progress < 1) panning = requestAnimationFrame(step);
  };
  panning = requestAnimationFrame(step);
}

/** How long the one-step open/close pan takes. Matches the rail's own CSS
 *  transition, so the panel and the canvas arrive together. */
export const RAIL_PAN_MS = 180;
