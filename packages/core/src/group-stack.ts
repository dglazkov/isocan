import type { CanvasContents, Item } from "./model.ts";
import type { GroupAction } from "./canvas-group-types.ts";
import { groupChildren, isGroupItem } from "./canvas-groups.ts";
import { isAnnotation } from "./annotation.ts";

// Its own module, like `group-aim.ts`, so the web loads the pile with the
// first stacked group it draws rather than in every first paint.

/**
 * **The pile's card** (groups-by-hand phase 4): the size a new item lands at
 * (`defaultSize`), so a pile reads as one of the things on the canvas rather
 * than as a frame, under a compact title band, with room on every side for
 * the cards turned behind it. Fixed rather than the top member's size, so a
 * pile of a phone screen and a 1440 page is one card, and so where a stack is
 * is known without reading any member (`groupStackBox` writes the sum out).
 */
export const GROUP_STACK = { width: 420, height: 320, title: 48, pad: 28 };

/** How many members show behind the top card; the rest are counted, not drawn. */
export const STACK_BEHIND = 6;

/** One card of a pile, in world units about the card's own centre. */
interface StackCard { id: string; depth: number; x: number; y: number; rotate: number }

/**
 * A stable number in [-0.5, 0.5) from an item id (FNV-1a). Pure: the same id
 * gives the same mess on every screen and every render, and nothing is stored.
 */
function seed(id: string, salt: string): number {
  let h = 2166136261;
  for (const ch of id + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/** A card behind the top is turned 3°–9° one way or the other — never square, never askew. */
function turn(id: string): number {
  const r = seed(id, "r") * 18;
  return Math.abs(r) < 3 ? Math.sign(r || 1) * 3 + r : r;
}

/** The members a stack shows, top first: direct children in reading order (`groupChildren`), less ink attached to them. */
export function groupStackMembers(canvas: CanvasContents, groupId: string): Item[] {
  return groupChildren(canvas, groupId).filter((item) => !isAnnotation(item));
}

/**
 * **The pile at rest** (groups-by-hand phase 4): the top card upright in the
 * middle; up to six behind it, each turned and nudged by a hash of its own id,
 * so edges show on every side — a hand-squared stack of playing cards, not a
 * neat offset (that is a version stack, and this must never read as one).
 *
 * The nudge is a fraction of the card — about 17px on the prototype's 150px
 * card, which is ±11% of its width — so the pile keeps its look at isocan's
 * card size. Back to front is the caller's: `depth` 0 is the top.
 */
export function stackPile(ids: readonly string[], card: { width: number; height: number } = GROUP_STACK): StackCard[] {
  return ids.slice(0, STACK_BEHIND + 1).map((id, depth) => depth === 0
    ? { id, depth, x: 0, y: 0, rotate: 0 }
    : { id, depth, x: seed(id, "x") * card.width * 0.227, y: seed(id, "y") * card.height * 0.23, rotate: turn(id) });
}

/**
 * **The pile spread on a desk** — pointing at a stack lays its cards out
 * around the top one, as a hand spreads photos on a table: two to the sides
 * and four at the corners above and below, each moved far enough that most
 * of it shows (8 Oct 2026, Dion: "use more of the height... so when spread
 * out it's more like you spread them on a desk... and thus can see more of
 * them vs. only seeing edges"). It was an arc, a hand of cards, and an arc
 * shows edges. A small tilt per slot, nudged by the card's own id, keeps it
 * from reading as a grid. Per-viewer and momentary — never stored.
 */
const DESK: ReadonlyArray<{ x: number; y: number; rotate: number }> = [
  { x: 0, y: 0, rotate: 0 },
  { x: -0.88, y: 0.04, rotate: -6 },
  { x: 0.88, y: -0.02, rotate: 5 },
  { x: -0.48, y: -0.78, rotate: 4 },
  { x: 0.5, y: -0.76, rotate: -5 },
  { x: -0.46, y: 0.8, rotate: -3 },
  { x: 0.48, y: 0.78, rotate: 6 },
];

/** Where card `depth` of a pointed-at stack lies on the desk, in pixels from the top card, with its tilt. */
export function stackFan(depth: number, card: { width: number; height: number } = GROUP_STACK, id = ""): Omit<StackCard, "id" | "depth"> {
  const slot = DESK[Math.min(depth, DESK.length - 1)]!;
  if (depth === 0) return { x: 0, y: 0, rotate: 0 };
  const jitter = id ? { x: seed(id, "dx") * 0.06, y: seed(id, "dy") * 0.06, r: seed(id, "dr") * 4 } : { x: 0, y: 0, r: 0 };
  return { x: (slot.x + jitter.x) * card.width, y: (slot.y + jitter.y) * card.height, rotate: slot.rotate + jitter.r };
}

/** Stack or spread a group: the one act both surfaces send — a `layout` action, so one undo and no new op. */
export function groupStackAction(group: Item, stacked: boolean): Extract<GroupAction, { kind: "layout" }> {
  return { kind: "layout", itemId: group.id, layout: { display: stacked ? "stack" : "spread" } };
}

/**
 * **⇧S: which groups, and which way** — stack what is spread, spread what is
 * stacked. The groups are the selected ones; a selected member stands for
 * its group; with nothing selected, the group you are standing in. When
 * several disagree they are made to agree: all stacked spreads them, any
 * spread stacks them all, so one press always moves every one the same way.
 * `null` when there is no group to act on.
 */
export function stackToggle(
  canvas: CanvasContents,
  selection: readonly string[],
  scope: string | null,
): { groups: Item[]; stacked: boolean } | null {
  const ids = selection.length ? selection : scope ? [scope] : [];
  const groups: Item[] = [];
  for (const id of ids) {
    const item = canvas.items[id];
    const group = item && isGroupItem(item) ? item : item?.containerId ? canvas.items[item.containerId] : undefined;
    if (group && isGroupItem(group) && !groups.includes(group)) groups.push(group);
  }
  if (!groups.length) return null;
  return { groups, stacked: !groups.every((group) => group.groupLayout?.display === "stack") };
}
