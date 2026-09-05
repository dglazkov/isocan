import type { BuiltinKind, Item, ItemKind } from "@isocan/core";
import { isBuiltinKind, isDesignSystem, itemKind, moduleKinds } from "@isocan/core";

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
 *
 * **Module kinds** (`docs/projects/modules/design.md`, phase 2) are not in
 * these records — they cannot be, the records are closed by the compiler
 * before a module exists — so every consumer goes through the lookups
 * below, which fall back to what the module declared: its label, its noun,
 * and the built-in mark it borrows for an icon.
 */

/**
 * The kinds with a mark, plus the one thing that is not a kind but reads as
 * one.
 *
 * A design system is a markdown document by mime, so `itemKind` calls it a
 * document — correctly, for filtering. But it is the canvas's style, the thing
 * every screen is built against, and being able to spot it from across the
 * board is worth a mark of its own. It is a presentation distinction, which is
 * why it lives here and not in core's vocabulary: `isocan ls --kind document`
 * still finds it, which is right.
 */
export type IconKind = BuiltinKind | "design-system";

export const KIND_LABEL: Record<BuiltinKind, string> = {
  drawing: "Drawings",
  text: "Text",
  screen: "Screens",
  image: "Images",
  video: "Video",
  document: "Documents",
  site: "Sites",
  canvas: "Canvases",
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
  canvas: "canvas",
  other: "file",
};

const addedKind = (kind: string) => moduleKinds().find((k) => k.id === kind);

/** The group heading for a kind — a module's label for a module's kind. */
export function kindLabel(kind: ItemKind): string {
  return isBuiltinKind(kind) ? KIND_LABEL[kind] : (addedKind(kind)?.label ?? kind);
}

/** The singular, for one item — a module's noun for a module's kind. */
export function kindNoun(kind: string): string {
  if (kind in ICON_NOUN) return ICON_NOUN[kind as IconKind];
  return addedKind(kind)?.noun ?? kind;
}

/**
 * Which mark an item gets.
 *
 * The design system is checked FIRST and deliberately: it is a markdown file,
 * so its kind is "document" — correctly, and `isocan ls --kind document` still
 * finds it, which is the behaviour to keep. But it is the canvas's style, the
 * thing every screen is built against, and being able to pick it out from
 * across the board is worth a mark of its own. Presentation may be more
 * specific than the filter; it may not disagree with it.
 *
 * A module's kind wears the built-in mark it named, or the plain file mark:
 * the icon set is drawn for 11px and a module names one rather than shipping
 * pixels.
 */
export function iconKindFor(item: Item): IconKind {
  if (isDesignSystem(item)) return "design-system";
  const kind = itemKind(item);
  if (isBuiltinKind(kind)) return kind;
  const icon = addedKind(kind)?.icon;
  return icon && isBuiltinKind(icon) ? icon : "other";
}
