import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Canvas } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { findBinding, markerFile, writeMarker } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * **The marker carries the address.**
 *
 * `offline-birth.md`'s "birth writes a promise": the committed
 * `.isocan/project.json` names the canvas AND the home it lives at, from the
 * first minute, whether or not the home has heard of it yet. That is what lets
 * a clone know where the canvas is, and it is the fact `readMarker` has to
 * tolerate the absence of — every marker written before phase 6 lacks it.
 *
 * The other half is what happens when the marker names a home this machine has
 * not got. **Phase 10.3 split that into two different answers, and the split
 * is the phase.**
 *
 * - A marker naming a home this machine has never recorded anything about is
 *   the GOOD case: it is a clone, and it must be joined rather than refused.
 *   The daemon opens a link to that address, is tested at its door, and writes
 *   the row. When the address does not answer, the honest report is "nobody was
 *   home" — and the one thing it must never be is a canvas quietly created
 *   here under that id, which would be a twin.
 * - A marker that disagrees with what this machine has already RECORDED about
 *   that canvas is the refusal, and it is the only one left. Moving a canvas
 *   between homes is **re-homing**, which is phase 13's and carries the work
 *   but not the desk; nothing here migrates anything, and the refusal names
 *   both addresses because the interesting question is always which one is the
 *   surprise.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let homeDir: string;
let upstreamDir: string;
let work: string;
let home: Daemon;
let replica: Daemon;
let homeBase: string;
let port: number;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rehome-replica-"));
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rehome-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rehome-work-"));
  await fs.writeFile(
    path.join(homeDir, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  home = await startDaemon({ port: await reservePort(), home: upstreamDir, birthHome: null });
  homeBase = baseOf(home);
  replica = await startDaemon({
    port: await reservePort(),
    home: homeDir,
    birthHome: homeBase,
    homePollMs: 50,
  });
  port = Number(new URL(baseOf(replica)).port);
});

afterEach(async () => {
  await replica.close();
  await home.close();
  await Promise.allSettled(
    [homeDir, upstreamDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(cwd: string, session: Record<string, string>, ...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: homeDir, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

async function marker(dir: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(markerFile(dir), "utf8")) as Record<string, unknown>;
}

async function atHome(): Promise<Canvas[]> {
  return home.engine.listCanvases();
}

describe("a canvas born on a replica is stamped with its home", () => {
  it("writes the address into the marker, and is really born there", async () => {
    const run = await cli(work, claude("s-1"), "identity", "--session");
    expect(run.code, run.stderr).toBe(0);

    const written = await marker(work);
    expect(written.projectId).toMatch(/^prj_/);
    expect(written.home).toBe(homeBase);

    // And it exists AT THE HOME — not because anything pushed it afterwards,
    // but because the write that created it forwarded. That is the phase's
    // claim about birth, checked against the home's own store.
    const there = await atHome();
    expect(there.map((canvas) => canvas.id)).toEqual([written.projectId]);
  }, 30_000);

  it("says on `status` which of the two things the daemon is", async () => {
    const run = await cli(work, {}, "status", "--json");
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout).home).toBe(homeBase);
  }, 30_000);
});

describe("a marker naming a home this machine has never been to", () => {
  it("is attempted, and an unreachable home is named — nothing is created here", async () => {
    /**
     * This scenario used to be the refusal, and it is not one any more. A
     * marker naming an address this daemon does not answer to was *"re-homing,
     * and it is not something a command does by accident"* — a sentence that
     * only made sense while a daemon had one home. Now it is a clone arriving,
     * and the right answer is to go and ask.
     *
     * So what is asserted is the honest failure of the ask: this address does
     * not resolve, it is NAMED, and — the half that matters — the canvas is
     * not created here instead. That fall-through used to be unreachable
     * because the refusal fired first; now it is reachable, and what stops it
     * is a guard rather than an accident (`refuseOfflineBirth`). Minting a
     * canvas locally under an id whose committed marker promises another home
     * is offline birth of a twin, which is phase 13's.
     */
    await writeMarker(work, {
      canvasId: "prj_elsewhere",
      title: "Acme Sprint Board",
      home: "https://other.invalid",
    });

    // `ls` reads; `comment add` is a command that CREATES, which is the one
    // that would have materialized the twin.
    for (const args of [["ls"], ["comment", "add", "hello", "--at", "0,0"]]) {
      const run = await cli(work, claude("s-1"), ...args);
      expect(run.code, args.join(" ")).not.toBe(0);
      expect(run.stderr).toContain("https://other.invalid");
      expect(run.stderr).toMatch(/did not answer|cannot reach/i);
      expect(run.stderr).toMatch(/nothing was created/i);
    }

    // Nothing anywhere: not at the home this machine does have, and not here.
    expect(await atHome()).toEqual([]);
    expect(await replica.engine.listCanvases()).toEqual([]);
  }, 30_000);
});

describe("a marker that disagrees with what this machine recorded", () => {
  it("is refused, naming both addresses, and nothing is migrated", async () => {
    /**
     * The refusal, in the form phase 10.3 leaves it: not marker-against-daemon
     * but **marker-against-record**. This machine has been to H1 for this
     * canvas and wrote that down; the marker in the working tree says H2. An
     * edited marker, two clones that disagree, a canvas re-homed while this
     * checkout slept — whichever it is, both cannot be true, and the one thing
     * that must not happen is a command picking a side and migrating work.
     *
     * This is design §9's assertion (c) at the CLI level, and its load-bearing
     * half is the last two lines: **neither home's canvas list changes**.
     */
    const second = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rehome-second-"));
    const otherHome = await startDaemon({ port: await reservePort(), home: second, birthHome: null });
    try {
      const h2 = baseOf(otherHome);

      // A canvas born here goes to H1 (this replica's birth default), and the
      // daemon records it there — that is the row the marker will contradict.
      const born = await cli(work, claude("s-1"), "identity", "--session");
      expect(born.code, born.stderr).toBe(0);
      const written = await marker(work);
      expect(written.home).toBe(homeBase);
      const canvasId = written.projectId as string;
      const atH1 = (await atHome()).map((p) => p.id);
      expect(atH1).toEqual([canvasId]);

      // Somebody rewrites the address in the committed file. Same canvas id;
      // a different home.
      await writeMarker(work, {
        canvasId,
        title: "Acme Sprint Board",
        home: h2,
      });

      const run = await cli(work, claude("s-1"), "comment", "add", "no", "--at", "0,0");
      expect(run.code).not.toBe(0);
      expect(run.stderr).toContain(h2);
      expect(run.stderr).toContain(homeBase);
      expect(run.stderr).toMatch(/re-homing/i);

      // Nothing moved. H1 still holds exactly what it held, and H2 — which the
      // marker claims is the home — was never asked to make anything.
      expect((await atHome()).map((p) => p.id)).toEqual(atH1);
      expect(await otherHome.engine.listCanvases()).toEqual([]);
    } finally {
      await otherHome.close();
      await fs.rm(second, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("what readMarker will accept", () => {
  it("tolerates a marker with no home at all — every marker in the wild", async () => {
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(
      markerFile(work),
      JSON.stringify({ projectId: "prj_old", title: "Acme Sprint Board" }),
    );
    const found = await findBinding(work, homeDir);
    expect(found).toMatchObject({ canvasId: "prj_old", title: "Acme Sprint Board" });
    expect(found!.home).toBeUndefined();
  });

  it("reads the committed spelling, and writes it back", async () => {
    // The marker's on-disk key stayed `projectId` through phase 13.5's rename
    // precisely because it lives in other people's repos. Both halves matter:
    // an old committed marker still resolves, and a marker this build writes
    // is still readable by an isocan that predates the rename.
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(markerFile(work), JSON.stringify({ projectId: "prj_committed" }));
    expect((await findBinding(work, homeDir))!.canvasId).toBe("prj_committed");

    await writeMarker(work, { canvasId: "prj_written", title: "Acme Sprint Board" });
    expect(await marker(work)).toMatchObject({ projectId: "prj_written" });
    expect((await findBinding(work, homeDir))!.canvasId).toBe("prj_written");
  });

  it("also accepts the new spelling, so a future marker is not a dead file", async () => {
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(markerFile(work), JSON.stringify({ canvasId: "prj_future" }));
    expect((await findBinding(work, homeDir))!.canvasId).toBe("prj_future");
  });

  it("rejects a malformed home the way it rejects a malformed canvasId", async () => {
    // Ignoring it would turn "this canvas lives at the address I cannot read"
    // into "this canvas lives wherever you are", quietly — which is the one
    // wrong answer available here.
    for (const home of [42, "", "   ", null, { url: "x" }]) {
      await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
      await fs.writeFile(markerFile(work), JSON.stringify({ projectId: "prj_x", home }));
      expect(await findBinding(work, homeDir), `home=${JSON.stringify(home)}`).toBeNull();
    }
  });
});
