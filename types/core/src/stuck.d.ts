import type { Actor, CanvasContents } from "./model.js";
import type { LogEntry } from "./ops.js";
/**
 * **Stuck detection** (proactive-agent phase 7, design §10).
 *
 * A person asks for a new header four times in ten minutes, each ask shorter
 * ("again", "no"), and each take is set aside within a minute. A fourth take
 * would be a fourth guess. The agent should stop, say it has been guessing,
 * and ask with pictures instead.
 *
 * This is the deterministic half: **whether the last tries at one item, by
 * one person, all missed** (`stuckOn`), read from the oplog the way
 * `evals.ts` reads it — asks, the results that followed them, and which of
 * those were taken back (`undoneSeqs`, never `LogEntry.undoneBy`, which does
 * not travel). It writes nothing and calls no model. The other half is the
 * lead's, through the ordinary summons: what it noticed in the takes ("you
 * kept the photo every time") and the four tiles' words, posted as one
 * record (`stuckQuestionBody`) that both surfaces draw (`stuckSections`).
 *
 * **What counts** — chosen 14 Oct 2026, Dion to confirm:
 *
 * - **An ask about the item**: the person's comment that summons somebody (an
 *   @-mention, or anything in the Chat) and is about the item — its thread is
 *   anchored there, or it names the item (`#ref` or the selection), or it
 *   names nothing and the person's previous ask in the same thread was about
 *   it ("again", "no").
 * - **A try**: an ask answered by somebody else's work on the item before the
 *   person's next ask about it — a new version of it, or a new item made from
 *   it (`parent=`).
 * - **A miss**: every result of the try was undone, set aside (the item's
 *   current version moved off it) or deleted; or the person asked again
 *   within `STUCK_QUICK_MS` of it; or asked again with fewer words than the
 *   try's own ask (asks getting shorter). Anything else is a **keep**, and a
 *   keep starts the count again — so does an answer to the stuck question.
 * - **Stuck**: the last `STUCK_TRIES` tries were all misses, from the first
 *   of them to the newest ask within `STUCK_WINDOW_MS`, and not longer ago
 *   than that.
 *
 * Its own export path (`@isocan/core/stuck`), so none of this reaches the
 * web's entry chunk: the stuck card loads it, the CLI loads it on
 * `isocan stuck`, and the rc on a summons.
 */
/** Tries in a row that all missed before the agent stops guessing. */
export declare const STUCK_TRIES = 3;
/** The tries and the ask after them fall within this, and the newest is no older (ms). */
export declare const STUCK_WINDOW_MS: number;
/** Asked again this soon after a take, the take did not land (ms). */
export declare const STUCK_QUICK_MS: number;
/** The four now-and-instead pairs (design §10), fixed for now — chosen 14 Oct 2026, Dion to confirm. */
export declare const STUCK_AXES: readonly [{
    readonly id: "density";
    readonly name: "Density";
}, {
    readonly id: "brand";
    readonly name: "Brand expression";
}, {
    readonly id: "layout";
    readonly name: "Layout";
}, {
    readonly id: "tone";
    readonly name: "Tone of voice";
}];
type AxisId = (typeof STUCK_AXES)[number]["id"];
/** How a try missed. */
type Fate = "undone" | "set aside" | "deleted" | "asked again" | "asked shorter";
/** One try: an ask, and what became of the work that answered it. */
interface StuckTry {
    askId: string;
    ask: string;
    at: string;
    /** Who answered it with work. */
    by: Actor;
    /** The versions of the item it made, and the items it made from it. */
    versionIds: string[];
    childIds: string[];
    fate: Fate;
    /** From the take to its fate (ms). */
    afterMs: number;
}
/** A person, stuck on one item: the tries that missed, the ask waiting, and what a person can read in them. */
export interface Stuck {
    itemId: string;
    person: Actor;
    /** The misses in a row, oldest first (at least `STUCK_TRIES`). */
    tries: StuckTry[];
    /** The ask after the last miss that nothing has answered yet — the one that should get a question, not a take. */
    pending: {
        commentId: string;
        at: string;
        ask: string;
    } | null;
    /** No ask had more words than the one before it, and the last had fewer than the first. */
    shorter: boolean;
    /** The question's address: `<item> · <ask>` — the ask it answers. */
    at: string;
    /** What the behaviour says, in words — not what the takes held; that is the lead's to notice. */
    facts: string[];
}
/**
 * **Is this person stuck on this item?** The misses in a row, the ask that
 * waits after them, and what the behaviour says — or null. Deterministic over
 * the log: the same entries give the same answer on every surface. `now`
 * (ms, default the newest entry's time) decides "not longer ago than the
 * window": a person who comes back tomorrow is not stuck from yesterday.
 */
export declare function stuckOn(entries: readonly LogEntry[], itemId: string, actorId: string, now?: number): Stuck | null;
/**
 * **Everyone stuck, on anything** — one reading per person and item, newest
 * first. What a surface reads when it has no item in hand: the person's own
 * card, `isocan stuck` with no item, and the rc finding the item a Chat ask
 * was about.
 */
export declare function stuckAll(entries: readonly LogEntry[], now?: number): Stuck[];
/** One now-and-instead pair, and which side the lead would bet on. */
export interface StuckTile {
    axis: AxisId;
    now: string;
    instead: string;
    guess: "now" | "instead";
}
/** The lead's question: what it noticed, and the four tiles. */
export interface StuckQuestion {
    observations: string[];
    tiles: StuckTile[];
}
/** `density`, `Brand expression`, `tone of voice` → the axis, or null. */
export declare function stuckAxis(raw: string): AxisId | null;
/**
 * Why the question may not be posted, or null: the person must be stuck on
 * the item (the agent asks instead of guessing, not instead of working); one
 * to three observations, each one sentence, none saying the person is stuck
 * (the agent owns the miss); the four axes, each once, both sides said, and a
 * guess on every one.
 */
export declare function stuckQuestionRefusal(stuck: Stuck | null, title: string, q: StuckQuestion): string | null;
/** The question, as its `record` comment says it — the shape `stuckQuestionOf` reads back. */
export declare function stuckQuestionBody(stuck: Stuck, title: string, q: StuckQuestion): string;
/** The lead's question for this stuck reading (`Stuck.at`), if it has come. */
export declare function stuckQuestionOf(canvas: CanvasContents, at: string): (StuckQuestion & {
    by: Actor;
    commentId: string;
}) | null;
/** How the person answers: a side per tile, or one of the two ways out. */
export type StuckAnswer = {
    kind: "tiles";
    picks: Array<{
        axis: AxisId;
        side: "now" | "instead";
    }>;
} | {
    kind: "extremes";
} | {
    kind: "product";
    name: string;
};
/** The person's answer, as an ordinary comment to the lead: it summons, and it resets the count. */
export declare function stuckAnswerBody(lead: Pick<Actor, "name">, at: string, q: StuckQuestion | null, a: StuckAnswer): string;
/** Whether this stuck reading has been answered — by anybody's `Stuck answer (…)` comment. */
export declare function stuckAnswered(canvas: CanvasContents, at: string): boolean;
/** One section as both surfaces show it. */
interface StuckSection {
    key: "guessing" | "noticed" | "tiles" | "ways" | "waits";
    heading: string;
    lines: Array<{
        text: string;
        axis?: AxisId;
        now?: string;
        instead?: string;
        guess?: "now" | "instead";
    }>;
}
/**
 * **The stuck reading, in sections** — the card draws them and `isocan stuck`
 * prints them, so the two say the same. The heading names who made the
 * takes; `lead` is who was asked, `waits` why the question has not come
 * (null once it has).
 */
export declare function stuckSections(stuck: Stuck, title: string, q: StuckQuestion | null, lead: string | null, waits: string | null): StuckSection[];
export {};
