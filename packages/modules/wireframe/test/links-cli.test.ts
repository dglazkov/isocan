import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, type Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { LINKS_PROP, PROTOTYPE_MARKER, PROTOTYPE_PROP, renderWire, resolveSlot, wireframe, type WireSpec } from "../src/core.ts";

/**
 * **`wire links`, `wire link`, `wire prototype` against a canvas in memory.**
 *
 * Four kept screens in a row — Acme's sign in, home, deliveries, delivery —
 * and one unkept settings screen. What this holds: `link` is one
 * `item.update` of that hotspot's own `wireLink:<key>` on the source screen; `prototype` is one
 * `item.add` beside the kept screens the first time and an `item.addVersion`
 * on the same item after a kept screen changes, each under one op group; a
 * rebuild with nothing changed writes nothing.
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
  versions: Array<{ id: string; blobHash: string; mimeType: string }>;
}

const o = { request: "Acme couriers", flow: "flw_acme" };

function harness() {
  const program = new Command().exitOverride().option("--json");
  const sent: Array<{ op: Operation; group?: string }> = [];
  const blobs = new Map<string, string>();
  const items = new Map<string, FakeItem>();
  const errors: string[] = [];
  const store = (html: string) => {
    const hash = `hash-${[...html].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)}`;
    blobs.set(hash, html);
    return hash;
  };
  const downloads: string[] = [];
  const put = (id: string, title: string, spec: WireSpec, x: number, kept = true, y = 0) => {
    const blobHash = store(renderWire(spec));
    items.set(id, {
      id, title, x, y, width: 390, height: 844,
      properties: { [FIDELITY_PROP]: "wireframe", ...(kept ? { wireKeep: "yes" } : {}) },
      currentVersionId: `v-${id}-1`, versions: [{ id: `v-${id}-1`, blobHash, mimeType: "text/html" }],
    });
  };
  put("it_signin", "Sign in", wireframe("sign-in", o), 0);
  put("it_home", "Home", wireframe("home", o), 500);
  put("it_list", "Deliveries", wireframe("list", o), 1000);
  put("it_detail", "Delivery", wireframe("detail", o), 1500);
  put("it_settings", "Settings", wireframe("settings", o), 2000, false);

  const ctx = {
    json: false,
    client: {
      snapshot: async () => ({ canvas: { items: structuredClone(Object.fromEntries(items)) }, project: {} }),
      uploadBlob: async (_canvas: string, bytes: Buffer) => {
        const html = bytes.toString("utf8");
        return { blobHash: store(html), size: bytes.length };
      },
      downloadBlob: async (_canvas: string, hash: string) => {
        downloads.push(hash);
        return Buffer.from(blobs.get(hash)!, "utf8");
      },
      // A home with no key of its own: what every test daemon is.
      judgment: async () => {
        throw Object.assign(new Error("this home has no judge"), { code: "judgment-unavailable" });
      },
    },
  };
  const apply = (op: Operation) => {
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
      for (const key of op.patch.removeProperties ?? []) delete item.properties[key];
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
    placementFor: () => ({ x: 0, y: 0 }),
    truncate: (t: string) => t,
  } as unknown as CliHost;
  wireframeCli.register(host);
  const cli = async (...args: string[]) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "isocan", ...args]);
    const printed = log.mock.calls.flat().join("\n");
    log.mockRestore();
    return printed;
  };
  const rewrite = (id: string, spec: WireSpec) => {
    const item = items.get(id)!;
    const version = { id: `${item.currentVersionId}+`, blobHash: store(renderWire(spec)), mimeType: "text/html" };
    item.versions.push(version);
    item.currentVersionId = version.id;
  };
  const add = (id: string, title: string, spec: WireSpec, x: number, y: number) => put(id, title, spec, x, true, y);
  return { cli, sent, items, blobs, errors, rewrite, downloads, add };
}

describe("isocan wire links", () => {
  it("prints each kept screen's hotspots and where they go, naming what the dashed ones need", async () => {
    const h = harness();
    const printed = await h.cli("wire", "links");
    expect(h.errors).toEqual([]);
    expect(printed).toMatch(/main\.3#submit\s+Sign in\s+→ "Home"\s+intent, dissolve/);
    expect(printed).toMatch(/main\.3#row\s+Row\s+→ "Delivery"\s+row, push/);
    expect(printed).toMatch(/nav#tab-2\s+Search\s+→ "Deliveries"\s+tab, none/);
    expect(printed).toMatch(/header#leading\s+Back\s+back/);
    expect(printed).toMatch(/nav#tab-4\s+Profile\s+- - needs Profile/);
    expect(printed).toMatch(/still to make: .*Profile/);
    expect(h.sent).toEqual([]);
  });
});

describe("isocan wire link", () => {
  it("is one item.update of that hotspot's own property on the source screen; --none and --clear follow", async () => {
    const h = harness();
    await h.cli("wire", "link", "it_list", "row", "it_settings");
    expect(h.errors).toEqual([]);
    expect(h.sent).toHaveLength(1);
    // One property per hotspot (phase 8): a second writer on another hotspot cannot drop this one.
    expect(h.sent[0]!.op).toEqual({ type: "item.update", itemId: "it_list", patch: { properties: { "wireLink:main.3#row": "it_settings" } } });
    // Settings is not kept, so the link names it and waits.
    expect(await h.cli("wire", "links", "it_list")).toMatch(/main\.3#row\s+Row\s+- - needs a screen that is not kept \(it_settings\)\s+override/);
    await h.cli("wire", "link", "it_list", "main.3#row", "--none");
    expect(h.items.get("it_list")!.properties["wireLink:main.3#row"]).toBe("none");
    expect(await h.cli("wire", "links", "it_list")).toMatch(/main\.3#row\s+Row\s+off\s+override/);
    await h.cli("wire", "link", "it_list", "row", "--clear");
    expect(h.items.get("it_list")!.properties["wireLink:main.3#row"]).toBeUndefined();
    expect(h.sent.at(-1)!.op).toMatchObject({ patch: { removeProperties: ["wireLink:main.3#row"] } });
    // Clearing what is already clear sends nothing.
    const before = h.sent.length;
    await h.cli("wire", "link", "it_list", "row", "--clear");
    expect(h.sent.length).toBe(before);
    expect(h.items.get("it_list")!.properties[LINKS_PROP]).toBeUndefined();
  });

  it("reads only the source screen's file — not every wire on the canvas (Porchlight #3)", async () => {
    const h = harness();
    const reads = h.downloads.length;
    await h.cli("wire", "link", "it_list", "row", "it_detail");
    expect(h.errors).toEqual([]);
    expect(h.downloads.slice(reads)).toEqual([h.items.get("it_list")!.versions[0]!.blobHash]);
  });

  it("links to a screen kept in ANOTHER flow, and the prototype plays it (Porchlight #5)", async () => {
    const h = harness();
    // A second flow with its own kept Profile screen.
    h.add("it_profile", "Profile", wireframe("profile", { request: "Acme lending side", flow: "flw_lend" }), 0, 2000);
    await h.cli("wire", "link", "it_home", "tab-4", "it_profile");
    expect(h.errors).toEqual([]);
    const printed = await h.cli("wire", "links", "--flow", "flw_acme");
    expect(printed).toMatch(/nav#tab-4\s+Profile\s+→ "Profile"\s+override/);
    expect(printed).not.toMatch(/not kept/);
    // The guest is not listed as one of this flow's screens.
    expect(printed).not.toMatch(/^it_profile /m);
    await h.cli("wire", "prototype", "--flow", "flw_acme");
    const add = h.sent.find((s) => s.op.type === "item.add")!.op as Extract<Operation, { type: "item.add" }>;
    expect(h.blobs.get(add.version.blobHash)!).toContain('data-screen="it_profile"');
  });

  it("refuses a hotspot the screen does not have, and a target that is not a screen", async () => {
    const h = harness();
    await h.cli("wire", "link", "it_list", "nowhere", "it_home");
    expect(h.errors.at(-1)).toMatch(/has no hotspot "nowhere" — its hotspots: header#leading/);
    await h.cli("wire", "link", "it_list", "row");
    expect(h.errors.at(-1)).toMatch(/say where it goes/);
    expect(h.sent).toEqual([]);
  });
});

describe("isocan wire prototype", () => {
  it("adds one HTML item beside the kept screens, then versions it when a kept screen changes", async () => {
    const h = harness();
    const first = await h.cli("wire", "prototype");
    expect(h.errors).toEqual([]);
    const add = h.sent.find((s) => s.op.type === "item.add")!.op as Extract<Operation, { type: "item.add" }>;
    expect(add.properties).toEqual({ [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: "flw_acme" });
    // Right of the whole row, the unkept Settings screen at 2000 included, so it covers nothing.
    expect((add.placement as { x: number }).x).toBeGreaterThan(2000 + 390);
    const html = h.blobs.get(add.version.blobHash)!;
    expect(html).toContain(PROTOTYPE_MARKER);
    for (const id of ["it_signin", "it_home", "it_list", "it_detail"]) expect(html).toContain(`data-screen="${id}"`);
    expect(html).not.toContain('data-screen="it_settings"');
    expect(first).toMatch(/added beside the kept screens/);
    expect(first).toMatch(/4 screens: Sign in · Home · Deliveries · Delivery/);

    // Nothing changed: nothing written.
    const before = h.sent.length;
    expect(await h.cli("wire", "prototype")).toMatch(/unchanged \(still version 1\)/);
    expect(h.sent.length).toBe(before);

    // Change a kept screen: the same item gains a version, in one group.
    const detail = wireframe("detail", o);
    h.rewrite("it_detail", { ...detail, slots: detail.slots.map((s) => (s.slot === "main.2" ? resolveSlot("detail", "main.2", "long-form") : s)) });
    const again = await h.cli("wire", "prototype");
    const rebuilt = h.sent.slice(before);
    expect(rebuilt.map((s) => s.op.type)).toEqual(["item.addVersion"]);
    expect((rebuilt[0]!.op as { itemId: string }).itemId).toBe(add.itemId);
    expect(h.items.get(add.itemId)!.versions).toHaveLength(2);
    expect(again).toMatch(/version 2/);
    expect([...h.items.values()].filter((i) => i.properties[PROTOTYPE_PROP])).toHaveLength(1);
  });

  it("refuses to keep a prototype — it plays screens, it is not one", async () => {
    const h = harness();
    await h.cli("wire", "prototype");
    const proto = [...h.items.values()].find((i) => i.properties[PROTOTYPE_PROP])!;
    await h.cli("wire", "keep", proto.id);
    expect(h.errors.at(-1)).toMatch(/not a wireframe screen/);
  });

  it("says so when nothing is kept", async () => {
    const h = harness();
    for (const item of h.items.values()) delete item.properties.wireKeep;
    await h.cli("wire", "prototype");
    expect(h.errors.at(-1)).toMatch(/nothing is kept/);
  });
});
