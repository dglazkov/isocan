import type { PersonalDelegate } from "../../core/src/index.js";
/** Immutable classification precedes the first canvas write and survives joins/deletion. */
export interface PersonalSourceRecord {
    canvasId: string;
    ownerId: string;
    birthOpId: string;
    createdAt: string;
    birth: "reserved" | "created";
}
/** One owner pointer; source ownership is resolved through actor joins when read. */
export interface PersonalOwnerRecord {
    ownerId: string;
    sourceCanvasId: string;
    enrolledAt: string;
}
/** Concrete consent never follows a copied card or a new primary source. */
export interface PersonalConsent {
    ownerId: string;
    sourceCanvasId: string;
    destinationCanvasId: string;
    itemId: string;
    createdAt: string;
}
/** Stable native identities distinguish transport retry from another link gesture. */
export interface PersonalLinkIntent extends PersonalConsent {
    requestId: string;
    groupId: string;
    opId: string;
}
/** Reservation is transactional on CloudDesk and serialized by one FileDesk writer. */
export interface ReservePersonalRequest {
    ownerId: string;
    aliases: string[];
    canvasId: string;
    birthOpId: string;
    at: string;
}
/** Joined datasets remain separately classified and retain their own consent. */
export interface PersonalReservation {
    source: PersonalSourceRecord;
    preserved: PersonalSourceRecord[];
}
/** Private policy lives in the Desk, never a canvas property or replicated operation. */
export interface PersonalDesk {
    /** A trusted home marked this retained copy private; it conveys no ownership. */
    personalReplica(canvasId: string): Promise<string | null>;
    recordPersonalReplica(canvasId: string, home: string): Promise<void>;
    personalSource(canvasId: string): Promise<PersonalSourceRecord | null>;
    personalBinding(ownerIds: string[]): Promise<PersonalReservation | null>;
    reservePersonal(request: ReservePersonalRequest): Promise<PersonalReservation>;
    finishPersonalBirth(canvasId: string, birthOpId: string): Promise<void>;
    reservePersonalLink(intent: PersonalLinkIntent): Promise<PersonalLinkIntent>;
    personalLinksFor(destinationCanvasId: string): Promise<PersonalConsent[]>;
    personalLinkForItem(destinationCanvasId: string, itemId: string): Promise<PersonalConsent | null>;
    personalDelegations(sourceCanvasId: string): Promise<PersonalDelegate[]>;
    setPersonalDelegation(sourceCanvasId: string, delegation: PersonalDelegate): Promise<PersonalDelegate>;
}
/** Canonical pointer first, then deterministic aliases; never merge or retarget a dataset. */
export declare function selectPersonalBinding(ownerIds: string[], owners: PersonalOwnerRecord[], sources: PersonalSourceRecord[]): PersonalReservation | null;
/** Retry identity may never be reused for a different source or concrete card. */
export declare function assertPersonalIntent(previous: PersonalLinkIntent, next: PersonalLinkIntent): void;
