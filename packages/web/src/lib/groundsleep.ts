/**
 * **An idle canvas stays idle** — the sleep policy for a living ground
 * (living grounds phase 1, design.md §4).
 *
 * `idle-at-rest` fails a canvas whose main thread is busy more than 15% while
 * nobody touches it, and it caught a render loop once already (7 Sep 2026). A
 * ground that animates is the most natural way to break that bound for good,
 * so the loop is not allowed to decide for itself whether to keep going: it
 * asks this, every frame, and this is a pure function a test can walk.
 *
 * Three states:
 *
 * - **awake** — something touched the ground in the last `ACTIVE_MS`: the
 *   pointer moved, the view panned or zoomed, an item moved under it, or a
 *   presence cursor — a person's or an agent's — moved (`GroundHost.presence`).
 *   Ambient sway runs only here.
 * - **settling** — the inputs have stopped. The ground keeps drawing while its
 *   own `step` says something is still moving (a trail fading, the sway
 *   easing out), and never longer than `SETTLE_CAP_MS` after the last input.
 *   Then it draws one final frame and stops.
 * - **asleep** — no `requestAnimationFrame`, no timer. The canvas holds its
 *   last frame until the next input wakes it.
 *
 * A hidden tab is asleep whatever else is true.
 *
 * **One deliberate departure from design.md §4**, recorded here because the
 * two numbers there cannot both hold: it says awake for 2 s after the last
 * move AND settling capped at 3 s, which is up to five seconds of frames —
 * while phases.md's proof is "the loop stops within 3 s of the pointer
 * stopping". The phase's bound is the one a person feels (the fan), so the
 * cap is measured from the last input rather than from the end of awake.
 */

/** Where the sleep policy stands — written to the canvas as `data-ground-state`. */
export type GroundState = "awake" | "settling" | "asleep";

/** How long after the last input the ground still counts as being touched.
 *  Long enough to bridge the gap between two pointer events on a slow
 *  machine; short enough that settling starts the moment a hand stops. */
export const ACTIVE_MS = 250;

/** The longest a ground may keep drawing after the last input, whatever its
 *  `step` says — the bound the `meadow` journey holds (asleep within 3.5 s). */
export const SETTLE_CAP_MS = 3000;

/** The sleep policy's whole memory: its state and when the ground was last touched. */
export interface Sleep {
  state: GroundState;
  /** When something last touched the ground, in `performance.now()` ms. */
  lastInput: number;
}

/** Where every ground starts: asleep, never touched. */
export const ASLEEP: Sleep = { state: "asleep", lastInput: -Infinity };

/** Something touched the ground: whatever it was doing, it is awake now. */
export function touch(sleep: Sleep, now: number): Sleep {
  return { state: "awake", lastInput: Math.max(sleep.lastInput, now) };
}

/**
 * What one frame decides. `moving` is the ground's own `step` result — true
 * while anything it owns is still in motion. `draw` is whether to draw this
 * frame; `again` whether to ask for another. They differ exactly once: the
 * frame that falls asleep still draws, so the canvas holds a finished picture
 * rather than whatever the last moving frame happened to be.
 */
export function advance(
  sleep: Sleep,
  now: number,
  moving: boolean,
  hidden = false,
): { sleep: Sleep; draw: boolean; again: boolean } {
  if (hidden) return { sleep: { ...sleep, state: "asleep" }, draw: false, again: false };
  if (sleep.state === "asleep") return { sleep, draw: false, again: false };
  const quiet = now - sleep.lastInput;
  if (quiet < ACTIVE_MS) return { sleep: { ...sleep, state: "awake" }, draw: true, again: true };
  if (!moving || quiet >= SETTLE_CAP_MS) {
    return { sleep: { ...sleep, state: "asleep" }, draw: true, again: false };
  }
  return { sleep: { ...sleep, state: "settling" }, draw: true, again: true };
}
