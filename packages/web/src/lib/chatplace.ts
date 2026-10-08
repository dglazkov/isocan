/**
 * **Where this viewer keeps the Chat: docked on the left, or a bar at the
 * bottom.**
 *
 * A viewer's layout, not a fact about the canvas — so it is one localStorage
 * key for every canvas, no Operation and no CLI verb. An agent has no screen
 * for the Chat to sit on; what it says lands in the same thread either way.
 *
 * This half is in the entry chunk because the first paint has to know which
 * frame to draw. Moving it — the drag, the drop zones, the bar itself — is
 * `chatmove.ts` and `ChatBar.tsx`, fetched when somebody uses them.
 */
export type ChatAt = "left" | "bottom";

/** The one localStorage key, for every canvas. `chatmove.ts` writes it. */
export const CHAT_AT_KEY = "isocan.chatAt";

/** The slice of `Storage` the placement uses — a parameter, so a test can
 *  hand in storage that throws. */
export type Store = Pick<Storage, "getItem" | "setItem">;

/** Left unless "bottom" was chosen here. Storage that throws — private mode, a
 *  sandboxed frame — reads as never chosen, which is today's dock. */
export function readChatAt(store?: Store): ChatAt {
  try {
    return (store ?? localStorage).getItem(CHAT_AT_KEY) === "bottom" ? "bottom" : "left";
  } catch {
    return "left";
  }
}
