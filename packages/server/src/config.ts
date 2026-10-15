import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { isLoopbackBase, normalizeHomeUrl } from "@isocan/core";
import { configFile } from "./paths.ts";

/**
 * `~/.isocan/config.json` — this machine's own settings, hand-edited.
 *
 * ONE reader, deliberately. Three callers want this file for three unrelated
 * reasons (the CLI's default canvas, the harness-variable declarations, and
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

/**
 * The one writer, for the few keys a verb settles on the person's behalf
 * (the CLI's default harness). Read-merge-write of the top level only, so a
 * key this writer never heard of survives; a malformed file is treated as
 * empty here too, since keeping it would mean keeping the typo.
 */
export async function updateConfigFile<T extends object>(home: string, patch: Partial<T>): Promise<void> {
  const current = await readConfigFile<T>(home);
  await fs.mkdir(path.dirname(configFile(home)), { recursive: true });
  await fs.writeFile(configFile(home), `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`);
}

/**
 * Per-home credential helper and forward-proxy entry in `~/.isocan/config.json`
 * (`homeAuth[homeUrl]`) or `ISOCAN_HOME_AUTH`.
 */
export interface HomeAuthEntry {
  /** Argv array, JSON-encoded argv string, or executable path run via `execFile` to print proxy auth headers. */
  authHeaderCommand?: readonly string[] | string;
  /** Optional explicit HTTP/HTTPS forward proxy URL for outbound requests to this home. */
  httpProxy?: string;
  /**
   * How `httpProxy` reaches an `https:` home:
   * - `true` (default): HTTP `CONNECT` tunnel; this process performs TLS with the home.
   * - `false`: plain HTTP/1.1 forward request (`Host: <home>`) to a loopback (`127.0.0.1` / `localhost`)
   *   sidecar proxy that originates the upstream TLS / client-certificate connection itself.
   */
  proxyTunnel?: boolean;
  /** Cache TTL in seconds for headers emitted by `authHeaderCommand` (default `300`). */
  ttlSeconds?: number;
}

/** Normalized per-home credential helper and forward-proxy configuration resolved by `homeAuthFor`. */
export interface HomeAuthConfig {
  /** Normalized argv array (`shell: false`) executed to obtain proxy auth headers. */
  authHeaderCommand?: readonly string[];
  /** Normalized forward-proxy URL for this home, when configured. */
  httpProxy?: string;
  /** Whether `httpProxy` uses `CONNECT` tunneling (`true`, default) or plain HTTP/1.1 to a loopback TLS-originating proxy (`false`). */
  proxyTunnel?: boolean;
  /** Positive cache TTL in seconds, when explicitly configured. */
  ttlSeconds?: number;
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
  /**
   * **Per-home transport gateways** — local endpoints (e.g. `"http://127.0.0.1:4442"`)
   * dialled when speaking HTTP or WebSocket to a home whose canonical URL sits
   * behind an authenticating proxy (`"https://canvas.acme.example"`).
   *
   * Canonical `homeUrl` values remain untouched everywhere in `.isocan/project.json`,
   * `homes.json`, `identity.json`, and `expectedHome` checks; only outbound wire
   * connections substitute the gateway origin.
   */
  gateways?: Record<string, string>;
  /**
   * **Per-home external credential helpers and forward proxies** — keyed by
   * canonical `homeUrl` (`"https://canvas.acme.test"`), so the CLI can run a
   * local command (`execFile`, `shell: false`) to obtain short-lived proxy
   * headers and optionally route through an explicit `httpProxy` without a
   * background local gateway daemon.
   */
  homeAuth?: Record<string, HomeAuthEntry>;
}

function parseCommandSpec(raw: unknown): readonly string[] | undefined {
  if (Array.isArray(raw)) {
    if (
      raw.length > 0 &&
      raw.every((part): part is string => typeof part === "string") &&
      raw[0]!.trim().length > 0
    ) {
      return raw;
    }
    return undefined;
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parseCommandSpec(parsed) : undefined;
    } catch {
      return undefined;
    }
  }
  return [trimmed];
}

function normalizeHomeAuthEntry(raw: unknown): HomeAuthConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const authHeaderCommand = parseCommandSpec(record.authHeaderCommand);
  const httpProxy =
    typeof record.httpProxy === "string" && record.httpProxy.trim().length > 0
      ? record.httpProxy.trim()
      : undefined;
  const proxyTunnel =
    typeof record.proxyTunnel === "boolean" ? record.proxyTunnel : undefined;
  const ttlSeconds =
    typeof record.ttlSeconds === "number" &&
    Number.isFinite(record.ttlSeconds) &&
    record.ttlSeconds > 0
      ? record.ttlSeconds
      : undefined;
  if (!authHeaderCommand && !httpProxy) return null;
  return {
    ...(authHeaderCommand ? { authHeaderCommand } : {}),
    ...(httpProxy ? { httpProxy } : {}),
    ...(proxyTunnel !== undefined ? { proxyTunnel } : {}),
    ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
  };
}

/**
 * Resolve the normalized external credential helper and forward-proxy settings
 * for `homeUrl` (`ISOCAN_HOME_AUTH` JSON map first, then `config.json`'s
 * `homeAuth`, and `ISOCAN_AUTH_HEADER_COMMAND` when `homeUrl` matches
 * `ISOCAN_HOME_URL` or `config.json`'s `home` or when no other home is
 * configured). Loopback URLs are intentionally preserved so local proxy tests
 * and SSH tunnels work.
 */
export function homeAuthFor(
  homeUrl: string,
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): HomeAuthConfig | null {
  const canonical = normalizeHomeUrl(homeUrl);
  if (!canonical) return null;
  const lookup = (map: unknown): HomeAuthConfig | null => {
    if (!map || typeof map !== "object" || Array.isArray(map)) return null;
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      if (normalizeHomeUrl(k) !== canonical) continue;
      const entry = normalizeHomeAuthEntry(v);
      if (entry) return entry;
    }
    return null;
  };
  let envMapRaw: unknown = null;
  const fromEnvRaw = env.ISOCAN_HOME_AUTH?.trim();
  if (fromEnvRaw) {
    try {
      envMapRaw = JSON.parse(fromEnvRaw);
    } catch {
      // Malformed JSON falls back to config.json rather than crashing client construction.
    }
  }
  let parsed: HomeConfig | null = null;
  try {
    parsed = JSON.parse(readFileSync(configFile(home), "utf8")) as HomeConfig | null;
  } catch {
    // Missing or malformed config.json is treated as empty.
  }
  const fromEnvMap = lookup(envMapRaw);
  const fromFileMap = lookup(parsed?.homeAuth);
  const envCmd = parseCommandSpec(env.ISOCAN_AUTH_HEADER_COMMAND);
  let cmdApplies = false;
  if (envCmd) {
    const envHome = env.ISOCAN_HOME_URL?.trim() ? normalizeHomeUrl(env.ISOCAN_HOME_URL.trim()) : null;
    const fileHome =
      typeof parsed?.home === "string" && parsed.home.trim()
        ? normalizeHomeUrl(parsed.home.trim())
        : null;
    if (envHome || fileHome) {
      cmdApplies = canonical === envHome || canonical === fileHome;
    } else {
      const configuredUrls = new Set<string>();
      for (const map of [envMapRaw, parsed?.homeAuth]) {
        if (!map || typeof map !== "object" || Array.isArray(map)) continue;
        for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
          const url = normalizeHomeUrl(k);
          if (url && normalizeHomeAuthEntry(v)) configuredUrls.add(url);
        }
      }
      cmdApplies =
        configuredUrls.size === 0 || (configuredUrls.size === 1 && configuredUrls.has(canonical));
    }
  }
  const authHeaderCommand =
    fromEnvMap?.authHeaderCommand ??
    (cmdApplies ? envCmd : undefined) ??
    fromFileMap?.authHeaderCommand;
  const httpProxy = fromEnvMap?.httpProxy ?? fromFileMap?.httpProxy;
  const proxyTunnel = fromEnvMap?.proxyTunnel ?? fromFileMap?.proxyTunnel;
  const ttlSeconds = fromEnvMap?.ttlSeconds ?? fromFileMap?.ttlSeconds;
  if (!authHeaderCommand && !httpProxy) return null;
  return {
    ...(authHeaderCommand ? { authHeaderCommand } : {}),
    ...(httpProxy ? { httpProxy } : {}),
    ...(proxyTunnel !== undefined ? { proxyTunnel } : {}),
    ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
  };
}

/**
 * Return the single normalized `homeUrl` when `homeAuth` has one entry (in
 * `ISOCAN_HOME_AUTH` or `config.json`), or `ISOCAN_HOME_URL` / `config.json`'s
 * `home` when `ISOCAN_AUTH_HEADER_COMMAND` is set. Returns `null` when multiple
 * homes are configured or no `homeAuth` target is unambiguous.
 */
export function configuredHomeAuthUrl(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const singleKey = (map: unknown): string | null | "multiple" => {
    if (!map || typeof map !== "object" || Array.isArray(map)) return null;
    const urls = new Set<string>();
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      const url = normalizeHomeUrl(k);
      if (url && normalizeHomeAuthEntry(v)) urls.add(url);
    }
    if (urls.size === 1) return [...urls][0]!;
    if (urls.size > 1) return "multiple";
    return null;
  };
  const fromEnvRaw = env.ISOCAN_HOME_AUTH?.trim();
  if (fromEnvRaw) {
    try {
      const hit = singleKey(JSON.parse(fromEnvRaw));
      if (hit === "multiple") return null;
      if (hit) return hit;
    } catch {
      // Malformed JSON falls back to config.json.
    }
  }
  let parsed: HomeConfig | null = null;
  try {
    parsed = JSON.parse(readFileSync(configFile(home), "utf8")) as HomeConfig | null;
  } catch {
    // Missing or malformed config.json is treated as empty.
  }
  const fromFile = singleKey(parsed?.homeAuth);
  if (fromFile === "multiple") return null;
  if (fromFile) return fromFile;
  if (parseCommandSpec(env.ISOCAN_AUTH_HEADER_COMMAND)) {
    const envHome = env.ISOCAN_HOME_URL?.trim();
    if (envHome) return normalizeHomeUrl(envHome);
    const fileHome = typeof parsed?.home === "string" ? parsed.home.trim() : "";
    if (fileHome) return normalizeHomeUrl(fileHome);
  }
  return null;
}

/**
 * Resolve the transport dial URL for a canonical `homeUrl`, or `null` when no
 * gateway is configured (`ISOCAN_HOME_GATEWAYS` env JSON first, then `gateways`
 * in `config.json`).
 */
export function gatewayBaseFor(
  homeUrl: string,
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const canonical = normalizeHomeUrl(homeUrl);
  const lookup = (map: unknown): string | null => {
    if (!map || typeof map !== "object") return null;
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      if (typeof v !== "string" || !v.trim()) continue;
      if (normalizeHomeUrl(k) === canonical) return normalizeHomeUrl(v.trim());
    }
    return null;
  };
  const fromEnv = env.ISOCAN_HOME_GATEWAYS?.trim();
  if (fromEnv) {
    try {
      const hit = lookup(JSON.parse(fromEnv));
      if (hit) return hit;
    } catch {
      // Malformed JSON falls back to config.json rather than crashing client construction.
    }
  }
  if (isLoopbackBase(canonical)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configFile(home), "utf8")) as HomeConfig | null;
    return lookup(parsed?.gateways);
  } catch {
    return null;
  }
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
