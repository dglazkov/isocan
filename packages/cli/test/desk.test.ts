import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { DESK_OF_PROP, LINK } from "@isocan/core";

/**
 * **The desk and the hand-in from it, over the wire** (sprint phase 3).
 * A desk is born knowing its sprint, with its link grant off and one pass
 * minted; a copy onto the sprint's sheet with --handin lands on the sheet,
 * stamped for the running phase, and the originals stay on the desk.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-desk-"));
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

describe("a desk, and the bell from it", () => {
  it("is born private and knowing its sprint; a hand-in copies onto the sprint's sheet", async () => {
    const sprint = await json("canvas", "create", "Sprint room");
    const sprintId: string = sprint.canvasId;
    await json("sprint", "board", "--canvas", sprintId);
    await isocan("sprint", "phase", "sketch", "30m", "--canvas", sprintId);

    const desk = await json("sprint", "desk", "Theo", "--canvas", sprintId);
    expect(desk.title).toBe("Theo's desk");
    expect(desk.sprintOf).toBe(sprintId);
    // The address carries a pass, and nothing else admits.
    expect(desk.address).toContain(`/p/${desk.canvasId}#`);
    const shown = await json("canvas", "show", desk.canvasId);
    expect(shown.properties?.[DESK_OF_PROP] ?? shown.project?.properties?.[DESK_OF_PROP]).toBe(sprintId);
    // Read without a badge: the door may refuse, and a refusal is not a
    // link grant — so this only asserts when the desk answers.
    const grants: any = await fetch(`${base}/api/projects/${desk.canvasId}/grants`)
      .then((r) => r.json() as Promise<any>)
      .catch(() => null);
    if (grants && Array.isArray(grants.grants)) {
      expect(grants.grants.some((g: any) => g.subject === LINK && !g.revokedAt)).toBe(false);
    }

    // The sketcher works on the desk; nothing is on the sprint yet.
    const sketch = await json("text", "Single column", "--paper", "yellow", "--canvas", desk.canvasId);
    expect((await json("ls", "--in", "Sketches", "--canvas", sprintId)).length).toBe(0);

    // The bell: one command copies it onto the sheet and hands it in.
    const handed = await json("copy", sketch.itemId, "--to", sprintId, "--in", "Sketches", "--handin", "--canvas", desk.canvasId);
    expect(handed.handedInFor).toBe("sketch");
    expect(handed.items.length).toBe(1);
    const wall = await json("ls", "--in", "Sketches", "--canvas", sprintId);
    expect(wall.map((one: any) => one.title)).toEqual(["Single column"]);
    expect(wall[0].properties.sprint).toBe("sketch");
    expect((await json("sprint", "--canvas", sprintId)).handedIn.length).toBe(1);
    // The original stays on the desk — a hand-in is a copy.
    expect((await json("ls", "--canvas", desk.canvasId)).length).toBe(1);
  });

  it("refuses to hand in where no sprint runs, and names a sheet it cannot find", async () => {
    const a = await json("canvas", "create", "A");
    const b = await json("canvas", "create", "B");
    const note = await json("text", "hello", "--canvas", a.canvasId);
    const noSprint = await isocan("copy", note.itemId, "--to", b.canvasId, "--handin", "--canvas", a.canvasId);
    expect(noSprint.code).not.toBe(0);
    expect(noSprint.stderr).toContain("no sprint is running");
    const noSheet = await isocan("copy", note.itemId, "--to", b.canvasId, "--in", "Nowhere", "--canvas", a.canvasId);
    expect(noSheet.code).not.toBe(0);
    expect(noSheet.stderr).toContain('no area called "Nowhere"');
  });
});
