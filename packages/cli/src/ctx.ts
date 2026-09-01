import { promises as fs } from "node:fs";
import type { Command } from "commander";
import type { MetaPatch } from "@isocan/core";
import { paths, readConfigFile, type HomeConfig } from "@isocan/server";
import type { UpgradeConfig } from "./managed.ts";
import {
  resolveCtx,
  type Ctx,
  type DirectConfig,
  type HarnessVarConfig,
  type HomeDefaultConfig,
} from "@isocan/api";

/**
 * **The commander half of context-making** — what stayed behind when the
 * resolution moved to `@isocan/api` (iso-api phase 1).
 *
 * The line is the one the design drew, visible in `makeCtx`'s old signature:
 * reading a `Command`'s flags is the CLI's job; resolving home, daemon,
 * badge, actor and canvas from the directory and the environment is the
 * API's, because it has to be the same act for a script that never parsed
 * argv. Everything below either reads flags or writes the CLI's own config.
 */

/**
 * Which canvas the flags name: `--canvas`, or `--project` — the hidden alias
 * kept working through phase 13.5's rename so nothing anybody scripted broke.
 */
export function canvasRefOf(opts: { canvas?: string; project?: string }): string | undefined {
  return opts.canvas ?? opts.project;
}

export async function makeCtx(cmd: Command): Promise<Ctx> {
  const opts = cmd.optsWithGlobals() as {
    json?: boolean;
    port?: string;
    canvas?: string;
    /** `--project`, the hidden alias kept from before phase 13.5's rename. */
    project?: string;
  };
  return resolveCtx({
    json: opts.json ?? false,
    ...(opts.port ? { port: Number(opts.port) } : {}),
    ...(canvasRefOf(opts) !== undefined ? { canvasRef: canvasRefOf(opts)! } : {}),
  });
}

interface ConfigFile
  extends HarnessVarConfig,
    HomeConfig,
    UpgradeConfig,
    DirectConfig,
    HomeDefaultConfig {}

/** One reader for `config.json`, in `@isocan/server` — the daemon reads the
 * same file for `home` now, and three hand-rolled `try { JSON.parse }` blocks
 * is three chances to disagree about what a malformed file means. */
export async function readConfig(home: string): Promise<ConfigFile> {
  return readConfigFile<ConfigFile>(home);
}

export async function writeConfig(home: string, config: ConfigFile): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(paths.configFile(home), JSON.stringify(config, null, 2));
}

/** Build a MetaPatch from --title/--description/--prop/--rm-prop flags. */
export function metaPatch(opts: {
  title?: string;
  description?: string;
  prop?: Record<string, string>;
  rmProp?: string[];
}): MetaPatch {
  const patch: MetaPatch = {};
  if (opts.title !== undefined) patch.title = opts.title;
  if (opts.description !== undefined) patch.description = opts.description;
  if (opts.prop && Object.keys(opts.prop).length > 0) patch.properties = opts.prop;
  if (opts.rmProp && opts.rmProp.length > 0) patch.removeProperties = opts.rmProp;
  return patch;
}
