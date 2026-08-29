import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopDaemons } from "@isocan/server";
import { reservePort } from "../../../test/ports.ts";

/**
 * Upgrading the CLI leaves the daemon behind: `ensureDaemon` only starts one
 * when the port is silent, so yesterday's build keeps serving until something
 * says otherwise. These drive the real binary against a real daemon.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let home: string;
let work: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-restart-home-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-restart-work-"));
  port = await reservePort();
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
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
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
  const started = Date.now();
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

  const copied = Date.now() - started;

  const daemon = spawn(
    process.execPath,
    [path.join(root, "packages/cli/bin/isocan.js"), "serve", "--foreground"],
    {
      env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
      // NOT `stdio: "ignore"`. That threw away the one thing that could tell a
      // slow machine from a daemon that crashed on startup, and this test has
      // failed both ways.
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let complaint = "";
  daemon.stderr?.setEncoding("utf8");
  daemon.stderr?.on("data", (chunk) => (complaint += chunk));

  /**
   * **Wait, and fail with the evidence.**
   *
   * This said `the other copy never came up` and nothing else — the same
   * sentence for a loaded machine, a port somebody else took, and a daemon
   * that died before it bound. It failed one full run of the suite on
   * 2026-08-24 and the only available response was to run it again, which is
   * the habit lessons.md exists to stop. `daemon-takeover.test.ts` had already
   * learned this and written it down; this file was the copy that never got
   * the fix.
   *
   * The budget is 25s rather than 15s, and it is chosen from the same
   * measurement `vitest.config.ts` records: under load this suite runs 90
   * tests over 2500ms and the slowest over 14s, and this helper does a
   * recursive copy of three packages before it even spawns. 25s stays inside
   * vitest's 30s so the failure carries this message rather than the runner's.
   * And a copy that has already exited fails NOW, because waiting out the
   * budget for a dead process only delays the same news.
   */
  const deadline = Date.now() + 25_000;
  let lastProbe = "nothing probed yet";
  for (;;) {
    const answering = await fetch(`http://127.0.0.1:${port}/healthz`)
      .then(async (r) => {
        const body = (await r.json()) as { root?: string };
        lastProbe = `port ${port} answered ${r.status} from root ${body.root ?? "(none)"}`;
        return body;
      })
      .catch((err: Error) => {
        lastProbe = `nothing answered on ${port} (${err.name}: ${err.message})`;
        return null;
      });
    if (answering?.root === root) break;
    const dead = daemon.exitCode !== null || daemon.signalCode !== null;
    if (dead || Date.now() > deadline) {
      throw new Error(
        `${dead ? "gave up" : "timed out"} after ${Date.now() - started}ms waiting for the ` +
          `other copy of isocan to answer (${copied}ms of that was copying it)\n` +
          `  wanted root: ${root}\n` +
          `  last probe:  ${lastProbe}\n` +
          `  other copy:  ${
            dead
              ? `pid ${daemon.pid} exited (code ${daemon.exitCode}, signal ${daemon.signalCode})`
              : `pid ${daemon.pid} still running`
          }\n` +
          `  its stderr:  ${complaint.trim().slice(-800) || "(silent)"}`,
      );
    }
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
    // It can name its own copy now — and the assertion is THIS copy rather
    // than `/isocan$/`, which was a claim about the checkout's directory name.
    // That passes here and fails in a `git worktree`, in a clone called
    // `isocan-fork`, and in the tarball CI unpacks — a red suite about
    // nothing, in the one place a red suite is most expensive to read.
    // Comparing against the resolved repo root is stronger AND portable: it
    // says the daemon is running from the tree the test is running from, which
    // is the thing this file is about.
    expect(before.root).toBe(await fs.realpath(fileURLToPath(new URL("../../..", import.meta.url))));
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
      const first = await isocan("canvas", "list");
      expect(first.stderr).toContain("isocan restart");
      const second = await isocan("canvas", "list");
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
