import { type Actor, type CanvasSnapshotResponse, type Operation, type PostOpResponse, type SourceClassificationRequest } from "../../core/src/index.js";
import { type DesignArtifactRef } from "../../core/src/design-partner.js";
import { readDesignDirection, type DesignDirection } from "../../core/src/design-direction.js";
import { type GoverningDesignRead } from "./design-governing.js";
import type { DesignAuditReadPort } from "./design-audit-reader.js";
/** A serialized intended location, including a proposed screen before it has an item identity. */
export type DesignSystemTarget = {
    kind: "canvas";
} | {
    kind: "item";
    itemId: string;
} | {
    kind: "group";
    groupId: string;
} | {
    kind: "point";
    x: number;
    y: number;
};
/** Direct selection retains caller authority; automatic inheritance keeps its exclusion policy. */
export type DesignSystemSource = SourceClassificationRequest & {
    mode: "direct" | "inherited";
};
/** Governing reads and edits keep inherited source authority on each actual transport operation. */
export interface DesignSystemPort extends DesignAuditReadPort {
    actorId: string;
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    home(canvasId: string, signal?: AbortSignal): Promise<string>;
    upload(source: DesignSystemSource, text: string, filename: string, mimeType: string, signal?: AbortSignal): Promise<{
        blobHash: string;
        size: number;
    }>;
    edit(source: DesignSystemSource, operation: Extract<Operation, {
        type: "item.edit";
    }>, opId: string, signal?: AbortSignal): Promise<PostOpResponse>;
}
/** The original bytes and captured source metadata make a working file an identifiable projection. */
export interface DesignProjection {
    schemaVersion: 1;
    kind: "design-projection";
    source: DesignArtifactRef;
    destination: {
        canvasId: string;
        home: string;
        target: DesignSystemTarget;
    };
    expectedMetadata: {
        title: string;
        properties: Record<string, string>;
    };
    filename: string;
    mimeType: string;
    baseText: string;
    baseHash: string;
    exempt: boolean;
}
/** Authored stage and actual version authorship remain separate from guarded preference decisions. */
export interface DesignSystemRead {
    governing: GoverningDesignRead;
    direction: ReturnType<typeof readDesignDirection>;
    author: Actor | null;
    standing: {
        standing: "fine" | "owed" | "overdue";
        screenCount: number;
        uncoveredIds: string[];
        scopeId: string | null;
    } | null;
}
/** A retry retains the original projection, content and both operation/version identities. */
export interface DesignReconcileRequest {
    projection: DesignProjection;
    text: string;
    opId: string;
    versionId: string;
    retry?: boolean;
    signal?: AbortSignal;
}
/** Accepted content survives a later unavailable or stale consistency read. */
export type DesignReconcileResult = {
    status: "accepted" | "pending" | "refused";
    source: DesignArtifactRef;
    submittedOpId: string;
    opId: string | null;
    reason?: string;
    savedProjection?: DesignProjection;
    consistency?: {
        status: "current" | "stale" | "unavailable";
        reasons: string[];
        governing?: GoverningDesignRead;
    };
};
/** Read the real governing document and direction at one explicit canvas location. */
export declare function readDesignSystem(io: DesignSystemPort, options: {
    canvasId: string;
    target?: DesignSystemTarget;
    signal?: AbortSignal;
}): Promise<DesignSystemRead>;
/** Capture exact permitted bytes; export never creates a second canvas system or private-byte copy. */
export declare function projectDesignSystem(io: DesignSystemPort, options: {
    canvasId: string;
    target?: DesignSystemTarget;
    signal?: AbortSignal;
}): Promise<DesignProjection>;
/** A companion manifest is untrusted input: its base identity and bytes must agree before any save. */
export declare function parseDesignProjection(value: unknown): Promise<DesignProjection>;
/** Validate authored bytes and captured identity before creating a durable pending intent; this performs no transport I/O. */
export declare function prepareDesignReconciliation(request: DesignReconcileRequest): Promise<DesignReconcileRequest>;
/** Reconcile one prepared source edit, preserving uncertain intent and post-save consistency separately. */
export declare function reconcileDesignProjection(io: DesignSystemPort, request: DesignReconcileRequest): Promise<DesignReconcileResult>;
/** Direction changes edit authored DESIGN.md through the same captured conditional reconciliation path. */
export declare function writeDesignDirection(io: DesignSystemPort, request: Omit<DesignReconcileRequest, "text"> & {
    direction: DesignDirection;
}): Promise<DesignReconcileResult>;
export { readGoverningDesign } from "./design-governing.js";
export type { GoverningDesignRead } from "./design-governing.js";
