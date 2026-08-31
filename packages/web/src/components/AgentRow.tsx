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
  following,
  onFollow,
  onDismiss,
}: {
  canvasId: string;
  row: AgentRow;
  open: boolean;
  focused: string | null;
  onToggle: () => void;
  /**
   * **Follow is the TRAY's, not the row's.**
   *
   * These props are optional and the workbench passes neither, so no control
   * appears there — and that is the point rather than an omission. The
   * workbench COVERS the canvas: a camera flying around underneath a screen
   * you cannot see is motion with no audience, and a toggle offering it would
   * be a promise the room cannot keep.
   */
  following?: boolean;
  onFollow?: () => void;
  /**
   * **Dismiss is the TRAY's too**, same reasoning as follow: the tray is
   * where journey 8 puts the gesture ("the same doors that added an agent
   * take one away"), so the tray passes this for actors with standing and
   * the workbench passes nothing. Withdrawal removes the standing, never
   * the history — the op it sends says exactly that.
   */
  onDismiss?: () => void;
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

  // An enrolled row is a RECORD made visible (agents-on-demand phase 2.5):
  // standing to answer here, no session because nothing has arrived. Not
  // "away" (nothing left) and deliberately not "answerable" — that word is a
  // liveness derivation phase 6 owes. The one control it carries is the one
  // journey 8 puts here: Dismiss, which withdraws the standing and touches
  // nothing else.
  if (row.state === "enrolled" || row.state === "answerable") {
    return (
      <div
        className="wb-row away enrolled"
        title="Enrolled to answer on this canvas — a comment naming them reaches whatever answers for them"
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
              {recentActivity(canvas, row.actorId, 1).length === 0 && (
                <li className="wb-quiet">nothing on this canvas yet</li>
              )}
            </ul>
          </div>
        )}
        <span className="wb-row-head as-line">
          <span className="wb-dot hollow" style={{ borderColor: color }} aria-hidden />
          <span className="wb-row-name">
            <b>{row.name}</b>
            <i>{row.state}</i>
          </span>
          <span className="wb-row-line">
            {row.state === "answerable"
              ? "answers if you comment"
              : row.lastAct
                ? `${describeAct(row.lastAct.kind, row.lastAct.subject)} · ${ago(row.lastAct.at)}`
                : "enrolled — nobody is listening right now"}
          </span>
          {onDismiss && (
            <button
              className="wb-dismiss"
              title={`Dismiss ${row.name} — withdraws the standing; the history stays`}
              aria-label={`Dismiss ${row.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
            >
              ✕
            </button>
          )}
        </span>
      </div>
    );
  }

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
      {onFollow && (
        <button
          className={`wb-follow${following ? " on" : ""}`}
          aria-pressed={following}
          title={
            following
              ? `Following ${row.name} — the canvas goes to what they make. Click to stop.`
              : `Follow ${row.name} — send the canvas to whatever they make next`
          }
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
        >
          ⇅
        </button>
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
          {onDismiss && (
            <button
              className="wb-watch wb-dismiss-live"
              title={`Dismiss ${row.name} — withdraws the standing; the history stays`}
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
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
