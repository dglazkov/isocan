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

/**
 * **How many screens before a canvas should have written its style down.**
 *
 * Not one. One screen has nothing to be consistent WITH, and a system
 * written before anything exists is a system made of adjectives — the kind
 * that gets ignored, and the reason `/design-system` derives from what is
 * already there rather than inventing one up front.
 *
 * Two is where it starts to matter, because the second screen is the moment
 * a choice becomes a convention: it either copies the first — and the system
 * now exists, implicitly, unwritten and unversioned — or it does not, and
 * the canvas has begun to drift. Either way the decision has been made and
 * nobody has recorded it.
 */
export const DESIGN_SYSTEM_AFTER = 2;

/**
 * Does this canvas have designs and no written system for them?
 *
 * The question a canvas can ask ITSELF, which is the point. "Read the design
 * system before you build a screen" has been in the agent guide all along,
 * and a norm in a document is a rule somebody has to remember. This is the
 * canvas noticing instead — and it deliberately notices the absence rather
 * than preventing anything: the first screen is the design system whether or
 * not it was written down, so the useful moment is not a gate before the
 * work but a prompt to capture what the work already decided.
 *
 * Counting is left to the caller, which knows what a screen is on its
 * surface — this stays a rule about numbers so both can apply the same one.
 */
export function needsDesignSystem(canvas: CanvasContents, screens: number): boolean {
  return screens >= DESIGN_SYSTEM_AFTER && designSystem(canvas) === null;
}
