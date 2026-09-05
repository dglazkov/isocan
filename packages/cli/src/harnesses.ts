import { execFile } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { builtinHarnesses } from "@isocan/api";
import { readConfigFile, updateConfigFile } from "@isocan/server";

/**
 * **Which harness runs an agent that named none** (decided 2026-09-04).
 *
 * An enrolment's rc half carries a harness, or null for "not yet said". Two
 * of the three doors leave it null — the web dialog cannot know, and a plain
 * terminal's `rc add` has no harness of its own — so null used to mean
 * claude-code, which made a pi user's every web-added agent a Claude Code
 * agent, or a boot failure, with nothing saying why.
 *
 * Null now means **the machine's default**, and the machine answers that
 * question by looking, not by being told: a scan of what is installed here
 * against what the rc can bridge. One runnable harness needs no decision.
 * Two need one, asked once at `isocan rc` start (a TTY) and persisted as
 * `defaultHarness` in config.json, or given as `isocan rc --default-harness <name>`
 * (which is also how a launchd start answers). The scan itself is never
 * persisted, so the day a second harness is installed, the rc notices and
 * asks. `isocan harness` prints the same scan for a person or an agent.
 */

/** `config.json`'s hooks: `{"acpAdapters": {"my-harness": ["cmd", "arg"]}}`
 * (the same posture as `harnessVars`: a harness isocan has never heard of
 * works the day it ships) and `{"defaultHarness": "pi"}`. */
interface HarnessConfig {
  acpAdapters?: Record<string, string[] | string>;
  harnessVars?: Record<string, string>;
  defaultHarness?: string;
}

export interface AdapterSpec {
  harness: string;
  command: string;
  args: string[];
  /** Variables the bridge itself needs, laid over the person's environment
   * at spawn — a builtin's knowledge of its own harness, never a person's
   * setting. */
  env?: Record<string, string>;
  /** Make sure the bridge is here before spawning — a builtin fetched on
   * first use rather than shipped. Narrates through the callback, and
   * returns the command and args the registry says NOW, which the caller
   * lays over the spec (a fresh index may name a newer version). */
  ensure?: (narrate: (line: string) => void) => Promise<Pick<AdapterSpec, "command" | "args"> | void>;
}

/**
 * **Builtins are registry ids** (decided 2026-09-05). The ACP registry
 * publishes a hosted index — `REGISTRY_URL`, refreshed hourly from npm,
 * PyPI and GitHub releases — in which every agent carries its current
 * version and either an npm package or a per-platform archive with its
 * command. That is the official path Zed and the other clients walk, and
 * the first build of this file walked around it: five dl.google.com URLs
 * and a version typed in by hand, stale the day Google bumped the entry,
 * and a Claude package pinned under a name npm has since deprecated.
 *
 * So a builtin names its registry id and nothing else. Resolution reads
 * the index — the cached copy in the home, refreshed on a spawn when it
 * is older than an hour — and turns the entry into a spec: `npx -y
 * <package@version>` for an npm distribution, or a binary fetched once
 * into `~/.isocan/adapters/<id>/<version>/` for an archive one. `PINNED`
 * is what the index said on the day this was written, used only by a
 * machine that cannot reach the CDN and has never cached it.
 */
export const REGISTRY_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

export const REGISTRY_IDS: Record<string, string> = {
  "claude-code": "claude-acp",
  pi: "pi-acp",
  codex: "codex-acp",
  antigravity: "antigravity-acp",
};

/** What isocan knows about a harness that the registry does not: the
 * variables its bridge needs. codex's default sandbox refuses loopback
 * network — the CLI inside could not reach the daemon (curl exit 7 with it
 * up) — so its bridge runs in full-access mode: the same provisional trust
 * the rc already extends by auto-allowing every permission (acp.ts).
 * NO_BROWSER because a summoned session has nobody to finish a browser
 * login. Verified 2026-09-04 against codex-acp 1.10.0 / codex 0.147.0. */
const BUILTIN_ENV: Record<string, Record<string, string>> = {
  codex: { INITIAL_AGENT_MODE: "agent-full-access", NO_BROWSER: "1" },
};

export interface RegistryBinary {
  archive: string;
  cmd: string;
  args?: string[];
}

export interface RegistryAgent {
  id: string;
  version: string;
  distribution: {
    npx?: { package: string; args?: string[] };
    binary?: Record<string, RegistryBinary>;
  };
}

/** The index as the CDN served it on 2026-09-05, for a machine that has
 * never reached it. Antigravity's Google-account login refused the first
 * account it was tried with; its `gemini-api-key` method reads
 * GEMINI_API_KEY, which `acp.ts` answers the login refusal with. */
const PINNED: Record<string, RegistryAgent> = {
  "claude-acp": {
    id: "claude-acp",
    version: "0.74.0",
    distribution: { npx: { package: "@agentclientprotocol/claude-agent-acp@0.74.0" } },
  },
  "pi-acp": { id: "pi-acp", version: "0.0.33", distribution: { npx: { package: "pi-acp@0.0.33" } } },
  "codex-acp": {
    id: "codex-acp",
    version: "1.10.0",
    distribution: { npx: { package: "@agentclientprotocol/codex-acp@1.10.0" } },
  },
  "antigravity-acp": {
    id: "antigravity-acp",
    version: "1.1.1",
    distribution: {
      binary: {
        "darwin-aarch64": {
          archive: "https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-agy_acp_server_1.1.1-darwin-arm64.zip",
          cmd: "./agy_acp_server.par",
        },
        "linux-x86_64": {
          archive: "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-agy_acp_server_1.1.1-linux-x86_64.zip",
          cmd: "./agy_acp_server.par",
          args: ["--uid="],
        },
        "linux-aarch64": {
          archive: "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-agy_acp_server_1.1.1-linux-arm64.zip",
          cmd: "./agy_acp_server.par",
          args: ["--uid="],
        },
        "windows-x86_64": {
          archive: "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-agy_acp_server_1.1.1-windows-x86_64.zip",
          cmd: "./agy_acp_server.exe",
        },
        "windows-aarch64": {
          archive: "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-agy_acp_server_1.1.1-windows-arm64.zip",
          cmd: "./agy_acp_server.exe",
        },
      },
    },
  },
};

/** The registry's spelling of this machine. */
export function platformKey(platform = process.platform, arch = process.arch): string {
  const os = platform === "win32" ? "windows" : platform;
  const cpu = arch === "arm64" ? "aarch64" : arch === "x64" ? "x86_64" : arch;
  return `${os}-${cpu}`;
}

export const adaptersDir = (home: string) => path.join(home, "adapters");
export const registryIndexFile = (home: string) => path.join(adaptersDir(home), "registry.json");
export const binaryDir = (home: string, id: string, version: string) => path.join(adaptersDir(home), id, version);

interface CachedIndex {
  fetchedAt: string;
  agents: RegistryAgent[];
}

const INDEX_FRESH_MS = 3_600_000;

async function readIndex(home: string): Promise<CachedIndex | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(registryIndexFile(home), "utf8")) as CachedIndex;
    return Array.isArray(parsed.agents) ? parsed : null;
  } catch {
    return null;
  }
}

/** Fetch the index and cache it. Throws on any failure; the caller decides
 * what a failure costs (nothing, when a cached or pinned entry exists).
 * `ISOCAN_ACP_REGISTRY` points a test at a local copy. */
export async function refreshIndex(
  home: string,
  url = process.env.ISOCAN_ACP_REGISTRY || REGISTRY_URL,
): Promise<CachedIndex> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`the ACP registry answered HTTP ${res.status}`);
  const body = (await res.json()) as { agents?: RegistryAgent[] };
  if (!Array.isArray(body.agents)) throw new Error("the ACP registry index has no agents");
  const cached: CachedIndex = { fetchedAt: new Date().toISOString(), agents: body.agents };
  await fs.mkdir(adaptersDir(home), { recursive: true });
  await fs.writeFile(registryIndexFile(home), `${JSON.stringify(cached, null, 2)}\n`);
  return cached;
}

/**
 * The registry's entry for an id: the cached index, refreshed when asked
 * and stale, else the pin. `refresh` is false on the read paths (the scan,
 * `isocan harness`, `who`) — a table must not wait on the network — and
 * true at spawn, where a stale answer would install last month's bridge.
 */
export async function registryEntry(
  home: string,
  id: string,
  options: { refresh?: boolean; narrate?: (line: string) => void } = {},
): Promise<RegistryAgent | null> {
  let index = await readIndex(home);
  const stale = !index || Date.now() - Date.parse(index.fetchedAt) > INDEX_FRESH_MS;
  if (options.refresh && stale) {
    try {
      index = await refreshIndex(home);
    } catch (err) {
      options.narrate?.(
        `the ACP registry could not be read (${(err as Error).message}) — using ${index ? "the cached index" : "the built-in pin"}`,
      );
    }
  }
  return index?.agents.find((a) => a.id === id) ?? PINNED[id] ?? null;
}

/** A spec from a registry entry, or null where the entry has nothing for
 * this platform. */
function specFromEntry(home: string, harness: string, entry: RegistryAgent): Omit<AdapterSpec, "harness"> | null {
  const env = BUILTIN_ENV[harness];
  if (entry.distribution.npx) {
    const { package: pkg, args = [] } = entry.distribution.npx;
    return { command: "npx", args: ["-y", pkg, ...args], ...(env ? { env } : {}) };
  }
  const binary = entry.distribution.binary?.[platformKey()];
  if (!binary) return null;
  return {
    command: path.join(binaryDir(home, entry.id, entry.version), binary.cmd.replace(/^\.\//, "")),
    args: binary.args ?? [],
    ...(env ? { env } : {}),
  };
}

/** Any version of a binary distribution present in the home. */
export async function binaryInstalled(home: string, id: string, cmd: string): Promise<boolean> {
  const name = cmd.replace(/^\.\//, "");
  try {
    for (const version of await fs.readdir(path.join(adaptersDir(home), id))) {
      try {
        await fs.access(path.join(binaryDir(home, id, version), name), fs.constants.X_OK);
        return true;
      } catch {
        // not this version
      }
    }
  } catch {
    // never fetched
  }
  return false;
}

/**
 * Fetch and unpack a binary distribution into the home, once. `unzip`
 * does the unpacking (Antigravity's archive is 300 MB; a pure-JS unzip of
 * that is not worth owning). The zip lands beside the result and is
 * removed after, so a failed fetch leaves no half-bridge that
 * `binaryInstalled` believes.
 */
export async function ensureBinary(
  home: string,
  id: string,
  version: string,
  binary: RegistryBinary,
  narrate: (line: string) => void,
  options: { url?: string } = {},
): Promise<void> {
  const dir = binaryDir(home, id, version);
  const cmd = binary.cmd.replace(/^\.\//, "");
  try {
    await fs.access(path.join(dir, cmd), fs.constants.X_OK);
    return;
  } catch {
    // not yet
  }
  await fs.mkdir(dir, { recursive: true });
  const url = options.url ?? binary.archive;
  narrate(`fetching ${id} ${version} (once; Antigravity's is about 300 MB) → ${dir}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetching ${url}: HTTP ${res.status}`);
  const zip = path.join(dir, "archive.zip");
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(zip));
  try {
    await promisify(execFile)("unzip", ["-o", "-q", zip, "-d", dir]);
  } catch (err) {
    throw new Error(`unpacking ${id} needs \`unzip\` on the PATH — ${(err as Error).message}`);
  } finally {
    await fs.rm(zip, { force: true });
  }
  await fs.chmod(path.join(dir, cmd), 0o755).catch(() => {});
  try {
    await fs.access(path.join(dir, cmd), fs.constants.X_OK);
  } catch {
    throw new Error(`the ${id} archive did not contain ${cmd}`);
  }
  narrate(`${id} ${version} ready`);
}

/** The builtin for a harness, resolved without the network: the cached
 * index or the pin. Its `ensure` is where the network happens — the index
 * refreshed if stale, the spec re-read from the fresh entry, a binary
 * fetched if missing — so a spawn runs what the registry says now. */
async function builtinAdapter(home: string, name: string): Promise<Omit<AdapterSpec, "harness"> | null> {
  const id = REGISTRY_IDS[name];
  if (!id) return null;
  const entry = await registryEntry(home, id);
  if (!entry) return null;
  const spec = specFromEntry(home, name, entry);
  if (!spec) return null;
  const ensure = async (narrate: (line: string) => void) => {
    const fresh = (await registryEntry(home, id, { refresh: true, narrate })) ?? entry;
    const current = specFromEntry(home, name, fresh) ?? spec;
    const binary = fresh.distribution.binary?.[platformKey()];
    if (binary) await ensureBinary(home, id, fresh.version, binary, narrate);
    return { command: current.command, args: current.args };
  };
  return { ...spec, ensure };
}

/** What "installed" means per harness: the harness's own executable on the
 * PATH. The bridge is fetched on first use, so it is never what is looked
 * for. Absent here means the scan cannot tell (an IDE, a declared adapter). */
const HARNESS_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  pi: "pi",
  codex: "codex",
};

/** A binary distribution is the exception: neither `agy` on the PATH nor
 * the IDE implies Antigravity's ACP server, which is its own download with
 * its own login. Installed means the bridge is in the home. */
async function installedProbe(home: string, name: string, env: NodeJS.ProcessEnv): Promise<boolean | null> {
  const id = REGISTRY_IDS[name];
  const entry = id ? await registryEntry(home, id) : null;
  if (entry?.distribution.binary) {
    const binary = entry.distribution.binary[platformKey()];
    return binary ? binaryInstalled(home, id!, binary.cmd) : false;
  }
  const bin = HARNESS_BINARIES[name];
  return bin ? onPath(bin, env) : null;
}

export interface HarnessRow {
  name: string;
  /** The harness's executable is on the PATH; null when there is nothing to
   * look for. */
  installed: boolean | null;
  /** Where the rc would get its bridge from, or null: known but unrunnable. */
  adapter: "builtin" | "config" | null;
  /** Could run here: a declared adapter (deliberate, so believed as is), or
   * a builtin one whose harness is not known to be absent. */
  runnable: boolean;
  /** The one an agent that named no harness runs on. */
  default: boolean;
}

export interface HarnessScan {
  rows: HarnessRow[];
  default: HarnessRow | null;
  /** How the default was settled: persisted, or the only choice. */
  source: "config" | "only" | null;
  /** A persisted default the scan could not honour — named, so the person
   * hears that their choice was set aside rather than silently replaced. */
  ignored: string | null;
}

async function onPath(bin: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    try {
      await fs.access(path.join(dir, bin), fs.constants.X_OK);
      return true;
    } catch {
      // not here
    }
  }
  return false;
}

function declaredAdapter(
  raw: HarnessConfig,
  name: string,
): Omit<AdapterSpec, "harness"> | null {
  const declared = raw.acpAdapters?.[name];
  if (typeof declared === "string" && declared.trim()) {
    const [command, ...args] = declared.trim().split(/\s+/);
    return { command: command!, args };
  }
  if (Array.isArray(declared) && declared.length > 0 && declared.every((p) => typeof p === "string")) {
    return { command: declared[0]!, args: declared.slice(1) };
  }
  return null;
}

/** Everything this machine could run, and which one it runs by default.
 * A fact about the machine — no daemon is consulted. `env` is a parameter
 * so a test can hand it a PATH. */
export async function scanHarnesses(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HarnessScan> {
  const raw = await readConfigFile<HarnessConfig>(home);
  const names = new Set<string>([
    ...builtinHarnesses,
    ...Object.keys(REGISTRY_IDS),
    ...Object.keys(raw.acpAdapters ?? {}),
    ...Object.keys(raw.harnessVars ?? {}),
  ]);
  const rows: HarnessRow[] = [];
  for (const name of names) {
    const installed = await installedProbe(home, name, env);
    const adapter = declaredAdapter(raw, name) ? "config" : (await builtinAdapter(home, name)) ? "builtin" : null;
    const runnable = adapter === "config" || (adapter === "builtin" && installed !== false);
    rows.push({ name, installed, adapter, runnable, default: false });
  }
  const runnable = rows.filter((r) => r.runnable);
  const wanted = typeof raw.defaultHarness === "string" ? raw.defaultHarness.trim() : "";
  const chosen = wanted ? runnable.find((r) => r.name === wanted) ?? null : null;
  const settled = chosen ?? (runnable.length === 1 ? runnable[0]! : null);
  if (settled) settled.default = true;
  return {
    rows,
    default: settled,
    source: chosen ? "config" : settled ? "only" : null,
    ignored: wanted && !chosen ? wanted : null,
  };
}

/** `isocan rc --default-harness <name>`'s write: the answer, kept. */
export async function setDefaultHarness(home: string, name: string): Promise<void> {
  await updateConfigFile<HarnessConfig>(home, { defaultHarness: name });
}

/** The adapter for a harness — config first, then builtin — or, for a null
 * harness ("not yet said"), the machine's default. Null when nothing can
 * answer; the caller owes a refusal, and `noDefaultLine` words the null
 * case. */
export async function adapterFor(
  home: string,
  harness: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdapterSpec | null> {
  const wanted = harness ?? (await scanHarnesses(home, env)).default?.name ?? null;
  if (!wanted) return null;
  const raw = await readConfigFile<HarnessConfig>(home);
  const spec = declaredAdapter(raw, wanted) ?? (await builtinAdapter(home, wanted)) ?? null;
  return spec ? { harness: wanted, ...spec } : null;
}

/** One line for the rc's start, saying what an unnamed harness means here. */
export function defaultLine(scan: HarnessScan): string {
  if (scan.default && scan.source === "config") {
    return `agents that named no harness run on ${scan.default.name} (config.json's defaultHarness)`;
  }
  if (scan.default) {
    return `${scan.default.name} is the only harness here — agents that named no harness run on it`;
  }
  return noDefaultLine(scan);
}

/** Why an agent that named no harness cannot run here — said as what it
 * is for, never as "no default", which names a config key and nothing a
 * person can see — and what settles it. */
export function noDefaultLine(scan: HarnessScan): string {
  const runnable = scan.rows.filter((r) => r.runnable).map((r) => r.name);
  const ignored = scan.ignored ? `config.json's defaultHarness "${scan.ignored}" is not runnable here; ` : "";
  if (runnable.length === 0) {
    return (
      `${ignored}no harness found on this machine — install pi (npm i -g @earendil-works/pi-coding-agent) ` +
      `or Claude Code, or declare an adapter in ~/.isocan/config.json ` +
      `({"acpAdapters": {"<harness>": ["cmd", "arg"]}})`
    );
  }
  return (
    `${ignored}${runnable.length} harnesses here (${runnable.join(", ")}); an agent added without naming one ` +
    `can't run until \`isocan rc --default-harness <name>\` picks which`
  );
}

/** The start line when two could run, none is picked, and nothing needs
 * it yet: the fact, without the flag — that belongs in the refusal, where
 * it is the next thing to type. */
export function noNeedLine(scan: HarnessScan): string {
  const runnable = scan.rows.filter((r) => r.runnable).map((r) => r.name);
  const ignored = scan.ignored ? `config.json's defaultHarness "${scan.ignored}" is not runnable here; ` : "";
  return `${ignored}${runnable.length} harnesses here (${runnable.join(", ")}); every agent enrolled here named its own`;
}
