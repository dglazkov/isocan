import { useState } from "react";
import type { Actor } from "@isocan/core";
import { claimActor } from "../lib/api.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * ***Add an agent*** — journey 1's dialog (agents-on-demand phase 2.5).
 *
 * The gesture decides WHO and nothing else: it claims an actor and sends
 * `agent.enroll`, the same two moves `isocan agent add` makes, through the
 * same op — so an agent added here and one added from a terminal are
 * indistinguishable records. WHERE and HOW are the rc half's, and a browser
 * cannot write a machine's file: a parked rc hears the enroll op land and
 * supplies them itself (its directory, `cli/src/rc.ts`). The footer tells
 * the truth about which world you are in — an rc's presence announcement
 * (`kind: "rc"`) says one is parked; absent that, the dialog hands over the
 * line to start one.
 *
 * Persona templates are deliberately absent (decided 2026-08-30): deferred
 * until the personas machinery can say what a template defaults, rather than
 * a picker that decorates without deciding.
 *
 * The claim key is the CLI's shape, `agent:<canvasId>:<name>` — but on this
 * browser's badge, not a machine's. A name already worn is refused by the
 * registry (`name-taken`), and the refusal is shown rather than smoothed
 * over: a silently doubled Sian is worse than an error.
 */
export function AddAgent({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const sessions = useCanvasStore((s) => s.sessions);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const rcParked = sessions.some((s) => s.kind === "rc");

  const add = async () => {
    const wanted = name.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setError(null);
    try {
      const claimed = await claimActor({
        type: "actor.claim",
        sessionKey: `agent:${canvasId}:${wanted}`,
        name: wanted,
      });
      await sendEchoed(canvasId, actor, {
        type: "agent.enroll",
        agent: claimed.envelope.actor,
      });
      setAdded(claimed.envelope.actor.name);
      setName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="add-agent">
        <button className="btn add-agent-open" onClick={() => setOpen(true)}>
          ＋ Add an agent
        </button>
      </div>
    );
  }

  return (
    <div className="add-agent open">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className="text-input"
          value={name}
          placeholder="Name the agent — Sian, Percy…"
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setAdded(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <div className="add-agent-actions">
          <button className="btn primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add"}
          </button>
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </form>
      {error && <p className="identity-warning">{error}</p>}
      {added &&
        (rcParked ? (
          <p className="add-agent-note">
            {added} is enrolled. An <code>isocan rc</code> is parked here — it supplies the
            directory and picks {added} up without a restart.
          </p>
        ) : (
          <p className="add-agent-note">
            {added} is enrolled — the record works with nothing running. No rc is parked here
            yet; in the project directory, run <code>isocan rc</code> to answer for it.
          </p>
        ))}
    </div>
  );
}
