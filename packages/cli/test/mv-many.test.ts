import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`mv` with several item x y triples is one act.** Separate `mv` calls on
 * members of one group refuse each other when they overlap ("canvas group
 * changed since planning"); triples are planned once, land once and undo once.
 */

const kit = { id: "usr_kit", name: "Kit" };
let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mv-many-"));
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
const placeOf = async (id: string) => { const item = await json("show", id); return { x: item.x, y: item.y }; };

/** Three cards wrapped in one group, on a canvas with groups. */
async function board(): Promise<{ cards: string[]; group: string }> {
  await json("canvas", "create", "Acme mv many");
  const cards: string[] = [];
  for (const [i, at] of ["0,0", "300,0", "600,0"].entries()) cards.push((await json("text", `Acme ${i}`, "--at", at, "--size", "200x120")).itemId);
  const group = (await json("canvas", "group", "wrap", ...cards, "--title", "Acme board")).itemId as string;
  return { cards, group };
}

describe("isocan mv <item> <x> <y> <item> <x> <y> …", () => {
  it("moves every member of a group in one op, negative coordinates included", async () => {
    const { cards: [a, b, c], group } = await board();
    const moved = await json("mv", a!, "600", "0", b!, "-300", "40", c!, "0", "0");
    expect(moved.intent).toBe("transform");
    expect(await placeOf(a!)).toEqual({ x: 600, y: 0 });
    expect(await placeOf(b!)).toEqual({ x: -300, y: 40 });
    expect(await placeOf(c!)).toEqual({ x: 0, y: 0 });
    expect((await json("show", b!)).containerId).toBe(group);
    expect(moved.changes.map((row: { itemId: string }) => row.itemId)).toEqual(expect.arrayContaining([a, b, c]));

    expect((await isocan("undo")).code).toBe(0);
    expect(await placeOf(a!)).toEqual({ x: 0, y: 0 });
    expect(await placeOf(b!)).toEqual({ x: 300, y: 0 });
    expect(await placeOf(c!)).toEqual({ x: 600, y: 0 });
  });

  it("refuses a partial triple, and options that choose a different kind of move", async () => {
    const { cards: [a, b] } = await board();
    const partial = await isocan("mv", a!, "10", "10", b!, "20");
    expect(partial.code).not.toBe(0);
    expect(partial.stderr).toMatch(/item x y triples/);
    const mixed = await isocan("mv", a!, "10", "10", b!, "20", "20", "--by", "5,5");
    expect(mixed.code).not.toBe(0);
    expect(mixed.stderr).toMatch(/item x y triples/);
    const nan = await isocan("mv", a!, "10", "10", b!, "x", "20");
    expect(nan.code).not.toBe(0);
    expect(nan.stderr).toMatch(/positional numbers/);
  });
});
