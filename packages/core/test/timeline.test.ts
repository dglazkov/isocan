import { describe, expect, it } from "vitest";
import type { LogEntry } from "../src/ops.ts";
import { at, axisGrain, axisTicks, majorLine, majors, past, span, track, weightOf } from "../src/timeline.ts";

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
    const m = { seq: 3, ts: "t", actor: "Kenny", kind: "thread.setMain", weight: 5, itemId: null, about: null };
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

/**
 * **The axis: a date under the bars, at the grain the span deserves.**
 */
describe("the date axis", () => {
  /**
   * An entry at an explicit moment — the axis is entirely about time, so the
   * helper above (which packs seq into seconds) cannot express these.
   *
   * **Local, at midday, on purpose.** The axis reads a timestamp in the
   * reader's own timezone, because "the day I did that" is a local fact and an
   * axis in UTC would put a Denver evening on the following day. That makes a
   * test written with `Z` timestamps machine-dependent: `2025-08-01T00:00Z` is
   * 31 July here and 1 August in Berlin, and the first version of the year
   * test duly failed with `Jul 2025`. So these are built from local
   * components, at noon, where no offset on earth can move the date.
   */
  const on = (seq: number, y: number, m: number, d: number, h = 12): LogEntry =>
    at_(seq, new Date(y, m - 1, d, h).toISOString());
  const at_ = (seq: number, iso: string): LogEntry =>
    ({
      seq,
      envelope: { id: `op${seq}`, canvasId: "prj_a", actor: { id: "u", name: "Kenny" }, ts: iso, op: { type: "item.add" } },
      inverse: null,
    }) as unknown as LogEntry;

  it("picks the grain from the span, not from a preference", () => {
    expect(axisGrain(6 * 3600_000)).toBe("hour");
    expect(axisGrain(9 * 24 * 3600_000)).toBe("day");
    expect(axisGrain(300 * 24 * 3600_000)).toBe("month");
    expect(axisGrain(6 * 365 * 24 * 3600_000)).toBe("year");
  });

  it("ticks where the unit turns over, not at even intervals", () => {
    /* Three entries on one day and one the next is TWO ticks, not four —
       the axis marks changes, which is what makes it readable at sixty
       columns. */
    const log = [on(1, 2026, 8, 19, 9), on(2, 2026, 8, 19, 11), on(3, 2026, 8, 19, 15), on(9, 2026, 8, 27, 10)];
    const ticks = axisTicks(log);
    expect(ticks.map((t) => t.label)).toEqual(["19 Aug", "27 Aug"]);
  });

  it("places a tick by SEQ, because the rail is laid out by seq", () => {
    /* A long quiet gap must not become a season of empty rail. The second
       day is 8 of 8 seqs along, so its tick sits at the far end. */
    const log = [on(1, 2026, 8, 19, 9), on(9, 2026, 8, 27, 10)];
    expect(axisTicks(log).map((t) => t.at)).toEqual([0, 1]);
  });

  it("says which year once the span crosses one", () => {
    /* "Aug" alone is a lie on a canvas that has seen two Augusts. */
    const log = [on(1, 2025, 8, 1), on(40, 2026, 2, 1)];
    const labels = axisTicks(log).map((t) => t.label);
    expect(labels[0]).toBe("Aug 2025");
    expect(labels.at(-1)).toBe("Feb 2026");
  });

  it("thins to the cap but keeps both ends", () => {
    /* An axis missing its ends gives no sense of the whole, which is the
       only reason to draw one. */
    const log = Array.from({ length: 40 }, (_, i) =>
      on(i + 1, 2026, 1 + Math.floor(i / 20), (i % 20) + 1),
    );
    const ticks = axisTicks(log, 5);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks[0]!.seq).toBe(1);
    expect(ticks.at(-1)!.seq).toBe(40);
  });

  it("has nothing to say about an empty log", () => {
    expect(axisTicks([])).toEqual([]);
  });
});

describe("a bucket knows when it was", () => {
  it("carries the first and last moment that fell in it", () => {
    /* The rail is laid out by seq and stays that way; the timestamps are so a
       surface can put a date under it without re-walking the log. */
    const log = [entry(1, "item.add"), entry(2, "item.add"), entry(3, "item.add")];
    const [only] = track(log, 1);
    expect(only!.fromTs).toBe("2026-08-30T00:00:01.000Z");
    expect(only!.toTs).toBe("2026-08-30T00:00:03.000Z");
  });

  it("leaves an empty bucket saying null rather than guessing", () => {
    const log = [entry(1, "item.add"), entry(20, "item.add")];
    const empty = track(log, 10).filter((b) => b.count === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const b of empty) expect(b.fromTs).toBeNull();
  });
});

describe("the axis reaches both ends", () => {
  const on2 = (seq: number, y: number, m: number, d: number, h = 12): LogEntry =>
    ({
      seq,
      envelope: { id: `op${seq}`, canvasId: "prj_a", actor: { id: "u", name: "K" },
        ts: new Date(y, m - 1, d, h).toISOString(), op: { type: "item.add" } },
      inverse: null,
    }) as unknown as LogEntry;

  it("ends at the last entry, not at the last time the day turned", () => {
    /* The final day begins early and runs on. Without an end tick the axis
       stopped where that day STARTED, two thirds along, and the reader could
       not tell what the right-hand end of the rail meant. */
    const log = [on2(1, 2026, 8, 18, 9), on2(2, 2026, 8, 20, 9), on2(30, 2026, 8, 20, 18)];
    const ticks = axisTicks(log);
    expect(ticks.at(-1)!.at).toBe(1);
    expect(ticks.at(-1)!.seq).toBe(30);
  });

  it("does not print the same day twice to do it", () => {
    /* The dropped one is the turn, not the end: they are the same day and the
       one that belongs at the edge is the edge. */
    const log = [on2(1, 2026, 8, 18, 9), on2(2, 2026, 8, 20, 9), on2(30, 2026, 8, 20, 18)];
    const labels = axisTicks(log).map((t) => t.label);
    expect(labels).toEqual([...new Set(labels)]);
    expect(labels).toEqual(["18 Aug", "20 Aug"]);
  });

  it("starts at the first entry", () => {
    const log = [on2(5, 2026, 8, 18, 9), on2(40, 2026, 8, 25, 9)];
    expect(axisTicks(log)[0]!.at).toBe(0);
  });
});

describe("ticks do not overprint each other", () => {
  const on3 = (seq: number, y: number, m: number, d: number, h = 12): LogEntry =>
    ({
      seq,
      envelope: { id: `op${seq}`, canvasId: "prj_a", actor: { id: "u", name: "K" },
        ts: new Date(y, m - 1, d, h).toISOString(), op: { type: "item.add" } },
      inverse: null,
    }) as unknown as LogEntry;

  it("drops a middle tick that cannot fit beside its neighbour", () => {
    /* Measured on a real history: "24 Aug" and "30 Aug" landed within a few
       pixels and printed as "24 A30 Aug". Three days crammed into two seqs at
       the start, then a long tail. */
    const log = [on3(1, 2026, 8, 1), on3(2, 2026, 8, 2), on3(3, 2026, 8, 3), on3(100, 2026, 9, 1)];
    const ticks = axisTicks(log);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]!.at - ticks[i - 1]!.at).toBeGreaterThanOrEqual(0.08);
    }
  });

  it("keeps both ends even when everything is crowded", () => {
    /* The ends are the reason the axis exists; a crowded middle is not a
       reason to lose the extent. */
    const log = [on3(1, 2026, 8, 1), on3(2, 2026, 8, 2), on3(3, 2026, 8, 3)];
    const ticks = axisTicks(log);
    expect(ticks[0]!.at).toBe(0);
    expect(ticks.at(-1)!.at).toBe(1);
  });
});

/**
 * **A canvas that collected a bad op before the check existed.**
 *
 * `4e70304` made the reducer refuse non-finite geometry, which fixed the
 * write side of #76 and left the read side worse: the oplog is append-only,
 * so a `"x": null` written three weeks earlier is still there, and replaying
 * from nothing throws on it. Measured on this repo's own canvas — opening the
 * history and scrubbing to the start took the whole app white.
 */
describe("replaying a history that predates the checks", () => {
  const poisoned = (seq: number, op: Record<string, unknown>): LogEntry =>
    ({
      seq,
      envelope: { id: `op${seq}`, canvasId: "prj_a", actor: { id: "u", name: "K" },
        ts: `2026-08-30T00:00:${String(seq).padStart(2, "0")}.000Z`, op },
      inverse: null,
    }) as unknown as LogEntry;

  const log = () => [
    poisoned(1, { type: "project.create", canvasId: "prj_a", title: "P" }),
    poisoned(2, { type: "item.add", itemId: "itm_1", version: { id: "v1", kind: "text", body: "hi" },
      width: 10, height: 10, placement: { x: 0, y: 0 } }),
    // Accepted before the check existed; refused now.
    poisoned(3, { type: "item.move", itemId: "itm_1", x: null, y: null }),
    poisoned(4, { type: "item.move", itemId: "itm_1", x: 40, y: 50 }),
  ];

  it("does not throw, where it used to take the surface down with it", () => {
    expect(() => past(log(), 4)).not.toThrow();
  });

  it("keeps replaying past the bad entry", () => {
    /* The op after it is good and must still land — stopping at the poison
       would truncate the history at a three-week-old accident. */
    const { state } = past(log(), 4);
    const item = state?.canvas.items["itm_1"];
    expect(item && [item.x, item.y]).toEqual([40, 50]);
  });

  it("names what it could not replay, rather than quietly showing less", () => {
    /* A shorter history with no explanation is the instrument reporting
       healthy while blind — the failure this repo keeps finding. */
    const { skipped } = past(log(), 4);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.seq).toBe(3);
    expect(skipped[0]!.kind).toBe("item.move");
    expect(skipped[0]!.why).toMatch(/finite number/);
  });

  it("says nothing about a healthy canvas", () => {
    const clean = [log()[0]!, log()[1]!, log()[3]!];
    expect(past(clean, 4).skipped).toEqual([]);
  });

  it("still answers `at` for callers with nothing to say", () => {
    expect(at(log(), 4)?.canvas.items["itm_1"]?.x).toBe(40);
  });
});
