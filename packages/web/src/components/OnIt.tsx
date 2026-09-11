import {
  ANSWER_WITHIN_MS,
  listeners,
  refusedMentions,
  summonedBy,
  summonsLine,
  untilWords,
  waitingLine,
  wokenLine,
  workersOn,
  type Actor,
  type CommentThread,
} from "@isocan/core";
import { undo } from "../lib/api.ts";
import { useRcPolicies } from "../lib/answerable.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { makeComment } from "./CommentLayer.tsx";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor } from "../lib/presence.ts";
import { useClockSecond } from "../lib/sprint.ts";

/**
 * Who picked this thread up, live, under the last thing said in it.
 *
 * Asking for work and hearing nothing is the worst moment in this app. You
 * post, and the canvas looks exactly as it did: no way to tell whether an
 * agent woke, whether it understood, or whether anyone was listening at all.
 * Everything needed to answer that already existed — an agent's presence
 * carries a status, and `wait` lands it on the summoning thread the moment it
 * returns — and none of it reached the thread where the asking happened.
 *
 * It is deliberately presence, not comments. A status is EPHEMERAL: it costs
 * no op, it leaves no trace in the history, and when the agent stops, it
 * stops. A thread full of "working…" posts would be a thread you cannot read
 * next week. What lands permanently is the reply.
 *
 * When nobody has picked it up, it says whether anybody COULD — an agent
 * parked on `wait` is a different silence from an empty room.
 */
export function OnIt({
  thread,
  waiting,
  canvasId,
  actor,
}: {
  thread: CommentThread;
  waiting: boolean;
  canvasId: string;
  actor: Actor;
}) {
  const sessions = useCanvasStore((s) => s.sessions);
  const colors = useActorColors();
  // Above the early returns: a hook's order may not depend on whether anybody
  // happens to be working right now.
  const second = useClockSecond();
  const policies = useRcPolicies(canvasId);
  const joined = useCanvasStore((s) => s.actorJoins);
  const agents = useCanvasStore((s) => s.canvas?.agents);
  const names = useActorNames();
  const working = workersOn(sessions, thread.id);

  if (working.length > 0) {
    return (
      <div className="onit" aria-live="polite">
        {working.map((worker) => {
          const quiet = quietFor(worker);
          return (
            <div className="onit-row" key={worker.sessionId}>
              <span className="onit-dot" style={{ background: actorColorIn(colors, worker.actorId) }} />
              <b>{worker.name}</b>
              {/* Never invent a verb: if they have not said what they are
                  doing, "is on it" is the most this can honestly claim. */}
              <span>{worker.status ?? "is on it"}</span>
              {quiet && <i>quiet {quiet}</i>}
            </div>
          );
        })}
        {/* Already picked up: it cannot be unsaid, so the honest control is to
            ask them to stop — which is a message, like every other request. */}
        <button className="onit-cancel" onClick={() => void askToStop(canvasId, actor, thread)}>
          Ask to stop
        </button>
      </div>
    );
  }

  // Nothing has been asked, or it has already been answered.
  if (!waiting) return null;

  // How long the ask has gone unanswered. No new state: the last comment in
  // the thread IS the ask, so its timestamp is when you asked.
  const last = thread.comments[thread.comments.length - 1];
  const waitedMs = last ? Math.max(0, second * 1000 - Date.parse(last.createdAt)) : 0;

  /**
   * **Turned away at the gate** (owner-only summons, 11 Sep 2026). An agent
   * you named whose rc does not take your word will not pick this up, and
   * the rc will say so in the thread a moment from now — but "Sent" or a
   * clock here meanwhile would be a promise already broken. Known the
   * instant the ask lands, from the policy the rc announced; never counted
   * as "nothing answered", because nothing was asked of the agent at all.
   */
  const refused = refusedMentions(last?.mentions, actor.id, policies, joined);
  if (refused.length > 0) {
    const nameOf = (id: string) => actorNameIn(names, { id, name: id });
    return (
      <div className="onit waiting" aria-live="polite">
        {refused.map(({ actorId, policy, lapsed }) => (
          <div className="onit-row" key={actorId}>
            <span className="onit-dot idle" />
            <span>
              {summonsLine(agents?.[actorId]?.actor.name ?? nameOf(actorId), { state: "refused", policy }, nameOf)}
              {/* Turned away WITH a grant that ran out is a different fact
                  from turned away with none (#272 phase 3): the same words,
                  plus the one clause that says which this is. */}
              {lapsed && ` Your access ${untilWords(lapsed)}.`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Woken, but not a word yet. Worth saying on its own: it is the difference
  // between "did that go anywhere?" and "give it a second". It also needs
  // nothing from the agent, so an older build that never claims a thread
  // still does not read as silence.
  const woken = summonedBy(sessions, thread);
  if (woken.length > 0) {
    /**
     * **Woken, and still nothing — now with a deadline** (#197 phase 1).
     *
     * This said "waiting for them to pick this up" and went on saying it for
     * as long as the silence lasted: a promise with no expiry, which is the
     * thing the standing-agents note opens by naming. Past the bound it stops
     * promising and says what it knows.
     *
     * The clock belongs HERE and not on the branch below, which was where it
     * went first. Below means the daemon woke nobody — so "nothing answered"
     * there would blame an agent for not replying to something nobody asked
     * it. Found by looking at a real canvas with a parked `wait`, not by
     * reading.
     */
    const names = woken.map((session) => session.label ?? session.actor.name);
    const overdue = waitedMs >= ANSWER_WITHIN_MS;
    return (
      <div className={`onit waiting${overdue ? " overdue" : ""}`} aria-live="polite">
        <div className="onit-row">
          <span className="onit-dot idle" />
          <span>{wokenLine(names, waitedMs)}</span>
        </div>
      </div>
    );
  }

  /**
   * **Nothing has picked it up — and now the clock is part of the sentence**
   * (#197 phase 1).
   *
   * This branch used to say "Sent. One agent is listening." and go on saying
   * it, however long the silence ran. True, and useless past a point: it
   * describes the ROOM rather than the request, which is exactly the
   * complaint the standing-agents note opens with — silence that cannot be
   * told apart from thinking.
   *
   * The wait needs no new state: the last comment in the thread is the ask,
   * so its timestamp is when you asked. `useSecond` re-renders this once a
   * second and stops entirely while the tab is hidden.
   */
  // No clock on this one, on purpose: reaching here means nobody was woken,
  // and a line that aged into "nothing answered" would be an accusation about
  // a request that was never delivered to anybody.
  const parked = listeners(sessions).length;
  return (
    <div className="onit waiting" aria-live="polite">
      <div className="onit-row">
        <span className="onit-dot idle" />
        <span>{waitingLine(parked)}</span>
        {/* Nothing has read it yet, so it can simply stop existing. Undoable
            like any other op — this is `comment.remove`, not a shred. */}
        <button className="onit-cancel" onClick={() => void retract(canvasId, actor, thread)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Take the request back. Before anybody has picked it up, cancelling is not a
 * message to anyone — it is undoing what you just did.
 *
 * And undo is literally how: `comment.remove` is an INTERNAL op, reachable
 * only as the inverse of posting, because this vocabulary deliberately has no
 * "delete a comment" anybody can issue. So a thread that is only this request
 * is deleted outright — a public op, and exact — and anything with history
 * behind it goes through the actor's own undo, which is the same act as ⌘Z.
 *
 * The narrow case undo could get wrong is doing something else on the canvas
 * between posting and changing your mind; then the stack has that on top. The
 * button only appears while your comment is the last word in the thread, which
 * makes it right in every case anybody has hit.
 */
async function retract(canvasId: string, actor: Actor, thread: CommentThread): Promise<void> {
  const last = thread.comments[thread.comments.length - 1];
  if (!last || last.author.id !== actor.id) return;
  if (thread.comments.length === 1 && !thread.main) {
    await sendEchoed(canvasId, actor, { type: "thread.delete", threadId: thread.id });
    return;
  }
  await undo(canvasId, actor);
}

/** Ask whoever has it to stop. A comment, because it has to reach an agent
 * that is mid-turn and reading its own tools — and because "why did this stop
 * halfway" is a question somebody asks next week. */
async function askToStop(canvasId: string, actor: Actor, thread: CommentThread): Promise<void> {
  await sendEchoed(canvasId, actor, {
    type: "thread.reply",
    threadId: thread.id,
    comment: makeComment("/cancel"),
  });
}
