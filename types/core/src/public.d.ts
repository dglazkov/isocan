/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
