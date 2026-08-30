import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { markerFile } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * **Scene 0's multi-device beat, played against the door.**
 *
 * Phase 6 shipped replicas and proved this by hand: a marker carried to a
 * second machine by git resolves against a replica that has never heard of
 * the canvas, and the second machine then shows the first machine's work.
 * Phase 7 puts a door in front of every one of those steps, and **the second
 * machine's badges are all brand new** — its daemon's badge at the home has
 * no admissions, and the CLI's badge on that machine has none either. What
 * lets both of them in is the standing **link grant**, at the home and in the
 * replica's own ledger, and nothing else does.
 *
 * **Phase 8 stage 4 changed WHEN that happens, not whether.** A replica no
 * longer enumerates its home, so nothing offers this machine the canvas any
 * more; the marker has to be spoken. The CLI speaks it — the binding resolves,
 * finds nothing here, and asks the daemon to fetch that one canvas by name.
 * The door test is the same one; what is gone is the machine helping itself to
 * a listing.
 *
 * So this is the regression that had to be verified rather than assumed. It
 * is a second `ISOCAN_HOME` whose only knowledge of the canvas is a copied
 * `.isocan/project.json` — the clone case, with two real daemons and the real
 * CLI, because what is under test is what three badges say to each other and
 * no in-process assertion would show it.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };

let upstreamDir: string;
let firstDir: string;
let secondDir: string;
let firstWork: string;
let secondWork: string;
let homeDaemon: Daemon;
let first: Daemon;
let second: Daemon | null;
let homeBase: string;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

const portOf = (daemon: Daemon) => Number(new URL(baseOf(daemon)).port);

async function machine(dir: string): Promise<Daemon> {
  await fs.writeFile(
    path.join(dir, "identity.json"),
    JSON.stringify({ ...priya, createdAt: new Date().toISOString() }),
  );
  return startDaemon({ port: await reservePort(), home: dir, birthHome: homeBase, homePollMs: 50 });
}

beforeEach(async () => {
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-2dev-home-"));
  firstDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-2dev-a-"));
  secondDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-2dev-b-"));
  firstWork = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-2dev-work-a-"));
  secondWork = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-2dev-work-b-"));
  homeDaemon = await startDaemon({ port: await reservePort(), home: upstreamDir, birthHome: null });
  homeBase = baseOf(homeDaemon);
  first = await machine(firstDir);
  second = null;
});

afterEach(async () => {
  await Promise.allSettled([second?.close(), first?.close()]);
  await homeDaemon.close();
  await Promise.allSettled(
    [upstreamDir, firstDir, secondDir, firstWork, secondWork].map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(cwd: string, home: string, port: number, session: Record<string, string>, ...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
  const child = spawn(process.execPath, [cliBin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn().catch(() => null as T | null);
    if (value !== null && ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("a second machine, holding nothing but the marker", () => {
  it("resolves the binding, replicates the canvas, and writes to it", async () => {
    // The first machine: a canvas born through a replica, so it is born AT
    // THE HOME, and a marker beside the directory naming id and address.
    const born = await cli(firstWork, firstDir, portOf(first), claude("s-1"), "identity", "--session");
    expect(born.code, born.stderr).toBe(0);
    const marker = JSON.parse(await fs.readFile(markerFile(firstWork), "utf8")) as {
      projectId: string;
      home: string;
    };
    expect(marker.home).toBe(homeBase);

    // Committed to git, cloned on the other machine — which here is a copy of
    // one file into a directory that knows nothing else.
    await fs.mkdir(path.join(secondWork, ".isocan"), { recursive: true });
    await fs.copyFile(markerFile(firstWork), markerFile(secondWork));

    // The second machine boots. Its daemon knocks on the home's door for a
    // badge that has never been admitted anywhere.
    second = await machine(secondDir);

    /**
     * **Nothing arrives on its own, and that is phase 8 stage 4's whole
     * point.**
     *
     * Until that stage this machine replicated the canvas before the CLI ever
     * ran: the daemon enumerated its home, the canvas's link grant would admit
     * anybody, so the listing offered it and the sweep dialled. That is
     * discovery by enumeration — the primitive phase 7 named wrong — and it is
     * also how a replica ended up mirroring a stranger's canvas because a link
     * happened to be on.
     *
     * So the replica now asks its home only what it was let INTO, and this
     * badge has been let into nothing. A settled beat of it holding nothing is
     * asserted rather than assumed: a replica that quietly pulled the canvas
     * down anyway would make the rest of this test pass for the old reason.
     */
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await second.engine.listCanvases()).toEqual([]);

    /**
     * **The marker is the hand-off, and the CLI is what speaks it.**
     *
     * A THIRD brand-new badge, minted at the replica's own door, resolves the
     * marker — finds the canvas is not here — and asks this machine's daemon
     * to fetch that one canvas from its home by name (`HOME_JOIN_ROUTE`). The
     * home runs the same door test it always ran, the link grant admits the
     * daemon's badge there, and the canvas replicates while the command waits.
     *
     * Scene 0's multi-device beat, with the discovery step made deliberate:
     * this machine holds what somebody put in this directory, and not the rest
     * of the home.
     */
    const read = await cli(secondWork, secondDir, portOf(second), claude("s-2"), "ls", "--json");
    expect(read.code, read.stderr).toBe(0);
    expect(read.stderr).not.toContain("not admitted");
    // Materializing would have meant a second `project.create` for an id the
    // home already holds; the binding landed on the existing canvas instead.
    expect(read.stderr).not.toContain("materialized");

    const listed = await second.engine.listCanvases();
    expect(listed.map((canvas: Canvas) => canvas.id)).toEqual([marker.projectId]);
    expect(listed[0]!.title).toBe(path.basename(firstWork));

    // A write from the second machine forwards to the home like any other,
    // and the door lets it: the daemon's badge was admitted when it dialled.
    const wrote = await cli(
      secondWork,
      secondDir,
      portOf(second),
      claude("s-2"),
      "canvas",
      "edit",
      "--title",
      "Acme Sprint Board",
    );
    expect(wrote.code, wrote.stderr).toBe(0);
    const atHome = await until(
      () => homeDaemon.engine.listCanvases(),
      (canvases) => canvases.some((canvas) => canvas.title === "Acme Sprint Board"),
      "the rename to reach the home",
    );
    expect(atHome.map((canvas) => canvas.id)).toEqual([marker.projectId]);
  }, 60_000);
});
