/**
 * The web side of @-mentions: who can be mentioned. Resolution itself lives
 * in `@isocan/core` — this module only feeds it a roster; drawing lives in
 * `chips.ts`, shared with #item-references.
 */
import { useMemo } from "react";
import type { CanvasState, MentionCandidate, PresenceSession } from "@isocan/core";
import { collectCanvasActors } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** One mentionable person, as offered by the "@" menu. */
export interface MentionPeer {
  id: string;
  name: string;
  /** Has a live session right now — they'll see the comment immediately. */
  online: boolean;
}

export interface MentionRoster {
  /** One entry per name an actor answers to; feeds core's resolution. */
  candidates: MentionCandidate[];
  /** One entry per actor, live label preferred; feeds the "@" menu. */
  peers: MentionPeer[];
}

/**
 * Everyone visible on this canvas: actors in the state plus the live presence
 * roster (whose labels are mentionable names too). `selfId` is dropped from
 * the menu — you don't mention yourself — but kept as a candidate, so a body
 * that names you still resolves.
 */
export function mentionRoster(
  canvas: CanvasState | null,
  sessions: PresenceSession[],
  selfId?: string,
): MentionRoster {
  const candidates: MentionCandidate[] = canvas ? collectCanvasActors(canvas) : [];
  const peers = new Map<string, MentionPeer>();
  for (const candidate of candidates) {
    if (!peers.has(candidate.id)) {
      peers.set(candidate.id, { id: candidate.id, name: candidate.name, online: false });
    }
  }
  for (const session of sessions) {
    const name = session.label ?? session.actor.name;
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
    // A live session speaks for the actor: its label wins over a stale name.
    peers.set(session.actor.id, { id: session.actor.id, name, online: true });
  }
  const ordered = [...peers.values()]
    .filter((peer) => peer.id !== selfId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return { candidates, peers: ordered };
}

/** `mentionRoster` over the live store. */
export function useMentionRoster(selfId?: string): MentionRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  return useMemo(() => mentionRoster(canvas, sessions, selfId), [canvas, sessions, selfId]);
}
