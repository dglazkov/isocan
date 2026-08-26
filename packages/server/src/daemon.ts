import { promises as fs } from "node:fs";
import net from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_PORT, healthPath } from "@isocan/core";
import { Engine } from "./engine.ts";
import { registerRoutes } from "./http.ts";
import { attachWebSockets } from "./ws.ts";
import { FileStore } from "./file-store.ts";
import type { Store } from "./store.ts";
import { FileDesk } from "./file-desk.ts";
import type { Desk } from "./desk.ts";
import { runMigrations } from "./migrations.ts";
import { PresenceHub } from "./presence.ts";
import { daemonFile, isocanHome } from "./paths.ts";
import { resolveHomeUrl } from "./config.ts";
import { resolveAuth, type AuthConfig, type SigningKeys } from "./attest.ts";
import { gcIntervalFromEnv, startGcSweeper } from "./gc.ts";
import { HomeLinks } from "./home-links.ts";

export interface DaemonOptions {
  port?: number;
  home?: string;
  /**
   * Which interface to listen on. Loopback unless told otherwise, which is the
   * only safe default for a daemon that trusts localhost by name (`isOpen`'s
   * loopback clause, mechanism 5) — a local daemon that bound `0.0.0.0` by
   * accident would hand the whole machine's trust to the network.
   *
   * The hosted home is the one caller that wants the other answer, and it is
   * not a person typing a flag: Cloud Run's startup probe connects to the
   * container's port from outside the container, so a home that bound loopback
   * would fail to deploy with "the user-provided container failed to start and
   * listen on the port" — a message that reads like a crash and is not one.
   * `ISOCAN_BIND=0.0.0.0` is what the image sets, environment rather than
   * flag, for the same reason `ISOCAN_STORE` is: this is innkeeper
   * configuration, not a per-invocation choice an agent should be able to
   * reach for. `http.ts`'s `loopbackBound` already reads the bound address to
   * decide whether the localhost clause applies, so binding wide turns that
   * trust off by itself.
   */
  host?: string;
  /**
   * **Where a canvas born on this machine, naming nothing, is born** —
   * `https://isocan.io`. Absent (the default, and every daemon in this repo
   * today) means a canvas born here stays here.
   *
   * Read from `ISOCAN_HOME_URL`, then `~/.isocan/config.json`'s `home`, by
   * `resolveHomeUrl` — environment and configuration rather than a flag, for
   * the same reason `ISOCAN_BIND` and `ISOCAN_STORE` are.
   *
   * **Phase 10.3 narrowed what this means, from destructive to harmless.** It
   * used to be "the home this daemon is a REPLICA of" — a whole-daemon
   * property that demoted every canvas on the disk at once, which is what
   * phase 7.5's scratch-home dance was self-defence against. It is now the
   * BIRTH DEFAULT and nothing else: it decides where the *next* canvas goes,
   * it re-points nothing that already exists, and which home an existing
   * canvas belongs to is a per-canvas row in `homes.json` (see
   * `HomeLinks`). That narrowing is what makes phase 14's shipped default
   * address safe to flip.
   *
   * The key it is read from was deliberately NOT renamed. An upgraded daemon
   * reading an old `config.json` for a `birthHome` key would find nothing,
   * silently birth new canvases locally, and report "home" to a person who
   * configured a replica — a silent behaviour change bought for nothing. The
   * boot migration freezes every canvas already held at that home, so upgrade
   * day behaves identically.
   *
   * **`isocan home <url>` (phase 7.5) is not a per-invocation override.** It
   * writes the configuration file and restarts the daemon so the file is read
   * exactly as it always was; the refusal of a `--home` FLAG stands, and phase
   * 10.3 is where somebody would reintroduce one — see `HomeLinks`, where that
   * refusal is written down beside the thing that would tempt them.
   */
  birthHome?: string | null;
  /**
   * The identity provider this home has borrowed, or null for none.
   *
   * Read from `ISOCAN_AUTH_PROJECT` + `ISOCAN_AUTH_API_KEY` by `resolveAuth`
   * — environment and configuration rather than a flag, for `homeUrl`'s
   * reason, and with no compiled-in default for the same reason: a daemon
   * with nothing configured has no attester, which is what every daemon in
   * this repo is, so the whole mechanism is invisible until an innkeeper
   * configures it. `undefined` means "nobody has said, go and look"; an
   * explicit `null` is a caller stating that this home has borrowed nothing,
   * which a test needs to be able to say on a machine whose environment has.
   */
  auth?: AuthConfig | null;
  /** Where the public keys a presented ID token is checked against come from.
   * Defaults to Google's published endpoint; `SigningKeys` in `attest.ts`
   * carries the argument for why it is configuration at all. */
  signingKeys?: SigningKeys;
  /** How often the home connection re-reads which canvases to replicate.
   * A knob rather than a constant only because tests want it small and a
   * gentle innkeeper might want it large; see `HomeLink.sync`. */
  homePollMs?: number;
  /**
   * **How often this home collects its own garbage** (phase 13.7), in
   * milliseconds. `0` never sweeps.
   *
   * Read from `ISOCAN_GC_INTERVAL_MS` by `gcIntervalFromEnv`, defaulting to an
   * hour — environment and configuration rather than a flag, for the same
   * reason `ISOCAN_BIND` and `ISOCAN_HOME_URL` are. It is a `DaemonOptions`
   * field for the reason `homePollMs` is: a sweep on the hour is not something
   * a test can wait for, and a proof that the timer FIRES has to be able to
   * run it at millisecond scale against a real daemon.
   */
  gcIntervalMs?: number;
  /**
   * **When the first sweep runs**, in milliseconds after start. Defaults to
   * `firstSweepDelay` of the interval — a minute — and is here as its own
   * field because the two answer different questions: the interval is how
   * often garbage is worth collecting, this is how soon an instance that may
   * not live long must collect some.
   *
   * Deliberately NOT its own environment variable. An innkeeper configures a
   * rhythm, not a boot delay, and a second knob would be a second thing to get
   * wrong for no decision anybody wants to make.
   */
  gcFirstSweepMs?: number;
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
  /** The home's private ledgers. Two seams, side by side: canvas state
   * replicates through the store, the desk's ledgers never leave. */
  desk: Desk;
  port: number;
  /** Where a canvas born here, naming nothing, is born — or null when it stays
   * here. Recorded rather than merely acted on: a daemon that cannot say what
   * it would do next would be a daemon nothing could ask. */
  birthHome: string | null;
  /**
   * **Every home this daemon dials, and which canvas belongs to which.**
   *
   * Never null — a daemon that is the home of everything it holds has an empty
   * registry rather than a missing one, which is what lets every caller ask
   * one kind of question instead of branching on whether there is anywhere to
   * ask. Exposed so a test can reach one link and ask what its last handshake
   * actually was ("resumed from 241" versus "re-snapshotted"), and, as
   * importantly, what a link did NOT do.
   */
  homes: HomeLinks;
  /**
   * The ephemeral plane, exposed for the same reason `homes` is: the questions
   * worth asking about presence are about what a daemon did NOT do. A test can
   * take a mirrored face down here — a dropped relay, a home that restarted —
   * and then assert that the replica puts it back with nothing having changed
   * on its own side, which is the whole of the level-triggered repair and is
   * not observable from outside.
   */
  presence: PresenceHub;
  close: () => Promise<void>;
}

/**
 * Which disk this home runs on. Environment, not a flag, and deliberately:
 * Cloud Run passes env, an innkeeper on a VM sets env, and a `--store` flag
 * on `isocan serve` would be a surface an agent could reach for and misuse.
 * A home's backing is innkeeper configuration, not a thing anyone chooses per
 * invocation.
 *
 * The cloud backing arrives by DYNAMIC import, which is the whole reason the
 * CLI install stays at 81 packages: `@isocan/cloudstore` carries 156 packages
 * and ~43 MiB of Google client libraries, a git install resolves the root
 * manifest only, and `bin/workspace-loader.mjs` maps `@isocan/core` and
 * `@isocan/server` by path and nothing else. So an installed CLI could not
 * resolve this specifier even if something asked — which is exactly right,
 * because the only thing that asks is a hosted home built from the repo.
 *
 * And the specifier is deliberately NOT declared in this package's manifest.
 * `@isocan/cloudstore` depends on `@isocan/server`, never the reverse — that
 * is what lets the cloud backing compile against `store.ts` and `desk.ts` —
 * so declaring it here would make the dependency graph a cycle and would say,
 * in the one place people read to find out, that the server needs Google's
 * libraries. It does not. The workspace root resolves the name; nothing an
 * installed CLI can reach ever does. `test/packaging.test.ts` asserts both
 * halves of that arrangement rather than leaving it as folklore.
 *
 * The price, stated: a typo here is a runtime error at daemon start rather
 * than a compile error. `packages/cloudstore/test/daemon-composition.test.ts`
 * is the two-line test that buys it back.
 */
async function openBacking(home: string): Promise<{ store: Store; desk: Desk }> {
  if (process.env.ISOCAN_STORE !== "cloud") {
    return { store: new FileStore(home), desk: new FileDesk(home) };
  }
  const bucket = process.env.ISOCAN_BUCKET;
  if (!bucket) throw new Error("ISOCAN_STORE=cloud needs ISOCAN_BUCKET");
  const { openCloudBacking } = await import("@isocan/cloudstore");
  return openCloudBacking({
    bucket,
    ...(process.env.ISOCAN_GCP_PROJECT !== undefined
      ? // A Google Cloud project id, not a canvas id — `Storage`/`Firestore`
        // name this option `projectId` and always will.
        { projectId: process.env.ISOCAN_GCP_PROJECT }
      : {}),
  });
}

/**
 * **Fastify's logger, which this daemon did not have** — found in phase 14
 * while trying to settle a question phase 13.7 left open.
 *
 * `Fastify({})` with no `logger` key does not give you a quiet logger, it
 * gives you **`abstract-logging`**: `app.log.warn` is literally
 * `function noop () {}`. So every `app.log` call in `http.ts` had been writing
 * to nothing, on every home, since the day it was typed — including the one
 * phase 13.7 added on purpose as the instrument for its own worst failure
 * mode. That file says a home whose refusals climb while its distinct-key
 * count sits at 1 is a home keyed on its own load balancer, and that "**that
 * log line is how somebody at 3am sees it instead of concluding the limit
 * works**". There was no log line. Measured on the dev home: 21 mints, a
 * legible 429 at the door, and Cloud Logging holding only Google's own
 * request log — the container's stdout carried nothing at all.
 *
 * It is the house failure wearing new clothes: **an instrument can be
 * cheerful too.** Code that reads exactly like logging, next to a comment
 * that explains what the logging is for, and no bytes anywhere.
 *
 * **`warn` and not `info`**, so this is an instrument rather than a firehose.
 * Fastify logs a line per request and a line per response at `info`, and a
 * canvas under an ordinary editing session is hundreds of ops a minute — on a
 * laptop that is `~/.isocan/daemon.log` growing without bound, and on the
 * hosted home it is a duplicate of the request log Google already keeps and
 * bills for. What is wanted is the handful of lines the code writes
 * DELIBERATELY: refused mints, errors the handler swallowed. Those are all
 * `warn` and `error`. `ISOCAN_LOG_LEVEL` opens it up for somebody debugging.
 *
 * **The severity mapping is not decoration.** Cloud Logging reads a
 * `severity` field off a JSON line and ignores pino's numeric `level`, so
 * without this every deliberate warning would arrive labelled INFO — a
 * refusal that says nothing is wrong, which is the same bug one layer up. The
 * label is what a filter selects on, and `severity>=WARNING` is how anybody
 * would go looking.
 */
function serverLogging(): { level: string; formatters: { level: (label: string) => object } } {
  return {
    level: process.env.ISOCAN_LOG_LEVEL ?? "warn",
    formatters: {
      // pino's labels are already Google's names for every level this daemon
      // uses (warn -> WARNING is the one that differs, and pino calls it
      // "warn"), so the map is a lookup with an honest fallback rather than a
      // table nobody maintains.
      level: (label: string) => ({
        severity: { warn: "WARNING", error: "ERROR", fatal: "CRITICAL" }[label] ?? label.toUpperCase(),
      }),
    },
  };
}

export async function startDaemon(options: DaemonOptions = {}): Promise<Daemon> {
  const port = options.port ?? DEFAULT_PORT;
  const home = options.home ?? isocanHome();
  const host = options.host ?? process.env.ISOCAN_BIND ?? "127.0.0.1";
  // Undefined means "nobody has said" — go and look. An explicit `null` is a
  // caller saying "this one is a home", which a test needs to be able to say
  // on a machine whose config.json names one.
  const birthHome =
    options.birthHome !== undefined ? options.birthHome : await resolveHomeUrl(home);
  // The attester, resolved the same way and at the same moment as the home:
  // both are innkeeper configuration that decides what kind of daemon this is,
  // and an explicit value is a caller (a test) saying so on a machine whose
  // environment says otherwise.
  const auth = options.auth !== undefined ? options.auth : resolveAuth();

  // The composition root, and the ONE place any backing is named.
  const { store, desk } = await openBacking(home);
  await store.init();
  await desk.init();
  // The one-time migrations, composed across the two ledgers: the pre-badge
  // claims table, the pre-#57 `agents.json`, the link grants a pre-door world
  // has no rows for — and phase 10.3's, which writes down where the canvases
  // this machine already holds actually live before "no row means local"
  // starts being true. The birth default is handed in because that migration
  // turns on whether one is configured; see `recordWhereTheCanvasesAlreadyLive`.
  await runMigrations(home, store, desk, birthHome);
  const presence = new PresenceHub();
  // Claims consult presence: a live face holds its name (see core/claims.ts).
  const engine = new Engine(store, desk, { liveness: (canvasId) => presence.roster(canvasId) });

  // Op piggyback: an op bound to a session (clientId === sessionId) moves
  // that session's cursor to the op's locus — presence traces real work.
  engine.onEvent((canvasId, message) => {
    if (message.type !== "op-applied") return;
    void engine
      .getSnapshot(canvasId)
      .then((snapshot) =>
        presence.opApplied(
          canvasId,
          message.entry.envelope.clientId,
          message.entry.envelope.actor,
          message.entry.envelope.op,
          snapshot.canvas,
        ),
      )
      .catch(() => {});
  });

  /**
   * The demotion, wired — per canvas since phase 10.3.
   *
   * Built BEFORE the port is bound and before anything is dialled, so there is
   * no window in which this daemon accepts a write it would have applied
   * locally and a moment later would have forwarded. `forwardTo` is the whole
   * switch: with a row naming a home, the engine stops assigning seqs for that
   * canvas and the home does.
   *
   * Constructed unconditionally, including on a daemon that is the home of
   * everything it holds: the registry is then simply empty, and every caller
   * asks it the same question instead of branching on whether it exists.
   */
  const homes = new HomeLinks({
    home,
    engine,
    presence,
    birthHome,
    ...(options.homePollMs !== undefined ? { pollMs: options.homePollMs } : {}),
  });
  engine.forwardTo(homes);

  /**
   * A canvas is gone, so its routing goes with it (ruling 3): a re-created id
   * would otherwise inherit a dead one and forward its birth to whichever home
   * used to hold the canvas that had that name.
   *
   * Hung off the engine's own event rather than written into the three places
   * a delete lands (a local one, a forwarded one, a `canvas-deleted` from a
   * home) for the reason `HomeLink`'s dial is hung off the same event: one
   * subscription cannot be forgotten by the next person who adds a fourth path.
   */
  engine.onEvent((canvasId, message) => {
    if (message.type !== "canvas-deleted") return;
    void homes.release(canvasId).catch(() => {});
  });

  // forceCloseConnections: shutdown must not hang on a browser's idle
  // keep-alive sockets or a half-read blob stream.
  const app = Fastify({
    bodyLimit: 512 * 1024 * 1024,
    forceCloseConnections: true,
    logger: serverLogging(),
  });
  registerRoutes(app, engine, store, desk, presence, {
    birthHome,
    homes,
    auth,
    ...(options.signingKeys ? { signingKeys: options.signingKeys } : {}),
  });
  await app.listen({ port, host });
  // Dialling starts only once we are serving: the first thing that arrives
  // down a canvas socket is written through the engine, and an engine whose
  // daemon is still coming up is a race for no benefit.
  await homes.start();
  const closeWebSockets = attachWebSockets(app.server, engine, desk, presence);

  /**
   * **The home's own housekeeping** (phase 13.7): every canvas the store
   * holds, swept a minute after boot and every interval after that, with
   * nobody at the door.
   *
   * A timer inside the process rather than a scheduler outside it, and that is
   * a decision rather than an expedient — `docs/architecture.md`'s GC line and
   * `infra/91-scheduler-gc.sh` both carry the argument in full. The short
   * form: the door admits BADGES, a cron cannot hold one, and the two ways to
   * give it one are a long-lived robot key in a secret store or a new kind of
   * caller at the door. Garbage accrues only while a home is in use, which is
   * exactly when this process is alive, so the instance is the right clock.
   *
   * **The boot sweep is what makes that clock real, and it is not a nicety.**
   * The instance is the clock, so the sweep has to fit inside the instance's
   * LIFE: dev runs `MIN_INSTANCES=0` and Cloud Run reaps an idle one after
   * about fifteen minutes, so a first tick an hour away belongs to a process
   * that no longer exists. `firstSweepDelay` carries the full reasoning.
   *
   * Started here, after `listen`, because it writes: a sweep compacts oplogs
   * and deletes blob bytes, and doing that while the engine is still coming up
   * would be racing the boot for no gain. That is also why the boot sweep is a
   * minute out rather than immediate — boot is the busiest the daemon gets.
   */
  const sweeper = startGcSweeper({
    engine,
    canvases: () => store.listCanvases(),
    intervalMs: options.gcIntervalMs ?? gcIntervalFromEnv(),
    ...(options.gcFirstSweepMs !== undefined ? { firstSweepMs: options.gcFirstSweepMs } : {}),
  });

  await fs.writeFile(
    daemonFile(home),
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }, null, 2),
  );

  const close = async () => {
    presence.close();
    // The sweeper first, and awaited: an interval that survives its daemon is
    // the shape of handle this file has already paid for twice (the sockets,
    // and the writes `engine.settled()` exists to catch). Stopping it before
    // anything else closes means no tick can enqueue work behind a store that
    // is on its way down; awaiting it means the tick already running has
    // finished asking for any.
    await sweeper.stop();
    // The home connections first, and before the store: they are the one thing
    // here that is still WRITING (an entry may be mid-apply), and a socket
    // left open is a process that never exits — which phase 4's finding
    // already paid for once. All of them, together: `HomeLinks.close()` is
    // where `homeLink.close()` used to be, for the same reason.
    await homes.close();
    closeWebSockets();
    await app.close();
    /**
     * The writer, drained — and this is a shutdown GUARANTEE, not tidiness.
     *
     * `app.close()` stops the listener and (with `forceCloseConnections`)
     * destroys the sockets, but destroying a socket does not cancel the
     * handler that was already running behind it: a request that reached
     * `engine.claim` has its work sitting on the single-writer chain, and that
     * work writes to the desk and the store. Without this line `close()`
     * resolved while those writes were still to come, and they landed AFTER
     * `desk.close()` had drained — `FileDesk.setClaims` → `writeFileAtomic`
     * dropping a fresh `.tmp-*` into `desk/` on a daemon that had said it was
     * shut. Under test that surfaced as `ENOTEMPTY … rmdir …/desk`; in a
     * container it is a write racing process exit.
     *
     * `settled()` already exists for exactly this shape of question (the home
     * connection asks it before reading a seq cursor), and it is safe HERE
     * rather than earlier because the home connection is closed above: a
     * forwarded write holds the chain across an HTTP round trip, and
     * `HomeLink.close()`'s abort is what makes that round trip end now instead
     * of in thirty seconds.
     */
    await engine.settled();
    // Only remove the pidfile if it is still OURS — a stop-then-serve race
    // otherwise lets the dying daemon delete its replacement's pidfile.
    try {
      const current = JSON.parse(await fs.readFile(daemonFile(home), "utf8")) as { pid: number };
      if (current.pid === process.pid) await fs.rm(daemonFile(home), { force: true });
    } catch {
      // already gone or unreadable — nothing to clean
    }
    // Last, and after the sockets are shut: the backing flushes whatever it
    // was debouncing and closes whatever it holds open. A cloud home that
    // skipped this would lose the newest snapshot (harmless — the log is
    // truth, boot replays the tail) and keep a gRPC channel alive forever
    // (not harmless — the process never exits).
    await desk.close();
    await store.close();
  };

  return { app, engine, store, desk, presence, port, birthHome, homes, close };
}

// ---------- stale daemons ----------
//
// A daemon that outlives the code it was started from is the worst bug this
// project has: everything answers, nothing errors, and you are talking to
// last week's server. So getting rid of one must never depend on a pidfile
// being right — we ask the port who it is, and believe that first.

/** The pid answering the health route on this port, or null if no daemon is
 * there. The path comes from `healthPath` rather than a literal — this one is
 * always loopback and so always gets `/healthz`, but a constant here is how
 * the next caller copies the wrong one. */
async function daemonPidOn(port: number): Promise<number | null> {
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}${healthPath(base)}`, {
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
  // Say the bound interface, not a guess at it: "listening on 127.0.0.1" out
  // of a container that is in fact wide open is the kind of log line that gets
  // believed for a year.
  const bound = daemon.app.server.address();
  const where = bound && typeof bound !== "string" ? bound.address : "127.0.0.1";
  console.log(`isocan daemon listening on http://${where}:${daemon.port}`);
  /**
   * What kind of daemon this is, said out loud at boot — and since phase 10.3
   * that is no longer one of two things. A daemon is the home of some canvases
   * and a replica for others, so what gets said is the birth default (where
   * the next canvas goes) and how many canvases are somewhere else.
   *
   * Still said, and still at boot, for the original reason: a daemon that
   * stopped serving pages for a canvas without saying so is a canvas that
   * "just stopped opening in the browser", and a design decision nobody is
   * told about reads as a bug.
   */
  if (daemon.birthHome !== null) {
    console.log(
      `isocan: canvases born here are born at ${daemon.birthHome} — serving ops to CLIs, and pages only for the canvases this daemon is the home of`,
    );
    // And whether that address is actually answering, said once, in the
    // background so a home that is down never delays a boot. A daemon pointed
    // at a typo'd address otherwise behaves exactly like one pointed at a home
    // that happens to be busy — every write refused, nothing on screen
    // explaining why. The probe goes through `healthPath`, so it asks a hosted
    // home the path Google's frontend will forward rather than the one it
    // swallows (phase 5's finding). This is why the birth default keeps an
    // open link even with no canvas assigned to it — see `HomeLinks.start`.
    void daemon.homes.link(daemon.birthHome)?.reachable().then((up) => {
      console.log(
        up
          ? `home ${daemon.birthHome} is answering`
          : `WARNING: home ${daemon.birthHome} is NOT answering — reads work from the local copy, writes to canvases that live there will be refused until it does`,
      );
    });
  }
  /**
   * Exit, whatever `close()` does — and say so honestly if it went wrong.
   *
   * This used to be `close().then(() => process.exit(0))` with no catch, so a
   * rejection from `desk.close()` or `store.close()` left the process alive
   * with its handlers detached: a daemon that has stopped serving and will not
   * die. That is not a hypothetical shape. It is exactly the condition that
   * makes `stopDaemons` escalate to SIGKILL, and chasing a flake caused BY
   * that escalation is how this line got read at all.
   *
   * Exit 1 rather than 0 when the shutdown failed, because a close that could
   * not flush is not a clean shutdown and a process that reports success is a
   * process nobody investigates. The error goes to the log first: on a hosted
   * home that log line is the only witness.
   *
   * What this still does not cover, named rather than fixed: a `close()` that
   * never SETTLES hangs the same way. A watchdog that exits regardless after a
   * grace period is the answer if that is ever observed — it is not, today,
   * and a timer that kills a daemon mid-flush would be its own bug.
   */
  const shutdown = () => {
    void daemon
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("isocan: shutdown failed to complete cleanly:", err);
        process.exit(1);
      });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  guardedBy(guardPid(), shutdown);
  return daemon;
}
