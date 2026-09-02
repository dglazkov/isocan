import { useSyncExternalStore } from "react";
import type { Actor, Item, Paper, SprintState } from "@isocan/core";
import {
  PAPER_SIZE,
  freeSpotIn,
  handInPatch,
  handedInFor,
  hidesVotes,
  inArea,
  newGroupId,
  sprintState,
} from "@isocan/core";
import { flashNotice, sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { screenToWorld } from "./viewport.ts";
import { glideToBox } from "./zoomactions.ts";

/**
 * **The sprint, as the app reads it** — one derivation (core's
 * `sprintState`) and one clock, shared by every component that asks.
 *
 * The clock is the only thing here that is not a fold over the canvas. A
 * phase ends at a moment, not at an op: nothing arrives on the wire when the
 * bell rings, so a component that wants to reveal the votes at the bell has
 * to be told the time moved. This is that — one interval for the whole page,
 * running only while somebody is subscribed, ticking once a second because
 * the chip shows seconds. Components read `now` from it rather than calling
 * `Date.now()` in render, so a reveal happens in every chip on the same tick.
 */

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let nowSecond = Math.floor(Date.now() / 1000);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (subscribers++ === 0) {
    timer = setInterval(() => {
      nowSecond = Math.floor(Date.now() / 1000);
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (--subscribers === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The current second, shared. */
function useClockSecond(): number {
  return useSyncExternalStore(subscribe, () => nowSecond, () => nowSecond);
}

/** The running sprint (or null) and the shared clock, in ms. */
export function useSprint(): { state: SprintState | null; nowMs: number } {
  const canvas = useCanvasStore((s) => s.canvas);
  const second = useClockSecond();
  // Derived on every store change; cheap, because the fold stops at the first
  // `/sprint` line it meets walking back from the end of the Chat.
  const state = canvas ? sprintState(canvas) : null;
  return { state, nowMs: second * 1000 };
}

/**
 * **The walk** (sprint phase 2, `docs/projects/sprint/journey.md` Scene 1):
 * the three things a phase asks the room to do, as one function each, so
 * the clock chip's buttons and the item menu's entries are the same act.
 * Every one is ops the canvas already has; none is a sprint-only op.
 */

/** Glide the camera to the phase's sheet. A no-op with no board. */
export function goToArea(state: SprintState): void {
  if (!state.area) return;
  const { x, y, width, height } = state.area;
  glideToBox({ minX: x, minY: y, maxX: x + width, maxY: y + height });
}

/**
 * The paper a phase's notes are written on: yellow for the silent boxes and
 * the HMW wall, pink for the critique's scribe — the two the skill names,
 * so a note from the chip and a note from `isocan text --paper` match.
 */
export function phasePaper(phase: string): Paper {
  return phase === "critique" ? "pink" : "yellow";
}

/** Whether the chip should offer a note for this phase: anything written
 *  on a sheet during the phase — never a vote or a decision, which are
 *  marks on things already there. */
export function phaseTakesNotes(state: SprintState): boolean {
  return state.phase.kind === "silent" || state.phase.kind === "group";
}

/**
 * **New note**: open the Text tool on the phase's paper, IN the phase's
 * sheet at the first clear spot — or, with no board, in the middle of the
 * view. The composer is the same one a click opens; only where and on
 * what paper are decided here, so somebody who has never used the Text
 * tool writes a How-Might-We with one click on the chip.
 */
export function newNoteIn(state: SprintState): void {
  const ui = useUiStore.getState();
  const canvas = useCanvasStore.getState().canvas;
  const at =
    state.area && canvas
      ? freeSpotIn(canvas, state.area, PAPER_SIZE, PAPER_SIZE)
      : (() => {
          const centre = screenToWorld(ui.viewport, window.innerWidth / 2, window.innerHeight / 2);
          return { x: Math.round(centre.x - PAPER_SIZE / 2), y: Math.round(centre.y - PAPER_SIZE / 2) };
        })();
  ui.setPendingText({
    x: at.x,
    y: at.y,
    itemId: null,
    body: "",
    style: ui.lastTextStyle,
    face: ui.lastTextFace,
    paper: phasePaper(state.phase.name),
  });
}

/** The items in a selection that could be handed in for this phase. */
export function handable(items: readonly Item[], state: SprintState): Item[] {
  return items.filter((item) => handedInFor(item) !== state.phase.name);
}

/**
 * **Hand in**: stamp the items for the phase and, when there is a board,
 * put each one ON the phase's sheet if it is not already there — a hand-in
 * is a thing landing on the wall, and a wall is a sheet now. One group, so
 * one ⌘Z takes the whole hand-in back, stamps and moves together.
 */
export async function handIn(canvasId: string, actor: Actor, items: readonly Item[], state: SprintState): Promise<void> {
  const pending = handable(items, state);
  if (pending.length === 0) return;
  const group = newGroupId();
  let canvas = useCanvasStore.getState().canvas;
  for (const item of pending) {
    if (state.area && canvas && !inArea(state.area, item)) {
      const spot = freeSpotIn(canvas, state.area, item.width, item.height);
      await sendEchoed(canvasId, actor, { type: "item.move", itemId: item.id, x: spot.x, y: spot.y }, group);
      // The next spot has to see this one land.
      canvas = useCanvasStore.getState().canvas;
    }
    await sendEchoed(canvasId, actor, { type: "item.update", itemId: item.id, patch: handInPatch(state.phase.name) }, group);
  }
  flashNotice(
    pending.length === 1
      ? `Handed in for ${state.phase.label}`
      : `Handed ${pending.length} in for ${state.phase.label}`,
  );
}

/** Whether votes are hidden right now — the lens half of the curtain. */
export function useVotesHidden(): boolean {
  const { state, nowMs } = useSprint();
  return hidesVotes(state, nowMs);
}

/**
 * The bell: two short tones, generated rather than shipped, because a 2KB
 * sample is a file and this is a beep. Browsers refuse audio that no gesture
 * unlocked; the refusal is swallowed, because a silent bell with a flashing
 * chip is the acceptable failure and an error toast is not.
 */
export function ringBell(): void {
  try {
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const tone = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.55);
    };
    tone(880, 0);
    tone(1320, 0.18);
    setTimeout(() => void ctx.close().catch(() => undefined), 1200);
  } catch {
    // no audio here — the chip's flash is the bell
  }
}
