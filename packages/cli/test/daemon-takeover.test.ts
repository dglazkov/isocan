import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { reservePort } from "../../../test/ports.ts";

/**
 * The stale daemon: a process that outlives the code it was started from,
 * answering happily on the port while you talk to last week's server. These
 * tests are about never having to know its pid — starting takes the port,
 * and stopping asks the port who it is rather than trusting the pidfile.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

let home: string;
let port: number;
/** The daemon standing in the way — a real process, on the real port. */
let squatter: ChildProcess | null;
let mine: Daemon | null;

/** What the last probe saw, so a timeout can say which of the three it was:
 * nothing listening, something listening that is not ours, or ours but slow. */
let lastProbe = "not probed yet";

async function health(): Promise<{ pid: number } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) {
      lastProbe = `something on ${port} answered /healthz with ${res.status}`;
      return null;
    }
    const body = (await res.json()) as { pid: number };
    lastProbe = `pid ${body.pid} answering on ${port}`;
    return body;
  } catch (err) {
    lastProbe = `nothing answered on ${port} (${(err as Error).name}: ${(err as Error).message})`;
    return null;
  }
}

/**
 * Poll, and FAIL WITH THE EVIDENCE.
 *
 * The old version said "timed out waiting for the squatting daemon" and
 * nothing else, which is the same sentence for a machine under load, a port
 * somebody else took, and a daemon that crashed on startup — so the only
 * available response was to run it again and see. A flake nobody can explain
 * is a flake everybody learns to re-run past, and that habit costs more than
 * the flake. Every wait here now reports how long it waited, what the last
 * probe saw, and whether the process it was waiting for is even alive.
 */
async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const started = Date.now();
  const deadline = started + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    // A process that has already exited is never going to answer; waiting the
    // full ten seconds for it only delays the same news.
    const dead = squatter !== null && (squatter.exitCode !== null || squatter.signalCode !== null);
    if (dead || Date.now() > deadline) {
      throw new Error(
        `${dead ? "gave up" : "timed out"} after ${Date.now() - started}ms waiting for ${what}\n` +
          `  last probe: ${lastProbe}\n` +
          `  squatter:   ${describeSquatter()}`,
      );
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

function describeSquatter(): string {
  if (!squatter) return "none spawned";
  if (squatter.exitCode !== null || squatter.signalCode !== null) {
    return `pid ${squatter.pid} already exited (code ${squatter.exitCode}, signal ${squatter.signalCode})${
      squatterErr ? ` — stderr: ${squatterErr.trim().slice(-500)}` : " — no stderr"
    }`;
  }
  return `pid ${squatter.pid} still running`;
}

/** Whatever the spawned daemon complained about. `stdio: "ignore"` threw this
 * away, which is why a startup failure looked exactly like a slow machine. */
let squatterErr = "";

/** Start a daemon in its own process and wait for it to answer. */
function spawnSquatter(extraEnv: Record<string, string> = {}): ChildProcess {
  squatterErr = "";
  const child = spawn(process.execPath, [cliBin, "serve", "--foreground"], {
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ...extraEnv },
    cwd: home,
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr?.on("data", (chunk) => (squatterErr += chunk));
  return child;
}

async function startSquatter(): Promise<number> {
  squatter = spawnSquatter();
  const answered = await until(health, (h) => h !== null, "the squatting daemon");
  // Not just "somebody answered": the daemon on the port must be the process
  // we started. Anything else means the port was taken from under us, and
  // saying so here is cheaper than the afterEach killing a stranger's daemon.
  expect(answered!.pid, `${lastProbe} — but the squatter is pid ${squatter.pid}`).toBe(squatter.pid);
  return squatter.pid!;
}

const exited = (child: ChildProcess) =>
  new Promise<void>((resolve) => (child.exitCode !== null ? resolve() : child.once("exit", () => resolve())));

function isocan(...args: string[]): Promise<{ code: number; stdout: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
    // Not the repo root — see wait.test.ts: a directory identity outranks
    // the home identity these tests write.
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout })),
  );
}

const pidfile = () => path.join(home, "daemon.json");

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-takeover-"));
  port = await reservePort();
  squatter = null;
  mine = null;
});

afterEach(async () => {
  if (mine) await mine.close();
  await stopDaemons(port, home).catch(() => {});
  if (squatter && squatter.exitCode === null) squatter.kill("SIGKILL");
  await fs.rm(home, { recursive: true, force: true });
});

describe("taking the port from a stale daemon", () => {
  it("stopDaemons kills whoever answers on the port, pidfile or no pidfile", async () => {
    const pid = await startSquatter();
    // The pidfile is how `stop` used to find it — take it away.
    await fs.rm(pidfile(), { force: true });

    const stopped = await stopDaemons(port, home);

    expect(stopped).toEqual([pid]);
    await exited(squatter!);
    expect(await health()).toBeNull();
  }, 30_000);

  it("runDaemon --takeover serves where a stale daemon was", async () => {
    const stale = await startSquatter();

    mine = await runDaemon({ takeover: true, port, home, notify: () => {} });

    await exited(squatter!);
    const answering = await health();
    expect(answering?.pid).toBe(process.pid);
    expect(answering?.pid).not.toBe(stale);
  }, 30_000);

  it("a pidfile naming a dead process is cleaned up, not obeyed", async () => {
    // A pid that is gone (and might have been recycled by anything) is not a
    // licence to kill: nothing is on the port, so there is nothing to stop.
    await fs.writeFile(pidfile(), JSON.stringify({ pid: 999_999, port, startedAt: "" }));

    expect(await stopDaemons(port, home)).toEqual([]);

    await expect(fs.readFile(pidfile(), "utf8")).rejects.toThrow();
  }, 30_000);

  it("`isocan stop` stops a daemon whose pidfile went missing", async () => {
    const pid = await startSquatter();
    await fs.rm(pidfile(), { force: true });

    const stopped = await isocan("stop");

    expect(stopped.code).toBe(0);
    expect(stopped.stdout).toContain(`stopped daemon ${pid}`);
    await exited(squatter!);
    expect(await health()).toBeNull();
  }, 30_000);

  it("`isocan serve --force` replaces the daemon that is there", async () => {
    const stale = await startSquatter();

    const served = await isocan("serve", "--force");

    expect(served.code).toBe(0);
    expect(served.stdout).toContain(`stopped daemon ${stale}`);
    await exited(squatter!);
    const answering = await until(health, (h) => h !== null, "the replacement daemon");
    expect(answering!.pid).not.toBe(stale);
  }, 30_000);

  it("`isocan serve` without --force leaves a healthy daemon alone", async () => {
    const pid = await startSquatter();

    const served = await isocan("serve");

    expect(served.stdout).toContain("already running");
    expect((await health())?.pid).toBe(pid);
  }, 30_000);
});

describe("a daemon that was told whose fate it shares", () => {
  /**
   * A process that does nothing but exist, so we can take it away. It watches
   * for being orphaned on the same terms this suite's workers do: a stand-in
   * for a killed run must not become the thing that survives one.
   */
  function bystander(): ChildProcess {
    const doNothing = "setInterval(() => process.ppid === 1 && process.kill(process.pid), 250)";
    return spawn(process.execPath, ["-e", doNothing], { stdio: "ignore" });
  }

  it("stops when the process named by ISOCAN_DAEMON_GUARD_PID is gone", async () => {
    const guard = bystander();
    squatter = spawnSquatter({ ISOCAN_DAEMON_GUARD_PID: String(guard.pid) });
    await until(health, (h) => h !== null, "the guarded daemon");

    // Nobody stops the daemon: the process it was told to die with just dies,
    // which is what a killed test run looks like from down here.
    guard.kill("SIGKILL");

    await exited(squatter);
    expect(await health()).toBeNull();
  }, 30_000);

  it("keeps serving while that process is alive", async () => {
    const guard = bystander();
    try {
      squatter = spawnSquatter({ ISOCAN_DAEMON_GUARD_PID: String(guard.pid) });
      const up = await until(health, (h) => h !== null, "the guarded daemon");

      await new Promise((r) => setTimeout(r, 2500)); // several checks' worth

      expect((await health())?.pid).toBe(up!.pid);
    } finally {
      guard.kill("SIGKILL");
    }
  }, 30_000);
});
