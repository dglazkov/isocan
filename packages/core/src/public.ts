import { isLive, isSpaceGrant, LINK, type Grant, type GrantListingDecision } from "./grants.ts";

/** A catalogue row contains only deliberately published entry metadata. */
export interface PublicCanvas {
  id: string;
  title: string;
  home: string;
  capability: "read" | "view";
}

/** The catalogue of the one home queried, never a replica aggregation. */
export interface PublicCanvasesResponse { canvases: PublicCanvas[] }

/** One owner's explicit decision on a captured link grant. */
export interface SetPublicListingRequest { listed: boolean; actorId?: string }

/** Unknown or damaged records cannot opt a canvas into publication. */
export function isGrantListingDecision(value: unknown): value is GrantListingDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).every((key) => key === "listed" || key === "at" || key === "by") &&
    typeof row.listed === "boolean" && typeof row.at === "string" && Number.isFinite(Date.parse(row.at)) &&
    typeof row.by === "string" && row.by.length > 0;
}

/** Publication never grants access or lowers a link's capability. */
export function canListGrant(grant: Grant): grant is Grant & { canvasId: string; capability: "read" | "view" } {
  return !isSpaceGrant(grant) && typeof grant.canvasId === "string" && grant.canvasId.length > 0 && isLive(grant) && grant.subject === LINK && !grant.bars &&
    (grant.capability === "read" || grant.capability === "view");
}

/** Consent is effective only while this exact link remains eligible. */
export function isListedGrant(grant: Grant): grant is Grant & { canvasId: string; capability: "read" | "view" } {
  return canListGrant(grant) && isGrantListingDecision(grant.listing) && grant.listing.listed;
}

/** Identity-independent catalogue; browsing it does not admit or visit. */
export const PUBLIC_CANVASES_ROUTE = "/api/public";

/** The concrete grant id prevents a stale toggle from publishing its replacement. */
export function publicListingRoute(canvasId: string, grantId: string): string {
  return `/api/projects/${encodeURIComponent(canvasId)}/grants/${encodeURIComponent(grantId)}/listing`;
}
