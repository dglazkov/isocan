import { type CanvasContents, type CanvasSnapshotResponse, type ContextExtras, type ContextLayer, type LinkedCanvas, type PersonalReadResponse, type SourceClassificationRequest, type SourceClassificationResponse } from "../../core/src/index.js";
/** A browser and a Node client inject transport; this module owns the shared read order. */
export interface ContextReadPort {
    classifySource(source: SourceClassificationRequest, signal?: AbortSignal): Promise<SourceClassificationResponse>;
    /** Actual source reads carry exclusion and this expected authority, not only an earlier preflight. */
    sourceSnapshot(source: SourceClassificationRequest, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    readPersonal(canvasId: string, request: {
        actorId: string;
        itemId: string;
        mode: "summary";
    }, signal?: AbortSignal): Promise<PersonalReadResponse>;
    designText?(canvasId: string, hash: string, signal?: AbortSignal): Promise<string>;
}
/** An automatic reader knows the destination's home and the card's disclosed target facts. */
export interface AutomaticSource {
    canvasId: string;
    home: string;
    source?: string | null;
}
/** Unknown and personal sources remain redacted, including persisted preview fallbacks. */
export type AutomaticSourceAccess = {
    kind: "ordinary";
    expectedHome: string;
} | {
    kind: "personal" | "unavailable";
    refused: string;
};
/** Classify before any snapshot, presence, blob or screenshot operation on an automatic edge. */
export declare function classifyAutomaticSource(io: Pick<ContextReadPort, "classifySource">, target: AutomaticSource, signal?: AbortSignal): Promise<AutomaticSourceAccess>;
/** Ordinary inheritance alone can contribute a governing design; personal reads use their own route. */
export declare function readInheritedCanvases(io: Pick<ContextReadPort, "classifySource" | "sourceSnapshot">, canvas: CanvasContents, home: string, signal?: AbortSignal): Promise<LinkedCanvas[]>;
/** Authorized personal composition always names a selected actor; ambient callers explicitly exclude it. */
export interface LayeredContextOptions {
    canvasId: string;
    home: string;
    canvas: CanvasContents;
    personal: "exclude" | {
        actorId: string;
    };
    extras?: ContextExtras;
    signal?: AbortSignal;
}
/** One current Context assembly for CLI/web/MCP, with private summaries appended after shared inheritance. */
export declare function readLayeredContext(io: ContextReadPort, options: LayeredContextOptions): Promise<ContextLayer[]>;
