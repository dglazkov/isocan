import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import {
  canvasPath,
  recentActivity,
  roster,
  answeringExcerpt,
  workbenchItemPath,
  workbenchPath,
  type AgentRow,
} from "@isocan/core";
import { CanvasPresence, CanvasTitle } from "./CanvasCrumb.tsx";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { WB_AGENTS_MIN_WIDTH, useUiStore } from "../stores/uiStore.ts";
import { PanelResizer } from "./PanelResizer.tsx";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor } from "../lib/presence.ts";
import { ArtifactStage } from "./ArtifactStage.tsx";
import { ItemThumb } from "./ItemThumb.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { MainThreadBody } from "./MainThreadPanel.tsx";
import { WbFiles } from "./WbFiles.tsx";
import { goStage } from "../lib/goStage.ts";
import { AgentRowView } from "./AgentRow.tsx";
import { SectionResizer, useSectionHeight } from "./SectionResizer.tsx";
import { iconKindFor } from "../lib/kinds.ts";

/**
 * The workbench: the same canvas, flipped to the agent room.
 *
 * A cover over the canvas, exactly as FullScreen is one — the canvas, its
 * socket, its presence session and its viewport all stay mounted underneath,
 * so flipping is instant and Esc lands you at the zoom you left. Two columns:
 * the AGENT VIEW (the roster of everyone here to work, and the one main
 * thread), and the STAGE (one artifact, entered, through the same
 * `ArtifactStage` full screen uses — the two addresses must never render the
 * same item differently).
 *
 * Everything in it is a projection. The roster is presence; the trail is
 * `recentActivity` over canvas state; the composer is the main thread; the
 * stage is a route param. The panel writes nothing except through the
 * composer, which is the same `thread.reply` either surface sends — zero new
 * operations, which is the design doc's headline finding and this file's
 * standing constraint (`workbench.test.ts` holds it).
 */
/** The collapse is remembered per canvas, on the `panels.ts` ethic: somebody
 * who folded the room away wants it folded tomorrow too. */
const RAIL_KEY = (canvasId: string) => `isocan.wb.agents.${canvasId}`;

function readRail(canvasId: string): boolean {
  try {
    return localStorage.getItem(RAIL_KEY(canvasId)) === "rail";
  } catch {
    return false;
  }
}

export function Workbench({
  canvasId,
  itemId,
  actor,
  onIdentity,
}: {
  canvasId: string;
  itemId: string | null;
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const navigate = useNavigate();
  const item = useCanvasStore((s) => (itemId ? (s.canvas?.items[itemId] ?? null) : null));
  const agentsWidth = useUiStore((s) => s.wbAgentsWidth);
  const followSessionId = useUiStore((s) => s.followSessionId);
  const followed = useCanvasStore((s) =>
    followSessionId ? (s.sessions.find((x) => x.sessionId === followSessionId) ?? null) : null,
  );

  /**
   * Workbench follow: the stage tracks what the watched agent's locus names.
   *
   * The grabbing-the-wheel rule, written before the loop (the design doc's
   * 4.5): follow navigates with REPLACE — Back is yours, never a replay of
   * the agent's afternoon — and any navigation you make yourself clears it
   * (every stage-bound click in this file goes through `goStage`). Esc stops
   * the watch before it pops a level, because the ladder takes transient
   * chrome first and a follow is exactly that.
   */
  useEffect(() => {
    const locus =
      followed?.activity && "itemId" in followed.activity ? followed.activity.itemId : null;
    if (locus && locus !== itemId) {
      navigate(workbenchItemPath(canvasId, locus), { replace: true });
    }
  }, [canvasId, itemId, followed, navigate]);
  const [rail, setRail] = useState(() => readRail(canvasId));
  const setRailKept = (folded: boolean) => {
    setRail(folded);
    try {
      localStorage.setItem(RAIL_KEY(canvasId), folded ? "rail" : "open");
    } catch {
      // Storage denied: the fold holds for this session and no longer.
    }
  };

  const back = () => navigate(canvasPath(canvasId));

  // Esc pops ONE level — /w/<item> drops the focus, /w leaves the bench —
  // bound in capture for FullScreen's reason: the stage's content is somebody
  // else's page and may swallow events on the way up.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (useUiStore.getState().followSessionId) {
        useUiStore.getState().setFollow(null);
        return;
      }
      if (itemId) navigate(workbenchPath(canvasId));
      else back();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <div className="workbench">
      <div className="fullscreen-bar">
        <button className="fullscreen-back" onClick={back} title="Back to the canvas (Esc)">
          ← Canvas
        </button>
        <CanvasTitle actor={actor} />
        {item && (
          <span className="fullscreen-title">
            <KindIcon className="kind-icon" kind={iconKindFor(item)} />
            <b>{item.title}</b>
          </span>
        )}
        {followed && (
          <button
            className="follow-banner wb"
            onClick={() => useUiStore.getState().setFollow(null)}
            title="Stop watching (Esc)"
          >
            Watching {followed.label ?? followed.actor.name} — Esc to stop
          </button>
        )}
        <span className="spacer" />
        {/* No "Copy link": the address bar is already showing the address of
            this exact view. What this bar had been throwing away is worth far
            more — which canvas you are in, whether you are live, and everyone
            else's faces. Losing the pile on the way into the room where the
            agents are was the worst of it. */}
        <CanvasPresence actor={actor} onIdentity={onIdentity} />
      </div>
      <div className="wb-body">
        {/* Collapsible to a RAIL, never removed: the agent view is the reason
            this room exists (design doc, "the frame"). The rail keeps the
            reopen affordance and nothing else. */}
        {rail ? (
          <div className="wb-agents rail">
            <button
              className="wb-fold"
              title="Show the agents and the thread"
              aria-label="Expand the agent column"
              onClick={() => setRailKept(false)}
            >
              »
            </button>
          </div>
        ) : (
          <div className="wb-agents" style={{ width: agentsWidth }}>
            <Roster
              canvasId={canvasId}
              focused={itemId}
              viewer={actor.id}
              onFold={() => setRailKept(true)}
            />
            <WbFiles canvasId={canvasId} actor={actor} />
            <MainThreadBody canvasId={canvasId} actor={actor} docked={false} />
            <PanelResizer
              value={agentsWidth}
              onChange={(w) => useUiStore.getState().setWbAgentsWidth(w)}
              resetTo={WB_AGENTS_MIN_WIDTH}
              min={WB_AGENTS_MIN_WIDTH}
              max={window.innerWidth - 360}
              label="Resize the agent column"
            />
          </div>
        )}
        <div className="wb-stage">
          {itemId ? (
            <ArtifactStage canvasId={canvasId} itemId={itemId} actor={actor} surface="workbench" />
          ) : (
            <div className="wb-empty">
              <p>
                Nothing on the stage. Click what an agent is working on, or pick an item —
                <code>isocan open --workbench &lt;item&gt;</code> lands here too.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The roster: every agent with a live session, grouped per actor, working
 * first. Expandable rows are the whole point — the collapsed row answers
 * "who, and doing what"; the expanded one shows the record.
 */
function Roster({
  canvasId,
  focused,
  viewer,
  onFold,
}: {
  canvasId: string;
  focused: string | null;
  viewer: string;
  onFold: () => void;
}) {
  const sessions = useCanvasStore((s) => s.sessions);
  const canvas = useCanvasStore((s) => s.canvas);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [rosterH, setRosterH] = useSectionHeight("isocan.wb.roster.h", 220);
  // The store filters YOUR OWN session out of presence (the facepile's
  // duplicate fix), so without this the person reading the panel appears in
  // its away half — "away" printed on the screen they are looking at. The
  // viewer is never away.
  const rows = roster(sessions, canvas, Date.now()).filter(
    (row) => !(row.state === "away" && row.actorId === viewer),
  );

  return (
    <section className="wb-roster" aria-label="Agents" style={{ maxHeight: rosterH }}>
      {/* The fold shares the header's line — a control on its own row was
          a row of chrome buying nothing. */}
      <h3>
        Agents
        <button
          className="wb-fold"
          title="Fold the agent column to a rail"
          aria-label="Collapse the agent column"
          onClick={onFold}
        >
          «
        </button>
      </h3>
      {rows.length === 0 && (
        // The two-silences empty state: the room works before anybody is in
        // it, and it says how somebody GETS in it rather than shrugging.
        <p className="wb-quiet">
          Nobody is parked here right now. An agent joins with the isocan
          skill and waits with <code>isocan wait</code>; a message below
          reaches the thread either way, and wakes whoever parks next.
        </p>
      )}
      {rows.map((row) => (
        <AgentRowView
          key={row.actorId}
          canvasId={canvasId}
          row={row}
          open={openRow === row.actorId}
          focused={focused}
          onToggle={() => setOpenRow(openRow === row.actorId ? null : row.actorId)}
        />
      ))}
      <SectionResizer value={rosterH} onChange={setRosterH} label="Resize the agent list" />
    </section>
  );
}

