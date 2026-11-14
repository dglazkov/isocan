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
 * **What a press on an item does to the selection** — decided at the press,
 * finished at the release.
 *
 * The bug this answers (30 Sep 2026): Shift toggled the selection on
 * pointer-DOWN, so Shift-pressing one of three selected frames took it out of
 * the selection before a drag could begin, and the drag moved nothing — or
 * the wrong thing. The standard rule (Figma, tldraw, Miro) splits the press:
 *
 * - A press on a **selected** item keeps the selection whole, so a drag
 *   carries all of it — Shift or not. Only a Shift-press that is released
 *   without moving takes it back out, and that happens on release.
 * - A **Shift**-press on an unselected item adds it at once, and a drag then
 *   carries the lot. A click leaves it added, which is what the toggle meant.
 * - A plain press on an unselected item selects it alone.
 *
 * Shift at the press is selection; Shift during the MOVE is the magnet
 * ("⇧-drag: snap harder"), read from the move event — so holding Shift through
 * a drag of the selection does both.
 *
 * Returns what a drag from this press carries, which is also the selection
 * from the press on. When the press keeps the selection it returns THAT array,
 * the same reference — how the caller knows a Shift-click on it must take the
 * item out on release (`drag === selected && shift`). One return value rather
 * than an object because `ItemView` is in the entry chunk, which is tight.
 */
export function pressSelection(selected: string[], id: string, shift: boolean): string[] {
  return selected.includes(id) ? selected : shift ? [...selected, id] : [id];
}
