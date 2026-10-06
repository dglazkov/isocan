import { createContext } from "react";

/**
 * **The fragment an HTML item's frame opens at** (wireframes phase 8, *Play
 * from here*). Full screen provides the route's `?at=` (a query, because
 * the route's own `#` is where a pass rides — `lib/arrival.ts`), and the HTML frame
 * appends it to its src: the frame is a blob address, so a fragment costs no
 * fetch and no cache, and the document inside decides what it means — a
 * wireframe prototype opens at the screen it names. Everywhere else it is
 * "", so a card on the canvas never carries one.
 */
export const FrameAnchor = createContext("");

/** A src with the anchor on it — the anchor with or without its `#`. */
export function anchored(src: string, anchor: string): string {
  const bare = anchor.replace(/^#/, "");
  return bare ? `${src.split("#")[0]}#${bare}` : src;
}

const ANCHOR_MESSAGE = "isocan:anchor";

/** A screen id with room to spare; the page is untrusted, and this goes into a src. */
const ANCHOR_MAX = 200;

/**
 * The fragment a page says it is at — `{ type: "isocan:anchor", anchor }` —
 * or null for any other message. Too long is refused whole rather than cut:
 * half a fragment names a screen the page never meant.
 */
export function anchorFromMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.type !== ANCHOR_MESSAGE || typeof message.anchor !== "string") return null;
  const bare = message.anchor.replace(/^#/, "");
  return bare.length <= ANCHOR_MAX ? bare : null;
}

/**
 * **Where the next version of an item opens.**
 *
 * An agent that edits a prototype stacks a new version, and a new version is
 * a new blob, so the frame is a new document that starts at its first screen
 * — a person four screens in was thrown back to the start on every update.
 * The page cannot remember for itself: the frame is an opaque origin with no
 * storage, and the new src has no fragment. So the page reports where it is
 * (`anchorFromMessage`), and when the SAME item's version changes the new
 * frame opens at the last place reported.
 *
 * `carried` is fixed at the moment the version changes and not after: a
 * report changes nothing about the frame already open, whose src must stay
 * put — a different src is a different frame in `HtmlView`'s pool. A
 * different item starts clean, so full screen flipping between slides never
 * opens one at another's screen.
 */
export interface FrameSpot {
  itemId: string | undefined;
  blobHash: string;
  /** The last fragment this item's frame reported, null before it says. */
  reported: string | null;
  /** What this version's frame opened at; null opens it as before. */
  carried: string | null;
}

export function nextSpot(spot: FrameSpot, itemId: string | undefined, blobHash: string): FrameSpot {
  if (spot.itemId !== itemId) return { itemId, blobHash, reported: null, carried: null };
  if (spot.blobHash !== blobHash) return { ...spot, blobHash, carried: spot.reported };
  return spot;
}
