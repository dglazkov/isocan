/**
 * **Direct mode: this machine runs no daemon, and every command speaks to the
 * home itself.**
 *
 * The journey calls the seat "thin" (Sonia, Scene 6) and that word describes a
 * topology to somebody who has read the journey. The switch is called
 * `--direct` because it has to say what will happen to somebody who has not:
 * commands go straight to the home, with no local replica and nothing on this
 * machine to lose.
 *
 * **It is declared and never guessed**, and the second half of that sentence
 * was learned the hard way. Direct-versus-daemon is a property of the
 * *directory*, not of whose cloud it sits in: a CI runner is disposable, a
 * cloud dev workspace has disk and persists for days, a headless box in a
 * closet wants a daemon like any laptop. So the vendor is never asked.
 *
 * **There used to be a guess** — `CI` set, nothing on a terminal, an address
 * in hand — as a narrow way to make Scene 6's "setup notices what it stands
 * on" literally true. It shipped, and CI is exactly where it fired: this
 * repo's own `pass.test.ts` spawns `isocan setup <address>` with `CI=true`
 * inherited and no TTY, so four tests that had nothing to do with this feature
 * quietly started asserting against a direct machine. Green locally, red on
 * CI, and the diagnosis was a report field going undefined.
 *
 * It is gone, and what makes that free is the dialog. "Run an agent in the
 * cloud…" hands over a line carrying `ISOCAN_DIRECT=1`, so the person who
 * meant direct mode says so and still types nothing — the declaration moved
 * from a sniff to the gesture that already expressed the intent. A guess that
 * exists to infer something the UI can state is a guess with no job.
 */
/** Which way a machine works. Two words, used everywhere rather than a
 * boolean, because `direct: false` reads as "not direct" and the alternative
 * has its own name and its own reasons. */
export type Mode = "direct" | "daemon";
/**
 * **THE DEFAULT — and the decision is to delete it, not to flip it**
 * (2026-08-30; the closed entry in `docs/projects/multiuser/phases.md`).
 *
 * What a machine does when nobody has said — no flag, no environment, no
 * config — *and* the canvas it would work lives at a home somewhere else.
 *
 * **The daemon's last justification was offline, and offline for an agent is
 * fiction.** An agent works by reaching a model, so an agent with no network
 * is not an agent whose writes are refused — it is an agent that is not
 * running. That retired the queue and the bridge (phases 12.5 and 12.7), and
 * with them the only reason to keep a replica the CLI could write through
 * while its home was unreachable. `HomeUnreachableError` below never had a
 * fix coming. What the replica actually buys is a read cache, a blob cache,
 * and one warm connection — writes forward synchronously either way, so it
 * adds a hop rather than removing one.
 *
 * **So why this constant is wrong rather than merely pointed the wrong way.**
 * It is a machine-wide answer to a question that stopped being machine-wide
 * in phase 10.3, when the home became a property of the CANVAS — the same
 * altitude mistake the `homeUrl` → `birthHome` rename fixed. Flipping it also
 * fails closed: `setup` with no address (`main.ts`, the mode decision) would
 * resolve to direct with nothing to be direct *to* and throw, on every fresh
 * install and on this repo's own checkout.
 *
 * **What replaces it:** the mode is derived per command from the canvas's
 * home — direct when the canvas lives elsewhere, the daemon when this machine
 * IS the home. Phase 14's care then costs nothing to keep, because a machine
 * holding local canvases is never flipped: its canvases live here.
 *
 * Until that derivation lands this stays `daemon`, which is the honest value
 * for a constant whose replacement is not built yet. Do not flip it on the
 * way past.
 */
export declare const DEFAULT_MODE: Mode;
/** `~/.isocan/config.json`'s keys, written by `setup` and hand-editable. */
export interface DirectConfig {
    /**
     * **The home this machine speaks to directly**, or absent for the ordinary
     * daemon-backed machine.
     *
     * One key carrying both facts — that direct mode is on, and which address —
     * because the two cannot be sensibly separated: direct mode with no home is
     * a CLI with nothing to talk to, and a home address without direct mode is
     * already spelled `home` (the birth default, which means something else).
     */
    direct?: string;
}
/**
 * The one variable, and the reason it beats the config file: a workflow file,
 * a Dockerfile or a harness prompt can set an environment variable and cannot
 * edit `~/.isocan/config.json` on a machine that does not exist yet.
 *
 * Three spellings, because three questions get asked. `ISOCAN_DIRECT=1` says
 * "direct mode, and the address is written down somewhere I can find" — the
 * directory's `.isocan/project.json` marker, which a cloned repo carries.
 * `ISOCAN_DIRECT=https://isocan.io` says both at once, for a workspace with no
 * checkout to read a marker out of. `ISOCAN_DIRECT=0` is the way a machine
 * whose config says direct gets one shell back on a daemon — the symmetry
 * matters, because a setting with no off switch is a trap.
 */
export declare const DIRECT_VAR = "ISOCAN_DIRECT";
/**
 * **Where a declaration came from**, which the report has to be able to say.
 *
 * `setup` reported an `ISOCAN_DIRECT` in the shell as "already set on this
 * machine", and that is the kind of small lie this codebase spends paragraphs
 * avoiding elsewhere: a variable in one shell is not a property of the
 * machine, and somebody who reads that line and then greps `config.json` for
 * the setting finds nothing. The two are also undone by different gestures —
 * `unset ISOCAN_DIRECT` against `isocan direct --clear` — so a report that
 * conflates them names the wrong way out.
 */
export type Source = "env" | "config";
/**
 * **What somebody actually said**, in precedence order, or null for "nobody
 * said anything".
 *
 * Environment first, then the config file, and **nothing else** — there is no
 * third source and no inference. A machine is direct because somebody said so,
 * and `setup` writes the answer down so every later command reads one truth
 * out of a file rather than re-deriving topology from ambient variables.
 */
export declare function resolveDeclared(isocanHome: string): Promise<{
    mode: Mode;
    at: string | null;
    from: Source;
} | null>;
/**
 * **The refusal a daemon-only verb gives on a direct machine.**
 *
 * `serve`, `restart` and `stop` are about a process this machine has decided
 * not to run. Starting one anyway would be the worst available answer: a
 * second replica nobody asked for, queueing toward a home the CLI is already
 * talking to, with the agent's writes landing in whichever of the two it
 * happened to reach. Refusing legibly is the whole of the alternative, and the
 * sentence names the way back because every refusal in this codebase does.
 */
export declare function refuseDaemonVerb(verb: string, at: string): Error;
