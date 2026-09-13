import { type Grant, type GrantListingDecision } from "./grants.js";
/** A catalogue row contains only deliberately published entry metadata. */
export interface PublicCanvas {
    id: string;
    title: string;
    home: string;
    capability: "read" | "view";
}
/** The catalogue of the one home queried, never a replica aggregation. */
export interface PublicCanvasesResponse {
    canvases: PublicCanvas[];
}
/** One owner's explicit decision on a captured link grant. */
export interface SetPublicListingRequest {
    listed: boolean;
    actorId?: string;
}
/** Unknown or damaged records cannot opt a canvas into publication. */
export declare function isGrantListingDecision(value: unknown): value is GrantListingDecision;
/** Publication never grants access or lowers a link's capability. */
export declare function canListGrant(grant: Grant): grant is Grant & {
    canvasId: string;
    capability: "read" | "view";
};
/** Consent is effective only while this exact link remains eligible. */
export declare function isListedGrant(grant: Grant): grant is Grant & {
    canvasId: string;
    capability: "read" | "view";
};
/** Identity-independent catalogue; browsing it does not admit or visit. */
export declare const PUBLIC_CANVASES_ROUTE = "/api/public";
/** The concrete grant id prevents a stale toggle from publishing its replacement. */
export declare function publicListingRoute(canvasId: string, grantId: string): string;
