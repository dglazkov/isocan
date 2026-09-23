import { markOffered, moduleMarkPatch, readingOrder, type CanvasContents, type Item, type ModuleMark } from "@isocan/core";
import { KEEP_EMOJI, KEEP_PROP, wireframeModule } from "./record.ts";

/**
 * **Marking the keepers** (design §6, journey scene 4) — a property, as a
 * slide is: `wireKeep = "yes"` through `item.update`, so no op is new, one
 * undo takes a mark back, and anybody can take it off (a reaction would be
 * its reactor's alone). The web app draws it as 📐 and offers it from the
 * item menu and ⇧K through the record's `marks`; `isocan wire keep|unkeep`
 * sends the same patch. Kept screens read in reading order, as slides do.
 */
export { KEEP_EMOJI, KEEP_PROP };

export const KEEP_MARK: ModuleMark = wireframeModule.marks![0]!;

export function isKept(item: Item): boolean {
  return Boolean(item.properties?.[KEEP_PROP]);
}

/** Can this item wear the mark — a wireframe screen, or one already kept. */
export function keepable(item: Item): boolean {
  return markOffered(KEEP_MARK, item);
}

export function keepPatch(on: boolean): { properties: Record<string, string> } | { removeProperties: string[] } {
  return moduleMarkPatch(KEEP_PROP, on);
}

/** The kept screens, in reading order — rows top to bottom, each left to right. */
export function kept(canvas: CanvasContents): Item[] {
  return readingOrder(Object.values(canvas.items).filter(isKept));
}
