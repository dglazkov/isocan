import { promises as fs, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, fetch as undiciFetch } from "undici";
import { isLoopbackBase } from "@isocan/core";
import { paths } from "@isocan/server";
import { DaemonRoutes, platformFetch } from "./routes.ts";

/**
 * **A SYN that goes nowhere costs a second, not eight** — the product half of
 * the flake family's 3 Sep fix (`docs/research/2026-08-29-the-flake-family.md`).
 *
 * A loopback connect is the kernel's own work: measured at 1ms even against a
 * daemon whose event loop is blocked for five seconds, because the kernel
 * completes the handshake and the process only accepts afterwards. So on this
 * machine a connect that takes longer than a moment is not a slow daemon, it
 * is a SYN that was dropped or parked — and the kernel's retransmit ladder
 * then holds it for ~7.8s, measured, past every budget the product has.
 * Nothing recovers it, because `request` makes one attempt: what a person
 * types gets `error: fetch failed` after eight seconds from a daemon that was
 * alive the whole time.
 *
 * **Why a retry here is safe when an abort would not be.** The rule is
 * `test/setup.ts`'s and it is the reason that fix was possible at all: a
 * retry is allowed only when nothing reached the server, and an `AbortError`
 * carries no syscall — it cannot tell a connect that never completed from a
 * POST already on the wire, so retrying on it would let an op land twice.
 * `Agent({ connect: { timeout } })` bounds the TCP connect ALONE and fails it
 * with `UND_ERR_CONNECT_TIMEOUT`, which by construction means no request was
 * ever written. That is the whole licence, and it is why the deadline is on
 * the connect and not on the request.
 *
 * **Why only loopback.** Over a network the same connect is an RTT away —
 * 34-45ms to the hosted homes, measured — and on a bad link it is seconds.
 * A deadline that is generous on this machine would refuse a slow link that
 * was working, and a remote base has no 7.8s ladder to escape in the first
 * place, so it keeps today's behaviour exactly: the platform's fetch, one
 * attempt, no deadline. `isLoopbackBase` is the same question `healthPath`
 * asks, asked once.
 *
 * **The numbers, and what they really are.** 1.2s per attempt inside a 3s
 * budget, the pair the suite proved. undici's connect deadline runs on its
 * own ~500ms timer wheel (`setupConnectTimeout` calls `setFastTimeout`, which
 * never takes the native path), so the deadline is quantized: 1.2s fires at
 * about 1.5s, and asking for less than a second buys nothing. Two or three
 * attempts fit the budget, and a connect that lands on the second returns in
 * ~1.6s where today it is a hard failure at 7.8s.
 */
const CONNECT_BUDGET_MS = 3000;
const CONNECT_ATTEMPT_MS = 1200;

const connectBounded = new Agent({ connect: { timeout: CONNECT_ATTEMPT_MS } });

/**
 * **A connect that TIMED OUT, and nothing else** — undici's own word for the
 * deadline above, plus the kernel's for the ladder it replaces. Both mean, by
 * construction, that no byte was written, which is what makes replaying the
 * request safe.
 *
 * `ECONNREFUSED` is deliberately NOT here, though `test/setup.ts` retries on
 * it. It is equally provable and equally safe — and it is also the answer for
 * a daemon that simply is not running, which is instant today and would
 * become three seconds of hopeful sleeping before the same failure. The suite
 * wants that (its daemons are always coming back); a person at a terminal
 * does not. The thing being bought here is the 7.8s ladder, so the predicate
 * is exactly the ladder.
 */
function neverLeftThisMachine(err: unknown): boolean {
  const cause = (err as { cause?: { syscall?: string; code?: string } }).cause;
  return (
    cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    (cause?.syscall === "connect" && cause.code === "ETIMEDOUT")
  );
}

/**
 * The loopback fetch: connect-bounded, retried inside a clock budget, and —
 * when it does give up — carrying the sentence a person can act on.
 *
 * `TypeError: fetch failed` names no address, no syscall and no duration;
 * the flake family spent a week undifferentiated on that message alone, and
 * `error: fetch failed` is what the CLI prints today for every one of these.
 * What replaces it says which daemon, what happened to the connection, and
 * that it was tried more than once — so the next occurrence in somebody's
 * terminal is evidence rather than another sighting.
 */
function boundedFetch(base: string): typeof fetch {
  return async (input, init) => {
    const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      init?.signal?.throwIfAborted();
      try {
        return (await undiciFetch(input as Parameters<typeof undiciFetch>[0], {
          ...(init as Parameters<typeof undiciFetch>[1]),
          dispatcher: connectBounded,
        })) as unknown as Response;
      } catch (err) {
        const spent = Date.now() - started;
        if (!neverLeftThisMachine(err) || spent >= CONNECT_BUDGET_MS) {
          if (neverLeftThisMachine(err)) {
            const cause = (err as { cause?: { code?: string } }).cause;
            (err as Error).message =
              `could not reach the daemon at ${base} — the connection was never made ` +
              `(${cause?.code ?? "?"}, ${attempt + 1} attempt${attempt === 0 ? "" : "s"} in ` +
              `${(spent / 1000).toFixed(1)}s). Nothing was sent, so nothing landed twice; ` +
              `"isocan status" says whether a daemon is there.`;
          }
          throw err;
        }
        // Lengthen the pause the way the suite's does: a machine that could
        // not answer a SYN now is likely to be busy a millisecond from now.
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  };
}

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
   * The Node half's one addition to how a request is MADE, rather than to
   * what is in it: on this machine, a bounded connect and a bounded retry;
   * anywhere else, the surface's own default and today's behaviour. See
   * `boundedFetch` above for why the split is by address.
   */
  protected override fetcher: typeof fetch = isLoopbackBase(this.base)
    ? boundedFetch(this.base)
    : platformFetch;

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
    this.lifetime?.throwIfAborted();
    if (await this.health()) return;
    this.lifetime?.throwIfAborted();
    const cliBin = this.daemonBin();
    await fs.mkdir(this.home, { recursive: true });
    this.lifetime?.throwIfAborted();
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
      this.lifetime?.throwIfAborted();
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
