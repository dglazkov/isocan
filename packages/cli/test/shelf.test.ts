import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { mintTestBadge } from "./badge.ts";
import { reservePort } from "../../../test/ports.ts";

/**
 * **`isocan canvas archive`, and the list that has to tell them apart** (#194).
 *
 * The shelf shipped on both surfaces with core unit tests and nothing that ran
 * the verb — so the CLI half was a set of pure functions somebody believed the
 * commands were calling. Two things it turned out nobody had watched:
 *
 * 1. **`--with-archived` promised a column it never printed.** Its own help
 *    says *"both, with a column saying which"*, and the table it produced had
 *    no such column: a view widened to answer "which of these did I put away"
 *    answering with a shrug.
 * 2. **The default scope hides them from `--filter` too**, which is right, and
 *    is only right because `--with-archived --filter` reaches in. That pair is
 *    the CLI's whole answer to this issue's title, and neither half was held
 *    by anything.
 *
 * Run in direct mode — a scratch home over HTTP with no daemon and no replica
 * — because the shelf is a canvas property and none of this needs a machine to
 * have state. Cheap enough to run on every push, which is the point of putting
 * it here rather than in the journeys.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let homeDaemon: Daemon;
let homeStore: string;
let homePort: number;
let homeUrl: string;
let machine: string;
let work: string;

/** Never bound by anything here — direct mode must not start a daemon — but
 *  taken from the registry all the same: `afterEach` runs `stopDaemons` on it,
 *  and that kills whoever answers, so a hardcoded number is a way to end
 *  somebody else's process rather than your own (`test/ports.ts`). */
let directPort: number;

beforeEach(async () => {
  homeStore = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-away-home-"));
  machine = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-away-machine-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-away-work-"));
  homeDaemon = await startDaemon({ port: 0, home: homeStore });
  const address = homeDaemon.app.server.address();
  homePort = typeof address === "object" && address ? address.port : 0;
  homeUrl = `http://127.0.0.1:${homePort}`;
  directPort = await reservePort();
  await mintTestBadge(homeUrl);
  await isocan("identity", "--name", "Sonia");
  for (const title of ["Lake House", "Lab notes", "Roadmap"]) {
    const made = await isocan("canvas", "create", title);
    expect(made.code, made.stderr).toBe(0);
  }
});

afterEach(async () => {
  await homeDaemon.close();
  await stopDaemons(homePort, homeStore).catch(() => {});
  await stopDaemons(directPort, machine).catch(() => {});
  for (const dir of [homeStore, machine, work]) {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
      CLAUDE_CODE_SESSION_ID: "sonia-shelf",
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

/** The three this file made. Working in a fresh directory also mints one
 *  named after it, which is a fact about binding and not about the shelf —
 *  so every assertion below is about these, sorted, and nothing else. */
const MINE = ["Lab notes", "Lake House", "Roadmap"];

/** `--all` on every listing: `canvas list` scopes to the directory's own
 *  canvas, and naming the agent bound this directory to one of them. */
async function titles(...scope: string[]): Promise<string[]> {
  const listed = await isocan("--json", "canvas", "list", "--all", ...scope);
  expect(listed.code, listed.stderr).toBe(0);
  return (JSON.parse(listed.stdout) as Canvas[])
    .map((one) => one.title)
    .filter((title) => MINE.includes(title))
    .sort();
}

describe("putting a canvas away", () => {
  it("takes it out of the list and leaves the others", async () => {
    const away = await isocan("canvas", "archive", "Lab notes");
    expect(away.code, away.stderr).toBe(0);
    // The line says how to find it again and how to undo it: an archive
    // somebody cannot get back into is a delete with a friendlier word.
    expect(away.stdout).toContain("--archived");
    expect(away.stdout).toContain("--undo");
    expect(await titles()).toEqual(["Lake House", "Roadmap"]);
  });

  it("shows the shelf alone, and both together", async () => {
    await isocan("canvas", "archive", "Lab notes");
    expect(await titles("--archived")).toEqual(["Lab notes"]);
    expect(await titles("--with-archived")).toEqual(MINE.slice().sort());
  });

  it("says WHICH, when it shows both", async () => {
    /**
     * The promise in `--with-archived`'s own help. Read off the table a
     * person sees rather than the JSON, because the failure was that the
     * table did not carry it — `--json` has said `properties.shelved` all
     * along, and asserting that would have passed while the bug stood.
     */
    await isocan("canvas", "archive", "Lab notes");
    const both = await isocan("canvas", "list", "--all", "--with-archived");
    expect(both.code, both.stderr).toBe(0);
    const rowOf = (title: string) =>
      both.stdout.split("\n").find((line) => line.includes(title)) ?? "";
    expect(rowOf("Lab notes")).toContain("archived");
    expect(rowOf("Lake House")).not.toContain("archived");
  });

  it("prints no such column when every row would carry the same answer", async () => {
    // A column of one repeated value is a column that says nothing, and this
    // table is already five wide.
    await isocan("canvas", "archive", "Lab notes");
    expect((await isocan("canvas", "list", "--all")).stdout).not.toContain("SHELF");
    expect((await isocan("canvas", "list", "--all", "--archived")).stdout).not.toContain("SHELF");
    expect((await isocan("canvas", "list", "--all", "--with-archived")).stdout).toContain("SHELF");
  });

  it("brings it back, leaving nothing behind to say it was ever away", async () => {
    await isocan("canvas", "archive", "Lab notes");
    const back = await isocan("canvas", "archive", "Lab notes", "--undo");
    expect(back.code, back.stderr).toBe(0);
    expect(await titles()).toContain("Lab notes");
    // A removal, not a `shelved: ""` — otherwise the property becomes a
    // record of "was archived once", which is a fact nobody asked to keep.
    const shown = await isocan("--json", "canvas", "show", "Lab notes");
    expect(JSON.parse(shown.stdout).properties?.shelved).toBeUndefined();
  });

  it("refuses to undo one that is not away, and shrugs at archiving one twice", async () => {
    const nope = await isocan("canvas", "archive", "Roadmap", "--undo");
    expect(nope.code).not.toBe(0);
    expect(nope.stderr).toContain("not archived");
    await isocan("canvas", "archive", "Lab notes");
    const again = await isocan("canvas", "archive", "Lab notes");
    expect(again.code, again.stderr).toBe(0);
    expect(again.stdout).toContain("already archived");
  });

  it("changes visibility and nothing else", async () => {
    /* The decision the whole feature rests on: an archived canvas still takes
       ops and still answers at its address. If this ever fails, Archive has
       become a second kind of delete and needs a second kind of undo. */
    await isocan("canvas", "archive", "Lab notes");
    const shown = await isocan("--json", "canvas", "show", "Lab notes");
    expect(shown.code, shown.stderr).toBe(0);
    const renamed = await isocan("canvas", "edit", "Lab notes", "--description", "still working");
    expect(renamed.code, renamed.stderr).toBe(0);
    expect((await isocan("--json", "canvas", "show", "Lab notes")).stdout).toContain("still working");
  });
});

/**
 * **The search that can reach in** — the half of this issue's title the CLI
 * answers with a flag, and the web answers by ranking archived canvases under
 * every live match in the switcher (`core/canvasswitch.ts`).
 *
 * The default scope hiding them from `--filter` is the feature, not an
 * oversight: a filter is a narrowing of the list, and the list is the thing
 * the shelf exists to keep meaningful. It is only defensible because the pair
 * below reaches in, so both are asserted together.
 */
describe("finding one on the shelf", () => {
  it("is out of a plain filter, and found by one that asks", async () => {
    await isocan("canvas", "archive", "Lab notes");
    expect(await titles("--filter", "lab")).toEqual([]);
    expect(await titles("--with-archived", "--filter", "lab")).toEqual(["Lab notes"]);
    expect(await titles("--archived", "--filter", "lab")).toEqual(["Lab notes"]);
  });

  it("is still reachable by name without any flag at all", async () => {
    // Every other verb resolves a canvas over everything, and must: an agent
    // parked on a canvas somebody archived while it worked would otherwise
    // stop being able to name the canvas it is standing on.
    await isocan("canvas", "archive", "Lab notes");
    const shown = await isocan("--json", "canvas", "show", "Lab notes");
    expect(shown.code, shown.stderr).toBe(0);
    expect(JSON.parse(shown.stdout).title).toBe("Lab notes");
  });
});
