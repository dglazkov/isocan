import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`mv --out`, the twin of `mv --in`, over the real CLI wire**
 * (groups-by-hand phase 2). A person takes an item out of its group with a
 * ⌘-drag, ⌘⇧G or *Move to canvas*; an agent reaches for `mv`, so `mv` says
 * it too: `--out` one level up, `--to-root` straight to the canvas, and the
 * item stays where it is either way.
 */

const kit = { id: "usr_kit", name: "Kit" };
let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mv-out-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port }) });
}
async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, `${args.join(" ")}\n${run.stderr}`).toBe(0);
  return JSON.parse(run.stdout);
}

/** Acme outer ⊃ Acme inner ⊃ card, on a canvas converted to groups. */
async function nested(): Promise<{ card: string; inner: string; outer: string }> {
  // New canvases have groups (the agent guide says so; `migrate` is for old ones).
  await json("canvas", "create", "Acme mv out");
  const card = (await json("text", "Acme card", "--at", "100,200", "--size", "200x120")).itemId as string;
  const inner = (await json("canvas", "group", "wrap", card, "--title", "Acme inner")).itemId as string;
  const outer = (await json("canvas", "group", "wrap", inner, "--title", "Acme outer")).itemId as string;
  return { card, inner, outer };
}
const parentOf = async (id: string) => ((await json("show", id)).containerId ?? null) as string | null;
const placeOf = async (id: string) => { const item = await json("show", id); return { x: item.x, y: item.y }; };

describe("isocan mv --out", () => {
  it("takes an item one level up, then with --to-root straight to the canvas, where it stands", async () => {
    const { card, inner, outer } = await nested();
    expect(await parentOf(card)).toBe(inner);
    const before = await placeOf(card);

    const preview = await json("mv", card, "--out", "--dry-run");
    expect(preview.dryRun).toBe(true);
    expect(await parentOf(card)).toBe(inner);

    await json("mv", card, "--out");
    expect(await parentOf(card)).toBe(outer);
    expect(await placeOf(card)).toEqual(before);

    await json("mv", inner, "--to-root");
    expect(await parentOf(inner)).toBeNull();
    await json("mv", card, "--out", "--to-root");
    expect(await parentOf(card)).toBeNull();
    expect(await placeOf(card)).toEqual(before);
  });

  it("refuses an item already on the canvas, and a destination beside --out", async () => {
    const { card } = await nested();
    await json("mv", card, "--to-root");
    const again = await isocan("mv", card, "--out");
    expect(again.code).not.toBe(0);
    expect(again.stderr).toMatch(/already at the canvas root/);
    const both = await isocan("mv", card, "--out", "--by", "10,0");
    expect(both.code).not.toBe(0);
    expect(both.stderr).toMatch(/--out keeps the item where it is/);

  });
});
