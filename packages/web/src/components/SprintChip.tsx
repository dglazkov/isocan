import { useEffect, useRef, useState } from "react";
import { clockLabel, remainingSeconds } from "@isocan/core";
import { useSprint, ringBell } from "../lib/sprint.ts";
import { useActorNames } from "../lib/names.ts";

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
 */
export function SprintChip({ lowered }: { lowered: boolean }) {
  const { state, nowMs } = useSprint();
  const names = useActorNames();
  const [flash, setFlash] = useState<"phase" | "bell" | null>(null);
  const lastPhase = useRef<string | null>(null);
  const rang = useRef<string | null>(null);

  const remaining = state ? remainingSeconds(state, nowMs) : null;

  useEffect(() => {
    if (!state) {
      lastPhase.current = null;
      return;
    }
    if (lastPhase.current !== state.commentId) {
      // Only the SECOND phase onwards flashes — arriving on a page mid-sprint
      // is not a phase change, and a chip that flashes on mount is noise.
      if (lastPhase.current !== null) setFlash("phase");
      lastPhase.current = state.commentId;
    }
  }, [state]);

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

  if (!state) return null;

  const clock =
    remaining === null ? null : remaining === 0 ? "time" : clockLabel(remaining);
  const handed = state.handedIn.length;
  const vote = state.phase.kind === "vote";
  const facilitator = names[state.facilitatorId] ?? state.facilitatorName;

  return (
    <div
      className={`sprint-chip kind-${state.phase.kind}${lowered ? " lowered" : ""}${flash ? ` flash-${flash}` : ""}`}
      role="status"
      aria-live="polite"
      title={`${state.phase.label}${state.note ? ` — ${state.note}` : ""} · called by ${facilitator}${
        vote ? " · votes are hidden until the bell" : ""
      }`}
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
    </div>
  );
}
