import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { PROTOTYPE_PROP, readWire, type JevRequest, type WireSpec } from "../src/core.ts";
import { ACME_NIGHT, ACME_WARM, PICKS } from "./fixtures/design-systems.ts";

/**
 * **`isocan wire style` against a canvas held in memory** (phase 4, design
 * §9): the governing system found for each wire (a group's own first), the
 * mapping asked once per system version and never again while nothing
 * changed, one op group of `item.addVersion`s — only on wires whose theme
 * changed — and `--default`, `--check`, the prototype and a new flow all
 * following. Jev is a fake `fetch` that answers the mapping the way a
 * well-read answerer would and counts its calls.
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

const REQUEST = "an ordering app for Acme's kitchen — sign in, take orders, see what is waiting";

/** Jev, faked at `fetch`: the mapping answered as `PICKS` says, at 0.9. Rounds are never sent here — flows use the stub. */
function fakeJev() {
  const calls: JevRequest[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const request = JSON.parse(init.body) as JevRequest;
    calls.push(request);
    const picks = PICKS[(request.state as { system: string }).system] ?? {};
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(request.questions)) {
      const keys = Object.keys((q as { criteria: Record<string, string> }).criteria);
      const choice = picks[id] && keys.includes(picks[id]!) ? picks[id]! : keys[0]!;
      answers[id] = { type: "choice", choice, probabilities: Object.fromEntries(keys.map((k) => [k, k === choice ? 0.9 : 0.1 / (keys.length - 1)])) };
    }
    return new Response(JSON.stringify({ model: "jev-test", answers, usage: { input_tokens: 2000, output_tokens: 0 } }), { status: 200, headers: { "content-type": "application/json" } });
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

describe("isocan wire style", () => {
  it("maps the governing system once, and versions every wire in one op group", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    const wires = h.wires();
    expect(wires.length).toBeGreaterThan(3);
    // No system governs yet: the flow is in the default look.
    for (const w of wires) expect(h.specOf(w.id).style).toBeUndefined();

    h.design("ds-warm", ACME_WARM);
    const jev = fakeJev();
    const before = h.sent.length;
    const printed = await h.cli("wire", "style", "--answerer", "jev");
    expect(h.errors).toEqual([]);
    expect(jev).toHaveLength(1);
    const ops = h.sent.slice(before);
    expect(ops.every((o) => o.op.type === "item.addVersion")).toBe(true);
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    expect(ops.map((o) => (o.op as { itemId: string }).itemId).sort()).toEqual(wires.map((w) => w.id).sort());
    for (const w of wires) {
      const spec = h.specOf(w.id);
      expect(spec.style).toMatchObject({ source: "design-system", itemId: "ds-warm", versionId: "ds-warm-v1", name: "Acme Warm" });
      if (spec.style?.source !== "design-system") throw new Error("unreachable");
      expect(spec.style.roles.primary).toEqual({ token: "accent", value: "#d10a72", p: 0.9, why: "asked" });
      expect(h.htmlOf(w.id)).toContain("--w-primary:#d10a72");
      // The same screen: every slot as it was.
      expect(spec.slots).toStrictEqual(h.specOf(w.id, w.versions.length - 2).slots);
    }
    expect(printed).toMatch(/primary\s+accent\s+#d10a72\s+p 0\.90/);
    expect(printed).toMatch(/font\s+headline\s+Archivo, system-ui, sans-serif\s+the only one/);
    expect(printed).toContain(`${wires.length} of ${wires.length} wires restyled`);
    expect(printed).toContain("1 call to jev-test");

    // Again, with nothing changed: nothing asked, nothing written.
    const quiet = h.sent.length;
    const again = await h.cli("wire", "style", "--answerer", "jev");
    expect(jev).toHaveLength(1);
    expect(h.sent.length).toBe(quiet);
    expect(again).toContain(`0 of ${wires.length} wires restyled`);
    expect(again).toContain("nothing asked");
  });

  it("says which wires are behind a new version of the system, and brings them forward", async () => {
    const h = harness();
    h.design("ds-warm", ACME_WARM);
    const jev = fakeJev();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    const n = h.wires().length;
    // The flow arrived with the stub's mapping (it answered the rounds); Jev's is asked, not the stub's lent.
    for (const w of h.wires()) expect(h.specOf(w.id).style).toMatchObject({ by: "stub (seed 4)" });
    await h.cli("wire", "style", "--answerer", "jev");
    expect(jev).toHaveLength(1);
    for (const w of h.wires()) expect(h.specOf(w.id).style).toMatchObject({ by: "jev-test" });
    expect(await h.cli("wire", "style", "--check")).toContain(`all ${n} wires draw in the system that governs them`);

    h.designVersion("ds-warm", ACME_WARM.replace("#d10a72", "#b0085f"));
    const check = await h.cli("wire", "style", "--check");
    expect(check).toContain(`${n} of ${n} wires are not in the system that governs them`);
    expect(check).toMatch(/behind: drawn in "Acme Warm" version 1, governed by "DESIGN.md" version 2 of 2/);
    const calls = jev.length;
    const before = h.sent.length;
    await h.cli("wire", "style", "--answerer", "jev");
    expect(jev).toHaveLength(calls + 1);
    expect(h.sent.length - before).toBe(n);
    for (const w of h.wires()) expect(h.specOf(w.id).style).toMatchObject({ versionId: "ds-warm-v2" });
    expect(h.htmlOf(h.wires()[0]!.id)).toContain("--w-primary:#b0085f");
  });

  it("--default restores the greys, as one more op group", async () => {
    const h = harness();
    h.design("ds-warm", ACME_WARM);
    fakeJev();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "2");
    await h.cli("wire", "style", "--answerer", "jev");
    const before = h.sent.length;
    const printed = await h.cli("wire", "style", "--default");
    const ops = h.sent.slice(before);
    expect(ops.length).toBe(h.wires().length);
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    for (const w of h.wires()) {
      expect(h.specOf(w.id).style).toEqual({ source: "default" });
      expect(h.htmlOf(w.id)).toContain("--w-primary:#222222");
    }
    expect(printed).toContain("in the default look");
    // Default again: nothing to write.
    const quiet = h.sent.length;
    await h.cli("wire", "style", "--default");
    expect(h.sent.length).toBe(quiet);
  });

  it("a group's own system governs the flows inside it; the canvas's governs the rest", async () => {
    const h = harness();
    h.design("ds-warm", ACME_WARM);
    h.group("group-back-office");
    h.design("ds-night", ACME_NIGHT, "group-back-office");
    const jev = fakeJev();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    const outside = h.wires().map((w) => w.id);
    await h.cli("wire", "a stock screen for Acme's back office", "--answerer", "stub", "--seed", "3", "--in", "group-back-office");
    expect(h.errors).toEqual([]);
    const inside = h.wires().map((w) => w.id).filter((id) => !outside.includes(id));
    expect(inside.length).toBeGreaterThan(0);
    for (const id of inside) expect(h.items.get(id)!.containerId).toBe("group-back-office");
    // Arrived in their systems — the stub's flat answers keep the asked roles at the default, but the system is named.
    for (const id of outside) expect(h.specOf(id).style).toMatchObject({ itemId: "ds-warm" });
    for (const id of inside) expect(h.specOf(id).style).toMatchObject({ itemId: "ds-night" });

    await h.cli("wire", "style", "--answerer", "jev");
    expect(jev).toHaveLength(2);
    for (const id of outside) expect(h.htmlOf(id)).toContain("--w-primary:#d10a72");
    for (const id of inside) expect(h.htmlOf(id)).toContain("--w-primary:#5e6ad2");

    // A new version of the group's system: only the wires it governs gain a version.
    h.designVersion("ds-night", ACME_NIGHT.replace("#5e6ad2", "#4c56c0"));
    const before = h.sent.length;
    await h.cli("wire", "style", "--answerer", "jev");
    expect(jev).toHaveLength(3);
    expect(h.sent.slice(before).map((o) => (o.op as { itemId: string }).itemId).sort()).toEqual([...inside].sort());
  });

  it("a flow asked for where a system governs arrives in it — blue first, then the system", async () => {
    const h = harness();
    h.design("ds-warm", ACME_WARM);
    const jev = fakeJev();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    // The stub answered the rounds, so the stub answered the mapping: Jev was never called.
    expect(jev).toHaveLength(0);
    expect(h.errors).toEqual([]);
    const first = h.wires()[0]!;
    // The very first frame is the blueprint, in no theme at all.
    expect(h.specOf(first.id, 0).style).toBeUndefined();
    for (const w of h.wires()) {
      const style = h.specOf(w.id).style;
      expect(style).toMatchObject({ source: "design-system", itemId: "ds-warm", versionId: "ds-warm-v1" });
      if (style?.source !== "design-system") throw new Error("unreachable");
      // The stub cannot say which colour is the brand's: it keeps the default and says so.
      expect(style.roles.primary).toMatchObject({ value: "#222222", why: "unsure" });
      expect(style.roles.font).toMatchObject({ value: "Archivo, system-ui, sans-serif", why: "only" });
    }
  });

  it("rebuilds a kept flow's prototype in the same group, so it plays in the new look", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    const [a, b] = h.wires().filter((w) => !h.specOf(w.id).variantOf);
    await h.cli("wire", "keep", a!.id, b!.id);
    await h.cli("wire", "prototype");
    const proto = [...h.items.values()].find((i) => i.properties[PROTOTYPE_PROP])!;
    expect(proto).toBeDefined();
    h.design("ds-warm", ACME_WARM);
    fakeJev();
    const before = h.sent.length;
    const printed = await h.cli("wire", "style", "--answerer", "jev");
    const ops = h.sent.slice(before);
    expect(new Set(ops.map((o) => o.group)).size).toBe(1);
    expect(ops.some((o) => o.op.type === "item.addVersion" && o.op.itemId === proto.id)).toBe(true);
    expect(h.htmlOf(proto.id)).toContain("--w-primary:#d10a72");
    expect(printed).toContain(`prototype ${proto.id} — rebuilt as a new version`);
  });
});
