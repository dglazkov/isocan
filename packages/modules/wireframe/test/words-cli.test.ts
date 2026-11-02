import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { ensureFleshedForCopy, readWire, renderWire, wireframe } from "../src/core.ts";
import { cliEnv, runCli, type Run } from "../../../cli/test/cli.ts";

/**
 * **`isocan words` on a wireframe, against a real daemon** (copy-edit
 * phase 1). A wire screen's words are its spec's, so the deck's addresses
 * are `wire copy`'s word paths and `--apply` goes through this module's
 * writer — the one `wire copy --apply` uses — landing in the spec as
 * `source: "copy"` by `--by`, one version, refused when stale, undone whole.
 * The plain-HTML half is `packages/cli/test/words.test.ts`.
 *
 * Synthetic: Acme's orders list.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-wire-words-"));
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

interface Deck { kind: string; strings: Array<{ address: string; role: string; text: string; to?: string }> }

async function current(canvas: string, itemId: string): Promise<{ versions: number; text: string }> {
  const snap = await client.snapshot(canvas);
  const item = snap.canvas.items[itemId]!;
  const v = item.versions.find((x) => x.id === item.currentVersionId)!;
  return { versions: item.versions.length, text: (await client.downloadBlob(canvas, v.blobHash)).toString("utf8") };
}

describe("isocan words on a wireframe", () => {
  it("writes a wireframe's words through its spec, as wire copy does", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme wire words")).canvasId;
    const file = path.join(home, "orders.html");
    await fs.writeFile(file, renderWire(ensureFleshedForCopy(wireframe("list", { title: "Orders" }))));
    const itemId = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme orders", "--prop", "fidelity=wireframe")).itemId;

    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", itemId)) as Deck;
    expect(deck.kind).toBe("wire");
    const row = deck.strings.find((s) => s.address === "main.3/items.0.title")!;
    const edited = { ...deck, strings: deck.strings.map((s) => (s.address === "title" ? { ...s, to: "Acme orders" } : s === row ? { ...s, to: "Spring catalogue" } : s)) };
    const deckFile = path.join(home, "wire-deck.json");
    await fs.writeFile(deckFile, JSON.stringify(edited));
    expect(await ok("--canvas", canvas, "words", itemId, "--apply", deckFile, "--by", "agent-acme")).toMatch(/2 strings reworded .* exact copy by agent-acme, one version/);

    const after = await current(canvas, itemId);
    expect(after.versions).toBe(2);
    const spec = readWire(after.text)!;
    expect(spec.content).toMatchObject({ source: "copy", by: "agent-acme", title: "Acme orders" });
    expect(spec.slots.find((s) => s.slot === "main.3")!.fill!.items![0]!.title).toBe("Spring catalogue");

    const stale = await isocan("--canvas", canvas, "words", itemId, "--apply", deckFile);
    expect(stale.code).not.toBe(0);
    expect(stale.stderr).toMatch(/title \(heading\) read "Items" but now says "Acme orders"/);

    await ok("--canvas", canvas, "undo");
    expect((await current(canvas, itemId)).versions).toBe(1);
  });
});
