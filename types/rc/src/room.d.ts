import type { Actor, ActorBindingRecord, ActorClaimOp, Canvas, CanvasSnapshotResponse, CreateSessionResponse, LogEntry, Operation, ParkAdvanceRequest, ParkClaimRequest, ParkClaimResponse, ParkDeliveredRequest, PostOpResponse, RcAsk, RcHoldRequest, RcHoldResponse, UpdateSessionRequest, WatchLogRequest, WatchLogResponse } from "../../core/src/index.js";
import { type GuardLimits } from "./guards.js";
import type { RcAgentRow } from "./rows.js";
/**
 * **The rc's room, over what a host hands it** (docs/projects/room/design.md,
 * "`runRoom(deps): Room`").
 *
 * This is `runRcRoom` from `packages/cli/src/main.ts` with the laptop taken
 * out: every line it narrates, every call it makes to the daemon, and every
 * decision it takes is the same, and everything it used to reach for on the
 * machine — the disk, the process table, the terminal, the clock — arrives in
 * `RoomDeps`. The laptop's `isocan rc` builds the deps from its context and is
 * one host of this; a test builds them in memory and runs a night by a clock
 * it advances by hand.
 *
 * What the room does not know, by name: the upgrade window, the sandbox fence,
 * the harness scan and the default-harness question, the session pointer file
 * and the daemon restart. A lost connection is retried; restarting whatever
 * was not answering is the host's (the laptop's routes do it).
 */
/**
 * The daemon calls the room makes, as `@isocan/api`'s `DaemonRoutes` spells
 * them — declared here over core's wire types, so the module reaches nothing
 * of `@isocan/api` (docs/projects/room/design.md, `routes`). The laptop hands
 * its `DaemonClient`, and the compiler holds the two shapes together at that
 * call; a host or a test hands exactly these. A refusal the home answered
 * throws core's `ApiError`; anything else thrown is a connection that never
 * got an answer, and the room retries it.
 */
export interface RoomRoutes {
    actorBindings(keys?: string[]): Promise<ActorBindingRecord[]>;
    claimActor(op: ActorClaimOp): Promise<PostOpResponse>;
    createSession(canvasId: string, actor: Actor, label?: string, harness?: string, kind?: "cli" | "rc"): Promise<CreateSessionResponse>;
    endSession(canvasId: string, sessionId: string): Promise<{
        ok: true;
    }>;
    getLog(canvasId: string, since: number, waitMs?: number): Promise<LogEntry[]>;
    parkAdvance(request: ParkAdvanceRequest): Promise<{
        ok: true;
    }>;
    parkClaim(request: ParkClaimRequest): Promise<ParkClaimResponse>;
    parkDelivered(request: ParkDeliveredRequest): Promise<{
        ok: true;
    }>;
    rcHold(request: RcHoldRequest, signal?: AbortSignal): Promise<RcHoldResponse>;
    /** Explicit release when the room stops (issue #308). */
    rcRelease?(request: {
        canvasId: string;
    }): Promise<{
        ok: true;
        released?: number;
    }>;
    /** The room writes as the system voice only; `DaemonRoutes.sendOp`'s later
     * parameters (client id, home, group…) it never passes. */
    sendOp(canvasId: string | null, actor: Actor, op: Operation): Promise<PostOpResponse>;
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    updateSession(canvasId: string, sessionId: string, patch: UpdateSessionRequest): Promise<{
        ok: true;
        cancelled?: {
            threadId: string;
            by: string;
            at: string;
        };
    }>;
    watchLog(request: WatchLogRequest, signal?: AbortSignal): Promise<WatchLogResponse>;
}
/** The rc half of the enrolment record, as the verbs the room uses. The
 * laptop keeps it in `~/.isocan/rc-agents.json` (`packages/cli/src/rc.ts`). */
export interface RoomRows {
    /** Every row this machine keeps, on every canvas: the owner's hands are all
     * of them, and the room picks its canvas's rows out itself. */
    list(): Promise<RcAgentRow[]>;
    /** Write the row only when none exists for its canvas and actor; whether it
     * wrote. */
    adopt(row: RcAgentRow): Promise<boolean>;
    remove(canvasId: string, actorId: string): Promise<void>;
    /** Record the session a turn ran in. Whether the row was still there to
     * write. */
    setSessionId(canvasId: string, actorId: string, sessionId: string): Promise<boolean>;
}
/** One beat of a running turn, as the adapter streams it. */
export interface RoomTurnEvent {
    kind: string;
    text?: string;
    detail?: string;
}
/** What runs one turn: the shape `AcpAgentProcess` has. */
export interface RoomAdapter {
    ensureSession(cwd: string, stored: string | null): Promise<{
        sessionId: string;
        resumed: boolean;
    }>;
    prompt(sessionId: string, text: string, onEvent: (event: RoomTurnEvent) => void): Promise<{
        stopReason: string;
    }>;
    /** The turn is over, whichever way; awaited before the face comes off. */
    close(): void | Promise<void>;
}
/** A row's harness, resolved: the name the face carries, and how to start it. */
export interface RoomHarness {
    readonly harness: string;
    /** Start the adapter for one turn, after the face is on. */
    open(turn: RoomTurn): Promise<RoomAdapter>;
}
export interface RoomTurn {
    /** Who this turn is for, by id (#333): the canvas, the agent summoned, and
     * the person the room answers to. The laptop reads these from `cwd`, the
     * environment and `isocan whoami`; a host that serves many people has none
     * of the three, and files its records and counts its quota by these. */
    canvasId: string;
    agent: Actor;
    owner: Actor;
    /** The face this turn's presence runs under, or null when none was made. */
    face: string | null;
    /** The thread the summons came from, when it came from one. */
    threadId: string | null;
    /** A line of this agent's narration: the room prefixes the agent's name. */
    narrate(line: string): void;
}
/**
 * **A turn the host holds, in the host's own words** (#333). Thrown from
 * `adapterFor` or `open` when the turn is not to start yet and nothing is
 * broken: an allowance spent, a quota reached. The room says `line` in the
 * thread in the system voice, as it says the guard's ceiling, keeps the
 * summons pending and asks again at `retryAfter` (the host's clock, ms).
 * Anything else thrown is a failed turn: "couldn't answer", and a retry in a
 * minute.
 */
export declare class RoomHold extends Error {
    /** The whole sentence the person reads; the room adds nothing to it. */
    readonly line: string;
    readonly retryAfter: number;
    constructor(
    /** The whole sentence the person reads; the room adds nothing to it. */
    line: string, retryAfter: number);
}
/** A key-value for what the room would like to survive a restart. String
 * keys, JSON values. A host that persists it gets a room that does not repeat
 * itself; the laptop hands it a `Map` (`mapState`). */
export interface RoomState {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
}
export interface RoomDeps {
    /** The daemon routes, over a `fetch`. */
    routes: RoomRoutes;
    /** What the room is parked on. */
    canvas: Pick<Canvas, "id" | "title">;
    /** Who it answers to: the person whose machine this is. */
    owner: Actor;
    /** The address the canvas lives at, for the line that says where it is. */
    origin: string;
    /** Where an agent that arrives with no rc half runs: the directory the
     * room was started in. */
    cwd: string;
    rows: RoomRows;
    /** The harness a row runs on. Throws, in the words of what is missing, when
     * there is none. The row carries the name the roster gives the agent now. */
    adapterFor(row: RcAgentRow): Promise<RoomHarness>;
    /** The last hop of the web's "add an agent", on this machine: prepare the
     * directory an ask names, claim the actor, write its row, enroll it. */
    enrol(ask: RcAsk): Promise<void>;
    /**
     * The session key an agent's actor is claimed under on this machine, and
     * the key a turn's injected environment presents. The host derives it from
     * a secret it keeps and the agent's name, so the same machine derives the
     * same key every time and nobody else can: a name is visible to anyone
     * admitted to the canvas, and the desk resumes an actor for whoever
     * presents the key it was claimed under.
     */
    agentKey(name: string): Promise<string>;
    /** One line, no level. */
    narrate(line: string): void;
    state: RoomState;
    /** The guard limits: turns per agent per hour, and agent-to-agent chains. */
    limits: GuardLimits;
    clock: {
        now(): number;
    };
    /** Resolves after `ms`, or as soon as `signal` aborts. Never rejects. */
    sleep(ms: number, signal: AbortSignal): Promise<void>;
    /**
     * **Whether this agent's arrivals are said in the Chat** — the roll call
     * (`roll.ts` in core): "Percy is here", "Percy is back", and "Percy
     * stepped away" when the room stops on purpose. Absent: never, so a host
     * opts in; the laptop's `isocan rc` does only under `--announce` or
     * `config.json`'s `rcAnnounce`. When the host persists
     * `state`, the `seen:` keys are what make a restart within the window quiet.
     */
    announce?: (agent: Actor) => boolean;
}
export interface Room {
    /** Stand down: end the hold, both long polls and every wait, and take the
     * room's announcement off the presence plane. Resolves when that is done. */
    stop(): Promise<void>;
    /** Resolves once the room has stopped; rejects with what ended it otherwise
     * (a daemon refusal the room cannot retry past, as `isocan rc` exits on). */
    readonly done: Promise<void>;
}
/** A `Map` as the room's state — what the laptop hands it, so nothing survives
 * a restart there. Values are kept as they are, so rooms sharing one map share
 * one guard per agent. */
export declare function mapState(map?: Map<string, unknown>): RoomState;
/** One canvas's whole rc — holds, cursors, dispatch, narration. */
export declare function runRoom(deps: RoomDeps): Room;
