import { afterEach, describe, expect, it } from "vitest";
import { groupChildren, groupContentBox, designSystem, opTouchesAreas, roundsOn, registerModule, unregisterModule, itemKind } from "@isocan/core";
import type { Item, Operation } from "@isocan/core";
import { groupFixture } from "../../../api/test/group-fixture.ts";
import competitionCore from "../src/core.ts";
import { DEFAULT_PACKS } from "../src/packdata.ts";
import { arenaPlan, findBout, laneOfItem, P } from "../src/bout.ts";

const blob = { blobHash: "acme_hash", mimeType: "text/markdown", filename: "Acme.md", size: 4 };
function plan(canvasId: string, target: Item | null = null) {
  const fighters = DEFAULT_PACKS.filter((pack) => ["kare", "rams"].includes(pack.id)).map((pack) => ({ source: competitionCore.name, pack }));
  return arenaPlan({ canvasId, groupMode: "groups", at: { x: 0, y: 0 }, brief: "Acme checkout", fighters, entryKind: "screen", mode: "exhibition", minutes: 20, decider: null, target,
    blobs: { brief: blob, lanes: Object.fromEntries(fighters.map(({ pack }) => [pack.id, { area: blob, card: { ...blob, mimeType: "application/vnd.isocan.fighter+json" }, design: blob, shelf: blob }])) },
  });
}
afterEach(() => unregisterModule(competitionCore.name));

describe("a competition on an explicit group canvas", () => {
  it("creates one bounded forest with reserved labels and one exact inverse", async () => {
    const f = groupFixture();
    const arena = plan(f.state.project.id);
    expect(arena.ops).toHaveLength(1);
    await f.client.sendOp(f.state.project.id, f.actor, arena.ops[0]!);
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]!.envelope.op).toMatchObject({ type: "group.change", action: { kind: "apply", change: { intent: "create" } } });
    const saved = structuredClone(f.state.canvas.items);
    for (const lane of arena.lanes) {
      const group = saved[lane.areaId]!;
      const content = groupContentBox(group);
      const members = groupChildren(f.state.canvas, lane.areaId);
      expect(group.properties.kind).toBe("group");
      expect(members).toHaveLength(3);
      for (const member of members) {
        expect(member.y).toBeGreaterThanOrEqual(content.y);
        expect(member.y + member.height + 28).toBeLessThanOrEqual(group.y + group.height - 24);
      }
    }
    f.undo();
    expect(f.state.canvas.items).toEqual({});
    const inverse = f.writes[0]!.inverse!;
    // Redo uses the inverse of undo, restoring the original stamped records.
    const { invertOperation } = await import("@isocan/core");
    const beforeUndo = { ...f.state, canvas: { ...f.state.canvas, items: saved, trash: [] } };
    const redo = invertOperation(beforeUndo, inverse)!;
    f.apply(redo);
    expect(f.state.canvas.items).toEqual(saved);
  });

  it("preserves a reference's distinct visual face while creating its new item", async () => {
    const f = groupFixture();
    f.card("itm_acme_source", "Acme source");
    const target = f.state.canvas.items.itm_acme_source!;
    const visual = { blobHash: "acme_visual", mimeType: "image/png", filename: "Acme.png", size: 20 };
    target.versions[0]!.visual = visual;
    const arena = plan(f.state.project.id, target);
    await f.client.sendOp(f.state.project.id, f.actor, arena.ops[0]!);
    const reference = groupChildren(f.state.canvas, arena.boutId).find((item) => item.title === "Reference — Acme source");
    expect(reference?.versions[0]?.visual).toEqual(visual);
    expect(reference?.versions[0]?.blobHash).toBe(target.versions[0]!.blobHash);
  });

  it("keeps nested ownership for design, wait, hand-in and curtains, and ignores overlapping outsiders", async () => {
    const f = groupFixture();
    const arena = plan(f.state.project.id);
    await f.client.sendOp(f.state.project.id, f.actor, arena.ops[0]!);
    const lane = arena.lanes[0]!.areaId;
    const inner = (await f.api.new("Acme nested", { size: { width: 500, height: 500 } })).itemId!;
    await f.api.add(lane, [inner], { place: true });
    const add: Operation = { type: "item.add", itemId: "itm_acme_entry", title: "Acme entry", width: 200, height: 160, version: { ...blob, id: "ver_acme", mimeType: "text/html" }, placement: { x: 0, y: 0 }, containerId: inner, groupPlacement: "auto" };
    await f.client.sendOp(f.state.project.id, f.actor, add);
    const entry = f.state.canvas.items.itm_acme_entry!;
    f.card("itm_outsider", "Acme outsider", entry.x, entry.y);
    const outsider = f.state.canvas.items.itm_outsider!;
    const bout = findBout(f.state.canvas, arena.boutId)!;
    expect(laneOfItem(f.state.canvas, bout, entry)?.area.id).toBe(lane);
    expect(laneOfItem(f.state.canvas, bout, outsider)).toBeNull();
    const system = designSystem(f.state.canvas, { at: entry });
    expect(system?.containerId).toBe(lane);
    expect(designSystem(f.state.canvas, { at: outsider })).toBeNull();
    expect(designSystem(f.state.canvas)).toBeNull();
    const update = (item: Item): Operation => ({ type: "item.update", itemId: item.id, patch: { title: "Acme revised" } });
    expect(opTouchesAreas(update(entry), [lane], f.state.canvas)).toBe(true);
    expect(opTouchesAreas(update(outsider), [lane], f.state.canvas)).toBe(false);
    await f.client.sendOp(f.state.project.id, f.actor, { type: "item.update", itemId: arena.boutId, patch: { properties: { [P.phase]: "voting", [P.until]: "2026-09-15T12:00:00Z" } } });
    registerModule(competitionCore);
    expect(roundsOn(f.state.canvas, entry)).toHaveLength(1);
    expect(roundsOn(f.state.canvas, outsider)).toEqual([]);
    await f.api.remove([entry.id], { toRoot: true });
    expect(designSystem(f.state.canvas, { at: f.state.canvas.items[entry.id]! })).toBeNull();
    expect(roundsOn(f.state.canvas, f.state.canvas.items[entry.id]!)).toEqual([]);
  });

  it("rejects an invalid prepared arena as a whole and removes the module without changing its files or ballots", async () => {
    const f = groupFixture();
    const arena = plan(f.state.project.id);
    const malformed = structuredClone(arena.ops[0]!);
    if (malformed.type !== "group.change" || malformed.action.kind !== "copy") throw new Error("expected prepared forest");
    malformed.action.items.at(-1)!.containerId = "itm_missing";
    const before = structuredClone(f.state);
    await expect(f.client.sendOp(f.state.project.id, f.actor, malformed)).rejects.toThrow();
    expect(f.state).toEqual(before);
    expect(f.writes).toHaveLength(0);
    await f.client.sendOp(f.state.project.id, f.actor, arena.ops[0]!);
    const card = Object.values(f.state.canvas.items).find((item) => item.versions[0]!.mimeType.includes("fighter"))!;
    registerModule(competitionCore);
    expect(itemKind(card)).toBe("fighter");
    const saved = JSON.stringify(f.state);
    unregisterModule(competitionCore.name);
    expect(itemKind(card)).toBe("other");
    expect(JSON.stringify(f.state)).toBe(saved);
    registerModule(competitionCore);
    expect(itemKind(card)).toBe("fighter");
    expect(JSON.stringify(f.state)).toBe(saved);
  });
});
