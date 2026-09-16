/**
 * The web side of @-mentions: who can be mentioned. Resolution itself lives
 * in `@isocan/core` — this module only feeds it a roster; drawing lives in
 * `chips.ts`, shared with #item-references.
 */
import { useMemo } from "react";
import type {
  ActorJoins,
  ActorNames,
  CanvasContents,
  MentionCandidate,
  PresenceSession,
} from "@isocan/core";
import { actorsAnswerTo, collectCanvasActors, mayWake } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useRcPolicies } from "./answerable.ts";
import { sessionName } from "./names.ts";

/** One mentionable person, as offered by the "@" menu. */
export interface MentionPeer {
  id: string;
  name: string;
  /** Has a live session right now — they'll see the comment immediately. */
  online: boolean;
  /**
   * What the menu says beside the name when picking it would not mean what it
   * looks like. The bench says *not here yet*; an agent whose gate is shut to
   * this reader says *won't answer you*.
   */
  note?: string;
  /**
   * **A summons from this reader would be turned away.** An agent somebody
   * else owns, whose owner has not widened its gate.
   *
   * It MARKS rather than hides, which was asked the other way round (Dion,
   * 16 Sep 2026: *"if you type '@' it shouldn't show you names that you can't
   * control… filter it"*) and is argued in
   * `docs/research/2026-09-15-reading-the-facepile.md`. The short of it: a
   * name that is absent reads as *does not exist*, so hiding it makes "no such
   * agent" and "not yours" the same thing — and the refusal a person gets
   * AFTER sending is the most useful sentence in the product. Saying it
   * BEFORE the click is strictly better than saying it after; saying nothing
   * is worse than both.
   *
   * It is also the rule this very menu already keeps one row over: the bench
   * puts agents in it MARKED *not here yet* rather than leaving them out, for
   * exactly this reason.
   */
  shut?: boolean;
}

/** Whether this reader could actually summon an actor, and whose it is —
 * null for anything that is not a gated agent. */
type GateOf = (actorId: string) => { canSummon: boolean; owner: string } | null;

interface MentionRoster {
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
  joined?: ActorJoins,
  gateOf: GateOf = () => null,
): MentionRoster {
  // Everyone the canvas remembers, under the names they answer to now as well
  // as the ones stamped on old ops (core/mentions.ts). An actor folded into
  // somebody (`actor.join`) is that person, so the menu lists one of them.
  const candidates: MentionCandidate[] = canvas
    ? actorsAnswerTo(collectCanvasActors(canvas), names, joined)
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
  /**
   * **Marked, and ranked below the names that will answer.** The reader keeps
   * the information that the name exists and is on this canvas, and loses the
   * false promise that mentioning it will do anything.
   *
   * The words are the refusal's own, shortened: the rc already answers a
   * turned-away summons in the thread, and a menu that says something
   * different before the click would be a second account of one rule.
   */
  for (const peer of peers.values()) {
    const gate = gateOf(peer.id);
    if (!gate || gate.canSummon) continue;
    peer.shut = true;
    peer.note = `won't answer you — ${gate.owner}'s`;
  }
  // Names that will answer first, here before merely remembered; the ones a
  // summons would bounce off, last.
  const ordered = [...peers.values()]
    .filter((peer) => peer.id !== selfId)
    .sort(
      (a, b) =>
        Number(a.shut ?? false) - Number(b.shut ?? false) ||
        Number(b.online) - Number(a.online) ||
        a.name.localeCompare(b.name),
    );
  return { candidates, peers: ordered };
}

/** `mentionRoster` over the live store. */
export function useMentionRoster(selfId?: string): MentionRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const names = useCanvasStore((state) => state.actorNames);
  const joined = useCanvasStore((state) => state.actorJoins);
  const canvasId = useCanvasStore((s) => s.canvasId);
  /**
   * The gate as the ANSWERING rc announces it — the same source the tray and
   * the facepile read, and the thing dispatch actually applies. An agent
   * nothing is answering for has no announced policy, so `gateOf` returns null
   * and the menu promises nothing either way: "nobody is listening" is a
   * different fact from "it will not listen to you", and the menu must not
   * merge them.
   */
  const policies = useRcPolicies(canvasId);
  const gateOf = useMemo(
    () => (actorId: string) => {
      const policy = policies[actorId];
      if (!policy || selfId === undefined) return null;
      return { canSummon: mayWake(policy, selfId, joined), owner: policy.owner.name };
    },
    [policies, selfId, joined],
  );
  return useMemo(
    () => mentionRoster(canvas, sessions, selfId, names, joined, gateOf),
    [canvas, sessions, selfId, names, joined, gateOf],
  );
}
