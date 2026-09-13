import { describe, expect, it } from "vitest";

import { PEEK_CAP, PEEK_MARGIN, peekPlacement } from "../src/lib/peekplace.ts";

/**
 * **The peek fits the window it opens in.** Found by driving a real browser
 * at 800×300 (2026-09-09): a card at 98–213 opened its preview upward with
 * the stylesheet's fixed 240px cap and the box ran from −94 to 99 — 94px of
 * it above the viewport, unreadable. These are the same numbers, run against
 * the function the component now calls.
 */
describe("peekPlacement", () => {
  it("opens below with the stylesheet's cap when the room allows it", () => {
    const p = peekPlacement(100, 300, 900);
    expect(p.up).toBe(false);
    expect(p.maxHeight).toBe(PEEK_CAP);
    /* And it fits: bottom edge stays inside the window. */
    expect(300 + p.maxHeight).toBeLessThanOrEqual(900);
  });

  it("the measured failure: a short window clamps the upward peek to the room above", () => {
    const p = peekPlacement(98.39, 213.19, 300);
    expect(p.up).toBe(true);
    /* Room above the card, less the margin — far under the old 240 cap. */
    expect(p.maxHeight).toBeCloseTo(98.39 - PEEK_MARGIN);
    /* The whole box is on screen: top edge at the margin, not at −94. */
    expect(98.39 - p.maxHeight).toBeCloseTo(PEEK_MARGIN);
    expect(p.maxHeight).toBeLessThan(PEEK_CAP);
  });

  it("still opens below when above is tighter, and clamps to the room below", () => {
    const p = peekPlacement(40, 250, 300);
    expect(p.up).toBe(false);
    expect(p.maxHeight).toBe(300 - 250 - PEEK_MARGIN);
    expect(250 + p.maxHeight).toBeLessThanOrEqual(300 - PEEK_MARGIN);
  });

  it("never exceeds the stylesheet's cap, however tall the window", () => {
    expect(peekPlacement(2000, 2100, 5000).maxHeight).toBe(PEEK_CAP);
    expect(peekPlacement(10, 20, 4000).maxHeight).toBe(PEEK_CAP);
  });

  it("never goes negative on a card the window cannot hold at all", () => {
    const p = peekPlacement(4, 400, 300);
    expect(p.maxHeight).toBe(0);
  });
});
