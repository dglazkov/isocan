import { describe, expect, it } from "vitest";
import { railPan } from "../src/lib/railpan.ts";
import { RAIL_INSET, STRIP_WIDTH, type DockState, railSpan } from "../src/lib/stage.ts";

/**
 * **The camera moves on the person's behalf here, which is why every case is
 * written down.**
 *
 * Opening the rail used to cover whatever you were reading. Now the canvas
 * slides by exactly the strip the rail occupies, so what you were looking at
 * comes out from under it — and closing gives the pan back.
 *
 * A pan nobody asked for is disorienting when it is wrong, so "how far" has
 * to be exact rather than approximately right: too little and the thing you
 * were reading is still half-covered, too much and the canvas lurches past
 * it. The distance is `dockEdges`, the same derivation framing uses, so the
 * two can never disagree about one rail.
 */
const dock = (over: Partial<DockState> = {}): DockState => ({
  mainPanelOpen: false,
  filesPanelOpen: false,
  agentsPanelOpen: false,
  trashOpen: false,
  marksOpen: false,
  panelWidth: 320,
  ...over,
});

describe("opening the rail pans the canvas by what the rail takes", () => {
  it("pans right by the ground the rail gains when the Chat opens", () => {
    const dx = railPan(dock(), dock({ mainPanelOpen: true }));
    // NOT the whole rail: the shut rail is a 48px strip, not nothing, so
    // opening it only takes the DIFFERENCE. Panning by the full width would
    // overshoot by 48 and throw what you were reading past the far edge.
    expect(dx).toBe(railSpan(320) - railSpan(STRIP_WIDTH));
    // The inset cancels, because both the open rail and the shut strip are
    // inset by it — which is only true while that stays so, and is asserted
    // here rather than assumed so that changing one inset fails loudly.
    expect(dx).toBe(320 - STRIP_WIDTH);
    expect(RAIL_INSET).toBeGreaterThan(0);
  });

  it("gives exactly that pan back when it closes", () => {
    const open = dock({ mainPanelOpen: true });
    expect(railPan(open, dock())).toBe(-(320 - STRIP_WIDTH));
    // There and back is zero: a person who opens and closes the Chat is
    // looking at precisely what they were looking at before, not 40px off.
    expect(railPan(dock(), open) + railPan(open, dock())).toBe(0);
  });

  it("does not twitch when one rail replaces the other", () => {
    // Chat → Files is the case that would betray a naive implementation:
    // something closed and something opened, but the strip never changed
    // width, so the right pan is none at all.
    const chat = dock({ mainPanelOpen: true });
    const files = dock({ filesPanelOpen: true });
    expect(railPan(chat, files)).toBe(0);
    expect(railPan(files, chat)).toBe(0);
  });

  it("pans by the difference when the rail is widened, not by the new width", () => {
    const before = dock({ mainPanelOpen: true, panelWidth: 320 });
    const after = dock({ mainPanelOpen: true, panelWidth: 396 });
    expect(railPan(before, after)).toBe(76);
  });

  it("moves nothing when a CLOSED rail's width changes", () => {
    // Restoring a remembered width, or a clamp on a narrow window, must not
    // move a canvas whose rail is shut: a closed rail occupies nothing, so
    // there is nothing to compensate for.
    expect(railPan(dock({ panelWidth: 320 }), dock({ panelWidth: 500 }))).toBe(0);
  });

  it("ignores the docks on the other side", () => {
    // The trash and the marks dock take from the RIGHT. They are not the
    // rail, they do not move the left edge, and a pan for them would be the
    // canvas sliding for a panel that never covered what you were reading.
    const before = dock({ mainPanelOpen: true });
    expect(railPan(before, { ...before, trashOpen: true })).toBe(0);
    expect(railPan(before, { ...before, marksOpen: true })).toBe(0);
  });

  it("is symmetric for any sequence that ends where it started", () => {
    // Open, widen, swap to Files, narrow, close. Whatever route somebody
    // takes through the rail, ending shut must leave the camera where it
    // began — a drift of a few pixels per cycle is the bug that makes people
    // say the canvas "wanders".
    const start = dock();
    const steps = [
      dock({ mainPanelOpen: true }),
      dock({ mainPanelOpen: true, panelWidth: 420 }),
      dock({ filesPanelOpen: true, panelWidth: 420 }),
      dock({ filesPanelOpen: true, panelWidth: 300 }),
      start,
    ];
    let total = 0;
    let prev = start;
    for (const next of steps) {
      total += railPan(prev, next);
      prev = next;
    }
    expect(total).toBe(0);
  });
});
