import { describe, expect, it } from "vitest";
import { applyOperation, invertOperation, resolveCanvasGroupRequest, type CanvasState, type LogEntry, type Operation } from "@isocan/core";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { MemoryObjects } from "./memory-objects.ts";

const gate = cloudGate();
const actor = { id: "usr_acme", name: "Acme" };
const canvasId = "prj_cloud_groups";
const version = (id: string) => ({ id, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: "Acme.md", size: 4 });

if (!gate.ok && requireEmulator()) {
  it("requires the Firestore emulator for group persistence", () => { throw new Error(gate.skip); });
} else {
  describe(`CloudStore canvas-group cohorts${gate.ok ? "" : ` [SKIPPED: ${gate.skip}]`}`, () => {
    const test = gate.ok ? it : it.skip;
    test("snapshot restart retains deletion membership and the skipped-member roster", async () => {
      const objects = new MemoryObjects();
      let fixture = makeCloudStore({ objects, snapshotEveryOps: 1 });
      const projectId = fixture.projectId;
      let state: CanvasState | null = null;
      let seq = 0;
      const write = async (op: Operation) => {
        const id = `op_cloud_group_${++seq}`;
        const ts = "2026-09-12T00:00:00.000Z";
        const resolved = state ? resolveCanvasGroupRequest(state, op, { actor, ts, opId: id }) : op;
        const envelope = { id, canvasId, actor, ts, op: resolved };
        const entry: LogEntry = { seq, envelope, inverse: invertOperation(state, resolved) };
        state = applyOperation(state, envelope)!;
        await fixture.store.appendLog(canvasId, entry);
        await fixture.store.saveSnapshot(canvasId, state, seq);
        return entry;
      };
      try {
        await fixture.store.createCanvasDir(canvasId);
        await write({ type: "project.create", canvasId, title: "Acme", groupMode: "groups" });
        for (const [itemId, x] of [["itm_a", 100], ["itm_b", 500]] as const) {
          await write({ type: "item.add", itemId, title: "Acme card", version: version(`ver_${itemId}`), placement: { x, y: 200, chosen: true }, width: 200, height: 150 });
        }
        await write({ type: "group.change", action: { kind: "create", group: { id: "itm_group", title: "Acme group", version: version("ver_group") }, itemIds: ["itm_a", "itm_b"] } });
        await write({ type: "group.change", action: { kind: "delete", itemIds: ["itm_group"] } });
        await write({ type: "group.change", action: { kind: "restore", itemIds: ["itm_a"] } });
        const expected = structuredClone(state!);
        await fixture.store.close();
        fixture = makeCloudStore({ objects, projectId, snapshotEveryOps: 1 });
        const loaded = await fixture.store.load(canvasId);
        expect(loaded!.state).toEqual(expected);
        expect(Object.keys(loaded!.state.canvas.groupCohorts ?? {})).toHaveLength(1);
        state = loaded!.state;
        const restored = await write({ type: "group.change", action: { kind: "restore", itemIds: ["itm_group"] } });
        if (restored.envelope.op.type !== "group.change" || restored.envelope.op.action.kind !== "apply") throw new Error("not canonical");
        expect(restored.envelope.op.action.change.skippedIds).toContain("itm_a");
        expect(state!.canvas.items.itm_b!.containerId).toBe("itm_group");
        expect(state!.canvas.items.itm_a!.containerId).toBeUndefined();
      } finally {
        await fixture.store.close();
      }
    });
  });
}
