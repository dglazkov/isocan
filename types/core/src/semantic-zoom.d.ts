import type { JsonSchema } from "./jev.js";
import type { CanvasContents, Item } from "./model.js";
/** Bumped on any change to the prompt's words; part of every content key, so a bump re-summarises everything at once, on purpose. */
export declare const SEMANTIC_ZOOM_PROMPT_VERSION = "sz-1";
/**
 * A note is summarised only when its words are longer than this (design §10,
 * decision 2). A shorter note keeps showing its opening words, which are
 * already most of it — 16 of the bench fixture's 20 notes clear the line, and
 * the four it leaves out are their own title.
 */
export declare const SUMMARY_MIN_WORDS = 40;
/**
 * How long a source must have been quiet before it is summarised (design §6).
 * Ten edits in a minute cost one summary; until then the old summary keeps
 * showing with its updating mark.
 */
export declare const SUMMARY_QUIET_MS = 30000;
/**
 * The model a summary asks for when `ISOCAN_SUMMARY_MODEL` names none and the
 * home's text key is Claude's: the cheapest tier. A summary is a short,
 * high-volume, low-stakes call; `/api/text`'s own default is the most capable
 * tier, which is wrong for this (design §7).
 */
export declare const SUMMARY_MODEL = "claude-haiku-5-5";
/**
 * The system line a summary is asked under. `/api/text`'s generator sends a
 * copywriting one ("You write the words on an app's screens…"), which phase 0
 * found would ask a summary of a copywriter; the make route sends this instead.
 */
export declare const SUMMARY_SYSTEM = "You summarise what is on a canvas for someone looking at it from too far away to read it. Answer with the JSON the schema asks for and nothing else.";
/** The schema the text model is asked to fill: one string, nothing else. */
export declare const SUMMARY_SCHEMA: JsonSchema;
/** The summaries route for one canvas: `GET` reads cached entries by key, `POST` asks for one to be made. */
export declare function summariesRoute(canvasId: string): string;
/** The source changed less than `SUMMARY_QUIET_MS` ago: a 202, not a refusal, carrying `retryAfterMs`. */
export declare const SUMMARY_QUIET = "summary-quiet";
/** The model's answer broke the answer rule; nothing was cached. */
export declare const SUMMARY_BAD_ANSWER = "summary-bad-answer";
/** The source is excluded from context (itself or a group above it), so it is never sent to a model. */
export declare const SUMMARY_EXCLUDED = "summary-excluded";
/** There is no text node by that id on this canvas. */
export declare const SUMMARY_NO_SOURCE = "summary-no-source";
/** What a summary is of. Phase 1 makes `text`; groups and areas are phase 2's. */
type SummaryKind = "text" | "group" | "area";
/**
 * **One cached summary** — `<home>/summaries/<canvasId>/<key>.json` (design
 * §5). `short` marks a note under `SUMMARY_MIN_WORDS`: nothing to summarise,
 * remembered so nobody asks again, and `summary` is null. `madeFor` is whose
 * key paid, for the cost record — never shown as an author. `stale` is set on
 * a read that asked for one key and was answered with the newest entry for
 * the same source instead (the content changed and no summary of the new
 * content exists yet).
 */
export interface SummaryEntry {
    key: string;
    kind: SummaryKind;
    sourceIds: string[];
    summary: string | null;
    short?: true;
    words: number;
    model: string | null;
    promptVersion: string;
    madeAt: string;
    madeFor: string | null;
    stale?: true;
}
/** `GET` answers the entries it holds, by the key that was asked about. */
export interface SummaryRead {
    summaries: Record<string, SummaryEntry>;
}
/** `POST`'s answer while the source is still settling: ask again after `retryAfterMs`. */
export interface SummaryWait {
    code: typeof SUMMARY_QUIET;
    retryAfterMs: number;
}
/** `POST` asks for one: the kind, and the source's item id. The home collects the content, never the client. */
export interface SummaryMake {
    kind: SummaryKind;
    sourceId: string;
}
/** One source as the prompt shows it: a note's words; a group's or an area's members. */
type SummarySource = {
    kind: "text";
    title: string;
    body: string;
} | {
    kind: "group" | "area";
    title: string;
    members: Array<{
        kind: "note" | "screen" | "card";
        title: string;
        body?: string;
        text?: string;
    }>;
};
/**
 * **The prompt for one thing** (design §7), the bench's words unchanged: a
 * framing line per kind, one shared instruction, and the content inside a
 * fence that says it is data — a note can hold "ignore the above". Vision
 * (§11) and a screen alone are phase 3b's and are not here yet.
 */
export declare function semanticZoomPrompt(source: SummarySource): string;
/** Words as the answer rule and the 40-word line count them. */
export declare function wordCount(text: string): number;
/**
 * **The answer rule** (design §7): non-empty, under `SUMMARY_MAX_WORDS`
 * words, one line, plain text, no preamble. Returns the reasons an answer
 * fails; empty means it passes. A failing answer is dropped, never cached.
 */
export declare function checkSummary(text: unknown): string[];
/**
 * **A text node that may be summarised, or why not.** The node must be a
 * text node on this canvas, and neither it nor any group above it may be
 * excluded from context (`properties.context === "excluded"`): excluded
 * content never reaches a model (journey scene 5). The home asks this before
 * it reads a word; the web asks it so it does not ask the home for a node it
 * would refuse.
 */
export declare function summarisableText(canvas: CanvasContents, itemId: string): Item | "excluded" | null;
/**
 * **The content key** (design §4): SHA-256 over the prompt version, the kind,
 * and for each source its item id, its current version id and its title.
 * An edit is a new version and so a new key; a move changes none of them and
 * so keeps it; an undo that restores a version restores the old key, and the
 * old summary is found still cached. Nothing is fixed at birth — the summary
 * is looked up by its inputs every time it is drawn.
 *
 * `crypto.subtle`, which the browser and Node both have, so the web and the
 * home compute the same key from the same item.
 */
export declare function textSummaryKey(item: Pick<Item, "id" | "currentVersionId" | "title">): Promise<string>;
export {};
