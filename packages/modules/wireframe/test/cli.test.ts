import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import type { Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { blueprint, readWire, renderWire, wireSize, wireframe } from "../src/core.ts";

/**
 * **`wire render` is one `item.add` of an ordinary HTML file** — driven in
 * process through the module's `register`, with a host that records what it
 * is asked to do. The daemon half (placement, the op's receipt) is the CLI's
 * own and has its own tests; what this holds is the module's part: the bytes
 * uploaded are exactly `renderWire(spec)`, the mime is `text/html`, the size
 * is the platform's, there is one op and it is an `item.add`, and a spec that
 * would draw wrong never reaches the canvas.
 */

function harness() {
  const program = new Command().exitOverride().option("--json");
  const ops: Operation[] = [];
  const uploads: Array<{ bytes: string; mime: string; filename: string }> = [];
  const errors: string[] = [];
  const logs: string[] = [];
  const ctx = {
    json: false,
    client: {
      snapshot: async () => ({ canvas: { items: {} }, project: {} }),
      uploadBlob: async (_canvas: string, bytes: Buffer, mime: string, filename: string) => {
        uploads.push({ bytes: bytes.toString("utf8"), mime, filename });
        return { blobHash: "hash-acme", size: bytes.length };
      },
    },
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
    resolveItem: () => {
      throw new Error("unused");
    },
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation) => {
      ops.push(op);
      return { envelope: { op } };
    },
    insertionReceiptPlacement: () => ({ x: 10, y: 20 }),
    printJson: (v: unknown) => logs.push(JSON.stringify(v)),
    sizeFor: (_s: string | undefined, f: { width: number; height: number }) => f,
    placementFor: (_snap: unknown, opts: { at?: string }) => (opts.at ? { x: Number(opts.at.split(",")[0]), y: Number(opts.at.split(",")[1]), chosen: true } : { x: 0, y: 0 }),
    truncate: (t: string) => t,
    runFenced: async () => {
      throw new Error("unused");
    },
    enrol: async () => {
      throw new Error("unused");
    },
    withdraw: async () => {},
  } as unknown as CliHost;
  wireframeCli.register(host);
  return { program, ops, uploads, errors, logs };
}

function specFile(spec: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-wire-"));
  const file = path.join(dir, "spec.json");
  writeFileSync(file, JSON.stringify(spec));
  return file;
}

describe("isocan wire render", () => {
  it("adds one HTML item whose bytes are the rendered spec", async () => {
    const h = harness();
    const spec = wireframe("sign-in", { request: "Acme sign in" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await h.program.parseAsync(["node", "isocan", "wire", "render", specFile(spec), "--at", "100,200", "--title", "Acme sign in"]);
    log.mockRestore();
    expect(h.errors).toEqual([]);
    expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0]!.mime).toBe("text/html");
    expect(h.uploads[0]!.filename).toBe("acme-sign-in.html");
    expect(h.uploads[0]!.bytes).toBe(renderWire(spec));
    expect(readWire(h.uploads[0]!.bytes)).toStrictEqual(spec);
    expect(h.ops).toHaveLength(1);
    const op = h.ops[0]! as Extract<Operation, { type: "item.add" }>;
    expect(op.type).toBe("item.add");
    expect(op.version.mimeType).toBe("text/html");
    expect(op.version.blobHash).toBe("hash-acme");
    expect({ width: op.width, height: op.height }).toEqual(wireSize(spec));
    expect(op.placement).toEqual({ x: 100, y: 200, chosen: true });
    expect(op.title).toBe("Acme sign in");
    // No property the module owns: the screen is an ordinary HTML item.
    expect(op.properties).toBeUndefined();
  });

  it("adds a blueprint as readily as a wireframe", async () => {
    const h = harness();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await h.program.parseAsync(["node", "isocan", "wire", "render", specFile(blueprint("home", { platform: "web" }))]);
    const printed = log.mock.calls.flat().join("\n");
    log.mockRestore();
    expect(h.errors).toEqual([]);
    expect(h.ops).toHaveLength(1);
    expect(printed).toContain("home, web, blueprint");
  });

  it("refuses a spec that would draw wrong, before anything is uploaded", async () => {
    const h = harness();
    const spec = wireframe("sign-in");
    spec.slots.find((s) => s.slot === "main.3")!.intents = { submit: "Log me in" as never };
    await h.program.parseAsync(["node", "isocan", "wire", "render", specFile(spec)]);
    expect(h.errors.join("\n")).toMatch(/is not a drawable wireframe spec[\s\S]*is not an intent/);
    expect(h.uploads).toEqual([]);
    expect(h.ops).toEqual([]);
  });
});

describe("isocan wire spec", () => {
  it("prints a blueprint, or with --resolved a wireframe, that render accepts", async () => {
    for (const resolved of [false, true]) {
      const h = harness();
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await h.program.parseAsync(["node", "isocan", "wire", "spec", "detail", "--platform", "web", ...(resolved ? ["--resolved"] : [])]);
      const printed = log.mock.calls.flat().join("\n");
      log.mockRestore();
      expect(h.errors).toEqual([]);
      const spec = JSON.parse(printed);
      expect(spec).toStrictEqual(resolved ? wireframe("detail", { platform: "web" }) : blueprint("detail", { platform: "web" }));
    }
  });

  it("names a later wave's archetype as later, not unknown", async () => {
    const h = harness();
    await h.program.parseAsync(["node", "isocan", "wire", "spec", "checkout"]);
    expect(h.errors.join("\n")).toContain("later wave");
  });
});
