import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { SPRINT_BOARD } from "@isocan/core";

/**
 * **The board and the brief, over the wire** (sprint phase 1). A laid board
 * is eleven areas the daemon accepted where the layout put them; laying it
 * again lays nothing; a phase called afterwards knows its sheet; the brief
 * lands on the Brief sheet and the second brief is a version of the first.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-board-"));
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

describe("the board, laid and read back", () => {
  it("lays eleven sheets once, tells a phase its sheet, and keeps one brief", async () => {
    await isocan("canvas", "create", "Sprint room");
    // Existing work: the board goes to its right, not over it.
    await json("text", "the product", "--at", "0,0", "--size", "400x300");

    const laid = await json("sprint", "board");
    expect(laid.laid.map((one: any) => one.key)).toEqual(SPRINT_BOARD.map((one) => one.key));
    expect(laid.laid[0].x).toBeGreaterThan(400);
    const areas = await json("area", "ls");
    expect(areas.length).toBe(SPRINT_BOARD.length);
    expect(areas[0]).toMatchObject({ title: "Brief", holds: "0" });

    // Again: nothing laid twice.
    const again = await json("sprint", "board");
    expect(again.laid).toEqual([]);
    expect(again.kept.length).toBe(SPRINT_BOARD.length);

    // A phase knows its sheet.
    const called = await isocan("sprint", "phase", "hmw", "10m");
    expect(called.code, called.stderr).toBe(0);
    const state = await json("sprint");
    expect(state.area.title).toBe("Experts & HMW");
    const shown = await isocan("sprint");
    expect(shown.stdout).toContain("on the board: Experts & HMW");

    // The brief lands on the Brief sheet; the next brief is a version.
    const first = await json("sprint", "brief", "--goal", "Sign-up feels like ten seconds", "--decider", "Maya");
    expect(first.version).toBe(1);
    const onBrief = await json("ls", "--in", "Brief");
    expect(onBrief.map((one: any) => one.title)).toEqual(["Brief"]);
    const second = await json("sprint", "brief", "--goal", "Sign-up feels like ten seconds", "--decider", "Maya", "--question", "Can we skip the password?");
    expect(second.itemId).toBe(first.itemId);
    expect(second.version).toBe(2);
    const stillOne = await json("ls", "--in", "Brief");
    expect(stillOne.length).toBe(1);
    expect(stillOne[0].versions.length).toBe(2);
  });
});
