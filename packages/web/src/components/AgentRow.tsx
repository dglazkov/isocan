import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AgentRow } from "@isocan/core";
import {
  type ListenEntry,
  answeringExcerpt,
  listenWords,
  mayWake,
  policyWords,
  recentActivity,
  rulesOf,
  sameActor,
  workbenchItemPath,
} from "@isocan/core";
import { quietFor } from "../lib/presence.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { goStage } from "../lib/goStage.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { ItemThumb } from "./ItemThumb.tsx";
import { GatePanel } from "./LazyGate.tsx";
import { useAnsweredAt, useRcPolicies } from "../lib/answerable.ts";
import { useClockSecond } from "../lib/sprint.ts";

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

/** The same clipped vocabulary as `ago`, for a moment rather than an ISO
 *  string — what the answerable poll hands back (#197 D1). */
function agoMs(at: number): string {
  if (!at) return "";
  const ms = Date.now() - at;
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
  viewer,
  onListen,
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
  /** Who is reading — so the row can say *listens only to you*, and not
   * invite a summons its reader cannot make (owner-only summons). */
  viewer?: string;
  /**
   * **Widen or narrow whose word wakes it — the owner's control, the tray's
   * only** (owner-only summons; the who-panel, #272 phase 2). Offered exactly
   * when the reader is the person whose rc answers, and it hands over the
   * whole `listen` list rather than a boolean: the web could only swing
   * between the owner alone and the whole room, while naming one person —
   * the common case, and the one that produced #272 — was CLI-only. The same
   * `agent.enroll` `isocan rc listen` sends, and the rc honours it because
   * its owner wrote it.
   */
  onListen?: (listen: ListenEntry[]) => void;
}) {
  // The peek is position:FIXED at a measured point — the roster scrolls,
  // and a peek positioned inside it gets clipped by the scroll box (the
  // emoji picker met the same wall and portaled; fixed escapes overflow
  // clipping without one, since nothing above carries a transform).
  const [peekAt, setPeekAt] = useState<{ x: number; y: number } | null>(null);
  /** The who-panel, closed until the owner asks for it: a row is a line
   *  people scan, and a permanently-open list of names is a column. */
  const [gateOpen, setGateOpen] = useState(false);
  const enter = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPeekAt({ x: r.right - 6, y: Math.min(r.top, window.innerHeight - 240) });
  };
  const navigate = useNavigate();
  const colors = useActorColors();
  const canvas = useCanvasStore((s) => s.canvas);
  const color = actorColorIn(colors, row.actorId);
  /* Re-read on the shared clock so the age is a number that MOVES: a
     timestamp rendered once and never again is the same overstatement in
     slower motion. `useClockSecond` is the one tick and it stops while the
     tab is hidden. */
  useClockSecond();
  const heardFrom = agoMs(useAnsweredAt(canvasId));
  /**
   * **The gate, said where the mention is made** (sheepdog, "whom it listens
   * to"). The design's first failure mode is a silent gate — *"a person
   * mentions a sheepdog that does not listen to them and nothing says so"* —
   * and this row is the one place they will look. `listenWords` is core's,
   * so the tray and `isocan who` cannot word it differently.
   */
  const names = useActorNames();
  const joined = useCanvasStore((s) => s.actorJoins);
  const policies = useRcPolicies(canvasId);
  const nameOf = (id: string) => actorNameIn(names, { id, name: id });
  /**
   * **Since owner-only summons (11 Sep 2026) the answering rc SAYS whose word
   * it takes**, with its hold, and that is what this row reads — the policy
   * dispatch applies, not the stored field it was derived from. An agent
   * nothing answers for has only its stored gate to show.
   */
  const policy = row.state === "answerable" ? policies[row.actorId] : undefined;
  const gate = policy
    ? policyWords(policy, nameOf, viewer, joined)
    : listenWords(rulesOf(canvas?.agents?.[row.actorId]?.rules), nameOf);
  /** The reader is outside the gate: a summons from them would be turned
   * away, so the row must not promise one. */
  const shut = policy !== undefined && viewer !== undefined && !mayWake(policy, viewer, joined);
  /** The reader is the owner — the one person who may widen it. */
  const owns = policy !== undefined && viewer !== undefined && sameActor(joined, policy.owner.id, viewer);
  const ownerName = policy ? nameOf(policy.owner.id) : "";

  // An enrolled row is a RECORD made visible (agents-on-demand phase 2.5):
  // standing to answer here, no session because nothing has arrived. Not
  // "away" (nothing left) and deliberately not "answerable" — that word is a
  // liveness derivation phase 6 owes. The one control it carries is the one
  // journey 8 puts here: Dismiss, which withdraws the standing and touches
  // nothing else.
  if (row.state === "enrolled" || row.state === "answerable") {
    return (
      <div
        className={`wb-row away enrolled${row.state === "answerable" ? " answerable" : ""}`}
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
          {/* **The two states must not look alike** (#197 D3, 7 Sep 2026).
              Both were a hollow dot and a sub-line, so the strongest fact an
              agent row can carry — "a summons WILL land" — read at a glance
              exactly like the weakest, "nobody is home". The dot is what a
              person scans; the sentence is what they read afterwards, if at
              all. Answerable gets a centre. */}
          {/* Ready only for a reader whose word it takes: to somebody outside
              the gate "a summons WILL land" is the one thing that is false. */}
          <span
            className={`wb-dot hollow${row.state === "answerable" && !shut ? " ready" : ""}`}
            style={{ borderColor: color, ...(row.state === "answerable" && !shut ? { color } : {}) }}
            aria-hidden
          />
          <span className="wb-row-name">
            <b>{row.name}</b>
            <i>{row.state}</i>
          </span>
          <span className="wb-row-line">
            {/* Evidence with an age rather than a state (#197 D1). "answers if
                you comment" is a promise nobody dated; heard-from turns it
                into a fact, and it warns on its own at four minutes without
                anybody writing a warning. */}
            {row.state === "answerable"
              ? shut
                ? /* Owner-only summons: no promise to a reader the rc will
                     turn away — who it answers, and who can change that. */
                  `${gate ?? `listens only to ${ownerName}`} — ask ${ownerName} to let you in`
                : heardFrom
                  ? `answers if you comment · heard ${heardFrom} ago`
                  : "answers if you comment"
              : row.lastAct
                ? `${describeAct(row.lastAct.kind, row.lastAct.subject)} · ${ago(row.lastAct.at)}`
                : "enrolled — nobody is listening right now"}
            {/* Qualifies the promise above rather than replacing it: "answers
                if you comment" is true only inside the gate, and this is the
                sentence that says whose — *listens only to you*, to its
                owner. */}
            {gate && !shut && <em> · {gate}</em>}
          </span>
          {owns && onListen && (
            <button
              className={`wb-listen${gateOpen ? " on" : ""}`}
              aria-expanded={gateOpen}
              title={`Who can wake ${row.name} — its turns spend your tokens on your machine`}
              onClick={(e) => {
                e.stopPropagation();
                setGateOpen(!gateOpen);
              }}
            >
              Who can ask
            </button>
          )}
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
        {/* Under the row rather than in a dialog: the gate is a fact about
            this agent, and a modal would take the reader away from the one
            line that says what the gate currently is. */}
        {gateOpen && owns && onListen && policy && (
          <GatePanel policy={policy} agentName={row.name} viewer={viewer!} onListen={onListen} />
        )}
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
