import { describe, expect, it } from "vitest";
import type { LogEntry, Operation } from "../src/index.ts";
import { buildRecap, emptyCanvas } from "../src/index.ts";
import { alice, bob, envelope, nv, seedState } from "./helpers.ts";

/**
 * The recap is an index into the history, not a replacement for it: windows
 * carry exact seq spans so `tail --archived` can replay any of them at full
 * resolution. What these tests pin down is the tiering arithmetic (resolution
 * halves with each step back), and that a summary says who, what, and about
 * which items — with titles resolved from live state when the item survives
 * and from the ops themselves when it does not.
 */

function entry(seq: number, op: Operation, actor = alice): LogEntry {
  return { seq, envelope: envelope(op, actor), inverse: null };
}

function moves(count: number, itemId = "itm_1", from = 1): LogEntry[] {
  return Array.from({ length: count }, (_, i) =>
    entry(from + i, { type: "item.move", itemId, x: i, y: i }),
  );
}

describe("buildRecap", () => {
  it("an empty history is an empty recap", () => {
    const recap = buildRecap([]);
    expect(recap).toEqual({ total: 0, archived: 0, windows: [], recent: [] });
  });

  it("a history shorter than the verbatim budget is all verbatim", () => {
    const entries = moves(4);
    const recap = buildRecap(entries, { verbatim: 10 });
    expect(recap.windows).toEqual([]);
    expect(recap.recent).toEqual(entries);
  });

  it("resolution halves with each step back, and the oldest window absorbs the remainder", () => {
    const entries = moves(20);
    const recap = buildRecap(entries, { verbatim: 2 });
    expect(recap.recent.map((e) => e.seq)).toEqual([19, 20]);
    // Behind the verbatim tier: a window of 4, then everything older in one —
    // a stub window of 2 behind a window of 8 would be noise pretending to be
    // a tier, so the last cut takes the lot.
    expect(recap.windows.map((w) => [w.fromSeq, w.toSeq])).toEqual([
      [1, 14],
      [15, 18],
    ]);
    expect(recap.windows.map((w) => w.count)).toEqual([14, 4]);
    expect(recap.total).toBe(20);
  });

  it("a window says who, how much conversation, and which items", () => {
    const entries: LogEntry[] = [
      entry(1, { type: "item.move", itemId: "itm_1", x: 0, y: 0 }),
      entry(
        2,
        {
          type: "thread.create",
          threadId: "thr_9",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_9", body: "hello" },
        },
        bob,
      ),
      entry(3, { type: "items.delete", itemIds: ["itm_1", "itm_2"] }),
      entry(4, {
        type: "items.move",
        moves: [
          { itemId: "itm_2", x: 5, y: 5 },
          { itemId: "itm_3", x: 6, y: 6 },
        ],
      }),
    ];
    // verbatim 0: everything lands in one summarized window.
    const recap = buildRecap(entries, { verbatim: 0, canvas: seedState().canvas });
    expect(recap.recent).toEqual([]);
    expect(recap.windows).toHaveLength(1);
    const w = recap.windows[0]!;
    expect(w.actors).toEqual([
      { name: "Alice", ops: 3 },
      { name: "Bob", ops: 1 },
    ]);
    expect(w.comments).toBe(1);
    expect(w.items.map((i) => i.id)).toEqual(["itm_1", "itm_2", "itm_3"]);
    // itm_1 is titled in the seed state; itm_3 exists nowhere and no op named it.
    expect(w.items[0]).toMatchObject({ id: "itm_1", title: "One", ops: 2 });
    expect(w.items.find((i) => i.id === "itm_3")!.title).toBeNull();
  });

  it("an item that no longer exists keeps the title its ops carried", () => {
    const entries: LogEntry[] = [
      entry(1, {
        type: "item.add",
        itemId: "itm_gone",
        version: nv("ver_g"),
        width: 10,
        height: 10,
        placement: { x: 0, y: 0 },
        title: "Farewell note",
      }),
      entry(2, { type: "item.delete", itemId: "itm_gone" }),
    ];
    const recap = buildRecap(entries, { verbatim: 0, canvas: emptyCanvas() });
    expect(recap.windows[0]!.items).toEqual([{ id: "itm_gone", title: "Farewell note", ops: 2 }]);
  });

  it("carries the archived count through untouched", () => {
    const recap = buildRecap(moves(3), { archived: 2 });
    expect(recap.archived).toBe(2);
  });
});
