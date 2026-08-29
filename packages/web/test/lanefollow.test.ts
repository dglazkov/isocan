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
const di = { id: "usr_di", name: "Di" };
const version = (id: string, at: string, by = fable) => ({
  id,
  blobHash: id,
  mimeType: "text/html",
  filename: `${id}.html`,
  size: 1,
  createdAt: at,
  createdBy: by,
});
const oneItem = (itemId: string, at: string, by = fable) =>
  ({
        id: itemId,
        title: itemId,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        versions: [version(`${itemId}_v1`, at, by)],
        currentVersionId: `${itemId}_v1`,
        createdAt: at,
        createdBy: by,
        updatedAt: at,
        updatedBy: by,
        description: "",
        properties: {},
  }) as unknown as CanvasContents["items"][string];

const canvasOf = (items: Record<string, unknown>): CanvasContents =>
  ({ items, threads: {} }) as unknown as CanvasContents;

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
const now = { actorId: fable.id, busy: false, nowMs: 1_000_000 };

describe("follow moves only when it should", () => {
  it("flies to what a message just made", () => {
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    expect(nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), idle, now)).toBe("itm_a");
  });

  it("does nothing at all when nobody is being followed", () => {
    // Off by default and a mode somebody chooses. This is the whole contract.
    const canvas = canvasWith("itm_a", "2026-08-01T10:00:30Z");
    expect(
      nextFollow(canvas, said("itm_a", "2026-08-01T10:00:00Z"), idle, { ...now, actorId: null }),
    ).toBeNull();
  });

  it("follows ONE agent, and ignores what anybody else makes", () => {
    /**
     * The reason this moved off the Chat. The Chat is the canvas-wide
     * channel, so a toggle there meant "fly to whatever ANYBODY just made" —
     * with three agents working, a camera yanked between unrelated corners.
     *
     * Follow needs a subject you can name. Somebody else's work is now not a
     * missed flight, it is not this follow's business.
     */
    const canvas = canvasOf({
      itm_a: oneItem("itm_a", "2026-08-01T10:00:30Z", fable),
      itm_b: oneItem("itm_b", "2026-08-01T10:10:30Z", di),
    });
    const t = {
      id: "thr_1",
      comments: [
        { id: "c1", author: fable, body: "made it", items: ["itm_a"], createdAt: "2026-08-01T10:00:00Z" },
        { id: "c2", author: di, body: "and this", items: ["itm_b"], createdAt: "2026-08-01T10:10:00Z" },
      ],
    } as unknown as CommentThread;
    // Following Fable: their item, not Di's — even though Di's is newer.
    expect(nextFollow(canvas, t, idle, now)).toBe("itm_a");
    // And following Di gets Di's.
    expect(nextFollow(canvas, t, idle, { ...now, actorId: di.id })).toBe("itm_b");
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
describe("follow is wired to an agent, and to nothing else", () => {
  const panel = readFileSync(
    fileURLToPath(new URL("../src/components/MainThreadPanel.tsx", import.meta.url)),
    "utf8",
  );
  const tray = readFileSync(
    fileURLToPath(new URL("../src/components/AgentTray.tsx", import.meta.url)),
    "utf8",
  );
  const store = readFileSync(
    fileURLToPath(new URL("../src/stores/uiStore.ts", import.meta.url)),
    "utf8",
  );

  it("is off by default, because it moves the canvas for you", () => {
    expect(store).toMatch(/followingActorId: null,/);
  });

  it("is chosen on an agent, not on the room", () => {
    // The Chat's header no longer carries it: a toggle there followed
    // whatever anybody made, which is not a subject.
    expect(panel, "the Chat header must not own follow").not.toMatch(/main-follow/);
    expect(tray).toMatch(/setFollowingActor\(/);
  });

  it("follows one agent at a time", () => {
    // Following two is following neither — the camera would be handed back
    // and forth between whichever of them saved last, which is the exact
    // incoherence that took this off the Chat.
    expect(tray).toMatch(/following === row\.actorId \? null : row\.actorId/);
  });

  it("offers nothing in the workbench, which covers the canvas", () => {
    /**
     * `AgentRowView` is shared. The workbench passes neither prop, so no
     * control appears there — a camera flying around underneath a screen you
     * cannot see is motion with no audience, and a toggle offering it would
     * be a promise the room cannot keep.
     */
    const wb = readFileSync(
      fileURLToPath(new URL("../src/components/Workbench.tsx", import.meta.url)),
      "utf8",
    );
    const call = /<AgentRowView[\s\S]*?\/>/.exec(wb)?.[0] ?? "";
    expect(call, "the workbench renders a row").not.toBe("");
    expect(call).not.toMatch(/onFollow/);
    expect(/<AgentRowView[\s\S]*?\/>/.exec(tray)?.[0] ?? "").toMatch(/onFollow/);
  });

  it("counts a pan or a drag as busy", () => {
    // Both, not one. A drag moves the item; a pan moves the world. Either is
    // a hand down, and follow yields to a hand.
    expect(panel).toMatch(/busy: panning \|\| drag !== null/);
  });

  it("asks the pure decision rather than deciding in the effect", () => {
    expect(panel).toMatch(/nextFollow\(canvas, thread, state\.current/);
    expect(panel, "no second opinion about what is new").not.toMatch(/laneOf\(/);
  });

  it("reveals rather than centring, so a thing in view does not move", () => {
    const hook = panel.slice(panel.indexOf("function useLaneFollow"), panel.indexOf("export function MainThreadBody"));
    expect(hook).toMatch(/revealItem\(go\)/);
    expect(hook).not.toMatch(/centerOn\(/);
  });

  it("is a different thing from following a person, and says so", () => {
    // `followSessionId` follows somebody's CURSOR — where they are looking.
    // This follows what they MAKE. Sharing a name would make "stop
    // following" ambiguous in a room where both are on.
    expect(store).toMatch(/follows a person's CURSOR/);
  });
});
