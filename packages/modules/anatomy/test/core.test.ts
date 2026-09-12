import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyOperation,
  invertOperation,
  registerModule,
  unregisterModule,
  itemKind,
  type CanvasState,
  type Operation,
} from "@isocan/core";
import {
  anatomyModule,
  readProject,
  nodesOn,
  projectEdges,
  currentVersion,
  originId,
  PROP,
  layoutProject,
  convergence,
  parseProject,
  projectNeighborhood,
} from "../src/core.ts";
import {
  commentOp,
  importProject,
  promoteMock,
  restoreCheckpoint,
  saveCheckpoint,
  saveEdge,
  saveNode,
  saveProject,
  requestAnalysis,
  type AnatomyIO,
} from "../src/operations.ts";
import { sampleProject } from "./fixture.ts";

function memory() {
  let seq = 0;
  let state: CanvasState | null = null;
  const actor = { id: "usr_test", name: "Test writer" };
  const blobs = new Map<string, string>();
  const batches: Operation[][] = [];
  const undo: Operation[][] = [];
  function apply(op: Operation) {
    state = applyOperation(state, {
      id: `op_${++seq}`,
      canvasId: op.type === "project.create" ? null : "prj_test",
      actor,
      ts: new Date(1780000000000 + seq * 1000).toISOString(),
      op,
    });
  }
  apply({
    type: "project.create",
    canvasId: "prj_test",
    title: "Synthetic test",
  });
  const io: AnatomyIO = {
    read: async (hash) => {
      if (!blobs.has(hash)) throw new Error("Missing blob");
      return blobs.get(hash)!;
    },
    put: async (text) => {
      const blobHash = createHash("sha256").update(text).digest("hex");
      blobs.set(blobHash, text);
      return { blobHash, size: Buffer.byteLength(text) };
    },
    snapshot: async () => state!.canvas,
    send: async (ops) => {
      const inverses: Operation[] = [];
      for (const op of ops) {
        const inverse = invertOperation(state, op);
        if (inverse) inverses.unshift(inverse);
        apply(op);
      }
      batches.push([...ops]);
      undo.push(inverses);
    },
  };
  return {
    io,
    batches,
    blobs,
    canvas: () => state!.canvas,
    project: () => state!.project,
    undo: () => {
      for (const op of undo.pop() ?? []) apply(op);
    },
  };
}

describe("Anatomy as native files and operations", () => {
  it("attaches an imported analysis to its canvas and undoes the association", async () => {
    const m = memory();
    const first = await importProject(m.io, sampleProject());
    expect(m.project().properties[PROP.analysis]).toBe(first);
    expect(m.project().properties[PROP.repository]).toBe("/example/acme");
    const second = await importProject(m.io, sampleProject());
    expect(m.project().properties[PROP.analysis]).toBe(second);
    m.undo();
    expect(m.project().properties[PROP.analysis]).toBe(first);
    expect(m.canvas().items[second]).toBeUndefined();
  });
  it("requests repository analysis through one reusable native Chat", async () => {
    const m = memory();
    await expect(requestAnalysis(m.io, "  ")).rejects.toThrow(
      "Associate a repository",
    );
    expect(m.batches).toHaveLength(0);
    await requestAnalysis(m.io, "/example/acme");
    await requestAnalysis(m.io, "/example/acme");
    const threads = Object.values(m.canvas().threads);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.main).toBe(true);
    expect(threads[0]!.comments).toHaveLength(2);
    expect(threads[0]!.comments[0]!.body).toContain("/anatomy /example/acme");
    expect(m.project().properties[PROP.repository]).toBe("/example/acme");
  });
  it("explores one hop including hierarchy and incoming/outgoing connections", () => {
    const p = sampleProject();
    p.edges.push({ id: "policy_state", from: "policy", to: "state" });
    const view = projectNeighborhood(p, "state");
    expect(view.focus.id).toBe("state");
    expect(view.ancestors.map((n) => n.id)).toEqual(["goal", "workflow"]);
    expect(view.nodes.map((n) => n.id)).toEqual([
      "workflow",
      "state",
      "policy",
    ]);
    expect(projectNeighborhood(p, "goal").nodes.map((n) => n.id)).toEqual([
      "goal",
      "workflow",
      "policy",
    ]);
    expect(view.edges).toHaveLength(2);
    expect(() => projectNeighborhood(p, "absent")).toThrow("Unknown concept");
  });
  it("bounds ancestry after native metadata edits introduce a cycle", () => {
    const p = sampleProject();
    p.nodes[0]!.parentId = "state";
    expect(projectNeighborhood(p, "state").ancestors.map((n) => n.id)).toEqual([
      "goal",
      "workflow",
    ]);
  });
  it("round-trips optional evidence, assessments, historical discussion and checkpoints", async () => {
    const m = memory(),
      p = sampleProject();
    p.checkpoints.push({
      id: "baseline",
      stepIndex: 0,
      title: "Baseline",
      timestamp: p.lastUpdated,
      triggerAxis: "bootstrap",
      triggerDescription: "Initial reading",
      convergenceScore: 50,
      nodes: p.nodes,
      edges: p.edges,
    });
    const id = await importProject(m.io, p);
    expect(
      await readProject(m.canvas(), m.canvas().items[id]!, m.io.read),
    ).toEqual(p);
    expect(nodesOn(m.canvas(), id)).toHaveLength(4);
    expect(projectEdges(m.canvas(), id)).toHaveLength(4);
    expect(m.batches).toHaveLength(1);
    const first = nodesOn(m.canvas(), id)[0]!;
    registerModule(anatomyModule);
    expect(itemKind(first)).toBe("anatomy-node");
    unregisterModule(anatomyModule.name);
    expect(itemKind(first)).toBe("other");
    expect(
      JSON.parse(await m.io.read(currentVersion(first).blobHash)),
    ).toHaveProperty("summary");
  });
  it.each(["duplicates", "cycle", "dangling", "unknown-field"])(
    "rejects %s before any blob or op is written",
    async (kind) => {
      const m = memory(),
        p = sampleProject();
      if (kind === "duplicates") p.nodes.push(p.nodes[0]!);
      if (kind === "cycle") p.nodes[0]!.parentId = "state";
      if (kind === "dangling") p.edges[0]!.to = "unknown";
      if (kind === "unknown-field")
        Object.assign(p.nodes[0]!, { unexpected: true });
      await expect(importProject(m.io, p)).rejects.toThrow();
      expect(m.blobs.size).toBe(0);
      expect(m.batches).toHaveLength(0);
    },
  );
  it("imports twice without cross-linking and gives all relationships native ids", async () => {
    const m = memory(),
      p = sampleProject();
    const a = await importProject(m.io, p),
      b = await importProject(m.io, p);
    const idsA = new Set(nodesOn(m.canvas(), a).map((i) => i.id));
    expect(nodesOn(m.canvas(), b).every((i) => !idsA.has(i.id))).toBe(true);
    expect(
      projectEdges(m.canvas(), b).every(
        (e) => !idsA.has(e.from.id) && !idsA.has(e.to.id),
      ),
    ).toBe(true);
    expect(
      await readProject(m.canvas(), m.canvas().items[b]!, m.io.read),
    ).toEqual(p);
  });
  it("native title and geometry are authoritative; layout and edits undo", async () => {
    const m = memory(),
      p = sampleProject(),
      id = await importProject(m.io, p);
    const item = nodesOn(m.canvas(), id)[0]!;
    await m.io.send([
      {
        type: "item.update",
        itemId: item.id,
        patch: { title: "Renamed concept" },
      },
      { type: "item.move", itemId: item.id, x: -99, y: 101 },
    ]);
    expect(
      (await readProject(m.canvas(), m.canvas().items[id]!, m.io.read))
        .nodes[0]!.title,
    ).toBe("Renamed concept");
    await m.io.send([
      { type: "items.move", moves: layoutProject(m.canvas(), id) },
    ]);
    m.undo();
    expect(m.canvas().items[item.id]!.x).toBe(-99);
    const before = await readProject(
      m.canvas(),
      m.canvas().items[id]!,
      m.io.read,
    );
    await saveNode(m.io, m.canvas(), m.canvas().items[id]!, before, {
      ...before.nodes[1],
      status: "settled",
      summary: "Recovery is explicit",
    });
    expect(
      (await readProject(m.canvas(), m.canvas().items[id]!, m.io.read))
        .nodes[1]!.status,
    ).toBe("settled");
    m.undo();
    expect(
      await readProject(m.canvas(), m.canvas().items[id]!, m.io.read),
    ).toEqual(before);
  });
  it("keeps discussion native during edits and includes it only for portable export", async () => {
    const m = memory(),
      id = await importProject(m.io, sampleProject());
    const item = nodesOn(m.canvas(), id)[1]!;
    await m.io.send([commentOp(m.canvas(), item, "A new comment")]);
    const p = await readProject(m.canvas(), m.canvas().items[id]!, m.io.read);
    expect(p.nodes[1]!.marginalia).toHaveLength(1);
    const exported = await readProject(
      m.canvas(),
      m.canvas().items[id]!,
      m.io.read,
      true,
    );
    expect(exported.nodes[1]!.marginalia).toHaveLength(2);
    await saveNode(m.io, m.canvas(), m.canvas().items[id]!, p, {
      ...p.nodes[1],
      summary: "Updated summary",
    });
    expect(
      JSON.parse(
        await m.io.read(currentVersion(m.canvas().items[item.id]!).blobHash),
      ).marginalia,
    ).toHaveLength(1);
  });
  it("checkpoint restore is scoped, retains matching positions/comments, and undoes", async () => {
    const m = memory(),
      a = await importProject(m.io, sampleProject()),
      b = await importProject(m.io, sampleProject());
    const aItem = m.canvas().items[a]!,
      original = await readProject(m.canvas(), aItem, m.io.read);
    await saveCheckpoint(m.io, aItem, original, "Baseline");
    const withCheckpoint = await readProject(m.canvas(), aItem, m.io.read);
    await saveNode(m.io, m.canvas(), aItem, withCheckpoint, {
      id: "extra",
      title: "Extra",
      summary: "Extra concept",
      category: "rules",
      status: "settled",
    });
    const before = await readProject(m.canvas(), aItem, m.io.read),
      untouched = nodesOn(m.canvas(), b);
    await restoreCheckpoint(
      m.io,
      m.canvas(),
      aItem,
      withCheckpoint.checkpoints[0],
    );
    expect(nodesOn(m.canvas(), a)).toHaveLength(4);
    expect(nodesOn(m.canvas(), b)).toEqual(untouched);
    expect(nodesOn(m.canvas(), a).map((i) => originId(i))).toEqual(
      original.nodes.map((n) => n.id),
    );
    m.undo();
    expect(await readProject(m.canvas(), aItem, m.io.read)).toEqual(before);
  });
  it("promotes a sandboxed proposal through normal file versions in one undo group", async () => {
    const m = memory(),
      p = sampleProject();
    p.nodes[1]!.proposedMock = {
      title: "Recovery",
      htmlContent: "<h1>Choose a new delivery</h1>",
      proposedConstraints: ["A customer chooses a new date"],
      status: "draft",
      updatedAt: p.lastUpdated,
    };
    const id = await importProject(m.io, p),
      item = m.canvas().items[id]!;
    await promoteMock(m.io, m.canvas(), item, p, p.nodes[1]!);
    const updated = await readProject(
      m.canvas(),
      m.canvas().items[id]!,
      m.io.read,
    );
    expect(updated.sources).toHaveLength(3);
    expect(updated.nodes[1]!.status).toBe("settled");
    expect(
      Object.values(m.canvas().items).filter((i) => i.properties[PROP.source]),
    ).toHaveLength(1);
    expect(m.batches.at(-1)?.map((o) => o.type)).toEqual([
      "item.add",
      "item.addVersion",
      "item.addVersion",
    ]);
    m.undo();
    expect(
      await readProject(m.canvas(), m.canvas().items[id]!, m.io.read),
    ).toEqual(p);
  });
  it("moving an edge to a different source removes its previous copy", async () => {
    const m = memory(),
      p = sampleProject(),
      id = await importProject(m.io, p);
    await saveEdge(m.io, m.canvas(), m.canvas().items[id]!, p, {
      ...p.edges[0],
      from: "policy",
    });
    const graph = await readProject(
      m.canvas(),
      m.canvas().items[id]!,
      m.io.read,
    );
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.from).toBe("policy");
  });
  it("lets a concept draft survive unrelated movement and metadata echoes", async () => {
    const m = memory(),
      p = sampleProject(),
      id = await importProject(m.io, p);
    const snapshot = m.canvas(),
      item = nodesOn(snapshot, id)[1]!;
    await m.io.send([
      { type: "item.move", itemId: item.id, x: 99, y: 42 },
      { type: "item.update", itemId: item.id, patch: { title: item.title } },
    ]);
    await saveNode(m.io, snapshot, snapshot.items[id]!, p, {
      ...p.nodes[1],
      summary: "A fresh draft",
    });
    expect(
      (await readProject(m.canvas(), m.canvas().items[id]!, m.io.read))
        .nodes[1]!.summary,
    ).toBe("A fresh draft");
    expect(m.canvas().items[item.id]!.x).toBe(99);
  });
  it("refuses a version that changed during an upload", async () => {
    const m = memory(),
      p = sampleProject(),
      id = await importProject(m.io, p),
      item = m.canvas().items[id]!;
    const originalPut = m.io.put;
    m.io.put = async (...args) => {
      const result = await originalPut(...args);
      await m.io.send([
        {
          type: "item.update",
          itemId: id,
          patch: { title: "Collaborator edit" },
        },
      ]);
      return result;
    };
    await expect(
      saveProject(m.io, item, { ...p, goalStatement: "Stale change" }),
    ).rejects.toThrow("changed while editing");
  });
  it("allows independent concept edits and refuses an old file against a fresh snapshot", async () => {
    const m = memory(), p = sampleProject(), id = await importProject(m.io, p);
    const before = m.canvas(), item = before.items[id]!;
    const original = nodesOn(before, id)[1]!;
    const base = { versionId: original.currentVersionId, title: original.title, properties: original.properties };
    await saveNode(m.io, before, item, p, { ...p.nodes[3], summary: "Independent change" });
    await saveNode(m.io, before, item, p, { ...p.nodes[1], evidence: [{ sourceId: "latest", snippet: "New evidence" }] });
    const now = m.canvas(), current = await readProject(now, now.items[id]!, m.io.read);
    await expect(saveNode(m.io, now, now.items[id]!, current, { ...p.nodes[1], summary: "Stale file" }, base)).rejects.toThrow("changed while editing");
    expect((await readProject(m.canvas(), m.canvas().items[id]!, m.io.read)).nodes[1]!.evidence[0]!.sourceId).toBe("latest");
  });
  it("does not manufacture assessment or convergence for an empty graph", () => {
    expect(convergence([])).toBe(0);
    expect(
      parseProject({
        id: "empty",
        projectName: "Empty",
        nodes: [],
        lastUpdated: "today",
      }).nodes,
    ).toEqual([]);
    expect(sampleProject().nodes[2]!.lenses).toBeUndefined();
  });
});
