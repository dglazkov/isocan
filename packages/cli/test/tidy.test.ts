import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan tidy <items...>` lines them up where they are** (14 Oct 2026) —
 * the same in-place tidy the app's Tidy row runs, from core, as one undo, on
 * both kinds of canvas. The shape is a loose four: a card top left, a tall
 * one top right, a wide title running under both, a card under the tall one.
 */
const nico = { id: "usr_nico", name: "Nico" };
let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tidy-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
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
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

const LOOSE = [
  { words: "Acme handoff", at: "0,0", size: "700x900" },
  { words: "Acme framing", at: "820,40", size: "1500x1900" },
  { words: "Acme title", at: "30,2080", size: "3400x190" },
  { words: "Acme design", at: "870,2420", size: "560x720" },
];

describe.each([["a group canvas", []], ["a legacy canvas", ["--legacy"]]] as const)("tidy in place on %s", (_name, flags) => {
  it("snaps the near-aligned edges, keeps the arrangement, and is one undo", async () => {
    expect((await isocan("canvas", "create", "Acme tidy", ...flags)).code).toBe(0);
    const ids: string[] = [];
    for (const one of LOOSE) {
      const made = await json("text", one.words, "--at", one.at);
      ids.push(made.itemId);
      const sized = await isocan("set", made.itemId, "--size", one.size);
      expect(sized.code, sized.stderr).toBe(0);
    }
    const where = async () => new Map<string, { x: number; y: number }>((await json("ls")).map((one: any) => [one.id, { x: one.x, y: one.y }]));
    const before = await where();
    // Settled where they were put (a placement may have nudged one clear).
    const [handoff, framing, title, design] = ids as [string, string, string, string];

    const tidied = await isocan("tidy", ...ids);
    expect(tidied.code, tidied.stderr).toBe(0);
    const after = await where();
    // Near-aligned edges now share lines…
    expect(after.get(handoff)!.y).toBe(after.get(framing)!.y);
    expect(after.get(title)!.x).toBe(after.get(handoff)!.x);
    expect(after.get(design)!.x).toBe(after.get(framing)!.x);
    // …and nothing was re-dealt: everything moved a little, not across.
    for (const id of ids) {
      expect(Math.abs(after.get(id)!.x - before.get(id)!.x), id).toBeLessThanOrEqual(120);
      expect(Math.abs(after.get(id)!.y - before.get(id)!.y), id).toBeLessThanOrEqual(120);
    }
    expect(after.get(handoff)!.x).toBeLessThan(after.get(framing)!.x);
    expect(after.get(framing)!.y).toBeLessThan(after.get(title)!.y);
    expect(after.get(title)!.y).toBeLessThan(after.get(design)!.y);

    // One undo takes the whole tidy back.
    const undone = await isocan("undo");
    expect(undone.code, undone.stderr).toBe(0);
    expect(await where()).toEqual(before);

    // And a tidied selection is a fixed point.
    expect((await isocan("redo")).code).toBe(0);
    expect(await where()).toEqual(after);
    expect((await isocan("tidy", ...ids)).code).toBe(0);
    expect(await where()).toEqual(after);
  });

  it("still re-deals onto a lattice when asked for grid by name", async () => {
    expect((await isocan("canvas", "create", "Acme grid", ...flags)).code).toBe(0);
    const ids: string[] = [];
    for (const one of LOOSE) {
      const made = await json("text", one.words, "--at", one.at);
      ids.push(made.itemId);
      expect((await isocan("set", made.itemId, "--size", one.size)).code).toBe(0);
    }
    const ran = await isocan("tidy", "grid", ...ids);
    expect(ran.code, ran.stderr).toBe(0);
    const after = new Map<string, { x: number; y: number }>((await json("ls")).map((one: any) => [one.id, { x: one.x, y: one.y }]));
    // The lattice's columns are the width of the widest item (the title):
    // the tall node is dealt into the second column, thousands of units away.
    expect(after.get(ids[1]!)!.x).toBeGreaterThan(3000);
  });
});
