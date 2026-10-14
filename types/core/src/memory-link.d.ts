import type { Item } from "./model.js";
export declare const MEMORY_PROP = "memory";
export declare const MEMORY_INHERIT = "inherit";
/** Phase 2's value — the person's own canvas, read only by their actors. */
export declare const MEMORY_PERSONAL = "personal";
export type MemoryLink = "inherit" | "personal";
/** What a canvas card says about the memory behind it, or nothing. */
export declare function memoryOf(item: Item): MemoryLink | null;
/** The patch that sets or clears the link — one spelling for both surfaces,
 *  cleared with `removeProperties` for the reason `markPatch` records. */
export declare function memoryPatch(memory: MemoryLink | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
