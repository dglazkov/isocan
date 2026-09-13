import type { ContextContentPage } from "@isocan/core";
import { ApiError, type DaemonRoutes } from "./routes.ts";

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
export async function readContextItem(
  client: DaemonRoutes,
  canvasId: string,
  threadId: string,
  commentId: string,
  itemId: string,
  options: ContextBytesOptions = {},
): Promise<ContextItemContent> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 16_384;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("content offset must be a non-negative integer");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 262_144) throw new Error("content limit must be between 1 and 262144 bytes");
  const manifest = await client.commentContext(canvasId, threadId, commentId);
  const index = manifest.entries.findIndex((entry) => entry.itemId === itemId);
  if (index < 0) throw new Error(`item ${itemId} is not in this saved context`);
  const page = await client.contextContentPage(canvasId, { threadId, commentId, offset: index, limit: 1, face: options.face ?? "source" });
  const entry = page.entries[0];
  if (!entry || entry.itemId !== itemId || page.revision !== manifest.revision) throw new Error("saved context changed while its content was being read; read the request again");
  const result: ContextItemContent = { ...entry, canvasId, revision: page.revision, offset, bytesRead: 0, nextOffset: null };
  if (entry.status !== "available" || !entry.blob) return result;
  let bytes: Buffer;
  try {
    bytes = await client.downloadBlob(canvasId, entry.blob.blobHash);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const unavailable = { ...result, status: "unavailable" as const, reason: "the saved version's bytes are no longer available at this home" };
      delete unavailable.url;
      return unavailable;
    }
    throw error;
  }
  if (offset > bytes.length) throw new Error(`content offset ${offset} exceeds ${bytes.length} bytes`);
  const chunk = bytes.subarray(offset, offset + limit);
  let encoding: "utf8" | "base64" = "base64";
  let data = chunk.toString("base64");
  if (/^(text\/|application\/(?:json|[^;]+\+json|xml|javascript|[^;]+\+xml)(?:;|$))/.test(entry.blob.mimeType)) {
    try {
      data = new TextDecoder("utf-8", { fatal: true }).decode(chunk);
      encoding = "utf8";
    } catch { /* A split multibyte character is returned losslessly as base64. */ }
  }
  return { ...result, bytesRead: chunk.length, totalBytes: bytes.length, nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null, encoding, data };
}
