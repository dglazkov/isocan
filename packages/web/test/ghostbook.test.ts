import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIVE_DRAG_MAX_ROOTS, type PresenceDrag, type PresenceSession } from "@isocan/core";
import { GHOST_HOLD_MS, GhostBook } from "../src/lib/ghostbook.ts";

/**
 * The viewer's store of somebody else's drag (groups-by-hand phase 3) — the
 * resilience rules of docs/research/2026-10-01-groups-stacks-lift.md §4, each
 * as a behaviour: (a) cancel once the item has left `from`, whatever order
 * the op and the beat arrive in; (b) hold through the release race, then
 * settle, or glide home when no op comes; (c) glide home when the mover goes;
 * (d) a late joiner is shown where the drag IS, with nothing replayed.
 */

const ITEM = "itm_acme";
const FROM = { x: 100, y: 200 };

function face(drag?: Partial<PresenceDrag>, sessionId = "tab_mover"): PresenceSession {
  return {
    sessionId, actor: { id: "usr_mover", name: "Acme Mover" }, kind: "web", harness: null, label: null,
    cursor: { x: 0, y: 0 }, selection: [ITEM], status: null, statusSource: null, activity: null, onThread: null,
    lastSeen: "", via: null,
    ...(drag ? { drag: { gesture: "g1", roots: [ITEM], from: FROM, dx: 0, dy: 0, ...drag } } : {}),
  } as PresenceSession;
}

/** This screen's copy of the canvas: one item, wherever the test puts it. */
function canvasAt(x: number, y: number) {
  return (id: string) => (id === ITEM ? { x, y } : undefined);
}

const settle = (book: GhostBook, from: number, frames = 120) => {
  for (let i = 1; i <= frames; i++) book.step(from + i * 16);
};

describe("somebody else's drag, as this screen draws it", () => {
  it("follows the beat, easing toward the offset the mover sees", () => {
    const book = new GhostBook();
    book.update([face({ dx: 10, dy: 5 })], canvasAt(FROM.x, FROM.y), 0);
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 33);
    const ghost = book.ghosts.get("tab_mover")!;
    expect(ghost.phase).toBe("live");
    expect([ghost.tx, ghost.ty]).toEqual([60, 25]);
    book.step(40);
    // One frame of the cursor's lerp — between where it was and where it goes.
    expect(ghost.x).toBeGreaterThan(10);
    expect(ghost.x).toBeLessThan(60);
    settle(book, 40);
    expect([ghost.x, ghost.y]).toEqual([60, 25]);
  });

  it("(a) cancels when the move lands — the item is no longer at `from`", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    // The op lands BEFORE the beat that lets go: the item is at its new spot
    // while the beat still says "dragging".
    book.update([face({ dx: 60, dy: 25 })], canvasAt(160, 225), 10);
    expect(book.ghosts.size).toBe(0);
    // A late beat for the same drag does not bring it back.
    book.update([face({ dx: 61, dy: 25 })], canvasAt(160, 225), 20);
    expect(book.ghosts.size).toBe(0);
  });

  it("(a) cancels when somebody ELSE moves the item meanwhile — their move wins", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 }), face(undefined, "tab_other")], canvasAt(FROM.x, FROM.y), 0);
    expect(book.ghosts.size).toBe(1);
    book.update([face({ dx: 70, dy: 25 }), face(undefined, "tab_other")], canvasAt(400, 400), 30);
    expect(book.ghosts.size).toBe(0);
  });

  it("(a) an item that is gone from this screen draws no ghost", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], () => undefined, 0);
    expect(book.ghosts.size).toBe(0);
  });

  it("(b) holds the last offset through the release race, then settles where the op puts it", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    // The beat that lets go arrives first; the op is still on its way.
    book.update([face()], canvasAt(FROM.x, FROM.y), 100);
    const ghost = book.ghosts.get("tab_mover")!;
    expect(ghost.phase).toBe("hold");
    settle(book, 100, 30); // half a second of frames: no snap home
    expect([ghost.x, ghost.y]).toEqual([60, 25]);
    // The op lands: the item is where the ghost was drawing it, and the
    // ghost is gone in the same update — no frame offset twice.
    book.update([face()], canvasAt(160, 225), 600);
    expect(book.ghosts.size).toBe(0);
  });

  it("(b) glides home when no op comes within the hold — Esc, or a refused write", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    book.update([face()], canvasAt(FROM.x, FROM.y), 100);
    book.step(100 + GHOST_HOLD_MS - 1);
    expect(book.ghosts.get("tab_mover")!.phase).toBe("hold");
    book.step(100 + GHOST_HOLD_MS);
    const ghost = book.ghosts.get("tab_mover")!;
    expect(ghost.phase).toBe("home");
    // Gliding, not jumping: the first frame home is still most of the way out.
    expect(ghost.x).toBeGreaterThan(30);
    settle(book, 100 + GHOST_HOLD_MS);
    expect(book.ghosts.size).toBe(0);
  });

  it("(c) glides home when the mover's face goes — stale, or the tab closed mid-drag", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    book.update([], canvasAt(FROM.x, FROM.y), 50);
    const ghost = book.ghosts.get("tab_mover")!;
    expect(ghost.phase).toBe("home");
    expect([ghost.tx, ghost.ty]).toEqual([0, 0]);
    settle(book, 50);
    expect(book.ghosts.size).toBe(0);
  });

  it("(c) under reduced motion, home is immediate rather than a glide", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    book.update([], canvasAt(FROM.x, FROM.y), 50);
    book.step(66, true);
    expect(book.ghosts.size).toBe(0);
  });

  it("(d) a late joiner is shown where the drag IS — nothing eases in, nothing replays", () => {
    const book = new GhostBook();
    // This screen's first roster arrives mid-drag, 240px in.
    book.update([face({ dx: 240, dy: 90 }), face(undefined, "tab_idle")], canvasAt(FROM.x, FROM.y), 0);
    const ghost = book.ghosts.get("tab_mover")!;
    expect([ghost.x, ghost.y]).toEqual([240, 90]);
    book.step(16);
    expect([ghost.x, ghost.y]).toEqual([240, 90]);
    // A face that is not dragging has no ghost, and nothing of a drag that
    // ended before this screen arrived is kept anywhere to replay.
    expect(book.ghosts.has("tab_idle")).toBe(false);
    const late = new GhostBook();
    late.update([face()], canvasAt(160, 225), 0);
    expect(late.ghosts.size).toBe(0);
  });

  it("a new drag by the same hand replaces the old one, starting where it is", () => {
    const book = new GhostBook();
    book.update([face({ dx: 60, dy: 25 })], canvasAt(FROM.x, FROM.y), 0);
    book.update([face({ gesture: "g2", dx: -15, dy: 4 })], canvasAt(FROM.x, FROM.y), 100);
    const ghost = book.ghosts.get("tab_mover")!;
    expect(ghost.drag.gesture).toBe("g2");
    expect([ghost.x, ghost.y]).toEqual([-15, 4]);
  });
});

describe("the mover's side", () => {
  it("sends a box past the same number of roots the daemon will relay", () => {
    // The store spells the threshold out rather than importing it — the
    // import pulls the daemon's sanitizer into the first paint — so this is
    // what keeps the two from drifting apart.
    const store = readFileSync(new URL("../src/stores/canvasStore.ts", import.meta.url), "utf8");
    expect(store).toContain(`roots.length > ${LIVE_DRAG_MAX_ROOTS}`);
  });
});
