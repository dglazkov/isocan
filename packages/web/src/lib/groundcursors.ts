/**
 * **Presence cursors, handed to a living ground** (living grounds phase 2).
 *
 * `CursorLayer` already eases every presence cursor toward its latest update,
 * every frame, for drawing. A living ground wants exactly those positions —
 * the cursor you see, not the beat that moved it — so CursorLayer calls this
 * with each one that moved, in world units, and `null` for one that left.
 *
 * A WORKING cursor's wander is not a position anybody sent: CursorLayer
 * invents it locally from the fact of working. Drawn, yes; pressed into the
 * grass, no — otherwise a canvas with a working agent never sleeps. For a
 * working cursor the ground gets only `realMove`: the session's own position,
 * once each time it actually changes.
 *
 * Nobody listens unless a living ground is mounted (`LivingGround.tsx` sets
 * `feed` and clears it), so on every other canvas this is one optional call.
 * It lives in the first-paint chunk, so it stays this small.
 */
export const groundCursors: { feed: ((sessionId: string, at: { x: number; y: number } | null) => void) | null } = {
  feed: null,
};

/** A working cursor's real position, if it changed since `rec` last saw it
 *  (and remember it); `null` while it has not — the wander does not count. */
export function realMove(
  rec: { fx?: number; fy?: number },
  cursor: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (!cursor || (cursor.x === rec.fx && cursor.y === rec.fy)) return null;
  rec.fx = cursor.x;
  rec.fy = cursor.y;
  return cursor;
}
