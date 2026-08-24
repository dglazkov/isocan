/**
 * The web side of @-mentions: who can be mentioned. Resolution itself lives
 * in `@isocan/core` — this module only feeds it a roster; drawing lives in
 * `chips.ts`, shared with #item-references.
 */
import { useMemo } from "react";
import type { CanvasContents, MentionCandidate, PresenceSession, ActorNames } from "@isocan/core";
import { actorsAnswerTo, collectCanvasActors } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { sessionName } from "./names.ts";

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
 * Everyone reachable from this canvas: actors in the state, plus the presence
 * roster (whose labels are mentionable names too). `selfId` is dropped from
 * the menu — you don't mention yourself — but kept as a candidate, so a body
 * that names you still resolves.
 */
export function mentionRoster(
  canvas: CanvasContents | null,
  sessions: PresenceSession[],
  selfId?: string,
  names?: ActorNames,
): MentionRoster {
  // Everyone the canvas remembers, under the names they answer to now as well
  // as the ones stamped on old ops (core/mentions.ts).
  const candidates: MentionCandidate[] = canvas
    ? actorsAnswerTo(collectCanvasActors(canvas), names)
    : [];
  const peers = new Map<string, MentionPeer>();
  for (const candidate of candidates) {
    if (!peers.has(candidate.id)) {
      peers.set(candidate.id, { id: candidate.id, name: candidate.name, online: false });
    }
  }
  for (const session of sessions) {
    // `sessionName`, not `session.label ?? session.actor.name`: the stamped
    // name on a session is what the actor was called when it started, and
    // "a stamped name is a log entry, not an identity" applies to the @-menu
    // more than anywhere else. Rename yourself to Di and the menu kept
    // offering Dion 2 — a name that reaches nobody, on the one surface whose
    // whole job is to name people correctly.
    const name = sessionName(names ?? {}, session);
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
    // The registry name is mentionable too, so a comment written from the
    // menu resolves — `actorsAnswerTo` only covers actors the CANVAS
    // remembers, and a live session on a canvas nobody has commented on yet
    // is not one of those.
    if (name !== session.actor.name) candidates.push({ id: session.actor.id, name });
    // A live session speaks for the actor: its label wins over a stale name.
    peers.set(session.actor.id, { id: session.actor.id, name, online: true });
  }
  // Here first, then everyone the canvas merely remembers.
  const ordered = [...peers.values()]
    .filter((peer) => peer.id !== selfId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return { candidates, peers: ordered };
}

/** `mentionRoster` over the live store. */
export function useMentionRoster(selfId?: string): MentionRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const names = useCanvasStore((state) => state.actorNames);
  return useMemo(
    () => mentionRoster(canvas, sessions, selfId, names),
    [canvas, sessions, selfId, names],
  );
}
