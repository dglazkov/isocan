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
