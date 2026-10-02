import type { CanvasContents } from "./model.ts";
import { groupAncestors, groupScopedRoot } from "./canvas-groups.ts";

// Its own module so the web can load it with the hover, lazily, rather than
// in the first paint beside the rest of `canvas-groups.ts`.

/** What a pointer is aiming at — the press's target and what ⌘ adds; see `groupAim`. */
export interface GroupAim { itemId: string | null; inside: string | null; among: string | null }
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
export function groupAim(canvas: CanvasContents, hit: { itemId: string } | { gapIn: string } | null, activeGroupId: string | null, reach: boolean): GroupAim {
  const aim: GroupAim = { itemId: null, inside: null, among: null };
  const id = !hit ? null : "itemId" in hit ? hit.itemId : hit.gapIn;
  const item = id ? canvas.items[id] : undefined;
  if (!hit || !item) return aim;
  // A stack has no open space: the whole pile is one card, so it is aimed at
  // as the group itself, with ⌘ or without (groups-by-hand phase 4).
  if ("gapIn" in hit && item.groupLayout?.display !== "stack") {
    if (reach) return { ...aim, among: item.id };
    // The scope you stand in, and any frame around it, is open floor there.
    const scope = activeGroupId ? canvas.items[activeGroupId] : undefined;
    if (scope && (item.id === scope.id || groupAncestors(canvas, scope.id).some((up) => up.id === item.id))) return aim;
  } else if (reach) return { ...aim, itemId: item.id, inside: item.containerId ?? null };
  // The press's own rule (`scopedHit`): the scope's direct child, or — outside
  // the scope — the outermost group, which a press there steps out to.
  return { ...aim, itemId: groupScopedRoot(canvas, item.id, activeGroupId) ?? groupScopedRoot(canvas, item.id, null) ?? item.id };
}
