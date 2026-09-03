import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **A placed mark, over the wire** (sprint phase 4): `react --at` lands a
 * point the daemon keeps beside the reaction, `ls --json` reads it back,
 * a second placement moves it, `--off` takes the mark and a fresh `react`
 * shows the dot again where it was — undo's shape, by hand.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-heat-"));
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

async function points(itemId: string): Promise<Record<string, { x: number; y: number }> | undefined> {
  const items = await json("ls");
  return items.find((one: any) => one.id === itemId)?.reactionPoints?.["🔴"];
}

describe("a dot on a sketch", () => {
  it("lands where --at says, moves, survives --off, and is refused off the item", async () => {
    await isocan("canvas", "create", "Wall");
    const sketch = await json("text", "a sketch", "--paper", "yellow");
    const id: string = sketch.itemId;

    const placed = await isocan("react", "🔴", id, "--at", "0.25,0.75");
    expect(placed.code, placed.stderr).toBe(0);
    expect(await points(id)).toEqual({ [kit.id]: { x: 0.25, y: 0.75 } });

    const moved = await isocan("react", "🔴", id, "--at", "0.6,0.4");
    expect(moved.code, moved.stderr).toBe(0);
    expect(await points(id)).toEqual({ [kit.id]: { x: 0.6, y: 0.4 } });
    const wearing = (await json("ls")).find((one: any) => one.id === id).reactions["🔴"];
    expect(wearing).toEqual([kit.id]);

    const off = await isocan("react", "🔴", id, "--off");
    expect(off.code, off.stderr).toBe(0);
    const after = (await json("ls")).find((one: any) => one.id === id);
    expect(after.reactions?.["🔴"]).toBeUndefined();

    const bad = await isocan("react", "🔴", id, "--at", "2,0");
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("fractions");
    const both = await isocan("react", "🔴", id, "--at", "0.5,0.5", "--off");
    expect(both.code).not.toBe(0);
  });
});
