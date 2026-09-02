import { useEffect, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { clockLabel, remainingSeconds } from "@isocan/core";
import {
  deskSprintOf,
  goToArea,
  handIn,
  handInFromDesk,
  handable,
  newNoteIn,
  phasePaper,
  phaseTakesNotes,
  ringBell,
  useRemoteSprint,
  useSprint,
} from "../lib/sprint.ts";
import { useActorNames } from "../lib/names.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **The clock on the wall.**
 *
 * A room stays creative because somebody neutral owns the clock, so the clock
 * has to be where everyone can see it. This chip says which phase the Chat
 * says is running, how long is left, and how many sketches are in — all
 * derived (`core/sprint.ts`), nothing stored, so `isocan sprint` in a
 * terminal prints the same line.
 *
 * Two moments are marked rather than merely shown. A NEW PHASE flashes the
 * chip once, because a phase line in the Chat is easy to miss while you are
 * drawing. THE BELL — the clock reaching zero — flashes and rings (see
 * `ringBell`). Both are decoration in the motion note's sense: skippable,
 * with the settled chip as the base state.
 *
 * While a vote is open the chip says so: counts and names are hidden until
 * the bell, and a room that knows why is a room that does not ask.
 *
 * **And it walks the room** (sprint phase 2). When the board is laid, a
 * phase call glides everyone's camera to the phase's sheet — the one
 * moment the facilitator's authority reaches the camera, because a phase
 * is the facilitator saying "everyone, over here", and only when the phase
 * changed while you were watching: arriving mid-sprint is not a call. The
 * chip then offers the phase's ONE action: *Go there* if you wandered,
 * *New note* on the phase's paper in the sheet, *Hand in* for what you
 * have selected. Each is the same act the item menu or the terminal does.
 */
export function SprintChip({ lowered, canvasId, actor }: { lowered: boolean; canvasId: string; actor: Actor }) {
  const { state, nowMs } = useSprint();
  const names = useActorNames();
  const [flash, setFlash] = useState<"phase" | "bell" | null>(null);
  // What this tab saw when it mounted — a phase's comment id, or null for
  // "no sprint yet" — and then whatever it saw last. `undefined` is "not
  // mounted yet", which is the one state that must never flash or walk.
  const lastPhase = useRef<string | null | undefined>(undefined);
  const rang = useRef<string | null>(null);
  const selectedIds = useUiStore((s) => s.selectedItemIds);
  const canvas = useCanvasStore((s) => s.canvas);
  // A desk: no sprint of its own, and a canvas record that names the sprint
  // it belongs to. Its chip reads THAT sprint — pulled, since the store
  // holds one canvas — and offers one thing: Hand in, across canvases.
  const project = useCanvasStore((s) => s.project);
  const deskOf = state ? null : deskSprintOf(project);
  const remote = useRemoteSprint(deskOf);

  const remaining = state ? remainingSeconds(state, nowMs) : null;

  useEffect(() => {
    // Nothing is watched until the canvas is here: a tab that opens on an
    // empty store and then receives a running sprint saw the canvas LOAD,
    // not a phase change, and must neither flash nor walk.
    if (!canvas) return;
    const now = state?.commentId ?? null;
    // Only a change you WATCHED flashes and walks — arriving on a page
    // mid-sprint is not a phase change, and a chip that flashes on mount is
    // noise. But the first phase of a sprint, called while this tab was
    // open, IS a change you watched: the tab saw "no sprint" on mount and
    // sees Map now. That is the walk's most important moment.
    const watched = lastPhase.current !== undefined && lastPhase.current !== now;
    lastPhase.current = now;
    if (watched && state) {
      setFlash("phase");
      goToArea(state);
    }
  }, [state, canvas]);

  useEffect(() => {
    if (!state || remaining !== 0 || rang.current === state.commentId) return;
    // Ring only when we WATCHED the clock reach zero: a tab opened after the
    // bell should not ring for a box that ended an hour ago.
    const watched = Date.parse(state.endsAt ?? "") > nowMs - 3000;
    rang.current = state.commentId;
    if (watched) {
      setFlash("bell");
      ringBell();
    }
  }, [state, remaining, nowMs]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  if (!state && deskOf && remote.state && remote.canvas) {
    const away = remote.state;
    const left = remainingSeconds(away, remote.nowMs);
    const clockAway = left === null ? null : left === 0 ? "time" : clockLabel(left);
    const chosen = canvas ? selectedIds.map((id) => canvas.items[id]).filter((one) => one !== undefined) : [];
    const sprintCanvas = remote.canvas;
    return (
      <div
        className={`sprint-chip desk kind-${away.phase.kind}${lowered ? " lowered" : ""}`}
        role="status"
        aria-live="polite"
        title={`Your desk — the sprint is in ${away.phase.label}${away.area ? `; Hand in lands on ${away.area.title}` : ""}`}
      >
        <span className="sprint-desk-label">Your desk</span>
        <span className="sprint-phase">
          {away.phase.mark && <span className="sprint-mark">{away.phase.mark}</span>}
          {away.phase.label}
        </span>
        {clockAway && <span className={`sprint-clock${left === 0 ? " rung" : ""}`}>{clockAway}</span>}
        {chosen.length > 0 && (
          <button
            className="sprint-action primary"
            title={`Copy ${chosen.length === 1 ? "this" : chosen.length} onto the sprint${away.area ? `'s ${away.area.title} sheet` : ""} and hand ${chosen.length === 1 ? "it" : "them"} in`}
            onClick={() => void handInFromDesk(canvasId, deskOf, sprintCanvas, actor, chosen, away)}
          >
            Hand in{chosen.length > 1 ? ` ${chosen.length}` : ""}
          </button>
        )}
      </div>
    );
  }

  if (!state) return null;

  const clock =
    remaining === null ? null : remaining === 0 ? "time" : clockLabel(remaining);
  const handed = state.handedIn.length;
  const vote = state.phase.kind === "vote";
  const facilitator = names[state.facilitatorId] ?? state.facilitatorName;
  const selected = canvas ? selectedIds.map((id) => canvas.items[id]).filter((one) => one !== undefined) : [];
  const pending = handable(selected, state);

  return (
    <div
      className={`sprint-chip kind-${state.phase.kind}${lowered ? " lowered" : ""}${flash ? ` flash-${flash}` : ""}`}
      role="status"
      aria-live="polite"
      title={`${state.phase.label}${state.note ? ` — ${state.note}` : ""} · called by ${facilitator}${
        vote ? " · votes are hidden until the bell" : ""
      }${state.area ? ` · on ${state.area.title}` : ""}`}
    >
      <span className="sprint-phase">
        {state.phase.mark && <span className="sprint-mark">{state.phase.mark}</span>}
        {state.phase.label}
      </span>
      {clock && (
        <span className={`sprint-clock${remaining === 0 ? " rung" : ""}`}>{clock}</span>
      )}
      {handed > 0 && (
        <span className="sprint-handed">
          {handed} in
        </span>
      )}
      {vote && remaining !== 0 && <span className="sprint-hidden">votes hidden</span>}
      {state.note && <span className="sprint-note">{state.note}</span>}
      {state.area && (
        <button
          className="sprint-action"
          title={`Glide to ${state.area.title}`}
          onClick={() => goToArea(state)}
        >
          Go there
        </button>
      )}
      {phaseTakesNotes(state) && (
        <button
          className="sprint-action"
          title={`A ${phasePaper(state.phase.name)} note${state.area ? ` in ${state.area.title}` : ""}`}
          onClick={() => newNoteIn(state)}
        >
          New note
        </button>
      )}
      {pending.length > 0 && (
        <button
          className="sprint-action primary"
          title={`Hand ${pending.length === 1 ? "this" : pending.length} in for ${state.phase.label}${state.area ? ` — it lands on ${state.area.title}` : ""}`}
          onClick={() => void handIn(canvasId, actor, pending, state)}
        >
          Hand in{pending.length > 1 ? ` ${pending.length}` : ""}
        </button>
      )}
    </div>
  );
}
