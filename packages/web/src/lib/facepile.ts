import type { Actor, ActorJoins, Capability, CommentThread, PresenceSession } from "@isocan/core";
import { resolveActor, sameActor } from "@isocan/core";
import { quietFor, statusLine } from "./presence.ts";

/**
 * Who to draw in the facepile, in order, one entry per PERSON.
 *
 * It lives here rather than inline in `Presence.tsx` because the rule it
 * enforces is the kind a component cannot be tested for: the pile is keyed by
 * actor id, so "one entry per person" is not a preference, it is what makes
 * the list renderable at all. A second entry for one actor is two faces AND a
 * React duplicate-key warning, and React's response to duplicate keys is
 * explicitly unspecified — children may be duplicated or omitted.
 *
 * The bug this was extracted for: `sessions` arrives with your own tab already
 * filtered out BY SESSION ID (canvasStore), which made appending your own face
 * unconditionally look safe. A session id is not an actor. One person with two
 * surfaces — an agent holding a terminal and a browser tab, or anybody with the
 * canvas open in two tabs — is one actor with two sessions, so the other
 * surface survived the filter and the pile drew that person twice.
 */

export interface Face {
  actor: Actor;
  /** Their live session, when they have one — the handle follow mode needs. */
  sessionId: string | null;
  /** Presence label if they have a session, else their plain name. */
  label: string;
  /**
   * **Three states, because two could not tell the difference that matters.**
   *
   * `here` is somebody at the canvas: a face, a cursor, work happening.
   * `away` is somebody who left a comment and went. `available` is the third
   * thing three separate notes independently reached for — an agent that
   * could be woken, present as a possibility and absent as a person.
   *
   * `docs/research/2026-08-30-standing-agents.md` asks it as an open
   * question — *"what does an agent registered for a canvas it has never
   * opened look like in the roster? Present, absent, or a third thing"* —
   * and answers it in the same breath: **`available` must look different
   * from `here`.** A facepile showing six faces on a canvas nobody is
   * working on has stopped meaning anything, which is the whole value of
   * presence being honest. A boolean had nowhere to put that.
   */
  presence: "here" | "available" | "enrolled" | "away";
  /** Whether this face is actively working right now (`session.activity != null`).
   *  The ring thickness ladder's top rung (`enrolled` hairline -> `available` 1px ->
   *  `here` 2px -> `working` 3px, and only `working` animates). */
  working: boolean;
  /** The rung their connection holds, when the server said one — `read`
   * for somebody looking over your shoulder (roles design, "Presence says
   * the rung"). Null for an editor, and for anyone without a session. */
  capability: Capability | null;
  kind: PresenceSession["kind"] | null;
  /** Which agent this is — `claude-code`, `codex` — or null for a person. */
  harness: string | null;
  /** What they are up to, for the tooltip. */
  status: string | null;
  cursor: { x: number; y: number } | null;
  unread: number;
  self: boolean;
  /**
   * **Whose agent this is — and, by being null, that it is a person.**
   *
   * One field answers both questions the pile could not answer before ("is
   * that a human?", "whose is it?"), which is why it is one field rather than
   * an `agent` boolean beside an `owner`. An agent IS a thing somebody owns;
   * a person is not owned by anybody. Two fields could disagree, and the day
   * they did, the face would say one thing and the card another.
   *
   * It is the live policy's owner where an rc is answering, falling back to
   * the enrolment's `writtenBy`, and null when neither is known. Null is
   * always safe: the face then draws exactly as it did before there was an
   * owner to draw, which is the right failure for an unknown rather than a
   * guess at one.
   */
  owner: { id: string; name: string } | null;
}

/** Whose agent an actor is, or null for a person — what `facesFor` asks so
 * the pile can colour a ring and the card can name a name. Deliberately not
 * exported: callers pass a plain function and TypeScript matches it
 * structurally, so exporting it would be a promise to nobody. */
type OwnerOf = (actorId: string) => { id: string; name: string } | null;

/** A quiet agent is still here — say so, and say for how long — but never
 * invent an activity it didn't claim. */
export function describe(session: PresenceSession): string | null {
  const quiet = quietFor(session);
  const parts = [statusLine(session), quiet && `quiet ${quiet}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Who owes you a read, and how many comments each of them left.
 *
 * Keyed by the RESOLVED author id (multi-identity phase 5): comments written
 * under an id that was later folded into another group under the id that
 * answers now, and none of them count when that id is yours.
 */
export function unreadByAuthor(
  pending: CommentThread[],
  seen: Record<string, string>,
  selfId: string,
  joined?: ActorJoins,
): Map<string, { actor: Actor; count: number }> {
  const unreadBy = new Map<string, { actor: Actor; count: number }>();
  for (const thread of pending) {
    for (const comment of thread.comments) {
      if (sameActor(joined, comment.author.id, selfId)) continue;
      const since = seen[thread.id];
      if (since && comment.createdAt <= since) continue;
      const authorId = resolveActor(joined, comment.author.id);
      const entry = unreadBy.get(authorId);
      if (entry) entry.count += 1;
      else unreadBy.set(authorId, { actor: { ...comment.author, id: authorId }, count: 1 });
    }
  }
  return unreadBy;
}

/**
 * People on the canvas first, then whoever only left a comment behind, then
 * you — and **never the same actor twice**, whichever of those three ways they
 * arrive.
 *
 * You are already in the pile when another of your surfaces is live, so being
 * you is a FLAG SET ON THAT FACE rather than a second entry. Marking beats
 * replacing: the session's cursor and status are real and worth keeping, and
 * `self` is what makes the face the handle for who you are — it opens the
 * identity menu, and it refuses to follow itself — rather than somewhere to
 * fly to.
 */
export function facesFor(
  sessions: PresenceSession[],
  unreadBy: Map<string, { actor: Actor; count: number }>,
  self: Actor,
  /**
   * The agents that could be woken right now (standing agents, phase 3):
   * enrolled on this canvas AND an rc holding a connection for them — the
   * `answerable` set the roster derives, never a record alone. These are the
   * faces the third state was asked for: an agent registered for a canvas
   * it has never opened is neither present nor absent.
   */
  answerable: Actor[] = [],
  /**
   * Whose agent each actor is. Asked HERE, once per face, rather than at the
   * four places a face is pushed: every one of them would have had to ask the
   * same question, and the fifth — whenever somebody adds a fifth state — would
   * have forgotten to. A face with no owner is a person, and that is the only
   * way a face becomes a person, so there is no path that leaves it unset.
   */
  ownerOf: OwnerOf = () => null,
  /**
   * Enrolled on this canvas with no rc currently holding for them — the
   * lightness and ring-thickness ladders' lowest standing rung (`enrolled`:
   * 0.6 opacity, hairline dashed ring).
   */
  enrolled: Actor[] = [],
): Face[] {
  const faces: Face[] = [];
  const seen = new Set<string>();
  const push = (face: Omit<Face, "owner">) => {
    if (seen.has(face.actor.id)) return;
    seen.add(face.actor.id);
    faces.push({ ...face, owner: ownerOf(face.actor.id) });
  };

  for (const session of sessions) {
    // A parked rc is not a participant, and first-push-wins means letting it
    // through HERE would eat its person's real face. It gets its own pass
    // below, after everybody actually present has claimed theirs.
    if (session.kind === "rc") continue;
    push({
      actor: session.actor,
      sessionId: session.sessionId,
      label: session.label ?? session.actor.name,
      presence: "here",
      working: session.activity != null,
      capability: session.capability ?? null,
      kind: session.kind,
      harness: session.harness,
      status: describe(session),
      cursor: session.cursor,
      unread: unreadBy.get(session.actor.id)?.count ?? 0,
      self: false,
    });
  }
  /**
   * Then whoever is only STANDING BY — an agent an rc answers for, with no
   * session of its own. Ordered here on purpose: being reachable is a
   * stronger fact than having left a comment and gone, and weaker than being
   * at the canvas, so first-push-wins puts each actor in the truest state
   * they qualify for.
   *
   * This used to be the rc's own announcement session wearing the person's
   * face — a stand-in from before `answerable` was connection-bound (phase
   * 6). The person running an rc is not standing by; their agents are.
   * The announcement still exists for the add-agent dialog's footer, and is
   * skipped above so it never eats its person's real face.
   */
  for (const actor of answerable) {
    push({
      actor,
      // No session handle: there is nothing to follow, because nobody is
      // moving. Follow mode would have nowhere to fly to.
      sessionId: null,
      label: actor.name,
      presence: "available",
      working: false,
      capability: null,
      kind: null,
      harness: null,
      // Said in words as well as drawn: this is the tooltip and the aria
      // label, so a state told by colour alone is also told to a reader.
      status: "standing by — enrolled here, an rc is listening; a comment wakes it",
      cursor: null,
      unread: unreadBy.get(actor.id)?.count ?? 0,
      self: false,
    });
  }

  /**
   * Then whoever is ENROLLED here with no rc listening right now — still in the
   * room as a standing record, distinct from somebody who left a comment and
   * wandered off (`away`), and wearing the lightness (0.6) and hairline ring
   * (`docs/research/2026-09-15-reading-the-facepile.md`).
   */
  for (const actor of enrolled) {
    push({
      actor,
      sessionId: null,
      label: actor.name,
      presence: "enrolled",
      working: false,
      capability: null,
      kind: null,
      harness: null,
      status: "enrolled here — no rc is listening right now",
      cursor: null,
      unread: unreadBy.get(actor.id)?.count ?? 0,
      self: false,
    });
  }

  for (const [, { actor: author, count }] of unreadBy) {
    push({
      actor: author,
      sessionId: null,
      label: author.name,
      presence: "away",
      working: false,
      capability: null,
      kind: null,
      harness: null,
      status: "not here — left a comment",
      cursor: null,
      unread: count,
      self: false,
    });
  }

  const mine = faces.find((face) => face.actor.id === self.id);
  if (mine) {
    mine.self = true;
    mine.label = self.name;
  } else {
    push({
      actor: self,
      sessionId: null,
      label: self.name,
      presence: "here",
      working: false,
      capability: null,
      kind: "web",
      harness: null,
      status: null,
      cursor: null,
      unread: 0,
      self: true,
    });
  }
  return faces;
}
