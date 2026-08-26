import type { CanvasContents, PresenceSession } from "@isocan/core";
import { QUIET_AFTER_MS } from "@isocan/core";

export { QUIET_AFTER_MS };
import { threadWorldPos } from "./viewport.ts";

/**
 * Honest liveness: a connected session that hasn't touched the daemon in a
 * while is QUIET, not gone — the TTL sweep handles gone. Rendering the gap
 * ("quiet 40s") keeps a thinking agent legible instead of frozen-looking.
 * Only agent (CLI) sessions get this treatment: a still human mouse is just
 * a still mouse.
 */
/** "40s" / "3m" since the session last touched the daemon, or null while it
 * is fresh (or not an agent). */
export function quietFor(
  session: Pick<PresenceSession, "kind" | "lastSeen">,
  nowMs = Date.now(),
): string | null {
  if (session.kind !== "cli") return null;
  const ms = nowMs - Date.parse(session.lastSeen);
  if (!Number.isFinite(ms) || ms < QUIET_AFTER_MS) return null;
  return ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`;
}

/** Where a session stands in the world: the center of the item it declared it
 * is working on, its freestanding work point, or failing those its cursor.
 * Null for a session that has not stood anywhere yet. The minimap dot and
 * follow mode both aim here, so they always agree. */
export function sessionLocus(
  session: PresenceSession,
  canvas: CanvasContents | null,
): { x: number; y: number } | null {
  if (session.activity?.kind === "working") {
    if ("itemId" in session.activity) {
      const item = canvas?.items[session.activity.itemId];
      if (item) return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
    } else if ("threadId" in session.activity) {
      // Working on a thread stands you at its pin — where the question is.
      const thread = canvas?.threads[session.activity.threadId];
      if (thread && canvas) return threadWorldPos(canvas, thread);
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

/**
 * Two cursors on exactly the same point read as one. The choreography lands
 * them there honestly — a summons parks every woken agent on the summoning
 * thread, and op piggyback puts a replying agent on the thread's pin — so
 * legibility is the renderer's job: when several sessions share a locus,
 * each is fanned onto a small ring, evenly spaced by its rank among the
 * crowd (sorted by session id, so every client draws the same fan). A
 * cursor alone on its point sits exactly on it; when the crowd changes the
 * ring re-spaces, and the easing renders that as a small glide.
 */
export function spreadOverlaps(
  targets: ReadonlyMap<string, { x: number; y: number }>,
  radius = 26,
): Map<string, { x: number; y: number }> {
  const cell = (p: { x: number; y: number }) =>
    `${Math.round(p.x / 12)}:${Math.round(p.y / 12)}`;
  const buckets = new Map<string, string[]>();
  for (const [sessionId, point] of targets) {
    const key = cell(point);
    buckets.set(key, [...(buckets.get(key) ?? []), sessionId]);
  }
  const spread = new Map<string, { x: number; y: number }>();
  for (const [sessionId, point] of targets) {
    const crowd = buckets.get(cell(point))!;
    if (crowd.length < 2) {
      spread.set(sessionId, point);
      continue;
    }
    const rank = [...crowd].sort().indexOf(sessionId);
    const angle = -Math.PI / 2 + (rank * 2 * Math.PI) / crowd.length;
    spread.set(sessionId, {
      x: point.x + Math.cos(angle) * radius,
      y: point.y + Math.sin(angle) * radius,
    });
  }
  return spread;
}


/**
 * Whose sessions are live right now, by actor id.
 *
 * "Is this person here" is asked in three places — the facepile, a comment
 * pin's avatars, and the thread that pin opens — and answering it three ways
 * is how a face ends up looking present on one surface and absent on another.
 */
export function liveActorIds(sessions: PresenceSession[]): Set<string> {
  return new Set(sessions.map((session) => session.actor.id));
}
