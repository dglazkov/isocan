import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, stopDaemons } from "@isocan/server";

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

function setup(): Promise<{ code: number; stdout: string }> {
  const child = spawn(process.execPath, [npxBin, "setup", "--no-install", "--no-open", "--json"], {
    cwd: work,
    env: {
      ...process.env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: String(port),
      PATH: `${path.dirname(durableBin)}${path.delimiter}${process.env.PATH ?? ""}`,
    },
    stdio: ["ignore", "pipe", "ignore"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout })),
  );
}

const health = (): Promise<{ root?: string }> =>
  fetch(`http://127.0.0.1:${port}/healthz`).then((r) => r.json() as Promise<{ root?: string }>);

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
