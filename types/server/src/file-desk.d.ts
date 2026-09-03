import type { ActorClaim, Attestation, Capability, Grant, GrantSubject, Group, Space } from "../../core/src/index.js";
import type { BadgeRecord, Desk, PassRecord, Provenance } from "./desk.js";
export declare class FileDesk implements Desk {
    readonly home: string;
    private state;
    private chain;
    constructor(home: string);
    init(): Promise<void>;
    /** Drain the write chain so a shutdown cannot land between a log append and
     * its snapshot; nothing is held open beyond that. */
    close(): Promise<void>;
    put(badge: BadgeRecord): Promise<void>;
    /** A killed badge answers null, exactly like one this home never minted —
     * the desk seam's contract, and what turns a kill into `bad-badge` at the
     * next request the holder makes. */
    badge(badgeId: string): Promise<BadgeRecord | null>;
    touch(badgeId: string, at: string): Promise<void>;
    setClaims(badgeId: string, claims: ActorClaim[]): Promise<void>;
    claimsOf(badgeId: string): Promise<ActorClaim[]>;
    claimants(actorId: string): Promise<{
        badgeId: string;
        claim: ActorClaim;
    }[]>;
    holdersOf(sessionKey: string): Promise<{
        badgeId: string;
        claim: ActorClaim;
    }[]>;
    claimsIn(canvasIds: readonly string[]): Promise<ActorClaim[]>;
    admit(badgeId: string, canvasId: string, provenance: Provenance, capability?: Capability): Promise<void>;
    badgesIn(canvasId: string): Promise<BadgeRecord[]>;
    reroot(badgeId: string, canvasId: string, provenance: Provenance, capability?: Capability): Promise<void>;
    expel(badgeId: string, canvasId: string): Promise<void>;
    killBadge(badgeId: string, at: string, by: string): Promise<BadgeRecord | null>;
    attest(badgeId: string, attestation: Attestation): Promise<void>;
    badgesAttesting(attribute: string): Promise<BadgeRecord[]>;
    grantsFor(canvasId: string): Promise<Grant[]>;
    grantsForSpace(spaceId: string): Promise<Grant[]>;
    putSpace(space: Space): Promise<void>;
    space(spaceId: string): Promise<Space | null>;
    spaceOf(canvasId: string): Promise<Space | null>;
    spacesFor(badge: BadgeRecord): Promise<Space[]>;
    /** The spaces ledger, which a desk from before roles phase 4 lacks. */
    private spaces;
    putGroup(group: Group): Promise<void>;
    group(groupId: string): Promise<Group | null>;
    groupsFor(badge: BadgeRecord): Promise<Group[]>;
    grantsBySubject(subject: GrantSubject): Promise<Grant[]>;
    /** The groups ledger, which a desk from before roles phase 5 lacks. */
    private groups;
    putGrant(grant: Grant): Promise<void>;
    revokeGrant(grantId: string, at: string, by: string): Promise<Grant | null>;
    putPass(pass: PassRecord): Promise<void>;
    pass(passId: string): Promise<PassRecord | null>;
    /**
     * Single-use, and on a file backing the guarantee comes from the desk's own
     * write chain: `enqueue` serializes this read-modify-write against every
     * other desk write, so two redemptions of one pass arriving in the same
     * millisecond are two runs of this function one after the other, and the
     * second one sees `redeemedAt` set.
     *
     * Both halves of the answer are load-bearing. `redeemed` says who won;
     * `pass` is the row as the WINNER left it, so the loser can be told when it
     * was spent rather than merely refused.
     */
    redeemPass(passId: string, at: string, by: string): Promise<{
        pass: PassRecord;
        redeemed: boolean;
    } | null>;
    adopt(sessionKey: string, badgeId: string): Promise<ActorClaim | null>;
    shelve(rows: Record<string, ActorClaim>): Promise<void>;
    /**
     * The badge behind an id, **or nothing if it was killed** — the one lookup
     * every method here goes through, so "a killed badge is a badge nobody
     * holds" is a property of the file rather than a rule each method
     * remembers. `killBadge` and `replay` are the two deliberate exceptions:
     * they are the code that reads the tombstone.
     */
    private live;
    /** Serialize this desk's own writes. Not the engine's chain: a badge write
     * is not an op and must not be able to stall behind one. */
    private enqueue;
    /** Durable first, derived second — the same order the oplog uses. */
    private append;
    private writeSnapshot;
    private replay;
}
