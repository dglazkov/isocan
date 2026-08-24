import { useCanvasStore, dismissRefusals, setNotice } from "../stores/canvasStore.ts";
import { unsyncedCount } from "../lib/writequeue.ts";

/**
 * **What offline looks like** — phase 10's honesty, on screen.
 *
 * Three things a tab that lost its home has to say, in decreasing order of how
 * often they happen, and none of them may be said by silence:
 *
 * 1. **You are offline and your work is being kept.** The count is the point.
 *    "Offline" alone leaves a person guessing whether the last ten minutes
 *    exist anywhere; "4 changes kept here" is a promise the queue can actually
 *    honour, and it goes to zero in front of them when the tail confirms.
 * 2. **The home would not take one of them.** The phase's honesty problem: a
 *    change was applied optimistically, the home refused it on reconnect, and
 *    the canvas has quietly gone back to what the home says. Silent rollback
 *    is a lie — a person who wrote a comment on a plane and finds it gone with
 *    no explanation has lost work AND trust. So the refusal survives the
 *    rollback: what was refused, in the home's own words, until dismissed. The
 *    other option — leave the change on screen and the queue stuck — is worse,
 *    because then the tab and the home disagree about a canvas and only one of
 *    them is right.
 * 3. **Something could not be done at all.** Undo with no home to ask; a file
 *    that cannot be added offline. One sentence, dismissible.
 *
 * Deliberately not a modal. Everything here is survivable and a person who is
 * working offline is working; standing in front of the canvas to say so would
 * make a small fact into an interruption. Same instinct, and same shape, as
 * `ArrivalNotice`.
 */
export function OfflineBar() {
  const connection = useCanvasStore((s) => s.connection);
  const queue = useCanvasStore((s) => s.queue);
  const refused = useCanvasStore((s) => s.refused);
  const notice = useCanvasStore((s) => s.notice);

  const waiting = unsyncedCount(queue);
  const offline = connection === "offline";
  if (!offline && refused.length === 0 && notice === null) return null;

  return (
    <div className="offline-bar" role="status" aria-live="polite">
      {offline && (
        <div className="offline-row">
          <span className="offline-dot" aria-hidden="true" />
          <span className="offline-note">
            {waiting === 0
              ? "Offline — the canvas's home cannot be reached."
              : `Offline — ${waiting} change${waiting === 1 ? "" : "s"} kept here, and sent when you reconnect.`}
          </span>
        </div>
      )}
      {refused.length > 0 && (
        <div className="offline-row offline-refused">
          <div className="offline-stack">
            <span className="offline-note">
              {refused.length === 1
                ? "One change did not go through when you reconnected:"
                : `${refused.length} changes did not go through when you reconnected:`}
            </span>
            {refused.map((one) => (
              <span key={one.opId} className="offline-hint">
                <code>{one.opType}</code> — {one.message}
              </span>
            ))}
            <span className="offline-hint">
              The canvas now shows what the home has. Nothing else you did was affected.
            </span>
          </div>
          <button className="btn offline-dismiss" onClick={dismissRefusals} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {notice !== null && (
        <div className="offline-row">
          <span className="offline-note">{notice}</span>
          <button
            className="btn offline-dismiss"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
