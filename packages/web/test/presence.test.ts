import { describe, expect, it } from "vitest";
import { emptyCanvas, type Item, type PresenceSession } from "@isocan/core";
import { sessionLocus, spreadOverlaps } from "../src/lib/presence.ts";
import { sessionName } from "../src/lib/names.ts";

function session(overrides: Partial<PresenceSession>): PresenceSession {
  return {
    sessionId: "s1",
    actor: { id: "a1", name: "Ada" },
    kind: "cli",
    harness: null,
    label: null,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    onThread: null,
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

  it("is null for a session that has not stood anywhere yet", () => {
    expect(sessionLocus(session({}), canvas)).toBeNull();
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

/**
 * A session's `label` is a display OVERRIDE and it is usually absent — one
 * exists only when somebody passed `--label`. The item's "working here" chip
 * built its key with a template string, so an absent label became the literal
 * "null" and the canvas said **null is working** over the item. That is every
 * agent that ever ran `isocan session start` without a label, which is nearly
 * all of them, and it was found in a screenshot rather than by a test.
 */
describe("who is working here", () => {
  // The real function the chip calls, not a restatement of it. The first
  // version of this guard defined `nameOf` in the test file and asserted
  // against that — four green assertions about code that shipped nowhere. It
  // had already drifted: the local copy used `names[id] ?? actor.name`, which
  // hands back a blank registry name where the app hands back the stamped one.
  const names = { usr_1: "Di" };

  it("falls back to the actor's name when there is no label", () => {
    expect(sessionName({}, session({ actor: { id: "usr_1", name: "Fable" } }))).toBe("Fable");
  });

  it("never renders the word null", () => {
    expect(sessionName({}, session({ actor: { id: "usr_1", name: "Fable" } }))).not.toBe("null");
    // Nor through any other absence: the chip is built by interpolation, and
    // every one of these used to land in it verbatim.
    expect(sessionName({ usr_1: "" }, session({ actor: { id: "usr_1", name: "Fable" } }))).toBe("Fable");
    expect(sessionName({}, session({ label: "   ", actor: { id: "usr_1", name: "Fable" } }))).toBe("Fable");
  });

  it("prefers a rename over the name stamped on the session", () => {
    expect(sessionName(names, session({ actor: { id: "usr_1", name: "Dion 2" } }))).toBe("Di");
  });

  it("still lets an explicit label win", () => {
    expect(sessionName(names, session({ label: "deploy bot", actor: { id: "usr_1", name: "Fable" } }))).toBe(
      "deploy bot",
    );
  });
});
