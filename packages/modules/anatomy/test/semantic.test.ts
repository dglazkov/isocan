import { describe, expect, it } from "vitest";
import { memory } from "./memory.ts";
import { sampleProject } from "./fixture.ts";
import { importProject, loadProject, saveEdge, removeEdge, saveNode } from "../src/operations.ts";
import { nodesOn, originId, PROP } from "../src/core.ts";
import { patchConcept, resolveDecision } from "../src/semantic.ts";
import { applyGraphReview, prepareGraphReview, graphDifferences } from "../src/graph-review.ts";

async function setup() {
  const m = memory();
  const id = await importProject(m.io, sampleProject());
  const load = () => loadProject(m.io, id);
  return { ...m, id, load, initial: await load() };
}

describe("semantic edits", () => {
  it("patches one field by native ID without replacing evidence, options or assessments", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const native = nodesOn(canvas, item.id).find(i => originId(i) === "workflow")!;
    const before = project.nodes.find(n => n.id === "workflow")!;
    const receipt = await patchConcept(m.io, canvas, item, project, native.id, { title: "Revised workflow" });
    expect(receipt).toMatchObject({ itemId: native.id, conceptId: "workflow" });
    const after = (await m.load()).project.nodes.find(n => n.id === "workflow")!;
    expect(after).toEqual({ ...before, title: "Revised workflow" });
    m.undo();
    expect((await m.load()).project.nodes).toEqual(project.nodes);
  });

  it("resolves an explicit option, preserves discipline assessments, and rejects unknown input without writes", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const count = m.batches.length;
    await expect(resolveDecision(m.io, canvas, item, project, "workflow", "missing-option")).rejects.toThrow("resolution option");
    await expect(patchConcept(m.io, canvas, item, project, "workflow", { typo: "ignored?" })).rejects.toThrow();
    await expect(patchConcept(m.io, canvas, item, project, "goal", { parentId: "workflow" })).rejects.toThrow();
    expect(m.batches).toHaveLength(count);
    await resolveDecision(m.io, canvas, item, project, "workflow", "recover");
    const node = (await m.load()).project.nodes.find(n => n.id === "workflow")!;
    expect(node).toMatchObject({ status: "settled", reason: "Resolved: Add a recovery step", lenses: project.nodes.find(n => n.id === "workflow")!.lenses });
    expect(node.evidence).toEqual(project.nodes.find(n => n.id === "workflow")!.evidence);
  });

  it("moves a relationship's source in one operation and removes it with one undo", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const edge = project.edges[0]!;
    await saveEdge(m.io, canvas, item, project, { ...edge, from: "goal", label: "Revised relation" });
    expect(m.batches.at(-1)!.map(op => op.type)).toEqual(["items.change"]);
    let next = await m.load();
    expect(next.project.edges.filter(e => e.id === edge.id)).toEqual([{ ...edge, from: "goal", label: "Revised relation" }]);
    await removeEdge(m.io, next.canvas, next.item, next.project, edge.id);
    expect((await m.load()).project.edges.some(e => e.id === edge.id)).toBe(false);
    m.undo(); m.undo();
    expect((await m.load()).project.edges).toEqual(project.edges);
  });
});

describe("reviewed concept graphs", () => {
  it("refuses to review or mutate a diagnostic subset after native relationship metadata breaks", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const native = nodesOn(canvas, item.id).find(i => originId(i) === "workflow")!;
    await m.io.send([{ type: "item.update", itemId: native.id, patch: { properties: { [PROP.edges]: "{broken" } } }]);
    await expect(m.load()).rejects.toThrow("Repair Anatomy files");
    const current = m.canvas();
    const plan = prepareGraphReview(current, item, project, project, m.project().id);
    await expect(applyGraphReview(m.io, plan)).rejects.toThrow("Repair Anatomy files");
  });

  it("previews field/edge changes and applies one op without revising unchanged concepts or overwriting native geometry/comments", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const proposal = structuredClone(project);
    proposal.nodes.find(n => n.id === "workflow")!.summary = "A reviewed workflow.";
    proposal.edges[0]!.label = "Reviewed relation";
    const plan = prepareGraphReview(canvas, item, project, proposal, m.project().id);
    expect(graphDifferences(plan).concepts).toMatchObject([{ id: "workflow", kind: "change", fields: ["summary"] }]);
    const native = nodesOn(canvas, item.id).find(i => originId(i) === "workflow")!;
    await m.io.send([{ type: "item.move", itemId: native.id, x: 987, y: 765 }, { type: "thread.create", threadId: "thr_review", anchorItemId: native.id, x: 0, y: 0, comment: { id: "cmt_review", body: "Reviewing this" } }]);
    await applyGraphReview(m.io, JSON.parse(JSON.stringify(plan)));
    expect(m.batches.at(-1)!.map(op => op.type)).toEqual(["items.change"]);
    const next = await m.load();
    expect(next.project.nodes).toEqual(proposal.nodes);
    expect(next.project.edges).toEqual(proposal.edges);
    expect(next.canvas.items[native.id]!.x).toBe(987);
    expect(next.canvas.threads.thr_review!.anchorItemId).toBe(native.id);
    for (const unchanged of nodesOn(canvas, item.id).filter(i => i.id !== native.id))
      expect(next.canvas.items[unchanged.id]!.versions).toEqual(unchanged.versions);
    expect(next.canvas.items[item.id]).toEqual(item);
    m.undo();
    expect((await m.load()).project.nodes).toEqual(project.nodes);
  });

  it("restores the original native ID, comments and position from trash while removing only unwanted concepts", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const removed = nodesOn(canvas, item.id).find(i => originId(i) === "policy")!;
    await m.io.send([{ type: "thread.create", threadId: "thr_policy", anchorItemId: removed.id, x: 1, y: 2, comment: { id: "cmt_policy", body: "Keep this discussion" } }, { type: "item.delete", itemId: removed.id }]);
    let current = await m.load();
    await saveNode(m.io, current.canvas, current.item, current.project, { ...project.nodes[0], id: "temporary", title: "Temporary concept" });
    current = await m.load();
    const plan = prepareGraphReview(current.canvas, current.item, current.project, project, m.project().id);
    expect(graphDifferences(plan).concepts).toEqual(expect.arrayContaining([expect.objectContaining({ id: "policy", kind: "restore" }), expect.objectContaining({ id: "temporary", kind: "remove" })]));
    await applyGraphReview(m.io, plan);
    const next = await m.load();
    expect(next.canvas.items[removed.id]).toMatchObject({ x: removed.x, y: removed.y });
    expect(next.canvas.items[removed.id]!.versions[0]).toEqual(removed.versions[0]);
    expect(next.canvas.threads.thr_policy!.anchorItemId).toBe(removed.id);
    expect(new Set(next.project.nodes.map(n => n.id))).toEqual(new Set(project.nodes.map(n => n.id)));
    m.undo();
    expect((await m.load()).project.nodes).toEqual(current.project.nodes);
  });

  it("rejects content and membership races at submission, with no partial updates", async () => {
    for (const membership of [false, true]) {
      const m = await setup(), { canvas, item, project } = m.initial;
      const proposal = structuredClone(project);
      proposal.nodes[0]!.summary = "Reviewed change";
      const plan = prepareGraphReview(canvas, item, project, proposal, m.project().id);
      const native = nodesOn(canvas, item.id)[1]!;
      const send = m.io.send;
      const racing = { ...m.io, send: async (...args: Parameters<typeof send>) => {
        await send(membership ? [{ type: "item.delete", itemId: native.id }] : [{ type: "item.update", itemId: native.id, patch: { title: "Concurrent title" } }]);
        const before = structuredClone(m.canvas());
        await expect(send(...args)).rejects.toThrow(/changed since review/);
        expect(m.canvas()).toEqual(before);
        throw new Error("Verified conflict");
      } };
      await expect(applyGraphReview(racing, plan)).rejects.toThrow("Verified conflict");
      const untouched = nodesOn(canvas, item.id).find(i => originId(i) === project.nodes[0]!.id)!;
      expect(m.canvas().items[untouched.id]!.currentVersionId).toBe(untouched.currentVersionId);
    }
  });

  it("rejects another canvas, tampered bindings and ambiguous trash; unchanged review writes nothing", async () => {
    const m = await setup(), { canvas, item, project } = m.initial;
    const plan = prepareGraphReview(canvas, item, project, project, m.project().id);
    const count = m.batches.length;
    expect((await applyGraphReview(m.io, plan)).status).toBe("unchanged");
    expect(m.batches).toHaveLength(count);
    await expect(applyGraphReview(m.io, { ...plan, canvasId: "prj_elsewhere" })).rejects.toThrow("another canvas");
    const tampered = structuredClone(plan); tampered.bindings[0]!.itemId = item.id;
    await expect(applyGraphReview(m.io, tampered)).rejects.toThrow(/base|Duplicate/);
    const removed = nodesOn(canvas, item.id).find(i => originId(i) === "policy")!;
    await m.io.send([{ type: "item.delete", itemId: removed.id }]);
    const current = await m.load();
    const ambiguous = { ...current.canvas, trash: [...current.canvas.trash, { ...current.canvas.trash[0]!, item: { ...removed, id: "itm_duplicate" } }] };
    expect(() => prepareGraphReview(ambiguous, current.item, current.project, project, m.project().id)).toThrow("Multiple trashed items");
  });
});
