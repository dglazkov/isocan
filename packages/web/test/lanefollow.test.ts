import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanvasContents, CommentThread } from "@isocan/core";
import { FOLLOW_EVERY_MS, nextFollow } from "../src/lib/lanefollow.ts";

/**
 * **The one feature that moves the camera without being asked each time.**
 *
 * Every test here is a reason to STAY PUT, because a canvas that wanders
 * while somebody is working on it is the worst thing this feature can do —
 * worse by a distance than missing an arrival. The rules are a function
 * rather than an effect precisely so they can be argued with here.
 */
const fable = { id: "usr_fable", name: "Fable" };
const version = (id: string, at: string) => ({
  id,
  blobHash: id,
  mimeType: "text/html",
  filename: `${id}.html`,
  size: 1,
  createdAt: at,
  createdBy: fable,
});
const canvasWith = (itemId: string, at: string): CanvasContents =>
  ({
    items: {
      [itemId]: {
        id: itemId,
        title: itemId,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        versions: [version(`${itemId}_v1`, at)],
        currentVersionId: `${itemId}_v1`,
        createdAt: at,
        createdBy: fable,
        updatedAt: at,
        updatedBy: fable,
        description: "",
        properties: {},
      },
    },
    threads: {},
  }) as unknown as CanvasContents;

const said = (itemId: string, at: string): CommentThread =>
  ({
    id: "thr_1",
    comments: [{ id: "c1", author: fable, body: "made it", items: [itemId], createdAt: at }],
  }) as unknown as CommentThread;

const idle = { lastItemId: null, lastAtMs: 0 };
const now = { on: true, busy: false, nowMs: 1_000_000 };

describe("follow moves only when it should", () => {
  it("flies to what a message just made", () => {
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    expect(nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), idle, now)).toBe("itm_a");
  });

  it("does nothing at all when it is off", () => {
    // Off by default and a mode somebody chooses. This is the whole contract.
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    expect(
      nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), idle, { ...now, on: false }),
    ).toBeNull();
  });

  it("stays put while a hand is down", () => {
    /**
     * A pan or a drag beats follow outright. And the move is DROPPED, not
     * deferred — a camera that lurches the instant you release the mouse is
     * worse than one that missed a message, because it happens exactly when
     * somebody was concentrating on placing something.
     */
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    const thread = said("itm_a", "2026-08-01T10:00:00Z");
    expect(nextFollow(canvas, thread, idle, { ...now, busy: true })).toBeNull();
    // …and having skipped it, it does not fire on the next tick either: the
    // arrival is gone, not queued.
    const after = { lastItemId: "itm_a", lastAtMs: now.nowMs };
    expect(nextFollow(canvas, thread, after, now)).toBeNull();
  });

  it("does not re-fly to where the camera already is", () => {
    // The common case on every re-render, every reconnect, every snapshot
    // that arrives twice. Without this, follow mode is a camera that shakes.
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    const state = { lastItemId: "itm_a", lastAtMs: 0 };
    expect(nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), state, now)).toBeNull();
  });

  it("throttles a burst into one flight", () => {
    // An agent saving five versions in ten seconds is one arrival worth
    // seeing, not five journeys across the canvas.
    const canvas = canvasWith("itm_b", "2026-08-01T10:00:30Z");
    const thread = said("itm_b", "2026-08-01T10:00:00Z");
    const justWent = { lastItemId: "itm_a", lastAtMs: now.nowMs - FOLLOW_EVERY_MS + 1 };
    expect(nextFollow(canvas, thread, justWent, now)).toBeNull();
    const longEnough = { lastItemId: "itm_a", lastAtMs: now.nowMs - FOLLOW_EVERY_MS };
    expect(nextFollow(canvas, thread, longEnough, now)).toBe("itm_b");
  });

  it("stays put when a message made nothing", () => {
    // Most messages are conversation. Following one would fly the camera to
    // wherever the last made thing happened to be, which is a move with no
    // cause a person could point at.
    const canvas = canvasWith("itm_a", "2026-07-01T09:00:00Z"); // predates the message
    expect(nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), idle, now)).toBeNull();
  });

  it("stays put on a canvas with no Chat at all", () => {
    expect(nextFollow(canvasWith("itm_a", "2026-08-01T10:00:30Z"), null, idle, now)).toBeNull();
  });
});

/**
 * The decision above is pure. This is the wiring, which is where a correct
 * rule can still be connected to the wrong thing.
 */
describe("follow is wired to the mode, and to nothing else", () => {
  const panel = readFileSync(
    fileURLToPath(new URL("../src/components/MainThreadPanel.tsx", import.meta.url)),
    "utf8",
  );

  it("is off by default, because it moves the canvas for you", () => {
    const store = readFileSync(
      fileURLToPath(new URL("../src/stores/uiStore.ts", import.meta.url)),
      "utf8",
    );
    expect(store).toMatch(/laneFollow: false,/);
  });

  it("counts a pan or a drag as busy", () => {
    // Both, not one. A drag moves the item; a pan moves the world. Either is a
    // hand down, and follow yields to a hand.
    expect(panel).toMatch(/busy: panning \|\| drag !== null/);
  });

  it("asks the pure decision rather than deciding in the effect", () => {
    expect(panel).toMatch(/nextFollow\(canvas, thread, state\.current/);
    expect(panel, "no second opinion about what is new").not.toMatch(/laneOf\(/);
  });

  it("reveals rather than centring, so a thing in view does not move", () => {
    // The same conditional flight a dropped file gets: if what arrived is
    // already in front of you, the camera stays exactly where it is.
    const hook = panel.slice(panel.indexOf("function useLaneFollow"), panel.indexOf("export function MainThreadBody"));
    expect(hook).toMatch(/revealItem\(go\)/);
    expect(hook).not.toMatch(/centerOn\(/);
  });

  it("is a different thing from following a person, and says so", () => {
    // `followSessionId` follows somebody's CURSOR. Sharing a name with this
    // would make "stop following" ambiguous in a room where both are on.
    expect(panel).toMatch(/main-follow/);
    const store = readFileSync(
      fileURLToPath(new URL("../src/stores/uiStore.ts", import.meta.url)),
      "utf8",
    );
    expect(store).toMatch(/Distinct\s+\*\s+from `followSessionId`/);
  });
});
