import type { Item } from "./model.ts";

/**
 * Reactions on an item: who wears what, and the two questions anybody asks.
 *
 * The shape is `emoji → actor ids` (see `Item.reactions`), so everything here
 * is a read over that set. Nothing in this file mutates — reacting is an
 * operation, because a count that clients incremented would lose one of every
 * two simultaneous reactions.
 */

/** One emoji as it renders: the mark, how many wear it, and whether you do. */
export interface Reaction {
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

/** How many distinct marks are on this item — for a summary that does not
 * want to draw them. */
export function reactionCount(item: Item): number {
  return Object.keys(item.reactions ?? {}).length;
}

/**
 * A short, opinionated starter set for a picker.
 *
 * Not an emoji keyboard: a canvas of screens gets asked the same handful of
 * questions — is this the one, does it need work, is it funny, is it done —
 * and a grid of 1,800 glyphs answers none of them faster than eight do. The
 * picker takes anything typed; this is what it offers.
 */
export const QUICK_REACTIONS = ["👍", "🎉", "👀", "🤔", "❤️", "🔥", "🚧", "✅"] as const;
