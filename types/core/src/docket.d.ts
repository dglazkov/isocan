import type { Item } from "./model.js";
import type { Operation } from "./ops.js";
/** The two verdict marks, and no more: a docket where six emoji mean six
 *  things is a docket nobody can read at a glance. */
export declare const DOCKET_MARKS: {
    readonly accepted: "✅";
    readonly rejected: "❌";
};
/** ✋ — "I am taking this". Not a verdict: a claim closes nothing, and it
 *  lives on the canvas only (the script never commits it). */
export declare const DOCKET_CLAIM = "\u270B";
/** What an answer says — the words the run pages carry in their outcome cell. */
export type DocketVerdict = keyof typeof DOCKET_MARKS;
type Marked = Pick<Item, "reactions"> & {
    properties?: Item["properties"];
};
/** The question's slug, or null for an item that is not on the docket. */
export declare function docketSlug(item: Marked): string | null;
/**
 * **What the marks say.** One verdict worn → that verdict; both → contested,
 * which is two people disagreeing and stays on the docket (the script writes
 * neither — picking a side is not a tool's job); none → null, still open.
 */
export declare function docketVerdict(item: Marked): DocketVerdict | "contested" | null;
/**
 * **The ops that answer a question as this actor**: the chip clicks a person
 * would make to say it — take the other verdict off if they wear it, then put
 * this one on. Offs first, so the item never reads as contested between the
 * two. Empty when the actor already says exactly this.
 */
export declare function docketAnswer(item: Item, verdict: DocketVerdict, actorId: string): Operation[];
export {};
