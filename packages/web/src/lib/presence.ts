import type { CanvasState, PresenceSession } from "@isocan/core";

/**
 * Honest liveness: a connected session that hasn't touched the daemon in a
 * while is QUIET, not gone — the TTL sweep handles gone. Rendering the gap
 * ("quiet 40s") keeps a thinking agent legible instead of frozen-looking.
 * Only agent (CLI) sessions get this treatment: a still human mouse is just
 * a still mouse.
 */
/** Above `wait`'s ≤30s heartbeat, so a parked agent never flickers quiet. */
export const QUIET_AFTER_MS = 35_000;

/** "40s" / "3m" since the session last touched the daemon, or null while it
 * is fresh (or not an agent). */
export function quietFor(session: PresenceSession, nowMs = Date.now()): string | null {
  if (session.kind !== "cli") return null;
  const ms = nowMs - Date.parse(session.lastSeen);
  if (!Number.isFinite(ms) || ms < QUIET_AFTER_MS) return null;
  return ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`;
}

/** Where a session stands in the world: the center of the item it declared it
 * is working on, its freestanding work point, or failing those its cursor.
 * Null for a session with no location (an on-call agent parked in the home).
 * The minimap dot and follow mode both aim here, so they always agree. */
export function sessionLocus(
  session: PresenceSession,
  canvas: CanvasState | null,
): { x: number; y: number } | null {
  if (session.activity?.kind === "working") {
    if ("itemId" in session.activity) {
      const item = canvas?.items[session.activity.itemId];
      if (item) return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
    } else {
      return { x: session.activity.x, y: session.activity.y };
    }
  }
  return session.cursor;
}

/** The status line a session shows: only what it said or what its working
 * animation implies — never an invented verb. A live agent with no status is
 * rendered as present-and-quiet (see `quietFor`), not as "working": after a
 * reply clears the status, we genuinely don't know what it is doing. */
export function statusLine(session: PresenceSession): string | null {
  if (session.status) return session.status;
  if (session.activity) {
    return "itemId" in session.activity ? "working on an item" : "working on the canvas";
  }
  return null;
}
