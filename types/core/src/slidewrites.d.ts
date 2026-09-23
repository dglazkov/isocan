import type { CanvasContents, Item } from "./model.js";
/**
 * The patch that marks or unmarks — one place, so the CLI and the app cannot
 * spell the property two ways. Clearing uses `removeProperties`, because
 * `properties` MERGES: an unmark that quietly left the mark on would put the
 * item back on the projector next talk.
 */
export declare function slidePatch(on: boolean): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
/**
 * **What a slide gesture on a SELECTION means, and which items it moves.**
 *
 * A single item toggles, which is obvious. Ten items where six are already
 * slides do not, and the wrong answer here loses work: reading "some are on"
 * as "turn everything off" throws away marks somebody deliberately made.
 *
 * So a mixed selection turns them all ON, and only a selection that is
 * ALREADY all slides turns off. That is the answer a tri-state checkbox
 * gives, and — more to the point — the one `isocan slides add <items...>`
 * has given since the day it shipped: mark the unmarked, skip the rest, say
 * how many. The app was the surface that could not do it at all, its menu
 * entry `disabled` for any selection over one, which made a rule the CLI
 * enforced into a habit the app did not know.
 *
 * `changing` is only the items that actually move, so the gesture writes
 * nothing for the six that were already right — fewer ops, and a notice that
 * can say what really happened.
 */
export declare function slideIntent(items: readonly Item[]): {
    on: boolean;
    changing: Item[];
};
/** How far under its slide a new note lands. */
export declare const NOTE_GAP = 24;
/** The default box for a note made with nothing measured: the slide's
 *  width, a few lines tall. */
export declare const NOTE_HEIGHT = 160;
/** The note that speaks for this slide, if there is one. */
export declare function noteFor(canvas: CanvasContents, slideId: string): Item | null;
/** Every slide of the deck with its note, in deck order — the handout. */
export declare function notesOn(canvas: CanvasContents): {
    slide: Item;
    note: Item | null;
}[];
/** Where a new note lands: under its slide, the slide's width. */
export declare function noteSpot(slide: Item): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** The properties a note wears: a text node's, plus the slide it is for. */
export declare function noteProperties(slideId: string): Record<string, string>;
/**
 * The handout: one section per slide, in deck order, the note's words under
 * its title — and a slide with nothing written under it says so, because a
 * handout that skips a slide reads as a deck with fewer slides.
 */
export declare function notesMarkdown(canvas: CanvasContents, bodyOf: (note: Item) => string): string;
