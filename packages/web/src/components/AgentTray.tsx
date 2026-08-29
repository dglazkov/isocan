import { useState } from "react";
import type { Actor } from "@isocan/core";
import { roster } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { AgentRowView } from "./AgentRow.tsx";
import { PanelResizer } from "./PanelResizer.tsx";

/**
 * **`isocan who`, given a home on the canvas.**
 *
 * The rationale calls this the most isocan-specific move of the redesign, and
 * the reason is that nothing here is new: the states are already computed,
 * already correct, and already printed by the terminal. They have simply never
 * been shown to the person at the canvas. Somebody watching agents work has
 * had to read a facepile of initials and guess.
 *
 * `roster()` from core — the same function `isocan who` calls and the same one
 * the workbench column already used. Three surfaces, one derivation: when the
 * terminal says an agent is blocked, this says blocked, because there is one
 * answer rather than three that were written to agree.
 *
 * `AgentRowView` is shared with the workbench for the same reason, one level
 * down: a second copy of "how an agent's row looks" is how two views come to
 * disagree about where a row's link goes.
 */
export function AgentTray({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.agentsPanelOpen);
  const sessions = useCanvasStore((s) => s.sessions);
  const canvas = useCanvasStore((s) => s.canvas);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const [openRow, setOpenRow] = useState<string | null>(null);
  if (!open) return null;

  // The store filters your own session out of presence, so without this you
  // appear in the away half — "away" printed on the screen you are looking at.
  // The same guard the workbench column carries, and for the same reason.
  const rows = roster(sessions, canvas, Date.now()).filter(
    (row) => !(row.state === "away" && row.actorId === actor.id),
  );

  return (
    <aside
      className="agents-panel dock-panel floats"
      style={{ width: panelWidth }}
      aria-label="Agents on this canvas"
    >
      <header>
        <span className="agents-glyph" aria-hidden>
          ◆
        </span>
        <b>Agents</b>
        <i className="agents-hint">who is here, and what they are doing</i>
        <span className="spacer" />
        <button
          className="main-close"
          title="Collapse"
          aria-label="Close the agent tray"
          onClick={() => openPanel(canvasId, null)}
        >
          ✕
        </button>
      </header>
      <div className="agents-body">
        {rows.length === 0 ? (
          /* The same two-silences empty state the workbench uses: the room
             works before anybody is in it, and it says how somebody GETS in
             rather than shrugging. */
          <p className="agents-quiet">
            Nobody is parked here right now. An agent joins with the isocan
            skill and waits with <code>isocan wait</code>; anything you say in
            the Chat reaches whoever parks next.
          </p>
        ) : (
          rows.map((row) => (
            <AgentRowView
              key={row.actorId}
              canvasId={canvasId}
              row={row}
              open={openRow === row.actorId}
              focused={null}
              onToggle={() => setOpenRow(openRow === row.actorId ? null : row.actorId)}
            />
          ))
        )}
      </div>
      <PanelResizer />
    </aside>
  );
}
