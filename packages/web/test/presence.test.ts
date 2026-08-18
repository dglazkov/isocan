import { describe, expect, it } from "vitest";
import { emptyCanvas, type Item, type PresenceSession } from "@isocan/core";
import { sessionLocus, spreadOverlaps } from "../src/lib/presence.ts";

function session(overrides: Partial<PresenceSession>): PresenceSession {
  return {
    sessionId: "s1",
    actor: { id: "a1", name: "Ada" },
    kind: "cli",
    scope: "project",
    label: null,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    lastSeen: new Date().toISOString(),
    ...overrides,
  };
}

describe("sessionLocus", () => {
  const canvas = emptyCanvas();
  canvas.items["i1"] = { id: "i1", x: 100, y: 200, width: 40, height: 20 } as Item;

  it("prefers the working item's center over the cursor", () => {
    const s = session({
      cursor: { x: 0, y: 0 },
      activity: { kind: "working", itemId: "i1" },
    });
    expect(sessionLocus(s, canvas)).toEqual({ x: 120, y: 210 });
  });

  it("uses a freestanding work point", () => {
    const s = session({ activity: { kind: "working", x: -50, y: 75 } });
    expect(sessionLocus(s, canvas)).toEqual({ x: -50, y: 75 });
  });

  it("falls back to the cursor when the working item is gone", () => {
    const s = session({
      cursor: { x: 7, y: 8 },
      activity: { kind: "working", itemId: "missing" },
    });
    expect(sessionLocus(s, canvas)).toEqual({ x: 7, y: 8 });
  });

  it("is null for a session with no place to stand (on call)", () => {
    expect(sessionLocus(session({ scope: "home" }), canvas)).toBeNull();
  });
});

describe("stacked cursors fan out", () => {
  const point = { x: 100, y: 200 };

  it("two sessions on one point are rendered apart, deterministically", () => {
    const spread = spreadOverlaps(
      new Map([
        ["ses_a", point],
        ["ses_b", point],
      ]),
    );
    const a = spread.get("ses_a")!;
    const b = spread.get("ses_b")!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(10);
    // Every client derives the same fan from the session ids alone.
    const again = spreadOverlaps(
      new Map([
        ["ses_a", point],
        ["ses_b", point],
      ]),
    );
    expect(again.get("ses_a")).toEqual(a);
    expect(again.get("ses_b")).toEqual(b);
  });

  it("a cursor alone on its point sits exactly on it", () => {
    const spread = spreadOverlaps(
      new Map([
        ["ses_a", point],
        ["ses_b", { x: 900, y: 900 }],
      ]),
    );
    expect(spread.get("ses_a")).toEqual(point);
    expect(spread.get("ses_b")).toEqual({ x: 900, y: 900 });
  });
});
