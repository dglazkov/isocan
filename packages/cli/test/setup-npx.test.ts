import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";

/**
 * Bootstrapping through npx, and what the next command finds (#48).
 *
 * `npx github:dglazkov/isocan#release setup` runs from a cache directory npm
 * deletes when the command ends. Two things went wrong there: `which isocan`
 * found that copy and setup reported "already on PATH" without installing
 * anything, and the daemon it started belonged to the cache — so the CLI you
 * did eventually install called that daemon stale and you had to restart it
 * by hand.
 *
 * This drives the real thing: a copy of the CLI living under an `_npx` path,
 * with a durable copy on PATH, exactly as a bootstrap leaves the machine.
 */

const repo = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

let home: string;
let work: string;
let cache: string;
let npxBin: string;
let durableBin: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-npx-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-npx-work-"));
  cache = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-npx-"));

  // The transient copy: the CLI's sources under a path npm would delete. Its
  // dependencies come from this checkout, the way npx's copy has its own.
  const npxRoot = path.join(cache, "_npx", "605520e755a722a9", "node_modules", "isocan");
  await fs.mkdir(npxRoot, { recursive: true });
  for (const pkg of ["core", "server", "cli"]) {
    await fs.cp(path.join(repo, "packages", pkg), path.join(npxRoot, "packages", pkg), {
      recursive: true,
    });
  }
  await fs.cp(path.join(repo, ".agents"), path.join(npxRoot, ".agents"), { recursive: true });
  await fs.symlink(path.join(repo, "node_modules"), path.join(npxRoot, "node_modules"));
  npxBin = path.join(npxRoot, "packages", "cli", "bin", "isocan.js");

  // The durable copy, as `npm i -g` leaves it: a symlink on PATH into a tree
  // that is still there tomorrow.
  const bin = path.join(cache, "bin");
  await fs.mkdir(bin);
  durableBin = path.join(bin, "isocan");
  await fs.symlink(path.join(repo, "packages", "cli", "bin", "isocan.js"), durableBin);

  // A port nobody holds: take one, then let it go.
  const scout = await startDaemon({ port: 0, home });
  const address = scout.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  await scout.close();
  await stopDaemons(port, home).catch(() => {});
});

afterEach(async () => {
  await stopDaemons(port, home).catch(() => {});
  for (const dir of [home, work, cache]) await fs.rm(dir, { recursive: true, force: true });
});

function setup(extraEnv: Record<string, string> = {}): Promise<{
  code: number;
  stdout: string;
}> {
  const child = spawn(process.execPath, [npxBin, "setup", "--no-install", "--no-open", "--json"], {
    cwd: work,
    env: {
      ...process.env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: String(port),
      PATH: `${path.dirname(durableBin)}${path.delimiter}${process.env.PATH ?? ""}`,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "ignore"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout })),
  );
}

const health = (): Promise<{ root?: string; home?: string }> =>
  fetch(`http://127.0.0.1:${port}/healthz`).then(
    (r) => r.json() as Promise<{ root?: string; home?: string }>,
  );

describe("setup, bootstrapped through npx", () => {
  it("hands the daemon to the copy that will still be here tomorrow", async () => {
    const done = await setup();
    expect(done.code).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;

    // Not the cache directory this command ran from: that daemon dies with
    // the cache, and every later command would call it stale.
    const running = await health();
    expect(await fs.realpath(running.root!)).toBe(await fs.realpath(repo));
    expect(report.restarted).toContain("installed copy");
    expect(report.app).toBe(`http://127.0.0.1:${port}`);
  });

  it("reports the durable copy on PATH, never the one it is running from", async () => {
    const report = JSON.parse((await setup()).stdout) as Record<string, string>;
    expect(report.cli).toContain(durableBin);
    expect(report.cli).not.toContain("_npx");
  });
});

/**
 * **Phase 14's flip, and the only place the suite can see it.**
 *
 * `isocan setup` on a machine that has never held a canvas writes the shipped
 * default home into `config.json`, so Scene 0's Priya makes her first canvas
 * at the hosted home rather than trapping it on her laptop. The CLI suppresses
 * that when it is running from a checkout — which every other test in this
 * repo is — so this file is where it can be proved: the npx fixture above is a
 * copy of the CLI living OUTSIDE the checkout, which is what a stranger's
 * `npx` actually runs.
 *
 * The address is `ISOCAN_DEFAULT_HOME`, pointed at a second daemon started
 * here rather than at `https://isocan.io`. What is under test is the RULE —
 * who gets flipped, who is left alone, what the person is told — and a test
 * that dialled the real production home would be measuring somebody else's
 * uptime.
 */
describe("the default home a fresh machine gets", () => {
  let elsewhere: Daemon;
  let elsewhereHome: string;
  let elsewhereUrl: string;

  beforeEach(async () => {
    elsewhereHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-npx-elsewhere-"));
    elsewhere = await startDaemon({ port: 0, home: elsewhereHome, birthHome: null });
    const address = elsewhere.app.server.address();
    const at = typeof address === "object" && address ? address.port : 0;
    elsewhereUrl = `http://127.0.0.1:${at}`;
  });

  afterEach(async () => {
    await elsewhere.close();
    await fs.rm(elsewhereHome, { recursive: true, force: true });
  });

  it("writes it on a machine that has never held a canvas, and says so", async () => {
    const report = JSON.parse((await setup({ ISOCAN_DEFAULT_HOME: elsewhereUrl })).stdout) as Record<
      string,
      string
    >;

    // The receipt: where canvases go now, and the one command back.
    expect(report.home).toBe(elsewhereUrl);
    expect(report.birth).toContain(elsewhereUrl);
    expect(report.birth).toContain("isocan home --clear");

    // Written down, and the daemon restarted onto it — a config file the
    // running daemon has not read is a setting nobody has.
    const config = JSON.parse(await fs.readFile(path.join(home, "config.json"), "utf8"));
    expect(config.home).toBe(elsewhereUrl);
    expect((await health()).home).toBe(elsewhereUrl);
  });

  it("leaves a machine that already holds a canvas alone", async () => {
    // Somebody who has been working locally: their next canvas stays here
    // until they say otherwise. Silently sending it to a hosted home would be
    // the upgrade-day behaviour change this default refuses to make.
    await fs.mkdir(path.join(home, "projects", "prj_alreadyhere"), { recursive: true });

    const report = JSON.parse((await setup({ ISOCAN_DEFAULT_HOME: elsewhereUrl })).stdout) as Record<
      string,
      string
    >;
    expect(report).not.toHaveProperty("birth");
    await expect(fs.readFile(path.join(home, "config.json"), "utf8")).rejects.toThrow();
    expect((await health()).home).toBeUndefined();
  });

  it("stays local, and says why, when the default home does not answer", async () => {
    // A first run on a laptop with no network must still leave a working local
    // daemon. The refusal is a line in the report, not an exit code.
    await elsewhere.close();
    const done = await setup({ ISOCAN_DEFAULT_HOME: elsewhereUrl });
    expect(done.code).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;
    expect(report.birth).toContain("stay on this machine");
    expect(report.app).toBe(`http://127.0.0.1:${port}`);
    expect((await health()).home).toBeUndefined();
  });
});
