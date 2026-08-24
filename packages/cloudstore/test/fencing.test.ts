import { describe, expect, it } from "vitest";
import type { LogEntry, Operation } from "@isocan/core";
import { OplogFencedError } from "@isocan/core";
import { seed } from "../../../test/conformance/store-conformance.ts";
import { opsCollection, padSeq } from "../src/naming.ts";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { MemoryObjects } from "./memory-objects.ts";

/**
 * Two writers, one oplog — the disaster the whole design forbids, and the
 * only reason the cloud backing is safe under a rolling deploy.
 *
 * Neither test here HOPES. The first is deterministic by construction: it is
 * a pure function of two writers' beliefs about `lastSeq`, with no timing in
 * it at all, and it is the failure that actually happens in production — a
 * draining instance that booted before the new one and writes after it. The
 * second is a genuine race, so it asserts the INVARIANT (exactly one
 * succeeded, exactly one was refused) rather than the outcome (which one),
 * because asserting the outcome of a race is how a flaky test is born.
 */

const gate = cloudGate();

if (!gate.ok && requireEmulator()) {
  describe("oplog fencing", () => {
    it("the Firestore emulator is REQUIRED here and is not available", () => {
      throw new Error(`ISOCAN_REQUIRE_EMULATOR=1, but the fencing suite cannot run: ${gate.skip}.`);
    });
  });
} else {
  const test = gate.ok ? it : it.skip;
  const title = gate.ok
    ? "oplog fencing — the create-only precondition"
    : `oplog fencing — the create-only precondition [SKIPPED: ${gate.skip}]`;

  describe(title, () => {
    /** Two CloudStores over the SAME storage: two instances of one home,
     * which is exactly what a rollout produces. */
    const twoWriters = async () => {
      const objects = new MemoryObjects();
      const a = makeCloudStore({ objects });
      const b = makeCloudStore({ objects, projectId: a.projectId });
      return {
        a,
        b,
        done: async () => {
          await a.store.close();
          await b.store.close();
        },
      };
    };

    test("the stale writer loses, and knows exactly what it lost", async () => {
      const { a, b, done } = await twoWriters();
      try {
        await seed(a.store); // seqs 1..3, written by A
        // B boots and believes lastSeq is 3 — because at the moment it read,
        // it was. No timing here: this is the two beliefs, side by side.
        const bView = await b.store.load("prj_1");
        expect(bView!.lastSeq).toBe(3);

        // A writes seq 4. B still believes 4 is free.
        await a.store.appendLog("prj_1", move(4, 10, 10));
        const refusal = await b.store.appendLog("prj_1", move(4, 99, 99)).catch((err) => err);

        expect(refusal).toBeInstanceOf(OplogFencedError);
        expect((refusal as OplogFencedError).code).toBe("writer-fenced");
        expect((refusal as OplogFencedError).canvasId).toBe("prj_1");
        expect((refusal as OplogFencedError).seq).toBe(4);

        // A's entry is the one that is there — the loser wrote nothing.
        const doc = await a.firestore.collection(opsCollection("prj_1")).doc(padSeq(4)).get();
        const stored = JSON.parse(doc.data()!["json"] as string) as LogEntry;
        expect((stored.envelope.op as { x: number }).x).toBe(10);
        expect(doc.data()!["writer"]).toBe(a.store.writerId);
      } finally {
        await done();
      }
    });

    test("and then RE-SYNCS: the loser's next append succeeds at the right seq", async () => {
      const { a, b, done } = await twoWriters();
      try {
        await seed(a.store);
        await a.store.appendLog("prj_1", move(4, 10, 10));
        await expect(b.store.appendLog("prj_1", move(4, 99, 99))).rejects.toBeInstanceOf(
          OplogFencedError,
        );

        // A fence that leaves the loser permanently stuck is not a re-sync.
        // B re-reads, learns the truth, and numbers itself from there.
        const resynced = await b.store.load("prj_1");
        expect(resynced!.lastSeq).toBe(4);
        await b.store.appendLog("prj_1", move(resynced!.lastSeq + 1, 7, 7));

        const entries = (await a.store.load("prj_1"))!.entries;
        expect(entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
        expect((entries[4]!.envelope.op as { x: number }).x).toBe(7);
      } finally {
        await done();
      }
    });

    test("released together, exactly one wins — asserted by count, never by name", async () => {
      const { a, b, done } = await twoWriters();
      try {
        await seed(a.store);
        // Both calls are created before either is awaited, so they are in
        // flight at the same time and neither is ordered by this test.
        const results = await Promise.allSettled([
          a.store.appendLog("prj_1", move(4, 1, 1)),
          b.store.appendLog("prj_1", move(4, 2, 2)),
        ]);
        const won = results.filter((result) => result.status === "fulfilled");
        const lost = results.filter((result) => result.status === "rejected");
        expect(won).toHaveLength(1);
        expect(lost).toHaveLength(1);
        expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(OplogFencedError);

        // One document, and its contents are the winner's — whoever that was.
        const docs = await a.firestore.collection(opsCollection("prj_1")).where("seq", "==", 4).get();
        expect(docs.size).toBe(1);
        const stored = JSON.parse(docs.docs[0]!.data()["json"] as string) as LogEntry;
        const x = (stored.envelope.op as { x: number }).x;
        expect([1, 2]).toContain(x);
        expect(docs.docs[0]!.data()["writer"]).toBe(
          x === 1 ? a.store.writerId : b.store.writerId,
        );
      } finally {
        await done();
      }
    });

    test("a compacted-away seq is still claimed — the hole that is not there", async () => {
      const { a, b, done } = await twoWriters();
      try {
        await seed(a.store);
        const loaded = await a.store.load("prj_1");
        // Compact everything below the newest entry, as GC does.
        await a.store.compactOplog(
          "prj_1",
          loaded!.entries.filter((entry) => entry.seq === 3),
          loaded!.entries.filter((entry) => entry.seq !== 3),
        );

        // Now the case the design memo found: a writer stale enough to still
        // believe seq 2 is next. If compaction had DELETED that document, its
        // id would be free and this create would SUCCEED — a hole in the
        // create-only precondition exactly the width of the horizon. It does
        // not, because nothing was deleted.
        await expect(b.store.appendLog("prj_1", move(2, 5, 5))).rejects.toBeInstanceOf(
          OplogFencedError,
        );
        // And the compacted entry stayed compacted: the refusal did not
        // resurrect it into the live log.
        expect((await a.store.load("prj_1"))!.entries.map((entry) => entry.seq)).toEqual([3]);
      } finally {
        await done();
      }
    });

    test("the actor registry is fenced too — it is a log with seqs like any other", async () => {
      const { a, b, done } = await twoWriters();
      try {
        await a.store.appendActorsLog(claimEntry(1));
        await expect(b.store.appendActorsLog(claimEntry(1))).rejects.toBeInstanceOf(
          OplogFencedError,
        );
      } finally {
        await done();
      }
    });
  });
}

function move(seq: number, x: number, y: number): LogEntry {
  const op: Operation = { type: "item.move", itemId: "itm_1", x, y };
  return {
    seq,
    envelope: {
      id: `op_move_${seq}_${x}`,
      canvasId: "prj_1",
      actor: { id: "usr_test", name: "Tester" },
      ts: new Date(Date.UTC(2026, 0, 3) + seq * 1000).toISOString(),
      op,
    },
    inverse: null,
  };
}

function claimEntry(seq: number): LogEntry {
  return {
    seq,
    envelope: {
      id: `op_claim_${seq}`,
      canvasId: null,
      actor: { id: "usr_ada", name: "Ada" },
      ts: new Date(Date.UTC(2026, 0, 4) + seq * 1000).toISOString(),
      op: { type: "actor.claim", sessionKey: "test:ada", name: "Ada" },
    },
    inverse: null,
  };
}
