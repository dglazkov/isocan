import { type CanvasContents, type Item } from "./model.js";
/**
 * **What an agent will actually read when it starts work here.**
 *
 * Nobody can answer that today, including the agents. The answer is scattered
 * — the agent guide, the design system, the Chat, the bound directory, the
 * recap, the items themselves — and an agent assembles it by convention and
 * habit, differently every time, while the person cannot see what it
 * assembled.
 *
 * **This stores nothing.** It is a reading of what already exists, which is
 * why it comes first in the walk and why it is useful before anything else
 * lands. Every number here is counted from the canvas at the moment you ask;
 * there is no context record to keep in step with the thing it describes,
 * and therefore nothing that can go stale about the list itself.
 *
 * What CAN go stale is a piece — a design system older than the work it
 * governs — and saying so is the point. `stale` is a claim with a reason
 * attached, never a bare flag: "older than 6 of the screens it governs" is
 * actionable and "stale: true" is an accusation.
 */
interface ContextPiece {
    /** What it is called, in the words the product uses. */
    name: string;
    /** Where it comes from — the canvas, this machine, the CLI itself. */
    source: "canvas" | "machine" | "cli";
    /** Present, or absent with a reason. */
    present: boolean;
    /** How much of it there is, in whatever unit suits it. */
    size?: string;
    /** When it last changed, ISO, where the canvas knows. */
    updatedAt?: string;
    /** Why this piece needs attention, in a sentence. Absent when it is fine. */
    stale?: string;
    /** What to do about it, when there is something. */
    fix?: string;
}
/** Facts only the machine running the CLI can know. The web has none of them,
 *  which is why they are passed in rather than read. */
interface ContextExtras {
    /** The directory bound to this canvas here, if any. */
    directory?: string | null;
    /** How many entries the oplog holds, for the recap's resolution. */
    ops?: number;
    /** The guide this build ships, so an agent can see which one it read. */
    guideVersion?: string;
    /** Findings from `design check`, so the view can say whether it passes. */
    designProblems?: number;
}
/** Items somebody marked — the closest thing the canvas has to "these
 *  matter", and a real signal because a person put it there by hand. */
export declare function markedItems(canvas: CanvasContents): Item[];
export declare function contextPieces(canvas: CanvasContents, extras?: ContextExtras, nowMs?: number): ContextPiece[];
/** The list as a terminal prints it — one line a piece, and the reasons under
 *  the pieces that have them. */
export declare function contextReport(pieces: ContextPiece[], nowMs?: number): string;
export {};
