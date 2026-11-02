import type { ActorJoins, ActorNames, CanvasContents, PresenceSession } from "@isocan/core";
import { QUIET_AFTER_MS, sameActor, threadTargetItem } from "@isocan/core";

export { QUIET_AFTER_MS };
import { actorNameIn, sessionName } from "./names.ts";
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

/**
 * The world-space rectangle a working session is actively working inside.
 *
 * When a session works on a thread (`{ kind: "working", threadId }`), we
 * check `threadTargetItem` first: if the thread is anchored to an item or its
 * latest comment references a live item (like selecting a box and messaging in
 * Chat), the agent works inside that item's bounds rather than around a distant
 * thread pin.
 */
export function sessionWorkingBounds(
  session: PresenceSession,
  canvas: CanvasContents | null,
): { x: number; y: number; width: number; height: number } | undefined {
  if (session.activity?.kind !== "working") return undefined;
  if ("itemId" in session.activity) {
    const item = canvas?.items[session.activity.itemId];
    return item ? { x: item.x, y: item.y, width: item.width, height: item.height } : undefined;
  }
  if ("threadId" in session.activity) {
    const thread = canvas?.threads[session.activity.threadId];
    if (canvas && thread) {
      const target = threadTargetItem(canvas, thread);
      if (target) {
        return { x: target.x, y: target.y, width: target.width, height: target.height };
      }
      const at = threadWorldPos(canvas, thread);
      return { x: at.x - 90, y: at.y - 60, width: 180, height: 120 };
    }
    return undefined;
  }
  return {
    x: session.activity.x - 110,
    y: session.activity.y - 75,
    width: 220,
    height: 150,
  };
}

/**
 * Pick the next cursor target strictly inside `bounds`, scanning along lines
 * and between interior sections rather than hugging the outer border.
 */
export function nextWorkingWaypoint(
  bounds: { x: number; y: number; width: number; height: number },
  current: { x: number; y: number },
  rng: () => number = Math.random,
): { tx: number; ty: number; dwellMs: number } {
  const padX = Math.min(Math.max(12, bounds.width * 0.08), bounds.width * 0.35);
  const padTop = Math.min(Math.max(10, bounds.height * 0.14), bounds.height * 0.35);
  // Extra bottom clearance so the cursor glyph + thought chip stay over the item.
  const padBottom = Math.min(Math.max(18, bounds.height * 0.28), bounds.height * 0.45);
  const minX = bounds.x + padX;
  const maxX = Math.max(minX, bounds.x + bounds.width - padX);
  const minY = bounds.y + padTop;
  const maxY = Math.max(minY, bounds.y + bounds.height - padBottom);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const clampX = (x: number) => Math.max(minX, Math.min(maxX, x));
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));

  const cx = clampX(current.x);
  const cy = clampY(current.y);
  const roll = rng();

  if (roll < 0.18) {
    // Brief thinking pause right where the cursor sits.
    return { tx: cx, ty: cy, dwellMs: 450 + rng() * 650 };
  }

  if (roll < 0.72) {
    // Local scan along the current line/region (mostly horizontal, small vertical drift).
    const nearRightEdge = cx > minX + spanX * 0.72;
    const dirX = nearRightEdge ? (rng() < 0.75 ? -1 : 1) : rng() < 0.72 ? 1 : -1;
    const stepX = dirX * (0.12 + rng() * 0.28) * spanX;
    const stepY = (rng() - 0.5) * 0.18 * spanY;
    return {
      tx: clampX(cx + stepX),
      ty: clampY(cy + stepY),
      dwellMs: 320 + rng() * 480,
    };
  }

  // Reposition to another interior section of the item.
  return {
    tx: clampX(minX + (0.08 + rng() * 0.84) * spanX),
    ty: clampY(minY + (0.08 + rng() * 0.84) * spanY),
    dwellMs: 420 + rng() * 620,
  };
}

/** Where a session stands in the world: the center of the item it declared it
 * is working on, its freestanding work point, or failing those its cursor.
 * Null for a session that has not stood anywhere yet. The minimap dot and
 * follow mode both aim here, so they always agree. */
export function sessionLocus(
  session: PresenceSession,
  canvas: CanvasContents | null,
): { x: number; y: number } | null {
  const bounds = sessionWorkingBounds(session, canvas);
  if (bounds) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
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
 * them them honestly — a summons parks every woken agent on the summoning
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

/**
 * Which remote sessions in `CursorLayer` share an identity or display name with
 * this viewport's own actor (or with a more recently active session of the same
 * name) and should therefore identify themselves as being in another tab rather
 * than looking like a stuck copy of the local pointer.
 */
export function otherTabSessionIds(
  sessions: PresenceSession[],
  selfActor: { id: string; name: string } | null = null,
  names: ActorNames = {},
  joined: ActorJoins = {},
): Set<string> {
  const out = new Set<string>();
  const selfName = selfActor ? actorNameIn(names, selfActor) : null;
  const byName = new Map<string, PresenceSession[]>();
  for (const s of sessions) {
    const name = sessionName(names, s);
    if (selfActor && (sameActor(joined, s.actor.id, selfActor.id) || name === selfName)) {
      out.add(s.sessionId);
      continue;
    }
    byName.set(name, [...(byName.get(name) ?? []), s]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => (Date.parse(b.lastSeen) || 0) - (Date.parse(a.lastSeen) || 0));
    for (const s of sorted.slice(1)) out.add(s.sessionId);
  }
  return out;
}
