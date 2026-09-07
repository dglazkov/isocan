import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { GROUND_MAX_BYTES, GROUND_PROP, THEME_ANCHOR_PROP, THEME_PROP } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { mintTestBadge } from "./badge.ts";
import { reservePort } from "../../../test/ports.ts";

/**
 * **`isocan canvas background`** — the seeded grounds (#195) and a picture of
 * your own (#204 phase 2).
 *
 * The command had no test at all: the parses and patches were held in
 * `core/test/theme.test.ts` and nothing ran the verb, which is how a picture
 * came to leave `themeAnchor: window` behind on the NEXT ground somebody
 * chose. That bug lived entirely in the sequence — each patch was correct on
 * its own — so the case it needs is two commands in a row and the properties
 * read back, which is what most of this file is.
 *
 * Direct mode, for `shelf.test.ts`'s reason: a scratch home over HTTP with no
 * daemon and no replica, cheap enough to run on every push.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const picture = fileURLToPath(new URL("../../../docs/built-on-a-canvas.jpg", import.meta.url));

let homeDaemon: Daemon;
let homeStore: string;
let homePort: number;
let homeUrl: string;
let machine: string;
let work: string;
/** Never bound here — direct mode must start no daemon — but taken from the
 *  registry because `stopDaemons` kills whoever answers (`test/ports.ts`). */
let directPort: number;

beforeEach(async () => {
  homeStore = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ground-home-"));
  machine = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ground-machine-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ground-work-"));
  homeDaemon = await startDaemon({ port: 0, home: homeStore });
  const address = homeDaemon.app.server.address();
  homePort = typeof address === "object" && address ? address.port : 0;
  homeUrl = `http://127.0.0.1:${homePort}`;
  directPort = await reservePort();
  await mintTestBadge(homeUrl);
  await isocan("identity", "--name", "Sonia");
  expect((await isocan("canvas", "create", "Ground")).code).toBe(0);
});

afterEach(async () => {
  await homeDaemon.close();
  await stopDaemons(homePort, homeStore).catch(() => {});
  await stopDaemons(directPort, machine).catch(() => {});
  for (const dir of [homeStore, machine, work]) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env: {
      ...process.env,
      ISOCAN_HOME: machine,
      ISOCAN_PORT: String(directPort),
      ISOCAN_DIRECT: homeUrl,
      CLAUDE_CODE_SESSION_ID: "sonia-ground",
      CI: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/** What the canvas is actually wearing, read back from the home. */
async function props(): Promise<Record<string, string>> {
  const shown = await isocan("--json", "canvas", "show", "Ground");
  expect(shown.code, shown.stderr).toBe(0);
  return (JSON.parse(shown.stdout) as Canvas).properties ?? {};
}

describe("the ground a canvas stands on", () => {
  it("says what it is wearing when asked nothing", async () => {
    const bare = await isocan("canvas", "background", "--canvas", "Ground");
    expect(bare.code, bare.stderr).toBe(0);
    // The refusal-shaped answer names every way out, including the new one:
    // a person who types the bare command should not have to find --picture.
    expect(bare.stdout).toContain("none");
    expect(bare.stdout).toContain("--picture");
  });

  it("wears a seeded ground, and takes it off leaving nothing", async () => {
    await isocan("canvas", "background", "galaxy", "--canvas", "Ground");
    expect(await props()).toEqual({ [THEME_PROP]: "galaxy" });
    await isocan("canvas", "background", "none", "--canvas", "Ground");
    expect(await props()).toEqual({});
  });

  it("stands on a picture, and says the weight it just added", async () => {
    const set = await isocan("canvas", "background", "--picture", picture, "--canvas", "Ground");
    expect(set.code, set.stderr).toBe(0);
    // The size is said because it is a real cost: everybody on this canvas
    // downloads it on every cold load, forever.
    expect(set.stdout).toMatch(/\d+kB/);
    const wearing = await props();
    expect(wearing[GROUND_PROP]).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(wearing)).toEqual([GROUND_PROP]);
  });

  it("leaves no pinning behind on the ground somebody chooses next", async () => {
    /**
     * The bug this file exists for. `groundPatch` used to write
     * `themeAnchor: window` beside the hash — true of the picture, and then
     * still there when the picture was gone. Set a picture, choose Space
     * Galaxy, and the galaxy was pinned by a choice nobody made and nothing
     * said. Two correct patches, one wrong sequence.
     */
    await isocan("canvas", "background", "--picture", picture, "--canvas", "Ground");
    await isocan("canvas", "background", "galaxy", "--canvas", "Ground");
    expect(await props()).toEqual({ [THEME_PROP]: "galaxy" });
  });

  it("keeps a pin somebody actually chose", async () => {
    // The other half: only the IMPLICIT choice is refused a home. Switching
    // between seeded grounds must not silently un-pin one.
    await isocan("canvas", "background", "galaxy", "--canvas", "Ground");
    await isocan("canvas", "background", "--pinned", "--canvas", "Ground");
    await isocan("canvas", "background", "ocean", "--canvas", "Ground");
    expect(await props()).toEqual({ [THEME_PROP]: "ocean", [THEME_ANCHOR_PROP]: "window" });
  });

  it("is one ground at a time, in both directions", async () => {
    await isocan("canvas", "background", "galaxy", "--canvas", "Ground");
    await isocan("canvas", "background", "--picture", picture, "--canvas", "Ground");
    expect(Object.keys(await props())).toEqual([GROUND_PROP]);
    await isocan("canvas", "background", "none", "--canvas", "Ground");
    expect(await props()).toEqual({});
  });

  it("refuses to let a picture travel with the canvas", async () => {
    // #204 D2: a ground that repeats shows its own seams, and an unseamless
    // photograph is a grid of its own edges. Phase 4 opens this.
    await isocan("canvas", "background", "--picture", picture, "--canvas", "Ground");
    const moves = await isocan("canvas", "background", "--moves", "--canvas", "Ground");
    expect(moves.code).not.toBe(0);
    expect(moves.stderr).toContain("seams");
  });

  it("refuses a file that is not an image, and one that is too heavy", async () => {
    const notAPicture = path.join(work, "notes.md");
    await fs.writeFile(notAPicture, "# not a picture\n");
    const wrong = await isocan("canvas", "background", "--picture", notAPicture, "--canvas", "Ground");
    expect(wrong.code).not.toBe(0);
    expect(wrong.stderr).toContain("image");

    const heavy = path.join(work, "heavy.png");
    await fs.writeFile(heavy, Buffer.alloc(GROUND_MAX_BYTES + 1));
    const big = await isocan("canvas", "background", "--picture", heavy, "--canvas", "Ground");
    expect(big.code).not.toBe(0);
    // The refusal says the number AND why there is one — a limit with no
    // reason beside it reads as an arbitrary wall.
    expect(big.stderr).toContain(`${GROUND_MAX_BYTES / 1_000_000}MB`);
    expect(big.stderr).toContain("cold load");
    expect(await props(), "and it changed nothing").toEqual({});
  });

  it("refuses a picture and a named ground in one breath", async () => {
    const both = await isocan("canvas", "background", "galaxy", "--picture", picture, "--canvas", "Ground");
    expect(both.code).not.toBe(0);
    expect(both.stderr).toContain("pick one");
    expect(await props()).toEqual({});
  });
});
