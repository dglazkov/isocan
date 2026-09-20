import type { CanvasContents, Item } from "./model.js";
import type { PresenceSession } from "./protocol.js";
/**
 * **Your bench: the agents you have, read from your own canvas**
 * (`docs/projects/bench/design.md`, phase 0).
 *
 * The one structural claim the design makes is that **the personal canvas IS
 * the registry** — an agent on your bench is an ordinary item on your private
 * canvas whose `properties.kind` is `agent`, the same way a canvas placed on a
 * canvas is an ordinary item with `kind=canvas` (`canvasitem.ts`). Nothing
 * here is a new op: `bench add` is an `item.add` and `bench rm` is an
 * `item.delete`, so undo, privacy, replication between your machines and the
 * door that judges who may read it all arrive already argued over.
 *
 * What the item carries is the STANDING half — a name, an actor, which harness
 * it is, and an opaque label for where it runs. What it deliberately does not
 * carry is the RUNNING half: the working directory and the ACP session handle
 * stay in `~/.isocan/rc-agents.json` (`packages/cli/src/rc.ts`), because only
 * the machine that holds a `cwd` can honour one, and the secret that claims an
 * agent's actor stays in `~/.isocan/agent-secret`. A second machine therefore
 * reads the same bench and can see that it cannot answer for Percy — which is
 * the whole point of measuring reachability rather than asserting it.
 *
 * **A bench row confers nothing.** It is a record. Standing is `agent.enroll`
 * on each canvas; reach is measured below. Removing a row takes away neither.
 */
/** `properties.kind` on an item that is an agent on somebody's bench. */
export declare const AGENT_KIND = "agent";
/** What a bench card is, placed: a caption's worth of space, not a screen. */
export declare const BENCH_ITEM_SIZE: {
    width: number;
    height: number;
};
/**
 * **Reachability is a measurement, and it has three answers.**
 *
 * - `ready` — something is parked that can answer for this agent NOW.
 * - `elsewhere` — it stands somewhere, or this machine knows how to run it,
 *   but nothing is parked: a summons would land in silence.
 * - `unreachable` — nothing present can run it at all.
 *
 * A boolean ("is my rc parked?") is the natural shape and is wrong twice: it
 * cannot say *unreachable*, the dead-machine case `agent-custody` waits on,
 * and it assumes the question is about THIS machine, which journey 4 makes
 * false. Never reduce this to two.
 *
 * Module-local: the surfaces meet this union through `BenchRow.reach`, which
 * is exported and carries it structurally, and they check themselves against
 * `BENCH_REACH` below rather than against the type. Nothing outside ever
 * needed to WRITE the name, and a type nobody names is not API.
 */
type BenchReach = "ready" | "elsewhere" | "unreachable";
/**
 * Every reachability a bench row can read, in the order a person meets them.
 *
 * Exported — and it is the one of the pair that has to be, because it is a
 * VALUE a test can iterate: a build that collapsed the middle state would
 * still type check, so the guard has to hold the three answers in its hand
 * rather than trust the union it would be checking against.
 */
export declare const BENCH_REACH: readonly BenchReach[];
/** One agent, as its item on the personal canvas records it. */
export interface BenchAgent {
    /** The item on the personal canvas — what `bench rm` removes. */
    itemId: string;
    /** What the agent is called: the item's title. */
    name: string;
    actorId: string;
    /** Which agent this is, or null when the row was written without one. */
    harness: string | null;
    /** Where it runs, opaquely. Null when nobody said. */
    runsAt: string | null;
}
/** The agent an item records, or null when it is not a bench row. An item
 * with no `actorId` is not one either: a row that names no actor can be
 * measured against nothing, and a row nothing can measure is a claim. */
export declare function benchAgentOf(item: Item): BenchAgent | null;
/** Everybody on this bench, by name. The canvas is the registry, so this is
 * the whole of the read — there is no second table to consult. */
export declare function benchAgents(canvas: CanvasContents): BenchAgent[];
/**
 * The properties and blob a bench item wears — one function, so `isocan bench
 * add` and anything the app grows later cannot spell the row two ways. The
 * same job `canvasItemOf` does for a canvas placed on a canvas.
 */
export declare function benchItemOf(name: string, agent: {
    actorId: string;
    harness?: string | null;
    runsAt?: string | null;
}): {
    properties: Record<string, string>;
    blob: string;
    mimeType: string;
    filename: string;
};
/**
 * **What recording this agent asks of a bench** — a card to add and where to
 * put it, the gaps to fill in the row that is already there, or nothing.
 *
 * One function because phase 3 made the bench fill itself: `isocan bench add`
 * used to be the only caller that had to decide *is this actor already a row,
 * and where does a new card go*, and every enrolment path now asks the same
 * two questions. Three copies of that decision would be three benches that
 * lay their cards out differently and disagree about what counts as already
 * there. It reads through `benchAgents`, so a row is "already there" by the
 * same test `isocan bench` prints from.
 *
 * **Identity is the actor, never the name.** Two rows a person called the
 * same thing are two agents; one agent renamed is still one row. That is why
 * a re-enrolment under a new title fills rather than duplicates.
 *
 * **Gaps are filled; nothing is overwritten.** An enrolment knows the harness
 * and the machine it happened on, so a row that was written without them
 * stops being a blank card — but a `runsAt` a person typed by hand, or one
 * written by a different machine, is not corrected by whichever machine
 * enrolled last. The bench is a person's own record: filling a silence keeps
 * the registry from going stale, and rewriting an answer would make the same
 * row flip between two machines' opinions, one op per enrolment, forever.
 */
export declare function benchWriteFor(canvas: CanvasContents, agent: {
    actorId: string;
    harness?: string | null;
    runsAt?: string | null;
}, explicit?: {
    harness?: boolean;
    runsAt?: boolean;
}): {
    kind: "add";
    x: number;
    y: number;
} | {
    kind: "fill";
    itemId: string;
    properties: Record<string, string>;
} | {
    kind: "already";
    itemId: string;
};
/**
 * One canvas a reader can see, with the two live facts the roster needs.
 *
 * `answerable` is `roster()`'s fourth argument — the daemon's
 * connection-bound rc holds. A caller that cannot see the holds passes
 * nothing and every standing row reads `enrolled`, which is the safe
 * under-claim: not knowing whether anybody is listening is not knowing.
 */
export interface BenchCanvas {
    canvasId: string;
    canvasTitle: string;
    canvas: CanvasContents;
    sessions: readonly PresenceSession[];
    answerable?: ReadonlySet<string>;
}
/** A canvas this agent stands on — its enrolment, named so a row can say
 * "standing on 4 canvases" and a reader can go and look. Module-local for
 * `BenchReach`'s reason: readers reach it through `BenchRow.standing`, and
 * nothing outside has ever written the name. */
interface BenchStanding {
    canvasId: string;
    canvasTitle: string;
}
/** A bench row as both surfaces draw it: the record, plus what was measured. */
export interface BenchRow extends BenchAgent {
    reach: BenchReach;
    standing: BenchStanding[];
}
/**
 * **The bench, measured** — the one derivation both `isocan bench` and the
 * app's *Your bench* read, and a fourth caller of `roster()` rather than a
 * fourth implementation of it.
 *
 * `roster()` already answers "is anything parked for this actor?" for `isocan
 * who`, the agent tray and the workbench; three surfaces agree there because
 * there is one answer, not three written to agree. The bench asks the same
 * question of every canvas the reader can see and folds it into one word.
 *
 * `runsHere` is the machine-local half: the actor ids this reader holds a
 * RUNNING row for (`~/.isocan/rc-agents.json`). A browser has no such file
 * and passes nothing — it can still tell `elsewhere` from `unreachable`,
 * because an enrolment is canvas state and travels.
 *
 * Order of the three, and why: `ready` is measured and outranks everything,
 * including a machine that has no row for an agent another machine is
 * answering for — a relayed hold is still an agent that will answer, and
 * saying `unreachable` over the top of it would be the lie the whole state
 * exists to prevent.
 */
export declare function benchRows(agents: readonly BenchAgent[], canvases: readonly BenchCanvas[], runsHere: ReadonlySet<string>, nowMs: number): BenchRow[];
/**
 * The sentence a row reads as, in both surfaces' words.
 *
 * Said plainly rather than left for a reader to infer from a missing ring:
 * journey 1's complaint is that today a summons into silence is
 * indistinguishable from an agent that is thinking. `runsAt` rides the ready
 * line because "ready (cell-2)" is the answer to the question a person
 * actually has next, and it says nothing about a machine being *yours*.
 */
export declare function benchWords(row: BenchRow): string;
/** "standing on 4 canvases", or the honest nothing. */
export declare function benchStandingWords(row: BenchRow): string;
export {};
