import { promises as fs } from "node:fs";
import net from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_PORT } from "@isocan/core";
import { Engine } from "./engine.ts";
import { registerRoutes } from "./http.ts";
import { attachWebSockets } from "./ws.ts";
import { Store } from "./store.ts";
import { PresenceHub } from "./presence.ts";
import { daemonFile, isocanHome } from "./paths.ts";

export interface DaemonOptions {
  port?: number;
  home?: string;
}

export interface RunDaemonOptions extends DaemonOptions {
  /** Stop whatever daemon is already there and take the port. What `npm run
   * dev` wants: the daemon you just started must be the one being served. */
  takeover?: boolean;
  /** Where to narrate the takeover (default: stdout). */
  notify?: (message: string) => void;
}

export interface Daemon {
  app: FastifyInstance;
  engine: Engine;
  store: Store;
  port: number;
  close: () => Promise<void>;
}

export async function startDaemon(options: DaemonOptions = {}): Promise<Daemon> {
  const port = options.port ?? DEFAULT_PORT;
  const home = options.home ?? isocanHome();

  const store = new Store(home);
  await store.init();
  const presence = new PresenceHub();
  // Claims consult presence: a live face holds its name (see core/claims.ts).
  const engine = new Engine(store, { liveness: (projectId) => presence.roster(projectId) });

  // Op piggyback: an op bound to a session (clientId === sessionId) moves
  // that session's cursor to the op's locus — presence traces real work.
  engine.onEvent((projectId, message) => {
    if (message.type !== "op-applied") return;
    void engine
      .getSnapshot(projectId)
      .then((snapshot) =>
        presence.opApplied(
          projectId,
          message.entry.envelope.clientId,
          message.entry.envelope.actor,
          message.entry.envelope.op,
          snapshot.canvas,
        ),
      )
      .catch(() => {});
  });

  // forceCloseConnections: shutdown must not hang on a browser's idle
  // keep-alive sockets or a half-read blob stream.
  const app = Fastify({ bodyLimit: 512 * 1024 * 1024, forceCloseConnections: true });
  registerRoutes(app, engine, store, presence);
  await app.listen({ port, host: "127.0.0.1" });
  const closeWebSockets = attachWebSockets(app.server, engine, presence);

  await fs.writeFile(
    daemonFile(home),
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }, null, 2),
  );

  const close = async () => {
    presence.close();
    closeWebSockets();
    await app.close();
    // Only remove the pidfile if it is still OURS — a stop-then-serve race
    // otherwise lets the dying daemon delete its replacement's pidfile.
    try {
      const current = JSON.parse(await fs.readFile(daemonFile(home), "utf8")) as { pid: number };
      if (current.pid === process.pid) await fs.rm(daemonFile(home), { force: true });
    } catch {
      // already gone or unreadable — nothing to clean
    }
  };

  return { app, engine, store, port, close };
}

// ---------- stale daemons ----------
//
// A daemon that outlives the code it was started from is the worst bug this
// project has: everything answers, nothing errors, and you are talking to
// last week's server. So getting rid of one must never depend on a pidfile
// being right — we ask the port who it is, and believe that first.

/** The pid answering /healthz on this port, or null if no daemon is there. */
async function daemonPidOn(port: number): Promise<number | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; pid?: number };
    return body.ok === true && typeof body.pid === "number" ? body.pid : null;
  } catch {
    return null;
  }
}

async function readPidfile(home: string): Promise<{ pid: number; port: number } | null> {
  try {
    const raw = JSON.parse(await fs.readFile(daemonFile(home), "utf8")) as Record<string, unknown>;
    if (typeof raw.pid !== "number") return null;
    return { pid: raw.pid, port: typeof raw.port === "number" ? raw.port : DEFAULT_PORT };
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Is anything at all bound here? Answers the case a healthz probe can't: a
 * daemon wedged badly enough that it holds the socket but not the route. */
function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(true));
    probe.listen({ port, host: "127.0.0.1" }, () => probe.close(() => resolve(false)));
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitGone(pids: number[], timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const left = pids.filter(isAlive);
    if (left.length === 0 || Date.now() > deadline) return left;
    await sleep(25);
  }
}

/**
 * Stop every isocan daemon in the way and don't come back until they're
 * gone: the one answering on `port`, plus whatever this home's pidfile
 * names. SIGTERM first, SIGKILL for anything still breathing. Returns the
 * pids actually stopped.
 */
export async function stopDaemons(
  port: number,
  home: string,
  notify: (message: string) => void = () => {},
): Promise<number[]> {
  const targets = new Set<number>();
  const holder = await daemonPidOn(port);
  if (holder !== null && holder !== process.pid) targets.add(holder);

  // The pidfile is the weaker witness — a bare pid outlives its process and
  // the number gets reused — so only act on it when it corroborates: the
  // daemon still answers on its own recorded port, or something unidentified
  // is holding the port we want and this is our one explanation for it.
  const recorded = await readPidfile(home);
  if (recorded && recorded.pid !== process.pid && isAlive(recorded.pid)) {
    const answersItsOwnPort = (await daemonPidOn(recorded.port)) === recorded.pid;
    if (answersItsOwnPort || (holder === null && (await portTaken(port)))) {
      targets.add(recorded.pid);
    }
  }

  const pids = [...targets];
  for (const pid of pids) {
    notify(`stopping isocan daemon (pid ${pid})`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone between the probe and the signal
    }
  }
  const stubborn = await waitGone(pids, 3000);
  for (const pid of stubborn) {
    notify(`daemon ${pid} ignored SIGTERM — killing it`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ditto
    }
  }
  const undead = await waitGone(stubborn, 2000);
  if (undead.length > 0) {
    throw new Error(`could not stop isocan daemon${undead.length > 1 ? "s" : ""} ${undead.join(", ")}`);
  }

  // A pidfile naming nobody is how the next start gets confused; clear it
  // unless a live daemon we didn't touch still owns it.
  const left = await readPidfile(home);
  if (left && (pids.includes(left.pid) || !isAlive(left.pid))) {
    await fs.rm(daemonFile(home), { force: true });
  }
  return pids;
}

/**
 * Die with the process that had us started. A daemon is detached on purpose —
 * that is how it survives the `isocan` command that spawned it — and the price
 * is that nothing reaps one when a run ends the way runs actually end: the
 * terminal closes, the session goes away, someone SIGKILLs the lot. The
 * `afterEach` that would have called `stopDaemons` never gets to run, and the
 * daemon keeps answering on its port, out of a temp home that was deleted
 * hours ago, until you go looking in `ps`.
 *
 * So ISOCAN_DAEMON_GUARD_PID names a process this daemon has no business
 * outliving. Nothing sets it in normal use; the test setup file points it at
 * the vitest worker, and it reaches here for free because tests hand
 * `{ ...process.env }` to the CLI and `ensureDaemon` passes that on.
 */
function guardedBy(pid: number | undefined, stop: () => void): void {
  if (pid === undefined) return;
  const watch = setInterval(() => {
    if (!isAlive(pid)) stop();
  }, 1000);
  // Never the reason this process stays up — only ever the reason it goes down.
  watch.unref();
}

/** The pid to die with, if we were given a usable one. Our own doesn't count:
 * an in-process daemon already shares its fate. */
function guardPid(): number | undefined {
  const raw = process.env.ISOCAN_DAEMON_GUARD_PID;
  if (raw === undefined) return undefined;
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 && pid !== process.pid ? pid : undefined;
}

/** Long-running entrypoint with signal handling. */
export async function runDaemon(options: RunDaemonOptions = {}): Promise<Daemon> {
  const port = options.port ?? DEFAULT_PORT;
  const home = options.home ?? isocanHome();
  const notify = options.notify ?? ((message: string) => console.log(message));
  if (options.takeover) {
    const stopped = await stopDaemons(port, home, notify);
    if (stopped.length > 0) notify(`took over port ${port} from ${stopped.join(", ")}`);
  }
  let daemon: Daemon;
  try {
    daemon = await startDaemon({ ...options, port, home });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
    // Name the squatter: another daemon that just won the race reads very
    // differently from a foreign process sitting on the port.
    const other = await daemonPidOn(port);
    throw new Error(
      other !== null
        ? `another isocan daemon (pid ${other}) already holds port ${port}`
        : `port ${port} is held by something that is not an isocan daemon — free it, or set ISOCAN_PORT to another port`,
    );
  }
  console.log(`isocan daemon listening on http://127.0.0.1:${daemon.port}`);
  const shutdown = () => {
    void daemon.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  guardedBy(guardPid(), shutdown);
  return daemon;
}
