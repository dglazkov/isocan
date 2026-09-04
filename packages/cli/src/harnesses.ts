import { promises as fs } from "node:fs";
import path from "node:path";
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
}

/** Adapters isocan knows without being told. `npx -y` so the adapter is
 * fetched on first use rather than shipped — isocan must not own a copy of
 * somebody's harness bridge. */
const BUILTIN_ADAPTERS: Record<string, Omit<AdapterSpec, "harness">> = {
  "claude-code": { command: "npx", args: ["-y", "@zed-industries/claude-code-acp"] },
  // `pi-acp` bridges ACP to `pi --mode rpc`; it needs `pi` on the PATH
  // (`PI_ACP_PI_COMMAND` points it elsewhere). Verified 2026-09-04 against
  // pi-acp 0.0.33 / pi 0.84.2 — see acp.ts's module comment.
  pi: { command: "npx", args: ["-y", "pi-acp"] },
};

/** What "installed" means per harness: the harness's own executable on the
 * PATH. The bridge is fetched on first use, so it is never what is looked
 * for. Absent here means the scan cannot tell (an IDE, a declared adapter). */
const HARNESS_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  pi: "pi",
  codex: "codex",
};

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
    ...Object.keys(raw.acpAdapters ?? {}),
    ...Object.keys(raw.harnessVars ?? {}),
  ]);
  const rows: HarnessRow[] = [];
  for (const name of names) {
    const bin = HARNESS_BINARIES[name];
    const installed = bin ? await onPath(bin, env) : null;
    const adapter = declaredAdapter(raw, name) ? "config" : BUILTIN_ADAPTERS[name] ? "builtin" : null;
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
  const spec = declaredAdapter(raw, wanted) ?? BUILTIN_ADAPTERS[wanted] ?? null;
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
