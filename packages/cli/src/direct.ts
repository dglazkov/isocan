import { normalizeHomeUrl } from "@isocan/core";
import { readConfigFile } from "@isocan/server";

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
 * **THE DEFAULT, and it is one line on purpose.**
 *
 * What a machine does when nobody has said — no flag, no environment, no
 * config — *and* the canvas it would work lives at a home somewhere else.
 *
 * It is `daemon` today, and the argument for flipping it is live rather than
 * settled. Against the daemon: its headline justification is offline, and
 * offline has never worked for the CLI — `HomeUnreachableError` in
 * `home-link.ts` refuses a replica's CLI write when the home is unreachable,
 * deliberately, and says so. Writes forward synchronously to the home's
 * single-writer pipeline either way, so the replica adds a hop to every write
 * rather than removing one; only reads are served locally. And a machine with
 * no CLI replica has exactly ONE replica (the browser's, from phase 10)
 * instead of two that cannot see each other — which is the entire premise of
 * the local-bridge debt.
 *
 * For the daemon: fast reads, blobs cached on disk by hash, and the airplane
 * scene the bridge is meant to buy — a person in the browser and their agent
 * in the terminal, one canvas, no network. Flipping this makes that scene
 * impossible-and-honest rather than half-built.
 *
 * **The evidence to decide is a real session, not an argument**, which is why
 * the switch exists before the decision does. When it flips, it flips the way
 * phase 14 flipped the birth default: consulted at `setup` and NEVER for a
 * machine that already holds canvases, with a receipt and a way back.
 */
export const DEFAULT_MODE: Mode = "daemon";

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
export const DIRECT_VAR = "ISOCAN_DIRECT";

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
export async function resolveDeclared(
  isocanHome: string,
): Promise<{ mode: Mode; at: string | null; from: Source } | null> {
  const fromEnv = process.env[DIRECT_VAR]?.trim();
  if (fromEnv) {
    if (isFalsy(fromEnv)) return { mode: "daemon", at: null, from: "env" };
    // `1`/`true` means "direct, address from the marker or the config"; a URL
    // means both at once. Returning a null address is not a failure — "on,
    // address unknown" is a real state, and the caller resolves it against
    // whatever the directory knows.
    if (isTruthy(fromEnv)) {
      return { mode: "direct", at: await configuredDirect(isocanHome), from: "env" };
    }
    return { mode: "direct", at: normalizeHomeUrl(fromEnv), from: "env" };
  }
  const at = await configuredDirect(isocanHome);
  return at ? { mode: "direct", at, from: "config" } : null;
}

async function configuredDirect(isocanHome: string): Promise<string | null> {
  const config = await readConfigFile<DirectConfig>(isocanHome);
  const configured = typeof config.direct === "string" ? config.direct.trim() : "";
  return configured ? normalizeHomeUrl(configured) : null;
}

const isTruthy = (value: string): boolean =>
  ["1", "true", "yes", "on"].includes(value.toLowerCase());
const isFalsy = (value: string): boolean =>
  ["0", "false", "no", "off"].includes(value.toLowerCase());

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
export function refuseDaemonVerb(verb: string, at: string): Error {
  return new Error(
    `this machine is direct — it runs no daemon, and \`isocan ${verb}\` is about one. ` +
      `Commands here speak to ${at} itself, so there is nothing to ${verb}. ` +
      "`isocan direct --clear` gives this machine a daemon and a replica of its own.",
  );
}
