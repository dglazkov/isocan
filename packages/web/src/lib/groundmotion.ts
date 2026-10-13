/**
 * **How much a living ground moves, for this viewer** (living grounds phase 4,
 * design.md §5, journey.md scene 5).
 *
 * Which ground a canvas wears is the canvas's — shared, stored, one undo. How
 * much it MOVES is each viewer's own, like where they keep the Chat
 * (`chatplace.ts`): one localStorage key for every canvas, no Operation and no
 * CLI verb. An agent has no screen for grass to sway on.
 *
 * - **Full** — the ground as designed: it reacts to every cursor and, while
 *   awake, sways, drifts and blinks on its own.
 * - **Calm** — cursor reactions only. Nothing moves that a cursor did not
 *   move: no sway, no drift, no blink, and an untouched ground draws nothing
 *   at all — not even the few seconds of settling a Full ground draws when it
 *   mounts.
 * - **Still** — the ground's painted still frame and no WebGL, exactly what
 *   `prefers-reduced-motion` gives. Reduced motion always wins: a viewer whose
 *   system asks for no motion is never handed more by a choice made here.
 *
 * Not in the entry chunk: only the living layer and the background menu read
 * it, and both are fetched on demand.
 */
export type Motion = "full" | "calm" | "still";

/** In the order the menu offers them. */
export const MOTIONS: readonly Motion[] = ["full", "calm", "still"];

/** What the menu calls each one. */
export const MOTION_LABELS: Record<Motion, string> = { full: "Full", calm: "Calm", still: "Still" };

/** The one localStorage key, for every canvas. */
export const MOTION_KEY = "isocan.groundMotion";

/** The slice of `Storage` the setting uses — a parameter, so a test can hand
 *  in storage that throws. */
export type Store = Pick<Storage, "getItem" | "setItem">;

const isMotion = (v: unknown): v is Motion => v === "full" || v === "calm" || v === "still";

/** Full unless something else was chosen here. Storage that throws — private
 *  mode, a sandboxed frame — reads as never chosen. */
export function readMotion(store?: Store): Motion {
  try {
    const v = (store ?? localStorage).getItem(MOTION_KEY);
    return isMotion(v) ? v : "full";
  } catch {
    return "full";
  }
}

const listeners = new Set<(m: Motion) => void>();
/** What this tab chose when storage would not keep it: the choice still holds
 *  until the tab closes, it just does not survive a reload. */
let unstored: Motion | null = null;

/** The motion this tab draws with right now. */
export function currentMotion(): Motion {
  return unstored ?? readMotion();
}

/** Choose, remember, and tell every living ground in this tab. A storage that
 *  throws keeps the choice for this tab only; it never throws to the menu. */
export function writeMotion(m: Motion, store?: Store): void {
  try {
    (store ?? localStorage).setItem(MOTION_KEY, m);
    unstored = null;
  } catch {
    unstored = m;
  }
  for (const fn of listeners) fn(m);
}

/** Hear every change: this tab's own, and another tab's through `storage`. */
export function onMotion(fn: (m: Motion) => void): () => void {
  listeners.add(fn);
  const other = (e: StorageEvent) => {
    if (e.key === MOTION_KEY) fn(readMotion());
  };
  window.addEventListener("storage", other);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", other);
  };
}

/**
 * How the ground is drawn: the motion asked for, unless reduced motion says
 * Still — which it always may.
 */
export function motionMode(motion: Motion, reducedMotion: boolean): Motion {
  return reducedMotion ? "still" : motion;
}

/**
 * **The ambient term a ground is handed** (`Field.ambient`). `ease` is the
 * host's awake envelope — 0 asleep, easing to 1 while touched — and gates
 * everything a ground does; ambient is the share of it a ground may spend on
 * motion nobody caused. Calm spends none of it.
 */
export function ambientOf(ease: number, motion: Motion): number {
  return motion === "full" ? ease : 0;
}
