import type { CanvasContents, Item } from "./model.ts";

/**
 * Reactions on an item: who wears what, and the two questions anybody asks.
 *
 * The shape is `emoji → actor ids` (see `Item.reactions`), so everything here
 * is a read over that set. Nothing in this file mutates — reacting is an
 * operation, because a count that clients incremented would lose one of every
 * two simultaneous reactions.
 */

/** One emoji as it renders: the mark, how many wear it, and whether you do. */
interface Reaction {
  emoji: string;
  actorIds: readonly string[];
  count: number;
  /** Whether the asking actor is one of them — what makes the chip a toggle. */
  mine: boolean;
}

/**
 * Every reaction on an item, most-worn first, ties broken by who arrived
 * first.
 *
 * Sorted rather than left in object order because a row of chips that
 * reshuffles when somebody reacts is a row nobody can aim at — and the useful
 * order for a reader is "what does this item mostly say", which is the count.
 */
export function reactionsOf(item: Item, selfId?: string): Reaction[] {
  const entries = Object.entries(item.reactions ?? {});
  const out = entries.map(([emoji, actorIds]) => ({
    emoji,
    actorIds,
    count: actorIds.length,
    mine: selfId !== undefined && actorIds.includes(selfId),
  }));
  return out.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/** Does this actor already wear this emoji here? The client asks before it
 * sends, so the op says what should be true rather than "flip it". */
export function hasReacted(item: Item, emoji: string, actorId: string): boolean {
  return (item.reactions?.[emoji] ?? []).includes(actorId);
}


/** One emoji's worth of the canvas: the mark, who is wearing it where, and
 * how many items carry it. */
interface ReactionGroup {
  emoji: string;
  items: Item[];
  /** How many ITEMS wear it — the number the bar shows. Distinct from a
   * single item's count, which is how many people wear it there. */
  count: number;
}

/**
 * The canvas grouped by the marks on it — what the bar shows.
 *
 * **This replaced the starred shortlist, and it is a better shape for the same
 * job.** A star was one shared bit: on or off, canvas-wide, with nobody's name
 * on it. A team that wanted "needs review" and "signed off" and "in progress"
 * had one flag and had to agree what it meant. Reactions give them as many
 * marks as they want and cost nothing to invent — 👀 is review, 🚧 is
 * in-flight, ✅ is done, and none of that had to be built.
 *
 * EVERYONE's reactions, not just yours: the bar is a board, and a board that
 * only showed your own marks would answer a question nobody has.
 *
 * Groups are sorted by how many items wear the mark, then by emoji so the
 * order is stable when counts tie — a bar that reshuffles as people react is
 * a bar nobody can aim at. Items inside a group keep the canvas's own recency
 * order, most recently touched first, for the reason the shortlist did: a list
 * reads best in the order things last happened.
 */
export function reactionGroups(canvas: CanvasContents): ReactionGroup[] {
  const byEmoji = new Map<string, Item[]>();
  const recent = Object.values(canvas.items).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  for (const item of recent) {
    for (const emoji of Object.keys(item.reactions ?? {})) {
      const bucket = byEmoji.get(emoji);
      if (bucket) bucket.push(item);
      else byEmoji.set(emoji, [item]);
    }
  }
  return [...byEmoji.entries()]
    .map(([emoji, items]) => ({ emoji, items, count: items.length }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/** Every item wearing one mark — `ls --reaction 👀`, and one section of the
 * bar. */
export function itemsWearing(canvas: CanvasContents, emoji: string): Item[] {
  return reactionGroups(canvas).find((group) => group.emoji === emoji)?.items ?? [];
}
