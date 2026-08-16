import { promises as fs } from "node:fs";
import type { Command } from "commander";
import type { Actor, MetaPatch, Project } from "@isocan/core";
import { DEFAULT_PORT } from "@isocan/core";
import { paths } from "@isocan/server";
import { DaemonClient } from "./client.ts";
import { requireIdentity } from "./identity.ts";

export interface Ctx {
  client: DaemonClient;
  actor: Actor;
  json: boolean;
  home: string;
  projectRef?: string;
}

export async function makeCtx(cmd: Command): Promise<Ctx> {
  const opts = cmd.optsWithGlobals() as {
    json?: boolean;
    port?: string;
    project?: string;
  };
  const home = paths.isocanHome();
  const port = opts.port ? Number(opts.port) : Number(process.env.ISOCAN_PORT ?? DEFAULT_PORT);
  const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
  const actor = await requireIdentity(home, process.cwd());
  await client.ensureDaemon();
  return {
    client,
    actor,
    json: opts.json ?? false,
    home,
    ...(opts.project !== undefined ? { projectRef: opts.project } : {}),
  };
}

interface ConfigFile {
  defaultProjectId?: string;
}

export async function readConfig(home: string): Promise<ConfigFile> {
  try {
    return JSON.parse(await fs.readFile(paths.configFile(home), "utf8")) as ConfigFile;
  } catch {
    return {};
  }
}

export async function writeConfig(home: string, config: ConfigFile): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(paths.configFile(home), JSON.stringify(config, null, 2));
}

/** Resolve --project (exact id, then case-insensitive title prefix), falling
 * back to the `isocan use` default. */
export async function resolveProject(ctx: Ctx): Promise<Project> {
  const projects = await ctx.client.listProjects();
  const ref = ctx.projectRef ?? (await readConfig(ctx.home)).defaultProjectId;
  if (!ref) {
    if (projects.length === 1) return projects[0]!;
    throw new Error(
      projects.length === 0
        ? "no projects yet — create one with `isocan project create <title>`"
        : "multiple projects — pass --project <id|title> or set a default with `isocan use <project>`",
    );
  }
  const byId = projects.find((p) => p.id === ref);
  if (byId) return byId;
  const matches = projects.filter((p) => p.title.toLowerCase().startsWith(ref.toLowerCase()));
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(
      `ambiguous project "${ref}": ${matches.map((p) => `${p.id} (${p.title})`).join(", ")}`,
    );
  }
  throw new Error(`no project matches "${ref}"`);
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
