import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { PROTOTYPE_PROP, readWire, wordsOf, type JevRequest, type WireSpec } from "../src/core.ts";
import { ACME_NIGHT, ACME_WARM, PICKS } from "./fixtures/design-systems.ts";

/**
 * **`isocan wire flesh` and `wire copy` against a canvas held in memory**
 * (phase 7, design §10): one pack per flow — Jev's choice with p recorded,
 * the stub's always generic, `--pack` never asked — one op group of
 * versions, a rerun that writes nothing, `--bars`, content that survives
 * `wire style`, `wire vary` and `wire prototype`, `wire --flesh` arriving
 * fleshed, and an agent's exact words through `wire copy --apply`. The
 * harness is `style-cli.test.ts`'s.
 */

interface FakeItem {
  id: string;
  title: string;
  properties: Record<string, string>;
  x: number;
  y: number;
  width: number;
  height: number;
  updatedAt: string;
  containerId?: string;
  currentVersionId: string;
  versions: Array<{ id: string; blobHash: string; mimeType: string; filename?: string }>;
}

let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 8, 23, 12, 0, clock++)).toISOString();

function harness() {
  const program = new Command().exitOverride().option("--json");
  const sent: Array<{ op: Operation; group?: string }> = [];
  const blobs = new Map<string, string>();
  const items = new Map<string, FakeItem>();
  const errors: string[] = [];
  const blob = (text: string) => {
    const hash = `hash-${blobs.size + 1}`;
    blobs.set(hash, text);
    return hash;
  };
  const ctx = {
    json: false,
    client: {
      snapshot: async () => ({ canvas: { items: Object.fromEntries([...items].map(([k, v]) => [k, structuredClone(v)])) }, project: { groupMode: "groups" } }),
      uploadBlob: async (_canvas: string, bytes: Buffer) => ({ blobHash: blob(bytes.toString("utf8")), size: bytes.length }),
      downloadBlob: async (_canvas: string, hash: string) => Buffer.from(blobs.get(hash)!, "utf8"),
      // A home with no key of its own: what every test daemon is.
      judgment: async () => {
        throw Object.assign(new Error("this home has no judge"), { code: "judgment-unavailable" });
      },
    },
  };
  const apply = (op: Operation) => {
    if (op.type === "item.add") {
      const at = op.placement as { x: number; y: number; containerId?: string };
      const containerId = (op as { containerId?: string }).containerId ?? at.containerId;
      items.set(op.itemId, { id: op.itemId, title: op.title ?? "", properties: op.properties ?? {}, x: at.x, y: at.y, width: op.width, height: op.height, updatedAt: stamp(), ...(containerId ? { containerId } : {}), currentVersionId: op.version.id, versions: [op.version] });
    } else if (op.type === "item.addVersion") {
      const item = items.get(op.itemId)!;
      item.versions.push(op.version);
      item.currentVersionId = op.version.id;
      item.updatedAt = stamp();
    } else if (op.type === "item.update") {
      const item = items.get(op.itemId)!;
      if (op.patch.title) item.title = op.patch.title;
      if (op.patch.properties) item.properties = { ...item.properties, ...op.patch.properties };
    } else if (op.type === "item.resize") {
      Object.assign(items.get(op.itemId)!, { width: op.width, height: op.height });
    } else throw new Error(`sent an op it should not: ${op.type}`);
  };
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
    resolveItem: (snapshot: { canvas: { items: Record<string, FakeItem> } }, ref: string) => {
      const found = snapshot.canvas.items[ref] ?? Object.values(snapshot.canvas.items).find((i) => i.title === ref);
      if (!found) throw new Error(`no item ${ref}`);
      return found;
    },
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation, group?: string) => {
      sent.push({ op, ...(group ? { group } : {}) });
      apply(op);
      return { envelope: { op } };
    },
    insertionReceiptPlacement: (op: Extract<Operation, { type: "item.add" }>) => op.placement,
    printJson: () => {},
    sizeFor: (_s: string | undefined, f: { width: number; height: number }) => f,
    placementFor: (_snapshot: unknown, opts: { at?: string; in?: string }) =>
      opts.in ? { x: 5000, y: 0, chosen: true, containerId: opts.in, groupPlacement: "auto" } : { x: 0, y: 0, chosen: true },
    truncate: (t: string) => t,
  } as unknown as CliHost;
  wireframeCli.register(host);

  /** A DESIGN.md item, the way `isocan design set` leaves one: `role=design-system`, markdown. */
  const design = (id: string, text: string, containerId?: string) => {
    items.set(id, { id, title: "DESIGN.md", properties: { role: "design-system" }, x: -2000, y: 0, width: 400, height: 600, updatedAt: stamp(), ...(containerId ? { containerId } : {}), currentVersionId: `${id}-v1`, versions: [{ id: `${id}-v1`, blobHash: blob(text), mimeType: "text/markdown", filename: "DESIGN.md" }] });
  };
  const designVersion = (id: string, text: string) => {
    const item = items.get(id)!;
    const v = { id: `${id}-v${item.versions.length + 1}`, blobHash: blob(text), mimeType: "text/markdown", filename: "DESIGN.md" };
    item.versions.push(v);
    item.currentVersionId = v.id;
    item.updatedAt = stamp();
  };
  const group = (id: string) => {
    items.set(id, { id, title: "Back office", properties: { kind: "group" }, x: 4800, y: -100, width: 6000, height: 3000, updatedAt: stamp(), currentVersionId: "", versions: [] });
  };
  const specOf = (itemId: string, version?: number): WireSpec => {
    const item = items.get(itemId)!;
    const v = version === undefined ? item.versions.find((x) => x.id === item.currentVersionId)! : item.versions[version]!;
    return readWire(blobs.get(v.blobHash)!)!;
  };
  const htmlOf = (itemId: string) => {
    const item = items.get(itemId)!;
    return blobs.get(item.versions.find((x) => x.id === item.currentVersionId)!.blobHash)!;
  };
  const wires = () => [...items.values()].filter((i) => i.properties.fidelity === "wireframe" && !i.properties[PROTOTYPE_PROP]);
  const cli = async (...args: string[]) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "isocan", ...args]);
    const printed = log.mock.calls.flat().join("\n");
    log.mockRestore();
    return printed;
  };
  return { cli, sent, items, errors, specOf, htmlOf, wires, design, designVersion, group };
}


const REQUEST = "a delivery app for Acme couriers — sign in, see today's parcels, open one";

/** Jev, faked at `fetch`: the pack question answered `deliveries` at 0.7, a mapping (never asked here) at its first key. */
function fakeJev(choice = "deliveries", p = 0.7) {
  const calls: JevRequest[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const request = JSON.parse(init.body) as JevRequest;
    calls.push(request);
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(request.questions)) {
      const keys = Object.keys((q as { criteria: Record<string, string> }).criteria);
      const pick = id === "pack" ? choice : keys[0]!;
      answers[id] = { type: "choice", choice: pick, probabilities: Object.fromEntries(keys.map((k) => [k, k === pick ? p : (1 - p) / (keys.length - 1)])) };
    }
    return new Response(JSON.stringify({ model: "jev-test", answers, usage: { input_tokens: 1500, output_tokens: 0 } }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}

let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = savedKey;
});

describe("isocan wire flesh", () => {
  it("asks Jev once per flow, records p, and versions every wire in one op group; a rerun is a no-op", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const wires = h.wires();
    expect(wires.length).toBeGreaterThan(3);
    for (const w of wires) expect(h.specOf(w.id).content).toBeUndefined();

    const jev = fakeJev();
    const before = h.sent.length;
    const printed = await h.cli("wire", "flesh", "--answerer", "jev");
    expect(h.errors).toEqual([]);
    expect(jev).toHaveLength(1);
    expect(jev[0]!.state).toEqual({ request: REQUEST });
    const ops = h.sent.slice(before);
    // A version per wire, and a rename where the pack names the screen ("Deliveries", not "List") — nothing else.
    expect(ops.every((o) => o.op.type === "item.addVersion" || (o.op.type === "item.update" && Object.keys(o.op.patch).join() === "title"))).toBe(true);
    const versions = ops.filter((o) => o.op.type === "item.addVersion");
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    expect(versions.map((o) => (o.op as { itemId: string }).itemId).sort()).toEqual(wires.map((w) => w.id).sort());
    for (const w of wires) {
      const spec = h.specOf(w.id);
      expect(spec.content).toMatchObject({ source: "pack", pack: "deliveries", p: 0.7, by: "jev-test" });
      // The same screen: every slot's block and props as they were.
      const was = h.specOf(w.id, w.versions.length - 2);
      expect(spec.slots.map((s) => [s.slot, s.block, s.props])).toStrictEqual(was.slots.map((s) => [s.slot, s.block, s.props]));
      expect(spec.slots.some((s) => s.fill)).toBe(true);
    }
    expect(printed).toMatch(/pack: deliveries p 0\.70/);
    expect(printed).toMatch(/one op group/);

    const again = h.sent.length;
    const second = await h.cli("wire", "flesh", "--answerer", "jev");
    expect(h.sent.length).toBe(again);
    expect(jev).toHaveLength(1);
    expect(second).toMatch(/already on these screens, nothing asked/);
    expect(second).toMatch(/nothing written/);
  });

  it("with the stub, the flat answer falls under the floor: the generic pack fills, and the line says so", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const printed = await h.cli("wire", "flesh", "--answerer", "stub");
    expect(h.errors).toEqual([]);
    for (const w of h.wires()) expect(h.specOf(w.id).content).toMatchObject({ source: "pack", pack: "generic" });
    expect(printed).toMatch(/under 0\.4, so the generic pack fills/);
  });

  it("--pack overrides without asking; --bars takes it all back off; bad words are refused before anything is written", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const bare = Object.fromEntries(h.wires().map((w) => [w.id, h.specOf(w.id)]));
    const jev = fakeJev();
    await h.cli("wire", "flesh", "--pack", "pets");
    expect(jev).toHaveLength(0);
    for (const w of h.wires()) expect(h.specOf(w.id).content).toMatchObject({ pack: "pets", by: "--pack", p: 1 });
    await h.cli("wire", "flesh", "--bars");
    for (const w of h.wires()) expect(h.specOf(w.id)).toStrictEqual(bare[w.id]);
    const n = h.sent.length;
    await h.cli("wire", "flesh", "--pack", "no-such-pack");
    expect(h.errors.at(-1)).toMatch(/no pack "no-such-pack"/);
    expect(h.sent.length).toBe(n);
  });

  it("content survives wire style, wire vary and wire prototype", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    await h.cli("wire", "flesh", "--pack", "deliveries");
    const fleshed = Object.fromEntries(h.wires().map((w) => [w.id, h.specOf(w.id)]));

    h.design("ds-warm", ACME_WARM);
    fakeJev();
    await h.cli("wire", "style", "--answerer", "jev");
    expect(h.errors).toEqual([]);
    for (const w of h.wires()) {
      const spec = h.specOf(w.id);
      expect(spec.style?.source).toBe("design-system");
      expect(spec.slots).toStrictEqual(fleshed[w.id]!.slots);
      expect(spec.content).toStrictEqual(fleshed[w.id]!.content);
    }

    // Keep two screens and play them: the prototype carries the fleshed words.
    const screens = h.wires().filter((w) => !h.specOf(w.id).variantOf);
    await h.cli("wire", "keep", screens[0]!.id, screens[1]!.id);
    await h.cli("wire", "prototype");
    expect(h.errors).toEqual([]);
    const proto = [...h.items.values()].find((i) => i.properties[PROTOTYPE_PROP])!;
    const words = h.specOf(screens[1]!.id).slots.flatMap((s) => Object.values(wordsOf(s.fill))).filter((w) => !/[&<>"']/.test(w));
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) expect(h.htmlOf(proto.id), w).toContain(w);

    // Re-flesh with another pack: the prototype is rebuilt in the same op group.
    const before = h.sent.length;
    await h.cli("wire", "flesh", "--pack", "inventory");
    const ops = h.sent.slice(before);
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    expect(ops.some((o) => (o.op as { itemId: string }).itemId === proto.id)).toBe(true);
  });

  it("wire vary on a fleshed screen: its new variations arrive fleshed, with the same pack and seed", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    await h.cli("wire", "flesh", "--pack", "deliveries");
    const screen = h.wires().find((w) => {
      const s = h.specOf(w.id);
      return !s.variantOf && s.varied !== "none";
    })!;
    await h.cli("wire", "vary", screen.id, "--count", "4");
    expect(h.errors).toEqual([]);
    const variants = h.wires().filter((w) => h.specOf(w.id).variantOf === screen.id);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const spec = h.specOf(v.id);
      expect(spec.content).toStrictEqual(h.specOf(screen.id).content);
      for (const s of spec.slots) if (s.block && s.slot !== spec.flip!.slot) expect(s.fill).toStrictEqual(h.specOf(screen.id).slots.find((x) => x.slot === s.slot)?.fill);
    }
    // Fleshing again writes nothing: every variation's seed is its screen's.
    const n = h.sent.length;
    await h.cli("wire", "flesh");
    expect(h.sent.length).toBe(n);
  });

  it("wire \"<request>\": the flow arrives fleshed by default — no second version, the pack asked beside round 1; --basic does not", async () => {
    const h = harness();
    const jev = fakeJev("deliveries", 0.66);
    const printed = await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    expect(h.errors).toEqual([]);
    // The stub answers rounds and the pack alike: generic, said so.
    expect(jev).toHaveLength(0);
    expect(printed).toMatch(/the screens arrive fleshed/);
    const plain = harness();
    const plainPrinted = await plain.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    expect(plainPrinted).not.toMatch(/pack:/);
    for (const w of plain.wires()) expect(plain.specOf(w.id).content).toBeUndefined();
    // The same number of versions per screen as a basic flow: content rides round 3's version.
    const count = (hh: typeof h) => hh.wires().map((w) => w.versions.length).sort().join(",");
    expect(count(h)).toBe(count(plain));
    for (const w of h.wires()) expect(h.specOf(w.id).content).toMatchObject({ source: "pack", pack: "generic" });
    // --flesh, kept for older scripts, is the default; --basic with --pack is refused before anything is written.
    const old = harness();
    await old.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--flesh");
    expect(count(old)).toBe(count(h));
    const both = harness();
    await both.cli("wire", REQUEST, "--answerer", "stub", "--basic", "--pack", "tools");
    expect(both.errors.at(-1)).toMatch(/--basic arrives unfleshed/);
    expect(both.wires()).toEqual([]);
    // --pack names it outright.
    const named = harness();
    await named.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--pack", "tools");
    for (const w of named.wires()) expect(named.specOf(w.id).content).toMatchObject({ pack: "tools" });
  });
});

describe("screens named in the pack's words", () => {
  it("a flesh renames an item the composer named — in the flesh's group — never one a person renamed, and --bars names it back", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const nameable = h.wires().filter((w) => ["list", "detail", "form", "search", "gallery"].includes(h.specOf(w.id).archetype) && !h.specOf(w.id).variantOf);
    expect(nameable.length).toBeGreaterThanOrEqual(2);
    const [mine, theirs] = nameable as [typeof nameable[0], typeof nameable[0]];
    const theirTitle = h.items.get(theirs.id)!.title;
    h.items.get(mine.id)!.title = "Acme's own name";
    const before = h.sent.length;
    await h.cli("wire", "flesh", "--pack", "deliveries");
    expect(h.errors).toEqual([]);
    const renames = h.sent.slice(before).filter((o) => o.op.type === "item.update");
    expect(new Set(h.sent.slice(before).map((o) => o.group)).size).toBe(1);
    expect(renames.some((o) => (o.op as { itemId: string }).itemId === mine.id)).toBe(false);
    expect(h.items.get(mine.id)!.title).toBe("Acme's own name");
    expect(h.items.get(theirs.id)!.title).not.toBe(theirTitle);
    expect(["Deliveries", "Delivery", "New delivery", "Search deliveries"].some((t) => h.items.get(theirs.id)!.title.startsWith(t))).toBe(true);
    await h.cli("wire", "flesh", "--bars");
    expect(h.items.get(theirs.id)!.title).toBe(theirTitle);
    expect(h.items.get(mine.id)!.title).toBe("Acme's own name");
  });
});

describe("isocan wire copy", () => {
  it("prints words by slot and path; --apply writes exact words as one version, source copy; flesh then leaves them alone", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const target = h.wires().find((w) => h.specOf(w.id).archetype === "home") ?? h.wires()[0]!;
    await h.cli("wire", "copy", target.id);
    expect(h.errors.at(-1)).toMatch(/draws bars/);

    await h.cli("wire", "flesh", "--pack", "deliveries");
    const json = JSON.parse(await h.cli("wire", "copy", target.id)) as { screen: string; slots: Record<string, { block: string; words: Record<string, string> }> };
    expect(json.screen).toBe(target.id);
    const [slot, entry] = Object.entries(json.slots).find(([, v]) => Object.keys(v.words).length > 0)!;
    const path = Object.keys(entry.words)[0]!;
    const file = `${tmpdir()}/copy-${Date.now()}.json`;
    await writeFile(file, JSON.stringify({ title: "Your parcels", slots: { [slot]: { ...entry, words: { [path]: "Parcel 4471" } } } }));
    const before = h.sent.length;
    await h.cli("wire", "copy", target.id, "--apply", file, "--by", "agent-acme");
    expect(h.errors.filter((e) => !/draws bars/.test(e))).toEqual([]);
    expect(h.sent.length).toBe(before + 1);
    const spec = h.specOf(target.id);
    expect(spec.content).toMatchObject({ source: "copy", by: "agent-acme", pack: "deliveries", title: "Your parcels" });
    expect(h.htmlOf(target.id)).toContain("Parcel 4471");
    expect(h.htmlOf(target.id)).toContain(">Your parcels<");

    const n = h.sent.length;
    const printed = await h.cli("wire", "flesh");
    expect(h.sent.length).toBe(n);
    expect(printed).toMatch(/keeps the exact words/);

    await writeFile(file, JSON.stringify({ slots: { [slot]: { "items.999.title": "x" } } }));
    await h.cli("wire", "copy", target.id, "--apply", file);
    expect(h.errors.at(-1)).toMatch(/no word at "items\.999\.title"/);
    expect(h.sent.length).toBe(n);
  });
});
