import { expect, it, vi } from "vitest";
import { touchNavigation } from "../src/lib/touchnavigation.ts";
const p = (x: number, y = 100, pointerId = 1) => ({ pointerType: "touch", pointerId, clientX: x, clientY: y, target: null });
it("steps once per swipe, with no synthetic-click advance", () => {
  const step = vi.fn(), g = touchNavigation(step, undefined, true);
  g.down(p(300)); g.move(p(100)); g.up(1, 375);
  expect(step).toHaveBeenCalledExactlyOnceWith("ArrowRight"); expect(g.consumeClick()).toBe(true); expect(g.consumeClick()).toBe(false);
});
it("reserves vertical movement, controls, cancellation and multiple fingers", () => {
  const step = vi.fn(), g = touchNavigation(step, undefined, true);
  g.down(p(300)); g.move(p(305, 200)); g.up(1, 375);
  g.down({ ...p(300), target: { closest: () => ({}) } as unknown as Element }); g.up(1, 375);
  g.down(p(300)); g.cancel(); g.up(1, 375);
  g.down(p(100)); g.down(p(200, 100, 2)); g.up(1, 375); g.up(2, 375);
  expect(step).not.toHaveBeenCalled();
});
it("uses the thirds only for presentations and opens the plan once on a spread", () => {
  const step = vi.fn(), plan = vi.fn(), g = touchNavigation(step, plan, true);
  g.down(p(30)); g.up(1, 375); g.down(p(185)); g.up(1, 375); g.down(p(330)); g.up(1, 375);
  expect(step.mock.calls).toEqual([["ArrowLeft"], ["ArrowRight"]]);
  g.down(p(100)); g.down(p(200, 100, 2)); g.move(p(250, 100, 2)); g.move(p(300, 100, 2)); g.up(1, 375); g.up(2, 375);
  expect(plan).toHaveBeenCalledOnce(); expect(step).toHaveBeenCalledTimes(2);
});
