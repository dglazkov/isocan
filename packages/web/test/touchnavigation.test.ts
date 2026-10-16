import { expect, it, vi } from "vitest";
import { touchNavigation } from "../src/lib/touchnavigation.ts";
import { appSheets, rules, selectorsOf } from "./cssrules.ts";
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
/**
 * **The swipe has to reach the face, through every scroller on the way.**
 *
 * `touch-action` narrows from an element to its descendants, but a scroll
 * container re-enables every pan for itself and everything inside it. So the
 * node's `pan-y` stopped at `.phone-artifact` (it scrolls): a sideways swipe
 * over a picture, or over the "…" while text loads, was the browser's pan, the
 * pointer was cancelled, and the walk never moved (14 Oct 2026, found by
 * `scripts/mobile-journeys.mjs` failing now and then, on the placeholder). A
 * face that scrolls itself (a design system) did the same one level down, on
 * the node and on a phone's slide alike. So each scroller between the finger
 * and the recognizer says pan-y itself, and so does whatever face fills it.
 */
it("gives every scroller the swipe crosses its own pan-y", () => {
  const panY = (file: string, selector: string) => {
    const sheet = appSheets.find((s) => s.file === `packages/web/src/${file}`);
    const rule = sheet && rules(sheet.text).find((r) => selectorsOf(r).includes(selector) && !r.at.some((at) => /print/.test(at)));
    expect(rule, `${selector} has no rule in ${file}`).toBeTruthy();
    return /touch-action:\s*pan-y/.test(rule!.body);
  };
  for (const [file, selector] of [
    ["components/phone.css", ".phone-node"],
    ["components/phone.css", ".phone-artifact"],
    ["components/phone.css", ".phone-artifact > *"],
    ["components/phone.css", ".phone-node .md-view"],
    ["styles.css", ".fullscreen-stage"],
    ["components/presentation.css", ".touch-presenting .fullscreen-stage > *"],
    ["components/presentation.css", ".fullscreen-stage .md-view"],
  ] as const) expect(panY(file, selector), `${selector} lets the browser take a sideways swipe`).toBe(true);
});
