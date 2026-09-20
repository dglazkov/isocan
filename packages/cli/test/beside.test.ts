import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { harnessVars } from "@isocan/api";
import { besideBox, PLACEMENT_GAP } from "@isocan/core";

/**
 * **"Next to", over the real CLI wire.**
 *
 * #337 gave the voice tool a second referent on the movement tool, so a live
 * session could be told to put one thing beside another. The terminal could
 * not say it — `mv` took coordinates, a delta, or a group — which made a
 * sentence reachable from one surface and not the other, and the isomorphism
 * is the claim this repository is built on.
 *
 * The arithmetic itself is `besideBox` in core and is unit-tested there; what
 * this file is for is that the CLI reaches the SAME function, through a real
 * spawn, and that what lands is an ordinary move.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-beside-"));
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

interface Run { code: number; stdout: string; stderr: string }

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

/** An anchor and a mover of deliberately unequal size, so a centred cross
 *  axis is visibly not an edge lined up with an edge. */
const ANCHOR = { x: 500, y: 300, width: 200, height: 100 };
const MOVER = { width: 80, height: 40 };

async function twoItems(): Promise<{ anchor: string; mover: string }> {
  await json("canvas", "create", "Beside");
  const anchor = await json("text", "Anchor", "--title", "Anchor",
    "--at", `${ANCHOR.x},${ANCHOR.y}`, "--size", `${ANCHOR.width}x${ANCHOR.height}`);
  const mover = await json("text", "Mover", "--title", "Mover",
    "--at", "0,0", "--size", `${MOVER.width}x${MOVER.height}`);
  return { anchor: anchor.itemId ?? anchor.id, mover: mover.itemId ?? mover.id };
}

async function positionOf(id: string): Promise<{ x: number; y: number }> {
  const snapshot = await json("ls");
  const rows = Array.isArray(snapshot) ? snapshot : (snapshot.items ?? []);
  const row = rows.find((one: any) => one.id === id);
  return { x: row.x, y: row.y };
}

describe("mv --beside: the terminal can say next to", () => {
  it("lands where core says, on every side, with the cross axis centred", async () => {
    const { anchor, mover } = await twoItems();
    for (const side of ["right", "left", "above", "below"] as const) {
      const run = await isocan("mv", mover, "--beside", anchor, "--side", side);
      expect(run.code, run.stderr).toBe(0);
      // The assertion is agreement with core rather than a copied number:
      // a literal here would pass while the two surfaces drifted apart.
      expect(await positionOf(mover)).toEqual(besideBox(MOVER, ANCHOR, side));
    }
  });

  it("means the right of a thing when no side is said, the way a page is read", async () => {
    const { anchor, mover } = await twoItems();
    expect((await isocan("mv", mover, "--beside", anchor)).code).toBe(0);
    expect(await positionOf(mover)).toEqual(besideBox(MOVER, ANCHOR, "right"));
  });

  it("leaves the standard gap, so 'next to' is not 'on top of'", async () => {
    const { anchor, mover } = await twoItems();
    await isocan("mv", mover, "--beside", anchor);
    const { x } = await positionOf(mover);
    expect(x - (ANCHOR.x + ANCHOR.width)).toBe(PLACEMENT_GAP);
  });

  it("refuses a second answer to the same question rather than picking one", async () => {
    const { anchor, mover } = await twoItems();
    for (const extra of [["10", "20"], ["--by", "5,5"]]) {
      const run = await isocan("mv", mover, ...extra, "--beside", anchor);
      expect(run.code).not.toBe(0);
      expect(run.stderr).toContain("--beside chooses where");
    }
  });

  it("says which words a side can be, and will not put a thing beside itself", async () => {
    const { anchor, mover } = await twoItems();
    const sideways = await isocan("mv", mover, "--beside", anchor, "--side", "sideways");
    expect(sideways.stderr).toContain("left, right, above or below");
    const itself = await isocan("mv", mover, "--beside", mover);
    expect(itself.stderr).toContain("next to itself");
  });

  it("does not dodge an occupied spot, because landing elsewhere is not 'next to'", async () => {
    // `--in` finds a free spot; this deliberately must not. A command that
    // quietly puts the thing somewhere else is one nobody can trust twice.
    const { anchor, mover } = await twoItems();
    const spot = besideBox(MOVER, ANCHOR, "right");
    const blocker = await json("text", "Blocker", "--title", "Blocker",
      "--at", `${spot.x},${spot.y}`, "--size", `${MOVER.width}x${MOVER.height}`);
    expect(blocker).toBeTruthy();
    await isocan("mv", mover, "--beside", anchor);
    expect(await positionOf(mover)).toEqual(spot);
  });
});
