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
 * Whether your named cursor is the only cursor here.
 *
 * The canvas viewport sets `cursor: none` while the chip is in play, and
 * `cursor` is inherited — so every descendant that never says otherwise
 * computes to `none`, and the first one that does say otherwise stops it: the
 * titlebar's `grab`, a resize handle's arrows, a button's `pointer`, an
 * input's I-beam from the UA sheet. So the computed value already knows the
 * answer, and asking it beats keeping a list of places to hide. The list was
 * the first attempt and it was wrong within the day: text fields were not on
 * it, so a rename showed an I-beam and a name chip at once.
 *
 * The exception is a frame. An `<iframe>` inherits `none` like any other
 * element, but that declaration does not cross into the document inside it —
 * a site projected onto the canvas draws its own cursor, and drawing ours over
 * that is the double cursor again.
 */
export function ownCursorFits(target: Element, cursor: string): boolean {
  if (target.closest("iframe")) return false;
  return cursor === "none";
}
