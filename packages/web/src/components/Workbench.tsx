import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { canvasPath, recentActivity, workbenchItemPath, workbenchPath, workbenchUrl } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { quietFor } from "../lib/presence.ts";
import { agentRows, answeringExcerpt, type AgentRow } from "../lib/roster.ts";
import { ArtifactStage } from "./ArtifactStage.tsx";
import { ItemThumb } from "./ItemThumb.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { MainThreadBody } from "./MainThreadPanel.tsx";
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

  const back = () => navigate(canvasPath(canvasId));

  // Esc pops ONE level — /w/<item> drops the focus, /w leaves the bench —
  // bound in capture for FullScreen's reason: the stage's content is somebody
  // else's page and may swallow events on the way up.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
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
        <div className="wb-agents">
          <Roster canvasId={canvasId} focused={itemId} />
          <MainThreadBody canvasId={canvasId} actor={actor} docked={false} />
        </div>
        <div className="wb-stage">
          {itemId ? (
            <ArtifactStage canvasId={canvasId} itemId={itemId} />
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
function Roster({ canvasId, focused }: { canvasId: string; focused: string | null }) {
  const sessions = useCanvasStore((s) => s.sessions);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const rows = agentRows(sessions);

  return (
    <section className="wb-roster" aria-label="Agents">
      <h3>Agents</h3>
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
  const navigate = useNavigate();
  const colors = useActorColors();
  const canvas = useCanvasStore((s) => s.canvas);
  const session = row.primary;
  const quiet = quietFor(session);
  const workingOn =
    session.activity && "itemId" in session.activity ? session.activity.itemId : null;
  const color = actorColorIn(colors, row.actorId);

  // The status line, VERBATIM. Classifying it (a PARKED badge, a semantic
  // pill) needs `statusSource` on the wire, which is not there yet — and
  // string-matching the wait copy to fake one is the lie the design doc bans
  // by name. The string an agent asserted, plus how long ago it was seen, is
  // honest today.
  const line = session.status ?? (row.working ? "working" : null);

  return (
    <div className={`wb-row${open ? " open" : ""}`}>
      <button className="wb-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="wb-dot" style={{ background: color }} aria-hidden />
        <span className="wb-row-name">
          <b>{row.name}</b>
          <i>{row.harness ?? "terminal"}</i>
        </span>
        <span className="wb-row-line">
          {line ?? "here"}
          {quiet && <em> · {quiet}</em>}
        </span>
      </button>
      {open && canvas && (
        <div className="wb-row-detail">
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
              onClick={() => navigate(workbenchItemPath(canvasId, workingOn))}
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
                    onClick={() => navigate(workbenchItemPath(canvasId, act.itemId!))}
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
