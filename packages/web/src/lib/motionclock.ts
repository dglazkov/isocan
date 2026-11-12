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
