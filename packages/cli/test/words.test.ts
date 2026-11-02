import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan words` against a real daemon** (copy-edit phase 1, the copy deck).
 *
 * The deck read as JSON, edited by adding a `to`, applied as ONE version
 * that changes only those words' bytes; the same deck refused once the
 * screen has moved; undo taking the version back. A wireframe's half —
 * its words go through the module's writer into its spec — is
 * `packages/modules/wireframe/test/words-cli.test.ts`, because only that
 * directory may name the module.
 *
 * Synthetic: Acme's checkout screen.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-words-"));
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
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(...args);
  expect(run.code, run.stderr).toBe(0);
  return run.stdout;
}

const CHECKOUT = `<!doctype html>
<html><head><title>Acme checkout</title><style>.pay{font-weight:600}</style></head>
<body>
  <h1 class="title">Review your order</h1>
  <label>Card number <input placeholder="1234 5678"></label>
  <button class="pay" type="submit">Pay now</button>
</body></html>`;

interface Deck { itemId: string; versionId: string; kind: string; strings: Array<{ address: string; role: string; text: string; to?: string }> }

async function current(canvas: string, itemId: string): Promise<{ versions: number; text: string }> {
  const snap = await client.snapshot(canvas);
  const item = snap.canvas.items[itemId]!;
  const v = item.versions.find((x) => x.id === item.currentVersionId)!;
  return { versions: item.versions.length, text: (await client.downloadBlob(canvas, v.blobHash)).toString("utf8") };
}

describe("isocan words", () => {
  it("reads the deck, applies edited strings as one version of words only, refuses a stale deck, and undo restores", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme words")).canvasId;
    const file = path.join(home, "checkout.html");
    await fs.writeFile(file, CHECKOUT);
    const itemId = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId;

    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", itemId)) as Deck;
    expect(deck.kind).toBe("html");
    expect(deck.strings.map((s) => [s.role, s.text])).toEqual([
      ["heading", "Review your order"],
      ["label", "Card number"],
      ["placeholder", "1234 5678"],
      ["button", "Pay now"],
    ]);
    const human = await ok("--canvas", canvas, "words", itemId);
    expect(human).toContain("Pay now");
    expect(human).toContain("4 strings");

    const edited = { ...deck, strings: deck.strings.map((s) => (s.text === "Pay now" ? { ...s, to: "Place order" } : s.role === "placeholder" ? { ...s, to: "Card & number" } : s)) };
    const deckFile = path.join(home, "deck.json");
    await fs.writeFile(deckFile, JSON.stringify(edited));
    const receipt = JSON.parse(await ok("--canvas", canvas, "--json", "words", itemId, "--apply", deckFile, "--by", "agent-acme"));
    expect(receipt.changed).toHaveLength(2);
    const after = await current(canvas, itemId);
    expect(after.versions).toBe(2);
    expect(after.text).toBe(CHECKOUT.replace(">Pay now<", ">Place order<").replace('placeholder="1234 5678"', 'placeholder="Card &amp; number"'));

    // The same deck again: the strings it read are not what the screen says now.
    const stale = await isocan("--canvas", canvas, "words", itemId, "--apply", deckFile);
    expect(stale.code).not.toBe(0);
    expect(stale.stderr).toMatch(/read "1234 5678" but now says "Card & number"/);
    expect((await current(canvas, itemId)).versions).toBe(2);

    await ok("--canvas", canvas, "undo");
    expect((await current(canvas, itemId)).text).toBe(CHECKOUT);
  });
});
