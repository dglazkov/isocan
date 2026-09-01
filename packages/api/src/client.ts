import { promises as fs, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "@isocan/server";
import { DaemonRoutes } from "./routes.ts";

/**
 * **The Node-only half of the client** — how a daemon comes to exist on this
 * machine, layered over the typed route surface it then speaks to.
 *
 * The split is `routes.ts`'s to explain (and `boundary.test.ts`'s to hold):
 * everything here may spawn processes and read the managed-install layout,
 * and nothing in `DaemonRoutes` may.
 */
export class DaemonClient extends DaemonRoutes {
  /**
   * **Which copy a daemon started from here should run** (auto-upgrade phase
   * 4). Normally this one — the process asking for a daemon is the obvious
   * candidate to provide it. On a MANAGED install it is `current` instead,
   * and that difference is one of the phase's three idle points: starting a
   * daemon is a fresh process either way, so it is a free moment to land on
   * whatever build the machine has since flipped to. It is also what makes a
   * parked agent's reconnect land on the new build, because `isocan wait`
   * calls `ensureDaemon` when its daemon goes away.
   *
   * Gated on this copy being managed, and that gate is the whole of the care
   * here. A CHECKOUT must keep starting the daemon it built, whatever
   * `~/.isocan/current` happens to point at — a developer whose daemon quietly
   * came up on a release build instead of their own working tree would spend
   * an afternoon on it. Same for a global install nobody has adopted.
   *
   * The bin named is the CLI's, from this package's sibling — the daemon is
   * `isocan serve`, and the packages travel together (iso-api phase 1 moved
   * this file one workspace over; the relative reach to the bin is the same in
   * a checkout and in an install, which is the workspace-loader's own
   * argument).
   */
  private daemonBin(): string {
    const own = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../cli/bin/isocan.js",
    );
    if (shaOfRoot(this.home, path.resolve(own, "../../../..")) === null) return own;
    const current = path.join(
      paths.currentLink(this.home),
      "node_modules/isocan/packages/cli/bin/isocan.js",
    );
    return existsSync(current) ? current : own;
  }

  /** Start the daemon detached if it isn't answering, then wait for healthz. */
  async ensureDaemon(): Promise<void> {
    if (await this.health()) return;
    const cliBin = this.daemonBin();
    await fs.mkdir(this.home, { recursive: true });
    const log = openSync(paths.daemonLogFile(this.home), "a");
    const port = new URL(this.base).port;
    spawn(process.execPath, [cliBin, "serve", "--foreground"], {
      detached: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, ISOCAN_PORT: port, ISOCAN_HOME: this.home },
    }).unref();
    /**
     * **How long to wait for a daemon that is starting.**
     *
     * It was five seconds, and five seconds is a guess about a machine. On a
     * busy laptop — a test suite running, a build, several agents — a daemon
     * takes longer than that to answer, and every caller of this reads the
     * throw as "there is no daemon" and goes on to do less.
     *
     * `isocan setup` was the worst of them: it gates the whole command on
     * this, so a slow start meant no home written, no pass redeemed, nobody
     * admitted — and exit 0. Found through a test that was flaky because the
     * product was fragile, which is the useful kind of flaky.
     *
     * Costs nothing when a daemon is already there: `health()` answers on the
     * first pass and this loop never runs a second time. What it lengthens is
     * only the wait for one that is genuinely on its way, and the case it
     * makes slower — no daemon at all, ever — still fails, with the log path,
     * which is the trade this repo makes everywhere: a slow failure beats a
     * cheerful wrong answer.
     */
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await this.health(1000)) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`daemon did not come up on ${this.base} — see ${paths.daemonLogFile(this.home)}`);
  }
}

/** `realpath`, falling back to `resolve` for a path that does not exist yet.
 * Shared with the CLI's `upgrade.ts` and `managed.ts`, which compare the same
 * kind of pair. */
export function resolved(target: string): string {
  try {
    return realpathSync(path.resolve(target));
  } catch {
    return path.resolve(target);
  }
}

/**
 * The build a path belongs to, or null when it is outside `builds/`.
 *
 * **Both sides are resolved through their symlinks first, and that is the
 * whole of the care here.** A daemon reports `buildStamp().root`, which node
 * has already realpath'd on its way to loading the module; `ISOCAN_HOME` is
 * whatever a person or a test typed. On macOS those two spellings differ for
 * every temporary directory in existence — `/tmp` is a symlink to
 * `/private/tmp`, `$TMPDIR` to `/private/var/folders/…` — so comparing them
 * literally answers "not one of ours" about a tree that plainly is, and the
 * consequence of that wrong answer is deleting a build out from under a
 * running daemon. Found by a test that started a real process and asked.
 *
 * It lives here rather than with the rest of the upgrade machinery in the
 * CLI's `managed.ts` because `daemonBin` above is a second reader — the one
 * piece of the managed layout the daemon-lifecycle half has to know.
 */
export function shaOfRoot(home: string, root: string): string | null {
  const relative = path.relative(resolved(paths.buildsDir(home)), resolved(root));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const sha = relative.split(path.sep)[0];
  return sha && sha.length > 0 ? sha : null;
}
