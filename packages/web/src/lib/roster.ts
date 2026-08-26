import type { CanvasContents, PresenceSession } from "@isocan/core";

/**
 * The agent view's rows: who is here to work, grouped the way faces are.
 *
 * **A row is an ACTOR, never a session** — `facepile.ts` earned that rule
 * with a recorded bug (one agent holding a terminal and a browser drew
 * twice), and this file inherits it. But it deliberately does not reuse
 * `facesFor`: that function is first-push-wins, which would let whichever
 * surface connected first own the row, and a roster row must be led by the
 * ACTING surface — the cli session — with any browser tab riding along as a
 * chip. Same law, different primary.
 *
 * **What makes a row an agent** is holding a cli session, live now. A
 * `kind:"web"` session is a person at a browser (protocol.ts: harness is
 * "null for a person"), and people already have the facepile — this panel is
 * the agent view. A cli session with no harness renders as "terminal", never
 * guessed into an agent: it could be a human at a shell.
 *
 * Live sessions only, for V1 honestly labeled: an agent whose session timed
 * out is not shown rather than shown wrong. Away rows — actors the canvas
 * remembers, reachable by a message that waits on the thread — are the
 * documented V2 (workbench design, roster membership).
 */
export interface AgentRow {
  actorId: string;
  /** What the row is called: the primary session's label, else the actor's
   * registered name. */
  name: string;
  /** The acting surface — the cli session with the freshest lastSeen. */
  primary: PresenceSession;
  /** Every other live surface this actor holds (browser tabs, mostly). */
  others: PresenceSession[];
  /** Which agent this is — `claude-code`, `codex`… — or null for a bare
   * terminal. The one question a person has about a row of agents. */
  harness: string | null;
  /** Somewhere on the canvas, mid-gesture: activity is asserted. */
  working: boolean;
}

export function agentRows(sessions: readonly PresenceSession[]): AgentRow[] {
  const byActor = new Map<string, PresenceSession[]>();
  for (const session of sessions) {
    const held = byActor.get(session.actor.id);
    if (held) held.push(session);
    else byActor.set(session.actor.id, [session]);
  }

  const rows: AgentRow[] = [];
  for (const [actorId, held] of byActor) {
    const clis = held
      .filter((s) => s.kind === "cli")
      .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
    const primary = clis[0];
    if (!primary) continue; // a person at a browser — the facepile's, not ours
    rows.push({
      actorId,
      name: primary.label ?? primary.actor.name,
      primary,
      others: held.filter((s) => s !== primary),
      harness: primary.harness ?? null,
      working: primary.activity != null,
    });
  }

  // Working rows first — the panel answers "what is happening" before "who
  // else is around" — then the most recently seen. A stable tiebreak on actor
  // id keeps two idle agents from swapping places between renders.
  return rows.sort((a, b) => {
    if (a.working !== b.working) return a.working ? -1 : 1;
    const seen = (b.primary.lastSeen ?? "").localeCompare(a.primary.lastSeen ?? "");
    return seen !== 0 ? seen : a.actorId.localeCompare(b.actorId);
  });
}

/** The last thing said in the thread an agent is answering — the expanded
 * row's "what summoned it". Null when it is not on a thread, or the thread
 * is gone. */
export function answeringExcerpt(
  canvas: CanvasContents,
  session: PresenceSession,
): { threadId: string; body: string } | null {
  const threadId = session.onThread;
  if (!threadId) return null;
  const thread = canvas.threads[threadId];
  const last = thread?.comments.at(-1);
  if (!last) return null;
  return { threadId, body: last.body };
}
