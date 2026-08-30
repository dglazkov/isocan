import { describe, expect, it } from "vitest";
import type { LogEntry } from "../src/ops.ts";
import { at, majorLine, majors, span, track, weightOf } from "../src/timeline.ts";

/**
 * `docs/research/2026-08-26-timeline.md`'s one firm rule: the significance
 * function belongs in core, pure — *"because the CLI must mark the same majors
 * the web does, or the two surfaces disagree about what mattered, which is the
 * one thing this architecture does not permit."*
 */
const entry = (
  seq: number,
  type: string,
  extra: Partial<LogEntry> = {},
  actor = "Kenny",
): LogEntry =>
  ({
    seq,
    envelope: {
      id: `op${seq}`,
      canvasId: "prj_a",
      actor: { id: "u", name: actor },
      ts: `2026-08-30T00:00:${String(seq).padStart(2, "0")}.000Z`,
      op: { type },
    },
    inverse: null,
    ...extra,
  }) as unknown as LogEntry;

describe("what counts as a seam", () => {
  it("structural change outranks churn", () => {
    // A run of forty moves is one ripple. Drawing it as forty ticks would make
    // the track unreadable exactly where the work was busiest.
    expect(weightOf(entry(1, "item.add"))).toBeGreaterThan(weightOf(entry(2, "item.move")));
    expect(weightOf(entry(3, "item.addVersion"))).toBeGreaterThan(weightOf(entry(4, "item.update")));
  });

  it("a first comment is a seam; a reply is the conversation continuing", () => {
    expect(weightOf(entry(1, "thread.create"))).toBeGreaterThan(weightOf(entry(2, "thread.reply")));
  });

  it("an op type nobody weighted is worth nothing, not something", () => {
    /**
     * Absent means zero deliberately: a new op type does not become a major by
     * being added to the vocabulary, it becomes one by somebody deciding it
     * is. Silence is the safe default for a track that would otherwise get
     * noisier every time the vocabulary grows.
     */
    expect(weightOf(entry(1, "some.future.op"))).toBe(0);
    expect(majors([entry(1, "some.future.op")])).toEqual([]);
  });

  it("picks the seams out of a stream of churn", () => {
    const log = [
      entry(1, "project.create"),
      entry(2, "item.move"),
      entry(3, "item.move"),
      entry(4, "item.add"),
      entry(5, "item.move"),
      entry(6, "thread.create"),
      entry(7, "item.update"),
    ];
    expect(majors(log).map((m) => m.seq)).toEqual([1, 4, 6]);
  });
});

describe("an undone entry is not a seam", () => {
  /**
   * It happened and then it did not. A track that ticks for both the doing and
   * the undoing tells a story that did not occur — and the pair is skipped
   * from BOTH ends, because the undo entry carries `cause` and the original
   * carries `undoneBy`.
   */
  it("skips the entry that was undone", () => {
    const log = [entry(1, "item.add", { undoneBy: 2 }), entry(3, "item.add")];
    expect(majors(log).map((m) => m.seq)).toEqual([3]);
  });

  it("and skips the undo itself", () => {
    const log = [entry(1, "item.add"), entry(2, "item.delete", { cause: { kind: "undo", targetSeq: 1 } })];
    expect(majors(log).map((m) => m.seq)).toEqual([1]);
  });
});

describe("the track", () => {
  const many = Array.from({ length: 120 }, (_, i) =>
    entry(i + 1, i % 40 === 0 ? "item.add" : "item.move"),
  );

  it("buckets by SEQ, so equal buckets are equal drag", () => {
    /**
     * Bucketing by wall-clock would make a night of nothing as wide as an
     * afternoon of work, which reads as a bug to the hand. Seq is the address
     * the scrubber moves along.
     */
    const t = track(many, 12);
    expect(t).toHaveLength(12);
    expect(t[0]!.fromSeq).toBe(1);
    expect(t[11]!.toSeq).toBe(120);
    // Contiguous: no seq falls between two buckets.
    for (let i = 1; i < t.length; i += 1) {
      expect(t[i]!.fromSeq).toBe(t[i - 1]!.toSeq + 1);
    }
  });

  it("counts every entry exactly once, undone ones included", () => {
    // Density is about effort, not about what survived.
    expect(track(many, 12).reduce((n, b) => n + b.count, 0)).toBe(120);
  });

  it("never draws more buckets than there are seqs", () => {
    // 60 slots over 12 ops is 48 empty columns, which reads as a gap in the
    // work rather than as a scale.
    expect(track(many.slice(0, 5), 60)).toHaveLength(5);
    expect(track([], 60)).toEqual([]);
  });

  it("puts each major in the bucket its seq falls in", () => {
    const t = track(many, 12);
    const placed = t.flatMap((b) => b.majors.map((m) => m.seq));
    expect(placed).toEqual([1, 41, 81]);
    for (const b of t) {
      for (const m of b.majors) {
        expect(m.seq).toBeGreaterThanOrEqual(b.fromSeq);
        expect(m.seq).toBeLessThanOrEqual(b.toSeq);
      }
    }
  });

  it("weights the bar by significance, not by count", () => {
    const busy = track([entry(1, "item.add"), entry(2, "item.move")], 1)[0]!;
    expect(busy.count).toBe(2);
    expect(busy.weight).toBeCloseTo(5.2);
  });
});

describe("saying it", () => {
  it("names who and what, because a track is read as a story", () => {
    expect(majorLine(majors([entry(7, "item.addVersion", {}, "Dion")])[0]!)).toBe(
      "7  Dion made a new version",
    );
  });

  it("falls back to the op type rather than inventing a phrase", () => {
    const m = { seq: 3, ts: "t", actor: "Kenny", kind: "thread.setMain", weight: 5 };
    expect(majorLine({ ...m, kind: "odd.op" })).toBe("3  Kenny odd.op");
  });
});

/**
 * **The canvas as it stood at a seq.**
 *
 * Real envelopes here rather than the `entry` helper above, because this is
 * the one part of the timeline that runs the actual reducer — a fabricated op
 * shape would test the fold against a canvas that could never exist.
 */
const real = (seq: number, op: Record<string, unknown>): LogEntry =>
  ({
    seq,
    envelope: {
      id: `op${seq}`,
      canvasId: "prj_a",
      actor: { id: "u", name: "Kenny" },
      ts: `2026-08-30T00:00:${String(seq).padStart(2, "0")}.000Z`,
      op,
    },
    inverse: null,
  }) as unknown as LogEntry;

const born = real(1, { type: "project.create", canvasId: "prj_a", title: "A canvas" });
const version = (id: string) => ({
  id,
  blobHash: "h".repeat(64),
  mimeType: "text/plain",
  filename: `${id}.txt`,
  size: 4,
});
const addOne = real(2, {
  type: "item.add",
  itemId: "itm_1",
  version: version("ver_1"),
  width: 10,
  height: 10,
  placement: { x: 0, y: 0 },
});
const addTwo = real(3, {
  type: "item.add",
  itemId: "itm_2",
  version: version("ver_2"),
  width: 10,
  height: 10,
  placement: { x: 20, y: 0 },
});

describe("the canvas as it stood at a seq", () => {
  const history = [born, addOne, addTwo];

  it("is nothing before it was born", () => {
    expect(at(history, 0)).toBeNull();
  });

  it("holds only what had happened by then", () => {
    expect(Object.keys(at(history, 1)!.canvas.items)).toHaveLength(0);
    expect(Object.keys(at(history, 2)!.canvas.items)).toHaveLength(1);
    expect(Object.keys(at(history, 3)!.canvas.items)).toHaveLength(2);
  });

  it("stops at the seq, not at the end of the log", () => {
    const early = at(history, 2);
    expect(Object.keys(early!.canvas.items)).toEqual(["itm_1"]);
  });

  it("past the end is simply the present", () => {
    /* A scrubber dropped at the far right asks for the last seq, and a seq
       beyond it is the same answer rather than an error — the track's right
       edge and 'now' are the same place. */
    expect(Object.keys(at(history, 999)!.canvas.items)).toHaveLength(2);
  });

  it("replays an undone entry, because at that seq it was still true", () => {
    /* `majors` skips both ends of an undo pair — a track that ticks for the
       doing AND the undoing tells a story that did not happen. That is about
       what to DRAW. This is about what was TRUE: before the undo landed, the
       undone thing was there, and a fold that skipped it would show a tidied
       past rather than the real one. */
    const undone = { ...addTwo, undoneBy: 4 } as unknown as LogEntry;
    const theUndo = {
      ...real(4, { type: "item.delete", itemId: "itm_2" }),
      cause: { kind: "undo", targetSeq: 3 },
    } as unknown as LogEntry;
    const withUndo = [born, addOne, undone, theUndo];
    expect(Object.keys(at(withUndo, 3)!.canvas.items)).toHaveLength(2);
    expect(Object.keys(at(withUndo, 4)!.canvas.items)).toHaveLength(1);
  });
});

describe("the span a scrubber moves over", () => {
  it("is the first and last entries there are", () => {
    expect(span([born, addOne, addTwo])).toEqual({ first: 1, last: 3 });
  });

  it("is null for an empty history, not a track with one end", () => {
    expect(span([])).toBeNull();
  });
});
