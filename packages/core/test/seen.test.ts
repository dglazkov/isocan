import { describe, expect, it } from "vitest";
import type { Actor, Canvas, InboxEntry, SeenMarks } from "../src/index.ts";
import {
  advanceSeen,
  hasNew,
  latelyOrder,
  mergeSeen,
  movedSince,
  newSince,
} from "../src/seen.ts";

/**
 * `docs/research/2026-09-12-seen-marks.md`. What is held here is the merge
 * rule, because every property the feature promises falls out of it: a mark
 * that never goes backwards, two machines that converge, and a revisit that
 * counts even when nothing changed.
 */

const actor: Actor = { id: "usr_a", name: "Ada" };

const mark = (seq: number, at: string) => ({ seq, at });

describe("the merge", () => {
  it("never goes backwards on the seq", () => {
    const stale = advanceSeen(mark(12, "2026-09-12T10:00:00.000Z"), mark(4, "2026-09-12T10:05:00.000Z"));
    expect(stale.seq, "an old client holding a stale head cannot pull the mark back").toBe(12);
  });

  it("never goes backwards on the instant", () => {
    const out = advanceSeen(mark(3, "2026-09-12T10:05:00.000Z"), mark(9, "2026-09-12T09:00:00.000Z"));
    expect(out).toEqual({ seq: 9, at: "2026-09-12T10:05:00.000Z" });
  });

  it("converges however the two machines' writes are ordered", () => {
    const a = mark(7, "2026-09-12T10:00:00.000Z");
    const b = mark(4, "2026-09-12T11:00:00.000Z");
    expect(advanceSeen(advanceSeen(undefined, a), b)).toEqual(advanceSeen(advanceSeen(undefined, b), a));
  });

  it("is idempotent, so a replayed log entry changes nothing", () => {
    const once = advanceSeen(undefined, mark(5, "2026-09-12T10:00:00.000Z"));
    expect(advanceSeen(once, once)).toEqual(once);
  });

  it("moves the instant on a revisit that changed nothing — what lately is for", () => {
    const before = mark(5, "2026-09-12T10:00:00.000Z");
    const after = advanceSeen(before, mark(5, "2026-09-12T12:00:00.000Z"));
    expect(after).toEqual({ seq: 5, at: "2026-09-12T12:00:00.000Z" });
  });

  it("takes the further seq AND the later instant, not the newer row whole", () => {
    // The reason the two halves merge independently: a paired merge would
    // drop one machine's further-along seq because the other one's visit was
    // more recent.
    const out = advanceSeen(mark(30, "2026-09-12T09:00:00.000Z"), mark(2, "2026-09-12T18:00:00.000Z"));
    expect(out).toEqual({ seq: 30, at: "2026-09-12T18:00:00.000Z" });
  });

  it("folds two actors' ledgers into one person's", () => {
    // Multi-identity: a badge that claims both (which is what `actor.join`
    // required of it) reads one person's marks, with no migration.
    const wasDimitri2: SeenMarks = { prj_a: mark(9, "2026-09-11T10:00:00.000Z") };
    const isDimitri: SeenMarks = {
      prj_a: mark(4, "2026-09-12T10:00:00.000Z"),
      prj_b: mark(2, "2026-09-12T10:00:00.000Z"),
    };
    expect(mergeSeen(wasDimitri2, isDimitri)).toEqual({
      prj_a: { seq: 9, at: "2026-09-12T10:00:00.000Z" },
      prj_b: { seq: 2, at: "2026-09-12T10:00:00.000Z" },
    });
  });
});

describe("has anything happened here", () => {
  it("is a seq comparison, with no clock in it", () => {
    expect(hasNew(mark(5, "2026-09-12T10:00:00.000Z"), 6)).toBe(true);
    expect(hasNew(mark(5, "2026-09-12T10:00:00.000Z"), 5)).toBe(false);
  });

  it("says yes about a canvas you have never opened", () => {
    expect(hasNew(undefined, 0), "an unmarked canvas is entirely new").toBe(true);
  });

  it("reads a canvas row when there is no snapshot to hand", () => {
    const canvas = { id: "prj_a", updatedAt: "2026-09-12T11:00:00.000Z" } as Canvas;
    expect(movedSince(mark(5, "2026-09-12T10:00:00.000Z"), canvas)).toBe(true);
    expect(movedSince(mark(5, "2026-09-12T12:00:00.000Z"), canvas)).toBe(false);
  });
});

describe("what is new in the inbox", () => {
  const entry = (canvasId: string, createdAt: string): InboxEntry => ({
    canvasId,
    threadId: "thr_1",
    reason: "mentioned",
    comment: { id: `cmt_${createdAt}`, author: actor, body: "look at this", createdAt },
  });

  it("keeps what arrived after the mark and drops what came before", () => {
    const marks: SeenMarks = { prj_a: mark(3, "2026-09-12T10:00:00.000Z") };
    const entries = [
      entry("prj_a", "2026-09-12T09:00:00.000Z"),
      entry("prj_a", "2026-09-12T11:00:00.000Z"),
    ];
    expect(newSince(entries, marks).map((e) => e.comment.createdAt)).toEqual([
      "2026-09-12T11:00:00.000Z",
    ]);
  });

  it("treats a canvas with no mark as entirely new", () => {
    // The case a browser's localStorage structurally could not see: a mention
    // on a canvas this machine has never opened.
    const entries = [entry("prj_never_opened", "2026-09-12T09:00:00.000Z")];
    expect(newSince(entries, {})).toHaveLength(1);
  });

  it("is per canvas, so one canvas's mark says nothing about another's", () => {
    const marks: SeenMarks = { prj_a: mark(3, "2026-09-12T23:00:00.000Z") };
    const entries = [
      entry("prj_a", "2026-09-12T10:00:00.000Z"),
      entry("prj_b", "2026-09-12T10:00:00.000Z"),
    ];
    expect(newSince(entries, marks).map((e) => e.canvasId)).toEqual(["prj_b"]);
  });
});

describe("lately", () => {
  it("is the same fact, ordered by when you were there", () => {
    const marks: SeenMarks = {
      prj_old: mark(40, "2026-09-10T10:00:00.000Z"),
      prj_new: mark(2, "2026-09-12T10:00:00.000Z"),
      prj_mid: mark(9, "2026-09-11T10:00:00.000Z"),
    };
    expect(latelyOrder(marks).map((row) => row.canvasId)).toEqual(["prj_new", "prj_mid", "prj_old"]);
  });

  it("lists only canvases you have actually been on", () => {
    // "Lately" is where you HAVE been; everything else is the switcher's
    // ordinary `recent` order underneath.
    expect(latelyOrder({})).toEqual([]);
  });
});
