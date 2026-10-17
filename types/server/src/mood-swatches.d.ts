import type { TextModel } from "./text.js";
type Sharp = typeof import("sharp").default;
type ImportSharp = () => Promise<{
    default: Sharp;
}>;
/**
 * Extract up to six dominant colour swatches for an image blob using `sharp`
 * when installed, falling back to a picture-capable text model (`estimated: true`)
 * or refusing with `503 image-swatches-unavailable`.
 */
export declare function extractMoodSwatches(input: {
    bytes: Buffer;
    mimeType: string;
    loadSharpOption?: ImportSharp | undefined;
    textModel: TextModel;
    badgeId: string;
    notTheOwners: () => Promise<{
        owner: string | null;
    } | null>;
}): Promise<{
    status: number;
    body: unknown;
}>;
export {};
