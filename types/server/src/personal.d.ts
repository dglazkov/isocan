import { type Actor, type Capability, type PersonalStatusResponse, type PersonalEnsureResponse, type PersonalLinkRequest, type PersonalUnlinkRequest, type PersonalLinkResponse, type PersonalUnlinkResponse, type PersonalLinkStatus, type PersonalReadRequest, type PersonalReadResponse, type PersonalDelegate, type SourceRequestContext } from "../../core/src/index.js";
import type { Desk } from "./desk.js";
import type { Engine } from "./engine.js";
import type { Store } from "./store.js";
import type { PersonalSourceRecord } from "./personal-desk.js";
/** Typed privacy refusals are never retried by minting another badge. */
export declare class PersonalError extends Error {
    readonly code: string;
    readonly statusCode = 403;
    constructor(message: string, code?: string);
}
/** Authoritative private state is checked before obtaining any source runtime or blob. */
export declare class PersonalService {
    private readonly engine;
    private readonly store;
    private readonly desk;
    private readonly foreign;
    constructor(engine: Engine, store: Store, desk: Desk, foreign: (canvasId: string) => boolean);
    private caller;
    private state;
    status(badgeId: string, actorId: string, home: string): Promise<PersonalStatusResponse>;
    ensure(badgeId: string, actorId: string, home: string): Promise<PersonalEnsureResponse>;
    sourceOwner(badgeId: string, actorId: string, sourceCanvasId: string): Promise<{
        actor: Actor;
        source: PersonalSourceRecord;
    }>;
    delegates(badgeId: string, actorId: string, sourceCanvasId: string): Promise<PersonalDelegate[]>;
    delegate(badgeId: string, actorId: string, sourceCanvasId: string, agentId: string, allowed: boolean): Promise<PersonalDelegate>;
    private destination;
    private validateLink;
    links(badgeId: string, actorId: string, canvasId: string, home: string): Promise<PersonalLinkStatus[]>;
    link(badgeId: string, canvasId: string, request: PersonalLinkRequest, home: string): Promise<PersonalLinkResponse>;
    unlink(badgeId: string, canvasId: string, request: PersonalUnlinkRequest): Promise<PersonalUnlinkResponse>;
    read(badgeId: string, canvasId: string, request: PersonalReadRequest, home: string, context?: SourceRequestContext): Promise<PersonalReadResponse>;
    direct(canvasId: string, badgeId: string, context: SourceRequestContext, actual: "read" | "edit" | "own", lookup?: "entry" | "discovery", actorId?: string): Promise<Capability | null>;
}
