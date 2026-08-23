import { promises as fs } from "node:fs";
import { configFile } from "./paths.ts";

/**
 * `~/.isocan/config.json` — this machine's own settings, hand-edited.
 *
 * ONE reader, deliberately. Three callers want this file for three unrelated
 * reasons (the CLI's default project, the harness-variable declarations, and
 * now which home this daemon is a replica of), and three `JSON.parse` calls in
 * three `try` blocks is three chances to disagree about what a malformed file
 * means. It means the same thing to all of them: nothing. A typo in a
 * hand-edited file must not cost an agent its identity, must not stop a daemon
 * booting, and must not be the reason a replica silently believes it is a
 * home — it costs exactly the settings the file was carrying, and every caller
 * falls back to what it does with no file at all.
 *
 * Generic rather than one big interface because the shape belongs to the
 * caller: the CLI's keys are the CLI's business, and a server module that
 * declared `harnessVars` would be claiming to know about coding harnesses.
 */
export async function readConfigFile<T extends object>(home: string): Promise<Partial<T>> {
  try {
    const parsed = JSON.parse(await fs.readFile(configFile(home), "utf8")) as unknown;
    // `null` parses fine and is not an object; so does `3`, and `"x"`. Every
    // caller then does `raw.something` on it and gets a TypeError from a
    // hand-edited file, which is the one outcome this reader exists to avoid.
    return parsed !== null && typeof parsed === "object" ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
}

/** The one key this package reads for itself. */
export interface HomeConfig {
  /** The address of the home this daemon replicates — `https://isocan.io`. */
  home?: string;
}

/**
 * The home this daemon is a REPLICA of, or null when it is a home itself.
 *
 * Environment first (`ISOCAN_HOME_URL`), then `~/.isocan/config.json`'s
 * `home`, and **no compiled-in default**. That last part is the load-bearing
 * one: a daemon with nothing configured is a home, which is exactly what every
 * daemon in this repo is today, so this whole mechanism is invisible until
 * somebody configures it. Baking `isocan.io` in as a fallback would silently
 * demote every existing local daemon the day it shipped — that default belongs
 * to phase 14, where setup writes the address down on purpose.
 *
 * Configuration rather than a flag, for the reason `ISOCAN_BIND` and
 * `ISOCAN_STORE` are: which home a daemon answers to is innkeeper
 * configuration, not a per-invocation choice an agent should be able to reach
 * for. A `--home-url` flag on `isocan serve` would be a surface an agent could
 * use to point a daemon at a home nobody chose.
 *
 * Phase 6 stage 2 hangs the actual home connection off this same answer, which
 * is why it is a function rather than an inline `process.env` read here and a
 * second one there.
 */
export async function resolveHomeUrl(home: string): Promise<string | null> {
  const fromEnv = process.env.ISOCAN_HOME_URL?.trim();
  if (fromEnv) return fromEnv;
  const config = await readConfigFile<HomeConfig>(home);
  const configured = typeof config.home === "string" ? config.home.trim() : "";
  return configured || null;
}
