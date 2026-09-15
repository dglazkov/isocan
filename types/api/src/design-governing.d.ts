import { parseDesign, type CanvasContents, type LinkedCanvas } from "../../core/src/index.js";
import type { DesignArtifactRef } from "../../core/src/design-partner.js";
import type { DesignAuditReadPort } from "./design-audit-reader.js";
/** Exact governing bytes and their selection provenance, shared by creation, checks and repair. */
export type GoverningDesignRead = {
    status: "available";
    artifact: DesignArtifactRef;
    title: string;
    inherited: boolean;
    text: string;
    document: ReturnType<typeof parseDesign>;
    refusedSources: Array<{
        canvasId: string;
        itemId: string;
        reason: string;
    }>;
} | {
    status: "none" | "unavailable";
    artifact: DesignArtifactRef | null;
    title: string | null;
    reason: string;
    refusedSources: Array<{
        canvasId: string;
        itemId: string;
        reason: string;
    }>;
};
/** Reuses core scope precedence and reasserts source policy when opening inherited document bytes. */
export declare function readGoverningDesign(io: DesignAuditReadPort, options: {
    canvasId: string;
    home: string;
    canvas: CanvasContents;
    atId?: string;
    signal?: AbortSignal;
    linked?: LinkedCanvas[];
    documents?: Map<string, Promise<{
        text: string;
        document: ReturnType<typeof parseDesign>;
    }>>;
}): Promise<GoverningDesignRead>;
