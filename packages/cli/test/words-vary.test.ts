import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, runCliWithInput, type Run } from "./cli.ts";

/**
 * **`isocan words vary` against a real daemon** (copy-edit phase 2, journey
 * scenes 1 and 6).
 *
 * An agent reads the deck, writes three voices, and `--from` lands them as
 * three `/variation` children of the screen — `parent=`, the stance in the
 * title, stance and why as properties, and files that are the source with
 * only those words changed. A voice that names a string the screen does not
 * have, or the wrong count, lands nothing. `choose` folds one home and one
 * undo takes the decision back; one more takes the three variants back.
 * Without a text model on this machine the voices are placeholders, said as
 * such. The wireframe half is
 * `packages/modules/wireframe/test/words-vary-cli.test.ts`.
 *
 * Synthetic: Acme's checkout screen.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-words-vary-"));
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
  // No text model here, whatever the machine running the suite has.
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
  <label>Card number <input placeholder="1234 5678"></label>
  <button class="pay" type="submit">Pay now</button>
</body></html>`;

interface Deck { strings: Array<{ address: string; role: string; text: string }> }

async function textOf(canvas: string, itemId: string): Promise<string> {
  const snap = await client.snapshot(canvas);
  const item = snap.canvas.items[itemId]!;
  const v = item.versions.find((x) => x.id === item.currentVersionId)!;
  return (await client.downloadBlob(canvas, v.blobHash)).toString("utf8");
}

describe("isocan words vary", () => {
  it("lands an agent's voices as parent= variations, words only; choose folds one home, and undo takes each act back", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme voices")).canvasId;
    const file = path.join(home, "checkout.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;

    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", source)) as Deck;
    const at = (text: string) => deck.strings.find((s) => s.text === text)!.address;
    const voices = {
      variants: [
        { stance: "Plain and direct", why: "Says what happens.", edits: [{ address: at("Review your order"), to: "Check your order" }, { address: at("Pay now"), to: "Pay" }] },
        { stance: "Warm", why: "A person helping.", edits: [{ address: at("Review your order"), to: "Nearly there" }] },
        { stance: "Benefit-first", why: "Leads with the parcel.", edits: [{ address: at("Pay now"), to: "Get my order" }, { address: at("1234 5678"), to: "Card & number" }] },
      ],
    };
    const voicesFile = path.join(home, "voices.json");
    await fs.writeFile(voicesFile, JSON.stringify(voices));

    // Refused, and nothing lands: the wrong count, and a string the screen does not have.
    const count = await isocan("--canvas", canvas, "words", "vary", source, "--from", voicesFile, "--n", "2");
    expect(count.code).not.toBe(0);
    expect(count.stderr).toContain("asked for 2 variants and got 3");
    const badFile = path.join(home, "bad.json");
    await fs.writeFile(badFile, JSON.stringify({ variants: [{ ...voices.variants[0], edits: [{ address: "t999", to: "Hi" }] }] }));
    const bad = await isocan("--canvas", canvas, "words", "vary", source, "--from", badFile);
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("edits t999, which this screen does not have");
    expect(Object.keys((await client.snapshot(canvas)).canvas.items)).toEqual([source]);

    const made = JSON.parse(await ok("--canvas", canvas, "--json", "words", "vary", source, "--from", voicesFile, "--by", "agent-acme"));
    expect(made).toMatchObject({ source, kind: "html", by: "agent-acme", placeholder: false });
    expect(made.variants.map((v: { title: string }) => v.title)).toEqual(["Acme checkout — Plain and direct", "Acme checkout — Warm", "Acme checkout — Benefit-first"]);

    const snap = await client.snapshot(canvas);
    const ids = made.variants.map((v: { itemId: string }) => v.itemId) as string[];
    for (const [i, id] of ids.entries()) {
      expect(snap.canvas.items[id]!.properties).toMatchObject({ parent: source, copyStance: voices.variants[i]!.stance, copyWhy: voices.variants[i]!.why });
    }
    // Words only: each file is the source with only those strings' bytes changed.
    expect(await textOf(canvas, ids[0]!)).toBe(CHECKOUT.replace(">Review your order<", ">Check your order<").replace(">Pay now<", ">Pay<"));
    expect(await textOf(canvas, ids[1]!)).toBe(CHECKOUT.replace(">Review your order<", ">Nearly there<"));
    expect(await textOf(canvas, ids[2]!)).toBe(CHECKOUT.replace(">Pay now<", ">Get my order<").replace('placeholder="1234 5678"', 'placeholder="Card &amp; number"'));
    expect(await textOf(canvas, source)).toBe(CHECKOUT);

    // This one won: the source's words become Warm's, and the three go to the trash.
    await ok("--canvas", canvas, "choose", ids[1]!);
    const chosen = await client.snapshot(canvas);
    expect(await textOf(canvas, source)).toBe(CHECKOUT.replace(">Review your order<", ">Nearly there<"));
    expect(chosen.canvas.items[source]!.versions).toHaveLength(2);
    for (const id of ids) expect(chosen.canvas.items[id]).toBeUndefined();

    // One undo takes the decision back — the source's words and all three variants.
    await ok("--canvas", canvas, "undo");
    expect(await textOf(canvas, source)).toBe(CHECKOUT);
    const undone = await client.snapshot(canvas);
    for (const id of ids) expect(undone.canvas.items[id]).toBeDefined();
    // And one more takes the three variants back: they landed as one act.
    await ok("--canvas", canvas, "undo");
    expect(Object.keys((await client.snapshot(canvas)).canvas.items)).toEqual([source]);
  });

  it("spends a key stored with `isocan keys set anthropic` — no ISOCAN_TEXT_API_KEY, no restart (keys phase 1)", async () => {
    const KEY = "sk-ant-acme_WORDS_DO_NOT_PRINT_1234567890";
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme stored key")).canvasId;
    const file = path.join(home, "checkout3.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", source)) as Deck;
    const pay = deck.strings.find((s) => s.text === "Pay now")!.address;
    const voices = { variants: [{ stance: "Short", why: "Fewer words.", edits: [{ address: pay, to: "Pay" }] }] };

    // A fake Claude Messages endpoint: it records the key it was sent and answers one voice.
    const seen: Array<string | undefined> = [];
    const fake = http.createServer((req, res) => {
      seen.push(req.headers["x-api-key"] as string | undefined);
      req.resume();
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: "claude-acme", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(voices) }] }));
      });
    });
    await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
    const address = fake.address();
    const endpoint = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1/messages`;
    try {
      // keys.json lives under this ISOCAN_HOME: the suite's empty ISOCAN_KEYS_HOME is taken out.
      const env = cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ISOCAN_TEXT_API_KEY: "", ISOCAN_KEYS_HOME: undefined, ISOCAN_TEXT_ENDPOINT: endpoint });
      const set = await runCliWithInput(["keys", "set", "anthropic"], KEY, { cwd: home, env });
      expect(set.code, set.stderr).toBe(0);
      const run = await runCli(["--canvas", canvas, "--json", "words", "vary", source, "--n", "1"], { cwd: home, env });
      expect(run.code, run.stderr).toBe(0);
      expect(seen).toEqual([KEY]);
      expect(JSON.parse(run.stdout)).toMatchObject({ source, kind: "html", placeholder: false });
      expect(run.stderr).not.toContain("PLACEHOLDER");
      for (const out of [set.stdout, set.stderr, run.stdout, run.stderr]) expect(out).not.toContain(KEY);
    } finally {
      await new Promise<void>((resolve) => fake.close(() => resolve()));
      await fs.rm(path.join(home, "keys.json"), { force: true });
    }
  });

  it("without a text model, lands placeholder voices and says so", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme placeholder")).canvasId;
    const file = path.join(home, "checkout2.html");
    await fs.writeFile(file, CHECKOUT);
    const source = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme checkout")).itemId as string;
    const run = await isocan("--canvas", canvas, "words", "vary", source, "--n", "2", "--brief", "shorter");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toContain("PLACEHOLDER words, not written copy");
    expect(run.stdout).toContain("Acme checkout — Placeholder A");
    expect(run.stdout).toContain("Acme checkout — Placeholder B");
    expect(run.stdout).toContain("by placeholder words (placeholder)");
    const items = Object.values((await client.snapshot(canvas)).canvas.items).filter((i) => i.properties.parent === source);
    expect(items).toHaveLength(2);
  });
});
