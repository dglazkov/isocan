import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { writeKey } from "@isocan/core/keystore";
import { IMAGE_MODEL_DEFAULT, moodCostLine } from "@isocan/core/mood";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan mood explore`** (moodboard phase 0; design §2, §7), walked
 * against a real daemon on a scratch home whose Gemini key is made up and
 * whose Google is a fake behind the image model's `fetch` seam, answering a
 * fixture PNG. Never a real model, never a real home, never a real key.
 *
 * Held: the cost is said first, and a run nobody can be asked about is
 * refused with it and draws nothing; `--yes` draws nine `mood: candidate`
 * tiles with full provenance; `--from` sends a canvas image beside the words
 * and records it as the parent; a request naming a brand is refused by the
 * home, in words, with nothing spent; and `--n` past the cap is refused here.
 *
 * Fixtures are synthetic: Acme, Nico, a made-up key.
 */

const KEY = "fake-gemini-acme_MOOD_CLI_DO_NOT_PRINT_";
const nico = { id: "usr_nico", name: "Nico" };
const WORDS = "a quiet bakery at dawn";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let home: string;
let daemon: Daemon;
let port: string;
const calls: Array<{ input: Array<{ type: string; text?: string; data?: string }> }> = [];

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mood-cli-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
  await writeKey(home, "gemini", KEY);
  const fake = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ status: "completed", steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG.toString("base64") }] }] }), { status: 200 });
  }) as unknown as typeof fetch;
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", birthHome: null, image: { fetch: fake, perMinute: 10 } });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  const made = await isocan("canvas", "create", "Acme Mood");
  expect(made.code, made.stderr).toBe(0);
}, 120_000);

afterAll(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, GEMINI_API_KEY: "", ISOCAN_IMAGE_MODEL: "" }) });
}

async function candidates(): Promise<Array<{ id: string; properties: Record<string, string> }>> {
  const run = await isocan("ls", "--json");
  expect(run.code, run.stderr).toBe(0);
  const listed = JSON.parse(run.stdout) as Array<{ id: string; properties?: Record<string, string> }> | { items: Array<{ id: string; properties?: Record<string, string> }> };
  const items = Array.isArray(listed) ? listed : listed.items;
  return items.filter((i) => i.properties?.mood === "candidate").map((i) => ({ id: i.id, properties: i.properties! }));
}

describe("isocan mood explore", () => {
  it("says the cost first, and without --yes where nobody can be asked, refuses with it and draws nothing", async () => {
    const run = await isocan("mood", "explore", WORDS);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain(moodCostLine(9, IMAGE_MODEL_DEFAULT));
    expect(run.stderr).toMatch(/pass --yes to accept the cost/);
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("with --yes draws nine candidate tiles with their provenance", async () => {
    const run = await isocan("mood", "explore", WORDS, "--yes", "--json");
    expect(run.code, run.stderr).toBe(0);
    const answer = JSON.parse(run.stdout) as { run: string; model: string; items: Array<{ itemId: string; axis: string }> };
    expect(answer.items).toHaveLength(9);
    expect(answer.model).toBe(IMAGE_MODEL_DEFAULT);
    expect(calls).toHaveLength(9);
    const tiles = await candidates();
    expect(tiles.map((t) => t.id).sort()).toEqual(answer.items.map((i) => i.itemId).sort());
    for (const tile of tiles) {
      expect(tile.properties.moodRun).toBe(answer.run);
      expect(tile.properties.moodModel).toBe(IMAGE_MODEL_DEFAULT);
      expect(tile.properties.moodPrompt).toContain("not a user interface");
      expect(tile.properties.moodAxis).toBeTruthy();
    }
  }, 60_000);

  it("--from sends a canvas picture beside the words and records it as the parent", async () => {
    const photo = path.join(home, "acme-photo.png");
    await fs.writeFile(photo, PNG);
    const added = await isocan("add", photo, "--json");
    expect(added.code, added.stderr).toBe(0);
    const photoId = (JSON.parse(added.stdout) as { itemId: string }).itemId;
    calls.length = 0;
    const run = await isocan("mood", "explore", "warmer, older", "--n", "2", "--from", photoId, "--yes", "--json");
    expect(run.code, run.stderr).toBe(0);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.input.some((b) => b.type === "image" && b.data === PNG.toString("base64"))).toBe(true);
    const answer = JSON.parse(run.stdout) as { run: string };
    const children = (await candidates()).filter((t) => t.properties.moodRun === answer.run);
    expect(children.map((t) => t.properties.moodParent)).toEqual([photoId, photoId]);
  }, 60_000);

  it("is refused by the home, in words, for words naming a brand — nothing spent", async () => {
    calls.length = 0;
    const run = await isocan("mood", "explore", "a Nike store at dawn", "--yes");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/refused before anything is spent/);
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("refuses --n past the per-run cap before it asks anything", async () => {
    const run = await isocan("mood", "explore", WORDS, "--n", "13", "--yes");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/per-run cap is 12/);
  }, 60_000);
});
