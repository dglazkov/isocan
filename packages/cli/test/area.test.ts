import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { DaemonRoutes, harnessVars } from "@isocan/api";
import { AREA_HEAD, AREA_INSET } from "@isocan/core";

/** Ordinary writer births and compatibility aliases over the real CLI wire.
 * Legacy geometric reads are isolated in a deliberately legacy fixture. */

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
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

describe("a group through the old area spelling", () => {
  it("lays a sheet, places into it, reads it back, moves onto it, tidies it", async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);

    // Something already on the canvas, so the sheet has to go BESIDE it.
    const before = await json("text", "already here", "--at", "0,0");
    expect(before.placement).toMatchObject({ x: 0, y: 0 });
    expect(before.placement.width).toBeGreaterThan(0);

    const sheet = await json("area", "new", "Sketches", "--tint", "yellow", "--note", "Sketch alone; hand in at the bell.");
    const frame = sheet.changes.find((row: any) => row.itemId === sheet.itemId).boxAfter;
    expect(frame.x).toBeGreaterThan(0); // beside the existing caption
    const sx: number = frame.x;
    const sy: number = frame.y;
    const group = (await json("ls")).find((one: any) => one.id === sheet.itemId);
    expect(group.properties).toMatchObject({ kind: "group", tint: "yellow" });

    // Placed --in: explicit membership, below the protected title and brief.
    const first = await json("text", "first sketch", "--in", "Sketches", "--paper", "pink");
    expect(first.placement).toMatchObject({ x: sx + AREA_INSET, y: sy + AREA_HEAD + AREA_INSET });
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
    expect(areas).toEqual([expect.objectContaining({ title: "Sketches", directCount: 3 })]);

    // A tidy of the sheet moves nothing off it and touches nothing else.
    const tidy = await isocan("format", "--in", "Sketches", "--per-row", "2");
    expect(tidy.code, tidy.stderr).toBe(0);
    const after = await json("ls", "--in", "Sketches");
    expect(after.length).toBe(3);
    for (const one of after) {
      expect(one.x).toBeGreaterThanOrEqual(sx);
      expect(one.y).toBeGreaterThanOrEqual(sy + AREA_HEAD);
    }
    const sheetNow = (await json("ls")).find((one: any) => one.title === "Sketches");
    expect(sheetNow.x).toBe(sx);
    expect(sheetNow.y).toBe(sy);
  });

  it("keeps legacy receipts and centre-based reads in an explicitly legacy fixture", async () => {
    await isocan("canvas", "create", "Acme Legacy", "--legacy");
    const client = new DaemonRoutes(base, home);
    const canvas = (await client.listCanvases())[0]!;
    expect(canvas.groupMode).toBe("legacy");
    const upload = await client.uploadBlob(canvas.id, Buffer.from("\n"), "text/markdown", "area.md");
    await client.sendOp(canvas.id, nico, { type: "item.add", itemId: "itm_legacy_area", title: "Acme old sheet", properties: { kind: "area" }, width: 1600, height: 1000, placement: { x: 0, y: 0, chosen: true }, version: { id: "ver_legacy_area", ...upload, filename: "area.md" } });
    const note = await json("text", "Acme old note", "--at", "24,200");
    expect(note.placement).toEqual({ x: 24, y: 200, chosen: true });
    expect((await json("ls", "--in", "Acme old sheet")).map((row: any) => row.id)).toEqual([note.itemId]);
    expect((await json("area", "ls"))[0]).toMatchObject({ id: "itm_legacy_area", mode: "legacy", holds: "1" });
    const refused = await isocan("area", "new", "Acme refused");
    expect(refused.code).toBe(1); expect(refused.stderr).toContain("migrate --dry-run");
    expect(Object.keys((await client.snapshot(canvas.id)).canvas.items).sort()).toEqual(["itm_legacy_area", note.itemId].sort());
  });

  it("refuses a sheet it cannot find, and says how to list them", async () => {
    await isocan("canvas", "create", "Board");
    const run = await isocan("text", "lost", "--in", "Nowhere");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('no canvas group called "Nowhere"');
    expect(run.stderr).toContain("isocan canvas group ls");
  });

  it("automatically grows the area when it cannot fit additional nodes", async () => {
    await isocan("canvas", "create", "Gallery");
    const sheet = await json("area", "new", "Screens");
    const initialHeight = sheet.changes.find((row: any) => row.itemId === sheet.itemId).boxAfter.height;
    expect(initialHeight).toBe(1000);

    // Add 3 full-sized screens (1280x800 each) --in Screens.
    // Inner area is 1552x800, so only 1 screen fits in the default sheet.
    // The 2nd and 3rd screens must cause the area to auto-grow downward.
    const s1 = await json("text", "Screen 1", "--in", "Screens", "--size", "1280x800");
    const s2 = await json("text", "Screen 2", "--in", "Screens", "--size", "1280x800");
    const s3 = await json("text", "Screen 3", "--in", "Screens", "--size", "1280x800");

    expect(s1.placement.y).not.toBe(s2.placement.y);
    expect(s2.placement.y).not.toBe(s3.placement.y);
    expect(s2.placement.y).toBeGreaterThan(s1.placement.y);
    expect(s3.placement.y).toBeGreaterThan(s2.placement.y);

    const all = await json("ls");
    const sheetNow = all.find((one: any) => one.title === "Screens");
    expect(sheetNow.height).toBeGreaterThan(2500);

    const held = await json("ls", "--in", "Screens");
    expect(held.length).toBe(3);
    expect(held.map((one: any) => one.title).sort()).toEqual(["Screen 1", "Screen 2", "Screen 3"]);
  });
});
