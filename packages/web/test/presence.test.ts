/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from "vitest";
import { emptyCanvas, type Item, type PresenceSession } from "@isocan/core";
import {
  type CursorAnim,
  dampFactor,
  MAX_AGENT_SPEED,
  MAX_WANDER_SPEED,
  nextWorkingWaypoint,
  otherTabSessionIds,
  sessionLocus,
  sessionWorkingBounds,
  sessionWorkingKey,
  SNAP_DISTANCE,
  spreadOverlaps,
  stepCursorAnim,
} from "../src/lib/presence.ts";
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
    statusSource: null,
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

  it("targets the anchored or referenced item when working on a thread", () => {
    const c = emptyCanvas();
    const actor = { id: "usr_1", name: "Acme" };
    c.items["itm_yellow"] = {
      id: "itm_yellow",
      x: 200,
      y: 100,
      width: 800,
      height: 80,
      versions: [{ id: "v1", blobHash: "h1", mimeType: "text/html", filename: "a.html", size: 1, createdAt: "", createdBy: actor }],
      currentVersionId: "v1",
    } as Item;
    c.threads["thr_main"] = {
      id: "thr_main",
      x: 500,
      y: 600,
      anchorItemId: null,
      main: true,
      comments: [{ id: "c1", author: actor, body: "Fix the yellow box", items: ["itm_yellow"], createdAt: "" }],
      createdAt: "",
      createdBy: actor,
    };
    const s = session({ activity: { kind: "working", threadId: "thr_main" } });
    expect(sessionWorkingBounds(s, c)).toEqual({ x: 200, y: 100, width: 800, height: 80 });
    expect(sessionLocus(s, c)).toEqual({ x: 600, y: 140 });
  });
});

describe("nextWorkingWaypoint", () => {
  it("keeps every waypoint strictly inside the item bounds (including short wide banners)", () => {
    const banner = { x: 200, y: 100, width: 900, height: 72 };
    let pos = { x: 650, y: 136 };
    let seq = 0;
    const rng = () => {
      seq = (seq * 1664525 + 1013904223) >>> 0;
      return seq / 0x100000000;
    };
    for (let i = 0; i < 60; i++) {
      const step = nextWorkingWaypoint(banner, pos, rng);
      expect(step.tx).toBeGreaterThanOrEqual(banner.x + 12);
      expect(step.tx).toBeLessThanOrEqual(banner.x + banner.width - 12);
      expect(step.ty).toBeGreaterThanOrEqual(banner.y + 10);
      expect(step.ty).toBeLessThanOrEqual(banner.y + banner.height - 18);
      expect(step.dwellMs).toBeGreaterThan(250);
      pos = { x: step.tx, y: step.ty };
    }
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

describe("otherTabSessionIds", () => {
  it("marks any remote session belonging to the current viewport's actor (including joined identities or same name)", () => {
    const self = { id: "usr_acme", name: "Acme" };
    const sessions = [
      session({ sessionId: "s_other_tab", kind: "web", actor: { id: "usr_acme", name: "Acme" } }),
      session({ sessionId: "s_joined_tab", kind: "web", actor: { id: "usr_acme_2", name: "Old Acme" } }),
      session({ sessionId: "s_peer", kind: "web", actor: { id: "usr_ada", name: "Ada" } }),
    ];
    const marked = otherTabSessionIds(sessions, self, {}, { usr_acme_2: "usr_acme" });
    expect([...marked]).toEqual(["s_other_tab", "s_joined_tab"]);
  });

  it("marks older duplicate-named remote tabs while keeping the most recently active one unmarked", () => {
    const sessions = [
      session({
        sessionId: "s_older",
        kind: "web",
        actor: { id: "usr_ada", name: "Ada" },
        lastSeen: "2026-09-29T12:00:00.000Z",
      }),
      session({
        sessionId: "s_newer",
        kind: "web",
        actor: { id: "usr_ada", name: "Ada" },
        lastSeen: "2026-09-29T12:05:00.000Z",
      }),
    ];
    const marked = otherTabSessionIds(sessions, { id: "usr_acme", name: "Acme" });
    expect([...marked]).toEqual(["s_older"]);
  });
});

describe("stepCursorAnim", () => {
  const seeded = (seed = 1) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  };

  it("never loops or teleports inside wide items (> 2 * SNAP_DISTANCE)", () => {
    const huge = { x: 4000, y: 2000, width: SNAP_DISTANCE * 3, height: SNAP_DISTANCE * 2 };
    const home = { x: huge.x + huge.width / 2, y: huge.y + huge.height / 2 };
    const rng = seeded(7);
    let rec: CursorAnim | undefined;
    let now = 1000;
    const dt = 1000 / 60;
    const maxStep = MAX_WANDER_SPEED * (dt / 1000) + 1e-6;

    for (let i = 0; i < 600; i++) {
      const prevX = rec?.x;
      const prevY = rec?.y;
      const res = stepCursorAnim(rec, {
        home,
        workingBounds: huge,
        workingKey: "item:itm_huge",
        kind: "cli",
        nowMs: now,
        dtMs: dt,
        rng,
      });
      rec = res.rec;
      if (prevX !== undefined && prevY !== undefined) {
        expect(Math.hypot(rec.x - prevX, rec.y - prevY)).toBeLessThanOrEqual(maxStep);
      }
      expect(rec.x).toBeGreaterThanOrEqual(huge.x);
      expect(rec.x).toBeLessThanOrEqual(huge.x + huge.width);
      expect(rec.y).toBeGreaterThanOrEqual(huge.y);
      expect(rec.y).toBeLessThanOrEqual(huge.y + huge.height);
      now += dt;
    }
  });

  it("is frame-rate invariant across 60Hz, 120Hz, and 240Hz", () => {
    const runAt = (hz: number) => {
      const dt = 1000 / hz;
      let rec: CursorAnim | undefined = {
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        nextAt: 0,
        dwellMs: 0,
        workingKey: null,
      };
      let now = 1000;
      const steps = Math.round(0.5 * hz);
      for (let i = 0; i < steps; i++) {
        const res = stepCursorAnim(rec, {
          home: { x: 350, y: 150 },
          kind: "cli",
          nowMs: now,
          dtMs: dt,
        });
        rec = res.rec;
        now += dt;
      }
      return { x: rec.x, y: rec.y };
    };
    const at60 = runAt(60);
    const at120 = runAt(120);
    const at240 = runAt(240);
    expect(Math.hypot(at60.x - at120.x, at60.y - at120.y)).toBeLessThan(1.5);
    expect(Math.hypot(at60.x - at240.x, at60.y - at240.y)).toBeLessThan(1.5);
    expect(dampFactor(0.1, 1000 / 60)).toBeCloseTo(0.1, 6);
  });

  it("caps commuting agent speed and resets dwell immediately when target item switches", () => {
    const itemA = { x: 100, y: 100, width: 400, height: 300 };
    const itemB = { x: 900, y: 100, width: 400, height: 300 };
    // Force a thinking pause on itemA (roll < 0.22 -> 0.05) with long dwell
    let { rec } = stepCursorAnim(undefined, {
      home: { x: 300, y: 250 },
      workingBounds: itemA,
      workingKey: sessionWorkingKey({ kind: "working", itemId: "itm_a" }),
      kind: "cli",
      nowMs: 1000,
      dtMs: 16,
      rng: () => 0.05,
    });
    // Dwelling in place: zero jitter, moved === false
    const paused = stepCursorAnim(rec, {
      home: { x: 300, y: 250 },
      workingBounds: itemA,
      workingKey: sessionWorkingKey({ kind: "working", itemId: "itm_a" }),
      kind: "cli",
      nowMs: 1016,
      dtMs: 16,
      rng: () => 0.05,
    });
    expect(paused.moved).toBe(false);
    expect([paused.rec.x, paused.rec.y]).toEqual([300, 250]);

    // Switch working target to itemB (800px away, within SNAP_DISTANCE): moves immediately without waiting on dwell
    const switched = stepCursorAnim(paused.rec, {
      home: { x: 1100, y: 250 },
      workingBounds: itemB,
      workingKey: sessionWorkingKey({ kind: "working", itemId: "itm_b" }),
      kind: "cli",
      nowMs: 1032,
      dtMs: 16,
      rng: () => 0.5,
    });
    expect(switched.moved).toBe(true);
    const stepDist = Math.hypot(switched.rec.x - 300, switched.rec.y - 250);
    expect(stepDist).toBeGreaterThan(0);
    expect(stepDist).toBeLessThanOrEqual(MAX_AGENT_SPEED * (16 / 1000) + 1e-6);
  });
});
