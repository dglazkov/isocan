/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
