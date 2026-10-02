import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import type { Operation } from "@isocan/core";
import { copyDeck } from "@isocan/core/copy-deck";
import { TEXT_ROUTE } from "@isocan/core/text";
import { varyCopy } from "../src/lib/varycopy.ts";
import { itemMenu } from "../src/lib/menuentries.tsx";
import { ACTIONS } from "../src/lib/actions.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";
import { cliEnv, runCli, type Run } from "../../cli/test/cli.ts";

/**
 * **"Vary the copy…" and `isocan words vary` land the same variants**
 * (copy-edit phase 2). The web path's doors are swapped for recorders — the
 * text route, the blob read, the host's upload and send — and held against
 * what the CLI binary wrote to a real daemon for the same screen: the same
 * titles, properties, sizes and placements, and the same blob hashes, which
 * is the same bytes. When the home has no text model the voices are
 * placeholders and the notice bar says so; a model's answer that breaks the
 * rules is refused and nothing is sent.
 *
 * Synthetic: Acme's checkout screen.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-varycopy-"));
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

const CHECKOUT = `<!doctype html>
<html><head><title>Acme checkout</title></head>
<body><h1 class="title">Review your order</h1><button class="pay">Pay now</button></body></html>`;

const labels = (entries: MenuEntry[]) => entries.filter((e): e is MenuAction => !("separator" in e)).map((a) => a.label);

/** An op as both surfaces must agree on it: everything but the minted ids. */
const shape = (op: Operation) => {
  const add = op as Extract<Operation, { type: "item.add" }>;
  const at = add.placement as { x: number; y: number };
  return { title: add.title, properties: add.properties, width: add.width, height: add.height, x: at.x, y: at.y, blobHash: add.version.blobHash, filename: add.version.filename };
};

async function setUp(name: string) {
  const canvas = JSON.parse(await ok("--json", "canvas", "create", name)).canvasId as string;
  const file = path.join(home, `${name}.html`);
  await fs.writeFile(file, CHECKOUT);
  const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
  useCanvasStore.setState({ canvasId: canvas, canvas: (await client.snapshot(canvas)).canvas, notice: null });
  const sent: Array<{ ops: Operation[]; group?: string }> = [];
  const deps = {
    readText: async (hash: string) => (await client.downloadBlob(canvas, hash)).toString("utf8"),
    host: {
      putBlob: async (blob: Blob, filename: string) => client.uploadBlob(canvas, Buffer.from(await blob.arrayBuffer()), "text/html", filename),
      send: async (ops: readonly Operation[], group?: string) => void sent.push({ ops: [...ops], ...(group ? { group } : {}) }),
    },
  };
  return { canvas, source, sent, deps };
}

describe("Vary the copy… — the web's door to words vary", () => {
  it("is offered on an HTML screen, in the menu and ⌘K", async () => {
    const { canvas, source } = await setUp("Acme offered");
    const ctx = { canvasId: canvas, actor: acme, world: { x: 0, y: 0 }, navigate: () => {} };
    expect(labels(itemMenu([useCanvasStore.getState().canvas!.items[source]!], ctx))).toContain("Vary the copy…");
    const action = ACTIONS.find((a) => a.id === "vary-copy")!;
    expect(action.available!({ canvasId: canvas, actor: acme, navigate: (() => {}) as never, selection: [source] })).toBe(true);
    expect(action.available!({ canvasId: canvas, actor: acme, navigate: (() => {}) as never, selection: [] })).toBe(false);
  });

  it("without a text model at the home, lands the CLI's placeholder variants byte for byte and says so once", async () => {
    const { canvas, source, sent, deps } = await setUp("Acme placeholders");
    let asked = 0;
    const generate = async () => {
      asked++;
      throw Object.assign(new Error("this home has no text model"), { code: "text-unavailable" });
    };
    const done = await varyCopy(canvas, acme, source, { n: 3, brief: "shorter" }, { ...deps, generate });
    expect(asked).toBe(1);
    expect(done).toMatchObject({ by: "placeholder words", placeholder: true, stances: ["Placeholder A", "Placeholder B", "Placeholder C"] });
    expect(useCanvasStore.getState().notice).toContain("placeholder words, not written copy");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.group).toMatch(/^grp_/);
    const web = sent[0]!.ops;
    expect(web.map((op) => op.type)).toEqual(["item.add", "item.add", "item.add"]);

    // The CLI on the same screen: the same three, the same bytes.
    const cli = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--n", "3"));
    // Compared as items, not as logged ops: on a grouped canvas an add is logged as a group change.
    const items = (await client.snapshot(canvas)).canvas.items;
    const landed = cli.variants.map(({ itemId }: { itemId: string }) => {
      const item = items[itemId]!;
      const version = item.versions.find((v) => v.id === item.currentVersionId)!;
      return { title: item.title, properties: item.properties, width: item.width, height: item.height, x: item.x, y: item.y, blobHash: version.blobHash, filename: version.filename };
    });
    expect(web.map(shape)).toEqual(landed);
    const first = (await client.downloadBlob(canvas, (web[0] as Extract<Operation, { type: "item.add" }>).version.blobHash)).toString("utf8");
    expect(first).toBe(CHECKOUT.replace(">Review your order<", ">Placeholder heading A<").replace(">Pay now<", ">Placeholder button A<"));
  });

  it("asks the home's text route by default — TEXT_ROUTE, through the dialog host's own door", async () => {
    const { canvas, source, sent, deps } = await setUp("Acme route");
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ error: "this home has no text model", code: "text-unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const done = await varyCopy(canvas, acme, source, { n: 2 }, deps);
      expect(done.placeholder).toBe(true);
    } finally {
      globalThis.fetch = real;
    }
    expect(urls).toEqual([TEXT_ROUTE]);
    expect(sent[0]!.ops).toHaveLength(2);
  });

  it("takes the home model's voices, and refuses an answer that breaks the rules without sending anything", async () => {
    const { canvas, source, sent, deps } = await setUp("Acme model");
    const deck = copyDeck(CHECKOUT);
    const at = (text: string) => deck.strings.find((s) => s.text === text)!.address;
    const voices = (second: string) => ({
      model: "acme-text-1",
      value: { variants: [
        { stance: "Plain", why: "Says it.", edits: [{ address: at("Pay now"), to: "Pay" }] },
        { stance: second, why: "Warmer.", edits: [{ address: at("Review your order"), to: "Nearly there" }] },
      ] },
    });
    const prompts: string[] = [];
    const done = await varyCopy(canvas, acme, source, { n: 2, brief: "for a first-time buyer" }, { ...deps, generate: async (body) => (prompts.push((body as { prompt: string }).prompt), voices("Warm")) });
    expect(prompts[0]).toContain("for a first-time buyer");
    expect(done).toMatchObject({ by: "acme-text-1 via the home", placeholder: false, stances: ["Plain", "Warm"] });
    expect(sent[0]!.ops.map((op) => (op as { title?: string }).title)).toEqual(["Acme checkout — Plain", "Acme checkout — Warm"]);

    await expect(varyCopy(canvas, acme, source, { n: 2 }, { ...deps, generate: async () => voices("plain") })).rejects.toThrow(/refused: .*is variant 1's too/);
    expect(sent).toHaveLength(1);
  });
});
