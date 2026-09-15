import type { DesignRequestReadPort } from "./design-request-reader.js";
/** Inspect only the pinned Codex variant's fixed source files; no script or native engine is executed. */
export declare function inspectDesignCraftPackage(directory: string): Promise<{
    status: "absent" | "drifted";
    directory: string;
    variant: "Codex skill 4.3.1";
    native: "unsupported/not-run";
    files: {
        path: string;
        status: "verified" | "missing" | "drifted";
        reason?: string;
    }[];
    reason: string;
} | {
    status: "drifted" | "incomplete" | "verified";
    directory: string;
    variant: "Codex skill 4.3.1";
    native: "unsupported/not-run";
    files: {
        path: string;
        status: "verified" | "missing" | "drifted";
        reason?: string;
    }[];
    reason?: never;
}>;
/** Export validated original context into a new directory, refusing every existing destination. */
export declare function exportDesignCraft(directory: string, value: unknown): Promise<{
    directory: string;
    packetId: string;
    files: string[];
}>;
/** Check source authority and original capture separately from proposed working-file edits; never rewrite either. */
export declare function checkDesignCraftDirectory(io: DesignRequestReadPort, options: {
    canvasId: string;
    requestId: string;
    directory: string;
    signal?: AbortSignal;
}): Promise<{
    files: {
        path: string;
        status: "unchanged" | "modified" | "unavailable";
        reason?: string;
    }[];
    notes: string;
    packetId: string;
    status: "current" | "stale" | "unavailable";
    reasons: string[];
    directory: string;
}>;
