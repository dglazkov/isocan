import { useState } from "react";
import type { Actor } from "@isocan/core";
import { roster } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { AddAgent } from "./AddAgent.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { AgentRowView } from "./AgentRow.tsx";
import { AgentsGlyph } from "./Glyphs.tsx";
import { PanelResizer } from "./PanelResizer.tsx";
import { PanelHead } from "./PanelHead.tsx";
import { useAnswerable } from "../lib/answerable.ts";

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
  const answerable = useAnswerable(canvasId);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const following = useUiStore((s) => s.followingActorId);
  if (!open) return null;

  // The store filters your own session out of presence, so without this you
  // appear in the away half — "away" printed on the screen you are looking at.
  // The same guard the workbench column carries, and for the same reason.
  const rows = roster(sessions, canvas, Date.now(), answerable).filter(
    (row) => !(row.state === "away" && row.actorId === actor.id),
  );

  return (
    <aside
      className="agents-panel dock-panel floats"
      style={{ width: panelWidth }}
      aria-label="Agents on this canvas"
    >
      <PanelHead
        glyph={<AgentsGlyph size={13} />}
        name="Agents"
        hint="who is here, and what they are doing"
        closeTitle="Collapse"
        closeLabel="Close the agent tray"
        onClose={() => openPanel(canvasId, null)}
      />
      <div className="agents-body">
        {rows.length === 0 ? (
          /* The same two-silences empty state the workbench uses: the room
             works before anybody is in it, and it says how somebody GETS in
             rather than shrugging. */
          <p className="agents-quiet">
            Nobody is parked here right now. Add an agent below to enrol one
            that answers when something arrives, or an agent joins with the
            isocan skill and waits with <code>isocan wait</code>; anything you
            say in the Chat reaches whoever parks next.
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
              /* One at a time. Following two agents is following neither —
                 the camera would be handed back and forth between whichever
                 of them saved last, which is the incoherence that took this
                 off the Chat in the first place. */
              following={following === row.actorId}
              onFollow={() =>
                useUiStore
                  .getState()
                  .setFollowingActor(following === row.actorId ? null : row.actorId)
              }
              /* Dismiss appears exactly on rows with STANDING (journey 8):
                 withdrawal is the enroll op's inverse gesture, and the same
                 op `isocan agent remove` sends — one record, two doors. */
              {...(canvas?.agents?.[row.actorId]
                ? {
                    onDismiss: () =>
                      void sendEchoed(canvasId, actor, {
                        type: "agent.withdraw",
                        actorId: row.actorId,
                      }),
                  }
                : {})}
            />
          ))
        )}
      </div>
      <AddAgent canvasId={canvasId} actor={actor} />
      <PanelResizer />
    </aside>
  );
}
