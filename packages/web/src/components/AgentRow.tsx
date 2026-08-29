import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AgentRow } from "@isocan/core";
import { answeringExcerpt, recentActivity, workbenchItemPath } from "@isocan/core";
import { quietFor } from "../lib/presence.ts";
import { goStage } from "../lib/goStage.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { ItemThumb } from "./ItemThumb.tsx";

/**
 * **One agent, as a row — drawn once and shown in two places.**
 *
 * This lived inside `Workbench.tsx`, which is fine while the workbench is the
 * only place a roster appears. The canvas has an agent tray now, and a second
 * copy of "how an agent's row looks" is how the two would come to disagree
 * about what `working` means or where a row's link goes.
 *
 * It is a component and not a template: the state pill, the open-ask excerpt
 * and the recent-activity list are all derived from the row core hands over,
 * so both homes show what `isocan who` would print because all three read
 * `roster()`.
 */
/** How long ago, in the roster's clipped vocabulary. */
function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

export function AgentRowView({
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
