import type { Actor, CanvasContents, Item } from "./model.js";
import type { DesignBrief } from "./design-partner.js";
import type { DesignBriefFields } from "./design-request.js";
/**
 * **The brief, as a card** (proactive-agent phase 5, design §7).
 *
 * A design request's brief already lives on the canvas as an item (the
 * `design.request` record, `design-brief.ts`), and its facts already say who
 * said them: `origin` is `supplied` (the person said it), `context` (read off
 * the canvas) or `assumed` (an agent inferred it). This is the one reading of
 * that record as six lines a person can scan — **Making**, **For**, **Should
 * feel**, **Never**, **Constraints**, **Right now** — with the said ones drawn
 * solid and the inferred ones in pencil, so the web card, `isocan design
 * card` and the tests all print one answer.
 *
 * **The card is a view of the brief, not a copy.** Every edit it offers —
 * *Right* (an inferred line becomes the person's), *Wrong* (it goes, and the
 * person says what it should be), or a new value — is a patch for the
 * ordinary `design brief --update` door (`briefEditPatch`), so the brief stays
 * the record and its history names whoever made each change.
 *
 * **An edit changes nothing by itself; it only re-reads** (`briefChanges`,
 * `briefReread`). Every screen in the brief's scope is sorted, derived and
 * unwritten: *assumed the old line* when a proposal beneath it cites the
 * changed line (`brief:<line>`) or its evidence was checked against the brief
 * before the edit; *matters more now* when the canvas's lead agent says so,
 * through the ordinary summons (`rereadAsk`), with its ONE clarifying
 * question (`rereadBody`); *still holds* otherwise. Nothing here calls a
 * model and nothing here writes: with nobody to answer, the card still works
 * and says the re-read waits.
 */
/** The six lines, in the card's order. */
type BriefLineKey = "making" | "for" | "feel" | "never" | "constraints" | "now";
type BriefFact = DesignBrief["facts"][number];
/** How many inferred lines the card shows at once (design §7): more reads as presumption. */
export declare const BRIEF_ASSUMED_CAP = 4;
/** What the person seems to be doing, read from the canvas — the sensed half of **Right now**. */
type BriefMode = "exploring" | "refining" | "shipping";
/** The three, for the card's choice and the CLI's refusal. */
export declare const BRIEF_MODES: readonly BriefMode[];
/** One line of the card. */
export interface BriefCardLine {
    /** One of the six, or `fact:<id>` for a fact that is none of them. */
    key: BriefLineKey | `fact:${string}`;
    label: string;
    /** Null: nobody has said or inferred it yet. */
    value: string | null;
    /** The person said it (solid rule); otherwise inferred (pencil rule, with Right and Wrong). */
    said: boolean;
    /** Where the value came from; `sensed` is Right now read off the canvas. */
    origin: BriefFact["origin"] | "sensed" | null;
    /** The fact holding it, when a fact does — what Right and Wrong change. */
    factId: string | null;
    /** What a proposal answering this line cites: `--cites brief:<cite>`. */
    cite: string;
}
/** The card: its lines (inferred ones capped), how many inferred lines wait unshown, and the request's intent. */
export interface BriefCard {
    lines: BriefCardLine[];
    quiet: number;
    intent: string;
}
/**
 * **The line a `brief:` cite answers**, as its chip says it (`cites · For`) —
 * or null for a ref that names no line (a fact's own id, read without the
 * brief in hand). A line answers to its key (`for`), the brief field behind
 * it (`audience`), and the words a fact for it is named by.
 */
export declare function briefLineLabel(ref: string): string | null;
/**
 * **Right now, as the canvas reads it** (design §7: a mode the agent reads
 * from behaviour). A finished request is *shipping*; two or more takes in
 * play — open proposals or variations beneath its screens — is *exploring*;
 * a new request on screens nobody has reworked yet is *exploring*; anything
 * else is *refining*. Drawn as an assumed line: the lead may overrule it by
 * writing a `now` fact, and the person by Right or Wrong.
 */
export declare function sensedMode(canvas: CanvasContents, brief: DesignBrief): BriefMode;
/**
 * **The card, from the brief** — and from the canvas, for the sensed half of
 * Right now (without it, the mode is read off the intent alone, which is what
 * a comparison of two briefs wants). A line is the brief's own field when it
 * has one and it is set (the person's, solid), else the first fact named for
 * it (solid when `supplied`, pencil otherwise), else empty; facts that are
 * none of the six follow as lines of their own. At most `BRIEF_ASSUMED_CAP`
 * inferred lines show; `quiet` counts the rest.
 */
export declare function briefCard(brief: DesignBrief, canvas?: CanvasContents): BriefCard;
/** The line a person or an agent names — its key (`for`), its label (`Should feel`), or a fact's id or name. */
export declare function findBriefLine(card: BriefCard, name: string): BriefCardLine | null;
/** An edit the card offers: Right, Wrong (with the right value, or none), or a new value. */
export type BriefEdit = {
    act: "right";
} | {
    act: "wrong";
    value?: string;
} | {
    act: "set";
    value: string;
};
/**
 * **The `design brief --update` patch for one edit to one line**, or why it
 * is not one. *Right* turns an inferred line into the person's (`origin:
 * supplied`; a sensed Right now becomes a `now` fact); *Wrong* removes the
 * inferred fact, and with a value puts the person's in its place; a value on
 * any line sets it as the person's. Nothing but the brief is patched.
 */
export declare function briefEditPatch(brief: DesignBrief, line: BriefCardLine, edit: BriefEdit): Partial<DesignBriefFields> | {
    refused: string;
};
/** One line an edit changed. */
interface BriefChange {
    key: BriefCardLine["key"];
    label: string;
    /** Every ref a cite of this line may use: its key, its field, its fact's id. */
    refs: string[];
    before: string | null;
    after: string | null;
}
/**
 * **What an edit changed**: the lines whose words differ between two
 * versions of a brief. A Right that only turns pencil to ink changes no
 * words, so it re-reads nothing — the screens already assumed that line.
 */
export declare function briefChanges(before: DesignBrief, after: DesignBrief): BriefChange[];
/** The screens a brief is about: every screen on the canvas, or in its group when it has one — proposals aside. */
export declare function briefScreens(canvas: CanvasContents, brief: Pick<DesignBrief, "groupId">): Item[];
/** One screen, sorted, with why when it is not simply *still holds*. */
export interface RereadScreen {
    itemId: string;
    title: string;
    because?: string;
}
/** The re-read: what changed, and every screen in one of three piles. */
export interface BriefReread {
    changes: BriefChange[];
    /** Assumed the old line: something beneath it cites it, or its evidence predates the edit. */
    old: RereadScreen[];
    /** The lead agent's call, with its question. */
    more: RereadScreen[];
    holds: RereadScreen[];
}
/** A receipt as the re-read reads it: the screen it vouched for and the brief version it was checked against. */
interface RereadReceipt {
    outputItemId: string | null;
    briefVersionId: string;
}
/**
 * **Sort every screen after an edit** — derived, and written nowhere. A
 * screen *assumed the old line* when an open proposal beneath it cites a
 * changed line (`brief:<key|field|fact>`), or a receipt vouched for it
 * against a brief version before `afterVersionId`; it *matters more now* when
 * the lead named it (`matters`); otherwise it *still holds*.
 */
export declare function briefReread(canvas: CanvasContents, brief: DesignBrief, changes: BriefChange[], opts: {
    afterVersionId: string;
    receipts?: readonly RereadReceipt[];
    matters?: readonly string[];
}): BriefReread;
/** Where a re-read is about: the brief item and the version the edit made. */
export interface RereadAt {
    itemId: string;
    versionId: string;
}
/**
 * **What an edit posts to the lead** — an ordinary summons, as Explain's
 * Critique is: what changed, the derived sort, and how to answer. The lead
 * names the screens that matter more now and asks ONE clarifying question.
 */
export declare function rereadAsk(lead: Pick<Actor, "name">, at: RereadAt, reread: BriefReread): string;
/** Why a question is not ONE clarifying question, or null. */
export declare function rereadQuestionRefusal(question: string): string | null;
/** The lead's answer, as its `record` comment says it — the shape `rereadAnswer` reads back. */
export declare function rereadBody(at: RereadAt, matters: ReadonlyArray<Pick<Item, "id" | "title">>, question: string): string;
/** The lead's latest answer to a re-read of this version, if it has come. */
export declare function rereadAnswer(canvas: CanvasContents, at: RereadAt): {
    by: Actor;
    matters: string[];
    question: string;
    commentId: string;
} | null;
/** Whether a re-read of this version was asked for. */
export declare function rereadAsked(canvas: CanvasContents, at: RereadAt): boolean;
export {};
