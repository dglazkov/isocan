import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { sameActor } from "@isocan/core";
import { askEnrolAgent } from "../lib/api.ts";
import { useRcOwners, useRcParked } from "../lib/answerable.ts";
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
  const owners = useRcOwners(canvasId);
  const joined = useCanvasStore((s) => s.actorJoins);
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

  /**
   * **The add is the rc owner's** (owner-only summons, 11 Sep 2026). An rc
   * runs what its owner says, and an agent added to it answers its owner
   * alone — so to anybody else the button would be a promise of an agent
   * they could not use, and the home refuses the ask anyway. Instead: whose
   * rc it is, in words. An rc too old to say whose it is (no owners) keeps
   * the button, as before.
   */
  if (owners.length > 0 && !owners.some((o) => sameActor(joined, o.id, actor.id))) {
    const names = owners.map((o) => o.name).join(" or ");
    return (
      <div className="add-agent">
        <p className="add-agent-note">
          The <code>isocan rc</code> parked here is {names}&rsquo;s — adding an agent to it is
          theirs to do, and its agents listen to {names} unless {names} widens them.
        </p>
      </div>
    );
  }

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
          {added} is enrolled — the parked <code>isocan rc</code> answers for them, and
          listens only to its owner until they widen it (<em>Let anyone ask</em>, on its row).
        </p>
      )}
    </div>
  );
}
