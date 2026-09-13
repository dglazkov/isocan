import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { resolveCanvasGroupRef } from "@isocan/api";
import { stickersCli } from "../../modules/stickers/src/cli.ts";
import { mindmapCli } from "../../modules/mindmap/src/cli.ts";
import { MAP_PARENT_PROP } from "../../modules/mindmap/src/core.ts";
import { groupFixture } from "../../api/test/group-fixture.ts";
import { groupPlacementFor, insertionOperation, insertionReceiptPlacement } from "../src/group-placement.ts";
import type { CliHost, Ctx } from "../src/modulehost.ts";

afterEach(() => vi.restoreAllMocks());

function moduleCommands(f: ReturnType<typeof groupFixture>) {
  const program = new Command();
  const printed: any[] = [];
  const ctx = { actor: f.actor, client: f.client, json: true } as unknown as Ctx;
  const host: CliHost = {
    program, run: (fn) => fn, ctxOf: async () => ctx,
    resolveCanvas: async () => f.state.project,
    resolveItem: (snapshot, ref) => resolveCanvasGroupRef(snapshot.canvas, ref),
    sendOp: async (_ctx, canvasId, op) => f.client.sendOp(canvasId, f.actor, insertionOperation(op)),
    insertionReceiptPlacement, printJson: (value) => printed.push(value),
    sizeFor: (_spec, fallback) => fallback,
    placementFor: (snapshot, options) => {
      const grouped = groupPlacementFor(snapshot, options);
      if (grouped) return grouped;
      if (options.at) { const [x, y] = options.at.split(",").map(Number); return { x, y, chosen: true }; }
      return { x: 0, y: 0 };
    },
    truncate: (text, max) => text.slice(0, max),
    runFenced: async () => { throw new Error("these modules do not run programs"); },
  };
  stickersCli.register(host); mindmapCli.register(host);
  return { program, printed };
}

describe("module CLI insertion on a group canvas", () => {
  it("runs sticker and map commands through explicit insertion, and gives a new map child its parent's container", async () => {
    const f = groupFixture();
    const parent = (await f.api.new("Acme workspace", { at: { x: 0, y: 0 }, size: { width: 1600, height: 1200 } })).itemId!;
    const { program, printed } = moduleCommands(f);
    const count = f.writes.length;
    await program.parseAsync(["node", "isocan", "sticker", "drop", "fire", "--in", parent]);
    const sticker = printed.at(-1);
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items[sticker.itemId]?.containerId).toBe(parent);
    expect(sticker.placement).toMatchObject({ x: 24, y: 80 });
    await program.parseAsync(["node", "isocan", "map", "new", "Acme", "--in", parent]);
    const root = printed.at(-1).rootId;
    expect(f.state.canvas.items[root]?.containerId).toBe(parent);
    await program.parseAsync(["node", "isocan", "map", "add", "Branch", "--to", root]);
    const child = printed.at(-1).itemId;
    expect(f.state.canvas.items[child]?.containerId).toBe(parent);
    expect(f.state.canvas.items[child]?.properties[MAP_PARENT_PROP]).toBe(root);
    expect(f.writes).toHaveLength(count + 3);
  });

  it("preserves legacy sticker placement and map-node JSON shapes through the registered commands", async () => {
    const f = groupFixture(false);
    const { program, printed } = moduleCommands(f);
    await program.parseAsync(["node", "isocan", "sticker", "drop", "fire", "--at", "120,160"]);
    const sticker = printed.at(-1);
    expect(sticker.placement).toEqual({ x: 120, y: 160, chosen: true });
    expect(f.state.canvas.items[sticker.itemId]).toMatchObject({ x: 120, y: 160 });
    await program.parseAsync(["node", "isocan", "map", "new", "Acme"]);
    const root = printed.at(-1).rootId;
    await program.parseAsync(["node", "isocan", "map", "add", "Branch", "--to", root]);
    expect(printed.at(-1)).toEqual({ itemId: expect.any(String), x: f.state.canvas.items[root]!.width + 60, y: 0 });
  });
});
