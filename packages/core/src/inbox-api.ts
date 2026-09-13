import type { InboxEntry } from "./inbox.ts";

/** One person's inbox, assembled at the homes that own the canvases. A failed
 * canvas has no entries in this response and is explicitly unavailable. */
export interface InboxResponse {
  entries: InboxEntry[];
  marks: import("./seen.ts").SeenMarks;
  homes: Record<string, string | null>;
  unavailable: { canvasId: string; error: string }[];
}

/** The read-only inbox assembly; a canvas id explicitly presents its address. */
export const INBOX_ROUTE = "/api/inbox";
/** A named canvas is an explicit address; omission asks only for discoverable canvases. */
export function inboxRoute(actorId: string, options: { canvasId?: string; label?: string } = {}): string {
  const query = new URLSearchParams({ actorId });
  if (options.canvasId !== undefined) query.set("canvasId", options.canvasId);
  if (options.label !== undefined) query.set("label", options.label);
  return `${INBOX_ROUTE}?${query}`;
}
