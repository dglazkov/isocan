/** Board authoring templates. Reading the sprint clock does not need the setup copy. */
import type { CanvasContents, Item } from "./model.js";
import { type BoardArea, type BoardKey } from "./sprint.js";
/** Between sheets, in world units. */
export declare const BOARD_GAP = 200;
/** The board, sheet by sheet, in the order the week walks it — left to right. */
export declare const SPRINT_BOARD: readonly BoardArea[];
/** One sheet's template by key. Every `BoardKey` has one, so this never misses. */
export declare function boardArea(key: BoardKey): BoardArea;
/**
 * Where each sheet goes: one row from `origin`, top-aligned, a gap between.
 * Pure, so the CLI's `sprint board` and a test agree to the pixel.
 */
export declare function boardLayout(origin: {
    x: number;
    y: number;
}): (BoardArea & {
    x: number;
    y: number;
})[];
/** Every sheet of the board that exists here, in board order. */
export declare function boardOf(canvas: CanvasContents): Item[];
/**
 * **The brief, as a card.** What the setup round answered, written once as
 * markdown the Brief sheet holds — a text node wearing `brief=1` so the
 * facilitator can find it again and write the next version rather than a
 * second card. Empty fields are left out, not written as "TBD": a brief
 * that says less is honest, and the next version fills it.
 */
export declare const BRIEF_PROP = "brief";
/** What a brief says. Every field optional: a brief that says less is honest. */
export interface Brief {
    goal?: string;
    questions?: string[];
    decider?: string;
    sketchers?: string[];
    cut?: string;
}
/**
 * The brief as the markdown its card shows — empty fields left out rather than written as TBD.
 */
export declare function briefCard(brief: Brief): string;
/** The brief card on this canvas, or null. */
export declare function briefItem(canvas: CanvasContents): Item | null;
/** What a desk is called: the sketcher's name, possessive. */
export declare function deskTitle(name: string): string;
