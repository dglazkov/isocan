import { Command } from "commander";
import { vi } from "vitest";
import type { Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { PROTOTYPE_PROP, readWire, type WireSpec } from "../src/core.ts";

/**
 * **The wireframe CLI against a canvas held in memory** — `flesh-cli.test.ts`'s
 * harness (itself `style-cli.test.ts`'s), lifted here so the web's *Choose a
 * voice…* test (`packages/web/test/flowvoice.test.ts`) can build a flow the
 * CLI's way and hold the web's landing to the CLI's on the same canvas.
 * `blobs`, `blob` and `apply` are the canvas's own doors, for a fake web host.
 */
export interface FakeItem {
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

export function harness() {
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
  return { cli, sent, items, blobs, blob, apply, errors, specOf, htmlOf, wires, design, designVersion, group };
}
