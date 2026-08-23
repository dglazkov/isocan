import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { findBinding, markerFile, writeMarker } from "../src/binding.ts";
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
 * The other half is the refusal. A marker naming a home this daemon does not
 * answer to is **re-homing**, which is phase 13's and moves the work but not
 * the desk; nothing here migrates anything, and the refusal names both
 * addresses because the interesting question is always which one is the
 * surprise.
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
  home = await startDaemon({ port: 0, home: upstreamDir, homeUrl: null });
  homeBase = baseOf(home);
  replica = await startDaemon({
    port: 0,
    home: homeDir,
    homeUrl: homeBase,
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

async function atHome(): Promise<Project[]> {
  return home.engine.listProjects();
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
    expect(there.map((project) => project.id)).toEqual([written.projectId]);
  }, 30_000);

  it("says on `status` which of the two things the daemon is", async () => {
    const run = await cli(work, {}, "status", "--json");
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout).home).toBe(homeBase);
  }, 30_000);
});

describe("a marker naming another home", () => {
  it("is refused, naming both addresses, and nothing is migrated", async () => {
    await writeMarker(work, {
      projectId: "prj_elsewhere",
      title: "Acme Sprint Board",
      home: "https://other.invalid",
    });

    const run = await cli(work, claude("s-1"), "ls");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("https://other.invalid");
    expect(run.stderr).toContain(homeBase);
    expect(run.stderr).toMatch(/re-homing/i);

    // Refused means refused: no canvas was created anywhere, on either side.
    expect(await atHome()).toEqual([]);
    expect(await replica.engine.listProjects()).toEqual([]);
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
    expect(found).toMatchObject({ projectId: "prj_old", title: "Acme Sprint Board" });
    expect(found!.home).toBeUndefined();
  });

  it("rejects a malformed home the way it rejects a malformed projectId", async () => {
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
