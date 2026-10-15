import type { Actor, CanvasContents, Item } from "./model.js";
import { type NightLead, type NightSeen } from "./goodnight.js";
/** Why a move was made, as the canvas recorded it at the time. */
interface MoveReason {
    text: string;
    source: "comment" | "variation" | "proposal" | "decision";
    commentId?: string;
    threadId?: string;
}
/** One move in an item's history: a run of versions by one hand, or one decisive version. */
interface ExplainMove {
    /** `made`: the first run; `edited`: a later run; `chose`: a variation folded in; `kept`: a proposal kept; `decided`: a design comparison adopted. */
    kind: "made" | "edited" | "chose" | "kept" | "decided";
    /** 1-based version numbers, the item's own badge: v`from`–v`to`. */
    from: number;
    to: number;
    versionId: string;
    /** The version before the move began, when there was one — what Compare holds it against. */
    before: string | null;
    who: Actor;
    at: string;
    reason: MoveReason | null;
    /** On `chose` and `kept`: what was folded in (now in the trash), and on `kept` who proposed it. */
    chosen?: {
        itemId: string;
        title: string;
        by: Actor;
        siblings: number;
    };
}
/** One road not taken. */
interface ExplainRoad {
    kind: "variation" | "proposal" | "option" | "preferred";
    title: string;
    itemId: string | null;
    by: Actor | null;
    /** Its own reason: the comment that made it, its why, a hypothesis and trade-off. */
    why: string | null;
    where: "trash" | "canvas" | "gone";
}
/** One thing that moved around the item after its current version. */
interface ExplainMoved {
    kind: "design" | "item" | "proposal";
    itemId: string;
    title: string;
    /** Versions made after this item's current one. */
    newer: number;
    /** The newest of them, 1-based, and who made it. */
    latest: number;
    by: Actor;
    at: string;
}
/** A phrase somebody typed about the item, beside how a designer would say it. */
interface ExplainSpeak {
    said: string;
    designer: string;
    means: string | null;
    /** `glossary`: `design-words.ts` matched it; `lead`: the lead agent's critique paired it. */
    from: "glossary" | "lead";
    commentId: string;
}
/** The lead agent's critique, as its `record` comment carries it. */
interface ExplainCritique {
    commentId: string;
    threadId: string;
    by: Actor;
    at: string;
    working: string;
    risk: string;
    tryThis: string;
    /** The proposal citing `explain:<commentId>`, while it hangs beneath the item. */
    proposal: {
        itemId: string;
        title: string;
    } | null;
}
/** The whole derived story of one item. */
export interface ExplainStory {
    itemId: string;
    title: string;
    versions: number;
    /** Every move, oldest first; `seams` picks the ones that mattered. */
    moves: ExplainMove[];
    roads: ExplainRoad[];
    moved: ExplainMoved[];
    speak: ExplainSpeak[];
    critique: ExplainCritique | null;
    /** A critique was asked for after the latest one, and has not arrived. */
    asked: boolean;
    /** Drawn at wireframe fidelity — `isocan wire why` explains its slots. */
    wire: boolean;
}
/**
 * **What *Critique* posts** — an ordinary summons to the lead, naming the
 * item and how to answer. The comment carries the item in `items`, so it is
 * found again by what it is about.
 */
export declare function critiqueAsk(lead: Actor, item: Pick<Item, "id" | "title">): string;
/** The lead's critique as its `record` comment says it — the shape `readCritique` reads back. */
export declare function critiqueBody(item: Pick<Item, "title">, c: {
    working: string;
    risk: string;
    tryThis: string;
    speak?: readonly {
        said: string;
        designer: string;
    }[];
}): string;
/** `--speak "make it pop => raise its contrast"` — a pair, or why it is not one. */
export declare function parseSpeak(text: string): {
    said: string;
    designer: string;
} | {
    refused: string;
};
/**
 * **Why nothing can critique here**, or null when the lead can answer — the
 * night watch's own reading of who leads and who is listening, said without
 * the night in it.
 */
export declare function critiqueCannot(lead: NightLead, personId: string, seen: NightSeen): string | null;
/**
 * **The story of one item**, or why there is none. Read off the canvas
 * alone — no log, no model — so the CLI, the panel and a test on a fixture
 * all get the same answer.
 */
export declare function explainStory(canvas: CanvasContents, itemId: string): ExplainStory | {
    refused: string;
};
/**
 * **The moves that mattered**: at most four — the first and the latest always,
 * then the decisive ones (a `choose`, a kept proposal, an adopted decision),
 * then those with a reason, then the longest runs — in the order they
 * happened.
 */
export declare function seams(story: ExplainStory): {
    moves: ExplainMove[];
    hidden: number;
};
/** One line of an explanation, with what a surface may link it to. */
export interface ExplainLine {
    text: string;
    itemId?: string;
    threadId?: string;
    trash?: boolean;
    /** The two versions a Compare opens on a move: the one before it, and its last (version ids). */
    compare?: {
        itemId: string;
        from: string;
        to: string;
    };
}
/** One section: a heading and its lines. */
interface ExplainSection {
    key: "how" | "roads" | "moved" | "speak" | "critique" | "wire";
    heading: string;
    lines: ExplainLine[];
}
/**
 * **The explanation, in sections** — what `isocan explain` prints and the
 * panel draws, so the two say one thing. Empty optional sections (roads not
 * taken, critique before one arrives) are omitted rather than shown as empty
 * placeholders.
 */
export declare function explainSections(story: ExplainStory): ExplainSection[];
/** `isocan explain`'s words: the sections, as a terminal prints them. */
export declare function explainText(story: ExplainStory): string;
/**
 * **Copy as rationale**: the explanation as a note somebody outside the team
 * can read — the moves, the roads not taken, what moved, the critique when
 * there is one — in Markdown, dated, saying where it came from.
 */
export declare function rationaleText(story: ExplainStory, now: number): string;
/**
 * **Where a rationale stands**: to the right of the item, top-aligned with
 * it, moved by core's free-spot search until its footprint lands on nobody's
 * — one answer for both surfaces. Returns the box and the top-left to send as
 * `chosen`.
 */
export declare function rationaleSpot(canvas: CanvasContents, item: Item, body: string): {
    width: number;
    height: number;
    x: number;
    y: number;
};
export {};
