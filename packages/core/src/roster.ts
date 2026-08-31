import type { CanvasContents, CommentThread } from "./model.ts";
import type { PresenceSession } from "./protocol.ts";
import { collectCanvasActors } from "./mentions.ts";
import { recentActivity, type ActivityEntry } from "./activity.ts";

/**
 * The agent roster: who is here to work, what each is doing, and who the
 * canvas remembers — the workbench's rows and `isocan who`'s state column,
 * from ONE derivation.
 *
 * It moved to core from the web app the day the state column landed, for
 * `onit.ts`'s standing reason: both surfaces answer the same question, and
 * two derivations of "is Kenny parked?" would disagree within the week.
 *
 * **A row is an ACTOR, never a session** — `facepile.ts` earned that rule
 * with a recorded bug (one agent holding a terminal and a browser drew
 * twice). But unlike `facesFor`'s first-push-wins, a roster row is led by
 * the ACTING surface: the cli session with the freshest lastSeen, browser
 * tabs riding along as chips.
 *
 * **What makes a row an agent** is holding a cli session, live now — or,
 * for AWAY rows, having actually done something the canvas remembers. A
 * `kind:"web"` session is a person at a browser (protocol.ts: harness is
 * "null for a person"), and people have the facepile. A cli session with no
 * harness renders as "terminal", never guessed into an agent.
 */

/** How long since the last daemon touch before a live agent reads as
 * thinking rather than fresh. Above `wait`'s ≤30s heartbeat, so a parked
 * agent never flickers quiet. One home — it lived in the web app until the
 * state derivation moved here, and the web's presence helpers import it
 * back. */
export const QUIET_AFTER_MS = 35_000;

/**
 * What a row is doing, in precedence order — each state only claims what
 * the system can actually know:
 *
 * - `blocked`: this actor asked a question (`/ask`) nobody has answered.
 *   Derived from thread position, never asserted, so it clears on the
 *   ANSWER rather than on somebody's eye passing over it.
 * - `working`: presence asserts a locus (`activity != null`).
 * - `parked`: the standing status arrived with `statusSource:"lifecycle"` —
 *   `wait`'s own signature, readable honestly now that the source crosses
 *   the wire. A nudge lands immediately.
 * - `quiet`: live, no locus, last touch older than `QUIET_AFTER_MS` —
 *   thinking, not frozen.
 * - `here`: live, and none of the above.
 * - `away`: no session; the canvas remembers the actor. A message waits on
 *   the thread for the next wake.
 */
/** The standing-agent states (phases 2.5 and 6). `answerable`: enrolled AND
 * a live rc holds a connection claiming it — "will answer if you comment",
 * derived from `roster()`'s `answerable` set and never from a record or a
 * TTL (journey 7's no-lie rule; the set comes from the daemon's
 * connection-bound rc holds, and a caller that cannot see the holds passes
 * nothing and gets `enrolled`, the safe under-claim). `enrolled`: the
 * record alone — standing granted, nobody listening right now. */
export type RowState =
  | "blocked"
  | "working"
  | "parked"
  | "quiet"
  | "here"
  | "answerable"
  | "enrolled"
  | "away";

/** An open question: the last `/ask` in a thread with no reply from anyone
 * but the asker after it. The-ask research's derivation, verbatim: state the
 * surfaces can compute is state no `comment.update` can lie about. */
export interface OpenAsk {
  threadId: string;
  commentId: string;
  askerId: string;
  /** The question, `/ask ` stripped. */
  body: string;
}

export function openAsk(thread: CommentThread): OpenAsk | null {
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i]!;
    const match = comment.body.match(/^\/ask\b\s*([\s\S]*)$/);
    if (match) {
      // Open iff nothing after it is somebody else speaking — the asker
      // amending their own question keeps it open.
      const answered = thread.comments
        .slice(i + 1)
        .some((later) => later.author.id !== comment.author.id);
      return answered
        ? null
        : {
            threadId: thread.id,
            commentId: comment.id,
            askerId: comment.author.id,
            body: match[1]!.trim(),
          };
    }
  }
  return null;
}

/** Every open question on the canvas, newest first. */
export function openAsks(canvas: CanvasContents): OpenAsk[] {
  const open: OpenAsk[] = [];
  for (const thread of Object.values(canvas.threads)) {
    const ask = openAsk(thread);
    if (ask) open.push(ask);
  }
  return open.reverse();
}

/**
 * One live session's state, canvas context optional — `isocan who` calls
 * this per session, the roster calls it per row's primary. Without a canvas
 * the `blocked` tier simply cannot fire, which is honest: no threads, no
 * asks.
 */
export function sessionState(
  session: PresenceSession,
  canvas: CanvasContents | null,
  nowMs: number,
): Exclude<RowState, "away"> {
  if (canvas && openAsks(canvas).some((ask) => ask.askerId === session.actor.id)) {
    return "blocked";
  }
  if (session.activity != null) return "working";
  if (session.statusSource === "lifecycle" && session.status !== null) return "parked";
  if (session.kind === "cli" && nowMs - Date.parse(session.lastSeen) >= QUIET_AFTER_MS) {
    return "quiet";
  }
  return "here";
}

export interface AgentRow {
  actorId: string;
  /** What the row is called: the primary session's label, else the actor's
   * registered name. */
  name: string;
  state: RowState;
  /** The acting surface — null exactly when `state` is "away". */
  primary: PresenceSession | null;
  /** Every other live surface this actor holds (browser tabs, mostly). */
  others: PresenceSession[];
  /** Which agent this is, or null for a bare terminal / an away actor whose
   * harness nobody recorded. */
  harness: string | null;
  /** For an away row: the last thing the canvas remembers them doing. */
  lastAct: ActivityEntry | null;
}

/** How many away rows the roster shows. A canvas remembers every actor that
 * ever claimed a name here — including one-shot probe sessions — and a
 * roster longer than the room is a list, not a room. */
const AWAY_ROWS = 6;

/**
 * The rows: live agents first (blocked, then working, then the rest by
 * freshness), then up to `AWAY_ROWS` remembered actors who actually DID
 * something here — made, edited, or said — newest act first. The did-filter
 * is what keeps a name-only claimant (a verification probe that touched
 * nothing) out of the room.
 */
export function roster(
  sessions: readonly PresenceSession[],
  canvas: CanvasContents | null,
  nowMs: number,
  /** Actor ids a live rc answers for — the connection-bound fact (phase 6).
   * Omit when the caller cannot see the holds; rows then read `enrolled`. */
  answerable?: ReadonlySet<string>,
): AgentRow[] {
  const byActor = new Map<string, PresenceSession[]>();
  for (const session of sessions) {
    const held = byActor.get(session.actor.id);
    if (held) held.push(session);
    else byActor.set(session.actor.id, [session]);
  }

  const live: AgentRow[] = [];
  for (const [actorId, held] of byActor) {
    const clis = held
      .filter((s) => s.kind === "cli")
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    const primary = clis[0];
    if (!primary) continue; // a person at a browser — the facepile's, not ours
    live.push({
      actorId,
      name: primary.label ?? primary.actor.name,
      state: sessionState(primary, canvas, nowMs),
      primary,
      others: held.filter((s) => s !== primary),
      harness: primary.harness ?? null,
      lastAct: canvas ? (recentActivity(canvas, actorId, 1)[0] ?? null) : null,
    });
  }

  const ORDER: Record<RowState, number> = {
    blocked: 0,
    working: 1,
    parked: 2,
    quiet: 3,
    here: 4,
    answerable: 5,
    enrolled: 6,
    away: 7,
  };
  live.sort((a, b) => {
    if (ORDER[a.state] !== ORDER[b.state]) return ORDER[a.state] - ORDER[b.state];
    const seen = (b.primary?.lastSeen ?? "").localeCompare(a.primary?.lastSeen ?? "");
    return seen !== 0 ? seen : a.actorId.localeCompare(b.actorId);
  });

  if (!canvas) return live;

  // Standing agents (agents-on-demand phase 2.5): a row per enrolment, the
  // record made visible — present with no session at all, which is the
  // record's whole point. A live session for the same actor wins the row
  // (the live loop above already made one), and an enrolled actor never
  // repeats in the away half below.
  const enrolled: AgentRow[] = [];
  for (const record of Object.values(canvas.agents ?? {})) {
    if (byActor.has(record.actor.id)) continue;
    enrolled.push({
      actorId: record.actor.id,
      name: record.actor.name,
      state: answerable?.has(record.actor.id) ? "answerable" : "enrolled",
      primary: null,
      others: [],
      harness: null,
      lastAct: recentActivity(canvas, record.actor.id, 1)[0] ?? null,
    });
  }
  enrolled.sort((a, b) => a.name.localeCompare(b.name));

  const away: AgentRow[] = [];
  for (const actor of collectCanvasActors(canvas)) {
    if (byActor.has(actor.id)) continue;
    if (canvas.agents?.[actor.id]) continue; // already a standing row above
    const lastAct = recentActivity(canvas, actor.id, 1)[0];
    if (!lastAct) continue; // claimed a name, did nothing — not a row
    away.push({
      actorId: actor.id,
      name: actor.name,
      state: "away",
      primary: null,
      others: [],
      harness: null,
      lastAct,
    });
  }
  away.sort((a, b) => (b.lastAct?.at ?? "").localeCompare(a.lastAct?.at ?? ""));
  return [...live, ...enrolled, ...away.slice(0, AWAY_ROWS)];
}

/** The last thing said in the thread a session is answering — the expanded
 * row's "what summoned it". Null off-thread, or when the thread is gone. */
export function answeringExcerpt(
  canvas: CanvasContents,
  session: PresenceSession,
): { threadId: string; body: string } | null {
  const threadId = session.onThread;
  if (!threadId) return null;
  const last = canvas.threads[threadId]?.comments.at(-1);
  return last ? { threadId, body: last.body } : null;
}
