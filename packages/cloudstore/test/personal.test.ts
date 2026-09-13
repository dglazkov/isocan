import { describe, expect, it, vi } from "vitest";
import { Engine, type PersonalSourceRecord } from "@isocan/server";
import { CloudDesk } from "../src/cloud-desk.ts";
import { cloudGate, makeCloudDesk, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { mint, claim } from "../../../test/conformance/desk-conformance.ts";

const gate = cloudGate();
if (!gate.ok && requireEmulator()) it("requires the local emulator for personal Cloud safety", () => { throw new Error(gate.skip); });
else describe.skipIf(!gate.ok)("personal Cloud transactions and writer recovery", () => {
  it("independent instances reserve one source and preserve false delegation across reopen", async () => {
    const first = makeCloudDesk(); const second = makeCloudDesk(first.projectId);
    try {
      const at = new Date().toISOString();
      const rows = await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? first.desk : second.desk).reservePersonal({ ownerId: "usr_cloud_owner", aliases: [], canvasId: `prj_cloud_${i}`, birthOpId: `op_cloud_${i}`, at })));
      const id = rows[0]!.source.canvasId;
      expect(new Set(rows.map((row) => row.source.canvasId)).size).toBe(1);
      await first.desk.setPersonalDelegation(id, { agentId: "usr_cloud_agent", allowed: true, at, byOwnerId: "usr_cloud_owner" });
      await second.desk.setPersonalDelegation(id, { agentId: "usr_cloud_agent", allowed: false, at, byOwnerId: "usr_cloud_owner" });
      await first.desk.recordPersonalReplica("prj_remote", "https://home.acme.test");
      const reopened = makeCloudDesk(first.projectId);
      try {
        expect((await reopened.desk.personalBinding(["usr_cloud_owner"]))!.source.canvasId).toBe(id);
        expect((await reopened.desk.personalDelegations(id))[0]!.allowed).toBe(false);
        expect(await reopened.desk.personalReplica("prj_remote")).toBe("https://home.acme.test");
        expect(await reopened.desk.personalSource("prj_remote")).toBeNull();
        await expect(second.desk.recordPersonalReplica("prj_remote", "https://different.acme.test")).rejects.toThrow("authority changed");
      } finally { await reopened.desk.close(); }
    } finally { await first.desk.close(); await second.desk.close(); }
  });

  it("two engines racing private birth claim seq1 once, and the loser recovers the same source", async () => {
    const a = makeCloudStore(); const b = makeCloudStore({ projectId: a.projectId, objects: a.objects });
    const da = new CloudDesk({ firestore: a.firestore }); const db = new CloudDesk({ firestore: b.firestore });
    const actor = { id: "usr_cloud_owner", name: "Maya" }; const badgeId = "bdg_cloud_owner";
    await da.put(mint(badgeId)); await da.setClaims(badgeId, [claim(actor.id, "home:maya")]);
    const { source } = await da.reservePersonal({ ownerId: actor.id, aliases: [], canvasId: "prj_cloud_source", birthOpId: "op_cloud_source", at: new Date().toISOString() });
    const ea = new Engine(a.store, da); const eb = new Engine(b.store, db);
    let arrivals = 0; let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const wrap = (store: typeof a.store) => {
      const append = store.appendLog.bind(store);
      return vi.spyOn(store, "appendLog").mockImplementation(async (id, entry) => { arrivals++; await gate; return append(id, entry); });
    };
    const aa = wrap(a.store); const bb = wrap(b.store);
    try {
      const pending = [ea, eb].map((engine) => engine.personalWrite((writer) => writer.birth(source, actor, badgeId)));
      await expect.poll(() => arrivals).toBe(2); release();
      const results = await Promise.allSettled(pending);
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
      aa.mockRestore(); bb.mockRestore();
      const current = await da.personalSource(source.canvasId) as PersonalSourceRecord;
      await eb.personalWrite((writer) => writer.birth(current, actor, badgeId));
      expect(await a.store.tipSeq(source.canvasId)).toBe(1);
      expect(await da.grantsFor(source.canvasId)).toEqual([]);
      expect((await db.personalSource(source.canvasId))!.birth).toBe("created");
    } finally { release(); aa.mockRestore(); bb.mockRestore(); await a.store.close(); await b.store.close(); }
  });

  it("a durable birth with missing metadata is recovered without a duplicate sequence", async () => {
    const a = makeCloudStore(); const desk = new CloudDesk({ firestore: a.firestore });
    const actor = { id: "usr_cloud_recovery", name: "Theo" }; const badgeId = "bdg_cloud_recovery";
    await desk.put(mint(badgeId)); await desk.setClaims(badgeId, [claim(actor.id, "home:theo")]);
    const { source } = await desk.reservePersonal({ ownerId: actor.id, aliases: [], canvasId: "prj_cloud_recovery", birthOpId: "op_cloud_recovery", at: new Date().toISOString() });
    const engine = new Engine(a.store, desk);
    const fail = vi.spyOn(a.store, "saveSnapshot").mockRejectedValueOnce(new Error("synthetic crash before metadata"));
    try {
      await expect(engine.personalWrite((writer) => writer.birth(source, actor, badgeId))).rejects.toThrow("synthetic crash");
      fail.mockRestore();
      expect(await a.store.canvasLifecycle(source.canvasId)).toBe("incomplete");
      const b = makeCloudStore({ projectId: a.projectId, objects: a.objects });
      try {
        const next = new Engine(b.store, new CloudDesk({ firestore: b.firestore }));
        expect(await next.personalWrite((writer) => writer.birth(source, actor, badgeId))).toBe(true);
        expect(await b.store.tipSeq(source.canvasId)).toBe(1);
        expect((await b.store.load(source.canvasId))!.state.project.title).toBe("~Theo");
      } finally { await b.store.close(); }
    } finally { fail.mockRestore(); await a.store.close(); }
  });
});
