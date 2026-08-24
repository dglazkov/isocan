import type { ItemKind } from "@isocan/core";

/**
 * How a kind shows itself: the word a list groups under, and the one glyph
 * that stands for it.
 *
 * ONE set, for every surface that names a kind. The files panel had these
 * inline, and then the cards grew a type icon — at which point a second set
 * would have meant a canvas where the same item is ▤ in the panel and
 * something else on its own card. `kinds.ts` in core says it about the words
 * ("a kind that means one thing in a list and another in a filter is worse
 * than no kinds at all"); it is just as true of the picture.
 *
 * Glyphs, not an icon font or SVGs: this mark is rendered at 11px inside
 * counter-scaled chrome, next to text, and it has to hold its weight beside a
 * type face rather than beside other icons. A character does that by being one.
 */

export const KIND_LABEL: Record<ItemKind, string> = {
  drawing: "Drawings",
  screen: "Screens",
  image: "Images",
  video: "Video",
  document: "Documents",
  site: "Sites",
  other: "Files",
};

/** The singular, for a tooltip on one item rather than a group heading. */
export const KIND_NOUN: Record<ItemKind, string> = {
  drawing: "drawing",
  screen: "screen",
  image: "image",
  video: "video",
  document: "document",
  site: "live site",
  other: "file",
};

export const KIND_GLYPH: Record<ItemKind, string> = {
  drawing: "✎",
  // A wide frame, against the image's filled square and the document's ruled
  // one: a screen is a viewport, and the shape says so before the word does.
  screen: "▭",
  image: "▣",
  video: "▶",
  document: "▤",
  site: "◍",
  other: "◇",
};
