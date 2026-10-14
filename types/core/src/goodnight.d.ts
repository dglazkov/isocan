import type { Actor, CanvasContents, Comment, CommentThread, EnrolledAgent, Item } from "./model.js";
import type { LogEntry } from "./ops.js";
import type { PresenceSession, RcAnsweringResponse } from "./protocol.js";
import type { ActorJoins } from "./identity.js";
import { type ProposalCite } from "./proposal.js";
/**
 * **The night watch** (proactive-agent phase 2, design §4).
 *
 * A person says they are stopping — `/goodnight` in the Chat, `isocan
 * goodnight` in a terminal, and nothing else (no closed tab, no idle) — and
 * that opens a conversation with the canvas's lead agent about what to work
 * on overnight. The agent opens with what it read (settled today, left open,
 * a few things it could try), the person steers, and the conversation ends
 * when the person says so ("That's the plan", a comment carrying
 * `goodnight: { step: "plan" }`). Only then does the agent write the note
 * from what was agreed: a text node near the work, and under each item a
 * ticked line concerns an empty dashed frame (`proposal=promised`).
 *
 * Everything here is pure and reads only what the canvas and its log already
 * hold — no op, no stored field beyond the note's own properties — so the
 * CLI that writes a note, the web that unticks a line and the tests that hold
 * the rules all read one answer:
 *
 * - **Settled today** and **left open** are DERIVED (`settledToday`,
 *   `leftOpen`), each line cited, never written by hand.
 * - **The promise rules** (`planNight`): only lines the conversation agreed;
 *   at most the lead's free room under `PROPOSAL_CAP`, promised frames
 *   counted; an original is edited only when the person NAMED it in the
 *   conversation, and never the design system or what was settled today; one
 *   person's night never touches an item another person's open goodnight
 *   named.
 * - **Nothing can answer** (`nightAnswerable`): before anything is promised
 *   the note says whether the lead can answer overnight, and if not it says
 *   why and promises nothing.
 *
 * The note's whole model rides in one property (`handoffNote`, JSON), and its
 * text is regenerated from it (`noteText`) on every change, so the words a
 * person reads and the lines an agent fills cannot disagree.
 */
/** `handoff=<person id>`: whose goodnight a note is. */
export declare const HANDOFF_PROP = "handoff";
/**
 * `handoffReviewed=<ISO>`: the person's morning review of this note was seen
 * (phase 3, `morning.ts`) — the note is closed from then on, so it stops
 * holding other people's goodnights off the items it named. Written by the
 * person's client on arrival, not by an act of theirs, so an `item.update`
 * setting only this has no inverse (`invert.ts`): it is on nobody's ⌘Z.
 */
export declare const HANDOFF_REVIEWED_PROP = "handoffReviewed";
/** On a failed promise: it still shows the take it would have made (`converge.ts` spells it too). */
export declare const PROMISE_TAKE_PROP = "promiseTake";
/** One cited line of *settled today* or *left open*. */
export interface NightCited {
    what: string;
    itemId?: string;
    cite: ProposalCite;
}
/** One line of *Tonight I will*. */
export interface NightLine {
    /** 1-based, stable for the note's life — `untick 2`, `promise:<note>#2`. */
    n: number;
    text: string;
    /** What it may spend: "three takes", "one new version". */
    budget: string;
    /** The item it concerns. */
    on: string;
    /** True: the agreed work edits `on` itself, as a new version. False: a proposal beside it. */
    edit: boolean;
    /** Only ticked lines are promises. */
    ticked: boolean;
    /** The promised frame's item id (a proposal line, while it stands). */
    frame?: string;
    /** How the night went for this line, once the agent has said. */
    result?: {
        done: true;
    } | {
        failed: string;
    };
}
/** A goodnight note's model. */
export interface NightNote {
    person: Actor;
    lead: Actor | null;
    settled: NightCited[];
    open: NightCited[];
    lines: NightLine[];
    /** What the agent added to *will not touch*. It may add, never remove. */
    wont: string[];
    /** The free line: a thought left for the morning. */
    thought?: string;
    /** ISO — when the morning may look. */
    ready: string;
    /** Why nothing is promised, when nothing is. */
    nothing?: string;
    /** Items the person named in the conversation. */
    named: string[];
    /** Titles at writing, for the words: the note still reads after a rename. */
    titles: Record<string, string>;
    /**
     * Items the person changed in the hour before their `/goodnight`
     * (`midwayItems`): off limits overnight unless a ticked line names one.
     */
    midway?: string[];
    /** What the agent saw and did not act on, each with its reason (`goodnight done --left`). */
    left?: {
        what: string;
        why: string;
    }[];
}
/** What a reader saw of who is listening — the CLI's `rcAnswering` and sessions, or the web's. */
export interface NightSeen {
    answering?: RcAnsweringResponse | null;
    sessions?: readonly PresenceSession[];
    joined?: ActorJoins;
}
/** The canvas's lead agent, and how it was chosen. */
export interface NightLead {
    agent: EnrolledAgent | null;
    /** `named`: the canvas's `proactive=` property; `standing`: the first answerable standing agent; `none`. */
    how: "named" | "standing" | "none";
    /** The name `proactive=` gave, when one did. */
    named?: string;
}
/**
 * **Who leads the night** (design §2.6): the agent the canvas names with
 * `proactive=<name>`, set by a person; with none named, the canvas's first
 * standing agent that something answers for (critics excluded — they never
 * act), else its first standing agent at all, so the refusal can name it.
 */
export declare function nightLead(canvas: CanvasContents, canvasProps: Record<string, string>, seen: NightSeen): NightLead;
/**
 * **Can anything answer overnight, for this person?** Null when the lead can
 * (an rc answers for it, or it is parked on `wait`, and its gate takes this
 * person's word); otherwise why not, in a sentence the note prints — the
 * night then promises nothing.
 */
export declare function nightAnswerable(lead: NightLead, personId: string, seen: NightSeen): string | null;
/**
 * **Settled today, by this person** (design §4): today's `choose`, design
 * decisions, kept *maybes* and `prefer` records, and every new DESIGN.md
 * version (whoever wrote it). Read from the canvas and the day's log; undone
 * acts do not count.
 *
 * A `choose` is read off the canvas itself: a version the person added to an
 * item today whose bytes are those of a child of it they trashed today — the
 * fold `converge.ts` makes — so it needs no marker that does not exist.
 */
export declare function settledToday(canvas: CanvasContents, entries: readonly LogEntry[], personId: string, sinceMs: number, joined?: ActorJoins): NightCited[];
/**
 * **Left open** (design §4): the questions nobody has answered (`/ask`), the
 * wireframe *maybes* nobody kept, and the proposals still waiting on a keep
 * or a delete — each cited. Doubts the agent read in today's comments are its
 * own to add (`isocan goodnight note --open`), each with the comment it cites.
 */
export declare function leftOpen(canvas: CanvasContents): NightCited[];
/** A person's goodnight conversation, as the Chat holds it. */
export interface GoodnightTalk {
    /** The `/goodnight` comment that opened it. */
    ask: Comment;
    /** Everything said after it, by anyone. */
    after: Comment[];
    /** The person said "That's the plan". */
    planned: boolean;
    /** Items the person named in it — by #-reference or by title. */
    named: string[];
}
/**
 * **This person's latest goodnight conversation**, or null: from their last
 * `/goodnight` in the thread, through everything after it. Only the person's
 * own words name items — what the agent suggested is not what they agreed.
 */
export declare function goodnightTalk(canvas: CanvasContents, thread: CommentThread | undefined | null, personId: string, joined?: ActorJoins): GoodnightTalk | null;
/** A goodnight note's model, or null when the item is not one. */
export declare function readNote(item: Pick<Item, "properties">): NightNote | null;
/** The properties a note carries: whose it is, and its model. */
export declare function handoffProperties(note: NightNote): Record<string, string>;
/** The goodnight notes on a canvas, each with its model — newest first. */
export declare function goodnightNotes(canvas: CanvasContents): {
    item: Item;
    note: NightNote;
}[];
/**
 * **What other people's goodnights have named** — item id → the person —
 * from their open notes (every line's item, every item their conversation
 * named) and from a conversation still under way (asked after their latest
 * note). One person's promises never touch these (Dion, 14 Oct 2026).
 */
export declare function namedByOthers(canvas: CanvasContents, thread: CommentThread | undefined | null, personId: string, now: number, joined?: ActorJoins): Map<string, Actor>;
/** One line the conversation agreed, as the agent hands it to `planNight`. */
export interface NightAsk {
    text: string;
    /** The item it concerns, by id. */
    on: string;
    /** Edit `on` itself — only when the person named it. */
    edit?: boolean;
    budget?: string;
}
/** What `planNight` reads. */
export interface NightInput {
    canvas: CanvasContents;
    person: Actor;
    lead: Actor;
    /** `nightAnswerable`'s answer: null, or why nothing can answer. */
    cannotAnswer: string | null;
    asks: readonly NightAsk[];
    /** Items the person named in the conversation (`goodnightTalk`). */
    named: readonly string[];
    /** Today's settled lines (`settledToday`): never edited overnight. */
    settled: readonly NightCited[];
    /** Other people's goodnights (`namedByOthers`). */
    others: ReadonlyMap<string, Actor>;
    /** What the person was mid-way through when they left (`midwayItems`). */
    midway?: readonly string[];
}
/**
 * **The promise rules, in one place** — the lines a note may promise, or why
 * it may not be written as asked, in a sentence that says what to do.
 *
 * - Nothing can answer overnight, or the lead has no room left under
 *   `PROPOSAL_CAP`: no lines, and `nothing` says why. The note still gets
 *   written; it promises nothing.
 * - Every line concerns an item on the canvas.
 * - No line touches an item another person's open goodnight named.
 * - An edit only of an item the person named in the conversation, and never
 *   the design system or something settled today.
 * - Proposal lines (each one promised frame) fit the lead's free room;
 *   promised frames count toward the cap, so a sixth is refused.
 * - Never on a screen the person was mid-way through (`midwayItems`, design
 *   §5): a line on one is the person's to agree, so it stands only when they
 *   named the item in the conversation — the line that then names it is the
 *   ticked consent the morning reads.
 */
export declare function planNight(input: NightInput): {
    lines: NightLine[];
    nothing?: string;
} | {
    refused: string;
};
/**
 * **What the person was mid-way through when they left** (design §5): the
 * items whose content they changed in the hour before `/goodnight` — a new
 * version, a text edit, a version switched or restored; undone acts, adding,
 * moving and marking do not count — that are still on the canvas. The night
 * leaves these alone unless a ticked line names one.
 */
export declare function midwayItems(canvas: CanvasContents, entries: readonly LogEntry[], personId: string, leftAtMs: number, joined?: ActorJoins): string[];
/**
 * **Whether this agent's night may propose beside this item**, or why not:
 * while a note it leads is open, an item its person was mid-way through is
 * off limits unless a ticked line names it. `isocan propose` asks it, so a
 * night's extra proposal cannot land on a half-finished screen.
 */
export declare function midwayRefusal(canvas: CanvasContents, actorId: string, itemId: string, now: number): string | null;
/** The properties a promised frame is born with: beneath its source, citing the line that promised it. */
export declare function promiseProperties(noteId: string, line: NightLine): Record<string, string>;
/** What an empty frame shows until the night fills it: the promise, quietly. */
export declare function promisedPlaceholder(line: NightLine, html: boolean): string;
/**
 * **Untick a line**: it stays on the note as an offer, not a promise, and its
 * empty frame goes. The note and the frame to delete, or why not.
 */
export declare function untickLine(note: NightNote, n: number): {
    note: NightNote;
    frame?: string;
} | {
    refused: string;
};
/** Where a fill lands: a promised frame, or an original the note may edit. */
export type FillTarget = {
    kind: "frame";
    noteItem: Item;
    note: NightNote;
    line: NightLine;
} | {
    kind: "edit";
    noteItem: Item;
    note: NightNote;
    line: NightLine;
};
/**
 * **What filling this item would answer**, or why it may not be filled: a
 * promised frame of an open note of this lead's, or an original a ticked
 * edit line names. Anything else is the person's work, and the night never
 * edits it.
 */
export declare function fillTarget(canvas: CanvasContents, actorId: string, itemId: string, now: number): FillTarget | {
    refused: string;
};
/** The note with one line answered. */
export declare function answerLine(note: NightNote, n: number, result: NonNullable<NightLine["result"]>): NightNote;
/**
 * **Whether the night may be reported done**, or which promise is still
 * empty: every ticked line filled or failed with a reason — an empty frame
 * never stays empty without one.
 */
export declare function briefRefusal(note: NightNote): string | null;
/**
 * **The note's box**: a readable column (460 wide) and the height its words
 * need at that width, with a tenth spare — the estimate is a guess, and a
 * note whose last heading runs out of its box onto a promised frame's chip
 * is the failure this is for.
 */
export declare function handoffBox(body: string): {
    width: number;
    height: number;
};
/**
 * **Where a note stands**: above the work it concerns, at its left edge —
 * not beside it, where the promised frames' chips stand out to the right —
 * moved by core's free-spot search until its footprint (name strip and
 * marks row counted) lands on nobody's, so both surfaces put it in the same
 * place. Concerning nothing, it stands above everything. The answer is the
 * item's own top-left, sent as `chosen`.
 */
export declare function handoffSpot(canvas: CanvasContents, near: readonly string[], box: {
    width: number;
    height: number;
}): {
    x: number;
    y: number;
};
/** The next `HH:MM` after `now`, local time, as ISO — or null when `hhmm` is not a time. */
export declare function readyAt(hhmm: string, now: number): string | null;
/**
 * **The note's text**, made from its model — headings a person reads in
 * order: settled today, left open, tonight I will (a ticked list, each line
 * with its budget), will not touch, a thought, ready by.
 */
export declare function noteText(note: NightNote): string;
