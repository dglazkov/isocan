import { promises as fs } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import type { Actor, MetaPatch, Project } from "@isocan/core";
import { DEFAULT_PORT, newProjectId } from "@isocan/core";
import { paths, readConfigFile, stalenessOf, type HomeConfig } from "@isocan/server";
import { ApiError, DaemonClient, type Health } from "./client.ts";
import { requireIdentity, resolveIdentity, retireStrandedIdentities } from "./identity.ts";
import type { HarnessVarConfig } from "./harness.ts";
import {
  bindableRoot,
  findBinding,
  markerFile,
  recordDir,
  writeMarker,
  type DirBinding,
} from "./binding.ts";

export interface Ctx {
  client: DaemonClient;
  actor: Actor;
  json: boolean;
  home: string;
  projectRef?: string;
  /** The directory's canvas, when the cwd sits under a `.isocan/project.json`
   * marker (#60). Resolved once per command; null outside any bound tree. */
  binding: DirBinding | null;
  /**
   * The address the local daemon is a REPLICA of, or null when it is a home
   * itself (every daemon before phase 6, and every unconfigured one).
   *
   * Read once per command off the health route rather than from this
   * machine's own config, deliberately: what matters is what the daemon
   * ACTUALLY is — a CLI whose config was edited five minutes ago and a daemon
   * that has been running since Tuesday must not disagree about where the
   * pages are.
   */
  homeUrl: string | null;
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
  // A person at a keyboard is asked once, up front. Everyone else is asked
  // only if it turns out to matter: looking (`ls`, `project list`, `show`)
  // stamps nothing, and an agent should be able to see where it has landed
  // before it decides what to call itself. The getter is what makes that
  // lazy — reads never touch `actor`, so they never demand one.
  await retireStrandedIdentities(process.cwd(), home);
  const known = await resolveIdentity(client, home);
  const actor = known?.actor ?? (process.stdin.isTTY ? await requireIdentity(client, home) : null);
  await client.ensureDaemon();
  // One health call, two answers. It was already being made for the staleness
  // warning; asking it again for the home address would be a second round trip
  // on every command for a field that travels in the same body.
  const health = await client.healthz().catch(() => null);
  await warnIfStale(health, home);
  const homeUrl = health?.home ?? null;
  // Nothing is claimed here. Mechanism 5 asks the badge to vouch for whoever
  // this command speaks as — but a read stamps nothing and names nobody, and
  // an eager claim on every command would put an actors-log entry behind
  // `ls`. `resolveIdentity` has already told the client HOW to claim; the
  // home asking is what makes it happen, exactly once per badge.
  const binding = await findBinding(process.cwd(), home);
  return {
    client,
    get actor(): Actor {
      if (!actor) {
        throw new Error(
          'no identity yet — `isocan identity --name "Your Name" --session` names this agent',
        );
      }
      return actor;
    },
    json: opts.json ?? false,
    home,
    binding,
    homeUrl,
    ...(opts.project !== undefined ? { projectRef: opts.project } : {}),
  };
}

/**
 * The marker says this canvas lives somewhere else. Refuse, naming both.
 *
 * Moving a canvas between homes is **re-homing** — a thick replica offering
 * its store to a new home and rewriting the marker (innkeeper.md) — and it is
 * phase 13's. What it moves is the WORK and not the desk: badges, grants,
 * attestations and the claims binding actors to badges all stay behind. That
 * is not a migration a command can perform as a side effect of somebody
 * running `isocan ls` in the wrong directory, so nothing here migrates
 * anything. The two addresses are both printed because the interesting
 * question is always which of them is the surprise.
 */
function refuseForeignHome(binding: DirBinding, homeUrl: string | null): void {
  if (binding.home === undefined) return; // an older marker; it names no home
  const mine = homeUrl ?? "this machine (no home configured)";
  if (binding.home === homeUrl) return;
  throw new Error(
    `this directory's canvas lives at ${binding.home} (${markerFile(binding.root)}), ` +
      `but this daemon answers to ${mine}. Moving a canvas between homes is re-homing, ` +
      "and it is not something a command does by accident — point this daemon at " +
      `${binding.home} (\`isocan home ${binding.home}\`), or work in a directory bound ` +
      "to a canvas that lives here.",
  );
}

/**
 * A daemon outlives the command that started it, so an upgrade leaves the old
 * one holding the port — silently, since `ensureDaemon` only starts one when
 * nothing answers. Say so, once per daemon: an agent runs dozens of commands
 * and a line on every one of them is noise, but never saying it at all is how
 * you spend an afternoon debugging yesterday's build.
 */
async function warnIfStale(health: Health | null, home: string): Promise<void> {
  try {
    if (!health) return;
    const { stale, why } = stalenessOf(health);
    if (!stale) return;
    const marker = path.join(home, ".stale-warned");
    const said = await fs.readFile(marker, "utf8").catch(() => "");
    if (said.trim() === health.startedAt) return;
    await fs.writeFile(marker, health.startedAt).catch(() => {});
    console.error(`note: ${why} — \`isocan restart\` to run this one.`);
  } catch {
    // Never let a courtesy check break a command.
  }
}

interface ConfigFile extends HarnessVarConfig, HomeConfig {
  defaultProjectId?: string;
}

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

export interface ResolveOptions {
  /** May this resolution CREATE the directory's project: materialize a
   * marker whose store is missing here (a fresh clone), or bind an unbound
   * directory to a brand-new project. Passed by the commands that can put
   * something onto an empty canvas — and the session handshake — never by
   * reads, so `ls` in a stray directory cannot mint canvases. */
  create?: boolean;
}

/**
 * Which project a command means (#60). In order: --project says so; the
 * directory says so (the nearest `.isocan/project.json` marker, git-style
 * walk-up); the home default (`isocan use --home`), consulted only OUTSIDE
 * bound directories; the only project there is; and finally — for commands
 * allowed to create — binding this directory to a fresh project named after
 * it.
 */
export async function resolveProject(ctx: Ctx, opts: ResolveOptions = {}): Promise<Project> {
  const projects = await ctx.client.listProjects();
  if (ctx.projectRef !== undefined) return matchRef(projects, ctx.projectRef);
  if (ctx.binding) {
    refuseForeignHome(ctx.binding, ctx.homeUrl);
    const bound = projects.find((p) => p.id === ctx.binding!.projectId);
    if (bound) {
      await recordDir(ctx.home, ctx.binding.root, bound.id);
      return bound;
    }
    const fromHome = await fetchFromHome(ctx.client, ctx.homeUrl, ctx.binding);
    if (fromHome) {
      await recordDir(ctx.home, ctx.binding.root, fromHome.id);
      return fromHome;
    }
    if (opts.create) return materializeBinding(ctx, ctx.binding);
    throw new Error(
      `this directory is bound to project ${ctx.binding.projectId} ` +
        `(${markerFile(ctx.binding.root)}), which does not exist in this home yet — ` +
        "`isocan session start`, or any command that adds something, materializes it",
    );
  }
  const fallback = (await readConfig(ctx.home)).defaultProjectId;
  if (fallback !== undefined) return matchRef(projects, fallback);
  if (projects.length === 1) return projects[0]!;
  if (opts.create) {
    const made = await bindFresh(ctx);
    if (made) return made;
  }
  throw new Error(
    projects.length === 0
      ? "no projects yet — create one with `isocan project create <title>`"
      : "multiple projects — pass --project <id|title>, or bind this directory to one with `isocan use <project>`",
  );
}

/** Exact id, then case-insensitive title prefix. */
function matchRef(projects: Project[], ref: string): Project {
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

/** The freshly created project, read back from the daemon — the store is the
 * truth about stamps and timestamps, so nothing here fabricates a Project. */
async function projectById(client: DaemonClient, id: string): Promise<Project> {
  const project = (await client.listProjects()).find((p) => p.id === id);
  if (!project) throw new Error(`project ${id} was created but the daemon cannot list it`);
  return project;
}

/**
 * **A marker naming a canvas this machine does not hold, on a machine that has
 * a home: ask the home for it.**
 *
 * This is the clone case — `.isocan/project.json` committed to git and checked
 * out on a second machine, Scene 0's multi-device beat. It used to need
 * nothing: the daemon enumerated its home, the canvas was in the list because
 * its link grant would admit anybody, and by the time the CLI ran the canvas
 * had already replicated. Phase 8 stage 4 stopped a replica enumerating its
 * home — a machine now mirrors what it was let INTO — so this arrival, which
 * carries an address and no admission, has to say what it wants.
 *
 * It can, and that is the whole argument: somebody put the id in this
 * directory. The marker is the hand-off. What comes back is the home's own
 * door test on the badge this daemon holds there — the same test that used to
 * run a second later when the sweep dialled the socket — so nothing is
 * admitted here that would not have been admitted then.
 *
 * **Null means "nothing to try", never "refused".** A daemon that is its own
 * home has nowhere to ask (and answers `not-a-replica` if asked anyway, which
 * is a fine answer to get: this is asked speculatively). A REFUSAL is thrown,
 * because "your home will not let this machine onto that canvas" is the one
 * sentence that turns a mystifying empty replica into a thing a person can
 * act on — and the thing they act on is `isocan pass`.
 */
async function fetchFromHome(
  client: DaemonClient,
  homeUrl: string | null,
  binding: DirBinding,
): Promise<Project | null> {
  if (!homeUrl) return null;
  try {
    await client.joinFromHome(binding.projectId);
  } catch (err) {
    if (err instanceof ApiError && err.code === "not-a-replica") return null;
    if (err instanceof ApiError && err.status === 404) return null;
    throw new Error(
      `${homeUrl} would not hand this machine ${binding.projectId} ` +
        `(${markerFile(binding.root)}): ${(err as Error).message}\n` +
        "If that canvas is yours, mint a pass from a session that is already on it " +
        "(`isocan pass`) and run the command it prints here.",
    );
  }
  /**
   * The home said yes; the canvas still has to travel. `join` kicks the sweep
   * rather than carrying the canvas back in its own response, because what
   * makes a canvas present on this machine is a socket and a snapshot, not a
   * JSON body — and a CLI that returned the home's row while the local store
   * was still empty would hand every command after it a canvas that is not
   * there.
   */
  const deadline = Date.now() + 15_000;
  for (;;) {
    const here = (await client.listProjects()).find((p) => p.id === binding.projectId);
    if (here) return here;
    if (Date.now() > deadline) {
      throw new Error(
        `${homeUrl} let this machine onto ${binding.projectId}, but the canvas has not ` +
          "arrived yet. It replicates in the background — try again in a moment.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * A marker whose project this home has never seen — a fresh clone, or a
 * teammate's directory. ADOPT the id rather than minting one: project ids
 * are what let two homes agree they are working on the same canvas, so the
 * store is created under the id the marker carries.
 *
 * On a REPLICA this is the last resort rather than the first: `fetchFromHome`
 * runs before it, so a marker whose canvas lives at this machine's home
 * arrives by replication instead of being re-created under its id.
 */
async function materializeBinding(ctx: Ctx, binding: DirBinding): Promise<Project> {
  const title = binding.title ?? path.basename(binding.root);
  await ctx.client.sendOp(null, ctx.actor, {
    type: "project.create",
    projectId: binding.projectId,
    title,
  });
  await recordDir(ctx.home, binding.root, binding.projectId);
  console.error(
    `note: materialized "${title}" (${binding.projectId}) from ${markerFile(binding.root)}`,
  );
  return projectById(ctx.client, binding.projectId);
}

/** Bind an unbound directory: a new project named after it, a marker beside
 * it, a roster row in the home. Null when the directory refuses a marker
 * (the user's home directory, the filesystem root). */
async function bindFresh(ctx: Ctx): Promise<Project | null> {
  const root = await bindableRoot(process.cwd(), ctx.home);
  if (!root) return null;
  const projectId = newProjectId();
  const title = path.basename(root);
  // The write is the birth, and on a replica the write FORWARDS — so this one
  // call is what makes the canvas exist at the home rather than here, and the
  // marker records the address it was born at. Nothing extra is done to make
  // that true; it falls out of the demotion, which is the argument for having
  // done the demotion in the engine rather than in each caller.
  await ctx.client.sendOp(null, ctx.actor, { type: "project.create", projectId, title });
  const marker = { projectId, title, ...(ctx.homeUrl ? { home: ctx.homeUrl } : {}) };
  const file = await writeMarker(root, marker);
  await recordDir(ctx.home, root, projectId);
  console.error(`note: created "${title}" (${projectId}) for this directory — bound via ${file}`);
  ctx.binding = { root, ...marker };
  return projectById(ctx.client, projectId);
}

/**
 * The handshake's half of #60: after an agent names itself, make sure the
 * directory it landed in has a canvas. An existing binding is confirmed (and
 * its store materialized if this home has never seen it); an unbound,
 * bindable directory gets a fresh project named after it. Null when the
 * directory refuses a marker — the handshake still succeeded, there is just
 * no canvas to imply.
 */
export async function ensureDirBinding(
  client: DaemonClient,
  home: string,
  actor: Actor,
  homeUrl: string | null = null,
): Promise<{ project: Project; root: string; created: boolean } | null> {
  const binding = await findBinding(process.cwd(), home);
  if (binding) {
    refuseForeignHome(binding, homeUrl);
    const existing = (await client.listProjects()).find((p) => p.id === binding.projectId);
    if (existing) {
      await recordDir(home, binding.root, existing.id);
      return { project: existing, root: binding.root, created: false };
    }
    // Same order as `resolveProject`: a marker whose canvas lives at this
    // machine's home is FETCHED, not re-created. `created: false` because
    // nothing was — the canvas has existed at the home all along, and an agent
    // told it created a canvas it merely joined would say so on the thread.
    const fromHome = await fetchFromHome(client, homeUrl, binding);
    if (fromHome) {
      await recordDir(home, binding.root, fromHome.id);
      return { project: fromHome, root: binding.root, created: false };
    }
    const title = binding.title ?? path.basename(binding.root);
    await client.sendOp(null, actor, {
      type: "project.create",
      projectId: binding.projectId,
      title,
    });
    await recordDir(home, binding.root, binding.projectId);
    return {
      project: await projectById(client, binding.projectId),
      root: binding.root,
      created: true,
    };
  }
  const root = await bindableRoot(process.cwd(), home);
  if (!root) return null;
  const projectId = newProjectId();
  const title = path.basename(root);
  await client.sendOp(null, actor, { type: "project.create", projectId, title });
  await writeMarker(root, { projectId, title, ...(homeUrl ? { home: homeUrl } : {}) });
  await recordDir(home, root, projectId);
  return { project: await projectById(client, projectId), root, created: true };
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
