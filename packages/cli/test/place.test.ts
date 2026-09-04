import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **A canvas placed on a canvas, over the wire** (inception phase 0). Placed
 * by title prefix and by address; the item wears kind=canvas, the target's
 * id and its address; `ls --kind canvas` lists it; a canvas refuses itself;
 * and it lands inside a sheet like anything else.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-place-"));
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

describe("placing a canvas on a canvas", () => {
  it("places by title prefix and by address, wears the contract, and lists as a canvas", async () => {
    const shelf = await json("canvas", "create", "All my canvases");
    const sched = await json("canvas", "create", "Sports Schedule Constraint Solver");
    const S: string = shelf.canvasId;

    // By title prefix, into a sheet.
    await json("area", "new", "Work", "--canvas", S);
    const byRef = await json("canvas", "place", "sports", "--in", "Work", "--canvas", S);
    expect(byRef.canvasId).toBe(sched.canvasId);
    expect(byRef.address).toContain(`/p/${sched.canvasId}`);
    const onShelf = await json("ls", "--in", "Work", "--canvas", S);
    expect(onShelf.length).toBe(1);
    expect(onShelf[0].title).toBe("Sports Schedule Constraint Solver");
    expect(onShelf[0].properties.kind).toBe("canvas");
    expect(onShelf[0].properties.canvas).toBe(sched.canvasId);
    expect(onShelf[0].properties.source).toBe(byRef.address);
    expect(onShelf[0].kind).toBe("canvas");

    // By address — the same item.
    const byAddress = await json("canvas", "place", byRef.address, "--title", "Again", "--canvas", S);
    expect(byAddress.canvasId).toBe(sched.canvasId);
    const canvases = await json("ls", "--kind", "canvas", "--canvas", S);
    expect(canvases.length).toBe(2);

    // Through the one door: `add` reads a title prefix as a canvas, and a
    // word that is nothing here is refused in words rather than fetched.
    const byAdd = await json("add", "sports", "--canvas", S);
    expect(byAdd.canvasId).toBe(sched.canvasId);
    expect((await json("ls", "--kind", "canvas", "--canvas", S)).length).toBe(3);
    const nothing = await isocan("add", "no such thing anywhere", "--canvas", S);
    expect(nothing.code).not.toBe(0);
    expect(nothing.stderr).toContain("nothing to add");

    // A canvas refuses itself.
    const self = await isocan("canvas", "place", S, "--canvas", S);
    expect(self.code).not.toBe(0);
    expect(self.stderr).toContain("cannot be placed on itself");
  });
});
