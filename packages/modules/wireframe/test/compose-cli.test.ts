import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, type Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { MAYBE_PROP, NEEDS_YES, RECIPES, keptBy, maybeMarked, readWire, stubAnswerer, validateWire, type RoundFile, type WireSpec } from "../src/core.ts";

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

/** `actor`: who the CLI goes out as — unset, as on a daemon that never asked for a name. */
function harness(actor?: { id: string; name: string }) {
  const program = new Command().exitOverride().option("--json");
  const sent: Array<{ op: Operation; group?: string }> = [];
  const blobs = new Map<string, string>();
  const items = new Map<string, FakeItem>();
  const errors: string[] = [];
  const logs: string[] = [];
  const ctx = {
    json: false,
    ...(actor ? { actor } : {}),
    client: {
      snapshot: async () => ({ canvas: { items: Object.fromEntries(items) }, project: {} }),
      uploadBlob: async (_canvas: string, bytes: Buffer) => {
        const hash = `hash-${blobs.size + 1}`;
        blobs.set(hash, bytes.toString("utf8"));
        return { blobHash: hash, size: bytes.length };
      },
      downloadBlob: async (_canvas: string, hash: string) => Buffer.from(blobs.get(hash)!, "utf8"),
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
      if (op.patch.removeProperties) {
        item.properties = { ...item.properties };
        for (const key of op.patch.removeProperties) delete item.properties[key];
      }
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
  const htmlOf = (itemId: string): string => {
    const item = items.get(itemId)!;
    return blobs.get(item.versions.find((x) => x.id === item.currentVersionId)!.blobHash)!;
  };
  return { cli, sent, items, errors, logs, specOf, htmlOf, ctx };
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
    // The flow's screens, and the variations placed under them (design §5) — the prototype it ends with aside.
    const wires = [...h.items.values()].filter((i) => i.properties.wirePrototype === undefined);
    expect(h.items.size - wires.length).toBe(1);
    const screens = wires.filter((i) => !h.specOf(i.id).variantOf);
    const variants = wires.filter((i) => h.specOf(i.id).variantOf);
    for (const v of variants) {
      const spec = h.specOf(v.id);
      const of = h.items.get(spec.variantOf!)!;
      expect(validateWire(spec)).toEqual([]);
      expect(v.versions.length).toBe(1);
      expect(v.x).toBe(of.x);
      expect(v.y).toBeGreaterThan(of.y + of.height);
      expect(v.title.startsWith(`${of.title} · `)).toBe(true);
      expect(spec.flip).toBeDefined();
    }
    for (const item of screens) {
      const spec = h.specOf(item.id);
      expect(validateWire(spec)).toEqual([]);
      expect(spec.round).toBe(3);
      expect(spec.slots.every((s) => s.block !== null)).toBe(true);
      expect(item.title).toBe(spec.title);
      // blueprint (round 1) → structure (round 2) → props (round 3), in the same item.
      const rounds = item.versions.map((_, i) => h.specOf(item.id, i).round);
      expect(rounds.slice(-3)).toEqual([1, 2, 3]);
      // A screen either has siblings under it or says it has no honest alternative — never both, never neither.
      const mine = variants.filter((v) => h.specOf(v.id).variantOf === item.id).length;
      expect(mine <= 2).toBe(true);
      // A maybe waits for its keep before it is varied.
      if (spec.maybe) expect(mine).toBe(0);
      else expect(spec.varied === "none").toBe(mine === 0);
      // And the item says it is a maybe — set by the composer's own ops, which the canvas marks until it is kept.
      expect(item.properties[MAYBE_PROP]).toBe(spec.maybe ? spec.need!.toFixed(2) : undefined);
      expect(maybeMarked(item)).toBe(spec.maybe === true);
    }
    // In a row, in the archetypes' running order.
    const byX = [...screens].sort((a, b) => a.x - b.x).map((i) => RECIPES.findIndex((r) => r.id === h.specOf(i.id).archetype));
    expect(byX).toEqual([...byX].sort((a, b) => a - b));
    expect(new Set(screens.map((i) => i.y)).size).toBe(1);
    expect(printed).toContain("before any answer");
    expect(printed).toContain("answering with the stub (seed 4) — no TYPESAFE_API_KEY here");
    expect(printed).toMatch(/\d+ screens(?: \(\d+ maybe\))?, one op group — answered by stub \(seed 4\) · round 1 \d+ ms · round 2 \d+ ms · round 3 \d+ ms · \d+ calls · 0 input tokens · \$0\.000000/);
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
      // Signed by the agent that answered its rounds, not by a model.
      expect(spec.by).toEqual({ answerer: "agent" });
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

describe("variations and keep marks from the terminal: wire vary / keep / unkeep / kept", () => {
  // `--basic`: nothing is in a prototype yet, so every mark here is the test's own.
  async function drawn(actor?: { id: string; name: string }) {
    const h = harness(actor);
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    expect(h.errors).toEqual([]);
    const all = [...h.items.values()];
    const screens = all.filter((i) => !h.specOf(i.id).variantOf);
    const variantsOf = (id: string) => [...h.items.values()].filter((i) => h.specOf(i.id).variantOf === id);
    return { h, screens, variantsOf, flow: h.specOf(screens[0]!.id).flow };
  }

  it("adds the next variations under a screen, in a group of their own, and does not repeat a flip a sibling shows", async () => {
    const { h, screens, variantsOf, flow } = await drawn();
    // The stub's flat distributions leave most screens more honest flips than the two a flow makes.
    const screen = screens.find((s) => variantsOf(s.id).length === 2)!;
    const before = variantsOf(screen.id);
    const sentBefore = h.sent.length;
    const printed = await h.cli("wire", "vary", screen.id, "--count", "3");
    expect(h.errors).toEqual([]);
    const after = variantsOf(screen.id);
    expect(after.length).toBe(3);
    const added = after.find((v) => !before.includes(v))!;
    expect(printed).toContain(added.title);
    // Under the screen and under its siblings: same x, below the lowest.
    expect(added.x).toBe(screen.x);
    expect(added.y).toBeGreaterThan(Math.max(...before.map((v) => v.y + v.height)));
    // Its own op group — not the flow's — so undo takes back only this.
    const groups = new Set(h.sent.slice(sentBefore).map((s) => s.group));
    expect(groups.size).toBe(1);
    expect(groups.has(flow)).toBe(false);
    expect(new Set(after.map((v) => JSON.stringify(h.specOf(v.id).flip))).size).toBe(3);
    // The decisions are still the screen's answerer's: the variation says so.
    expect(h.specOf(added.id).by?.answerer).toBe("stub");
    expect(h.specOf(added.id).by).toEqual(h.specOf(screen.id).by);
    // Asking again adds nothing: --count is how many in all.
    expect(await h.cli("wire", "vary", screen.id, "--count", "3")).toMatch(/already has 3 variations/);
    expect(variantsOf(screen.id).length).toBe(3);
  });

  it("refuses to vary a variation, or a screen drawn by hand that carries no distribution", async () => {
    const { h, screens, variantsOf } = await drawn();
    const variant = screens.map((s) => variantsOf(s.id)).find((v) => v.length > 0)![0]!;
    await h.cli("wire", "vary", variant.id);
    expect(h.errors.at(-1)).toMatch(/is a variation of ".*" — vary the screen itself/);
    const dir = mkdtempSync(path.join(tmpdir(), "acme-wire-"));
    const file = path.join(dir, "detail.json");
    writeFileSync(file, await h.cli("wire", "spec", "detail", "--resolved", "--title", "Acme hand-drawn"));
    await h.cli("wire", "render", file);
    const hand = [...h.items.values()].find((i) => i.title === "Acme hand-drawn")!;
    await h.cli("wire", "vary", hand.id);
    expect(h.errors.at(-1)).toMatch(/carries no answerer's distribution/);
  });

  it("keeps screens and a variation, lists them in reading order, and anyone can unkeep", async () => {
    const { h, screens, variantsOf } = await drawn();
    const [first, second] = [screens.sort((x, y) => x.x - y.x)[0]!, screens[1]!];
    const v = variantsOf(first.id)[0]!;
    const sentBefore = h.sent.length;
    // Named out of order on purpose: `kept` answers in reading order, not argument order.
    await h.cli("wire", "keep", v.id, second.id, first.id);
    expect(h.errors).toEqual([]);
    const marks = h.sent.slice(sentBefore);
    expect(marks.map((s) => s.op)).toEqual([v, second, first].map((i) => ({ type: "item.update", itemId: i.id, patch: { properties: { wireKeep: "yes" } } })));
    expect(new Set(marks.map((s) => s.group)).size).toBe(1);
    // Reading order: the row of screens left to right, then the variation under the first.
    const titles = (printed: string) => printed.split("\n").map((line) => line.split(/\s{2}/).slice(1).join("  "));
    expect(titles(await h.cli("wire", "kept"))).toEqual([first.title, second.title, v.title]);
    // Keeping twice writes nothing more.
    const n = h.sent.length;
    expect(await h.cli("wire", "keep", second.id)).toContain("was already in the prototype");
    expect(h.sent.length).toBe(n);
    // Unkeep: the mark is a property on the item, not somebody's reaction — it simply comes off.
    await h.cli("wire", "unkeep", second.id);
    expect(h.sent.at(-1)!.op).toEqual({ type: "item.update", itemId: second.id, patch: { removeProperties: ["wireKeep", "wireKeepBy"] } });
    expect(h.items.get(second.id)!.properties.wireKeep).toBeUndefined();
    expect(titles(await h.cli("wire", "kept"))).toEqual([first.title, v.title]);
  });

  it("says it in the prototype's words, and `wire use|unuse` are the same act as `keep|unkeep`", async () => {
    const { h, screens } = await drawn({ id: "act_acme_agent", name: "Acme agent" });
    const [first, second] = [screens.sort((x, y) => x.x - y.x)[0]!, screens[1]!];
    const used = await h.cli("wire", "use", first.id, second.id);
    expect(h.errors).toEqual([]);
    expect(used).toContain(`📐 "${first.title}" in the prototype`);
    expect(used).toMatch(/^2 screens in the prototype — `isocan wire prototype` rebuilds it$/m);
    expect(used).not.toMatch(/\bkept\b/);
    expect(h.items.get(first.id)!.properties.wireKeep).toBe("yes");
    // An agent's pick is signed as the agent's, never as the answerer's.
    expect(h.items.get(first.id)!.properties.wireKeepBy).toBe("act_acme_agent");
    expect(keptBy(h.items.get(first.id)!)).toEqual({ auto: false, actorId: "act_acme_agent" });
    const n = h.sent.length;
    await h.cli("wire", "keep", first.id);
    expect(h.sent.length).toBe(n);
    const removed = await h.cli("wire", "unuse", second.id);
    expect(removed).toContain(`"${second.title}" removed from the prototype`);
    expect(removed).toMatch(/^1 screen in the prototype/m);
    expect(h.sent.at(-1)!.op).toEqual({ type: "item.update", itemId: second.id, patch: { removeProperties: ["wireKeep", "wireKeepBy"] } });
    expect(h.items.get(second.id)!.properties.wireKeepBy).toBeUndefined();
    expect(await h.cli("wire", "unkeep", second.id)).toContain("was not in the prototype");
  });
});

describe("a composed flow ends with a prototype of the answerer's first choices", () => {
  // Seed 4 draws detail, settings and profile as maybes, so the cut has something to leave out.
  async function composed(...flags: string[]) {
    const h = harness({ id: "act_acme_agent", name: "Acme agent" });
    const printed = await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", ...flags);
    expect(h.errors).toEqual([]);
    const all = [...h.items.values()];
    const prototypes = all.filter((i) => i.properties.wirePrototype !== undefined);
    const wires = all.filter((i) => i.properties.wirePrototype === undefined);
    const screens = wires.filter((i) => !h.specOf(i.id).variantOf);
    const variants = wires.filter((i) => h.specOf(i.id).variantOf);
    return { h, printed, prototypes, screens, variants };
  }

  it("puts each confident row's first choice in it, signed as the answerer's — never a maybe, never a variation", async () => {
    const { h, screens, variants } = await composed();
    const confident = screens.filter((i) => !h.specOf(i.id).maybe && h.specOf(i.id).need! >= NEEDS_YES);
    const maybes = screens.filter((i) => h.specOf(i.id).maybe);
    expect(confident.length).toBeGreaterThan(1);
    expect(maybes.length).toBeGreaterThan(0);
    expect(variants.length).toBeGreaterThan(0);
    for (const item of confident) {
      expect(item.properties.wireKeep).toBe("yes");
      // The stub answered, so the stub picked: the mark says so, and reads apart from a person's.
      expect(item.properties.wireKeepBy).toBe("stub");
      expect(keptBy(item)).toEqual({ auto: true, answerer: "stub" });
    }
    for (const item of [...maybes, ...variants]) {
      expect(item.properties.wireKeep).toBeUndefined();
      expect(item.properties.wireKeepBy).toBeUndefined();
    }
    // A maybe stays marked: nobody has answered its question.
    for (const item of maybes) expect(maybeMarked(item)).toBe(true);
  });

  it("builds the prototype above the flow, playing exactly those screens", async () => {
    const { h, printed, prototypes, screens } = await composed();
    expect(prototypes.length).toBe(1);
    const proto = prototypes[0]!;
    const flow = h.specOf(screens[0]!.id).flow;
    expect(proto.properties.wirePrototype).toBe(flow);
    const played = screens.filter((i) => i.properties.wireKeep);
    // Above the row: its bottom edge over the screens' top, centred over the ones it plays.
    expect(proto.y + proto.height).toBeLessThan(Math.min(...screens.map((i) => i.y)));
    const left = Math.min(...played.map((i) => i.x));
    const right = Math.max(...played.map((i) => i.x + i.width));
    expect(Math.abs(proto.x + proto.width / 2 - (left + right) / 2)).toBeLessThanOrEqual(1);
    const html = h.htmlOf(proto.id);
    for (const item of screens) expect(html.includes(`data-screen="${item.id}"`)).toBe(Boolean(item.properties.wireKeep));
    expect(printed).toContain(`${proto.id}  "${proto.title}" — prototype of ${played.length} screens, the stub's first choices`);
    expect(printed).toMatch(/takes the whole flow back, prototype included/);
    expect(printed).toContain("isocan wire use <variation>");
  });

  it("a second flow leaves its prototype room: it lands over its own row, under the first flow, not above everything", async () => {
    const h = harness();
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    const firstFlow = [...h.items.values()];
    const firstBottom = Math.max(...firstFlow.map((i) => i.y + i.height));
    await h.cli("wire", "a recipe app for Acme cooks", "--answerer", "stub", "--seed", "2");
    expect(h.errors).toEqual([]);
    const added = [...h.items.values()].filter((i) => !firstFlow.includes(i));
    const proto = added.find((i) => i.properties.wirePrototype !== undefined)!;
    const row = added.filter((i) => i.properties.wirePrototype === undefined);
    expect(proto.y).toBeGreaterThan(firstBottom);
    expect(proto.y + proto.height).toBeLessThan(Math.min(...row.map((i) => i.y)));
  });

  it("is one op group with the flow — so one undo takes the screens, the picks and the prototype back together", async () => {
    const { h, prototypes, screens } = await composed();
    const flow = h.specOf(screens[0]!.id).flow;
    expect(new Set(h.sent.map((s) => s.group))).toEqual(new Set([flow]));
    const picks = h.sent.filter((s) => s.op.type === "item.update" && "properties" in s.op.patch && s.op.patch.properties?.wireKeep);
    expect(picks.length).toBe(screens.filter((i) => i.properties.wireKeep).length);
    expect(h.sent.some((s) => s.op.type === "item.add" && s.op.itemId === prototypes[0]!.id)).toBe(true);
  });

  it("says it in --json: the prototype, who picked, and what it plays", async () => {
    const h = harness();
    h.ctx.json = true;
    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4");
    expect(h.errors).toEqual([]);
    const out = JSON.parse(h.logs.at(-1)!) as { prototype: { itemId: string; keptBy: string; screens: Array<{ itemId: string }> } };
    expect(out.prototype.keptBy).toBe("stub");
    expect(h.items.get(out.prototype.itemId)!.properties.wirePrototype).toBeDefined();
    expect(out.prototype.screens.every((s) => h.items.get(s.itemId)!.properties.wireKeep === "yes")).toBe(true);
  });

  it("--basic puts nothing in a prototype and builds none", async () => {
    const { h, printed, prototypes, screens } = await composed("--basic");
    expect(prototypes).toEqual([]);
    for (const item of h.items.values()) {
      expect(item.properties.wireKeep).toBeUndefined();
      expect(item.properties.wireKeepBy).toBeUndefined();
    }
    expect(screens.length).toBeGreaterThan(1);
    expect(printed).not.toMatch(/first choices/);
  });

  it("a keep by hand afterwards is signed as whoever made it, and swapping a pick out takes Jev's signature with it", async () => {
    const { h, screens, variants } = await composed();
    const pick = screens.find((i) => i.properties.wireKeep && variants.some((v) => h.specOf(v.id).variantOf === i.id))!;
    const variation = variants.find((v) => h.specOf(v.id).variantOf === pick.id)!;
    await h.cli("wire", "use", variation.id);
    await h.cli("wire", "unuse", pick.id);
    expect(h.errors).toEqual([]);
    expect(keptBy(h.items.get(variation.id)!)).toEqual({ auto: false, actorId: "act_acme_agent" });
    expect(h.items.get(pick.id)!.properties.wireKeepBy).toBeUndefined();
  });
});
