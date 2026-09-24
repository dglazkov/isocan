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
