import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **Grids, over the wire** (sprint phase 5): a grid laid on a sheet, a
 * note placed into one cell, the deck made from a sheet in reading order.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-grid-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

describe("a grid on a sheet", () => {
  it("lays a grid with names, places into a cell, and makes the deck from a sheet", async () => {
    await isocan("canvas", "create", "Friday");
    const sheet = await json("area", "new", "Test", "--size", "3200x1400");
    const grid = await json("area", "grid", "Test", "2x3", "--rows", "Ana,Ben", "--cols", "one,two,three");
    expect(grid.grid).toEqual({ rows: 2, cols: 3, rowNames: ["Ana", "Ben"], colNames: ["one", "two", "three"] });
    expect((await json("area", "ls"))[0]).toMatchObject({ title: "Test", grid: "2x3" });

    // Into cell 2,3: the bottom-right third of the inner region.
    const note = await json("text", "liked the summary", "--paper", "yellow", "--in", "Test", "--cell", "2,3");
    const sx: number = sheet.placement.x;
    const sy: number = sheet.placement.y;
    expect(note.placement.chosen).toBe(true);
    // The exact corner is core's (`cellBox`, inset and rounded); what the
    // wire has to show is that it landed in the right third and the lower
    // half of the sheet.
    expect(note.placement.x).toBeGreaterThan(sx + 2000);
    expect(note.placement.x).toBeLessThan(sx + 3200);
    expect(note.placement.y).toBeGreaterThan(sy + 700);
    expect(note.placement.y).toBeLessThan(sy + 1400);

    const off = await isocan("text", "nowhere", "--in", "Test", "--cell", "3,1");
    expect(off.code).not.toBe(0);
    expect(off.stderr).toContain("2×3");
    const noSheet = await isocan("text", "nowhere", "--cell", "1,1");
    expect(noSheet.code).not.toBe(0);
    expect(noSheet.stderr).toContain("--cell needs --in");

    // The deck from a sheet: every item on it, in reading order.
    const story = await json("area", "new", "Storyboard", "--size", "3200x900");
    await json("area", "grid", "Storyboard", "1x3");
    const f2 = await json("text", "frame two", "--in", "Storyboard", "--cell", "1,2");
    const f1 = await json("text", "frame one", "--in", "Storyboard", "--cell", "1,1");
    const deck = await isocan("slides", "add", "--in", "Storyboard");
    expect(deck.code, deck.stderr).toBe(0);
    const shown = await json("slides", "show");
    const order = (shown.slides ?? shown).map((one: any) => one.title ?? one);
    expect(order.indexOf("frame one")).toBeLessThan(order.indexOf("frame two"));
    expect(story.title).toBe("Storyboard");
    expect(f1.itemId).not.toBe(f2.itemId);

    const cleared = await isocan("area", "grid", "Test", "--clear");
    expect(cleared.code, cleared.stderr).toBe(0);
    expect((await json("area", "ls")).find((one: any) => one.title === "Test").grid).toBe("");
  });
});
