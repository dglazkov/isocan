import path from "node:path";
import { readConfigFile } from "@isocan/server";
import type { AdapterSpec } from "./harnesses.ts";

interface NativeConfig { codexSandbox?: boolean; codexSandboxDomains?: string[] }
/** A separate opt-in: this bounds Codex's tools, not the ACP adapter process or file reads. */
export async function codexSandboxAsked(home: string, flags: { codexSandbox?: boolean; unsandboxed?: boolean }): Promise<boolean> {
  if (flags.unsandboxed && flags.codexSandbox) throw new Error("Choose --codex-sandbox or --unsandboxed");
  if (flags.unsandboxed) return false;
  return flags.codexSandbox ?? (await readConfigFile<NativeConfig>(home)).codexSandbox === true;
}

/** Codex ACP 1.11 is the minimum bridge version whose additional-directories contract was measured here. */
export function supportsCodexSandbox(version: unknown): boolean {
  if (typeof version !== "string") return false;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:$|[-+])/.exec(version);
  return !!match && (Number(match[1]) > 1 || (Number(match[1]) === 1 && Number(match[2]) >= 11));
}

/** Configure the native fence at the same boundary used by manual and parked turns.
 * Exact daemon hosts avoid the broader allow_local_binding exception. Extra
 * network destinations are an explicit local config choice, never read from a canvas. */
export async function codexSandboxSpec(spec: AdapterSpec, home: string, daemon: string, platform = process.platform): Promise<AdapterSpec> {
  if (spec.harness !== "codex") return spec;
  if (platform !== "darwin" && platform !== "linux") throw new Error("--codex-sandbox is supported on macOS and Linux; use WSL2 on Windows");
  const url = new URL(daemon);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("The sandbox daemon must be an HTTP(S) address");
  const raw = await readConfigFile<NativeConfig>(home);
  const extra = raw.codexSandboxDomains ?? [];
  if (!Array.isArray(extra) || extra.some(host => typeof host !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host))) {
    throw new Error("codexSandboxDomains must list exact hostnames, without schemes, ports or wildcards");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const hosts = [hostname, ...extra];
  // Keep unrelated bridge overrides (model, provider, etc.) while making the
  // fence authoritative. The user's config.toml domain rules still compose.
  const inherited = JSON.parse(spec.env?.CODEX_CONFIG ?? process.env.CODEX_CONFIG ?? "{}");
  if (!inherited || typeof inherited !== "object" || Array.isArray(inherited)) throw new Error("CODEX_CONFIG must be a JSON object");
  const config = { ...inherited, approval_policy: "never", sandbox_mode: "workspace-write",
    sandbox_workspace_write: { ...inherited.sandbox_workspace_write, network_access: true },
    features: { ...inherited.features, network_proxy: { ...inherited.features?.network_proxy,
      enabled: true, allow_local_binding: false,
      domains: { ...inherited.features?.network_proxy?.domains, ...Object.fromEntries(hosts.map(host => [host, "allow"])) },
    } },
  };
  return { ...spec, nativeCodexSandbox: true, sessionDirectories: [path.resolve(home)],
    env: { ...spec.env, INITIAL_AGENT_MODE: "read-only", NO_BROWSER: "1", CODEX_CONFIG: JSON.stringify(config) } };
}
