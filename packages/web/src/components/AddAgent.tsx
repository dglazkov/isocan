import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { askEnrolAgent } from "../lib/api.ts";
import { useRcParked } from "../lib/answerable.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * ***Add an agent*** — journey 1's dialog, reshaped by agent-custody
 * (2026-08-31).
 *
 * The gesture is now an **ask, addressed to the machine that will answer**:
 * the dialog sends a name to the parked `isocan rc` (through the home), and
 * the rc makes the same two moves `isocan agent add` makes — so the agent's
 * actor is born first-claim on the badge that will relay its face, and an
 * agent added here and one added from a terminal are indistinguishable
 * records *at the desk*, not only in the oplog. (The first version claimed
 * the actor on this browser's badge; the machine running the turns could
 * then never vouch for its face at the home — issue #83.)
 *
 * **No rc, no button.** For everyone who has never heard of `isocan rc`
 * there is nothing here to click that would do nothing (issue #81); the
 * decided shape is absence, which also leaves room for an invitation flow
 * later. The gate is `useRcParked` — the connection-bound fact, never the
 * presence announcement's TTL.
 *
 * The outcome arrives the way everything does: the `agent.enroll` op lands
 * and the roster row appears — or the countdown below runs out and says so,
 * because the journey's rule is that failure may not be silent. A name
 * already worn is refused at the rc's claim, which this dialog can only see
 * as that countdown; the rc's terminal narrates the reason.
 *
 * Persona templates are deliberately absent (decided 2026-08-30): deferred
 * until the personas machinery can say what a template defaults, rather than
 * a picker that decorates without deciding.
 */
const ASK_PATIENCE_MS = 25_000;

export function AddAgent({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const parked = useRcParked(canvasId);
  const agents = useCanvasStore((s) => s.canvas?.agents);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  /** The name we asked for and are still waiting to see enrolled. */
  const [pending, setPending] = useState<string | null>(null);
  const patience = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The handshake's visible end: the enroll op lands, the roster row appears.
  useEffect(() => {
    if (!pending || !agents) return;
    const landed = Object.values(agents).find(
      (a) => a.actor.name.toLowerCase() === pending.toLowerCase(),
    );
    if (!landed) return;
    if (patience.current) clearTimeout(patience.current);
    patience.current = null;
    setPending(null);
    setBusy(false);
    setAdded(landed.actor.name);
    setName("");
  }, [pending, agents]);

  useEffect(
    () => () => {
      if (patience.current) clearTimeout(patience.current);
    },
    [],
  );

  if (!parked) return null;

  const add = async () => {
    const wanted = name.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      await askEnrolAgent(canvasId, { name: wanted, from: actor });
      setPending(wanted);
      patience.current = setTimeout(() => {
        patience.current = null;
        setPending(null);
        setBusy(false);
        setError(
          `Nothing answered for “${wanted}” — the rc may have stopped, or refused the name (its terminal says why).`,
        );
      }, ASK_PATIENCE_MS);
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
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
          disabled={busy}
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
            {busy ? "Asking the parked rc…" : "Add"}
          </button>
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </form>
      {error && <p className="identity-warning">{error}</p>}
      {added && (
        <p className="add-agent-note">
          {added} is enrolled — the parked <code>isocan rc</code> answers for them.
        </p>
      )}
    </div>
  );
}
