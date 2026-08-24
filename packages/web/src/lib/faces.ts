import type { Actor } from "@isocan/core";

/**
 * **One address, two faces** (phase 13.5).
 *
 * The home origin is the same address every canvas lives at, and Scene 0 asks
 * it to wear a front page for somebody who has never been here. Before this
 * rule existed, `App` rendered the door INSTEAD OF the router whenever this
 * browser was nobody yet — so a stranger arriving at the origin met "pick your
 * name" before they had learned what isocan is, which is the one thing Scene 0
 * says the front door must never do.
 *
 * The rule is small enough to inline and is deliberately not inlined. It is a
 * *routing* decision that decides what a stranger meets, and the regression it
 * guards against is invisible: widen it by one path and every share link stops
 * asking who you are; narrow it by one and the front page disappears again.
 * A named function is a thing a test can hold still.
 */
export type Face =
  /** Nobody here yet, and standing at the origin itself: the front page. */
  | "front-page"
  /** Nobody here yet, and standing anywhere else: the identity dialog. This is
   *  what phases 7-9 proved for a share-link arrival, and it is unchanged. */
  | "door"
  /** Somebody. The app, at whatever address they asked for. */
  | "here";

/**
 * Which face this browser meets, at this address, being who it is.
 *
 * The origin's path is matched EXACTLY, not as a prefix. A canvas's path (see
 * `canvasPath` in core) is under `/` in every sense a prefix test would
 * notice, and a stranger who follows a share link must still meet the door:
 * the canvas behind it may be open to a link grant, but who they are is still
 * stamped on everything they touch there.
 */
export function faceFor(pathname: string, actor: Actor | null): Face {
  if (actor) return "here";
  // A trailing slash is the same door — `/` and `//` name the origin — and a
  // path with any segment in it does not.
  return pathname.replace(/\/+$/, "") === "" ? "front-page" : "door";
}
