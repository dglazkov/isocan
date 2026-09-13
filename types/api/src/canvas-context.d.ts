import type { ContextContentPage } from "../../core/src/index.js";
import { type DaemonRoutes } from "./routes.js";
export interface ContextReadOptions {
    /** Group ID or unique reference; combined with explicit item roots. */
    in?: string | undefined;
    rootIds?: readonly string[] | undefined;
    includeExcluded?: boolean | undefined;
    expectedRevision?: number | undefined;
}
export interface CommentContextOptions extends ContextReadOptions {
    /** Additional item references, combined with #references in the message. */
    items?: readonly string[] | undefined;
}
export interface ContextPageOptions {
    threadId?: string | undefined;
    commentId?: string | undefined;
    rootIds?: readonly string[] | undefined;
    includeExcluded?: boolean | undefined;
    expectedRevision?: number | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
    face?: "source" | "visual" | undefined;
}
export interface ContextBytesOptions {
    face?: "source" | "visual" | undefined;
    /** Byte offset, not characters. Binary and split UTF-8 chunks use base64. */
    offset?: number | undefined;
    limit?: number | undefined;
}
export type ContextItemContent = ContextContentPage["entries"][number] & {
    canvasId: string;
    revision: number;
    offset: number;
    bytesRead: number;
    totalBytes?: number | undefined;
    nextOffset: number | null;
    encoding?: "utf8" | "base64" | undefined;
    data?: string | undefined;
};
/** Read one saved version, even after the original item no longer exists.
 * The page and blob both pass through the home's ordinary admission gates. */
export declare function readContextItem(client: DaemonRoutes, canvasId: string, threadId: string, commentId: string, itemId: string, options?: ContextBytesOptions): Promise<ContextItemContent>;
