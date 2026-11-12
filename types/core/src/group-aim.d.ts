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
import type { CanvasContents } from "./model.js";
/** What a pointer is aiming at — the press's target and what ⌘ adds; see `groupAim`. */
export interface GroupAim {
    itemId: string | null;
    inside: string | null;
    among: string | null;
}
/**
 * **What the pointer is aiming at, for the hover outline AND the press**
 * (groups-by-hand phase 2). One answer for both, so the dashed preview can
 * never name one thing while a click takes another — which CSS `:hover` did:
 * at the canvas level it outlined the member under the pointer while a click
 * took its group.
 *
 * `hit` is what is under the pointer: an item (a card, or a frame's own title,
 * border or brief), or the open space inside a frame. `reach` is ⌘ (Ctrl off a
 * Mac), which aims past the group at the item itself, at any depth.
 *
 * - `itemId`: what a press takes, and the one thing outlined. Null means a
 *   press starts a selection box.
 * - `inside`: with ⌘ on a member, its group — drawn faint and solid, "inside this".
 * - `among`: with ⌘ over a frame's open space, the group whose members a
 *   selection box would reach — drawn dimly.
 */
export declare function groupAim(canvas: CanvasContents, hit: {
    itemId: string;
} | {
    gapIn: string;
} | null, activeGroupId: string | null, reach: boolean): GroupAim;
