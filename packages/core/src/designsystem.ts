import type { CanvasContents, Item } from "./model.ts";

/**
 * The design system: what this canvas has decided things look like.
 *
 * Every agent that builds a screen is otherwise designing from scratch, which
 * is why a canvas fills up with screens that are individually fine and
 * collectively a jumble — six type scales, four blues, three ideas about
 * spacing. The fix is not better adjectives in a prompt ("clean, modern"
 * describes nothing); it is a written-down system with NUMBERS in it, that
 * every builder reads first.
 *
 * It lives on the canvas as an ordinary item rather than in a dotfile, and
 * that is the whole design: the design system sits beside the designs it
 * governs, both surfaces can read and edit it, it versions like everything
 * else, and a person can see it without knowing it exists. A hidden file is a
 * file nobody updates.
 *
 * The convention is one property, so nothing else has to learn a new kind.
 */

export const ROLE_PROP = "role";
export const DESIGN_SYSTEM_ROLE = "design-system";
/** What this was called for an afternoon. Canvases written in that window
 * still say it, and a rename that orphans somebody's file is not a rename. */
export const LEGACY_DESIGN_ROLE = "house-style";

/** The properties that make an item this canvas's design system. */
export function designSystemProperties(): Record<string, string> {
  return { [ROLE_PROP]: DESIGN_SYSTEM_ROLE };
}

export function isDesignSystem(item: Item): boolean {
  const role = item.properties[ROLE_PROP];
  return role === DESIGN_SYSTEM_ROLE || role === LEGACY_DESIGN_ROLE;
}

/**
 * The canvas's design system, if it has one. Most recently updated wins: two
 * are a mistake rather than a feature, and the newest is the likelier answer
 * to "which one is real".
 */
export function designSystem(canvas: CanvasContents): Item | null {
  const found = Object.values(canvas.items)
    .filter(isDesignSystem)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return found[0] ?? null;
}
