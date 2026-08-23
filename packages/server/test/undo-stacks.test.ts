import { describe, expect, it } from "vitest";
import type { LogEntry, Operation } from "@isocan/core";
import { UndoStacks } from "../src/undo.ts";

/**
 * The undo stacks, on their own.
 *
 * Everything here is also exercised through the daemon in `daemon.test.ts`,
 * over HTTP, against a real store — which is the right place to prove that
 * undo *works*. It is the wrong place to prove that the stack keeps its
 * contract, for one reason found by breaking it: `discardUndoTarget` is the
 * only thing that advances `Engine.undo`'s `for (;;)`, so a version of it
 * that does not actually remove the seq does not fail a test, it WEDGES the
 * single-writer queue and hangs the run. A hang is a worse signal than a red
 * test — nobody can tell it from a slow machine — and the difference between
 * the two is whether the contract is asserted here, in microseconds, or only
 * implied three layers up.
 *
 * The invariant these all serve: a stack belongs to ONE actor. Nothing an
 * actor does may put another actor's op within reach of their ⌘Z.
 */

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };

const noop: Operation = { type: "item.move", itemId: "itm_1", x: 0, y: 0 };

function entry(
  seq: number,
  actor: { id: string; name: string },
  extra: Partial<LogEntry> = {},
): LogEntry {
  return {
    seq,
    envelope: { id: `op_${seq}`, projectId: "prj_1", actor, ts: "", op: noop },
    inverse: noop,
    ...extra,
  };
}

const undoEntry = (seq: number, actor: typeof alice, targetSeq: number): LogEntry =>
  entry(seq, actor, { cause: { kind: "undo", targetSeq } });
const redoEntry = (seq: number, actor: typeof alice, targetSeq: number): LogEntry =>
  entry(seq, actor, { cause: { kind: "redo", targetSeq } });

describe("UndoStacks", () => {
  it("hands each actor only their own ops, newest first", () => {
    const stacks = UndoStacks.rebuild([
      entry(1, alice),
      entry(2, bob),
      entry(3, alice),
      entry(4, bob),
    ]);
    expect(stacks.nextUndoTarget(alice.id)).toBe(3);
    expect(stacks.nextUndoTarget(bob.id)).toBe(4);
    // An actor who has done nothing has nothing to undo — not somebody else's op.
    expect(stacks.nextUndoTarget("usr_carol")).toBeNull();
  });

  it("never lets one actor's undo reach another's op, however deep the interleave", () => {
    const entries: LogEntry[] = [];
    for (let seq = 1; seq <= 20; seq += 1) entries.push(entry(seq, seq % 2 === 0 ? bob : alice));
    const stacks = UndoStacks.rebuild(entries);

    // Alice undoes everything she has; every target must be one of hers.
    for (let n = 0; n < 10; n += 1) {
      const target = stacks.nextUndoTarget(alice.id);
      expect(target, "Alice ran out of her own ops early").not.toBeNull();
      expect(target! % 2, `seq ${target} is Bob's`).toBe(1);
      stacks.record(undoEntry(100 + n, alice, target!));
    }
    // And then she has nothing left, while Bob is untouched.
    expect(stacks.nextUndoTarget(alice.id)).toBeNull();
    expect(stacks.nextUndoTarget(bob.id)).toBe(20);
  });

  it("an undo moves its target from the undo stack to the redo stack", () => {
    const stacks = UndoStacks.rebuild([entry(1, alice), entry(2, alice)]);
    stacks.record(undoEntry(3, alice, 2));
    expect(stacks.nextUndoTarget(alice.id)).toBe(1);
    expect(stacks.nextRedoTarget(alice.id)).toEqual({ targetSeq: 2, undoSeq: 3 });
    // …and a redo moves it back.
    stacks.record(redoEntry(4, alice, 2));
    expect(stacks.nextUndoTarget(alice.id)).toBe(2);
    expect(stacks.nextRedoTarget(alice.id)).toBeNull();
  });

  it("a fresh op truncates only its own actor's redo branch", () => {
    const stacks = UndoStacks.rebuild([entry(1, alice), entry(2, bob)]);
    stacks.record(undoEntry(3, alice, 1));
    stacks.record(undoEntry(4, bob, 2));
    stacks.record(entry(5, alice));

    expect(stacks.nextRedoTarget(alice.id)).toBeNull();
    expect(stacks.nextRedoTarget(bob.id)).toEqual({ targetSeq: 2, undoSeq: 4 });
  });

  it("a fresh NON-undoable op still truncates the redo branch", () => {
    // It changed state the redo chain assumed, so the branch is no longer real.
    const stacks = UndoStacks.rebuild([entry(1, alice)]);
    stacks.record(undoEntry(2, alice, 1));
    stacks.record(entry(3, alice, { inverse: null }));
    expect(stacks.nextRedoTarget(alice.id)).toBeNull();
    // …and it is not itself offered as something to undo.
    expect(stacks.nextUndoTarget(alice.id)).toBeNull();
  });

  it("discarding a candidate REMOVES it — the engine's loop terminates on this", () => {
    const stacks = UndoStacks.rebuild([entry(1, alice), entry(2, alice), entry(3, alice)]);
    // Walk the whole stack by discarding, the way Engine.undo does when every
    // stored inverse has been invalidated by somebody else. It must run out.
    const seen: number[] = [];
    for (let guard = 0; guard < 10; guard += 1) {
      const target = stacks.nextUndoTarget(alice.id);
      if (target === null) break;
      expect(seen, `discardUndoTarget handed back ${target} twice — Engine.undo would spin`).not.toContain(
        target,
      );
      seen.push(target);
      stacks.discardUndoTarget(alice.id, target);
    }
    expect(seen).toEqual([3, 2, 1]);
    expect(stacks.nextUndoTarget(alice.id)).toBeNull();

    // The same for redo.
    const redo = UndoStacks.rebuild([entry(1, alice), entry(2, alice)]);
    redo.record(undoEntry(3, alice, 2));
    redo.record(undoEntry(4, alice, 1));
    const seenRedo: number[] = [];
    for (let guard = 0; guard < 10; guard += 1) {
      const next = redo.nextRedoTarget(alice.id);
      if (next === null) break;
      expect(seenRedo, "discardRedoTarget handed back a seq twice").not.toContain(next.targetSeq);
      seenRedo.push(next.targetSeq);
      redo.discardRedoTarget(alice.id, next.targetSeq);
    }
    expect(seenRedo).toEqual([1, 2]);
  });

  it("discarding one actor's candidate leaves the other actor's stack alone", () => {
    const stacks = UndoStacks.rebuild([entry(1, alice), entry(2, bob)]);
    stacks.discardUndoTarget(alice.id, 1);
    expect(stacks.nextUndoTarget(alice.id)).toBeNull();
    expect(stacks.nextUndoTarget(bob.id)).toBe(2);
    // Discarding a seq that is not this actor's is a no-op, not a theft.
    stacks.discardUndoTarget(alice.id, 2);
    expect(stacks.nextUndoTarget(bob.id)).toBe(2);
  });

  it("rebuilds the same stacks from the log as it had in memory", () => {
    const log = [
      entry(1, alice),
      entry(2, bob),
      entry(3, alice),
      undoEntry(4, alice, 3),
      entry(5, bob),
      undoEntry(6, bob, 5),
    ];
    const live = new UndoStacks();
    for (const e of log) live.record(e);
    const rebuilt = UndoStacks.rebuild(log);

    for (const actor of [alice, bob]) {
      expect(rebuilt.nextUndoTarget(actor.id)).toBe(live.nextUndoTarget(actor.id));
      expect(rebuilt.nextRedoTarget(actor.id)).toEqual(live.nextRedoTarget(actor.id));
    }
    expect(rebuilt.nextUndoTarget(alice.id)).toBe(1);
    expect(rebuilt.nextRedoTarget(bob.id)).toEqual({ targetSeq: 5, undoSeq: 6 });
  });
});
