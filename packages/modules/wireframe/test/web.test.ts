import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import type { CliHost } from "@isocan/cli/modulehost";
import { moduleMarkPatch, parseDesign, type CanvasContents, type DialogHost, type Item, type Operation, type WebHost } from "@isocan/core";
import { WireBehind, restyleOnCanvas } from "../src/behind-marks.tsx";
import { checkWords, restyleLabel, wiresBehind } from "../src/behind.ts";
import { docs, specs } from "../src/spec-cache.ts";
import { styleMenu } from "../src/style-menu.ts";
import { ACME_WARM } from "./fixtures/design-systems.ts";
import { wireframeCore } from "../src/command.ts";
import wireframeCli from "../src/cli.ts";
import { keptArrows } from "../src/arrows.tsx";
import { composeOnWeb, copyOnWeb, fleshOnWeb, modeOf, nameOnWeb, presetOnWeb, prototypeRecordWords, restyleOnWeb } from "../src/dialog.tsx";
import { PLACEHOLDER_WORDS } from "../src/web-port.ts";
import { stubTextGenerator } from "@isocan/core/jev";
import type { TextRequest } from "@isocan/core/text";
import { presetText } from "../src/style-cli.ts";
import { WireMaybes } from "../src/maybe-marks.tsx";
import { KEEP_PROP, MAYBE_PROP, homeAnswerer, homeOrStub, readWire, renderWire, stubAnswerer, wireframe, type WireSpec } from "../src/core.ts";
import { wireframeActivation } from "../src/activation.ts";
import wireframeWeb from "../src/web.tsx";

/**
 * **The web door** (phase 5): the browser composes with the CLI's own
 * composer, so a request made from the Chat and one made from a terminal are
 * the same ops — held here by running both against the same seeded answers
 * and comparing what each sent. And the arrows between kept screens are
 * computed from the screens' specs, read out of their files — never from a
 * stored property.
 *
 * Synthetic throughout: Acme's couriers.
 */

interface FakeItem {
  id: string;
  title: string;
  properties: Record<string, string>;
  x: number;
  y: number;
  width: number;
  height: number;
  currentVersionId: string;
  versions: Array<{ id: string; blobHash: string; mimeType: string; filename?: string }>;
}

/** A canvas in memory that takes the four ops the composer sends — shared by both surfaces' fakes. */
function memoryCanvas() {
  const items = new Map<string, FakeItem>();
  const blobs = new Map<string, string>();
  const sent: Array<{ op: Operation; group?: string }> = [];
  const store = (text: string) => {
    const hash = `hash-${blobs.size + 1}`;
    blobs.set(hash, text);
    return hash;
  };
  const apply = (op: Operation, group?: string) => {
    sent.push({ op, ...(group ? { group } : {}) });
    if (op.type === "item.add") {
      const at = op.placement as { x: number; y: number };
      items.set(op.itemId, { id: op.itemId, title: op.title ?? "", properties: op.properties ?? {}, x: at.x, y: at.y, width: op.width, height: op.height, currentVersionId: op.version.id, versions: [op.version] });
    } else if (op.type === "item.addVersion") {
      const item = items.get(op.itemId)!;
      item.versions.push(op.version);
      item.currentVersionId = op.version.id;
    } else if (op.type === "item.update") {
      const item = items.get(op.itemId)!;
      if (op.patch.title) item.title = op.patch.title;
      if (op.patch.properties) item.properties = { ...item.properties, ...op.patch.properties };
      if (op.patch.removeProperties) {
        item.properties = { ...item.properties };
        for (const key of op.patch.removeProperties) delete item.properties[key];
      }
    } else if (op.type === "item.resize") {
      Object.assign(items.get(op.itemId)!, { width: op.width, height: op.height });
    } else if (op.type === "item.move") {
      // A prototype's rebuild puts it back over its flow when it is taller or wider than before.
      Object.assign(items.get(op.itemId)!, { x: op.x, y: op.y });
    } else if (op.type === "item.delete") {
      // `house` takes a wire style's DESIGN.md to the trash.
      items.delete(op.itemId);
    } else throw new Error(`the composer sent an op it should not: ${op.type}`);
  };
  const contents = () => ({ items: Object.fromEntries(items) }) as unknown as CanvasContents;
  return { items, blobs, sent, store, apply, contents };
}

/** Every op, with ids replaced by the order they first appeared in — the shape, not the names. */
function shapeOf(sent: Array<{ op: Operation; group?: string }>) {
  const ids = new Map<string, string>();
  const name = (id: string) => {
    if (!ids.has(id)) ids.set(id, `#${ids.size}`);
    return ids.get(id)!;
  };
  const groups = new Set(sent.map((s) => s.group));
  return {
    groups: groups.size,
    everyOpGrouped: sent.every((s) => s.group !== undefined),
    ops: sent.map(({ op }) => {
      const o = op as Operation & { itemId: string; placement?: { x: number; y: number }; title?: string; width?: number; height?: number; patch?: unknown; properties?: unknown };
      return {
        type: op.type,
        item: name(o.itemId),
        ...(o.placement ? { at: [o.placement.x, o.placement.y] } : {}),
        ...(o.title !== undefined ? { title: o.title } : {}),
        ...(o.width !== undefined ? { size: [o.width, o.height] } : {}),
        ...(o.patch !== undefined ? { patch: o.patch } : {}),
        // A prototype names its flow, whose id is minted per run: the shape is that it names the one group.
        ...(o.properties !== undefined ? { properties: { ...(o.properties as Record<string, string>), ...((o.properties as Record<string, string>).wirePrototype === [...groups][0] ? { wirePrototype: "<the flow>" } : {}) } } : {}),
      };
    }),
  };
}

const REQUEST = "a delivery app for Acme couriers — sign in, see today's deliveries, confirm a drop-off";
const SEED = 4;

async function viaCli(after: Array<string[] | ((c: ReturnType<typeof memoryCanvas>) => string[])> = [], compose: string[] = [], actor?: { id: string; name: string }) {
  const c = memoryCanvas();
  const program = new Command().exitOverride().option("--json");
  const ctx = {
    json: false,
    ...(actor ? { actor } : {}),
    client: {
      snapshot: async () => ({ canvas: c.contents(), project: {} }),
      uploadBlob: async (_canvas: string, bytes: Buffer) => {
        const hash = c.store(bytes.toString("utf8"));
        return { blobHash: hash, size: bytes.length };
      },
      downloadBlob: async (_canvas: string, hash: string) => Buffer.from(c.blobs.get(hash)!, "utf8"),
    },
  };
  const errors: string[] = [];
  const host = {
    program,
    run: (fn: (...args: any[]) => Promise<void>) => async (...args: any[]) => {
      try {
        await fn(...args);
      } catch (error) {
        errors.push((error as Error).message);
      }
    },
    ctxOf: async () => ctx,
    resolveCanvas: async () => ({ id: "canvas-acme", title: "Acme" }),
    resolveItem: (snapshot: { canvas: { items: Record<string, FakeItem> } }, ref: string) => snapshot.canvas.items[ref]!,
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation, group?: string) => {
      c.apply(op, group);
      return { envelope: { op } };
    },
    insertionReceiptPlacement: (op: Extract<Operation, { type: "item.add" }>) => op.placement,
    placementFor: () => ({ x: 0, y: 0 }),
  } as unknown as CliHost;
  wireframeCli.register(host);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await program.parseAsync(["node", "isocan", "wire", REQUEST, "--answerer", "stub", "--seed", String(SEED), ...compose]);
  for (const argv of after) await program.parseAsync(["node", "isocan", ...(typeof argv === "function" ? argv(c) : argv)]);
  log.mockRestore();
  expect(errors).toEqual([]);
  return c;
}

async function viaWeb(opts: { basic?: boolean } = {}) {
  const c = memoryCanvas();
  const asked: unknown[] = [];
  const stub = stubAnswerer(SEED);
  const host = {
    send: async (ops: readonly Operation[], group?: string) => {
      for (const op of ops) c.apply(op, group);
    },
    putBlob: async (bytes: Blob) => {
      const text = await bytes.text();
      return { blobHash: c.store(text), size: text.length };
    },
    readText: async (hash: string) => c.blobs.get(hash)!,
    getCanvas: () => c.contents(),
    // The home's judge, answering as the seeded stub would — what the route returns is the judge's answer shape.
    judge: async (question: { canvasId: string } & Record<string, unknown>) => {
      asked.push(question);
      const { canvasId: _c, ...request } = question;
      return (await stub.answer(request as never)).response;
    },
    notice: () => {},
    reveal: () => {},
    close: () => {},
  } as unknown as DialogHost;
  let blueprintAt = -1;
  const composed = await composeOnWeb("canvas-acme", host, REQUEST, () => {
    blueprintAt = c.sent.length;
  }, opts);
  return { c, asked, composed, blueprintAt, host };
}

describe("the web composes what the CLI composes", () => {
  it("sends the same ops, in the same order, under one group — blueprint first, filled in place", async () => {
    const cli = await viaCli();
    const web = await viaWeb();
    const a = shapeOf(cli.sent);
    const b = shapeOf(web.c.sent);
    expect(b).toEqual(a);
    expect(b.groups).toBe(1);
    expect(b.everyOpGrouped).toBe(true);

    // The first op is the request's blueprint, on the canvas before anything was asked.
    const first = web.c.sent[0]!.op as Extract<Operation, { type: "item.add" }>;
    expect(first.type).toBe("item.add");
    expect(web.blueprintAt).toBe(1);
    const firstSpec = readWire(web.c.blobs.get(first.version.blobHash)!)!;
    expect(firstSpec.round).toBe(0);
    expect(firstSpec.slots.every((s) => s.block === null)).toBe(true);

    // Every later write to a screen that exists is a version of it, not a new item.
    const added = new Set<string>();
    for (const { op } of web.c.sent) {
      if (op.type === "item.add") added.add(op.itemId);
      else expect(added.has((op as { itemId: string }).itemId)).toBe(true);
    }
    expect(web.c.sent.filter((s) => s.op.type === "item.addVersion").length).toBeGreaterThan(0);
    expect(web.c.items.get(first.itemId)!.versions.length).toBe(4);
    // Both arrive fleshed, from the same pack, in the same group.
    const specOf = (c: ReturnType<typeof memoryCanvas>, id: string) => {
      const it = c.items.get(id)!;
      return readWire(c.blobs.get(it.versions.find((v) => v.id === it.currentVersionId)!.blobHash)!)!;
    };
    expect(web.composed.pack?.pack).toBe("generic");
    for (const s of [...web.composed.screens, ...web.composed.variants]) expect(specOf(web.c, s.item).content?.pack).toBe("generic");
  });

  it("`/wire basic` composes what `wire --basic` composes: plain grey wires, no pack asked", async () => {
    const cli = await viaCli([], ["--basic"]);
    const web = await viaWeb({ basic: true });
    expect(shapeOf(web.c.sent)).toEqual(shapeOf(cli.sent));
    expect(web.composed.pack).toBeUndefined();
    expect(web.asked.some((q) => "pack" in ((q as { questions: object }).questions))).toBe(false);
  });

  it("ends with a prototype of the first choices, says so in the Chat's words, and the arrows are there at once", async () => {
    const web = await viaWeb();
    const proto = web.composed.prototype!;
    expect(proto).toBeDefined();
    // The home answered as the stub, so the stub's first choices — signed so on each screen.
    expect(proto.answerer).toBe("stub");
    for (const s of proto.screens) expect(web.c.items.get(s.item)!.properties).toMatchObject({ wireKeep: "yes", wireKeepBy: "stub" });
    expect(web.c.items.get(proto.itemId)!.properties).toMatchObject({ wirePrototype: web.composed.flow });
    expect(prototypeRecordWords(proto)).toBe(`Prototype of ${proto.screens.length} screens, the stub's first choices — swap in a variation with ⇧K and the prototype follows.`);
    expect(prototypeRecordWords({ ...proto, answerer: "jev" })).toMatch(/^Prototype of \d+ screens, Jev's first choices — swap in a variation with ⇧K/);
    expect(prototypeRecordWords(undefined)).toBeNull();
    // The arrows run between the screens in the prototype — drawn the moment the flow lands, no second act.
    const specByHash = (hash: string) => readWire(web.c.blobs.get(hash)!);
    expect(keptArrows(web.c.contents(), specByHash).length).toBeGreaterThan(0);
  });

  it("asks the home's judge for every round, naming the canvas — never the vendor, never with a key", async () => {
    const web = await viaWeb();
    expect(web.asked.length).toBeGreaterThan(2);
    for (const q of web.asked) {
      expect(q).toMatchObject({ canvasId: "canvas-acme" });
      expect(Object.keys(q as object).sort()).toEqual(["canvasId", "model", "questions", "state"]);
    }
    expect(web.composed.by).toBe("stub via the home");
  });
});

describe("the prototype follows its marks, the same on both surfaces", () => {
  const ACME = { id: "usr_acme", name: "Acme" };
  // The first variation of a screen in the prototype — the same one on both canvases, which fill in the same order.
  const swapIn = (c: ReturnType<typeof memoryCanvas>) => {
    const specOf = (i: FakeItem) => readWire(c.blobs.get(i.versions.find((v) => v.id === i.currentVersionId)!.blobHash)!);
    return [...c.items.values()].find((i) => {
      const of = specOf(i)?.variantOf;
      return of !== undefined && c.items.get(of)?.properties.wireKeep === "yes";
    })!;
  };

  it("⇧K on the web (the mark, then its `follow`) sends what `wire use` sends: the mark and the prototype's new version, one group", async () => {
    let before = 0;
    const cli = await viaCli([(c) => {
      before = c.sent.length;
      return ["wire", "use", swapIn(c).id];
    }], [], ACME);
    const cliOps = cli.sent.slice(before);

    const web = await viaWeb();
    const start = web.c.sent.length;
    const variation = swapIn(web.c);
    // What the shell's toggle does (`menuentries.tsx`): the signed mark in a new group, then the registered mark's `follow` in it.
    const mark = wireframeCore.marks![0]!;
    const group = "grp_acme_press";
    await web.host.send([{ type: "item.update", itemId: variation.id, patch: moduleMarkPatch(mark.property, true, ACME.id) }], group);
    await mark.follow!({ canvasId: "canvas-acme", group, changed: [web.c.items.get(variation.id) as unknown as Item], on: true, host: { ...web.host, viewer: ACME } });
    const webOps = web.c.sent.slice(start);

    expect(shapeOf(webOps).ops).toEqual(shapeOf(cliOps).ops);
    expect(new Set(webOps.map((o) => o.group))).toEqual(new Set([group]));
    expect(webOps[0]!.op.type).toBe("item.update");
    expect(webOps.some((o) => o.op.type === "item.addVersion")).toBe(true);
    const proto = [...web.c.items.values()].find((i) => i.properties.wirePrototype !== undefined)!;
    expect(web.c.blobs.get(proto.versions.at(-1)!.blobHash)).toContain(`data-screen="${variation.id}"`);
  });
});

describe("/wire flesh", () => {
  const specs = (c: ReturnType<typeof memoryCanvas>) => [...c.items.values()].map((i) => readWire(c.blobs.get(i.versions.find((v) => v.id === i.currentVersionId)!.blobHash)!)!);

  it("fleshes what `wire flesh` fleshes: the home's judge chooses, one op group, the same slots filled from the same pack", async () => {
    const cli = await viaCli([["wire", "flesh", "--answerer", "stub", "--seed", String(SEED)]], ["--basic"]);
    const web = await viaWeb({ basic: true });
    const before = web.c.sent.length;
    const r = await fleshOnWeb("canvas-acme", web.host, { bars: false });
    expect(r.calls).toBe(1);
    // The pack question went to the home's judge, naming the canvas — as every round did.
    expect(web.asked.at(-1)).toMatchObject({ canvasId: "canvas-acme", state: { request: REQUEST } });
    const ops = web.c.sent.slice(before);
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    expect(ops.every((o) => o.op.type === "item.addVersion" || (o.op.type === "item.update" && Object.keys(o.op.patch).join() === "title"))).toBe(true);
    const shape = (list: WireSpec[]) => list.map((s) => [s.archetype, s.content?.pack, s.content?.title === undefined, s.slots.map((x) => [x.slot, x.block, Boolean(x.fill)])]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(shape(specs(web.c))).toEqual(shape(specs(cli)));
    expect(specs(web.c).every((s) => s.content?.pack === "generic")).toBe(true);
    // Again: nothing asked, nothing written.
    const n = web.c.sent.length;
    const again = await fleshOnWeb("canvas-acme", web.host, { bars: false });
    expect(again.calls).toBe(0);
    expect(web.c.sent.length).toBe(n);
  });

  it("--pack and --bars pass through", async () => {
    const web = await viaWeb({ basic: true });
    await fleshOnWeb("canvas-acme", web.host, { bars: false, pack: "deliveries" });
    expect(specs(web.c).every((s) => s.content?.pack === "deliveries")).toBe(true);
    await fleshOnWeb("canvas-acme", web.host, { bars: true });
    expect(specs(web.c).every((s) => s.content === undefined && s.slots.every((x) => !x.fill))).toBe(true);
  });
});

describe("a wire style, from the menu or /wire style <name>", () => {
  /** The ops of the last group sent — one act's. */
  const lastAct = (c: ReturnType<typeof memoryCanvas>) => {
    const group = c.sent[c.sent.length - 1]!.group;
    return c.sent.filter((s) => s.group === group);
  };

  it("sends what `wire style --preset` sends: the file, design use's op, a version per wire and the prototype's — one group", async () => {
    const cli = await viaCli([["wire", "style", "--preset", "material"]]);
    const web = await viaWeb();
    const r = await presetOnWeb("canvas-acme", web.host, "material", [], async (p) => presetText(p));
    const a = shapeOf(lastAct(cli));
    const b = shapeOf(lastAct(web.c));
    expect(b).toEqual(a);
    expect(b.groups).toBe(1);
    expect(b.ops[0]).toMatchObject({ type: "item.add", title: "Material — DESIGN.md", properties: { wirePreset: "material" } });
    expect(b.ops[1]).toMatchObject({ type: "item.update", patch: { properties: { role: "design-system" } } });
    expect(r.restyled.changed.length).toBeGreaterThan(0);
  });

  it("a wire's menu pick (the selection's flow) is the CLI naming that screen — and house the same way back", async () => {
    const cli = await viaCli([
      (c) => ["wire", "style", "--preset", "glass", [...c.items.values()].find((i) => i.properties.fidelity === "wireframe" && !i.properties.wirePrototype)!.id],
      ["wire", "style", "--preset", "house"],
    ]);
    const web = await viaWeb();
    const first = [...web.c.items.values()].find((i) => i.properties.fidelity === "wireframe" && !i.properties.wirePrototype)!.id;
    await presetOnWeb("canvas-acme", web.host, "glass", [first], async (p) => presetText(p));
    const glassWeb = shapeOf(lastAct(web.c));
    // House takes the style's file to the trash, on both surfaces.
    await presetOnWeb("canvas-acme", web.host, "house", [], async (p) => presetText(p));
    expect(shapeOf(lastAct(web.c))).toEqual(shapeOf(lastAct(cli)));
    expect(lastAct(web.c)[0]!.op.type).toBe("item.delete");
    expect(glassWeb.groups).toBe(1);
  });
});

describe("the arrows between kept screens", () => {
  const o = { request: "Acme couriers", flow: "flw_acme" };
  function canvasOf(specs: Record<string, WireSpec>, keep: string[]) {
    const blobs = new Map<string, string>();
    const items: Record<string, Item> = {};
    let x = 0;
    for (const [id, spec] of Object.entries(specs)) {
      const hash = `h-${id}`;
      blobs.set(hash, renderWire(spec));
      items[id] = {
        id, title: spec.title, x, y: 0, width: 390, height: 844,
        properties: { fidelity: "wireframe", ...(keep.includes(id) ? { [KEEP_PROP]: "yes" } : {}) },
        currentVersionId: `v-${id}`,
        versions: [{ id: `v-${id}`, blobHash: hash, mimeType: "text/html" }],
      } as unknown as Item;
      x += 470;
    }
    return { canvas: { items } as unknown as CanvasContents, blobs };
  }
  const read = (blobs: Map<string, string>) => (hash: string) => (blobs.has(hash) ? readWire(blobs.get(hash)!) : undefined);

  it("are computed from the specs in the screens' files — nothing on the items says where a link goes", () => {
    const specs = { it_signin: wireframe("sign-in", o), it_home: wireframe("home", o), it_list: wireframe("list", o), it_detail: wireframe("detail", o) };
    const { canvas, blobs } = canvasOf(specs, Object.keys(specs));
    for (const item of Object.values(canvas.items)) expect(Object.keys(item.properties ?? {}).sort()).toEqual(["fidelity", KEEP_PROP].sort());
    const edges = keptArrows(canvas, read(blobs));
    expect(edges).toContainEqual({ from: "it_signin", to: "it_home" });
    expect(edges).toContainEqual({ from: "it_list", to: "it_detail" });
    // Unread files draw nothing yet — not a guess.
    expect(keptArrows(canvas, () => undefined)).toEqual([]);
  });

  it("follow the specs: a new version of a screen changes the arrows, with no property touched", () => {
    const specs = { it_signin: wireframe("sign-in", o), it_home: wireframe("home", o), it_list: wireframe("list", o), it_detail: wireframe("detail", o) };
    const { canvas, blobs } = canvasOf(specs, Object.keys(specs));
    const before = keptArrows(canvas, read(blobs));
    expect(before).toContainEqual({ from: "it_list", to: "it_detail" });
    // The list becomes a settings screen in its next version: no rows, so no arrow to the detail.
    const next = wireframe("settings", o);
    blobs.set("h-it_list-2", renderWire(next));
    const list = canvas.items["it_list"]!;
    (list.versions as unknown as Array<{ id: string; blobHash: string; mimeType: string }>).push({ id: "v2", blobHash: "h-it_list-2", mimeType: "text/html" });
    (list as { currentVersionId: string }).currentVersionId = "v2";
    const after = keptArrows(canvas, read(blobs));
    expect(after).not.toContainEqual({ from: "it_list", to: "it_detail" });
  });

  it("run only between KEPT screens, and a canvas with no wire fetches nothing", () => {
    const specs = { it_signin: wireframe("sign-in", o), it_home: wireframe("home", o), it_list: wireframe("list", o) };
    expect(wireframeActivation.underlays[0]!.needed({ items: {} } as unknown as CanvasContents)).toBe(false);
    const none = canvasOf(specs, []);
    expect(keptArrows(none.canvas, read(none.blobs))).toEqual([]);
    // Wires with none kept draw no arrow, but fetch the half: a wire's Style ▸ menu lives there (24 Sep 2026).
    expect(wireframeActivation.underlays[0]!.needed(none.canvas)).toBe(true);
    const one = canvasOf(specs, ["it_home"]);
    expect(keptArrows(one.canvas, read(one.blobs))).toEqual([]);
    // One kept screen draws no arrow, but fetches the half: its ⇧K's `follow` lives there.
    expect(wireframeActivation.underlays[0]!.needed(one.canvas)).toBe(true);
    const two = canvasOf(specs, ["it_signin", "it_home"]);
    expect(wireframeActivation.underlays[0]!.needed(two.canvas)).toBe(true);
    expect(keptArrows(two.canvas, read(two.blobs))).toEqual([{ from: "it_signin", to: "it_home" }]);
  });
});

describe("the doors", () => {
  it("/wire reads its words: a request, prototype, style, style --default, or nothing", () => {
    expect(modeOf("")).toEqual({ kind: "form" });
    expect(modeOf("prototype")).toEqual({ kind: "prototype" });
    // `style` alone lists the wire styles; `style system` is what it did before them; one more word is a style.
    expect(modeOf("style")).toEqual({ kind: "styles" });
    expect(modeOf("style system")).toEqual({ kind: "style", toDefault: false });
    expect(modeOf("style --default")).toEqual({ kind: "style", toDefault: true });
    expect(modeOf("style Material")).toEqual({ kind: "preset", name: "material" });
    expect(modeOf("style house")).toEqual({ kind: "preset", name: "house" });
    expect(modeOf("style guide for Acme's kiosk")).toEqual({ kind: "compose", request: "style guide for Acme's kiosk" });
    expect(modeOf("a prototype for Acme")).toEqual({ kind: "compose", request: "a prototype for Acme" });
    expect(modeOf("flesh")).toEqual({ kind: "flesh", bars: false });
    expect(modeOf("flesh --bars")).toEqual({ kind: "flesh", bars: true });
    expect(modeOf("flesh --pack pets")).toEqual({ kind: "flesh", bars: false, pack: "pets" });
    expect(modeOf("flesh pets")).toEqual({ kind: "flesh", bars: false, pack: "pets" });
    expect(modeOf("flesh out a pet-sitting app")).toEqual({ kind: "compose", request: "flesh out a pet-sitting app" });
    expect(modeOf("basic a pet-sitting app")).toEqual({ kind: "compose", request: "a pet-sitting app", basic: true });
    expect(modeOf("basic")).toEqual({ kind: "compose", request: "basic" });
  });

  it("the activation and the loaded half name the same dialog, command and module", () => {
    expect(wireframeActivation.core.commands?.[0]).toMatchObject({ name: "wire", opens: "wire", source: "module" });
    expect(wireframeWeb.core.name).toBe(wireframeActivation.core.name);
    expect(wireframeWeb.core.commands?.[0]?.body).toContain("isocan wire");
    expect(wireframeWeb.dialogs?.map((d) => d.id)).toEqual(wireframeActivation.dialogs.map((d) => d.id));
    expect(wireframeWeb.underlays).toHaveLength(wireframeActivation.underlays.length);
  });
});

describe("the maybe marks", () => {
  const item = (id: string, props: Record<string, string>, x = 0): Item => ({ id, title: "Confirm", x, y: 0, width: 390, height: 844, properties: { fidelity: "wireframe", ...props } }) as unknown as Item;
  const canvasOf = (...items: Item[]) => ({ items: Object.fromEntries(items.map((i) => [i.id, i])) }) as unknown as CanvasContents;

  it("draw outside an unkept maybe — an outline on its bounds and a tag anchored at its top edge — and nothing once it is kept", async () => {
    const lib = "react-dom/server";
    const { renderToStaticMarkup } = (await import(lib)) as { renderToStaticMarkup: (el: unknown) => string };
    const { createElement } = await import("react");
    const draw = (canvas: CanvasContents) => renderToStaticMarkup(createElement(WireMaybes, { canvas }));
    const html = draw(canvasOf(item("itm_confirm", { [MAYBE_PROP]: "0.36" }, 470)));
    expect(html).toContain('data-wire-maybe="itm_confirm"');
    // The outline sits on the item's own box (the stylesheet offsets it outward); the tag's anchor is the item's top-right corner, and the tag rises above it.
    expect(html).toMatch(/class="wire-maybe" style="left:470px;top:0;width:390px;height:844px"/);
    expect(html).toMatch(/class="wire-maybe-anchor" style="left:860px;top:0;/);
    expect(html).toContain(">maybe</span>");
    // Its tooltip says what the mark asks, and which key answers it.
    expect(html).toContain('title="Not in the prototype yet — ⇧K to use it"');
    expect(draw(canvasOf(item("itm_confirm", { [MAYBE_PROP]: "0.36", [KEEP_PROP]: "yes" })))).toBe("");
    expect(draw(canvasOf(item("itm_list", {})))).toBe("");
  });

  it("the half is fetched wherever a wire is — a mark's `follow`, the arrows and a wire's Style ▸ menu all live there", () => {
    const needed = wireframeActivation.underlays[0]!.needed;
    expect(needed(canvasOf(item("a", { [MAYBE_PROP]: "0.36" })))).toBe(true);
    expect(needed(canvasOf(item("a", { [KEEP_PROP]: "yes" })))).toBe(true);
    // A prototype whose screens were all taken out: using one again must re-version it.
    expect(needed(canvasOf(item("p", { wirePrototype: "flw_acme" })))).toBe(true);
    expect(needed(canvasOf(item("a", {})))).toBe(true);
    // Nothing on the canvas is a wire: nothing is fetched.
    const note = { id: "n", title: "Acme notes", x: 0, y: 0, width: 200, height: 100, properties: { kind: "text" } } as unknown as Item;
    expect(needed(canvasOf(note))).toBe(false);
  });
});

describe("the home answerer", () => {
  const request = { model: "jev-latest", state: { acme: 1 }, questions: { pick: { type: "choice" as const, instructions: "Which?", criteria: { a: null, b: null } } } };

  it("falls back to the stub only on the home's no-judge refusal — every parallel call, told once", async () => {
    const noJudge = homeAnswerer(async () => {
      throw Object.assign(new Error("no judge"), { code: "judgment-unavailable" });
    }, "canvas-acme");
    const told: unknown[] = [];
    const a = homeOrStub(noJudge, stubAnswerer(2), (e) => told.push(e));
    const answers = await Promise.all([a.answer(request), a.answer(request), a.answer(request)]);
    expect(answers.every((x) => x.by === "stub (seed 2)")).toBe(true);
    expect(told).toHaveLength(1);
    expect(a.name).toBe("stub");

    const refused = homeOrStub(homeAnswerer(async () => {
      throw Object.assign(new Error("view-only"), { code: "view-only" });
    }, "canvas-acme"), stubAnswerer(2), () => {});
    await expect(refused.answer(request)).rejects.toThrow("view-only");
  });

  it("checks the home's answer against the question, as Jev's is", async () => {
    const bad = homeAnswerer(async () => ({ answers: { pick: { type: "choice", choice: "fridge", probabilities: { a: 1 } } } }), "canvas-acme");
    await expect(bad.answer(request)).rejects.toThrow(/choice "fridge" is not one of a, b/);
  });
});

describe("a wire behind its design system", () => {
  /** A DESIGN.md the way `isocan design set` leaves one — added straight to the canvas, the same on both surfaces. */
  const designOn = (c: ReturnType<typeof memoryCanvas>, text: string) => {
    const existing = c.items.get("ds-acme");
    const v = { id: `ds-acme-v${(existing?.versions.length ?? 0) + 1}`, blobHash: c.store(text), mimeType: "text/markdown", filename: "DESIGN.md" };
    if (existing) {
      existing.versions.push(v);
      existing.currentVersionId = v.id;
    } else c.items.set("ds-acme", { id: "ds-acme", title: "DESIGN.md", properties: { role: "design-system" }, x: -2000, y: 0, width: 400, height: 600, currentVersionId: v.id, versions: [v] });
  };
  // A new typeface: the seeded stub is unsure of every colour, and the one face is taken directly ("only").
  const V2 = ACME_WARM.replaceAll("Archivo", "Inter");
  const firstWire = (c: ReturnType<typeof memoryCanvas>) => [...c.items.values()].find((i) => i.properties.fidelity === "wireframe" && !i.properties.wirePrototype)!.id;
  const specOf = (c: ReturnType<typeof memoryCanvas>) => (hash: string) => readWire(c.blobs.get(hash) ?? "");
  const docOf = (c: ReturnType<typeof memoryCanvas>) => (system: Item) => parseDesign(c.blobs.get(system.versions.find((v) => v.id === system.currentVersionId)!.blobHash)!);

  it("is not behind a new version that moved nothing it draws from (Porchlight #9) — the restyle would write nothing, so the mark says nothing", async () => {
    const web = await viaWeb();
    designOn(web.c, ACME_WARM);
    await restyleOnWeb("canvas-acme", web.host, false);
    // v2 adds tints and nothing else.
    designOn(web.c, ACME_WARM.replace('  on-accent: "#ffffff"', '  on-accent: "#ffffff"\n  tint-1: "#fbe3ef"\n  tint-2: "#f5c2dc"'));
    expect(wiresBehind(web.c.contents(), specOf(web.c), docOf(web.c))).toEqual([]);
    // Without the file read, an older version is all there is to go on.
    expect(wiresBehind(web.c.contents(), specOf(web.c), () => null).length).toBeGreaterThan(0);
  });
  const lastAct = (c: ReturnType<typeof memoryCanvas>) => {
    const group = c.sent[c.sent.length - 1]!.group;
    return c.sent.filter((s) => s.group === group);
  };

  it("is derived from the spec and the DESIGN.md's current version: behind after a new version, current after the restyle", async () => {
    const web = await viaWeb();
    designOn(web.c, ACME_WARM);
    await restyleOnWeb("canvas-acme", web.host, false);
    expect(wiresBehind(web.c.contents(), specOf(web.c), docOf(web.c))).toEqual([]);

    designOn(web.c, V2);
    const behind = wiresBehind(web.c.contents(), specOf(web.c), docOf(web.c));
    const wires = [...web.c.items.values()].filter((i) => i.properties.fidelity === "wireframe" && !i.properties.wirePrototype);
    expect(behind.map((c) => c.itemId).sort()).toEqual(wires.map((w) => w.id).sort());
    // The words `isocan wire style --check` prints for the same wire.
    expect(checkWords(behind[0]!)).toBe('behind: drawn in "Acme Warm" version 1, governed by "DESIGN.md" version 2 of 2');
    expect(restyleLabel(behind[0]!)).toBe("Restyle to Acme Warm");

    await restyleOnWeb("canvas-acme", web.host, false, [firstWire(web.c)]);
    expect(wiresBehind(web.c.contents(), specOf(web.c), docOf(web.c))).toEqual([]);
  });

  it("Restyle to <system> sends what `isocan wire style <screen>` sends — one op group", async () => {
    const cli = await viaCli([
      (c) => (designOn(c, ACME_WARM), ["wire", "style", "--answerer", "stub", "--seed", "4"]),
      (c) => (designOn(c, V2), ["wire", "style", "--answerer", "stub", "--seed", "4", firstWire(c)]),
    ]);
    const web = await viaWeb();
    designOn(web.c, ACME_WARM);
    await restyleOnWeb("canvas-acme", web.host, false);
    designOn(web.c, V2);
    await restyleOnWeb("canvas-acme", web.host, false, [firstWire(web.c)]);
    const a = shapeOf(lastAct(cli));
    const b = shapeOf(lastAct(web.c));
    expect(b).toEqual(a);
    expect(b.groups).toBe(1);
    expect(b.ops.length).toBeGreaterThan(1);
  });

  it("the menu and the mark offer it, and nothing is written by looking", async () => {
    const web = await viaWeb();
    designOn(web.c, ACME_WARM);
    await restyleOnWeb("canvas-acme", web.host, false);
    designOn(web.c, V2);
    const canvas = web.c.contents();
    const wire = firstWire(web.c);
    const n = wiresBehind(canvas, specOf(web.c), docOf(web.c)).length;
    // What the canvas has read, as the mark reads it (spec-cache.ts).
    for (const item of Object.values(canvas.items)) for (const v of item.versions) if (v.mimeType === "text/html") specs.set(v.blobHash, readWire(web.c.blobs.get(v.blobHash)!));
    const system = canvas.items["ds-acme"]!;
    docs.set(system.versions.find((v) => v.id === system.currentVersionId)!.blobHash, docOf(web.c)(system));
    const sentBefore = web.c.sent.length;

    const opened: string[] = [];
    const open = (dialog: string, args: string) => opened.push(`${dialog} ${args}`);
    const onWire = styleMenu({ canvas, items: [canvas.items[wire]!], open });
    expect(onWire[0]).toMatchObject({ label: "Restyle to Acme Warm", writes: true });
    (onWire[0] as { run: () => void }).run();
    expect(opened).toEqual([`wire style system ${wire}`]);
    expect(modeOf(`style system ${wire}`)).toEqual({ kind: "style", toDefault: false, screens: [wire] });
    const onSystem = styleMenu({ canvas, items: [canvas.items["ds-acme"]!], open });
    expect(onSystem).toEqual([expect.objectContaining({ label: "Restyle to Acme Warm", value: `${n} wires behind` })]);

    const lib = "react-dom/server";
    const { renderToStaticMarkup } = (await import(lib)) as { renderToStaticMarkup: (el: unknown) => string };
    const { createElement } = await import("react");
    const ran: string[] = [];
    const host = {
      runCommand: async (t: string) => (ran.push(t), "local"),
      send: async () => {
        throw new Error("looking wrote something");
      },
    } as unknown as WebHost;
    const html = renderToStaticMarkup(createElement(WireBehind, { canvas, host, canEdit: true, past: false }));
    expect(html).toContain(`data-wire-behind="${wire}"`);
    expect(html).toContain('title="behind: drawn in &quot;Acme Warm&quot; version 1, governed by &quot;DESIGN.md&quot; version 2 of 2 — Restyle to Acme Warm"');
    expect(html).toContain(`>${n} wires behind</button>`);
    expect(web.c.sent.length).toBe(sentBefore);
    restyleOnCanvas(host, [wire]);
    expect(ran).toEqual([`/wire style system ${wire}`]);
  });
});

describe("/wire copy and /wire name ask the home's text model", () => {
  async function withGenerate(generate?: (request: TextRequest) => Promise<unknown>) {
    const web = await viaWeb();
    const notices: Array<{ text: string; problem: boolean }> = [];
    const host = { ...web.host, notice: (text: string, problem?: boolean) => notices.push({ text, problem: problem === true }), ...(generate ? { generate } : {}) } as unknown as DialogHost;
    return { web, host, notices };
  }

  it("/wire copy calls host.generate once per screen, naming the canvas, and signs the words with the model that wrote them", async () => {
    const asked: TextRequest[] = [];
    const writer = stubTextGenerator(4);
    const { web, host, notices } = await withGenerate(async (request) => {
      asked.push(request);
      return { model: "claude-acme", value: await writer.generateJson(request.prompt, request.schema) };
    });
    const before = web.c.sent.length;
    const { r, screens } = await copyOnWeb("canvas-acme", host, [], "warm and brief");
    expect(asked.length).toBe(screens.length);
    for (const request of asked) {
      expect(request.canvasId).toBe("canvas-acme");
      expect(request.prompt).toContain("warm and brief");
      expect(request.schema.type).toBe("object");
      expect(Object.keys(request).sort()).toEqual(["canvasId", "prompt", "schema"]);
    }
    expect(r.by).toBe("claude-acme via the home");
    expect(r.changed.length).toBeGreaterThan(0);
    expect(web.c.sent.length).toBeGreaterThan(before);
    expect(notices).toEqual([]);
  });

  it("/wire name calls host.generate for the flow", async () => {
    const asked: TextRequest[] = [];
    const writer = stubTextGenerator(5);
    const { host } = await withGenerate(async (request) => {
      asked.push(request);
      return { model: "claude-acme", value: await writer.generateJson(request.prompt, request.schema) };
    });
    const { r } = await nameOnWeb("canvas-acme", host, [], "Acme Couriers");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.canvasId).toBe("canvas-acme");
    expect(r.by).toBe("claude-acme via the home");
  });

  it("with no text model at the home, fills placeholder words and says so once, as a problem", async () => {
    let calls = 0;
    const { host, notices } = await withGenerate(async () => {
      calls++;
      throw Object.assign(new Error("this home has no text model"), { code: "text-unavailable" });
    });
    const { r } = await copyOnWeb("canvas-acme", host, []);
    expect(calls).toBeGreaterThan(0);
    expect(r.by).toBe(PLACEHOLDER_WORDS);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ problem: true });
    expect(notices[0]!.text).toMatch(/placeholder words, not written copy/);
  });

  it("any other refusal is a failure, not placeholder words", async () => {
    const { host } = await withGenerate(async () => {
      throw Object.assign(new Error("view-only"), { code: "view-only" });
    });
    await expect(copyOnWeb("canvas-acme", host, [])).rejects.toThrow("view-only");
  });
});
