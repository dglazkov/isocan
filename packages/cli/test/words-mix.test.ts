import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan words mix` against a real daemon** (copy-edit phase 3, journey
 * scenes 2 and 6).
 *
 * An agent varies a screen into three voices with `words vary --from`, then
 * mixes: the heading from one voice, the button from another. The source gets
 * ONE new version with exactly those words — markup byte for byte — and every
 * voice goes to the trash, in one op group, so one `undo` restores the
 * source's words and brings all three back. A pick that cannot be honoured
 * (no picks, a voice that kept that string, an address the screen does not
 * have) lands nothing. The web's *Use this mix* is held to this in
 * `packages/web/test/copymix.test.ts`.
 *
 * Synthetic: Acme's checkout screen.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-words-mix-"));
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
<html><head><title>Acme checkout</title><style>.pay{font-weight:600}</style></head>
<body>
  <h1 class="title">Review your order</h1>
  <p class="lede">Two items, shipped by Acme.</p>
  <button class="pay" type="submit">Pay now</button>
</body></html>`;

interface Deck { strings: Array<{ address: string; role: string; text: string }> }

async function textOf(canvas: string, itemId: string): Promise<string> {
  const snap = await client.snapshot(canvas);
  const item = snap.canvas.items[itemId]!;
  const v = item.versions.find((x) => x.id === item.currentVersionId)!;
  return (await client.downloadBlob(canvas, v.blobHash)).toString("utf8");
}

describe("isocan words mix", () => {
  it("folds the heading from one voice and the button from another into the source as one version, the voices trashed, one undo", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme mix")).canvasId;
    const file = path.join(home, "checkout.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", source)) as Deck;
    const at = (text: string) => deck.strings.find((s) => s.text === text)!.address;
    const voices = {
      variants: [
        { stance: "Plain and direct", why: "Says what happens.", edits: [{ address: at("Review your order"), to: "Check your order" }, { address: at("Pay now"), to: "Pay" }] },
        { stance: "Benefit-first", why: "Leads with the parcel.", edits: [{ address: at("Review your order"), to: "Your parcel, nearly yours" }, { address: at("Two items, shipped by Acme."), to: "Two things you'll love, from Acme." }] },
        { stance: "Warm", why: "A person helping.", edits: [{ address: at("Pay now"), to: "Let's finish up" }] },
      ],
    };
    const voicesFile = path.join(home, "voices.json");
    await fs.writeFile(voicesFile, JSON.stringify(voices));
    const made = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--from", voicesFile));
    const [plain, benefit, warm] = made.variants.map((v: { itemId: string }) => v.itemId) as [string, string, string];
    const before = await client.snapshot(canvas);
    expect(before.canvas.items[source]!.versions).toHaveLength(1);

    // Refused, and nothing lands: no picks; a voice that kept the string; an address the screen does not have.
    const none = await isocan("--canvas", canvas, "words", "mix", source);
    expect(none.code).not.toBe(0);
    expect(none.stderr).toContain("which words?");
    const kept = await isocan("--canvas", canvas, "words", "mix", source, "--pick", `${at("Pay now")}=${benefit}`);
    expect(kept.code).not.toBe(0);
    expect(kept.stderr).toContain('"Benefit-first" kept');
    const nowhere = await isocan("--canvas", canvas, "words", "mix", source, "--pick", `t999=${plain}`);
    expect(nowhere.code).not.toBe(0);
    expect(nowhere.stderr).toContain("no string at t999");
    const still = await client.snapshot(canvas);
    expect(still.canvas.items[source]!.versions).toHaveLength(1);
    for (const id of [plain, benefit, warm]) expect(still.canvas.items[id]).toBeDefined();

    // The heading from Benefit-first (by its stance), the button from Warm (by its id).
    const mixed = JSON.parse(await ok("--canvas", canvas, "--json", "words", "mix", source, "--pick", `${at("Review your order")}=Benefit-first,${at("Pay now")}=${warm}`));
    expect(mixed).toMatchObject({ itemId: source, kind: "html", trashed: [plain, benefit, warm] });
    expect(mixed.picked).toEqual([
      { address: at("Review your order"), from: benefit, to: "Your parcel, nearly yours" },
      { address: at("Pay now"), from: warm, to: "Let's finish up" },
    ]);
    // Exactly those words, every other byte the source's — Benefit-first's lede stays the source's.
    expect(await textOf(canvas, source)).toBe(CHECKOUT.replace(">Review your order<", ">Your parcel, nearly yours<").replace(">Pay now<", ">Let's finish up<"));
    const after = await client.snapshot(canvas);
    expect(after.canvas.items[source]!.versions).toHaveLength(2);
    for (const id of [plain, benefit, warm]) expect(after.canvas.items[id]).toBeUndefined();

    // One undo: the source's words, and all three voices back.
    await ok("--canvas", canvas, "undo");
    expect(await textOf(canvas, source)).toBe(CHECKOUT);
    const undone = await client.snapshot(canvas);
    for (const id of [plain, benefit, warm]) expect(undone.canvas.items[id]).toBeDefined();

    // A whole voice is every string from it (`*=`), from a picks file — the same as choosing it, in words.
    const picksFile = path.join(home, "picks.json");
    await fs.writeFile(picksFile, JSON.stringify({ picks: { "*": plain } }));
    await ok("--canvas", canvas, "words", "mix", source, "--from", picksFile);
    expect(await textOf(canvas, source)).toBe(CHECKOUT.replace(">Review your order<", ">Check your order<").replace(">Pay now<", ">Pay<"));
  });
});
