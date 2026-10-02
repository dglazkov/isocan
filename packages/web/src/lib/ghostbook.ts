import type { PresenceDrag, PresenceSession } from "@isocan/core";

/** The cursor's own lerp for a person (`CursorLayer`), so the item and the
 * cursor carrying it move together. */
const GHOST_LERP = 0.22;
/** How long a ghost keeps its last offset after the drag leaves the beat,
 * waiting for the op — the release race (research §4). */
export const GHOST_HOLD_MS = 1000;

/**
 * **Somebody else's drag, as this screen draws it.**
 *
 * - `live`: following the mover's beats.
 * - `hold`: the beat stopped carrying the drag; the last offset stays while
 *   the op is on its way, so the item does not snap home and jump forward.
 * - `home`: no op came (Esc, a refused write) or the mover went away — the
 *   offset glides back to nothing and the ghost is gone.
 */
export interface Ghost {
  sessionId: string;
  actorId: string;
  drag: PresenceDrag;
  /** The offset drawn this frame. */
  x: number;
  y: number;
  /** The offset it is easing toward. */
  tx: number;
  ty: number;
  phase: "live" | "hold" | "home";
  holdUntil: number;
}

/** Where an item stands on this screen's copy of the canvas, if it is on it. */
export type Where = (itemId: string) => { x: number; y: number } | undefined;

/** Is the drag's first root still where the drag began? The whole of rule (a):
 * once the real move lands — or anybody else's — it is not, and the ghost has
 * nothing left to say, whichever order the op and the beat arrived in. */
function stillAtFrom(where: Where, drag: PresenceDrag): boolean {
  const at = where(drag.roots[0]!);
  return !!at && Math.abs(at.x - drag.from.x) < 0.5 && Math.abs(at.y - drag.from.y) < 0.5;
}

/**
 * The viewer's store of drags in flight, one per session (a person has one
 * hand). Pure: the roster, this screen's positions and a clock go in; the
 * offsets to draw come out. Nothing here is an op, and nothing is kept beyond
 * the drags on screen now — so there is nothing to replay.
 */
export class GhostBook {
  readonly ghosts = new Map<string, Ghost>();

  /** A roster arrived, or this screen's canvas changed. */
  update(sessions: readonly PresenceSession[], where: Where, now: number): void {
    const here = new Set<string>();
    for (const session of sessions) {
      here.add(session.sessionId);
      const drag = session.drag;
      if (!drag) continue;
      const known = this.ghosts.get(session.sessionId);
      // (a) The item has left `from`: the move landed, or somebody else's did.
      if (!stillAtFrom(where, drag)) {
        this.ghosts.delete(session.sessionId);
        continue;
      }
      if (!known || known.drag.gesture !== drag.gesture) {
        // (d) A drag first seen — by a late joiner or anyone — starts where it
        // IS. Easing in from nothing would replay a path nobody sent.
        this.ghosts.set(session.sessionId, {
          sessionId: session.sessionId, actorId: session.actor.id, drag,
          x: drag.dx, y: drag.dy, tx: drag.dx, ty: drag.dy, phase: "live", holdUntil: 0,
        });
        continue;
      }
      Object.assign(known, { drag, tx: drag.dx, ty: drag.dy, phase: "live" });
    }
    for (const [sessionId, ghost] of this.ghosts) {
      if (ghost.phase === "live" && sessions.some((s) => s.sessionId === sessionId && s.drag)) continue;
      // The op landed while the ghost was holding (or gliding): it settles
      // where it is, and the item is where the ghost was drawing it.
      if (!stillAtFrom(where, ghost.drag)) { this.ghosts.delete(sessionId); continue; }
      // (c) The mover's face is gone — stale, or the tab closed mid-drag.
      if (!here.has(sessionId)) { this.home(ghost); continue; }
      // (b) The beat let go before the op arrived: hold the last offset.
      if (ghost.phase === "live") { ghost.phase = "hold"; ghost.holdUntil = now + GHOST_HOLD_MS; }
    }
  }

  private home(ghost: Ghost): void {
    ghost.phase = "home";
    ghost.tx = 0;
    ghost.ty = 0;
  }

  /**
   * One frame: a hold that has run out goes home, every offset eases toward
   * its target, and a ghost that has reached home is gone. `snap` is reduced
   * motion — the offset is where it is going, with no glide.
   */
  step(now: number, snap = false): void {
    for (const [sessionId, ghost] of this.ghosts) {
      if (ghost.phase === "hold" && now >= ghost.holdUntil) this.home(ghost);
      const rate = snap ? 1 : GHOST_LERP;
      ghost.x += (ghost.tx - ghost.x) * rate;
      ghost.y += (ghost.ty - ghost.y) * rate;
      if (Math.abs(ghost.tx - ghost.x) < 0.5 && Math.abs(ghost.ty - ghost.y) < 0.5) {
        ghost.x = ghost.tx;
        ghost.y = ghost.ty;
        if (ghost.phase === "home") this.ghosts.delete(sessionId);
      }
    }
  }
}
