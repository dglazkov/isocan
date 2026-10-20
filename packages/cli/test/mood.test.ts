import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { writeKey } from "@isocan/core/keystore";
import { deltaE, IMAGE_MODEL_DEFAULT, moodCostLine, parseMoodSwatches } from "@isocan/core/mood";
import { cliEnv, runCli, type Run } from "./cli.ts";

function makeTricolorPng(width = 60, height = 60): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    const [r, g, b] =
      y < Math.floor(height * 0.5)
        ? [0xb5, 0x65, 0x1d]
        : y < Math.floor(height * 0.8)
          ? [0x2f, 0x3e, 0x46]
          : [0xf4, 0xf1, 0xea];
    for (let x = 0; x < width; x++) {
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const pngChunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

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
const PNG = makeTricolorPng(60, 60);

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

function isocanAsAgent(...args: string[]): Promise<Run> {
  return runCli(args, {
    cwd: home,
    env: cliEnv({
      ISOCAN_HOME: home,
      ISOCAN_PORT: port,
      GEMINI_API_KEY: "",
      ISOCAN_IMAGE_MODEL: "",
      CLAUDE_CODE_SESSION_ID: "sess_acme_mood_agent",
    }),
  });
}

async function allItems(): Promise<Array<{ id: string; title: string; containerId?: string; properties: Record<string, string> }>> {
  const run = await isocan("ls", "--json");
  expect(run.code, run.stderr).toBe(0);
  const listed = JSON.parse(run.stdout) as Array<{ id: string; title: string; containerId?: string; properties?: Record<string, string> }> | { items: Array<{ id: string; title: string; containerId?: string; properties?: Record<string, string> }> };
  const items = Array.isArray(listed) ? listed : listed.items;
  return items.map((i) => ({ id: i.id, title: i.title, ...(i.containerId ? { containerId: i.containerId } : {}), properties: i.properties ?? {} }));
}

async function candidates(): Promise<Array<{ id: string; properties: Record<string, string> }>> {
  return (await allItems()).filter((i) => i.properties.mood === "candidate").map((i) => ({ id: i.id, properties: i.properties }));
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

describe("isocan mood keep, drop, and more", () => {
  it("refuses mood keep when called from an agent harness", async () => {
    const named = await isocanAsAgent("identity", "--session", "--name", "Acme Mood Agent");
    expect(named.code, named.stderr).toBe(0);
    const spread = await isocan("mood", "explore", "warm studio brass", "--n", "3", "--yes", "--json");
    expect(spread.code, spread.stderr).toBe(0);
    const { items } = JSON.parse(spread.stdout) as { items: Array<{ itemId: string }> };
    const refused = await isocanAsAgent("mood", "keep", items[0]!.itemId);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toMatch(/keeping is a person's taste/);
  }, 60_000);

  it("keeps tiles into the Mood board (creating it once and reusing it) and drops the remaining run", async () => {
    const spread = await isocan("mood", "explore", "sunlit linen workshop", "--n", "3", "--yes", "--json");
    expect(spread.code, spread.stderr).toBe(0);
    const { run: runId, items } = JSON.parse(spread.stdout) as { run: string; items: Array<{ itemId: string }> };
    const [first, second, third] = items.map((i) => i.itemId);

    const kept1 = await isocan("mood", "keep", first!, "--json");
    expect(kept1.code, kept1.stderr).toBe(0);
    const res1 = JSON.parse(kept1.stdout) as { boardId: string; createdBoard: boolean; keptIds: string[] };
    expect(res1.createdBoard).toBe(true);
    expect(res1.keptIds).toEqual([first!]);

    const kept2 = await isocan("mood", "keep", second!, "--json");
    expect(kept2.code, kept2.stderr).toBe(0);
    const res2 = JSON.parse(kept2.stdout) as { boardId: string; createdBoard: boolean; keptIds: string[] };
    expect(res2.createdBoard).toBe(false);
    expect(res2.boardId).toBe(res1.boardId);

    const dropped = await isocan("mood", "drop", "--run", runId, "--json");
    expect(dropped.code, dropped.stderr).toBe(0);
    expect(JSON.parse(dropped.stdout)).toEqual({ droppedIds: [third!] });

    const itemsNow = await allItems();
    const board = itemsNow.find((i) => i.id === res1.boardId);
    expect(board?.title).toBe("Mood");
    expect(board?.properties.moodBoard).toBe("true");
    const keptFirst = itemsNow.find((i) => i.id === first!);
    expect(keptFirst?.properties.mood).toBe("kept");
    expect(itemsNow.find((i) => i.id === second!)?.properties.mood).toBe("kept");
    expect(itemsNow.find((i) => i.id === third!)).toBeUndefined();

    const swatches = parseMoodSwatches(keptFirst?.properties.moodSwatches);
    expect(swatches.length).toBeGreaterThanOrEqual(3);
    expect(deltaE(swatches[0]!.hex, "#b5651d")).toBeLessThanOrEqual(3);
    expect(deltaE(swatches[1]!.hex, "#2f3e46")).toBeLessThanOrEqual(3);
    expect(deltaE(swatches[2]!.hex, "#f4f1ea")).toBeLessThanOrEqual(3);
  }, 60_000);

  it("draws four variations with mood more and pushes along a dial with --push", async () => {
    const itemsNow = await allItems();
    const keptTile = itemsNow.find((i) => i.properties.mood === "kept")!;
    expect(keptTile).toBeDefined();

    // Without --yes in non-TTY, says the 4-tile cost and refuses.
    const noYes = await isocan("mood", "more", keptTile.id);
    expect(noYes.code).not.toBe(0);
    expect(noYes.stderr).toContain(moodCostLine(4, IMAGE_MODEL_DEFAULT));

    calls.length = 0;
    const pushed = await isocan("mood", "more", keptTile.id, "--push", "warmer", "--n", "2", "--yes", "--json");
    expect(pushed.code, pushed.stderr).toBe(0);
    const answer = JSON.parse(pushed.stdout) as { run: string; items: Array<{ itemId: string; axis: string }> };
    expect(answer.items).toHaveLength(2);
    expect(answer.items.map((i) => i.axis)).toEqual(["push: warmer · light", "push: warmer · material"]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.input.find((b) => b.type === "text")?.text).toContain("Push the look warmer:");
      expect(call.input.some((b) => b.type === "image")).toBe(true);
    }

    const badDial = await isocan("mood", "more", keptTile.id, "--push", "sparkly", "--yes");
    expect(badDial.code).not.toBe(0);
    expect(badDial.stderr).toMatch(/--push must be one of/);
  }, 60_000);
});

describe("isocan mood board and style check", () => {
  it("mood board --json returns kept tiles with swatches, axis, prompt, and words", async () => {
    const run = await isocan("mood", "board", "--json");
    expect(run.code, run.stderr).toBe(0);
    const read = JSON.parse(run.stdout) as {
      boardId: string | null;
      words: string[];
      tiles: Array<{
        itemId: string;
        title: string;
        mood: string;
        axis: string | null;
        prompt: string | null;
        words: string;
        swatches: Array<{ hex: string; share: number }>;
      }>;
    };
    expect(read.boardId).toBeTruthy();
    expect(read.words).toContain("sunlit linen workshop");
    expect(read.tiles.length).toBeGreaterThanOrEqual(2);
    for (const tile of read.tiles) {
      expect(tile.mood).toBe("kept");
      expect(tile.axis).toBeTruthy();
      expect(tile.prompt).toContain("sunlit linen workshop");
      expect(tile.words).toBe("sunlit linen workshop");
      expect(tile.swatches.length).toBeGreaterThanOrEqual(3);
    }

    const human = await isocan("mood", "board");
    expect(human.code, human.stderr).toBe(0);
    expect(human.stdout).toContain(`tiles on Mood (${read.boardId})`);
  }, 60_000);

  it("style check fails on uncited colours or off-board tile citations, and passes when every colour and direction field cites a kept tile", async () => {
    const boardRes = await isocan("mood", "board", "--json");
    expect(boardRes.code, boardRes.stderr).toBe(0);
    const { tiles } = JSON.parse(boardRes.stdout) as { tiles: Array<{ itemId: string }> };
    const [t1, t2] = tiles.map((t) => t.itemId);
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();

    const writeDesign = async (sources: Record<string, string>, extraColor = false) => {
      const docPath = path.join(home, "DESIGN.md");
      const doc = `---
name: Acme Sunlit Linen
colors:
  primary: "#2F3E46"
  neutral: "#F4F1EA"
  tertiary: "#8A4216"${extraColor ? '\n  cobalt: "#1E40AF"' : ""}
typography:
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
isocan:
  direction:
    version: 1
    stage: provisional
    rationale: 'Nico asked for "sunlit linen workshop". Kept tiles hold warm flour ground, slate ink, and crust highlights.'
    taskHierarchy:
      - Inspect daily batches
    layout: Two-column workbench sheet.
    density: Unhurried rows.
    typography: Editorial serif display over clean sans body.
    palettePurpose: Flour ground, slate text, crust primary actions.
    treatments:
      - name: BatchRow
        guidance: Quiet row highlighting active batch counts.
        states:
          - default
          - focused
  sources:
${Object.entries(sources)
  .map(([k, v]) => `    ${k}: "${v}"`)
  .join("\n")}
---

## Overview

Sunlit linen workshop.

## Colors

Warm flour ground, slate ink, crust highlights.

## Typography

Editorial serif display over clean sans.
`;
      await fs.writeFile(docPath, doc, "utf8");
      const setRun = await isocan("style", "set", docPath);
      expect(setRun.code, setRun.stderr).toBe(0);
    };

    const goodSources: Record<string, string> = {
      "colors.primary": t1!,
      "colors.neutral": t1!,
      "colors.tertiary": t2!,
      "direction.layout": t1!,
      "direction.density": t1!,
      "direction.typography": t2!,
      "direction.palettePurpose": t1!,
      "direction.treatments.BatchRow": t2!,
    };

    // 1. Fails when an extra colour is uncited and not explained in rationale.
    await writeDesign(goodSources, true);
    const uncitedCheck = await isocan("style", "check");
    expect(uncitedCheck.code).not.toBe(0);
    expect(uncitedCheck.stdout).toContain("colors.cobalt");

    // 2. Fails when a cited itemId is not on the Mood board.
    await writeDesign({ ...goodSources, "colors.tertiary": "itm_ghost_tile" }, false);
    const ghostCheck = await isocan("style", "check");
    expect(ghostCheck.code).not.toBe(0);
    expect(ghostCheck.stdout).toContain("isocan.sources.colors.tertiary");

    // 3. Passes when every colour and direction field cites a kept tile on the board.
    await writeDesign(goodSources, false);
    const okCheck = await isocan("style", "check");
    expect(okCheck.code, okCheck.stderr).toBe(0);
    expect(okCheck.stderr).toContain("nothing to fix");
  }, 60_000);

  it("Phase 4: critic add board builds the Board critic card from the kept Mood board tiles", async () => {
    const lsBefore = await isocan("critic", "ls", "--json");
    expect(lsBefore.code, lsBefore.stderr).toBe(0);
    const parsedBefore = JSON.parse(lsBefore.stdout) as { lenses: Array<{ id: string; agentName: string }>; critics: Array<{ name: string }> };
    expect(parsedBefore.lenses.some((l) => l.id === "board" && l.agentName === "Board")).toBe(true);

    const added = await isocan("critic", "add", "board", "--json");
    expect(added.code, added.stderr).toBe(0);
    const card = JSON.parse(added.stdout) as { itemId: string; name: string; agentName: string; on: boolean };
    expect(card).toMatchObject({ name: "board", agentName: "Board", on: true });

    const got = await isocan("get", card.itemId);
    expect(got.code, got.stderr).toBe(0);
    expect(got.stdout).toContain("name: board");
    expect(got.stdout).toContain("agentName: Board");
    expect(got.stdout).toContain("#b5651d");
    expect(got.stdout).toContain("ΔE 18");
  }, 60_000);
});
