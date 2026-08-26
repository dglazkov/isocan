import { describe, expect, it } from "vitest";
import type { LogEntry } from "@isocan/core";
import { storeConformance, collect, seed } from "../../../test/conformance/store-conformance.ts";
import { CloudStore } from "../src/cloud-store.ts";
import { archiveKey, canvasDoc, opsCollection, padSeq, snapshotKey } from "../src/naming.ts";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { MemoryObjects } from "./memory-objects.ts";

const gate = cloudGate();

if (!gate.ok && requireEmulator()) {
  describe("CloudStore", () => {
    it("the Firestore emulator is REQUIRED here and is not available", () => {
      throw new Error(
        `ISOCAN_REQUIRE_EMULATOR=1, but the cloud suites cannot run: ${gate.skip}. ` +
          "A green run that did not test Firestore launders an unknown into a checkmark.",
      );
    });
  });
} else {
  storeConformance(
    "CloudStore",
    async () => {
      // The store and its reopened self share ONE object store, because they
      // share one bucket in life. Sharing the project id is what makes the
      // reopen a restart rather than a fresh home.
      const objects = new MemoryObjects();
      let current = makeCloudStore({ objects });
      const projectId = current.projectId;
      return {
        store: current.store,
        reopen: async () => {
          await current.store.close();
          current = makeCloudStore({ objects, projectId });
          return current.store;
        },
        done: async () => {
          await current.store.close();
        },
      };
    },
    { skip: gate.skip },
  );

  const test = gate.ok ? it : it.skip;
  const title = gate.ok ? "CloudStore — the cloud's own" : `CloudStore — the cloud's own [SKIPPED: ${gate.skip}]`;

  describe(title, () => {
    const withStore = (
      body: (fixture: ReturnType<typeof makeCloudStore>) => Promise<void>,
      options?: Parameters<typeof makeCloudStore>[0],
    ) => async () => {
      const fixture = makeCloudStore(options);
      try {
        await body(fixture);
      } finally {
        await fixture.store.close();
      }
    };

    test(
      "the op document's id IS its seq, zero-padded, and the entry rides as opaque JSON",
      withStore(async ({ store, firestore, projectId }) => {
        await seed(store);
        const docs = await firestore.collection(opsCollection("prj_1")).orderBy("seq").get();
        expect(docs.docs.map((doc) => doc.id)).toEqual(["000000000001", "000000000002", "000000000003"]);
        const second = docs.docs[1]!.data();
        // Denormalized for the console and the audit story…
        expect(second["seq"]).toBe(2);
        expect(second["opType"]).toBe("item.add");
        expect(second["actorId"]).toBe("usr_test");
        expect(second["writer"]).toBe(store.writerId);
        // …and the entry itself is the JSON that went over the wire, so a new
        // Operation shape can never break persistence.
        expect(typeof second["json"]).toBe("string");
        expect((JSON.parse(second["json"] as string) as LogEntry).envelope.op.type).toBe("item.add");
        expect(projectId.startsWith("demo-")).toBe(true);
      }),
    );

    test(
      "the snapshot is DEBOUNCED — the log is durable long before the object is written",
      withStore(
        async ({ store, objects, firestore }) => {
          await seed(store);
          // Three ops in, nothing has been snapshotted: the ops are all that
          // exist, and they are enough.
          expect(objects.keys()).not.toContain(snapshotKey("prj_1"));
          const ops = await firestore.collection(opsCollection("prj_1")).get();
          expect(ops.size).toBe(3);
          // A boot in this state is the crash-recovery path, and it works —
          // which is the whole licence for debouncing.
          const loaded = await store.load("prj_1");
          expect(loaded!.lastSeq).toBe(3);
          expect(loaded!.recoveredSeqs).toEqual([2, 3]); // project.create is skipped
        },
        { snapshotEveryOps: 1000, snapshotEveryMs: 60_000 },
      ),
    );

    test(
      "close() flushes what the debounce was holding",
      async () => {
        const objects = new MemoryObjects();
        const first = makeCloudStore({ objects, snapshotEveryOps: 1000, snapshotEveryMs: 60_000 });
        const state = await seed(first.store);
        expect(objects.keys()).not.toContain(snapshotKey("prj_1"));
        await first.store.close();
        expect(objects.keys()).toContain(snapshotKey("prj_1"));

        const second = makeCloudStore({ objects, projectId: first.projectId });
        try {
          const loaded = await second.store.load("prj_1");
          expect(loaded!.state).toEqual(state);
          // Nothing left to replay: the flush covered the whole log.
          expect(loaded!.recoveredSeqs).toEqual([]);
        } finally {
          await second.store.close();
        }
      },
    );

    test(
      "the canvas document is written when the metadata changes, NOT once per op",
      withStore(async ({ store, firestore }) => {
        await seed(store);
        const doc = await firestore.doc(canvasDoc("prj_1")).get();
        expect(doc.exists).toBe(true);
        expect((doc.data()!["project"] as { title: string }).title).toBe("P");
        expect(doc.data()!["deleted"]).toBe(false);
        // `canvases/{id}` is one document with roughly a one-write-per-second
        // ceiling on it; a per-op write would walk straight into it. The
        // update time is the evidence: three ops, one write.
        const firstWrite = doc.updateTime!.toMillis();
        await store.saveSnapshot("prj_1", (await store.load("prj_1"))!.state, 3);
        expect((await firestore.doc(canvasDoc("prj_1")).get()).updateTime!.toMillis()).toBe(firstWrite);
      }),
    );

    test(
      "compaction ARCHIVES and MARKS — and never frees a seq",
      withStore(async ({ store, objects, firestore }) => {
        await seed(store);
        const before = await store.load("prj_1");
        const retained = before!.entries.filter((entry) => entry.seq === 3);
        const dropped = before!.entries.filter((entry) => entry.seq !== 3);
        await store.compactOplog("prj_1", retained, dropped);

        // The documents are STILL THERE. This is the phase's thesis: a
        // deleted op document frees its id for creation again, which would
        // punch a hole in the create-only precondition exactly the width of
        // the compaction horizon.
        const docs = await firestore.collection(opsCollection("prj_1")).get();
        expect(docs.docs.map((doc) => doc.id)).toEqual([
          "000000000001",
          "000000000002",
          "000000000003",
        ]);
        expect(docs.docs[0]!.data()["compacted"]).toBe(true);
        expect(docs.docs[1]!.data()["compacted"]).toBe(true);
        expect(docs.docs[2]!.data()["compacted"]).toBeUndefined();

        // A horizon on the canvas document, and the archive in the bucket.
        const canvas = await firestore.doc(canvasDoc("prj_1")).get();
        expect(canvas.data()!["compactedThrough"]).toBe(2);
        const archive = (await objects.readAll(archiveKey("prj_1")))!.toString("utf8");
        expect(archive.trim().split("\n")).toHaveLength(2);
        expect((JSON.parse(archive.trim().split("\n")[0]!) as LogEntry).seq).toBe(1);

        // And the seq stays claimed: re-creating a compacted-away op is refused.
        await expect(
          firestore.collection(opsCollection("prj_1")).doc(padSeq(1)).create({ seq: 1 }),
        ).rejects.toMatchObject({ code: 6 });
      }),
    );

    test(
      "compaction keeps a pair-complete set readable even when it reaches BELOW the newest drop",
      withStore(async ({ store }) => {
        await seed(store);
        const before = await store.load("prj_1");
        // Retain the OLDEST entry and drop the two above it — what
        // `chooseRetained`'s undo/redo closure does when it pulls an old
        // target back over the line. A horizon of `max(dropped)` would hide
        // the retained entry; `min(retained) - 1` plus the mark does not.
        const retained = before!.entries.filter((entry) => entry.seq === 1);
        const dropped = before!.entries.filter((entry) => entry.seq !== 1);
        await store.compactOplog("prj_1", retained, dropped);
        const after = await store.load("prj_1");
        expect(after!.entries.map((entry) => entry.seq)).toEqual([1]);
      }),
    );

    test(
      "an entry too big for a document goes to the bucket, object first",
      withStore(async ({ store, objects, firestore }) => {
        await seed(store);
        // A description nobody would write, and the reducer does not care.
        const huge = "x".repeat(1_000_000);
        const entry: LogEntry = {
          seq: 4,
          envelope: {
            id: "op_huge",
            canvasId: "prj_1",
            actor: { id: "usr_test", name: "Tester" },
            ts: new Date(Date.UTC(2026, 0, 2)).toISOString(),
            op: { type: "project.update", patch: { description: huge } },
          },
          inverse: null,
        };
        await store.appendLog("prj_1", entry);

        const doc = await firestore.collection(opsCollection("prj_1")).doc(padSeq(4)).get();
        expect(doc.data()!["overflow"]).toBe(true);
        expect(doc.data()!["json"]).toBeUndefined();
        expect(objects.keys()).toContain("canvases/prj_1/ops/000000000004.json");
        // …and load reads straight through it.
        const loaded = await store.load("prj_1");
        const read = loaded!.entries.find((row) => row.seq === 4)!;
        expect(read.envelope.op).toEqual(entry.envelope.op);
      }),
    );

    test(
      "a soft-deleted canvas keeps every seq it ever claimed",
      withStore(async ({ store, firestore }) => {
        await seed(store);
        await store.softDeleteCanvas("prj_1");
        expect(await store.load("prj_1")).toBeNull();
        expect(await store.listCanvases()).toEqual([]);
        const docs = await firestore.collection(opsCollection("prj_1")).get();
        expect(docs.size).toBe(3);
        expect((await firestore.doc(canvasDoc("prj_1")).get()).data()!["deleted"]).toBe(true);
        // …so the id stays taken. The engine asks `canvasExists` to refuse a
        // duplicate `project.create`, and it must refuse: seqs 1..3 are still
        // claimed, so a create would be fenced two lines later and would
        // surface as `writer-fenced` — a lie, since there is no other writer.
        expect(await store.canvasExists("prj_1")).toBe(true);
      }),
    );

    test(
      "the upload round trip: mint a ticket, PUT to it, register the hash",
      async () => {
        const objects = new MemoryObjects();
        await objects.listen();
        const { store } = makeCloudStore({ objects });
        try {
          await seed(store);
          const bytes = Buffer.from("a video, pretend");
          const blobHash = "b".repeat(64);
          const request = {
            blobHash,
            mimeType: "video/mp4",
            filename: "clip.mp4",
            size: bytes.length,
          };

          // Nothing is registered by asking — the bytes have not arrived.
          const ticket = (await store.beginUpload("prj_1", request))!;
          expect(await store.blobMeta("prj_1", blobHash)).toBeNull();
          // Registering before the bytes land is refused, which is the one
          // thing the daemon CAN check without reading them back.
          await expect(store.registerBlob("prj_1", request)).rejects.toThrow(/no uploaded bytes/);

          const put = await fetch(ticket.url, {
            method: "PUT",
            headers: ticket.headers,
            body: bytes,
          });
          expect(put.status).toBe(200);

          const registered = await store.registerBlob("prj_1", request);
          expect(registered).toEqual({ blobHash, size: bytes.length, mimeType: "video/mp4" });
          expect(await collect(await store.openBlob("prj_1", blobHash))).toEqual(bytes);
          // The bytes are addressed exactly as a disk would address them.
          expect((await store.blobMeta("prj_1", blobHash))!.file).toBe(`${blobHash}.mp4`);
        } finally {
          await store.close();
          await objects.stop();
        }
      },
    );

    test(
      "the ticket is scoped: a second PUT to the same URL is refused by the precondition",
      async () => {
        const objects = new MemoryObjects();
        await objects.listen();
        const { store } = makeCloudStore({ objects });
        try {
          await seed(store);
          const request = {
            blobHash: "c".repeat(64),
            mimeType: "text/plain",
            filename: "note.txt",
            size: 5,
          };
          const ticket = (await store.beginUpload("prj_1", request))!;
          expect(ticket.headers["x-goog-if-generation-match"]).toBe("0");
          expect((await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: "hello" })).status).toBe(200);
          // Create-only, for the same reason op writes are: a leaked ticket
          // must not be able to replace bytes an item already points at.
          const second = await fetch(ticket.url, {
            method: "PUT",
            headers: ticket.headers,
            body: "goodbye",
          });
          expect(second.status).toBe(412);
          // And the signed headers are not advice.
          const naked = await fetch(ticket.url, { method: "PUT", body: "hello" });
          expect(naked.status).toBe(403);
        } finally {
          await store.close();
          await objects.stop();
        }
      },
    );

    test(
      "beginUpload is not a key to the bucket: the URL names one object and one method",
      withStore(async ({ store }) => {
        await seed(store);
        const ticket = (await store.beginUpload("prj_1", {
          blobHash: "d".repeat(64),
          mimeType: "image/png",
          filename: "shot.png",
          size: 99,
        }))!;
        expect(ticket.url).toContain(encodeURIComponent(`canvases/prj_1/blobs/${"d".repeat(64)}.png`));
        expect(ticket.headers["Content-Type"]).toBe("image/png");
      }),
    );

    test(
      "a CloudStore is a Store — the seam, not a lookalike",
      withStore(async ({ store }) => {
        expect(store).toBeInstanceOf(CloudStore);
        // Every method the interface names, present and callable. The real
        // enforcement is `test/seam.test.ts`, which reads store.ts; this is
        // the runtime half of the same question.
        for (const method of [
          "init",
          "close",
          "listCanvases",
          "createCanvasDir",
          "canvasExists",
          "load",
          "saveCanvas",
          "saveSnapshot",
          "appendLog",
          "softDeleteCanvas",
          "loadCommands",
          "saveCommand",
          "deleteCommand",
          "loadActors",
          "saveActors",
          "appendActorsLog",
          "putBlob",
          "blobMeta",
          "openBlob",
          "beginUpload",
          "registerBlob",
          "listBlobs",
          "deleteBlobs",
          "compactOplog",
          "readArchivedLog",
        ]) {
          expect(typeof (store as unknown as Record<string, unknown>)[method]).toBe("function");
        }
      }),
    );
  });
}
