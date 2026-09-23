import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, type Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { RECIPES, readWire, stubAnswerer, validateWire, type RoundFile, type WireSpec } from "../src/core.ts";

/**
 * **`isocan wire "<request>"` against a canvas held in memory.**
 *
 * The host records every op with the group it was sent under and applies the
 * three the composer uses — `item.add`, `item.addVersion`, `item.update`,
 * `item.resize` — to a map of items, so `wire questions` can read the flow
 * back off "the canvas" exactly as it would off a daemon. What this holds:
 * the first op is a blueprint added before any answer; every later write to
 * a screen is a version of the same item; every op of one request carries
 * one group (so one undo takes it back); and an agent answering through
 * `wire questions` / `wire answer` draws the same kind of flow with no key.
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

function harness() {
  const program = new Command().exitOverride().option("--json");
  const sent: Array<{ op: Operation; group?: string }> = [];
  const blobs = new Map<string, string>();
  const items = new Map<string, FakeItem>();
  const errors: string[] = [];
  const logs: string[] = [];
  const ctx = {
    json: false,
    client: {
      snapshot: async () => ({ canvas: { items: Object.fromEntries(items) }, project: {} }),
      uploadBlob: async (_canvas: string, bytes: Buffer) => {
        const hash = `hash-${blobs.size + 1}`;
        blobs.set(hash, bytes.toString("utf8"));
        return { blobHash: hash, size: bytes.length };
      },
      downloadBlob: async (_canvas: string, hash: string) => Buffer.from(blobs.get(hash)!, "utf8"),
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
      if (op.patch.title) items.get(op.itemId)!.title = op.patch.title;
    } else if (op.type === "item.resize") {
      Object.assign(items.get(op.itemId)!, { width: op.width, height: op.height });
    } else throw new Error(`the composer sent an op it should not: ${op.type}`);
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
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation, group?: string) => {
      sent.push({ op, ...(group ? { group } : {}) });
      apply(op);
      return { envelope: { op } };
    },
    insertionReceiptPlacement: (op: Extract<Operation, { type: "item.add" }>) => op.placement,
    printJson: (v: unknown) => logs.push(JSON.stringify(v)),
    sizeFor: (_s: string | undefined, f: { width: number; height: number }) => f,
    placementFor: () => ({ x: 0, y: 0 }),
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
  const specOf = (itemId: string, version?: number): WireSpec => {
    const item = items.get(itemId)!;
    const v = version === undefined ? item.versions.find((x) => x.id === item.currentVersionId)! : item.versions[version]!;
    return readWire(blobs.get(v.blobHash)!)!;
  };
  const cli = async (...args: string[]) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "isocan", ...args]);
    const printed = log.mock.calls.flat().join("\n");
    log.mockRestore();
    return printed;
  };
  return { cli, sent, items, errors, logs, specOf };
}

const REQUEST = "an ordering app for Acme's kitchen — sign in, take orders, see what is waiting";

let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = savedKey;
});

describe('isocan wire "<request>"', () => {
  it("draws a blueprint first, then fills every screen in place — all under one op group", async () => {
    const h = harness();
    const printed = await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    expect(h.errors).toEqual([]);
    // The very first write is a blueprint titled with the request, every slot blue.
    const first = h.sent[0]!.op as Extract<Operation, { type: "item.add" }>;
    expect(first.type).toBe("item.add");
    expect(first.title).toBe(REQUEST);
    expect(first.properties).toEqual({ [FIDELITY_PROP]: "wireframe" });
    const v1 = h.specOf(first.itemId, 0);
    expect(v1.round).toBe(0);
    expect(v1.slots.every((s) => s.block === null)).toBe(true);
    // One group for the whole request, and it is the flow's id.
    const groups = new Set(h.sent.map((s) => s.group));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBe(v1.flow);
    // Only the three existing ops the design names, plus the resize a platform can need.
    expect(new Set(h.sent.map((s) => s.op.type))).toEqual(new Set(["item.add", "item.addVersion", "item.update", ...(h.sent.some((s) => s.op.type === "item.resize") ? ["item.resize"] : [])]));
    // Every screen was added once and then versioned, never replaced.
    const adds = h.sent.filter((s) => s.op.type === "item.add").map((s) => (s.op as { itemId: string }).itemId);
    expect(h.items.size).toBe(adds.length);
    const screens = [...h.items.values()];
    for (const item of screens) {
      const spec = h.specOf(item.id);
      expect(validateWire(spec)).toEqual([]);
      expect(spec.round).toBe(3);
      expect(spec.slots.every((s) => s.block !== null)).toBe(true);
      expect(item.title).toBe(spec.title);
      // blueprint (round 1) → structure (round 2) → props (round 3), in the same item.
      const rounds = item.versions.map((_, i) => h.specOf(item.id, i).round);
      expect(rounds.slice(-3)).toEqual([1, 2, 3]);
    }
    // In a row, in the archetypes' running order.
    const byX = [...screens].sort((a, b) => a.x - b.x).map((i) => RECIPES.findIndex((r) => r.id === h.specOf(i.id).archetype));
    expect(byX).toEqual([...byX].sort((a, b) => a - b));
    expect(new Set(screens.map((i) => i.y)).size).toBe(1);
    expect(printed).toContain("before any answer");
    expect(printed).toContain("answering with the stub (seed 4) — no TYPESAFE_API_KEY here");
    expect(printed).toMatch(/\d+ screens, one op group — answered by stub \(seed 4\) · round 1 \d+ ms · round 2 \d+ ms · round 3 \d+ ms · \d+ calls · 0 input tokens · \$0\.000000/);
  });

  it("says which answerer answered, and refuses Jev without a key rather than drawing random screens under its name", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "jev");
    expect(h.errors.join("\n")).toMatch(/needs TYPESAFE_API_KEY/);
    expect(h.sent).toEqual([]);
  });
});

describe("the agent answers in Jev's place: wire questions / wire answer", () => {
  it("walks all three rounds with no key, and draws the same kind of flow in one op group", async () => {
    const h = harness();
    const started = await h.cli("wire", REQUEST, "--answerer", "agent");
    expect(started).toContain("isocan wire questions");
    expect(h.items.size).toBe(1);
    const stub = stubAnswerer(9);
    const dir = mkdtempSync(path.join(tmpdir(), "acme-wire-"));
    for (const round of [1, 2, 3]) {
      const file = JSON.parse(await h.cli("wire", "questions")) as RoundFile;
      expect(h.errors).toEqual([]);
      expect(file.round).toBe(round);
      expect(file.calls.length).toBe(round === 1 ? 1 : h.items.size);
      // The agent's part: answer each call in Jev's response shape.
      for (const call of file.calls) call.response = (await stub.answer(call.request)).response;
      const answers = path.join(dir, `round-${round}.json`);
      writeFileSync(answers, JSON.stringify(file));
      await h.cli("wire", "answer", answers);
      expect(h.errors).toEqual([]);
    }
    for (const item of h.items.values()) {
      const spec = h.specOf(item.id);
      expect(validateWire(spec)).toEqual([]);
      expect(spec.round).toBe(3);
    }
    expect(new Set(h.sent.map((s) => s.group)).size).toBe(1);
    await h.cli("wire", "questions");
    expect(h.errors.at(-1)).toMatch(/no wireframe flow on this canvas is waiting/);
  });

  it("refuses an answer file that answers the wrong round, or answers a question with an option it never offered", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "agent");
    const file = JSON.parse(await h.cli("wire", "questions")) as RoundFile;
    const dir = mkdtempSync(path.join(tmpdir(), "acme-wire-"));
    const before = h.sent.length;

    const wrong = path.join(dir, "wrong-round.json");
    writeFileSync(wrong, JSON.stringify({ ...file, round: 2 }));
    await h.cli("wire", "answer", wrong);
    expect(h.errors.at(-1)).toMatch(/answers round 2, but flow .* is waiting on round 1/);

    const call = file.calls[0]!;
    call.response = (await stubAnswerer(1).answer(call.request)).response;
    (call.response.answers.platform as { choice: string }).choice = "fridge";
    const bad = path.join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify(file));
    await h.cli("wire", "answer", bad);
    expect(h.errors.at(-1)).toMatch(/choice "fridge" is not one of app, web, site/);
    expect(h.sent.length).toBe(before);
  });
});
