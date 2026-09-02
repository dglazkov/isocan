import { type FastifyInstance } from "fastify";
import { Engine } from "./engine.js";
import type { Store } from "./store.js";
import type { Desk } from "./desk.js";
import { PresenceHub } from "./presence.js";
import { type AuthConfig, type SigningKeys } from "./attest.js";
import { HomeLinks } from "./home-links.js";
export interface DaemonOptions {
    port?: number;
    home?: string;
    /** The WebSocket heartbeat interval; tests only. Production beats every
     * 25 s (`ws.ts`), and a test that has to watch a beat find an instance
     * behind the store should not have to wait one. */
    heartbeatMs?: number;
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
     * The content listener's port: a number pins it, `0` asks for an ephemeral
     * one, `"off"` disables it. Absent, `ISOCAN_CONTENT_PORT` is read, and
     * unset means the default plan — the main port's neighbour, then ephemeral
     * (`contentPorts` in content.ts carries the rules, including the hard one:
     * a wide-bound daemon never gets a content listener at all).
     */
    contentPort?: number | "off";
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
    /** How often each home connection re-asks its home which build it is
     * (auto-upgrade phase 2). An hour by default; a knob for the reason
     * `gcIntervalMs` is one — an hourly timer is not something a test can wait
     * for, and the proof that a MOVED home produces a second verdict has to be
     * able to run at millisecond scale against a real daemon. */
    homeProbeMs?: number;
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
     * **How often a replica checks its bytes reached the home**, and the same
     * kind of field as `gcIntervalMs` for the same reason: a test proving the
     * timer fires cannot wait ten minutes. Zero switches it off.
     */
    blobCheckIntervalMs?: number;
    /** When the FIRST byte check runs. The one that matters most — it looks at
     *  what fell behind while this daemon was not running. */
    blobCheckFirstMs?: number;
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
    /** The content origin this daemon actually stands behind — what
     * `GET /api/serving` advertises — or null when no content listener bound
     * (disabled, wide-bound, or every candidate port refused). */
    contentBase: string | null;
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
export declare function startDaemon(options?: DaemonOptions): Promise<Daemon>;
/**
 * Stop every isocan daemon in the way and don't come back until they're
 * gone: the one answering on `port`, plus whatever this home's pidfile
 * names. SIGTERM first, SIGKILL for anything still breathing. Returns the
 * pids actually stopped.
 */
export declare function stopDaemons(port: number, home: string, notify?: (message: string) => void): Promise<number[]>;
/** Long-running entrypoint with signal handling. */
export declare function runDaemon(options?: RunDaemonOptions): Promise<Daemon>;
