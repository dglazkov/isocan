import { useMemo, useRef } from "react";
import type { Direction } from "./spatialnav.ts";
type Point = { x: number; y: number };
const interactive = "a, button, input, textarea, select, iframe, audio, video, pre, [contenteditable=true], [data-touch-scroll]";
/** One gesture has one outcome. Native content and vertical scrolling keep theirs. */
export function touchNavigation(step: (direction: Direction) => void, plan?: () => void, thirds = false) {
  const points = new Map<number, Point>();
  let start: Point | null = null, last: Point | null = null, spread = 0, multiple = false, flipped = false;
  const reset = () => { points.clear(); start = last = null; spread = 0; multiple = false; };
  const distance = () => { const [a, b] = [...points.values()]; return a && b ? Math.hypot(a.x-b.x, a.y-b.y) : 0; };
  return {
    down(e: { pointerType: string; pointerId: number; clientX: number; clientY: number; target: EventTarget | null }) {
      if (e.pointerType !== "touch") return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size > 1) { multiple = true; start = null; spread = distance(); return; }
      flipped = false;
      start = (e.target as Element)?.closest?.(interactive) ? null : { x: e.clientX, y: e.clientY }; last = start;
    },
    move(e: { pointerId: number; clientX: number; clientY: number }) {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { x: e.clientX, y: e.clientY };
      if (multiple && plan && spread > 0 && distance() > spread * 1.3 && !flipped) { flipped = true; plan(); }
    },
    up(pointerId: number, width: number) {
      if (!points.has(pointerId)) return;
      points.delete(pointerId);
      if (start && last && !multiple) {
        const dx = last.x-start.x, dy = last.y-start.y;
        let direction: Direction | null = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)*1.5) direction = dx < 0 ? "ArrowRight" : "ArrowLeft";
        else if (!thirds && Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)*1.5) direction = dy < 0 ? "ArrowDown" : "ArrowUp";
        else if (thirds && Math.hypot(dx, dy) < 8) direction = start.x < width/3 ? "ArrowLeft" : start.x > width*2/3 ? "ArrowRight" : null;
        if (direction) { flipped = true; step(direction); }
      }
      if (!points.size) reset();
    },
    cancel: reset,
    consumeClick() { const value = flipped; flipped = false; return value; },
  };
}
/** Keep one gesture recognizer alive while route callbacks change after each step. */
export function useTouchNavigation(step: (direction: Direction) => void, plan?: () => void, thirds = false) {
  const action = useRef({ step, plan }); action.current = { step, plan };
  const gesture = useMemo(() => touchNavigation((d) => action.current.step(d), () => action.current.plan?.(), thirds), [thirds]);
  return useMemo(() => ({
    onPointerDownCapture: (e: React.PointerEvent) => gesture.down(e),
    onPointerMoveCapture: (e: React.PointerEvent) => gesture.move(e),
    onPointerUpCapture: (e: React.PointerEvent) => gesture.up(e.pointerId, window.innerWidth),
    onPointerCancelCapture: () => gesture.cancel(),
    onClickCapture: (e: React.MouseEvent) => { if (gesture.consumeClick()) { e.preventDefault(); e.stopPropagation(); } },
  }), [gesture]);
}
