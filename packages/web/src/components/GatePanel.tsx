import { useState } from "react";
import {
  LISTEN_ANYONE,
  listenGrants,
  listenUntil,
  sameActor,
  untilWords,
  withListener,
  type ListenEntry,
  type RcPolicy,
} from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useMentionRoster } from "../lib/mentions.ts";

/**
 * **Who can ask, as a list of people rather than a switch** (issue #272
 * phase 2).
 *
 * The tray could swing between two positions — *Only me* and *Let anyone
 * ask* — and naming one person was CLI-only. That is a strange place for the
 * two surfaces to differ, because naming a person is the COMMON case: the
 * whole story that produced this issue is one person wanting one other
 * person let in, and the web could only offer them the room.
 *
 * So the toggle becomes the gate itself: everybody on this canvas, each a
 * checkbox, plus *anyone*. It reads and writes the same `listen` list
 * `isocan rc listen --to` writes, through the same `withListener` in core,
 * and it says the gate in `policyWords`' vocabulary — so the tray, the
 * terminal and the refusal in a thread cannot word one gate three ways.
 *
 * **It is drawn only for the owner** (`AgentRow` decides that): the rc sets
 * aside a gate its owner did not write, so a checkbox anybody else could tick
 * would be a control whose click is discarded in silence.
 *
 * **How long lives here too** (phase 3). A name may carry an expiry, and a
 * checkbox with no way to say *for the afternoon* is the reason people leave
 * agents open — the picker is beside the names because that is the moment
 * somebody is deciding.
 */
export interface GatePanelProps {
  policy: RcPolicy;
  agentName: string;
  viewer: string;
  onListen: (listen: ListenEntry[]) => void;
}

export function GatePanel({ policy, agentName, viewer, onListen }: GatePanelProps) {
  const joined = useCanvasStore((s) => s.actorJoins);
  const agents = useCanvasStore((s) => s.canvas?.agents);
  const { peers } = useMentionRoster(viewer);
  const [span, setSpan] = useState("never");
  const open = policy.listen.includes(LISTEN_ANYONE);
  const grants = listenGrants(policy.listen);
  /* People, not agents. An agent's own word already counts as its owner's
     hand when the owner's machine runs it, and a gate naming an agent is a
     capability question this issue deliberately leaves alone. */
  const people = peers.filter(
    (p) => !agents?.[p.id] && !sameActor(joined, p.id, policy.owner.id),
  );

  const set = (actorId: string, admit: boolean) =>
    onListen(
      withListener(policy, actorId, admit, {
        joined,
        until: admit && actorId !== LISTEN_ANYONE ? listenUntil(span) : null,
      }),
    );

  return (
    <div className="gate-panel">
      <label className="gate-anyone">
        <input type="checkbox" checked={open} onChange={(e) => set(LISTEN_ANYONE, e.target.checked)} />
        <span>Let anyone ask</span>
      </label>
      {people.length === 0 ? (
        <p className="gate-note">
          Nobody else has been here yet — {agentName} answers you alone until
          somebody is.
        </p>
      ) : (
        people.map((person) => {
          const grant = grants.find((g) => sameActor(joined, g.id, person.id));
          const on = grant !== undefined && !grant.lapsed;
          return (
            <label className="gate-who" key={person.id}>
              <input
                type="checkbox"
                checked={on || open}
                disabled={open}
                onChange={(e) => set(person.id, e.target.checked)}
              />
              <span>{person.name}</span>
              {/* A grant that ran out is still shown, greyed: it is the
                  difference between "never asked for" and "you gave this and
                  it expired", and only the second has an obvious next move. */}
              {grant?.until && <em>{untilWords(grant.until)}</em>}
            </label>
          );
        })
      )}
      {/* **The one line that says what this is NOT** (#273, 11 Sep 2026). The
          mockup this came from had two more switches — *create and edit
          items*, *run shell commands* — and the note that examined them
          refuses per-asker scopes rather than deferring them: a reply IS a
          write, so "reply but not edit" is a rung the roles project already
          declined, and "no shell" turns an agent off, since an agent's hands
          are the CLI. A person looking at a panel called *who can ask* will
          reasonably wonder what they may do, so it is answered here in a
          sentence rather than left to be guessed at from an absence. */}
      <p className="gate-note">
        A grant decides <b>whether</b> {agentName} answers this person. What it
        may do here is its own rung on this canvas.
      </p>
      <label className="gate-span">
        <span>for</span>
        <select value={span} onChange={(e) => setSpan(e.target.value)}>
          <option value="never">as long as it stands</option>
          <option value="tonight">tonight</option>
          <option value="7d">7 days</option>
        </select>
      </label>
    </div>
  );
}
