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
 *
 * **Three faces since phase 13.7**, which is why the title above is a name and
 * not a count: the terms page joined, and it joined here rather than as a route
 * inside the app because it is the one address whose answer must not depend on
 * whether the browser is anybody yet.
 */
export type Face =
  /** Nobody here yet, and standing at the origin itself: the front page. */
  | "front-page"
  /**
   * The innkeeper's obligations (phase 13.7) — what this home can see, what it
   * replicates, what it answers for, and who "it" is. The one face that does
   * not depend on who is asking; see `faceFor`.
   */
  | "terms"
  /** Nobody here yet, and standing anywhere else: the identity dialog. This is
   *  what phases 7-9 proved for a share-link arrival, and it is unchanged. */
  | "door"
  /** Somebody. The app, at whatever address they asked for. */
  | "here";

/**
 * **Where the terms live** — one spelling, because three things need it: the
 * rule below, the footnote on the front page, and the guard.
 *
 * At the origin rather than somewhere else, and that is the point rather than
 * a convenience: a page whose whole subject is what THIS operator can read off
 * THIS home would be a strange thing to host at somebody else's address. It is
 * a client-side route with no server change behind it — the daemon's SPA
 * fallback answers every unmatched GET with the app shell (`registerPages`), so
 * the origin serves it the same way it serves a canvas.
 */
export const TERMS_PATH = "/terms";

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
  // A trailing slash is the same door — `/` and `//` name the origin — and a
  // path with any segment in it does not.
  const at = pathname.replace(/\/+$/, "");
  /**
   * **Asked before who you are, and that is load-bearing.** The terms say what
   * the operator can read off your canvas; making somebody identify themselves
   * to this home in order to read that would be asking them to accept the
   * terms in order to see them. So this face is the same for a stranger, for a
   * person with a badge, and for an agent — and it is above the `actor` branch
   * for the same reason the front page had to be moved out from behind it in
   * phase 13.5.
   */
  if (at === TERMS_PATH) return "terms";
  if (actor) return "here";
  return at === "" ? "front-page" : "door";
}
