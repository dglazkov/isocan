import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDaemon, stopDaemons, type Daemon } from "@isocan/server";

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

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

async function health(): Promise<{ pid: number } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(500),
    });
    return res.ok ? ((await res.json()) as { pid: number }) : null;
  } catch {
    return null;
  }
}

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Start a daemon in its own process and wait for it to answer. */
async function startSquatter(): Promise<number> {
  squatter = spawn(process.execPath, [cliBin, "serve", "--foreground"], {
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
    cwd: home,
    stdio: "ignore",
  });
  const answered = await until(health, (h) => h !== null, "the squatting daemon");
  expect(answered!.pid).toBe(squatter.pid);
  // And not merely answering: the pidfile WRITTEN. `startDaemon` binds the port
  // before it writes `daemon.json`, so a test that took the pidfile away the
  // moment health answered was sometimes deleting a file that had not been
  // written yet — and then the daemon wrote it, and the test that says
  // "pidfile or no pidfile" quietly ran the pidfile case instead. It still
  // passed, which is the worst kind of race: it costs coverage, not runs.
  await until(
    () => fs.readFile(pidfile(), "utf8").then(() => true, () => false),
    (there) => there,
    "the squatting daemon's pidfile",
  );
  return squatter.pid!;
}

/**
 * Resolve once this child is gone — asking whether it is gone, not whether it
 * is gone THE ONE WAY.
 *
 * `exitCode !== null` is only half the question: a process killed by a signal
 * has `exitCode === null` and `signalCode === "SIGKILL"`. Every caller here
 * runs after `stopDaemons`, which does not come back until the pid has left the
 * process table — so by the time this is called the `exit` event has ALREADY
 * been delivered, and testing `exitCode` alone read a SIGKILLed daemon as still
 * running and then waited for an event that was never coming again. Forever, in
 * a test whose only ceiling was vitest's 30s: `Test timed out in 30000ms`.
 *
 * Which is intermittent for a reason that is not mysterious once named: the
 * SIGKILL branch is only reached when the daemon takes longer than
 * `stopDaemons`' three-second grace to honour SIGTERM, and on an idle machine
 * it never does. Under a full parallel suite it sometimes does.
 *
 * The ceiling below is generous and exists only so that a daemon which really
 * will not die says so, instead of arriving as a bare timeout on the test.
 */
const exited = (child: ChildProcess, ceilingMs = 15_000) =>
  new Promise<void>((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const ceiling = setTimeout(
      () => reject(new Error(`daemon ${child.pid} was still running after ${ceilingMs}ms`)),
      ceilingMs,
    );
    child.once("exit", () => {
      clearTimeout(ceiling);
      resolve();
    });
  });

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
  port = await freePort();
  squatter = null;
  mine = null;
});

afterEach(async () => {
  if (mine) await mine.close();
  await stopDaemons(port, home).catch(() => {});
  // Both halves of "has it exited", for the reason `exited` above spells out:
  // a squatter that stopDaemons had to SIGKILL has a null exitCode and would
  // otherwise be signalled again here, on a pid that is no longer its own.
  if (squatter && squatter.exitCode === null && squatter.signalCode === null) {
    squatter.kill("SIGKILL");
  }
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
    squatter = spawn(process.execPath, [cliBin, "serve", "--foreground"], {
      env: {
        ...process.env,
        ISOCAN_HOME: home,
        ISOCAN_PORT: String(port),
        ISOCAN_DAEMON_GUARD_PID: String(guard.pid),
      },
      cwd: home,
      stdio: "ignore",
    });
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
      squatter = spawn(process.execPath, [cliBin, "serve", "--foreground"], {
        env: {
          ...process.env,
          ISOCAN_HOME: home,
          ISOCAN_PORT: String(port),
          ISOCAN_DAEMON_GUARD_PID: String(guard.pid),
        },
        cwd: home,
        stdio: "ignore",
      });
      const up = await until(health, (h) => h !== null, "the guarded daemon");

      await new Promise((r) => setTimeout(r, 2500)); // several checks' worth

      expect((await health())?.pid).toBe(up!.pid);
    } finally {
      guard.kill("SIGKILL");
    }
  }, 30_000);
});
