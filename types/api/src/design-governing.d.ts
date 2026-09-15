import { parseDesign, type Actor, type CanvasContents, type LinkedCanvas, type ItemVersion, type GoverningDesignSelection } from "../../core/src/index.js";
import type { DesignArtifactRef } from "../../core/src/design-partner.js";
import type { DesignAuditReadPort } from "./design-audit-reader.js";
type Selection = Pick<GoverningDesignSelection, "level" | "scopeId" | "scopeDepth" | "reason"> & {
    candidates: Array<{
        artifact: DesignArtifactRef;
        title: string;
        updatedAt: string;
    }>;
};
type Common = {
    exempt: boolean;
    selection: Selection;
    refusedSources: Array<{
        canvasId: string;
        itemId: string;
        reason: string;
    }>;
};
/** Exact governing bytes and their selection provenance, shared by creation, checks and repair. */
export type GoverningDesignRead = Common & ({
    status: "available";
    artifact: DesignArtifactRef;
    title: string;
    inherited: boolean;
    text: string;
    document: ReturnType<typeof parseDesign>;
    version: ItemVersion;
    versions: number;
    author: Actor;
    metadata: {
        title: string;
        properties: Record<string, string>;
    };
} | {
    status: "none" | "unavailable";
    artifact: DesignArtifactRef | null;
    title: string | null;
    reason: string;
});
/** Reuses core scope precedence and reasserts source policy when opening inherited document bytes. */
export declare function readGoverningDesign(io: DesignAuditReadPort, options: {
    canvasId: string;
    home: string;
    canvas: CanvasContents;
    project?: {
        properties?: Record<string, string>;
    };
    atId?: string;
    groupId?: string | null;
    point?: {
        x: number;
        y: number;
    };
    signal?: AbortSignal;
    linked?: LinkedCanvas[];
    documents?: Map<string, Promise<{
        text: string;
        document: ReturnType<typeof parseDesign>;
    }>>;
}): Promise<GoverningDesignRead>;
export {};
