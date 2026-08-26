import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CanvasContents, CommentThread, Item } from "@isocan/core";
import { anchorOffset } from "@isocan/core";
import { itemThread } from "../src/components/CommentLayer.tsx";
import { DRAG_SLOP, pastSlop } from "../src/lib/gesture.ts";

/**
 * A comment tied to an item is not a pin that happens to be near it. It has a
 * fixed address (the item's top-right corner), ⇧C reopens it rather than
 * minting another there, and it cannot be dragged off that address — while a
 * pin dropped on open canvas marks a place somebody chose and moves freely.
 */

const actor = { id: "usr_a", name: "A" };

const item = (id: string, width = 200, height = 150): Item => ({
  id,
  x: 0,
  y: 0,
  width,
  height,
  title: "Thing",
  description: "",
  properties: {},
  versions: [],
  currentVersionId: "",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
});

const thread = (
  id: string,
  x: number,
  y: number,
  anchorItemId: string | null,
  createdAt = "2026-08-26T10:00:00.000Z",
  main = false,
): CommentThread => ({
  id,
  x,
  y,
  anchorItemId,
  comments: [],
  ...(main ? { main: true } : {}),
  createdAt,
  createdBy: actor,
});

const canvasOf = (threads: CommentThread[], items: Item[]): CanvasContents => ({
  items: Object.fromEntries(items.map((one) => [one.id, one])),
  threads: Object.fromEntries(threads.map((one) => [one.id, one])),
  trash: [],
});

describe("one item, one conversation", () => {
  const box = item("itm_1");
  const corner = anchorOffset(box);

  it("finds the thread ⇧C should reopen instead of starting a second", () => {
    const existing = thread("thr_1", corner.x, corner.y, "itm_1");
    expect(itemThread(canvasOf([existing], [box]), "itm_1")?.id).toBe("thr_1");
  });

  it("has nothing to open on an item nobody has talked about", () => {
    expect(itemThread(canvasOf([], [box]), "itm_1")).toBe(null);
    // A pin near the item but anchored to NOTHING is a place, not a
    // conversation about this thing.
    const loose = thread("thr_loose", 205, 5, null);
    expect(itemThread(canvasOf([loose], [box]), "itm_1")).toBe(null);
  });

  it("prefers the corner thread when the item also carries a placed one", () => {
    // A thread dropped mid-item in comment mode is ABOUT that spot; ⇧C must
    // not hijack it, even though it was there first.
    const placed = thread("thr_spot", 90, 70, "itm_1", "2026-08-26T09:00:00.000Z");
    const atCorner = thread("thr_corner", corner.x, corner.y, "itm_1", "2026-08-26T11:00:00.000Z");
    expect(itemThread(canvasOf([placed, atCorner], [box]), "itm_1")?.id).toBe("thr_corner");
  });

  it("answers the same as people talk — oldest first among equals", () => {
    const older = thread("thr_old", corner.x, corner.y, "itm_1", "2026-08-26T09:00:00.000Z");
    const newer = thread("thr_new", corner.x, corner.y, "itm_1", "2026-08-26T12:00:00.000Z");
    expect(itemThread(canvasOf([newer, older], [box]), "itm_1")?.id).toBe("thr_old");
  });

  it("never offers the main thread, which is a panel and has no pin", () => {
    const main = thread("thr_main", 0, 0, "itm_1", "2026-08-26T08:00:00.000Z", true);
    expect(itemThread(canvasOf([main], [box]), "itm_1")).toBe(null);
  });

  it("ignores another item's conversation", () => {
    const other = thread("thr_other", 0, 0, "itm_2");
    expect(itemThread(canvasOf([other], [box, item("itm_2")]), "itm_1")).toBe(null);
  });
});

describe("what may be dragged, and what may not", () => {
  const source = readFileSync(
    new URL("../src/components/CommentLayer.tsx", import.meta.url),
    "utf8",
  );

  it("moves only a pin anchored to nothing", () => {
    // The rule itself: an item-anchored pin sits at that item's corner
    // because that is its address, and an address you can drag away is not
    // one — ⇧C would stop finding it.
    expect(source).toContain("const movable = !thread.anchorItemId;");
    // And the guards that make it true rather than merely stated.
    expect(source).toMatch(/if \(!movable \|\| e\.button !== 0\) return;/);
  });

  it("sends a real op, so a move is undoable like everything else", () => {
    // `thread.setAnchor` carries its own inverse (core/invert.ts), which is
    // the whole reason a plain drag needs no modifier to be safe.
    expect(source).toMatch(/type: "thread\.setAnchor"/);
  });

  it("converts the drag by the zoom — the pin is screen, the op is world", () => {
    expect(source).toMatch(/\(e\.clientX - start\.x\) \/ scale/);
    expect(source).toMatch(/\(e\.clientY - start\.y\) \/ scale/);
  });

  it("keeps click-to-open and drag-to-move from stealing each other", () => {
    expect(source).toContain("pastSlop(dx, dy)");
    // A press that travelled must not also open the thread on release.
    expect(source).toMatch(/if \(dragged\.current\) \{/);
  });
});

describe("the drag threshold, spelled once", () => {
  it("is radial, so a diagonal nudge is no more tolerant than a straight one", () => {
    expect(pastSlop(DRAG_SLOP, 0)).toBe(true);
    expect(pastSlop(0, DRAG_SLOP)).toBe(true);
    // 3 and 3 is 4.24 away — past the threshold, though NEITHER axis is. A
    // per-axis test would still call this a click, which is the tolerance
    // being 41% wider on the diagonal than straight ahead.
    expect(pastSlop(3, 3)).toBe(true);
    expect(pastSlop(2, 2)).toBe(false); // 2.83 — genuinely inside
    expect(pastSlop(0, 0)).toBe(false);
  });

  it("is the number ItemView uses too, from the same module", () => {
    const itemView = readFileSync(
      new URL("../src/components/ItemView.tsx", import.meta.url),
      "utf8",
    );
    expect(itemView).toContain('from "../lib/gesture.ts"');
    // Not its own copy: two thresholds is two bargains.
    expect(itemView).not.toMatch(/const DRAG_SLOP\s*=/);
  });
});
