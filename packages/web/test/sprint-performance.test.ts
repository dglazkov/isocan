import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasContents } from "@isocan/core";

// Run the production selectors/subscription functions without a DOM. React's
// rendering is not under test; the interval count and selector identity are.
const { cleanups } = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const hooks = {
    useSyncExternalStore: (subscribe: (changed: () => void) => () => void, snapshot: () => unknown) => { cleanups.push(subscribe(() => {})); return snapshot(); },
    useCallback: <T,>(callback: T) => callback,
    useDebugValue: () => {},
    useMemo: <T,>(make: () => T) => make(),
  };
  return { ...real, ...hooks, default: { ...real, ...hooks } };
});
vi.mock("../src/stores/canvasStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/canvasStore.ts")>();
  const useCanvasStore = Object.assign((selector: (state: ReturnType<typeof real.useCanvasStore.getState>) => unknown) => selector(real.useCanvasStore.getState()), real.useCanvasStore);
  return { ...real, useCanvasStore };
});
import { sprintForCanvas, useClockSecond, useSprint } from "../src/lib/sprint.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";

const start = "2026-09-12T12:00:00Z";
function canvas(body?: string): CanvasContents {
  return { items: {}, trash: [], agents: {}, threads: body ? { thr_acme: { id: "thr_acme", main: true, x: 0, y: 0, anchorItemId: null, comments: [{ id: "cmt_acme", author: { id: "usr_acme", name: "Acme" }, body, createdAt: start }] } } : {} } as CanvasContents;
}
function release() { for (const cleanup of cleanups.splice(0)) cleanup(); }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => { release(); vi.useRealTimers(); });

describe("a thousand idle cards do not own a sprint clock", () => {
  it.each([undefined, "/sprint end"])("subscribes no timer when the phase is %s", (body) => {
    useCanvasStore.setState({ canvas: canvas(body) });
    for (let i = 0; i < 3000; i++) expect(useSprint().state).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses one shared clock for a live timed sprint and none after its deadline", () => {
    useCanvasStore.setState({ canvas: canvas("/sprint sketch 1m") });
    for (let i = 0; i < 1000; i++) expect(useSprint().state?.endsAt).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(61_000);
    release();
    expect(useSprint().nowMs).toBeGreaterThanOrEqual(Date.parse(start) + 60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("retains the independent OnIt clock without an active sprint", () => {
    useCanvasStore.setState({ canvas: canvas() });
    useSprint(); useClockSecond();
    expect(vi.getTimerCount()).toBe(1);
  });
  it("derives an immutable revision once, including the null result", () => {
    let reads = 0;
    const original = canvas();
    const current = { ...original, get threads() { reads++; return original.threads; } };
    for (let i = 0; i < 3000; i++) expect(sprintForCanvas(current)).toBeNull();
    expect(reads).toBe(1);
    const active = canvas("/sprint sketch 1m");
    const first = sprintForCanvas(active);
    expect(first).not.toBeNull();
    for (let i = 0; i < 1000; i++) expect(sprintForCanvas(active)).toBe(first);
    expect(sprintForCanvas(canvas("/sprint end"))).toBeNull();
  });
});
