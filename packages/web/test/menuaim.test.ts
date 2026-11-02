import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIM_PAUSE, aimsAt, CLOSE_GRACE, menuAim, OPEN_DELAY } from "../src/lib/menuaim.ts";

/**
 * **A submenu forgives a diagonal** (1 Oct 2026). Dion moved from Style ›
 * toward its children, crossed the row below, and the children vanished. The
 * geometry is a triangle from where the pointer was to the submenu's near
 * corners; the timing is a beat before hover opens, a grace before it closes,
 * and a pause after which a pointer resting in the triangle is believed.
 * The journey `submenu-diagonal` drives the same thing with real mouse events.
 */

// A submenu to the right of a menu whose rows are 28px tall, Style at y 100–128.
const panel = { left: 300, right: 460, top: 95, bottom: 300 };

describe("aimsAt — the triangle", () => {
  it("takes a diagonal down-right toward the submenu", () => {
    expect(aimsAt({ x: 200, y: 114 }, { x: 210, y: 124 }, panel)).toBe(true);
  });
  it("takes a move toward the submenu's top corner", () => {
    expect(aimsAt({ x: 200, y: 114 }, { x: 220, y: 110 }, panel)).toBe(true);
  });
  it("refuses straight down — that is choosing another row", () => {
    expect(aimsAt({ x: 200, y: 114 }, { x: 200, y: 140 }, panel)).toBe(false);
  });
  it("refuses a move away from the submenu", () => {
    expect(aimsAt({ x: 200, y: 114 }, { x: 190, y: 120 }, panel)).toBe(false);
  });
  it("refuses a steep drop that would miss the submenu's bottom", () => {
    expect(aimsAt({ x: 200, y: 114 }, { x: 205, y: 300 }, panel)).toBe(false);
  });
  it("forgives a few px outside the edge, and no more", () => {
    // The top edge runs from (200,114) to (300,91); just above it, by 3px.
    expect(aimsAt({ x: 200, y: 114 }, { x: 250, y: 99.5 }, panel)).toBe(true);
    expect(aimsAt({ x: 200, y: 114 }, { x: 250, y: 90 }, panel)).toBe(false);
  });
  it("works mirrored, for a submenu flipped to the left", () => {
    const left = { left: 40, right: 196, top: 95, bottom: 300 };
    expect(aimsAt({ x: 260, y: 114 }, { x: 250, y: 124 }, left)).toBe(true);
    expect(aimsAt({ x: 260, y: 114 }, { x: 270, y: 124 }, left)).toBe(false);
  });
  it("is never aim from inside the submenu itself", () => {
    expect(aimsAt({ x: 350, y: 114 }, { x: 360, y: 124 }, panel)).toBe(false);
  });
});

describe("menuAim — keep the submenu, or switch the row", () => {
  let shown: (string | null)[];
  let rect: typeof panel | undefined;
  const make = () => menuAim((row) => { shown.push(row); rect = row ? panel : undefined; }, () => rect);

  beforeEach(() => { vi.useFakeTimers(); shown = []; rect = undefined; });
  afterEach(() => vi.useRealTimers());

  it("opens on hover only after a beat, so a sweep does not flash each one", () => {
    const aim = make();
    aim.want("Style");
    vi.advanceTimersByTime(OPEN_DELAY - 1);
    expect(shown).toEqual([]);
    aim.want("Align"); // swept on past
    vi.advanceTimersByTime(OPEN_DELAY);
    expect(shown).toEqual(["Align"]);
  });

  it("a click or a key opens at once", () => {
    const aim = make();
    aim.set("Style");
    expect(shown).toEqual(["Style"]);
  });

  it("leaving closes after a grace, and coming back cancels it", () => {
    const aim = make();
    aim.set("Style");
    aim.want(null);
    vi.advanceTimersByTime(CLOSE_GRACE - 1);
    aim.want("Style");
    vi.advanceTimersByTime(CLOSE_GRACE * 2);
    expect(shown).toEqual(["Style"]);
    aim.want(null);
    vi.advanceTimersByTime(CLOSE_GRACE);
    expect(shown).toEqual(["Style", null]);
  });

  it("a diagonal across the row below keeps the submenu, all the way in", () => {
    const aim = make();
    aim.set("Style");
    const path = Array.from({ length: 12 }, (_, i) => ({ x: 200 + i * 8, y: 114 + i * 3 }));
    for (const [i, at] of path.entries()) {
      if (i === 5) aim.want("Align"); // the pointer crosses into the row below
      expect(aim.move(at), `step ${i}`).toBe(i >= 5);
      vi.advanceTimersByTime(40);
    }
    aim.want("Style"); // it reached the children
    vi.advanceTimersByTime(AIM_PAUSE * 3);
    expect(shown).toEqual(["Style"]);
  });

  it("stopping inside the triangle hands the menu back to the row under it", () => {
    const aim = make();
    aim.set("Style");
    for (let i = 0; i < 4; i++) aim.move({ x: 200 + i * 8, y: 114 + i * 4 });
    aim.want("Align");
    vi.advanceTimersByTime(AIM_PAUSE - 1);
    expect(shown).toEqual(["Style"]);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual(["Style", "Align"]);
  });

  it("moving straight down switches rows after the ordinary beat", () => {
    const aim = make();
    aim.set("Style");
    for (let i = 0; i < 4; i++) aim.move({ x: 200, y: 110 + i * 6 });
    aim.want("Align");
    expect(aim.move({ x: 200, y: 136 })).toBe(false);
    vi.advanceTimersByTime(OPEN_DELAY);
    expect(shown).toEqual(["Style", "Align"]);
  });
});
