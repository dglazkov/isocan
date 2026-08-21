import { listeners, summonedBy, workersOn, type CommentThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor } from "../lib/presence.ts";

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
export function OnIt({ thread, waiting }: { thread: CommentThread; waiting: boolean }) {
  const sessions = useCanvasStore((s) => s.sessions);
  const colors = useActorColors();
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
      </div>
    );
  }

  // Nothing has been asked, or it has already been answered.
  if (!waiting) return null;

  // Woken, but not a word yet. Worth saying on its own: it is the difference
  // between "did that go anywhere?" and "give it a second". It also needs
  // nothing from the agent, so an older build that never claims a thread
  // still does not read as silence.
  const woken = summonedBy(sessions, thread);
  if (woken.length > 0) {
    const names = woken.map((session) => session.label ?? session.actor.name);
    return (
      <div className="onit waiting" aria-live="polite">
        <div className="onit-row">
          <span className="onit-dot idle" />
          <span>
            {names.join(", ")} {names.length === 1 ? "was" : "were"} woken — waiting for{" "}
            {names.length === 1 ? "them" : "one of them"} to pick this up.
          </span>
        </div>
      </div>
    );
  }

  const parked = listeners(sessions).length;
  return (
    <div className="onit waiting" aria-live="polite">
      <div className="onit-row">
        <span className="onit-dot idle" />
        <span>
          {parked === 0
            ? "Nobody is parked — this waits on the thread for the next agent."
            : parked === 1
              ? "Sent. One agent is listening."
              : `Sent. ${parked} agents are listening.`}
        </span>
      </div>
    </div>
  );
}
