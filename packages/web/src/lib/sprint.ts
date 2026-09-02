import { useSyncExternalStore } from "react";
import type { SprintState } from "@isocan/core";
import { hidesVotes, sprintState } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

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
export function useClockSecond(): number {
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
