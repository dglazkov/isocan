import type { Item, ItemKind } from "@isocan/core";
import { isDesignSystem, itemKind } from "@isocan/core";

/**
 * How a kind shows itself: the word a list groups under, the word a tooltip
 * uses, and (in `KindIcon.tsx`) the picture.
 *
 * ONE set, for every surface that names a kind. The files panel had these
 * inline, and then the cards grew a type icon — at which point a second set
 * would have meant a canvas where the same item is one thing in the panel and
 * another on its own card. `kinds.ts` in core says it about the words ("a kind
 * that means one thing in a list and another in a filter is worse than no
 * kinds at all"); it is just as true of the picture.
 */

/**
 * The kinds, plus the one thing that is not a kind but reads as one.
 *
 * A design system is a markdown document by mime, so `itemKind` calls it a
 * document — correctly, for filtering. But it is the canvas's style, the thing
 * every screen is built against, and being able to spot it from across the
 * board is worth a mark of its own. It is a presentation distinction, which is
 * why it lives here and not in core's vocabulary: `isocan ls --kind document`
 * still finds it, which is right.
 */
export type IconKind = ItemKind | "design-system";

export const KIND_LABEL: Record<ItemKind, string> = {
  drawing: "Drawings",
  text: "Text",
  screen: "Screens",
  image: "Images",
  video: "Video",
  document: "Documents",
  site: "Sites",
  other: "Files",
};

/** The singular, for a tooltip on one item rather than a group heading. */
export const ICON_NOUN: Record<IconKind, string> = {
  "design-system": "design system",
  drawing: "drawing",
  text: "text",
  screen: "screen",
  image: "image",
  video: "video",
  document: "document",
  site: "live site",
  other: "file",
};

/**
 * Which mark an item gets.
 *
 * The design system is checked FIRST and deliberately: it is a markdown file,
 * so its kind is "document" — correctly, and `isocan ls --kind document` still
 * finds it, which is the behaviour to keep. But it is the canvas's style, the
 * thing every screen is built against, and being able to pick it out from
 * across the board is worth a mark of its own. Presentation may be more
 * specific than the filter; it may not disagree with it.
 */
export function iconKindFor(item: Item): IconKind {
  return isDesignSystem(item) ? "design-system" : itemKind(item);
}
