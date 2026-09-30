import type { DesignAcceptedResponse, DesignContinuation, DesignDiscovery, DesignGoverningBinding } from "./design-request.js";
/** A hash alone cannot identify which permitted source supplied an artifact. */
export interface DesignArtifactRef {
    home: string;
    canvasId: string;
    itemId: string;
    versionId: string;
    blobHash: string;
}
/** Supplied locations and inspected bytes are distinct states; unavailable sources retain a reason. */
export interface DesignReference {
    id: string;
    state: "supplied" | "fetched" | "inaccessible" | "superseded";
    url?: string;
    artifact?: DesignArtifactRef;
    reason?: string;
}
/** Shape or association refusal; authentication remains the writer’s separate responsibility. */
export declare class DesignPartnerContractError extends Error {
    readonly code: "invalid" | "association" | "actor" | "stale" | "conflict";
    constructor(code: "invalid" | "association" | "actor" | "stale" | "conflict", message: string);
}
/** Raises a schema error without implying custody or inspection. */
export declare const bad: (message: string) => never;
/** Rejects unknown semantic fields before projecting a persisted record. */
export declare const object: (v: unknown, fields?: readonly string[]) => Record<string, unknown>;
/** Common version and request keys used by each strict record parser. */
export declare const recordFields: string[];
/** Requires bounded nonempty text for persisted identities and prose. */
export declare const text: (v: unknown) => string;
/** Rejects coercion of persisted booleans. */
export declare const bool: (v: unknown) => boolean;
/** Requires a safe integral protocol value at the stated lower bound. */
export declare const integer: (v: unknown, min?: number) => number;
/** Accepts only explicitly supported semantic enum values. */
export declare const choice: <T extends string>(v: unknown, values: readonly T[]) => T;
/** Bounds persisted arrays and validates each entry. */
export declare const list: <T>(v: unknown, parse: (entry: unknown) => T, max?: number) => T[];
/** Requires at least one explicit entry for an answer or comparison. */
export declare const nonempty: <T>(items: T[]) => T[];
/** Rejects repeated identities within one persisted collection. */
export declare const unique: <T>(items: T[], key: (item: T) => string) => T[];
/** Validates a bounded unique collection of textual identities. */
export declare const ids: (v: unknown) => string[];
/** Preserves an explicit absent fact while validating provided text. */
export declare const nullableText: (v: unknown) => string | null;
/** Checks absolute HTTP(S) reference locations without fetching them. */
export declare const url: (v: unknown) => string;
/** Keeps presentation fidelity independent of request progress. */
export declare const fidelity: (v: unknown) => "wireframe" | "designed" | "implementation";
/** Requires a lowercase SHA-256 content identity. */
export declare const hash: (v: unknown) => string;
/** Validates common schema version, request identity and epoch. */
export declare function base(v: Record<string, unknown>): {
    schemaVersion: 1;
    requestId: string;
    epoch: number;
};
/** Checks source/version/hash shape without claiming the caller can access or has inspected its bytes. */
export declare function parseDesignArtifactRef(value: unknown): DesignArtifactRef;
/** Refuses filename-only uploads and fetched URLs without version identities; availability stays explicit. */
export declare function parseDesignReference(value: unknown): DesignReference;
/** Parses the entrance source of a design brief or interview. */
export declare function parseDesignEntranceSource(value: unknown): import("./design-partner.js").DesignBrief["source"];
/** Parses a question source reference. */
export declare function parseDesignQuestionSource(value: unknown): import("./design-partner.js").DesignQuestionSource;
/** Parses a list of accepted response references. */
export declare function parseDesignAcceptedResponses(value: unknown): DesignAcceptedResponse[];
/** Validates writer-stamped continuation facts without elevating native reports into human responses. */
export declare function parseDesignContinuation(value: unknown): DesignContinuation;
/** Explicit purpose and fact bindings support a request-wide initial discovery allowance. */
export declare function parseDesignDiscovery(value: unknown): DesignDiscovery;
/** The expected governing winner is separate from the list of incidental input references. */
export declare function parseDesignGoverning(value: unknown): DesignGoverningBinding;
