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
 * When a press becomes a drag.
 *
 * Everything draggable on this canvas makes the same bargain: a press that
 * stays put is a CLICK on the thing (open it, select it), and one that travels
 * past a few pixels is a DRAG of it. The threshold is what keeps the two from
 * stealing each other — without it, opening a comment by clicking its pin
 * would nudge the pin a pixel, and dragging an item would also select-and-open
 * whatever was under the pointer.
 *
 * Four screen pixels, and screen rather than world so the gesture feels the
 * same at every zoom: the hand does not know what the canvas scale is.
 *
 * Here rather than at each site because it was at each site — ItemView had it,
 * and the pin layer written later would have picked its own number. One
 * bargain, one number, one place to change it.
 */
export const DRAG_SLOP = 4;

/** Has the pointer travelled far enough for this press to be a drag?
 *  Radial, so the threshold is the same in every direction — a diagonal
 *  nudge is not allowed to be twice as tolerant as a straight one. */
export function pastSlop(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_SLOP;
}
