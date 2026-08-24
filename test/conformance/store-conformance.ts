import { describe, expect, it } from "vitest";
import type { LogEntry, OpEnvelope, Operation, CanvasState } from "@isocan/core";
import { applyOperation, invertOperation } from "@isocan/core";
import type { Store } from "@isocan/server";

/**
 * What every `Store` backing must do, written once and run against each.
 *
 * A shared function called from two files rather than a parameterized loop
 * inside one, because the two backings need different lifecycles (a temp
 * directory versus an emulator project id), different availability (one
 * always runs), and different neighbours — while the body that makes the
 * claim is literally the same code, which is the property the phase's Proof
 * line is asking for.
 *
 * ## The one assertion this suite deliberately does NOT make
 *
 * `recoveredSeqs === []` after an ordinary write-and-reload. A backing is
 * allowed to debounce its snapshot (`store.ts` says so, and the cloud backing
 * does, because a full-canvas object write on every op would put a bucket
 * round trip on the durability path for data that is derived). So a cloud
 * boot routinely replays a tail where a file boot does not.
 *
 * What is asserted instead is CONVERGENCE: the state that comes back equals
 * the state the ops produced, and `lastSeq` is right. That is the precise
 * reading of "the same engine runs against either backing with identical
 * behavior" — it is a claim about the engine's behavior, not about every
 * field of every record a backing returns. The file backing keeps its own
 * stricter assertion, in its own file, where it is true.
 */

export interface StoreFixture {
  store: Store;
  /** Close this store and open a NEW one over the SAME storage — a restart,
   * which is the only way to observe what `close()` flushed. */
  reopen: () => Promise<Store>;
  done: () => Promise<void>;
}

export interface ConformanceOptions {
  /** When set, every case is registered as skipped and the reason rides in
   * the describe title, so the run's own output is the list of what did not
   * get checked. */
  skip?: string | undefined;
}

const actor = { id: "usr_test", name: "Tester" };

export function storeConformance(
  name: string,
  make: () => Promise<StoreFixture>,
  options: ConformanceOptions = {},
): void {
  const title = options.skip
    ? `Store conformance — ${name} [SKIPPED: ${options.skip}]`
    : `Store conformance — ${name}`;
  const test = options.skip ? it.skip : it;

  describe(title, () => {
    /** Run one case with a fresh store, and always give the fixture back. */
    const withStore = (body: (fixture: StoreFixture) => Promise<void>) => async () => {
      const fixture = await make();
      try {
        await body(fixture);
      } finally {
        await fixture.done();
      }
    };

    test(
      "persists and reloads a canvas — the state converges, whatever the snapshot did",
      withStore(async ({ store }) => {
        const state = await seed(store);
        const loaded = await store.load("prj_1");
        expect(loaded).not.toBeNull();
        expect(loaded!.state).toEqual(state);
        expect(loaded!.lastSeq).toBe(3);
        expect(loaded!.entries).toHaveLength(3);
      }),
    );

    test(
      "survives a restart: what close() flushed, a fresh store reads back",
      withStore(async (fixture) => {
        const state = await seed(fixture.store);
        const reopened = await fixture.reopen();
        const loaded = await reopened.load("prj_1");
        expect(loaded!.state).toEqual(state);
        expect(loaded!.lastSeq).toBe(3);
      }),
    );

    test(
      "lists canvases, canvasExists agrees, and saveCanvas moves the metadata",
      withStore(async ({ store }) => {
        await seed(store);
        const canvases = await store.listCanvases();
        expect(canvases.map((canvas) => canvas.id)).toEqual(["prj_1"]);
        expect(await store.canvasExists("prj_1")).toBe(true);
        expect(await store.canvasExists("prj_nope")).toBe(false);

        await store.saveCanvas({ ...canvases[0]!, title: "Renamed" });
        expect((await store.listCanvases())[0]!.title).toBe("Renamed");
        expect((await store.load("prj_1"))!.state.project.title).toBe("Renamed");
      }),
    );

    test(
      "init is idempotent, and close can be called twice",
      withStore(async ({ store }) => {
        // Both are called on paths that can run more than once — a daemon
        // restarted in-process, a shutdown racing a signal handler — and a
        // backing that threw on the second call would turn a clean exit into
        // a stack trace.
        await store.init();
        await store.init();
        await store.close();
        await store.close();
      }),
    );

    test(
      "recovers from a crash by replaying the oplog tail",
      withStore(async ({ store }) => {
        const state = await seed(store);
        // The crash, performed THROUGH the seam rather than behind it: roll the
        // snapshot back to its true seq-1 state (canvas created, nothing on it)
        // and let the load replay 2..3. Same fiction as writing canvas.json by
        // hand, and it is a fiction either backing can be told.
        const seq1: CanvasState = { project: state.project, canvas: { items: {}, threads: {}, trash: [] } };
        await store.saveSnapshot("prj_1", seq1, 1);
        const recovered = await store.load("prj_1");
        expect(recovered!.recoveredSeqs).toEqual([2, 3]);
        expect(recovered!.state).toEqual(state);
        expect(recovered!.lastSeq).toBe(3);
        // …and the snapshot was healed, so the next boot has nothing to replay.
        const healed = await store.load("prj_1");
        expect(healed!.recoveredSeqs).toEqual([]);
        expect(healed!.state).toEqual(state);
      }),
    );

    test(
      "stores blobs content-addressed, with dedup, and streams them back",
      withStore(async ({ store }) => {
        await seed(store);
        const data = Buffer.from("# hello\n");
        const a = await store.putBlob("prj_1", data, { mimeType: "text/markdown", filename: "a.md" });
        const b = await store.putBlob("prj_1", data, { mimeType: "text/markdown", filename: "copy.md" });
        expect(a.blobHash).toBe(b.blobHash);
        expect(a.size).toBe(data.length);

        const meta = await store.blobMeta("prj_1", a.blobHash);
        expect(meta).not.toBeNull();
        expect(meta!.filename).toBe("a.md"); // first upload wins the metadata
        expect(meta!.file).toBe(`${a.blobHash}.md`); // same addressing on either backing
        expect(meta!.size).toBe(data.length);

        const stream = await store.openBlob("prj_1", a.blobHash);
        expect(await collect(stream)).toEqual(data);

        expect(await store.blobMeta("prj_1", "deadbeef")).toBeNull();
        expect(await store.openBlob("prj_1", "deadbeef")).toBeNull();
      }),
    );

    test(
      "reads a byte range out of a blob without reading the rest",
      withStore(async ({ store }) => {
        await seed(store);
        const data = Buffer.from("0123456789abcdef");
        const { blobHash } = await store.putBlob("prj_1", data, {
          mimeType: "text/plain",
          filename: "digits.txt",
        });
        // Inclusive on both ends, the way HTTP means it.
        expect(await collect(await store.openBlob("prj_1", blobHash, { start: 4, end: 8 }))).toEqual(
          Buffer.from("45678"),
        );
        expect(await collect(await store.openBlob("prj_1", blobHash, { start: 10, end: 15 }))).toEqual(
          Buffer.from("abcdef"),
        );
      }),
    );

    test(
      "soft-deletes a project: gone from load and from the list, not from history",
      withStore(async ({ store }) => {
        await seed(store);
        await store.softDeleteCanvas("prj_1");
        expect(await store.load("prj_1")).toBeNull();
        expect(await store.listCanvases()).toEqual([]);
        // Whether the ID becomes free again is NOT asserted here: a file home
        // moves the directory aside and frees it, and the cloud keeps it
        // claimed forever because its ops are still there and a freed seq is
        // the one thing that backing must never produce. Each says so in its
        // own file.
      }),
    );

    test(
      "returns null for unknown canvases",
      withStore(async ({ store }) => {
        expect(await store.load("prj_nope")).toBeNull();
      }),
    );

    test(
      "slash commands: save, read back, and removing one says whether it was there",
      withStore(async ({ store }) => {
        expect(await store.loadCommands()).toEqual([]);
        await store.saveCommand("shout", "---\ndescription: Shout it\n---\nSHOUT: {{input}}\n");
        const commands = await store.loadCommands();
        expect(commands.map((command) => command.name)).toEqual(["shout"]);
        expect(commands[0]!.description).toBe("Shout it");
        expect(await store.deleteCommand("shout")).toBe(true);
        expect(await store.deleteCommand("shout")).toBe(false);
        expect(await store.loadCommands()).toEqual([]);
      }),
    );

    test(
      "the actor registry: snapshot plus tail, and the tail heals the snapshot",
      withStore(async ({ store }) => {
        expect(await store.loadActors()).toEqual({ registry: { names: {}, colors: {} }, lastSeq: 0 });
        await store.appendActorsLog(claimEntry(1, { id: "usr_ada", name: "Ada" }));
        await store.appendActorsLog(claimEntry(2, { id: "usr_bo", name: "Bo" }));
        // Nothing has written a snapshot, so this is pure replay.
        const replayed = await store.loadActors();
        expect(replayed.lastSeq).toBe(2);
        expect(replayed.registry.names["usr_ada"]?.name).toBe("Ada");
        expect(replayed.registry.names["usr_bo"]?.name).toBe("Bo");
        // …and it healed itself on the way out, so a second load replays nothing.
        await store.saveActors(replayed.registry, replayed.lastSeq);
        expect((await store.loadActors()).lastSeq).toBe(2);
      }),
    );

    test(
      "lists blobs with their ages, and deletes the ones it is told to",
      withStore(async ({ store }) => {
        await seed(store);
        const one = await store.putBlob("prj_1", Buffer.from("one"), {
          mimeType: "text/plain",
          filename: "one.txt",
        });
        const two = await store.putBlob("prj_1", Buffer.from("two"), {
          mimeType: "text/plain",
          filename: "two.txt",
        });
        const listing = await store.listBlobs("prj_1");
        expect(listing.map((row) => row.hash).sort()).toEqual([one.blobHash, two.blobHash].sort());
        for (const row of listing) {
          expect(row.ageMs).not.toBeNull();
          expect(row.ageMs!).toBeGreaterThanOrEqual(0);
          expect(row.ageMs!).toBeLessThan(60_000);
        }

        await store.deleteBlobs("prj_1", [one.blobHash]);
        expect((await store.listBlobs("prj_1")).map((row) => row.hash)).toEqual([two.blobHash]);
        expect(await store.blobMeta("prj_1", one.blobHash)).toBeNull();
        expect(await store.openBlob("prj_1", one.blobHash)).toBeNull();
        expect(await collect(await store.openBlob("prj_1", two.blobHash))).toEqual(Buffer.from("two"));

        await store.deleteBlobs("prj_1", []); // a no-op, not an error
      }),
    );

    test(
      "compacts the oplog: the dropped entries leave the live log, the state does not",
      withStore(async ({ store }) => {
        const state = await seed(store);
        const before = await store.load("prj_1");
        const retained = before!.entries.filter((entry) => entry.seq === 3);
        const dropped = before!.entries.filter((entry) => entry.seq !== 3);
        await store.compactOplog("prj_1", retained, dropped);

        const after = await store.load("prj_1");
        expect(after!.entries.map((entry) => entry.seq)).toEqual([3]);
        // Compaction is not a rewrite of history: state and numbering survive.
        expect(after!.state).toEqual(state);
        expect(after!.lastSeq).toBe(3);
      }),
    );

    test(
      "the direct-upload branch is all-or-nothing: a ticket AND a register, or neither",
      withStore(async ({ store }) => {
        await seed(store);
        const request = {
          blobHash: "a".repeat(64),
          mimeType: "video/mp4",
          filename: "clip.mp4",
          size: 40 * 1024 * 1024,
        };
        const ticket = await store.beginUpload("prj_1", request);
        if (ticket === null) {
          // A home with no ticket to give must refuse to register rather than
          // silently name bytes that never arrived.
          await expect(store.registerBlob("prj_1", request)).rejects.toThrow();
          return;
        }
        expect(ticket.url).toMatch(/^https?:\/\//);
        expect(ticket.headers["Content-Type"]).toBe("video/mp4");
        expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.now());
        // And nothing was registered by asking: the bytes have not arrived.
        expect(await store.blobMeta("prj_1", request.blobHash)).toBeNull();
      }),
    );
  });
}

// ---- fixtures ----

let opCounter = 0;

function envelope(op: Operation): OpEnvelope {
  opCounter += 1;
  return {
    id: `op_${opCounter}`,
    canvasId: op.type === "project.create" ? null : "prj_1",
    actor,
    ts: new Date(Date.UTC(2026, 0, 1) + opCounter * 1000).toISOString(),
    op,
  };
}

function claimEntry(seq: number, who: { id: string; name: string }): LogEntry {
  return {
    seq,
    envelope: {
      id: `op_claim_${seq}`,
      canvasId: null,
      actor: who,
      ts: new Date(Date.UTC(2026, 0, 2) + seq * 1000).toISOString(),
      op: { type: "actor.claim", sessionKey: `test:${who.id}`, name: who.name },
    },
    inverse: null,
  };
}

/** Apply + persist an op the way the engine does: log first, then snapshot. */
async function commit(
  store: Store,
  state: CanvasState | null,
  op: Operation,
  seq: number,
): Promise<CanvasState> {
  const env = envelope(op);
  const inverse = state === null && op.type === "project.create" ? null : invertOperation(state, op);
  const next = applyOperation(state, env)!;
  const entry: LogEntry = { seq, envelope: env, inverse };
  if (op.type === "project.create") await store.createCanvasDir("prj_1");
  await store.appendLog("prj_1", entry);
  await store.saveSnapshot("prj_1", next, seq);
  return next;
}

/** A canvas with three ops on it: create, add an item, move it. */
export async function seed(store: Store): Promise<CanvasState> {
  let state = await commit(store, null, { type: "project.create", canvasId: "prj_1", title: "P" }, 1);
  state = await commit(
    store,
    state,
    {
      type: "item.add",
      itemId: "itm_1",
      version: { id: "ver_1", blobHash: "h1", mimeType: "text/markdown", filename: "a.md", size: 5 },
      width: 100,
      height: 100,
      placement: { x: 10, y: 20 },
    },
    2,
  );
  state = await commit(store, state, { type: "item.move", itemId: "itm_1", x: 99, y: 88 }, 3);
  return state;
}

export async function collect(stream: NodeJS.ReadableStream | null): Promise<Buffer | null> {
  if (!stream) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
