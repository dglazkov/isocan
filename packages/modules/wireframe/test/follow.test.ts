import { describe, expect, it } from "vitest";
import { applyOperation, invertOperation, newGroupId, type CanvasState, type Operation } from "@isocan/core";
import { PROTOTYPE_AT_PROP, PROTOTYPE_PROP, composeFlow, followMarks, keepPatch, stubAnswerer, type WirePort } from "../src/core.ts";

/**
 * **The prototype follows its marks** (`follow.ts`), against the real
 * reducer: a screen used in the prototype or removed from it re-versions the
 * flow's prototype in the mark's own group, and undoing that group — the
 * inverse of every op in it, as the home does — takes back both.
 */

const REQUEST = "a delivery app for Acme couriers — sign in, see today's deliveries, confirm a drop-off";

function reducerPort() {
  const actor = { id: "usr_acme", name: "Acme" };
  const canvasId = "prj_acme";
  let seq = 0;
  const apply = (s: CanvasState | null, op: Operation) => applyOperation(s, { id: `op_${++seq}`, canvasId, actor, ts: "2026-09-24T00:00:00.000Z", op })!;
  let state = apply(null, { type: "project.create", canvasId, title: "Acme" });
  const blobs = new Map<string, string>();
  const log: Array<{ op: Operation; inverse: Operation | null; group: string }> = [];
  const port: WirePort = {
    canvasId,
    actor,
    canvas: async () => state.canvas,
    readText: async (hash) => blobs.get(hash)!,
    put: async (text) => {
      const blobHash = `hash_${blobs.size + 1}`;
      blobs.set(blobHash, text);
      return { blobHash, size: text.length };
    },
    send: async (op, group) => {
      log.push({ op, inverse: invertOperation(state, op), group });
      state = apply(state, op);
      if (op.type !== "item.add") return;
      const it = state.canvas.items[op.itemId]!;
      return { x: it.x, y: it.y };
    },
  };
  const item = (id: string) => state.canvas.items[id]!;
  const html = (id: string) => blobs.get(item(id).versions.find((v) => v.id === item(id).currentVersionId)!.blobHash)!;
  const undo = (group: string) => {
    for (const { inverse } of log.filter((l) => l.group === group).reverse()) if (inverse) state = apply(state, inverse);
  };
  /** A person's gesture: the marks, then what follows — one group, as the shell and the CLI send it. */
  const mark = async (ids: string[], on: boolean) => {
    const group = newGroupId();
    for (const id of ids) await port.send({ type: "item.update", itemId: id, patch: keepPatch(on, actor.id) }, group);
    const followed = await followMarks(port, ids, group);
    return { group, followed, ops: log.filter((l) => l.group === group).map((l) => l.op) };
  };
  return { port, log, item, html, undo, mark };
}

async function composed(h: ReturnType<typeof reducerPort>, flesh = true) {
  const flow = await composeFlow(h.port, REQUEST, stubAnswerer(4), flesh ? {} : { flesh: false });
  const variation = flow.variants.find((v) => flow.prototype?.screens.some((s) => s.item === v.spec.variantOf) ?? true)!;
  return { flow, variation };
}

describe("the prototype follows its marks", () => {
  it("using a variation re-versions the prototype with it, in the mark's group — and one undo takes back both", async () => {
    const h = reducerPort();
    const { flow, variation } = await composed(h);
    const proto = flow.prototype!.itemId;
    const before = { version: h.item(proto).currentVersionId, versions: h.item(proto).versions.length };
    expect(h.html(proto)).not.toContain(`data-screen="${variation.item}"`);

    const { group, followed, ops } = await h.mark([variation.item], true);
    expect(followed).toEqual([{ flow: flow.flow, itemId: proto, what: "versioned", screens: flow.prototype!.screens.length + 1 }]);
    expect(ops[0]).toMatchObject({ type: "item.update", itemId: variation.item });
    expect(ops.some((op) => op.type === "item.addVersion" && op.itemId === proto)).toBe(true);
    expect(h.item(proto).versions.length).toBe(before.versions + 1);
    expect(h.html(proto)).toContain(`data-screen="${variation.item}"`);

    h.undo(group);
    expect(h.item(variation.item).properties?.wireKeep).toBeUndefined();
    expect(h.item(proto).currentVersionId).toBe(before.version);
    expect(h.html(proto)).not.toContain(`data-screen="${variation.item}"`);
  });

  it("removing a pick re-versions it without the screen, and one undo puts both back", async () => {
    const h = reducerPort();
    const { flow } = await composed(h);
    const proto = flow.prototype!.itemId;
    const pick = flow.prototype!.screens[1]!.item;
    const before = h.item(proto).currentVersionId;
    const { group, followed } = await h.mark([pick], false);
    expect(followed[0]).toMatchObject({ itemId: proto, what: "versioned", screens: flow.prototype!.screens.length - 1 });
    expect(h.html(proto)).not.toContain(`data-screen="${pick}"`);
    h.undo(group);
    expect(h.item(pick).properties).toMatchObject({ wireKeep: "yes", wireKeepBy: "stub" });
    expect(h.item(proto).currentVersionId).toBe(before);
  });

  it("marks never make a prototype: a flow without one stays without", async () => {
    const h = reducerPort();
    const { flow } = await composed(h, false);
    expect(flow.prototype).toBeUndefined();
    const { followed, ops } = await h.mark([flow.screens[0]!.item, flow.screens[1]!.item], true);
    expect(followed).toEqual([]);
    expect(ops.every((op) => op.type === "item.update")).toBe(true);
    expect(Object.values((await h.port.canvas()).items).some((i) => i.properties?.[PROTOTYPE_PROP] !== undefined)).toBe(false);
  });

  it("a prototype somebody moved stays where they put it; only its content re-versions", async () => {
    const h = reducerPort();
    const { flow, variation } = await composed(h);
    const proto = flow.prototype!.itemId;
    await h.port.send({ type: "item.move", itemId: proto, x: -4000, y: -3000 }, newGroupId());
    const { ops } = await h.mark([variation.item], true);
    expect(ops.some((op) => op.type === "item.move")).toBe(false);
    expect(h.item(proto)).toMatchObject({ x: -4000, y: -3000 });
    expect(h.html(proto)).toContain(`data-screen="${variation.item}"`);
    // The composer's own record of where it put it is untouched: the move was a person's.
    expect(h.item(proto).properties?.[PROTOTYPE_AT_PROP]).not.toBe("-4000,-3000");
  });

  it("each press is its own group with its own rebuild, reading the canvas the press left", async () => {
    const h = reducerPort();
    const { flow } = await composed(h);
    const proto = flow.prototype!.itemId;
    const [a, b] = [flow.prototype!.screens[0]!.item, flow.prototype!.screens[1]!.item];
    const one = await h.mark([a], false);
    const two = await h.mark([b], false);
    expect(one.group).not.toBe(two.group);
    expect(one.followed[0]!.screens).toBe(flow.prototype!.screens.length - 1);
    expect(two.followed[0]!.screens).toBe(flow.prototype!.screens.length - 2);
    expect(h.html(proto)).not.toContain(`data-screen="${a}"`);
    expect(h.html(proto)).not.toContain(`data-screen="${b}"`);
  });
});
