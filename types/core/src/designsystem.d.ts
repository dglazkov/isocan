import type { CanvasContents, Item } from "./model.js";
export declare const DESIGN_SYSTEM_ROLE = "design-system";
/** The properties that make an item this canvas's design system. */
export declare function designSystemProperties(): Record<string, string>;
export declare function isDesignSystem(item: Item): boolean;
/**
 * The canvas's design system, if it has one. Most recently updated wins: two
 * are a mistake rather than a feature, and the newest is the likelier answer
 * to "which one is real".
 */
export declare function designSystem(canvas: CanvasContents): Item | null;
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
export declare const DESIGN_SYSTEM_AFTER = 2;
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
export declare function needsDesignSystem(canvas: CanvasContents, screens: number): boolean;
