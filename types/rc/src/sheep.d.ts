import type { SheepPlace } from "./rows.js";
import type { RoomTurnEvent } from "./room.js";
/**
 * **`sheep` as a harness, over commands** (docs/projects/room/design.md,
 * "`SheepAgent` over `SheepCommands`"; the policy is sheep-harness's).
 *
 * The rc's turn is `open → ensureSession → prompt`. This file gives the room
 * those verbs over a sheep home instead of an ACP subprocess: a session is a
 * sheep (a pi session in a cell at a sheep home), `ensureSession` mints one
 * when neither the row nor the pasture's herd has one, and `prompt` is an
 * `attach` that waits its turn. The summons text is unchanged, so a sheep and
 * a local adapter receive identical content; the difference is where the
 * turn runs.
 *
 * What is here is the sheep's policy, written once: a pasture per agent named
 * `isocan-<agent>`, the setup script, the brief and the skill put into it, the
 * pass as the sheep's own secret with the pasture-secret fallback for a home
 * from before, a sheep resumed from the herd before one is born, tool beats
 * read from `attach`'s stream of entries, and withdrawal as `rm` with `abort`
 * for a home from before. How a host reaches a sheep home is not here: it is
 * `SheepCommands`, which the laptop implements over the `sheep` command
 * (`packages/cli/src/sheep.ts`) and another host however it can.
 *
 * The sheep's hands on the canvas are the `isocan` CLI in its container,
 * speaking to the home directly (`isocan setup --direct`), and its identity
 * is a pass the host mints for the agent's own actor. The pass rides into the
 * cell as the sheep's own secret, given at its mint, so it is environment for
 * the pasture's setup script and never in a prompt or a transcript. The
 * redeemed badge lives in `~/.isocan`, and the home keeps a sheep's `~` with
 * the sheep across the containers it rents per command (sheep#6). A home from
 * before that keeps `~` for one container, and there setup links `~/.isocan`
 * into the synced workspace instead, as every sheep born before it already
 * has.
 */
export declare const SHEEP_HARNESS = "sheep";
/** The part of a pi transcript entry the rc reads: one line of `attach`'s
 * stream. */
export interface SheepEntry {
    id: string;
    timestamp: number;
    type: string;
    message?: {
        role?: string;
        content?: unknown;
    };
}
/** The part of a sheep home's listing the rc reads. `secrets` is the names
 * the sheep was minted with; a home or a `sheep` from before per-sheep
 * secrets (sheep#5) lists none, or no field. `setup` is what the pasture's
 * setup is doing in the sheep's container or how it last ended, `null` for a
 * sheep no setup has ever run for (sheep#4); a home from before that has no
 * field. */
export interface SheepRow {
    id: string;
    name: string | null;
    pasture: string | null;
    secrets?: string[];
    setup?: {
        state: string;
    } | null;
}
/** How an `attach` ended: the turn ran to its end, or it did not, and why. */
export type SheepReply = {
    ended: true;
} | {
    ended: false;
    why: string;
};
/** How an `rm` was answered: the sheep ended (and whether a running turn was
 * aborted first), or refused, in the home's own words. */
export type RmAnswer = {
    ended: true;
    aborted: boolean;
} | {
    ended: false;
    refusal: string;
};
/**
 * **A sheep home, as the verbs the rc speaks to it.** Every verb that fails
 * throws, in the host's words, except `rm`, whose refusal is an answer the
 * policy reads, and `pastures`, which lists what it can. `rm` throws only when
 * the home cannot be asked at all.
 */
export interface SheepCommands {
    /** The home's sheep (`sheep ls --json`). */
    sessions(): Promise<SheepRow[]>;
    /** One sheep from the listing, or null when the home no longer lists it. */
    session(id: string): Promise<SheepRow | null>;
    /** The pastures' names (`sheep pasture ls`). */
    pastures(): Promise<string[]>;
    pastureNew(name: string): Promise<void>;
    pasturePut(name: string, path: string, body: string): Promise<void>;
    /** The pasture's own secret (`sheep pasture secret set`). */
    pastureSecret(name: string, key: string, value: string): Promise<void>;
    /** A sheep minted idle, with no prompt, holding `secrets` as its own
     * (`sheep new --detach … --secret`). The new sheep's id; whether it kept
     * the secrets is read from the listing, not from here. */
    mint(opts: {
        name: string;
        pasture: string;
    }, secrets: Record<string, string>): Promise<string>;
    /** One turn (`sheep attach --wait --json`): each transcript entry as it
     * lands, then how the turn ended. */
    attach(id: string, text: string, onEntry: (entry: SheepEntry) => void): Promise<SheepReply>;
    rm(id: string): Promise<RmAnswer>;
    /** Stops a running turn (`sheep abort`); true when one was running. */
    abort(id: string): Promise<boolean>;
}
/**
 * A tool call from a pi transcript, said the way an ACP title reads: the
 * tool, then its first string argument (a command, a path). The face's
 * inferred status is this line.
 */
export declare function toolTitle(name: string, args: unknown): string;
/** An assistant entry's text, the parts joined; empty for any other entry. */
export declare function assistantText(entry: SheepEntry): string;
/** The tool calls in transcript entries, oldest first. */
export declare function toolCalls(entries: SheepEntry[]): string[];
export interface SheepBirth {
    /** The pass address the sheep redeems — minted by the host, who holds the
     * agent's claim — and the pass's id, which the room keeps on the rc row so
     * withdrawal can ask which badge redeemed it. Called once, only when a
     * sheep is being born. */
    pass: () => Promise<{
        address: string;
        passId: string;
    }>;
    canvasTitle: string;
}
/** The verbs `AcpAgentProcess` has, over a sheep home. */
export declare class SheepAgent {
    /** The id of the pass minted for the sheep this agent just birthed, or
     * null when `ensureSession` resumed one. The room writes it to the row. */
    bornPass: string | null;
    /** Where this agent's sheep live, as the row keeps it; the room writes it
     * back. */
    readonly place: SheepPlace;
    /** The place, said: the address, or which local home. */
    readonly where: string;
    private readonly commands;
    private readonly name;
    private readonly narrate;
    private readonly birth;
    constructor(opts: {
        commands: SheepCommands;
        name: string;
        place: SheepPlace;
        where: string;
        narrate?: (line: string) => void;
        birth: SheepBirth;
    });
    private get pasture();
    /** A pasture per agent, made once; a second birth of the same name finds
     * it. The pass is not here: it is the sheep's own secret, given at the
     * mint. */
    private ensurePasture;
    /** The pasture's tree: the setup script, the brief and the skill. Put at
     * every turn and not only at the birth — three calls, under a second — so
     * a sheep born under an earlier script or brief runs the current one in
     * its next container, which is how a sheep from before the home kept `~`
     * keeps its badge once the home does. */
    private putTree;
    /** The tree, refreshed for a resumed sheep. A refusal is said, not thrown:
     * the sheep has a tree, and the turn is worth more than a current one. */
    private refreshTree;
    /**
     * The stored sheep if it still exists at the home; else one already in the
     * agent's pasture, which a row can forget (a row reaped, a machine
     * re-imaged) while the home remembers; else a fresh one, minted idle into
     * the pasture with no prompt, so no model turn is spent. A pass is minted
     * only on that last path, so a sheep that exists is never handed a second
     * one.
     */
    ensureSession(_cwd: string, previous: string | null): Promise<{
        sessionId: string;
        resumed: boolean;
    }>;
    /**
     * Makes sure the new sheep's setup will find the pass. Whether the sheep
     * took it as its own secret is read from the home's listing, not from the
     * mint's answer: a `sheep` from before `--secret` takes the flag as a stray
     * word, a home from before per-sheep secrets drops the field, and both mint
     * the sheep and exit 0. Such a sheep is used, not ended: it is idle and
     * nothing of it has run, so the pass goes to the pasture's secret of the
     * same name, which setup reads when the sheep's first container starts.
     * That is the phase 1 birth's credential, and it stays in the pasture after
     * it is spent.
     */
    private passKept;
    /**
     * One turn: the summons goes to the sheep, and how the attach ends is the
     * stop. The attach queues behind a turn already running at the cell, and
     * streams the turn's entries as they land (sheep#7): each assistant entry's
     * tool calls become "tool" events, the beat the ACP path produces, and its
     * text a "chunk", so the reply is the assistant's text in the order it was
     * said. Every entry is taken at most once by id; the last assistant entry
     * is written again at the end by a `sheep` from before the stream, and by
     * no other.
     */
    prompt(sessionId: string, text: string, onEvent?: (event: RoomTurnEvent) => void): Promise<{
        stopReason: string;
        text: string;
    }>;
    close(): void;
}
/**
 * **End a sheep for good** (sheep-harness phase 2) — withdrawal's half at the
 * sheep home, and the one place every withdrawal path comes to.
 *
 * `rm` aborts a running turn, releases the container, and drops the sheep's
 * rows; the pasture stays, and that is said. A refusal is read against the
 * home's own listing rather than its wording, because homes word it
 * differently: a sheep the home no longer lists is already ended (a second
 * withdrawal racing the first), and one it still lists is at a home deployed
 * before sheep's end verb, which gets `abort` and a sentence saying what
 * remains. `where` is the place, said.
 */
export declare function endSheep(commands: SheepCommands, target: {
    name: string;
    sessionId: string;
    where: string;
}, narrate: (line: string) => void): Promise<void>;
