/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

const FRAME_MS = 1000 / 60;

const LERP_HUMAN = 0.22; // real cursors track tightly (60Hz equivalent)
const LERP_AGENT = 0.1; // CLI hops glide deliberately (60Hz equivalent)
const WANDER_LERP = 0.045; // calm, deliberate drift while "working" (60Hz equivalent)

/** World-unit jump threshold beyond which a cursor teleports instead of gliding across the map. */
export const SNAP_DISTANCE = 1600;
/** Maximum world units/sec while wandering inside an item's working bounds. */
export const MAX_WANDER_SPEED = 360;
/** Maximum world units/sec for agent cursors commuting between targets. */
export const MAX_AGENT_SPEED = 1100;

interface WorkingBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-session eased animation state held by `CursorLayer` across frames. */
export interface CursorAnim {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Next waypoint decision, ms timestamp (wander only); 0 while commuting. */
  nextAt: number;
  /** Dwell duration (ms) to pause AFTER arriving at `(tx, ty)`. */
  dwellMs: number;
  /** Target identity for the active working bounds so switching items cancels stale dwells. */
  workingKey: string | null;
  /** The last real position a living ground was given while working. */
  fx?: number;
  fy?: number;
}

/** Frame-rate-independent damping factor matching `rate60` per 60Hz frame. */
export function dampFactor(rate60: number, dtMs: number): number {
  const dt = Math.min(100, Math.max(0, dtMs));
  if (dt <= 0) return 0;
  return 1 - Math.pow(1 - rate60, dt / FRAME_MS);
}

/** Stable key for a working activity so switching targets cancels stale wander dwells. */
export function sessionWorkingKey(activity: PresenceSession["activity"]): string | null {
  if (activity?.kind !== "working") return null;
  if ("itemId" in activity) return `item:${activity.itemId}`;
  if ("threadId" in activity) return `thread:${activity.threadId}`;
  return `at:${activity.x}:${activity.y}`;
}

function distanceToBounds(point: { x: number; y: number }, bounds: WorkingBounds): number {
  const nearX = Math.max(bounds.x, Math.min(bounds.x + bounds.width, point.x));
  const nearY = Math.max(bounds.y, Math.min(bounds.y + bounds.height, point.y));
  return Math.hypot(nearX - point.x, nearY - point.y);
}

function outsideBounds(x: number, y: number, bounds: WorkingBounds): boolean {
  return x < bounds.x || x > bounds.x + bounds.width || y < bounds.y || y > bounds.y + bounds.height;
}

/**
 * Pick the next cursor target strictly inside `bounds`, scanning along lines
 * and between interior sections rather than hugging the outer border.
 */
export function nextWorkingWaypoint(
  bounds: WorkingBounds,
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

  if (roll < 0.22) {
    // Calm thinking pause right where the cursor sits.
    return { tx: cx, ty: cy, dwellMs: 750 + rng() * 1100 };
  }

  if (roll < 0.8) {
    // Local scan along the current line/region (mostly horizontal, small vertical drift).
    const nearRightEdge = cx > minX + spanX * 0.72;
    const dirX = nearRightEdge ? (rng() < 0.75 ? -1 : 1) : rng() < 0.72 ? 1 : -1;
    const stepX = dirX * Math.min(280, (0.1 + rng() * 0.22) * spanX);
    const stepY = (rng() - 0.5) * Math.min(140, 0.16 * spanY);
    return {
      tx: clampX(cx + stepX),
      ty: clampY(cy + stepY),
      dwellMs: 550 + rng() * 750,
    };
  }

  // Deliberate reposition to another interior section of the item.
  return {
    tx: clampX(minX + (0.1 + rng() * 0.8) * spanX),
    ty: clampY(minY + (0.1 + rng() * 0.8) * spanY),
    dwellMs: 700 + rng() * 950,
  };
}

/**
 * Advance a single cursor's visual position by one animation frame (`dtMs`).
 *
 * Frame-rate independent, velocity-capped for agents/wandering, and anchored
 * strictly to `workingBounds` when working so a stale `session.cursor` far from
 * the active item can never trigger a `SNAP_DISTANCE` teleport loop.
 */
export function stepCursorAnim(
  existing: CursorAnim | undefined,
  opts: {
    home: { x: number; y: number };
    workingBounds?: WorkingBounds | undefined;
    workingKey?: string | null | undefined;
    kind: PresenceSession["kind"];
    nowMs: number;
    dtMs: number;
    rng?: (() => number) | undefined;
  },
): { rec: CursorAnim; moved: boolean } {
  const { home, workingBounds, workingKey = null, kind, nowMs, dtMs, rng = Math.random } = opts;
  const dt = Math.min(100, Math.max(0, dtMs));
  let rec = existing;
  let snapped = false;

  if (!rec) {
    rec = {
      x: home.x,
      y: home.y,
      tx: home.x,
      ty: home.y,
      nextAt: 0,
      dwellMs: 0,
      workingKey: null,
    };
    snapped = true;
  } else {
    // Measure distance against the active working rectangle itself (so wide items
    // never self-snap) or against the stationary target when idle.
    const gap = workingBounds
      ? distanceToBounds(rec, workingBounds)
      : Math.hypot(home.x - rec.x, home.y - rec.y);
    if (gap > SNAP_DISTANCE) {
      rec.x = home.x;
      rec.y = home.y;
      rec.tx = home.x;
      rec.ty = home.y;
      rec.nextAt = 0;
      rec.dwellMs = 0;
      rec.workingKey = null;
      snapped = true;
    }
  }

  if (workingBounds) {
    const targetKey = workingKey ?? "__working__";
    const targetChanged = rec.workingKey !== targetKey || outsideBounds(rec.tx, rec.ty, workingBounds);
    if (targetChanged) {
      rec.workingKey = targetKey;
      const next = nextWorkingWaypoint(workingBounds, rec, rng);
      rec.tx = next.tx;
      rec.ty = next.ty;
      rec.dwellMs = next.dwellMs;
      rec.nextAt = Math.hypot(rec.tx - rec.x, rec.ty - rec.y) <= 0.5 ? nowMs + next.dwellMs : 0;
    } else if (Math.hypot(rec.tx - rec.x, rec.ty - rec.y) <= 0.5) {
      if (rec.nextAt === 0) {
        rec.nextAt = nowMs + rec.dwellMs;
      }
      if (nowMs >= rec.nextAt) {
        const next = nextWorkingWaypoint(workingBounds, rec, rng);
        rec.tx = next.tx;
        rec.ty = next.ty;
        rec.dwellMs = next.dwellMs;
        rec.nextAt = Math.hypot(rec.tx - rec.x, rec.ty - rec.y) <= 0.5 ? nowMs + next.dwellMs : 0;
      }
    }
  } else {
    rec.workingKey = null;
    rec.tx = home.x;
    rec.ty = home.y;
    rec.nextAt = 0;
    rec.dwellMs = 0;
  }

  const dx = rec.tx - rec.x;
  const dy = rec.ty - rec.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 0.5 && dt > 0) {
    const commuting = workingBounds ? distanceToBounds(rec, workingBounds) > 0 : false;
    const rate60 = workingBounds
      ? commuting
        ? LERP_AGENT
        : WANDER_LERP
      : kind === "web"
        ? LERP_HUMAN
        : LERP_AGENT;
    const alpha = dampFactor(rate60, dt);
    let stepX = dx * alpha;
    let stepY = dy * alpha;
    const maxSpeed = workingBounds && !commuting
      ? MAX_WANDER_SPEED
      : kind !== "web"
        ? MAX_AGENT_SPEED
        : Infinity;
    if (Number.isFinite(maxSpeed)) {
      const stepLen = Math.hypot(stepX, stepY);
      const maxStep = maxSpeed * (dt / 1000);
      if (stepLen > maxStep && maxStep > 0) {
        const scale = maxStep / stepLen;
        stepX *= scale;
        stepY *= scale;
      }
    }
    rec.x += stepX;
    rec.y += stepY;
    if (Math.hypot(rec.tx - rec.x, rec.ty - rec.y) <= 0.5) {
      rec.x = rec.tx;
      rec.y = rec.ty;
      if (workingBounds) rec.nextAt = nowMs + rec.dwellMs;
    }
    return { rec, moved: true };
  }

  return { rec, moved: snapped };
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
