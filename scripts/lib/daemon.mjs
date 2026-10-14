/**
 * **A daemon this script owns, and takes with it however the script ends.**
 *
 * `isocan serve` is the wrong thing for a script to start. Without
 * `--foreground` it is a LAUNCHER: `ensureDaemon` spawns a detached
 * `serve --foreground` and the command exits as soon as that answers. So the
 * child a script holds is a wrapper that has already gone, and `proc.kill()`
 * signals nothing. `scripts/journeys.mjs` and `scripts/frames.mjs` both did
 * exactly that, and every run left its daemon behind, serving a temp home the
 * run had already deleted. By 14 Oct 2026 one Mac held about 290 of them,
 * roughly 8 GB, and a full deep run reached load average 98.
 *
 * So this starts the daemon itself, in the foreground, as the leader of its
 * own process group, and stops it by signalling the group and WAITING for it
 * to exit. Three fallbacks cover a run that never reaches its own `finally`:
 *
 * - an `exit` hook, which Node runs after `process.exit`, a clean end, an
 *   uncaught exception and an unhandled rejection alike;
 * - SIGINT, SIGTERM and SIGHUP, which do NOT run `exit` hooks by default, so
 *   they are caught here, the owned processes are killed, and the script
 *   exits with the status the signal would have given it;
 * - `ISOCAN_DAEMON_GUARD_PID`, the daemon's own watch on a pid it dies with
 *   (`packages/server/src/daemon.ts`, `guardedBy`), for the one ending no
 *   hook sees: the script itself killed with SIGKILL.
 *
 * The signal handlers are armed only once something is owned, so importing
 * this changes nothing about a script that never starts a daemon.
 */
import { spawn } from "node:child_process";
import { constants } from "node:os";

/** Every process this script still owns, with whether to signal its group. */
const owned = new Map();
let armed = false;

/** Signal a process, or its whole group. Never throws: it may be gone. */
function signal(pid, group, sig) {
  try {
    process.kill(group ? -pid : pid, sig);
    return true;
  } catch {
    return false;
  }
}

function arm() {
  if (armed) return;
  armed = true;
  // Synchronous by necessity: nothing can be awaited in an `exit` hook. A
  // throwaway daemon killed outright loses nothing; one left running costs
  // memory until somebody notices, which is how there came to be 290.
  process.on("exit", () => {
    for (const [pid, group] of owned) signal(pid, group, "SIGKILL");
    owned.clear();
  });
  for (const name of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(name, () => {
      for (const [pid, group] of owned) signal(pid, group, "SIGKILL");
      owned.clear();
      process.exit(128 + (constants.signals[name] ?? 0));
    });
  }
}

/**
 * **Take `pid` down with this script**, on any ending the hooks above see.
 * `group` signals its process group too: true for a daemon started here, which
 * leads its own. Returns the release, for a process stopped the ordinary way.
 */
export function reapOnExit(pid, { group = false } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return () => {};
  arm();
  owned.set(pid, group);
  return () => owned.delete(pid);
}

/** A port nothing on this machine hands out on its own: below the ephemeral
 * floor on both platforms (32768 on Linux, 49152 on macOS). */
const pickPort = () => 20_000 + Math.floor(Math.random() * 9_000);

/** The answer a daemon gives when the port it was told is not free. */
const RACED = /EADDRINUSE|already holds port|is held by something/i;

/**
 * **Start `serve --foreground` and wait until it says it is listening.**
 *
 * `cli` is the bin to run, so a caller measuring another tree (`frames.mjs
 * --root`) starts that tree's daemon. `env` is added to `process.env`, and
 * ISOCAN_HOME, ISOCAN_PORT, ISOCAN_CONTENT_PORT and the guard pid are this
 * helper's to set. A lost port race is retried on a fresh port; any other
 * failure is thrown with the daemon's own output, because a daemon that will
 * not boot must say why rather than be tried four more times.
 *
 * Returns `{ proc, port, origin, output, stop }`. `stop()` is idempotent and
 * resolves once the daemon has exited.
 */
export async function startDaemon({ cli, home, env = {}, port = null, timeoutMs = 30_000, attempts = 4 }) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await startOnce({ cli, home, env, port: port ?? pickPort(), timeoutMs });
    } catch (err) {
      last = err;
      // A port given by the caller is the caller's to retry.
      if (port !== null || !RACED.test(String(err))) throw err;
    }
  }
  throw last;
}

async function startOnce({ cli, home, env, port, timeoutMs }) {
  const proc = spawn(process.execPath, [cli, "serve", "--foreground"], {
    env: {
      ...process.env,
      ...env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: String(port),
      ISOCAN_CONTENT_PORT: env.ISOCAN_CONTENT_PORT ?? String(port + 1),
      ISOCAN_DAEMON_GUARD_PID: String(process.pid),
    },
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group, so one signal reaches it and anything it starts.
    detached: true,
  });
  const release = reapOnExit(proc.pid, { group: true });
  // Drained for the daemon's whole life, or a chatty one fills the pipe and
  // blocks; kept to its tail, which is the part a failure needs.
  let out = "";
  let heard = null;
  const take = (chunk) => {
    out = (out + chunk.toString()).slice(-20_000);
    heard?.();
  };
  proc.stdout.on("data", take);
  proc.stderr.on("data", take);
  const exited = new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) resolve();
    else proc.once("exit", () => resolve());
  });
  // A spawn that failed outright has no pid and nothing to wait for.
  const alive = () => proc.pid !== undefined && proc.exitCode === null && proc.signalCode === null;
  /** Whether it exited within `ms`. The timer is cleared either way: a
   * pending one would hold this script open for the whole grace after the
   * daemon had already gone (the owned-daemon test caught exactly that). */
  const exitsWithin = (ms) => {
    let timer;
    return Promise.race([
      exited.then(() => true),
      new Promise((r) => { timer = setTimeout(() => r(false), ms); }),
    ]).finally(() => clearTimeout(timer));
  };
  let stopping = null;
  const stop = () =>
    (stopping ??= (async () => {
      if (alive()) {
        signal(proc.pid, true, "SIGTERM");
        if (!(await exitsWithin(5_000))) {
          signal(proc.pid, true, "SIGKILL");
          await exitsWithin(2_000);
        }
      }
      // Anything it started and left in its group goes with it.
      signal(proc.pid, true, "SIGKILL");
      release();
      if (alive()) throw new Error(`the daemon on port ${port} (pid ${proc.pid}) did not exit`);
    })());
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error(`daemon did not start within ${Math.round(timeoutMs / 1000)}s:\n${out}`)),
        timeoutMs,
      );
      // `runDaemon`'s own line, printed once the port is bound. It names the
      // interface it bound, so the port is what is matched.
      const ready = new RegExp(`listening on http://[^\\s/]+:${port}\\b`);
      heard = () => {
        if (!ready.test(out)) return;
        heard = null;
        clearTimeout(deadline);
        resolve();
      };
      proc.once("exit", (code, sig) => {
        clearTimeout(deadline);
        reject(new Error(`daemon exited (${code ?? sig}) before it was listening:\n${out}`));
      });
      proc.once("error", (err) => {
        clearTimeout(deadline);
        reject(err);
      });
    });
  } catch (err) {
    heard = null;
    await stop().catch(() => {});
    throw err;
  }
  return { proc, port, origin: `http://127.0.0.1:${port}`, output: () => out, stop };
}
