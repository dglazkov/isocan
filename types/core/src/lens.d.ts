import type { Actor, CanvasContents } from "./model.js";
import type { LogEntry } from "./ops.js";
import type { PresenceWhere } from "./protocol.js";
/**
 * **What one actor has made, across every canvas — a lens, not a canvas.**
 *
 * `docs/research/2026-08-30-standing-agents.md` is blunt about the physics,
 * and this file exists to keep that decision in the code rather than in a
 * document nobody rereads:
 *
 * **An item's `x`/`y` belong to the canvas it is on**, and two canvases cannot
 * both own them. A view gathering an agent's work from five canvases can hold
 * *references* to those items; it cannot hold the items. The moment somebody
 * drags one, the gesture has nowhere true to land. Of the three ways out — copy
 * the items in, write positions through to the originals, or derive the layout
 * and refuse the drag — only the third is honest. The first looks easiest in
 * week one and is unrecoverable by week four, because copies silt and editing
 * one changes nothing about the original.
 *
 * So: **position is computed, nothing is stored, and it is not called a
 * canvas** — the word promises a drag this cannot honour. Every group here is
 * derived on read and regenerated, which is the same rule `docs/ROADMAP.md`
 * and the repo-admin note land on: *derived and regenerated, or decided here
 * and nowhere else — never both.*
 */
/** One thing an actor made, and where it really lives. */
export interface LensEntry {
    itemId: string;
    canvasId: string;
    canvasTitle: string;
    title: string;
    /** What kind of thing, so a lens can be read at a glance. */
    kind: string;
    /** When this actor made it. */
    at: string;
    /** True when somebody else has touched it since — the lens is about what
     *  this actor made, not what they alone own. */
    editedSince: boolean;
}
/** Entries under one heading — a canvas, a day, a kind. The heading is
 *  derived from the entries, never stored. */
export interface LensGroup {
    key: string;
    label: string;
    entries: LensEntry[];
}
/** How the lens arranges itself. Position is a consequence of this choice and
 *  of nothing stored, which is what keeps it honest. */
export type LensBy = "canvas" | "day" | "kind";
/** One canvas, as a lens reads it: its identity, and the contents to look
 *  through. The lens never fetches — a caller hands it what it already has. */
export interface LensSource {
    canvasId: string;
    canvasTitle: string;
    canvas: CanvasContents;
}
/**
 * Everything `actor` made, newest first, grouped.
 *
 * **Made, not touched.** `createdBy` rather than `updatedBy`: a lens on an
 * agent should show what it brought into the world, and moving somebody else's
 * note is not authorship. `editedSince` carries the other half — that the
 * thing has had other hands on it — without pretending it is no longer theirs.
 *
 * Trashed items are skipped. A lens is a view of what exists.
 */
export declare function lensEntries(sources: readonly LensSource[], actorId: string): LensEntry[];
/**
 * The same entries, arranged.
 *
 * Groups are ordered by their newest member, so a lens opens on what the actor
 * was doing most recently whichever arrangement is chosen — the question
 * somebody brings to it is almost always "what has this thing been up to",
 * and an alphabetical wall of canvases answers a different one.
 */
export declare function lensGroups(entries: readonly LensEntry[], by?: LensBy): LensGroup[];
/**
 * **The lens refuses the drag**, and says so in one place so that both surfaces
 * say the same thing rather than each inventing a sentence.
 */
export declare const LENS_REFUSAL = "these live on their own canvases \u2014 open one to move it";
/**
 * **A name that is enough to tell two subjects apart.**
 *
 * Names are labels and ids are identity, so two actors really can both be
 * called "Admiral One" — and a roster listing that name twice reads as a bug
 * in the list rather than as two people. Ids are only added where they are
 * actually needed, because `Admiral One (usr_7XTV)` on every row is a page of
 * machine addresses for a problem two rows have.
 *
 * Shared rather than per-surface: a CLI roster and a lens picker showing the
 * same two subjects differently is a small version of the drift core exists to
 * prevent, and it is the kind that makes somebody pick the wrong one.
 */
export declare function lensSubjectLabels(subjects: readonly Actor[]): Map<string, string>;
/** Who a lens can be pointed at: everybody who has made something here. */
export declare function lensSubjects(sources: readonly LensSource[]): Actor[];
/**
 * **Narrowing a lens** (phase 2).
 *
 * At thirty things the gallery is the answer; at three hundred it is a wall,
 * and the questions somebody actually arrives with are narrower than "show me
 * everything this agent ever made". Three of them, and no more:
 *
 * - *what kind* — screens, or drawings, or the documents
 * - *how recently* — this week, rather than since the canvas began
 * - *is it still as I left it* — the things nobody else has touched
 *
 * Each is a predicate over what `lensEntries` already returns, so nothing is
 * fetched twice and the filters compose. Kept in core beside the fold for the
 * usual reason: `isocan lens --kind screen` and the app's chip have to mean the
 * same thing, or the two surfaces disagree about what an agent has been doing.
 */
export interface LensFilter {
    /** Only this kind of thing. */
    kind?: string;
    /** Only what was made within this many hours. */
    withinHours?: number;
    /** Only what nobody else has touched since. */
    untouched?: boolean;
}
/** The entries that survive every narrowing asked for. */
export declare function filterLens(entries: readonly LensEntry[], filter: LensFilter, nowMs: number): LensEntry[];
/**
 * The kinds present, with how many of each — so a chooser offers only what is
 * actually there.
 *
 * A filter listing kinds nobody has made is a menu of dead ends, and the count
 * is what makes the choice worth making: "screen 41" earns a click in a way
 * that a bare "screen" does not.
 */
export declare function lensKinds(entries: readonly LensEntry[]): Array<{
    kind: string;
    count: number;
}>;
/** The windows a lens offers, in the words somebody would choose them by. */
export declare const LENS_WINDOWS: ReadonlyArray<{
    label: string;
    hours: number;
}>;
/**
 * **What somebody DID, rather than what still exists** (phase 3).
 *
 * `lensEntries` reads the canvas: the things that are there now, with the
 * actor who made each. That is a portfolio, and a portfolio is silent about
 * the half of the work that matters most on a bad day — **what was made and
 * then deleted**. An agent that created nine screens and removed eight of them
 * looks, in a portfolio, like an agent that made one.
 *
 * So this reads the LOG instead. Every act stays in the oplog whatever
 * happened to the item afterwards, which is the whole reason the log is the
 * record and the snapshot is a convenience.
 *
 * The words come from `opWords`, so an act here reads exactly as it reads on a
 * canvas card, on a timeline tick and in `isocan canvas list`.
 */
export interface LensAct {
    ts: string;
    canvasId: string;
    canvasTitle: string;
    /** The actor's name as the log recorded it. */
    actor: string;
    /** The operation type — a caller phrases it with `opWords`. */
    op: string;
}
export interface LensLog {
    canvasId: string;
    canvasTitle: string;
    entries: readonly LogEntry[];
}
/**
 * Everything `actorId` did, newest first, across every log given.
 *
 * **Undo pairs are kept, unlike a timeline's seams.** `majors` skips both ends
 * because a track that ticks for the doing AND the undoing tells a story that
 * did not happen — but this is a record of what somebody DID, and undoing
 * something is a thing they did. A history that quietly dropped it would be
 * the tidied version, which is the one nobody can trust.
 */
export declare function lensActs(logs: readonly LensLog[], 
/**
 * An actor id, or a predicate for the selections an id cannot express.
 *
 * The two surfaces choose differently and both are right: the app has a
 * subject in hand and wants exactly them, while `isocan history di` matches
 * a name PREFIX — an agent's name is a thing somebody types, not pastes —
 * and `isocan history` with no argument wants everyone. That difference is
 * in the SELECTION, not in the fold, which is why it is a parameter here
 * rather than a second implementation over there.
 */
who: string | ((actor: Actor) => boolean), 
/**
 * What to call them. Defaults to the name the log recorded, which is what
 * the app wants: the name at the time is the honest label on an old act.
 * The CLI passes a resolver against the desk's current roster, because a
 * table listing one agent under three old names reads as three agents.
 */
naming?: (actor: Actor) => string): LensAct[];
/**
 * The shape of somebody's stretch of work: how much, over how many canvases,
 * and what they mostly did.
 *
 * The count alone answers "were they busy"; the commonest act answers "doing
 * what", which is the question actually being asked of an agent nobody watched.
 */
export declare function lensShape(acts: readonly LensAct[]): {
    acts: number;
    canvases: number;
    mostly: string | null;
};
/**
 * **Where somebody is right now** — the canvases they are on, and whether
 * they are there or merely reachable there.
 *
 * Two states, and the difference is the whole point. A `web` or `cli` session
 * is somebody AT the canvas: a face, a cursor, work happening. A parked `rc`
 * is a process standing by — nobody is there, but something could be woken.
 * `docs/research/2026-08-30-standing-agents.md` is blunt about why these must
 * not render alike: *"a facepile that shows six faces on a canvas nobody is
 * working on has stopped meaning anything, which is the whole value of
 * presence being honest."*
 *
 * So `here` and `available` are separate sets rather than one set with a flag,
 * because every caller has to decide between them and a flag makes forgetting
 * possible. A canvas somebody is genuinely on outranks a parked process on the
 * same canvas — being there is the stronger fact.
 */
export interface LensLive {
    /** Canvas ids where this actor is actually present. */
    here: ReadonlySet<string>;
    /** Canvas ids where an rc is parked for them, and they are not present. */
    available: ReadonlySet<string>;
}
export declare function lensLive(where: readonly PresenceWhere[], actorId: string): LensLive;
/**
 * One sentence for a subject row: present somewhere, standing by, or neither.
 *
 * Null rather than "offline", because absent from every room this daemon can
 * see is not the same as not working — presence rides on sockets to canvases,
 * and an agent busy on a canvas that lives at another home shows up here as
 * nothing at all. A confident "offline" would be the instrument reporting its
 * own blind spot as a fact about somebody.
 */
export declare function lensLiveWords(live: LensLive): string | null;
/**
 * The canvases to NAME, present ones first.
 *
 * `lensLiveWords` counts, which is right for a roster of a dozen people — a
 * list of titles there is a wall. On one subject's page the count is the
 * uninteresting half: "on a canvas now" invites exactly one question, and the
 * page could not answer it, because the canvas somebody is SITTING on is
 * often not one they have made anything on. Those are the two halves of this
 * page's own subject and it could only show one.
 *
 * Ids, not titles: core folds identity, and a title belongs to whichever
 * surface is drawing it — a link in the app, a word in a terminal.
 */
export declare function lensLiveList(live: LensLive): Array<{
    canvasId: string;
    state: "here" | "available";
}>;
