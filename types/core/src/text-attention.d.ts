import type { CanvasContents } from "./model.js";
/** A range in the deterministic rendered text of one immutable representation.
 * Offsets count Unicode code points, never pixels or Markdown source bytes. */
export interface TextAttention {
    itemId: string;
    versionId: string;
    blobHash: string;
    textSpace: "markdown-hast-v1";
    flavor: "document" | "text-node" | "plain";
    start: number;
    end: number;
    expiresAt: number;
}
/** Selection freshness is independent of the session's ordinary heartbeat. */
export declare const TEXT_ATTENTION_MS = 15000;
/** Refuse malformed, expired or unrelated ranges before relaying presence.
 * A future expiry is bounded at this hop; clients cannot create immortal attention. */
export declare function textAttention(value: unknown, now?: number, canvas?: CanvasContents): TextAttention | null;
/** Resolve an exact quote in canonical text; repeated words require an explicit
 * occurrence. Never turn ambiguity into an agent pointing at the wrong passage. */
export declare function quoteRange(text: string, quote: string, occurrence?: number): {
    start: number;
    end: number;
};
/** A temporary short message shown on a cursor chip in place of the actor's name. */
export interface CursorSignal {
    text: string;
    expiresAt: number;
}
/** Cursor signals revert back to the actor's name after 20 seconds. */
export declare const CURSOR_SIGNAL_MS = 20000;
/** How much of a signal a cursor chip carries. It rides presence and is read
 *  at a glance beside a moving pointer, so the bound is about what stays
 *  legible there rather than about what a field can hold — `cursorSignal`
 *  trims to it rather than refusing, because a message cut short still says
 *  something and a refused one says nothing. */
export declare const CURSOR_SIGNAL_MAX_LENGTH = 80;
/** Normalize a cursor signal and bound its lifetime to 20 seconds; return null if blank or expired. */
export declare function cursorSignal(value: unknown, now?: number): CursorSignal | null;
/** What a cursor chip shows: an active 20-second signal if one is live, else the actor's name. */
export declare function cursorChipLabel(signal: unknown, fallbackName: string, now?: number): string;
