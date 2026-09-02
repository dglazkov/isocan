import { describe, expect, it } from "vitest";
import { undoneSeqs, type LogEntry } from "../src/index.ts";

/**
 * The guard on a fold that two callers depend on, and whose failure mode is
 * silence: if this returned an empty map, `chooseRetained` would cut an undo
 * loose from its target and `buildCorpus` would report that nobody has ever
 * undone anything. Both would look fine.
 */

const ACTOR = { id: "usr_di", name: "Di" };

function entry(seq: number, cause?: LogEntry["cause"]): LogEntry {
  return {
    seq,
    envelope: {
      id: `op_${seq}`,
      canvasId: "prj_1",
      actor: ACTOR,
      ts: `2026-08-01T10:0${seq}:00.000Z`,
      op: { type: "item.move", itemId: "itm_a", x: seq, y: seq },
    },
    inverse: null,
    ...(cause ? { cause } : {}),
  };
}

describe("which ops still stand", () => {
  it("marks an op undone by the entry that reversed it", () => {
    const log = [entry(1), entry(2, { kind: "undo", targetSeq: 1 })];
    expect([...undoneSeqs(log)]).toEqual([[1, 2]]);
  });

  it("a redo puts it back", () => {
    const log = [entry(1), entry(2, { kind: "undo", targetSeq: 1 }), entry(3, { kind: "redo", targetSeq: 1 })];
    expect(undoneSeqs(log).size).toBe(0);
  });

  it("takes the last word when it is undone, redone and undone again", () => {
    // Order matters, and it is log order. A map built by any other traversal
    // would answer this one wrong while passing both cases above.
    const log = [
      entry(1),
      entry(2, { kind: "undo", targetSeq: 1 }),
      entry(3, { kind: "redo", targetSeq: 1 }),
      entry(4, { kind: "undo", targetSeq: 1 }),
    ];
    expect([...undoneSeqs(log)]).toEqual([[1, 4]]);
  });

  it("leaves ordinary entries alone", () => {
    expect(undoneSeqs([entry(1), entry(2)]).size).toBe(0);
  });
});
