import type { CanvasContents, CommentThread } from "@isocan/core";
import { laneOf } from "@isocan/core";

/**
 * **What follow mode should do next**, as a pure decision.
 *
 * Follow is the redesign's one feature that moves the camera on somebody's
 * behalf without them asking each time. That makes its failure mode the worst
 * in the app — a canvas that wanders while you are trying to work on it — so
 * the decision is a function that can be tested rather than an effect that
 * has to be watched.
 *
 * The rules, and each one is a reason to STAY PUT:
 *
 * - **Only when it is on.** Off by default. This is a mode somebody chooses.
 * - **Only for something NEW.** The newest lane entry is compared against the
 *   last one followed; a re-render, a reconnect, or a snapshot arriving twice
 *   must not re-fly to where you already are.
 * - **Never while a hand is down.** A pan or a drag beats follow outright, and
 *   the move is DROPPED rather than deferred: a camera that lurches the
 *   instant you release the mouse is worse than one that missed a message.
 * - **Not more than once every few seconds.** An agent saving five versions
 *   in a burst is one arrival worth seeing, not five flights.
 *
 * It answers with an item id or null, and never with "why not" — the caller
 * has nothing useful to do with the difference.
 */
export const FOLLOW_EVERY_MS = 3000;

export interface FollowState {
  /** Item the camera was last sent to by follow, if any. */
  lastItemId: string | null;
  /** When that happened, in ms. */
  lastAtMs: number;
}

export function nextFollow(
  canvas: CanvasContents,
  thread: CommentThread | null,
  state: FollowState,
  now: { on: boolean; busy: boolean; nowMs: number },
): string | null {
  if (!now.on || !thread) return null;
  // A hand is down. Dropped, not queued: see above.
  if (now.busy) return null;

  const lane = laneOf(canvas, thread);
  const newest = lane[lane.length - 1]?.made.at(-1) ?? null;
  if (!newest) return null;
  // Already there — the common case on every re-render.
  if (newest.itemId === state.lastItemId) return null;
  if (now.nowMs - state.lastAtMs < FOLLOW_EVERY_MS) return null;
  return newest.itemId;
}
