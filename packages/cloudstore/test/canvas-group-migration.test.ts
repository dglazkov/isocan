import { describe, expect, it } from "vitest";
import { applyOperation, invertOperation, resolveCanvasGroupMigration, type CanvasState, type LogEntry, type Operation } from "@isocan/core";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { MemoryObjects } from "./memory-objects.ts";

const gate = cloudGate();
const actor = { id: "usr_test", name: "Test" };
const canvasId = "prj_cloud_migration";
const ts = "2026-09-13T00:00:00.000Z";
if (!gate.ok && requireEmulator()) {
  it("requires Firestore for migration persistence", () => { throw new Error(gate.skip); });
} else {
  describe(`CloudStore migration mode and boundary${gate.ok ? "" : ` [SKIPPED: ${gate.skip}]`}`, () => {
    const test = gate.ok ? it : it.skip;
    test("persists live and trash effects through snapshot, tail, restart and exact undo", async () => {
      const objects = new MemoryObjects();
      let fixture = makeCloudStore({ objects, snapshotEveryOps: 1 });
      const projectId = fixture.projectId;
      let state: CanvasState | null = null, seq = 0;
      const write = async (op: Operation, snapshot = true) => {
        const envelope = { id: `op_migration_${seq + 1}`, canvasId, actor, ts, op };
        const entry: LogEntry = { seq: ++seq, envelope, inverse: invertOperation(state, op) };
        state = applyOperation(state, envelope)!;
        await fixture.store.appendLog(canvasId, entry);
        if (snapshot) await fixture.store.saveSnapshot(canvasId, state, seq);
        return entry;
      };
      try {
        await fixture.store.createCanvasDir(canvasId);
        await write({ type: "project.create", canvasId, title: "Acme legacy", groupMode: "legacy" });
        for (const id of ["sheet", "trash"]) await write({ type: "item.add", itemId: id, title: `Acme ${id}`, width: 800, height: 800, placement: { x: 0, y: 0, chosen: true }, properties: { kind: "area", board: "acme" }, version: { id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: "Acme.md", size: 4 } });
        await write({ type: "item.delete", itemId: "trash" });
        const legacy = structuredClone(state!);
        const migration = resolveCanvasGroupMigration(state!, seq, { kind: "migrate", expectedRevision: seq }, { actor, ts, opId: `op_migration_${seq + 1}` });
        const entry = await write(migration, false);
        const expected = structuredClone(state!);
        expect(expected.project.groupMigration).toEqual({ version: 1, opId: entry.envelope.id, seq: entry.seq });
        expect((await fixture.store.load(canvasId))!.state).toEqual(expected); // snapshot + canonical tail
        await fixture.store.saveSnapshot(canvasId, expected, seq);
        await fixture.store.close();
        fixture = makeCloudStore({ objects, projectId, snapshotEveryOps: 1 });
        expect((await fixture.store.load(canvasId))!.state).toEqual(expected);
        expect(expected.canvas.trash[0]!.legacyGroupRestore).toBe("frame-only");
        await write(entry.inverse!);
        expect(state!.project.groupMode).toBe("legacy");
        expect(state!.project.groupMigration).toBeUndefined();
        expect(state!.canvas).toEqual(legacy.canvas);
        await fixture.store.close();
        fixture = makeCloudStore({ objects, projectId, snapshotEveryOps: 1 });
        expect((await fixture.store.load(canvasId))!.state).toEqual(state);
      } finally { await fixture.store.close(); }
    });
  });
}
