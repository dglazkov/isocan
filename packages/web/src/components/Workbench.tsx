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
  workbenchUrl,
  type AgentRow,
} from "@isocan/core";
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
}: {
  canvasId: string;
  itemId: string | null;
  actor: Actor;
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
        <button
          className="fullscreen-copy"
          title="Copy a link to this view"
          onClick={() => {
            void navigator.clipboard?.writeText(
              workbenchUrl(location.origin, canvasId, itemId ?? undefined),
            );
          }}
        >
          Copy link
        </button>
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

/** How long ago, in the roster's clipped vocabulary. */
function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function AgentRowView({
  canvasId,
  row,
  open,
  focused,
  onToggle,
}: {
  canvasId: string;
  row: AgentRow;
  open: boolean;
  focused: string | null;
  onToggle: () => void;
}) {
  // The peek is position:FIXED at a measured point — the roster scrolls,
  // and a peek positioned inside it gets clipped by the scroll box (the
  // emoji picker met the same wall and portaled; fixed escapes overflow
  // clipping without one, since nothing above carries a transform).
  const [peekAt, setPeekAt] = useState<{ x: number; y: number } | null>(null);
  const enter = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPeekAt({ x: r.right - 6, y: Math.min(r.top, window.innerHeight - 240) });
  };
  const navigate = useNavigate();
  const colors = useActorColors();
  const canvas = useCanvasStore((s) => s.canvas);
  const color = actorColorIn(colors, row.actorId);

  // An away row is memory, not presence: nothing live to expand, so it is a
  // line, not a disclosure. The affordance it carries is the truth about
  // reaching them — a message waits on the thread.
  if (row.primary === null) {
    return (
      <div
        className="wb-row away"
        title="Away — a message below waits on the thread for their next wake"
        onPointerEnter={enter}
        onPointerLeave={() => setPeekAt(null)}
      >
        {peekAt && canvas && (
          <div className="wb-peek" style={{ left: peekAt.x, top: peekAt.y }}>
            <ul className="wb-trail">
              {recentActivity(canvas, row.actorId, 8).map((act, i) => (
                <li key={i}>
                  <span className="wb-act">{describeAct(act.kind, act.subject)}</span>
                  <em>{ago(act.at)}</em>
                </li>
              ))}
            </ul>
          </div>
        )}
        <span className="wb-row-head as-line">
          <span className="wb-dot hollow" style={{ borderColor: color }} aria-hidden />
          <span className="wb-row-name">
            <b>{row.name}</b>
            <i>away</i>
          </span>
          <span className="wb-row-line">
            {row.lastAct && `${describeAct(row.lastAct.kind, row.lastAct.subject)} · ${ago(row.lastAct.at)}`}
          </span>
        </span>
      </div>
    );
  }

  const session = row.primary;
  const quiet = quietFor(session);
  const workingOn =
    session.activity && "itemId" in session.activity ? session.activity.itemId : null;

  // The status line stays VERBATIM — the agent's own words. What changed
  // since V1 is that `statusSource` crosses the wire, so the STATE beside it
  // (parked, blocked) is derived rather than string-matched.
  const line = session.status ?? (row.state === "working" ? "working" : null);

  return (
    <div
      className={`wb-row${open ? " open" : ""}`}
      onPointerEnter={enter}
      onPointerLeave={() => setPeekAt(null)}
    >
      {/* The peek: hover answers "what have they been up to" without a
          click — the FaceCard's manners, in the room. The expanded row
          already shows the record, so the peek stands down for it. */}
      {peekAt && !open && canvas && (
        <div className="wb-peek" style={{ left: peekAt.x, top: peekAt.y }}>
          <ul className="wb-trail">
            {recentActivity(canvas, row.actorId, 8).map((act, i) => (
              <li key={i}>
                <span className="wb-act">{describeAct(act.kind, act.subject)}</span>
                <em>{ago(act.at)}</em>
              </li>
            ))}
            {recentActivity(canvas, row.actorId, 1).length === 0 && (
              <li className="wb-quiet">nothing on this canvas yet</li>
            )}
          </ul>
        </div>
      )}
      <button className="wb-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="wb-dot" style={{ background: color }} aria-hidden />
        <span className="wb-row-name">
          <b>{row.name}</b>
          <i>{row.harness ?? "terminal"}</i>
          {row.state === "blocked" && (
            <em className="wb-state blocked" title="Asked a question nobody has answered — it clears on the answer, not on being seen">
              asked
            </em>
          )}
          {row.state === "parked" && (
            <em className="wb-state parked" title="Parked on isocan wait — a message below lands now">
              parked
            </em>
          )}
        </span>
        <span className="wb-row-line">
          {line ?? "here"}
          {quiet && <em> · {quiet}</em>}
        </span>
      </button>
      {open && canvas && (
        <div className="wb-row-detail">
          <button
            className="wb-watch"
            onClick={() => useUiStore.getState().setFollow(session.sessionId)}
            title="The stage follows what they work on — Esc, or any click of your own, stops it"
          >
            Watch
          </button>
          {(() => {
            const answering = answeringExcerpt(canvas, session);
            return answering ? (
              <p className="wb-answering">
                answering: <q>{answering.body.slice(0, 120)}</q>
              </p>
            ) : null;
          })()}
          {workingOn && canvas.items[workingOn] && (
            <button
              className="wb-thumb"
              title={`Put ${canvas.items[workingOn]!.title} on the stage`}
              onClick={() => goStage(navigate, workbenchItemPath(canvasId, workingOn))}
            >
              <ItemThumb canvasId={canvasId} itemId={workingOn} width={200} height={92} />
              <span>{canvas.items[workingOn]!.title}</span>
            </button>
          )}
          <ul className="wb-trail">
            {recentActivity(canvas, row.actorId, 5).map((act, i) => (
              <li key={i}>
                {act.itemId && canvas.items[act.itemId] ? (
                  <button
                    className={`wb-act${focused === act.itemId ? " here" : ""}`}
                    onClick={() => goStage(navigate, workbenchItemPath(canvasId, act.itemId!))}
                  >
                    {describeAct(act.kind, act.subject)}
                  </button>
                ) : (
                  <span className="wb-act">{describeAct(act.kind, act.subject)}</span>
                )}
                <em>{ago(act.at)}</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function describeAct(kind: string, subject: string): string {
  if (kind === "made") return `made ${subject}`;
  if (kind === "edited") return `edited ${subject}`;
  if (kind === "said") return `said ${subject}`;
  return `${kind} ${subject}`;
}
