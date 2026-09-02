import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { AREA_TITLE_HEIGHT, AREA_INSET } from "@isocan/core";

/**
 * **Areas, over the wire** (`core/area.ts`, sprint phase 0).
 *
 * The claims worth a daemon: a sheet laid by the verb is an ordinary item
 * the daemon accepts unchanged; something placed `--in` it lands INSIDE it
 * and stays there through the daemon's tidy rule; `ls --in` reads
 * membership off geometry; `mv --in` moves a thing onto the sheet;
 * `format --in` tidies only what is on the sheet. The pure geometry is in
 * core's `area.test.ts`; this is the wire.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-area-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
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
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

describe("a sheet, and what is on it", () => {
  it("lays a sheet, places into it, reads it back, moves onto it, tidies it", async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);

    // Something already on the canvas, so the sheet has to go BESIDE it.
    const before = await json("text", "already here", "--at", "0,0");
    expect(before.placement).toEqual({ x: 0, y: 0, chosen: true });

    const sheet = await json("area", "new", "Sketches", "--tint", "yellow", "--note", "Sketch alone; hand in at the bell.");
    expect(sheet.title).toBe("Sketches");
    expect(sheet.placement.chosen).toBe(true);
    expect(sheet.placement.x).toBeGreaterThan(0); // to the right of "already here"
    const sx: number = sheet.placement.x;
    const sy: number = sheet.placement.y;

    // Placed --in: inside, under the title strip, inset — and chosen, so the
    // daemon's tidy rule never carries it out of the sheet.
    const first = await json("text", "first sketch", "--in", "Sketches", "--paper", "pink");
    expect(first.placement).toEqual({ x: sx + AREA_INSET, y: sy + AREA_TITLE_HEIGHT, chosen: true });
    // The second lands clear of the first, and still on the sheet.
    const second = await json("text", "second sketch", "--in", "sket", "--paper", "pink");
    expect(second.placement).not.toEqual(first.placement);

    const held = await json("ls", "--in", "Sketches");
    expect(held.map((one: any) => one.title).sort()).toEqual(["first sketch", "second sketch"]);
    const all = await json("ls");
    expect(all.length).toBe(4); // the caption, the sheet, two sketches

    // Move the caption onto the sheet; it is now in.
    const moved = await isocan("mv", before.itemId, "--in", "Sketches");
    expect(moved.code, moved.stderr).toBe(0);
    const heldNow = await json("ls", "--in", "Sketches");
    expect(heldNow.map((one: any) => one.title).sort()).toEqual(["already here", "first sketch", "second sketch"]);

    // The sheet counts three.
    const areas = await json("area", "ls");
    expect(areas).toEqual([expect.objectContaining({ title: "Sketches", holds: "3", tint: "yellow" })]);

    // A tidy of the sheet moves nothing off it and touches nothing else.
    const tidy = await isocan("format", "--in", "Sketches", "--per-row", "2");
    expect(tidy.code, tidy.stderr).toBe(0);
    const after = await json("ls", "--in", "Sketches");
    expect(after.length).toBe(3);
    for (const one of after) {
      expect(one.x).toBeGreaterThanOrEqual(sx);
      expect(one.y).toBeGreaterThanOrEqual(sy + AREA_TITLE_HEIGHT);
    }
    const sheetNow = (await json("ls")).find((one: any) => one.title === "Sketches");
    expect(sheetNow.x).toBe(sx);
    expect(sheetNow.y).toBe(sy);
  });

  it("refuses a sheet it cannot find, and says how to list them", async () => {
    await isocan("canvas", "create", "Board");
    const run = await isocan("text", "lost", "--in", "Nowhere");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('no area called "Nowhere"');
    expect(run.stderr).toContain("isocan area ls");
  });
});
