import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import type { Operation } from "@isocan/core";
import { copySourceOf, mixCopy, readCopyMix } from "../src/lib/copymix.ts";
import { itemMenu } from "../src/lib/menuentries.tsx";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";
import { cliEnv, runCli, type Run } from "../../cli/test/cli.ts";

/**
 * **"Use this mix" and `isocan words mix` fold the same version** (copy-edit
 * phase 3). Voices are landed by the CLI binary on a real daemon; the web's
 * mix runs with its upload real and its send recorded, and is held to what
 * `words mix` then sends for the same picks: one `item.addVersion` of the
 * source with the same blob hash — the same bytes — then every voice to the
 * trash, under one group. *Compare the copy…* is offered on the screen and on
 * a voice once it has voices, and greyed before. The browser walk is
 * `copy-mix` in `scripts/journeys.mjs`; the undo is the daemon's, proved in
 * `packages/cli/test/words-mix.test.ts`.
 *
 * Synthetic: Acme's checkout screen.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-copymix-"));
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
<body><h1 class="title">Review your order</h1><p>Two items from Acme.</p><button class="pay">Pay now</button></body></html>`;

const actions = (entries: MenuEntry[]) => entries.filter((e): e is MenuAction => !("separator" in e));

describe("Compare the copy… — the web's door to words mix", () => {
  it("is offered once a screen has voices, on it and on each voice; the web's mix is the CLI's, byte for byte, in one group", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme web mix")).canvasId as string;
    const file = path.join(home, "checkout.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
    const ctx = { canvasId: canvas, actor: acme, world: { x: 0, y: 0 }, navigate: () => {} };
    const row = (id: string) => actions(itemMenu([useCanvasStore.getState().canvas!.items[id]!], ctx)).find((a) => a.label === "Compare the copy…");

    // Before any voice: offered, greyed.
    useCanvasStore.setState({ canvasId: canvas, canvas: (await client.snapshot(canvas)).canvas, notice: null });
    expect(row(source)?.disabled).toBe(true);

    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", source)) as { strings: Array<{ address: string; text: string }> };
    const at = (text: string) => deck.strings.find((s) => s.text === text)!.address;
    const voicesFile = path.join(home, "voices.json");
    await fs.writeFile(voicesFile, JSON.stringify({
      variants: [
        { stance: "Plain", why: "Says it.", edits: [{ address: at("Review your order"), to: "Check your order" }, { address: at("Pay now"), to: "Pay" }] },
        { stance: "Warm", why: "Helps.", edits: [{ address: at("Review your order"), to: "Nearly there" }] },
      ],
    }));
    const [plain, warm] = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--from", voicesFile)).variants.map((v: { itemId: string }) => v.itemId) as [string, string];
    useCanvasStore.setState({ canvas: (await client.snapshot(canvas)).canvas });
    expect(row(source)?.disabled).toBe(false);
    expect(row(warm)?.disabled).toBe(false);
    expect(copySourceOf(useCanvasStore.getState().canvas!, warm)).toBe(source);
    expect(copySourceOf(useCanvasStore.getState().canvas!, source)).toBe(source);

    const readText = async (hash: string) => (await client.downloadBlob(canvas, hash)).toString("utf8");
    const read = await readCopyMix(canvas, source, readText);
    expect(read.variants.map((v) => v.stance)).toEqual(["Plain", "Warm"]);
    expect(read.rows.map((r) => r.source)).toEqual(["Review your order", "Pay now"]);

    // The web: heading from Warm, button from Plain — recorded, not sent.
    const sent: Array<{ ops: Operation[]; group?: string }> = [];
    const host = {
      putBlob: async (blob: Blob, filename: string) => client.uploadBlob(canvas, Buffer.from(await blob.arrayBuffer()), "text/html", filename),
      send: async (ops: readonly Operation[], group?: string) => void sent.push({ ops: [...ops], ...(group ? { group } : {}) }),
    };
    const picks = { [at("Review your order")]: warm, [at("Pay now")]: plain };
    const done = await mixCopy(canvas, acme, source, picks, { readText, host });
    expect(done).toMatchObject({ changed: [at("Review your order"), at("Pay now")], trashed: [plain, warm] });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.group).toMatch(/^grp_/);
    const web = sent[0]!.ops;
    expect(web.map((op) => op.type)).toEqual(["item.addVersion", "item.update", "item.delete", "item.delete"]);
    const webPref = (web[1] as Extract<Operation, { type: "item.update" }>).patch.properties?.copyPreference;
    expect(JSON.parse(webPref!)).toEqual({ how: "mix", stance: "Plain + Warm", against: ["Plain", "Warm"] });
    expect(web.slice(2).map((op) => (op as { itemId: string }).itemId)).toEqual([plain, warm]);
    const webVersion = (web[0] as Extract<Operation, { type: "item.addVersion" }>).version;
    expect(await readText(webVersion.blobHash)).toBe(CHECKOUT.replace(">Review your order<", ">Nearly there<").replace(">Pay now<", ">Pay<"));

    // The CLI, same picks: the same bytes and copy preference on the source, the same two trashed.
    const cli = JSON.parse(await ok("--canvas", canvas, "--json", "words", "mix", source, "--pick", `${at("Review your order")}=${warm},${at("Pay now")}=${plain}`));
    expect(cli.trashed).toEqual([plain, warm]);
    const after = (await client.snapshot(canvas)).canvas.items[source]!;
    expect(after.versions.find((v) => v.id === cli.versionId)!.blobHash).toBe(webVersion.blobHash);
    expect(after.properties.copyPreference).toBe(webPref);
  });

  it("refuses a mix that is the source's own words, and sends nothing", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme web empty mix")).canvasId as string;
    const file = path.join(home, "checkout2.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
    await ok("--canvas", canvas, "words", "vary", source, "--n", "2");
    useCanvasStore.setState({ canvasId: canvas, canvas: (await client.snapshot(canvas)).canvas, notice: null });
    const sent: unknown[] = [];
    const host = { putBlob: async () => ({ blobHash: "x", size: 1 }), send: async (ops: readonly Operation[]) => void sent.push(ops) };
    const readText = async (hash: string) => (await client.downloadBlob(canvas, hash)).toString("utf8");
    await expect(mixCopy(canvas, acme, source, {}, { readText, host })).rejects.toThrow("the mix is the source's own words");
    expect(sent).toEqual([]);
  });
});
