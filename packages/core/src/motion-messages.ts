/**
 * **What a motion's player and the canvas say to each other** (motion phase
 * 2; `docs/projects/motion/design.md` §2). A motion plays in the sandboxed
 * content origin, so a message is the only door between them. In the barrel,
 * unlike the rest of motion, because the shell's frame speaks it: a few
 * strings and one reader, not the engine.
 *
 * - `seek` (canvas → player): show this moment, paused — opening a comment
 *   pinned to the motion at a time.
 * - `ready` (player → canvas): it can be asked now, so a seek asked before
 *   the document loaded is asked again.
 * - `time` (player → canvas): where it paused or was scrubbed to, or that it
 *   is playing — so a comment left then remembers the moment.
 */
export const MOTION_MESSAGES = { seek: "isocan:motion-seek", time: "isocan:motion-time", ready: "isocan:motion-ready" } as const;

/** A message from a player, read; anything else is null. The page is untrusted, so only a finite time is believed. */
export function motionMessage(data: unknown): { kind: "ready" } | { kind: "time"; at: number | null } | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type === MOTION_MESSAGES.ready) return { kind: "ready" };
  if (m.type !== MOTION_MESSAGES.time) return null;
  if (m.playing === true) return { kind: "time", at: null };
  return typeof m.at === "number" && Number.isFinite(m.at) && m.at >= 0 && m.at <= 86_400 ? { kind: "time", at: Math.round(m.at * 1000) / 1000 } : null;
}

/** The seek a canvas posts into a player's frame. */
export function motionSeek(at: number): { type: typeof MOTION_MESSAGES.seek; at: number } {
  return { type: MOTION_MESSAGES.seek, at };
}
