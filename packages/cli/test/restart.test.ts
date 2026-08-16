import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { stopDaemons } from "@isocan/server";

/**
 * Upgrading the CLI leaves the daemon behind: `ensureDaemon` only starts one
 * when the port is silent, so yesterday's build keeps serving until something
 * says otherwise. These drive the real binary against a real daemon.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let home: string;
let work: string;
let port: number;

/** A port nobody is on — these tests let the CLI spawn the daemon itself,
 * which is the path an upgrade actually walks. */
function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-restart-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-restart-work-"));
  port = await freePort();
});

afterEach(async () => {
  // In-process, and awaited: a detached daemon outliving the worker is how a
  // test run ends with "Channel closed" instead of a summary.
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/**
 * A daemon from ANOTHER copy of isocan, holding the port — what you get from
 * an npx cache directory, a global install, or a checkout, whichever ran last.
 * A real second copy on disk, not a mock: source is cheap to clone, and the
 * repo's node_modules is borrowed by symlink.
 *
 * (Simulating the other kind of staleness — same copy, newer code — by
 * touching a file in the repo would be simpler and is not worth it: Vite
 * watches those, and invalidating the module graph mid-run takes the test
 * workers down with it. `stalenessOf` owns that comparison in a unit test.)
 */
async function startOtherCopy(): Promise<{ root: string; stop: () => Promise<void> }> {
  const repo = fileURLToPath(new URL("../../..", import.meta.url));
  // realpath: on macOS os.tmpdir() is /var/… while a module resolves its own
  // location through /private/var/…, and the daemon reports the latter.
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-other-copy-")));
  await fs.cp(path.join(repo, "package.json"), path.join(root, "package.json"));
  for (const pkg of ["core", "server", "cli"]) {
    await fs.cp(path.join(repo, "packages", pkg), path.join(root, "packages", pkg), {
      recursive: true,
    });
  }
  await fs.symlink(path.join(repo, "node_modules"), path.join(root, "node_modules"));

  const daemon = spawn(
    process.execPath,
    [path.join(root, "packages/cli/bin/isocan.js"), "serve", "--foreground"],
    { env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) }, stdio: "ignore" },
  );
  const deadline = Date.now() + 15_000;
  for (;;) {
    const answering = await fetch(`http://127.0.0.1:${port}/healthz`)
      .then((r) => r.json() as Promise<{ root?: string }>)
      .catch(() => null);
    if (answering?.root === root) break;
    if (Date.now() > deadline) throw new Error("the other copy never came up");
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    root,
    stop: async () => {
      if (daemon.exitCode === null) daemon.kill("SIGKILL");
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

const status = async () => JSON.parse((await isocan("status", "--json")).stdout);

describe("restart", () => {
  it("replaces the running daemon with this build, and says which it is", async () => {
    await isocan("serve");
    const before = await status();
    expect(before.root).toMatch(/isocan$/); // it can name its own copy now
    expect(before.pid).toBeGreaterThan(0);

    const restarted = await isocan("restart", "--json");
    expect(restarted.code).toBe(0);
    const after = JSON.parse(restarted.stdout) as { stopped: number[]; pid: number };
    expect(after.stopped).toContain(before.pid);
    expect(after.pid).not.toBe(before.pid);
    expect((await status()).pid).toBe(after.pid);
  });

  it("works when nothing was running — it is also 'just start it'", async () => {
    const done = await isocan("restart", "--json");
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout).stopped).toEqual([]);
    expect((await status()).ok).toBe(true);
  });
});

describe("a daemon that outlived its build", () => {
  it("is reported by status, and warned about once — not on every command", async () => {
    const other = await startOtherCopy();
    try {
      expect((await status()).root).toBe(other.root);
      expect((await isocan("status")).stdout).toContain("stale");

      // The first command says so; the second stays quiet about the same daemon.
      const first = await isocan("project", "list");
      expect(first.stderr).toContain("isocan restart");
      const second = await isocan("project", "list");
      expect(second.stderr).not.toContain("isocan restart");

      // …until it is actually restarted, which clears the note.
      await isocan("restart");
      expect((await isocan("status")).stdout).not.toContain("stale");
      expect((await status()).root).not.toBe(other.root);
    } finally {
      await other.stop();
    }
  }, 30_000);

  it("setup restarts it rather than reporting it — that is setup's job", async () => {
    const other = await startOtherCopy();
    try {
      const before = await status();
      const report = JSON.parse(
        (await isocan("setup", "--no-install", "--no-open", "--json")).stdout,
      ) as Record<string, string>;

      expect(report.restarted).toContain("another copy");
      const after = await status();
      expect(after.pid).not.toBe(before.pid);
      expect(after.root).not.toBe(other.root);
    } finally {
      await other.stop();
    }
  }, 30_000);
});
