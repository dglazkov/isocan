import { describe, expect, it, vi } from "vitest";
import { CANVAS_GROUPS_FEATURE, type Actor, type Operation, type SourceRequestContext } from "@isocan/core";
import { Engine, type Desk, type Store } from "@isocan/server";
import { mint } from "./desk-conformance.ts";

/** Identical writer/history proof runs on FileStore and required-emulator CloudStore. */
export interface RecapFixture {
  store: Store;
  desk: Desk;
  reopen(): Promise<{ store: Store; desk: Desk }>;
  done(): Promise<void>;
}
const badgeId = "bdg_acme_recap", canvasId = "prj_acme_recap", home = "https://acme.invalid";
const context: SourceRequestContext = { policy: { mode: "exclude" }, expectedHome: home };
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function submit(engine: Engine, actor: Actor, id: string | null, op: Operation) {
  return engine.submit({ badgeId, actor, canvasId: id, op, clientFeatures: CANVAS_GROUPS_FEATURE });
}
async function prepare(backing: RecapFixture, busy = true) {
  const engine = new Engine(backing.store, backing.desk);
  await backing.desk.put(mint(badgeId));
  const actors: Actor[] = [];
  for (const name of ["Maya", "Theo", "Rowan", "Birch", "Cedar", "Aspen"]) actors.push((await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `home:${name}`, name } })).envelope.actor);
  const owner = actors[0]!;
  await submit(engine, owner, null, { type: "project.create", canvasId, title: `Acme ${"🪴".repeat(170)}` });
  if (busy) {
    const blob = await engine.putBlob(canvasId, Buffer.from("PRIVATE_ITEM_CONTENT"), { mimeType: "text/plain", filename: "note.txt" });
    for (let n = 0; n < 14; n++) await submit(engine, owner, canvasId, { type: "item.add", itemId: `itm_${n}`, title: n === 12 ? "EXCLUDED_TITLE" : n === 13 ? "TRASHED_TITLE" : `Acme ${n} ${"🪴".repeat(170)}`, width: 100, height: 100, placement: { x: n * 120, y: 0 }, version: { ...blob, id: `ver_${n}`, filename: "note.txt" } });
    for (let n = 0; n < 112; n++) await submit(engine, actors[n % actors.length]!, canvasId, { type: "item.move", itemId: `itm_${n % 14}`, x: n, y: 0 });
    await submit(engine, owner, canvasId, { type: "item.update", itemId: "itm_12", patch: { properties: { context: "excluded" } } });
    await submit(engine, owner, canvasId, { type: "item.delete", itemId: "itm_13" });
    await submit(engine, owner, canvasId, { type: "thread.create", threadId: "thr_acme", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_acme", body: "PRIVATE_CHAT_PAYLOAD" } });
  }
  return { engine, owner };
}

/** Recent metadata must survive real compaction/reopen and share the writer's coherent boundary. */
export function recapHeadConformance(name: string, make: () => Promise<RecapFixture>, skip?: string): void {
  describe(`Inherited recap head — ${name}${skip ? ` [SKIPPED: ${skip}]` : ""}`, () => {
    const test = skip ? it.skip : it;
    test("real mutations exceed every row bound and survive archive GC and restart without leaking payloads", async () => {
      const backing = await make();
      try {
        const { engine } = await prepare(backing);
        const state = JSON.stringify((await engine.getSnapshot(canvasId)).canvas);
        const live = await engine.getLog(canvasId);
        const head = (await engine.recapHead(canvasId, badgeId, context, home))!;
        expect(head).toMatchObject({ canvasId, home, revision: 130, head: { fromSeq: 31, toSeq: 130, count: 100, comments: 1, omitted: { earlierAvailableOps: 30, actors: 1, items: 4, hiddenItems: 2, clippedLabels: 9 } } });
        expect(head.head.actors).toHaveLength(5); expect(head.head.items).toHaveLength(8);
        expect(Array.from(head.title)).toHaveLength(160);
        expect(JSON.stringify(head)).not.toMatch(/EXCLUDED_TITLE|TRASHED_TITLE|PRIVATE_|blobHash|ver_|envelope|inverse/);
        expect(JSON.stringify((await engine.getSnapshot(canvasId)).canvas)).toBe(state);
        expect(await engine.getLog(canvasId)).toEqual(live);
        // The backing committed compaction, but the writer lost its receipt.
        // Runtime still has the old rows: real archive/live duplicates must
        // compare equal after backing serialization rather than double-count.
        const compactOplog = backing.store.compactOplog.bind(backing.store);
        const lostReceipt = vi.spyOn(backing.store, "compactOplog").mockImplementationOnce(async (...args) => { await compactOplog(...args); throw new Error("synthetic lost GC receipt"); });
        await expect(engine.gc(canvasId, { keepOps: 10, graceMs: 0 })).rejects.toThrow("synthetic lost GC receipt");
        lostReceipt.mockRestore();
        expect(await engine.recapHead(canvasId, badgeId, context, home)).toEqual(head);
        const gc = await engine.gc(canvasId, { keepOps: 10, graceMs: 0 });
        expect(gc.droppedEntries).toBeGreaterThan(100);
        expect((await backing.store.readArchivedLog(canvasId)).length).toBeGreaterThan(100);
        expect(await engine.recapHead(canvasId, badgeId, context, home)).toEqual(head);
        const reopened = await backing.reopen();
        const next = new Engine(reopened.store, reopened.desk);
        expect(await next.recapHead(canvasId, badgeId, context, home)).toEqual(head);
        expect(JSON.stringify((await next.getSnapshot(canvasId)).canvas)).toBe(state);
      } finally { vi.restoreAllMocks(); await backing.done(); }
    });

    test("a held archive read prevents GC interleaving until its complete head is captured", async () => {
      const backing = await make(), entered = latch(), release = latch();
      const pending: Promise<unknown>[] = [];
      try {
        const { engine } = await prepare(backing);
        const before = await engine.recapHead(canvasId, badgeId, context, home);
        const readArchive = backing.store.readArchivedLog.bind(backing.store);
        const read = vi.spyOn(backing.store, "readArchivedLog").mockImplementationOnce(async (id) => { const captured = await readArchive(id); entered.resolve(); await release.promise; return captured; });
        const compact = vi.spyOn(backing.store, "compactOplog");
        const reading = engine.recapHead(canvasId, badgeId, context, home);
        pending.push(reading);
        await entered.promise;
        const runtime = vi.spyOn(engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime");
        const listBlobs = vi.spyOn(backing.store, "listBlobs");
        const collecting = engine.gc(canvasId, { keepOps: 10, graceMs: 0 });
        pending.push(collecting);
        // Drain the runnable turn, not a timed sleep. An unqueued GC enters
        // runtime before its first storage await; a queued one cannot start.
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(runtime).not.toHaveBeenCalled();
        expect(listBlobs).not.toHaveBeenCalled();
        expect(compact).not.toHaveBeenCalled();
        release.resolve();
        expect(await reading).toEqual(before);
        expect((await collecting).droppedEntries).toBeGreaterThan(100);
        expect(compact).toHaveBeenCalledOnce(); read.mockRestore();
        expect(await engine.recapHead(canvasId, badgeId, context, home)).toEqual(before);
      } finally { release.resolve(); await Promise.allSettled(pending); vi.restoreAllMocks(); await backing.done(); }
    });

    test("missing required archived history is unavailable after real compaction and restart", async () => {
      const backing = await make();
      try {
        const { engine } = await prepare(backing);
        await engine.gc(canvasId, { keepOps: 10, graceMs: 0 });
        const reopened = await backing.reopen(), next = new Engine(reopened.store, reopened.desk);
        const readArchive = reopened.store.readArchivedLog.bind(reopened.store);
        const actual = await readArchive(canvasId);
        expect(actual.some((entry) => entry.seq === 100)).toBe(true);
        vi.spyOn(reopened.store, "readArchivedLog").mockImplementation(async (id) => (await readArchive(id)).filter((entry) => entry.seq !== 100));
        expect(await next.recapHead(canvasId, badgeId, context, home)).toBeNull();
      } finally { vi.restoreAllMocks(); await backing.done(); }
    });

    test("queued classification and cancellation are rechecked before any source runtime or archive", async () => {
      const backing = await make(), entered = latch(), release = latch();
      try {
        const { engine, owner } = await prepare(backing, false);
        const spies = [vi.spyOn(engine, "getSnapshot"), vi.spyOn(engine, "getLog"), vi.spyOn(engine, "getArchivedLog"),
          vi.spyOn(engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime"), vi.spyOn(backing.store, "load"), vi.spyOn(backing.store, "readArchivedLog"), vi.spyOn(backing.store, "openBlob")];
        const blocking = engine.personalWrite(async () => { entered.resolve(); await release.promise; });
        await entered.promise;
        const refused = expect(engine.recapHead(canvasId, badgeId, { policy: { mode: "direct", actorId: owner.id, intent: "own" } }, home)).rejects.toMatchObject({ code: "personal-source-excluded" });
        const controller = new AbortController();
        const canceled = expect(engine.recapHead(canvasId, badgeId, { ...context, signal: controller.signal }, home)).rejects.toThrow();
        // Trusted local classification may arrive while a request is queued;
        // it grants no authority and must close the automatic history door.
        await backing.desk.recordPersonalReplica(canvasId, "https://other.invalid");
        controller.abort(); release.resolve();
        await Promise.all([blocking, refused, canceled]);
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      } finally { release.resolve(); vi.restoreAllMocks(); await backing.done(); }
    });
  });
}
