import { recoverFile } from "../src/recovery.ts";
import { describe, expect, it } from "vitest";
import { newVersionId } from "@isocan/core";
import { currentVersion, nodesOn, PROP, readProject } from "../src/core.ts";
import { inspectProject } from "../src/diagnostics.ts";
import { importProject, saveCheckpoint } from "../src/operations.ts";
import { memory } from "./memory.ts";
import { sampleProject } from "./fixture.ts";

async function fixture() {
  const m = memory();
  const id = await importProject(m.io, sampleProject());
  const inspect = () => inspectProject(m.canvas(), m.canvas().items[id]!, m.io.read);
  const corrupt = async (itemId: string) => {
    const item = m.canvas().items[itemId]!;
    const blob = await m.io.put("{broken", currentVersion(item).mimeType, "broken.json");
    await m.io.send([{ type: "item.addVersion", itemId, version: { ...currentVersion(item), ...blob, id: newVersionId() } }]);
  };
  return { ...m, id, inspect, corrupt };
}
describe("recoverable Anatomy reads", () => {
  it("keeps healthy nodes and native repair IDs while strict export refuses omitted content", async () => {
    const m = await fixture();
    const broken = nodesOn(m.canvas(), m.id).find(i => i.properties[PROP.origin] === "workflow")!;
    await m.corrupt(broken.id);
    const before = JSON.stringify(m.canvas());
    const result = await m.inspect();
    expect(result.project!.nodes).toHaveLength(3);
    expect(result.project!.nodes.find(n => n.id === "state")!.parentId).toBeUndefined();
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: broken.id, section: "concept" })]));
    expect(Object.keys(result.items)).toHaveLength(3);
    expect(JSON.stringify(m.canvas())).toBe(before);
    await expect(readProject(m.canvas(), m.canvas().items[m.id]!, m.io.read)).rejects.toThrow();
    m.undo();
    expect((await m.inspect()).diagnostics).toEqual([]);
  });
  it("isolates a corrupt optional checkpoint from the current graph", async () => {
    const m = await fixture();
    await saveCheckpoint(m.io, m.canvas().items[m.id]!, sampleProject(), "Baseline");
    const checkpoint = Object.values(m.canvas().items).find(i => currentVersion(i).mimeType.includes("checkpoint"))!;
    await m.corrupt(checkpoint.id);
    const result = await m.inspect();
    expect(result.project!.nodes).toHaveLength(4);
    expect(result.project!.checkpoints).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({ itemId: checkpoint.id, section: "checkpoint" });
  });
  it("bounds parent cycles and isolates malformed relationships without losing node bodies", async () => {
    const m = await fixture();
    const files = nodesOn(m.canvas(), m.id);
    await m.io.send([{ type: "item.update", itemId: files[0]!.id, patch: { properties: { [PROP.parent]: files[1]!.id, [PROP.edges]: "invalid" } } }]);
    const result = await m.inspect();
    expect(result.project!.nodes).toHaveLength(4);
    expect(result.diagnostics.some(d => d.message.includes("cycle"))).toBe(true);
    expect(result.diagnostics.filter(d => d.section === "relationships").length).toBeGreaterThanOrEqual(2);
  });
  it("does not choose arbitrarily between duplicate concept identities", async () => {
    const m = await fixture();
    const files = nodesOn(m.canvas(), m.id);
    await m.io.send([{ type: "item.update", itemId: files[1]!.id, patch: { properties: { [PROP.origin]: files[0]!.properties[PROP.origin]! } } }]);
    const result = await m.inspect();
    expect(result.project!.nodes).toHaveLength(2);
    expect(result.diagnostics.filter(d => d.section === "concept")).toHaveLength(2);
  });
  it("reports a failed root read without returning a stale or invented project", async () => {
    const m = await fixture();
    await m.corrupt(m.id);
    expect(await m.inspect()).toMatchObject({ project: null, diagnostics: [{ itemId: m.id, section: "overview" }] });
    m.undo();
    expect((await m.inspect()).project!.nodes).toHaveLength(4);
  });
  it("restores only a chosen validated body, refuses stale recovery, and preserves native anchors", async () => {
    const m = await fixture();
    const file = nodesOn(m.canvas(), m.id)[1]!;
    const version = file.currentVersionId;
    await m.corrupt(file.id);
    const broken = m.canvas().items[file.id]!;
    await expect(recoverFile(m.io, m.id, broken, broken.currentVersionId)).rejects.toThrow();
    await recoverFile(m.io, m.id, broken, version);
    expect((await m.inspect()).diagnostics).toEqual([]);
    expect(m.canvas().items[file.id]).toMatchObject({ id: file.id, x: file.x, y: file.y, properties: file.properties });
    await expect(recoverFile(m.io, m.id, broken, version)).rejects.toThrow();
    m.undo();
    expect((await m.inspect()).diagnostics.length).toBeGreaterThan(0);
  });

});
