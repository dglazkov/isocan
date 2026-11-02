import type { CanvasContents, Item } from "./model.ts";
import { TEXT_PROPERTIES } from "./textnode.ts";
import { NOTE_FOR_PROP, deck, isSlide, noteTarget, SLIDE_PROP } from "./slides.ts";

/*
 * **The deck's writing half** (`slides.ts` is the reading half): what a slide
 * gesture writes, and the speaker notes. Its own file because the canvas
 * reads the deck on first paint — the mark on an item, full screen's arrows —
 * and only the item menu and the deck's own views write or print it; while
 * both halves shared a file, every canvas downloaded both
 * (`scripts/bundle-ceiling.mjs`, the `benchjoin.ts` lesson, 23 Sep 2026).
 */

/**
 * The patch that marks or unmarks — one place, so the CLI and the app cannot
 * spell the property two ways. Clearing uses `removeProperties`, because
 * `properties` MERGES: an unmark that quietly left the mark on would put the
 * item back on the projector next talk.
 */
export function slidePatch(
  on: boolean,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return on ? { properties: { [SLIDE_PROP]: "yes" } } : { removeProperties: [SLIDE_PROP] };
}

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
export function slideIntent(items: readonly Item[]): { on: boolean; changing: Item[] } {
  const on = !(items.length > 0 && items.every(isSlide));
  return { on, changing: items.filter((item) => isSlide(item) !== on) };
}

/** How far under its slide a new note lands. */
export const NOTE_GAP = 24;

/** The default box for a note made with nothing measured: the slide's
 *  width, a few lines tall. */
export const NOTE_HEIGHT = 160;

/** The note that speaks for this slide, if there is one. */
export function noteFor(canvas: CanvasContents, slideId: string): Item | null {
  const notes = Object.values(canvas.items)
    .filter((item) => noteTarget(item) === slideId)
    .sort((a, b) => a.id.localeCompare(b.id));
  return notes[0] ?? null;
}

/** Every slide of the deck with its note, in deck order — the handout. */
export function notesOn(canvas: CanvasContents): { slide: Item; note: Item | null }[] {
  return deck(canvas).map((slide) => ({ slide, note: noteFor(canvas, slide.id) }));
}

/** Where a new note lands: under its slide, the slide's width. */
export function noteSpot(slide: Item): { x: number; y: number; width: number; height: number } {
  return { x: slide.x, y: slide.y + slide.height + NOTE_GAP, width: slide.width, height: NOTE_HEIGHT };
}

/** The properties a note wears: a text node's, plus the slide it is for. */
export function noteProperties(slideId: string): Record<string, string> {
  return { ...TEXT_PROPERTIES, [NOTE_FOR_PROP]: slideId };
}

/**
 * The handout: one section per slide, in deck order, the note's words under
 * its title — and a slide with nothing written under it says so, because a
 * handout that skips a slide reads as a deck with fewer slides.
 */
export function notesMarkdown(canvas: CanvasContents, bodyOf: (note: Item) => string): string {
  const sections = notesOn(canvas).map(({ slide, note }, i) => {
    const body = note ? bodyOf(note).trim() : "";
    return `## ${i + 1}. ${slide.title}\n\n${body === "" ? "_No notes._" : body}\n`;
  });
  return sections.join("\n");
}

