/**
 * **Where each motion's player was paused or scrubbed to, in this tab**
 * (motion phase 2). The player runs in the sandboxed content origin and says
 * so by message (`MOTION_MESSAGES.time`); a comment pinned to the motion
 * while it is paused there carries the moment as `at`. One person's view,
 * never written: a playing motion has no moment to remember.
 */
const paused = new Map<string, number>();

/** What a player said: paused or scrubbed to `at`, or playing (`null`) — when a moment is worth remembering. */
export function noteMotionTime(itemId: string, at: number | null): void {
  if (at === null) paused.delete(itemId);
  else paused.set(itemId, at);
}

/** The moment a new comment pinned to this item should carry, if its player is paused. */
export function motionTimeOf(itemId: string | null | undefined): number | undefined {
  return itemId ? paused.get(itemId) : undefined;
}
