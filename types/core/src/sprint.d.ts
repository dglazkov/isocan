import type { CanvasContents, Item } from "./model.js";
import type { PresenceSession } from "./protocol.js";
import type { Paper } from "./textnode.js";
/**
 * **The design sprint, as state the canvas can derive.**
 *
 * `docs/research/2026-09-01-design-sprint.md`: a sprint is a script a
 * facilitator runs over a small ritual vocabulary — phase, timebox, silence,
 * quota, vote, reveal, decide — and almost all of it is verbs the canvas
 * already has. What was missing was a clock somebody can see, a hand-in
 * count, and a heat map that hides its numbers while the vote is open.
 *
 * **Phase is derived, not stored.** `/ask` is the precedent (roster.ts): an
 * open question is not a flag somebody sets and forgets, it is read off the
 * thread. The current phase is the most recent `/sprint <phase> [duration]`
 * in the Chat, and its end is that comment's daemon-stamped `createdAt` plus
 * the duration — so two browsers and a CLI compute the same countdown from
 * the same clock. No `sprint.setPhase` op exists and none should: the record
 * is the conversation, which is where the room would look anyway.
 *
 * **Hand-ins are a property.** `sprint=<phase>` on an item says it was handed
 * in for that phase — `item.update`, the same shape `slide`, `context` and
 * `paper` took, replicating and undoing like any other fact.
 *
 * **A vote is a reaction.** Per actor, undoable, one op. What this module adds
 * is the rendering rule: while a vote phase is open, counts and names are
 * hidden BY LENS and never by record — `isocan ls --json` keeps saying who
 * reacted, and the app simply does not draw it until the bell. The curtain is
 * etiquette, and the research note says so in as many words.
 */
export declare const SPRINT_PROP = "sprint";
/** What kind of moment a phase is — decides what the surfaces hide. */
type PhaseKind = "group" | "silent" | "vote" | "decide";
interface PhaseSpec {
    /** The word after `/sprint`. */
    name: string;
    /** What the clock chip says. */
    label: string;
    kind: PhaseKind;
    /** The mark a vote phase counts, or null. Announced by the facilitator
     * too, but one constant so the chip and `isocan sprint` agree. */
    mark: string | null;
    /** Knapp's timebox, in seconds, used when the command names none. Null
     * means the phase runs until the next one — a museum walk has no clock. */
    defaultSeconds: number | null;
    /** Which sheet of the board this phase happens on — a key into
     * `SPRINT_BOARD`. Several phases share a sheet: notes, ideas, crazy8s and
     * sketch are all "Sketches", the whole of Wednesday's choosing is "Vote". */
    area: BoardKey;
}
/**
 * **The board: one sheet per stretch of the week, in the order it runs.**
 *
 * `docs/projects/sprint/journey.md`, Scene 0: a facilitator's first move is
 * to cover the wall in labelled sheets so the week is visible before it
 * starts and everyone always knows where to stand. This is that wall, as
 * data both surfaces lay out identically — `isocan sprint board` and the
 * `/sprint` skill read the same table, so a board laid from a terminal and
 * one laid by an agent are the same board.
 *
 * Each sheet is an AREA (`core/area.ts`) wearing `board=<key>`, which is
 * how a phase finds its sheet later even after somebody renames it: the
 * title is for people, the key is for the phase table. The card is the
 * three lines a person reads standing in front of it — what happens here,
 * how long, what you do — so nobody has to know the method to follow it.
 *
 * Sizes are rough room for what each holds, top-aligned in one row with a
 * gap, because a board is read left to right as a story: brief → map →
 * questions → target → … → wrap. Not a grid: the order IS the week.
 */
export type BoardKey = "brief" | "map" | "experts" | "target" | "demos" | "sketches" | "vote" | "storyboard" | "prototype" | "test" | "wrap";
export interface BoardArea {
    key: BoardKey;
    title: string;
    tint: Paper;
    width: number;
    height: number;
    /** The card: what happens here, in a few lines of markdown. */
    card: string;
}
/** `board=<key>` on an area item says which sheet of the board it is. */
export declare const BOARD_PROP = "board";
/** Between sheets, in world units. */
export declare const BOARD_GAP = 200;
export declare const SPRINT_BOARD: readonly BoardArea[];
export declare function boardArea(key: BoardKey): BoardArea;
/**
 * Where each sheet goes: one row from `origin`, top-aligned, a gap between.
 * Pure, so the CLI's `sprint board` and a test agree to the pixel.
 */
export declare function boardLayout(origin: {
    x: number;
    y: number;
}): (BoardArea & {
    x: number;
    y: number;
})[];
/** The sheet wearing `board=<key>`, or null when the board has not been
 *  laid (or that sheet was deleted). By the property, not the title: a
 *  renamed sheet is still the sheet. */
export declare function boardAreaFor(canvas: CanvasContents, key: BoardKey): Item | null;
/** Every sheet of the board that exists here, in board order. */
export declare function boardOf(canvas: CanvasContents): Item[];
/**
 * **The brief, as a card.** What the setup round answered, written once as
 * markdown the Brief sheet holds — a text node wearing `brief=1` so the
 * facilitator can find it again and write the next version rather than a
 * second card. Empty fields are left out, not written as "TBD": a brief
 * that says less is honest, and the next version fills it.
 */
export declare const BRIEF_PROP = "brief";
export interface Brief {
    goal?: string;
    questions?: string[];
    decider?: string;
    sketchers?: string[];
    cut?: string;
}
export declare function briefCard(brief: Brief): string;
/** The brief card on this canvas, or null. */
export declare function briefItem(canvas: CanvasContents): Item | null;
/**
 * **The desk** (sprint phase 3, journey Scene 2): a private canvas per
 * sketcher, born by the facilitator, that knows which sprint it belongs to.
 *
 * `sprintOf=<canvas id>` on the DESK canvas's own properties is the whole
 * record. The privacy is real rather than a courtesy: the desk's link grant
 * is turned off at birth and one single-use pass admits one browser, so
 * the daemon refuses everyone else at the door — the answer the 1 Sep
 * research chose over a veil. What the desk's chip shows (the sprint's
 * phase and clock) it reads from the sprint canvas by asking for it; what
 * *Hand in* does from a desk is a cross-canvas copy onto the sprint's
 * sheet, stamped for the phase. Nothing on a desk is on the wall until its
 * sketcher says so.
 */
export declare const DESK_OF_PROP = "sprintOf";
/** The sprint this canvas is a desk for, or null when it is not a desk. */
export declare function deskOf(project: {
    properties?: Record<string, string>;
}): string | null;
/** What a desk is called: the sketcher's name, possessive. */
export declare function deskTitle(name: string): string;
/**
 * The phases, in the order a five-day sprint runs them. A word not in this
 * table is NOT a phase — `/sprint make onboarding better` is a brief for the
 * facilitator, not a state change — which is what keeps a typo from starting
 * a timer. `end` closes the sprint.
 */
export declare const PHASES: readonly PhaseSpec[];
/** The word that closes a sprint. Not a phase: after it there is no clock. */
export declare const SPRINT_END = "end";
export declare function phaseSpec(name: string): PhaseSpec | null;
/**
 * `8m`, `90s`, `1h`, `1h30m`, `20` (minutes) → seconds; null for anything
 * else. Minutes are the bare unit because every timebox in the method is
 * said in minutes — "Crazy 8s, eight minutes" — and a facilitator typing
 * `/sprint crazy8s 8` should get the box they meant.
 */
export declare function parseDuration(text: string): number | null;
/** Seconds → `14:02`, or `1:05:00` past an hour. What the chip shows. */
export declare function clockLabel(seconds: number): string;
interface SprintCommand {
    /** A phase name, or `end`. */
    phase: string;
    /** Explicit duration, or null to take the phase's default. */
    seconds: number | null;
    /** Whatever followed — the brief for the box, shown on the chip. */
    note: string;
}
/**
 * What a `/sprint …` comment asks for, or null when it is not a phase change.
 * `/sprint` alone and `/sprint <free words>` are requests to a facilitator
 * (the slash command's body says what to do with them) and derive no state.
 */
export declare function parseSprintCommand(body: string): SprintCommand | null;
export interface SprintState {
    phase: PhaseSpec;
    note: string;
    /** Who posted the phase — the facilitator's chair, by definition. */
    facilitatorId: string;
    /** Their name as stamped on the comment — what to say when no live
     * session names them better. */
    facilitatorName: string;
    threadId: string;
    commentId: string;
    /** ISO, the daemon's stamp on the comment. */
    startedAt: string;
    /** ISO, or null for a phase with no clock. */
    endsAt: string | null;
    /** Items wearing `sprint=<this phase>`. */
    handedIn: Item[];
    /** The sheet of the board this phase happens on, or null when no board
     * has been laid here — a sprint run with no board still has a clock. */
    area: Item | null;
}
/**
 * The sprint the Chat says is running, or null — no Chat, no `/sprint`
 * phase yet, or the last one was `end`. Newest phase wins; nothing else in
 * the conversation matters, so a room talking over the facilitator cannot
 * change the clock.
 */
export declare function sprintState(canvas: CanvasContents): SprintState | null;
/** Seconds left on the clock; null when the phase has none; 0 once it rang. */
export declare function remainingSeconds(state: SprintState, nowMs: number): number | null;
/** Has the clock run out? A phase with no clock never has. */
export declare function phaseOver(state: SprintState, nowMs: number): boolean;
/**
 * **Whether the surfaces should hide who voted and how many** — the lens
 * half of the curtain. True exactly while a vote phase's clock is running:
 * the bell reveals, and a vote phase with no clock reveals when the next
 * phase is called. The record is untouched either way.
 */
export declare function hidesVotes(state: SprintState | null, nowMs: number): boolean;
/** The patch that hands an item in for a phase — one spelling for both
 * surfaces. `phase` is the name; the current one comes from `sprintState`. */
export declare function handInPatch(phase: string): {
    properties: Record<string, string>;
};
/** The phase an item was handed in for, or null. */
export declare function handedInFor(item: Item): string | null;
/**
 * **Which actors on this canvas are agents**, for the split tally. An agent
 * is a cli session that names its harness (roster.ts's rule: a bare terminal
 * is "terminal", never guessed into an agent) or a standing enrolment. A
 * person at a browser is neither. Callers without presence pass `[]` and get
 * the enrolled set alone, which under-claims rather than guesses.
 */
export declare function agentActorIds(sessions: readonly PresenceSession[], canvas: CanvasContents): Set<string>;
interface Tally {
    item: Item;
    humans: number;
    agents: number;
    /** Actor ids who wore the mark, for the reveal and for `--who`. */
    actorIds: string[];
}
/**
 * **Two tallies on one sketch.** A reaction records who, so the heat map can
 * show human dots and agent dots apart — the room reads the humans' as the
 * vote and the agents' as a second opinion from readers who saw every
 * sketch. A query over data already kept; no other canvas can make it
 * because their votes are anonymous by design. Sorted most-voted first,
 * humans deciding ties, then id so a wall that did not change does not
 * reorder.
 */
export declare function tally(items: readonly Item[], mark: string, agents: ReadonlySet<string>): Tally[];
/**
 * The wall a vote is about. With a board laid, it is what is ON THE VOTE
 * SHEET — the wall is a sheet now, which is what closes the 1 Sep build's
 * one departure (hiding counts on every item because "the wall" had no
 * precise meaning). Without a board, or with an empty Vote sheet: what was
 * handed in for the most recent silent phase before this one, or — with
 * nothing handed in — every item, so a heat map over a sprint that never
 * used hand-in still works, on everything.
 */
export declare function wallFor(canvas: CanvasContents, state: SprintState): Item[];
export {};
