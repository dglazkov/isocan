import { promises as fs } from "node:fs";
import { normalizeHomeUrl } from "@isocan/core";
import { configFile } from "./paths.ts";

/**
 * `~/.isocan/config.json` — this machine's own settings, hand-edited.
 *
 * ONE reader, deliberately. Three callers want this file for three unrelated
 * reasons (the CLI's default project, the harness-variable declarations, and
 * now where a canvas born on this machine goes), and three `JSON.parse` calls in
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
  /**
   * **The birth default** — where a canvas born on this machine, naming
   * nothing, is born. `https://isocan.io`.
   *
   * **Re-purposed by phase 10.3, deliberately not renamed.** It used to mean
   * "the home this daemon answers to", a whole-daemon property that demoted
   * every canvas on the disk at once. It now decides one thing: where the
   * NEXT canvas goes. Which home an existing canvas belongs to is a per-canvas
   * row in `homes.json`, written at binding and never inferred.
   *
   * An existing `home: X` on an upgraded machine therefore means "canvases
   * born here go to X" — and because the boot migration
   * (`recordWhereTheCanvasesAlreadyLive`) freezes every canvas already held at
   * X, **the effective behaviour on upgrade day is identical**. That is the
   * whole reason the key kept its name: renaming it to `birthHome` would have
   * an upgraded daemon read an old file, find no key, silently birth new
   * canvases locally, and report "home" to a person who configured a replica —
   * a silent behaviour change bought for nothing. Reading both spellings would
   * mean two spellings forever.
   */
  home?: string;
}

/**
 * The birth default: where a canvas born here goes, or null when it stays
 * here.
 *
 * Environment first (`ISOCAN_HOME_URL`), then `~/.isocan/config.json`'s
 * `home`, and **no compiled-in default**. That last part is the load-bearing
 * one: a daemon with nothing configured births locally, which is exactly what
 * every daemon in this repo does today, so this whole mechanism is invisible
 * until somebody configures it. Baking `isocan.io` in as a fallback would
 * change where every existing local daemon's next canvas landed the day it
 * shipped — that default belongs to phase 14, where setup writes the address
 * down on purpose. Phase 10.3 is what makes flipping it SAFE: a shipped
 * default is consulted only at a birth, so it can never re-point work that
 * already exists.
 *
 * Configuration rather than a flag, for the reason `ISOCAN_BIND` and
 * `ISOCAN_STORE` are: this is innkeeper configuration, not a per-invocation
 * choice an agent should be able to reach for. A `--home-url` flag on `isocan
 * serve` would be a surface an agent could use to point a daemon at a home
 * nobody chose. `ISOCAN_HOME_URL` keeps working with the same precedence and
 * the narrower meaning — it used to demote a whole daemon, and now says only
 * "canvases born here are born there".
 */
export async function resolveHomeUrl(home: string): Promise<string | null> {
  // Normalized on the way out, because from phase 10.3 this string is a KEY —
  // the registry's, the badge's, the presence mirror's — and two spellings of
  // one address are two links, two badges and the same face twice in a roster.
  // `normalizeHomeUrl` is total on purpose: a trailing slash in a hand-edited
  // config file must not be a daemon that will not boot.
  const fromEnv = process.env.ISOCAN_HOME_URL?.trim();
  if (fromEnv) return normalizeHomeUrl(fromEnv);
  const config = await readConfigFile<HomeConfig>(home);
  const configured = typeof config.home === "string" ? config.home.trim() : "";
  return configured ? normalizeHomeUrl(configured) : null;
}
