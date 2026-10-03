import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { ensureFleshedForCopy, readWire, renderWire, wireframe } from "../src/core.ts";
import { wiresOn } from "../src/flow.ts";
import { cliEnv, runCli, type Run } from "../../../cli/test/cli.ts";

/**
 * **`isocan words vary` on a wireframe, against a real daemon** (copy-edit
 * phase 2). A wire screen's voices are its spec with other words, rendered by
 * this module (`copy-variant.ts`): each lands as a `parent=` child that wears
 * `fidelity: wireframe` and says `variantOf` in its spec, so `wire keep` takes
 * it like any variation and the flow does not count it as a second screen.
 * `choose` folds one home; the source then reads as a screen, not as a
 * variation of itself. The plain-HTML half is `packages/cli/test/words-vary.test.ts`.
 *
 * Synthetic: Acme's orders list.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-wire-vary-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  client = new DaemonClient(`http://127.0.0.1:${port}`, home);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ISOCAN_TEXT_API_KEY: "" }) });
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(...args);
  expect(run.code, run.stderr).toBe(0);
  return run.stdout;
}

async function textOf(canvas: string, itemId: string): Promise<string> {
  const snap = await client.snapshot(canvas);
  const item = snap.canvas.items[itemId]!;
  const v = item.versions.find((x) => x.id === item.currentVersionId)!;
  return (await client.downloadBlob(canvas, v.blobHash)).toString("utf8");
}

describe("isocan words vary on a wireframe", () => {
  it("renders each voice through the spec as a variation wire keep takes, and choose folds one home as a screen", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme wire voices")).canvasId;
    const file = path.join(home, "orders.html");
    const original = ensureFleshedForCopy(wireframe("list", { title: "Orders" }));
    await fs.writeFile(file, renderWire(original));
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme orders", "--prop", "fidelity=wireframe")).itemId as string;

    const voices = {
      variants: [
        { stance: "Plain", why: "Names the list.", edits: [{ address: "title", to: "Your orders" }, { address: "main.3/items.0.title", to: "Spring catalogue" }] },
        { stance: "Warm", why: "Talks to the buyer.", edits: [{ address: "title", to: "Everything you ordered" }] },
      ],
    };
    const voicesFile = path.join(home, "wire-voices.json");
    await fs.writeFile(voicesFile, JSON.stringify(voices));
    const made = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--from", voicesFile, "--by", "agent-acme"));
    expect(made).toMatchObject({ source, kind: "wire", by: "agent-acme" });
    const ids = made.variants.map((v: { itemId: string }) => v.itemId) as string[];
    expect(made.variants.map((v: { title: string }) => v.title)).toEqual(["Acme orders — Plain", "Acme orders — Warm"]);

    const snap = await client.snapshot(canvas);
    expect(snap.canvas.items[ids[0]!]!.properties).toMatchObject({ fidelity: "wireframe", parent: source, copyStance: "Plain", copyWhy: "Names the list." });
    const plain = readWire(await textOf(canvas, ids[0]!))!;
    expect(plain.variantOf).toBe(source);
    expect(plain.content).toMatchObject({ source: "copy", by: "agent-acme", title: "Your orders" });
    expect(plain.slots.find((s) => s.slot === "main.3")!.fill!.items![0]!.title).toBe("Spring catalogue");
    // Words only: the spec is the original's with its words — every slot's block and props as they were.
    expect(plain.slots.map((s) => [s.slot, s.block, JSON.stringify(s.props ?? null)])).toEqual(original.slots.map((s) => [s.slot, s.block, JSON.stringify(s.props ?? null)]));
    expect(readWire(await textOf(canvas, source))!.content?.title).not.toBe("Your orders");

    // The variation is a wire like any other: it can go in the prototype.
    expect(await ok("--canvas", canvas, "wire", "keep", ids[1]!)).toContain("in the prototype");

    await ok("--canvas", canvas, "choose", ids[0]!);
    const chosen = await client.snapshot(canvas);
    for (const id of ids) expect(chosen.canvas.items[id]).toBeUndefined();
    expect(readWire(await textOf(canvas, source))!.content?.title).toBe("Your orders");
    // The folded file says variantOf the source itself; the flow reads it as the screen it is.
    const screens = await wiresOn({ readText: async (hash) => (await client.downloadBlob(canvas, hash)).toString("utf8") }, chosen.canvas);
    expect(screens.map((s) => [s.item, s.spec.variantOf])).toEqual([[source, undefined]]);

    await ok("--canvas", canvas, "undo");
    expect(readWire(await textOf(canvas, source))!.content?.title).not.toBe("Your orders");
  });

  it("mixes voices per word path into the source through the spec (copy-edit phase 3) — one version, the voices trashed, one undo", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme wire mix")).canvasId;
    const file = path.join(home, "orders-mix.html");
    const original = ensureFleshedForCopy(wireframe("list", { title: "Orders" }));
    await fs.writeFile(file, renderWire(original));
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme orders", "--prop", "fidelity=wireframe")).itemId as string;
    const voicesFile = path.join(home, "wire-mix-voices.json");
    await fs.writeFile(voicesFile, JSON.stringify({
      variants: [
        { stance: "Plain", why: "Names the list.", edits: [{ address: "title", to: "Your orders" }, { address: "main.3/items.0.title", to: "Spring catalogue" }] },
        { stance: "Warm", why: "Talks to the buyer.", edits: [{ address: "title", to: "Everything you ordered" }, { address: "main.3/items.0.title", to: "Your spring picks" }] },
      ],
    }));
    const [plain, warm] = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--from", voicesFile)).variants.map((v: { itemId: string }) => v.itemId) as [string, string];

    const mixed = JSON.parse(await ok("--canvas", canvas, "--json", "words", "mix", source, "--pick", "title=Warm,main.3/items.0.title=Plain"));
    expect(mixed).toMatchObject({ itemId: source, kind: "wire", trashed: [plain, warm] });
    const spec = readWire(await textOf(canvas, source))!;
    expect(spec.content?.title).toBe("Everything you ordered");
    expect(spec.slots.find((s) => s.slot === "main.3")!.fill!.items![0]!.title).toBe("Spring catalogue");
    // Words only: every slot's block and props as they were.
    expect(spec.slots.map((s) => [s.slot, s.block, JSON.stringify(s.props ?? null)])).toEqual(original.slots.map((s) => [s.slot, s.block, JSON.stringify(s.props ?? null)]));
    const after = await client.snapshot(canvas);
    expect(after.canvas.items[source]!.versions).toHaveLength(2);
    for (const id of [plain, warm]) expect(after.canvas.items[id]).toBeUndefined();
    // The mixed file folds home as a screen, not a variation of itself — as `choose` leaves it.
    const screens = await wiresOn({ readText: async (hash) => (await client.downloadBlob(canvas, hash)).toString("utf8") }, after.canvas);
    expect(screens.map((s) => [s.item, s.spec.variantOf])).toEqual([[source, undefined]]);

    await ok("--canvas", canvas, "undo");
    expect(readWire(await textOf(canvas, source))!.content?.title).toBe(original.content?.title);
    const undone = await client.snapshot(canvas);
    for (const id of [plain, warm]) expect(undone.canvas.items[id]).toBeDefined();
  });
});
