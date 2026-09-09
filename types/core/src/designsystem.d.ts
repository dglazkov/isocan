import type { CanvasContents, Item } from "./model.js";
import type { MetaPatch } from "./ops.js";
/** The `role` an item wears to BE this canvas's design system. */
export declare const DESIGN_SYSTEM_ROLE = "design-system";
/** The properties that make an item this canvas's design system. */
export declare function designSystemProperties(): Record<string, string>;
/** Is this item the design system — under either name it has been given? */
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
export declare function needsDesignSystem(canvas: CanvasContents, screens: number, project?: HasProperties): boolean;
/**
 * **How many screens before the note stops being a note** (8 Sep 2026).
 *
 * `DESIGN_SYSTEM_AFTER` has been printing a courtesy line on both surfaces
 * since the feature landed, and measured across six live canvases it has
 * changed nothing: **37 of 61 screens sit on a canvas with no design system**,
 * including one at 24 screens and one at 7. A note that has been ignored
 * twenty-four times is not a note, it is decoration — which is this repo's own
 * oldest finding, in the words `bundle-ceiling.mjs` uses about the size gate it
 * replaced: *"seven raises teach somebody to edit a number without reading
 * it"*.
 *
 * So the shape is that gate's, deliberately: **a creep asks, a jump blocks.**
 * Past `DESIGN_SYSTEM_AFTER` a canvas is told; past this, adding another
 * screen is refused until somebody either writes a system or says out loud
 * that this canvas does not want one.
 *
 * **Three times the point where the rule already applies**, and the ratio is
 * borrowed rather than invented: `test/review-queue.test.ts` reddens a finding
 * asked three nights running, on the argument that a question asked a third
 * time needs a guard rather than a fourth mention. Same argument, same three.
 */
export declare const DESIGN_SYSTEM_LIMIT: number;
/**
 * Where this canvas stands: nothing owed, owed, or past the point where it is
 * still a suggestion.
 *
 * One function rather than two booleans, because the two surfaces must not be
 * able to disagree about which of the three a canvas is in — and because a
 * caller that has to combine `needsDesignSystem` with a comparison of its own
 * is a caller that will get the boundary wrong in one place.
 */
type DesignStanding = "fine" | "owed" | "overdue";
/**
 * **The two halves of the answer live on two objects, and that is why this
 * takes both.**
 *
 * The design system is an ITEM, so it is in `CanvasContents`. The decision not
 * to have one is a canvas PROPERTY, so it is on the project — the same place
 * `themeOf` reads from. A caller holding only one of them cannot answer the
 * question, and the shape that makes that impossible to get wrong is one
 * function asking for both.
 *
 * `project` is optional only because the answer without it is the safe one: a
 * caller that cannot see the properties reports the standing as if nobody had
 * opted out, which asks for a system that may not be wanted rather than
 * silently skipping one that is.
 */
interface HasProperties {
    properties?: Record<string, string>;
}
/** Which of the three this canvas is in. See `DesignStanding` above for why
 *  it takes both the contents and the project. */
export declare function designStanding(canvas: CanvasContents, screens: number, project?: HasProperties): DesignStanding;
/** Has this canvas said, on the record, that it does not want one? */
export declare function designSkipped(canvas: {
    properties?: Record<string, string>;
}): boolean;
/** This canvas does not want one, deliberately. */
export declare function designSkipPatch(): MetaPatch;
/** Take the decision back — the note and the gate return. */
export declare function designUnskipPatch(): MetaPatch;
export {};
