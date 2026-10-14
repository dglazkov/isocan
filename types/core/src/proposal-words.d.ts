import type { CanvasContents, Item } from "./model.js";
import { type ProposalCite, type ProposalConfidence } from "./proposal.js";
/**
 * **The words around a proposal** — what the CLI writes and the canvas says
 * about one (proactive-agent phase 1): reading a `--cites`, the properties a
 * proposal is born with, the trigger chip's words, the taste note and the
 * delete's comment. Apart from `proposal.ts` on purpose: that file is the
 * reducer's (the cite and cap rules run at the writer), so whatever lives in
 * it rides the web's entry chunk; nothing here is needed before somebody
 * proposes, looks at a proposal or deletes one.
 */
/** `kind:ref`, as the CLI's `--cites` takes it — or why it is not one. */
export declare function parseCite(text: string): ProposalCite | {
    refused: string;
};
/** The properties an `item.add` carries for a proposal of `sourceId`. */
export declare function proposalProperties(sourceId: string, confidence: ProposalConfidence, cites: readonly ProposalCite[], why: string): Record<string, string>;
/**
 * **What the trigger chip says** — the first cite, in words. A comment cite
 * is found on the canvas and quoted with its author ("Ravi's comment, "people
 * miss the pickup slot""); anything else says its kind and ref.
 */
export declare function citeLabel(canvas: CanvasContents, cite: ProposalCite): string;
/** The note's title — the person reads it on the canvas. */
export declare const TASTE_TITLE = "What your deletes taught";
/** The canvas's taste note, if it has one. */
export declare function tasteNote(canvas: CanvasContents): Item | null;
/** The properties a new taste note is born with. */
export declare function tasteProperties(): Record<string, string>;
/** The note's text with one more line — a bullet, on its own line, under the title. */
export declare function tasteWithLine(current: string | null, line: string): string;
/** The words a delete's comment carries — what the author reads in the thread; agents read `comment.deleted`. */
export declare function deletedBody(title: string, reason: string): string;
