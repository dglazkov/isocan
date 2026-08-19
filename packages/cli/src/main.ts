import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import type {
  Actor,
  CanvasSnapshotResponse,
  Comment,
  CommentThread,
  Item,
  MentionCandidate,
  NewComment,
  Operation,
  Placement,
  PresenceSession,
  Project,
  WatchedLogEntry,
} from "@isocan/core";
import {
  BROWSER_MIME,
  DEFAULT_PORT,
  IDENTITY_COLORS,
  collectCanvasActors,
  collectCanvasNames,
  collectItemRefCandidates,
  extractItemRefs,
  extractMentions,
  isIdentityColor,
  mainThread,
  newCommentId,
  newItemId,
  newProjectId,
  newThreadId,
  newVersionId,
  normalizeSiteUrl,
  siteFilename,
  siteLabel,
} from "@isocan/core";
import { paths, stalenessOf } from "@isocan/server";
import {
  type Ctx,
  type ResolveOptions,
  ensureDirBinding,
  makeCtx,
  metaPatch,
  readConfig,
  resolveProject,
  writeConfig,
} from "./ctx.ts";
import { bindableRoot, dirsOf, findBinding, markerFile, recordDir, writeMarker } from "./binding.ts";
import { ApiError, DaemonClient } from "./client.ts";
import {
  readIdentity,
  claimSessionIdentity,
  resolveIdentity,
  retireStrandedIdentities,
  writeIdentity,
} from "./identity.ts";
import { checkoutState, planUpgrade, whichInstall } from "./upgrade.ts";
import { findOnPath, globalBinDir, rootOfBin } from "./onpath.ts";
import { defaultSize, mimeFor } from "./mime.ts";
import {
  collectProp,
  formatBytes,
  formatProps,
  parseXY,
  printJson,
  printKeyValues,
  printTable,
  truncate,
} from "./output.ts";

const program = new Command();
program
  .name("isocan")
  .description("Isomorphic canvas — same operations as the web app, from your terminal")
  .version("0.1.0")
  .option("--json", "machine-readable JSON output (any command)")
  .option("--port <port>", "daemon port (default 4441)")
  .option(
    "--project <ref>",
    "project id or title prefix (default: this directory's binding, then `isocan use --home`)",
  )
  .addHelpText(
    "after",
    `
The system:
  A local daemon owns the state; this CLI and the web app are equal clients.
  Every command here sends the same operation the web app would, so changes
  appear live in any open browser — and vice versa.

  project    a canvas; list with \`isocan project list\`
  item       a file rendered on the canvas (markdown, image, video, HTML) at
             x,y world coordinates (+x right, +y down)
  browser    \`isocan browse <url>\` projects a live site onto the canvas —
             point it at the localhost dev server you're building and the
             human watches it run (vite HMR keeps it fresh by itself)
  version    every \`edit\` stacks a new version on the item; \`version promote\`
             brings any older one back to the top
  comment    threads pinned to an item (--item) or a spot (--at x,y); write
             @Name to address someone, \`comment anchor\` to re-pin a thread.
             One thread may be \`comment main\`: the docked agent↔user channel —
             \`wait\` always wakes on comments landing there
  undo       per-actor: \`isocan undo\` reverts YOUR last change, never a
             collaborator's
  trash      deleted items are recoverable until \`trash empty --force\`

Conventions:
  <item> and <thread> arguments accept an id, an id prefix, or a title prefix.
  A directory is bound to its project by <dir>/.isocan/project.json — written
  automatically when an agent names itself here (\`identity --session\`), or
  by hand with \`isocan use <project>\`. Commands run anywhere under it
  resolve there (nearest marker wins, like .git); the marker is meant to be
  committed, so a clone knows which project it is. --project overrides per
  command; \`isocan use <ref> --home\` sets a fallback for unbound dirs.
  Identity stamps every change you make. A person: \`isocan identity --name
  "You" --home\`. An agent: \`isocan identity --session\` — the daemon hands
  out a free name, or asks for yours with --name. Auto-starts when needed.

Your name (agents, read this):
  You need a name of your own — not your model's or vendor's, and never the
  human's. \`isocan identity --session\` hands you a free one (Isaac, Kenny,
  Nico… — names hiding in the letters of "isocan"); ask for a specific one
  with --name and the daemon refuses it if somebody already answers to it,
  since \`@Name\` addresses people by name. Keep it for the whole
  collaboration so the human can call you back by it.

Presence (automatic once you have a session):
  isocan session start --label "You"    appear as a live cursor on the canvas
  From then on presence follows the work by itself: every operation moves
  your cursor to where it happened, reads narrate themselves ("looking at…",
  "reading the comments…"), waking from \`wait\` lands your cursor on the
  summoning thread, and posting a comment clears your status — done is done.
  isocan session work <item> --say "…"  say it in your own words — your words
                                        outrank the derived narration until
                                        your next comment
  isocan who                            see everyone on the canvas right now
  isocan who --all                      every name the canvas knows, live or not

A typical collaboration loop:
  session start → comment list → session work <item> --say "…" → build →
  edit/add/mv/… → comment reply <thread> "…" → \`isocan wait\` (blocks until
  the next comment that's for you — @-mentions you, lands in the main
  thread, or is in your thread — on this directory's canvas) → repeat.
  The loop's only exit is the human saying so: \`session end\` is theirs to
  ask for, not yours to decide. Every other lap ends parked on \`wait\`.`,
  );

/** Wrap actions: friendly errors, non-zero exit. */
function run(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  };
}

function ctxOf(cmd: Command): Promise<Ctx> {
  return makeCtx(cmd);
}

// ---- presence session (the live cursor) ----
//
// The pointer to "my live session" is PER ACTOR (~/.isocan/sessions/
// <actorId>.json). It used to be one file per home — and since every update
// re-states who is holding the session, two agents sharing that file beat
// each other's actor into one session: Iona's face under Osian's label,
// while Iona's real session starved. One file per actor also means two
// agents never read-modify-write each other's pointer.

interface SessionFile {
  projectId: string;
  sessionId: string;
  label?: string;
}

async function readSessionFile(home: string, actorId: string): Promise<SessionFile | null> {
  // The old single-pointer file can't say whose it was — that is the bug —
  // so nobody reads it; its session expires on its own TTL.
  await fs.rm(paths.legacySessionFile(home), { force: true }).catch(() => {});
  try {
    return JSON.parse(
      await fs.readFile(paths.cliSessionFile(home, actorId), "utf8"),
    ) as SessionFile;
  } catch {
    return null;
  }
}

async function writeSessionFile(
  home: string,
  actorId: string,
  session: SessionFile | null,
): Promise<void> {
  const file = paths.cliSessionFile(home, actorId);
  if (session === null) {
    await fs.rm(file, { force: true });
  } else {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(session, null, 2));
  }
}

/** The active session for this project, or an error telling how to start one. */
async function requireSession(ctx: Ctx, projectId: string): Promise<SessionFile> {
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  if (!session || session.projectId !== projectId) {
    throw new Error("no active session on this project — run `isocan session start` first");
  }
  return session;
}

/** Update the session; if it expired while we were thinking, quietly start a
 * fresh one (same label) and retry — working makes you visible again. */
async function touchSession(
  ctx: Ctx,
  projectId: string,
  patch: import("@isocan/core").UpdateSessionRequest,
): Promise<void> {
  const active = await requireSession(ctx, projectId);
  // Every update re-states who is holding the session, so `identity --name`
  // re-labels the live cursor on the next command instead of leaving the old
  // name standing until the session expires.
  const beat = { actor: ctx.actor, ...patch };
  try {
    await ctx.client.updateSession(projectId, active.sessionId, beat);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const created = await ctx.client.createSession(projectId, ctx.actor, active.label);
    await writeSessionFile(ctx.home, ctx.actor.id, { ...active, sessionId: created.sessionId });
    await ctx.client.updateSession(projectId, created.sessionId, beat);
  }
}

/**
 * Auto-narration: presence follows the work, whether or not the agent
 * remembers to say anything. Commands call this with a status derived from
 * what they are doing ("looking at …", "editing …"); the daemon treats it as
 * INFERRED, so it never displaces a status the agent set with `say`/`--say`,
 * and any applied op sweeps it away. Best-effort on purpose: no session on
 * this project means no narration, and no failure here may break a command.
 */
async function narrate(
  ctx: Ctx,
  projectId: string,
  patch: import("@isocan/core").UpdateSessionRequest,
): Promise<void> {
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  if (!session || session.projectId !== projectId) return;
  await touchSession(ctx, projectId, { ...patch, statusSource: "inferred" }).catch(() => {});
}

/** World center of an item — where narration points the cursor. */
function itemCenter(item: Item): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

async function sendOp(ctx: Ctx, projectId: string | null, op: Operation) {
  // Ops bound to an active session move its cursor to the op's locus
  // (presence piggyback) — the daemon matches clientId to the session.
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  const clientId =
    session && projectId !== null && session.projectId === projectId
      ? session.sessionId
      : undefined;
  return ctx.client.sendOp(projectId, ctx.actor, op, clientId);
}

/** Resolve an item by exact id, id prefix, or title prefix. */
function resolveItem(snapshot: CanvasSnapshotResponse, ref: string): Item {
  const items = Object.values(snapshot.canvas.items);
  const exact = items.find((i) => i.id === ref);
  if (exact) return exact;
  const matches = items.filter(
    (i) => i.id.startsWith(ref) || i.title.toLowerCase().startsWith(ref.toLowerCase()),
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(
      `ambiguous item "${ref}": ${matches.map((i) => `${i.id} (${truncate(i.title, 20)})`).join(", ")}`,
    );
  }
  throw new Error(`no item matches "${ref}"`);
}

/** Resolve a thread by exact id or id prefix. */
function resolveThread(snapshot: CanvasSnapshotResponse, ref: string): CommentThread {
  const threads = Object.values(snapshot.canvas.threads);
  const thread =
    threads.find((t) => t.id === ref) ?? threads.find((t) => t.id.startsWith(ref));
  if (!thread) throw new Error(`no thread matches "${ref}"`);
  return thread;
}

/** Resolve a trashed item by exact id, id prefix, or title prefix. */
function resolveTrashed(snapshot: CanvasSnapshotResponse, ref: string) {
  const entry =
    snapshot.canvas.trash.find((t) => t.item.id === ref) ??
    snapshot.canvas.trash.find(
      (t) =>
        t.item.id.startsWith(ref) || t.item.title.toLowerCase().startsWith(ref.toLowerCase()),
    );
  if (!entry) throw new Error(`no trashed item matches "${ref}"`);
  return entry;
}

async function projectAndSnapshot(
  ctx: Ctx,
  opts?: ResolveOptions,
): Promise<{ project: Project; snapshot: CanvasSnapshotResponse }> {
  const project = await resolveProject(ctx, opts);
  const snapshot = await ctx.client.snapshot(project.id);
  return { project, snapshot };
}

// ---------- identity & daemon lifecycle ----------

/**
 * Best-effort collision check: is this name already answering to someone else
 * on the canvas? Two collaborators sharing a name make `@Name` ambiguous, and
 * agents pick their own names, so a heads-up is worth the lookup. Only asks a
 * daemon that is ALREADY running — `identity` has to work offline.
 */
async function nameCollision(
  cmd: Command,
  actor: Actor,
): Promise<{ name: string; id: string; project: string } | null> {
  try {
    const globals = cmd.optsWithGlobals() as { port?: string; project?: string };
    const home = paths.isocanHome();
    const port = Number(globals.port ?? process.env.ISOCAN_PORT ?? DEFAULT_PORT);
    const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
    if (!(await client.health())) return null;
    const ctx: Ctx = {
      client,
      actor,
      json: false,
      home,
      binding: await findBinding(process.cwd(), home),
      ...(globals.project !== undefined ? { projectRef: globals.project } : {}),
    };
    const project = await resolveProject(ctx);
    const sessions = await client.listSessions(project.id);
    const wanted = actor.name.toLowerCase();
    const clash = (await knownNames(ctx, project, sessions)).find(
      (known) => known.id !== actor.id && known.name.toLowerCase() === wanted,
    );
    return clash ? { name: clash.name, id: clash.id, project: project.title } : null;
  } catch {
    return null; // no daemon, no project, nothing to collide with
  }
}

/**
 * A rename should reach the face you are already wearing. Best-effort, on the
 * same terms as the collision check: only asks a daemon that is already
 * running, and never fails `identity` — which has to work offline.
 */
async function relabelLiveSession(cmd: Command, actor: Actor): Promise<void> {
  try {
    const home = paths.isocanHome();
    const session = await readSessionFile(home, actor.id);
    if (!session) return;
    const globals = cmd.optsWithGlobals() as { port?: string };
    const port = Number(globals.port ?? process.env.ISOCAN_PORT ?? DEFAULT_PORT);
    const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
    if (!(await client.health())) return;
    await client.updateSession(session.projectId, session.sessionId, { actor });
  } catch {
    // No daemon, no session, or it expired while we were being renamed —
    // either way there is no face left wearing the old name.
  }
}

/**
 * Which slot a `--name` writes. Two parties share a machine: the person who
 * owns it (home) and the agents working in its sessions.
 *
 * An agent that renames the home identity renames the human — which is
 * exactly what used to happen, since the skill told every agent to introduce
 * itself. So an automated caller (no TTY) names its own session unless it
 * insists on `--home`; with no harness session in the environment that is an
 * error, not a silent write somewhere else (`ISOCAN_SESSION_ID` is the answer
 * for a bare shell or a cron job). A person at a keyboard is the machine's
 * owner.
 */
function identityTarget(opts: { session?: boolean; home?: boolean; as?: string }): "session" | "home" {
  if (opts.session || opts.as !== undefined) return "session";
  if (opts.home) return "home";
  return process.stdin.isTTY ? "home" : "session";
}

/** A palette name ("teal"), a literal hex, or "none" to go back to derived. */
function parseIdentityColor(input: string): string | null {
  const wanted = input.trim().toLowerCase();
  if (wanted === "none" || wanted === "default") return null;
  const named = IDENTITY_COLORS.find((c) => c.name.toLowerCase() === wanted);
  if (named) return named.value;
  if (isIdentityColor(wanted)) return wanted;
  throw new Error(
    `unknown color: ${input} — try ${IDENTITY_COLORS.map((c) => c.name.toLowerCase()).join(", ")}, a #hex, or "none"`,
  );
}

program
  .command("identity")
  .description("Set or show the identity stamped on your changes")
  .option("--name <name>", "display name (with --session, omit it to be handed a free one)")
  .option(
    "--session",
    "name the agent running this command — what tells two agents in ONE directory apart",
  )
  .option("--home", "name the person who owns this machine (~/.isocan)")
  .option("--new", "become a new person instead of renaming this one (fresh actor id)")
  .option("--as <actorId>", "resume an existing actor whose session is gone (implies --session)")
  .option(
    "--color <color>",
    'the color you wear on every canvas — a palette name (e.g. "teal") or a hex, "none" to go back to the one your id implies',
  )
  .action(
    run(
      async (
        opts: {
          name?: string;
          session?: boolean;
          home?: boolean;
          new?: boolean;
          as?: string;
          color?: string;
        },
        cmd: Command,
      ) => {
        const home = paths.isocanHome();
        const client = new DaemonClient(`http://127.0.0.1:${daemonPort(cmd)}`, home);
        await retireStrandedIdentities(process.cwd(), home);
        // Choosing your color is a mutation on the actor registry, the same
        // one the web app's identity menu sends — so both clients change the
        // color everyone sees, not a local preference each keeps to itself.
        if (opts.color !== undefined) {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error("no identity configured — use --name first");
          const color = parseIdentityColor(opts.color);
          await client.sendOp(null, resolved.actor, {
            type: "actor.setColor",
            actorId: resolved.actor.id,
            color,
          });
          console.log(
            color === null
              ? `${resolved.actor.name} wears the color their id implies again`
              : `${resolved.actor.name} now wears ${color}`,
          );
          if (!opts.name && !opts.session && !opts.as) return;
        }
        // `--session` alone is a claim, not a lookup: "hand me a free name".
        if (opts.name || opts.session || opts.as) {
          const scope = identityTarget(opts);
          if (scope === "session") {
            const bound = await findBinding(process.cwd(), home);
            const { actor, harness } = await claimSessionIdentity(client, home, {
              ...(opts.name !== undefined ? { name: opts.name } : {}),
              ...(opts.new ? { fresh: true } : {}),
              ...(opts.as !== undefined ? { as: opts.as } : {}),
              ...(bound ? { projectId: bound.projectId } : {}),
            });
            console.log(
              `identity saved: ${actor.name} (${actor.id}) → ${paths.actorsFile(home)} (${harness} session)`,
            );
            await relabelLiveSession(cmd, actor);
            // The handshake is the "agent lands in a directory" moment (#60):
            // make sure the directory has a canvas, creating one if not.
            // Best-effort — the name was saved either way, and saying why the
            // binding failed beats failing a command that did its job.
            try {
              const landed = await ensureDirBinding(client, home, actor);
              if (landed) {
                console.log(
                  `this directory's canvas: "${landed.project.title}" (${landed.project.id})` +
                    (landed.created ? ` — created; bound via ${markerFile(landed.root)}` : ""),
                );
              }
            } catch (err) {
              console.error(
                `warning: could not bind this directory to a canvas — ${(err as Error).message}`,
              );
            }
            return;
          }
          if (!opts.name) throw new Error('a name is required — `isocan identity --name "You" --home`');
          const actor = await writeIdentity(home, opts.name, opts.new ?? false);
          console.log(`identity saved: ${actor.name} (${actor.id}) → ${paths.identityFile(home)}`);
          await relabelLiveSession(cmd, actor);
          const taken = await nameCollision(cmd, actor);
          if (taken) {
            console.error(
              `warning: "${taken.name}" is already used on "${taken.project}" by ${taken.id} — ` +
                "@-mentions can't tell you apart; pick another name",
            );
          }
        } else {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error("no identity configured — use --name");
          printKeyValues({
            id: resolved.actor.id,
            name: resolved.actor.name,
            scope:
              resolved.source === "session"
                ? `this agent session (${resolved.harness})`
                : "this machine's person",
            file: resolved.file,
          });
        }
      },
    ),
  );

program
  .command("whoami")
  .description("Show your identity")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const home = paths.isocanHome();
      const client = new DaemonClient(`http://127.0.0.1:${daemonPort(cmd)}`, home);
      await retireStrandedIdentities(process.cwd(), home);
      const resolved = await resolveIdentity(client, home);
      if (!resolved) throw new Error('no identity configured — run `isocan identity --name "You"`');
      const suffix = resolved.source === "session" ? " — this agent session" : "";
      console.log(`${resolved.actor.name} (${resolved.actor.id})${suffix}`);
    }),
  );

program
  .command("serve")
  .description("Run the state daemon (auto-started by other commands; --foreground attaches)")
  .option("--foreground", "run in the foreground (default: detach)")
  .option("--force", "stop whatever daemon is on the port and take it over")
  .action(
    run(async (opts: { foreground?: boolean; force?: boolean }, cmd: Command) => {
      const home = paths.isocanHome();
      const port = daemonPort(cmd);
      if (opts.foreground) {
        const { runDaemon } = await import("@isocan/server");
        await runDaemon({ port, home, ...(opts.force ? { takeover: true } : {}) });
        return new Promise<void>(() => {}); // runs until signaled
      }
      const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
      if (opts.force) {
        const { stopDaemons } = await import("@isocan/server");
        const stopped = await stopDaemons(port, home);
        if (stopped.length > 0) console.log(`stopped daemon ${stopped.join(", ")}`);
      } else if (await client.health()) {
        console.log(`daemon already running on ${client.base}`);
        return;
      }
      await client.ensureDaemon();
      console.log(`daemon started on ${client.base}`);
    }),
  );

/** The port this invocation talks to: --port, then ISOCAN_PORT, then default. */
function daemonPort(cmd: Command): number {
  const globals = cmd.optsWithGlobals() as { port?: string };
  return Number(globals.port ?? process.env.ISOCAN_PORT ?? DEFAULT_PORT);
}

program
  .command("status")
  .description("Show daemon status")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as { json?: boolean };
      const port = daemonPort(cmd);
      const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
        signal: AbortSignal.timeout(500),
      }).catch(() => null);
      if (!res?.ok) {
        console.log(`daemon: not running (port ${port})`);
        return;
      }
      const health = (await res.json()) as {
        pid: number;
        startedAt: string;
        version: string;
        root?: string;
        codeAt?: string;
      };
      if (globals.json) return printJson(health);
      const { stale, why } = stalenessOf(health);
      printKeyValues({
        daemon: `running on http://127.0.0.1:${port}`,
        pid: String(health.pid),
        since: health.startedAt,
        version: health.version,
        // Which copy is serving matters as soon as there is more than one:
        // an npx cache, a global install and a checkout all look identical
        // from the outside.
        running: health.root ?? "(a build too old to say)",
        ...(stale ? { stale: `${why} — \`isocan restart\`` } : {}),
      });
    }),
  );

program
  .command("restart")
  .description("Stop the daemon and start this build in its place — what an upgrade needs")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const home = paths.isocanHome();
      const port = daemonPort(cmd);
      const { stopDaemons } = await import("@isocan/server");
      const stopped = await stopDaemons(port, home);
      const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
      await client.ensureDaemon();
      const health = await client.healthz(2000);
      await fs.rm(path.join(home, ".stale-warned"), { force: true });
      const globals = cmd.optsWithGlobals() as { json?: boolean };
      if (globals.json) return printJson({ stopped, ...(health ?? {}) });
      printKeyValues({
        stopped: stopped.length > 0 ? stopped.join(", ") : "(nothing was running)",
        daemon: `running on ${client.base}`,
        pid: String(health?.pid ?? "?"),
        running: health?.root ?? "(unknown build)",
      });
    }),
  );

program
  .command("upgrade")
  .description("Fetch the newest isocan and restart the daemon on it")
  .option("--no-restart", "fetch only; leave the running daemon alone")
  .action(
    run(async (opts: { restart?: boolean }, cmd: Command) => {
      const install = await whichInstall(
        path.resolve(fileURLToPath(new URL("../../..", import.meta.url))),
      );
      const plan = planUpgrade(
        install,
        install.kind === "checkout" ? checkoutState(install.root) : null,
        INSTALL_SPEC,
      );
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const shell = (command: string, args: string[], cwd?: string) =>
        spawnSync(command, args, { stdio: "inherit", ...(cwd ? { cwd } : {}) });

      if (plan.action === "none") {
        console.log(plan.message);
      } else if (plan.action === "pull") {
        // A linked checkout is somebody's working copy: fast-forward only, and
        // only when it is clean — the plan refused otherwise.
        console.error(`isocan: ${plan.message}`);
        const pulled = spawnSync("git", ["-C", install.root, "pull", "--ff-only"], {
          encoding: "utf8",
        });
        process.stderr.write(pulled.stdout ?? "");
        if (pulled.status !== 0) {
          // Almost always: the checkout has commits of its own. Refusing to
          // merge is the right call — say what to do rather than what failed.
          throw new Error(
            `could not fast-forward ${install.root} — it has diverged from its upstream; ` +
              `reconcile it there, then \`isocan restart\`\n${(pulled.stderr ?? "").trim()}`,
          );
        }
        if (/Already up to date/i.test(pulled.stdout ?? "")) {
          console.log(`${install.root} was already current`);
        } else {
          // New code can mean new dependencies, and the web bundle is a build
          // artifact a pull never brings with it.
          if (shell(npm, ["install"], install.root).status !== 0) throw new Error("npm install failed");
          if (shell(npm, ["run", "build"], install.root).status !== 0) throw new Error("npm run build failed");
          console.log(`updated ${install.root}`);
        }
      } else {
        console.error(`isocan: ${plan.message}`);
        if (shell(npm, ["install", "-g", INSTALL_SPEC]).status !== 0) {
          throw new Error(`npm i -g ${INSTALL_SPEC} failed`);
        }
        console.log("fetched the newest build");
      }

      if (opts.restart === false) {
        console.log("the daemon still runs the old build — `isocan restart` when you're ready");
        return;
      }
      const port = daemonPort(cmd);
      if (plan.action === "none") {
        // Nothing was fetched, so bouncing the daemon would be theatre —
        // unless it is serving some other copy, which is the one case where
        // an upgrade that changed nothing still has work to do.
        const health = await new DaemonClient(`http://127.0.0.1:${port}`, paths.isocanHome())
          .healthz();
        if (!health || !stalenessOf(health).stale) {
          console.log("the daemon is already running this build");
          return;
        }
      }
      // Re-exec THE COPY WE JUST UPGRADED — by path, never by PATH. This
      // process loaded the old code, and `isocan` on PATH may well be a
      // different copy entirely: upgrade a checkout while a global install
      // shadows it and the daemon would come back on the wrong one.
      spawnSync(
        process.execPath,
        [path.join(install.root, "packages/cli/bin/isocan.js"), "--port", String(port), "restart"],
        { stdio: "inherit" },
      );
    }),
  );

program
  .command("stop")
  .description("Stop the daemon — asks the port who it is, so a stale one can't hide")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const { stopDaemons } = await import("@isocan/server");
      // Waits for the processes to actually die (SIGKILL if they won't), so
      // `stop && serve` can't race its own predecessor.
      const stopped = await stopDaemons(daemonPort(cmd), paths.isocanHome());
      console.log(
        stopped.length > 0
          ? `stopped daemon${stopped.length > 1 ? "s" : ""} ${stopped.join(", ")}`
          : "daemon not running",
      );
    }),
  );

program
  .command("open")
  .description("Open the project in your browser")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const project = await resolveProject(ctx);
      const url = `${ctx.client.base}/p/${project.id}`;
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
        stdio: "ignore",
        detached: true,
      }).unref();
      console.log(url);
    }),
  );

// ---------- setup: one command, from any directory ----------

/** The skill this build ships, in the same relative place in a checkout and
 * in an `npm i -g github:…` install. */
const SKILL_NAME = "isocan-collab";
const skillSource = () =>
  fileURLToPath(new URL(`../../../.agents/skills/${SKILL_NAME}`, import.meta.url));
/**
 * How to get this CLI without a registry — the repo is the package, and the
 * `release` branch is the installable face of it: same tree, plus the built
 * web app, minus the manifest keys npm's git installer trips over. Installing
 * from `main` puts an EMPTY directory on your disk and a dangling `isocan` on
 * your PATH (#47) — see scripts/release.mjs for the whole story.
 */
const INSTALL_SPEC = "github:dglazkov/isocan#release";

async function exists(target: string): Promise<boolean> {
  return fs.stat(target).then(() => true, () => false);
}

/**
 * Put the skill where agents look. `.agents/skills/<name>/` is the convention
 * pi, agy, Codex, Cursor, Gemini CLI and OpenCode discover on their own;
 * Claude Code reads the same directory through a relative symlink. One copy
 * per directory, several doorways to it — the arrangement this repo uses on
 * itself.
 */
async function installSkill(
  dir: string,
  force: boolean,
): Promise<{ path: string; state: "installed" | "refreshed" | "current" | "differs" }> {
  const source = skillSource();
  const dest = path.join(dir, ".agents", "skills", SKILL_NAME);
  const already = await exists(dest);
  let state: "installed" | "refreshed" | "current" | "differs" = "installed";
  if (already && !force) {
    const [theirs, ours] = await Promise.all([
      fs.readFile(path.join(dest, "SKILL.md"), "utf8").catch(() => ""),
      fs.readFile(path.join(source, "SKILL.md"), "utf8"),
    ]);
    state = theirs === ours ? "current" : "differs";
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rm(dest, { recursive: true, force: true });
    await fs.cp(source, dest, { recursive: true });
    state = already ? "refreshed" : "installed";
  }

  // The Claude Code doorway: a relative symlink, so it survives being moved
  // or cloned. Never overwrite a real directory someone put there.
  const doorway = path.join(dir, ".claude", "skills", SKILL_NAME);
  const link = await fs.lstat(doorway).catch(() => null);
  if (!link) {
    await fs.mkdir(path.dirname(doorway), { recursive: true });
    await fs
      .symlink(path.join("..", "..", ".agents", "skills", SKILL_NAME), doorway)
      .catch(() => {}); // Windows without developer mode: the .agents copy stands
  }
  return { path: dest, state };
}

/** Is this build a git checkout of isocan itself, rather than an install? */
async function runningFromCheckout(): Promise<boolean> {
  return exists(fileURLToPath(new URL("../../../.git", import.meta.url)));
}

/** This copy's package root — the thing a daemon's `root` is compared against. */
const myRoot = () => fileURLToPath(new URL("../../..", import.meta.url));

program
  .command("setup [dir]")
  .description(
    "Ready a directory for canvas work: the skill agents read, the CLI they run, the daemon serving the app",
  )
  .option("--no-install", "don't install the isocan CLI when it isn't on PATH")
  .option("--open", "open the app in a browser (default when you're at a terminal)")
  .option("--no-open", "never open a browser")
  .option("--force", "refresh the skill even if this directory already has one")
  .action(
    run(
      async (
        dir: string | undefined,
        opts: { install?: boolean; open?: boolean; force?: boolean },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals() as { json?: boolean };
        const target = path.resolve(dir ?? process.cwd());
        if (!(await exists(target))) throw new Error(`no such directory: ${target}`);
        const report: Record<string, string> = {};

        const skill = await installSkill(target, opts.force ?? false);
        report.skill =
          skill.state === "differs"
            ? `${path.relative(target, skill.path)} — differs from this build's copy; --force to refresh`
            : `${path.relative(target, skill.path)} (${skill.state})`;

        // The skill's every instruction starts with `isocan`, so a setup that
        // leaves it unrunnable has set up nothing — and "runnable" means from
        // the NEXT command's shell, not from this one. `findOnPath` ignores
        // the npx cache this process may be running out of; `which` does not,
        // which is how setup used to report a CLI nobody could run (#48).
        let durableBin = findOnPath("isocan");
        if (durableBin) {
          report.cli = `already on PATH (${durableBin})`;
        } else if (await runningFromCheckout()) {
          report.cli = "running from a checkout — `npm link` to put it on PATH";
        } else if (opts.install === false) {
          report.cli = `not on PATH — \`npm i -g ${INSTALL_SPEC}\` when you want it`;
        } else {
          console.error(`isocan: installing the CLI (npm i -g ${INSTALL_SPEC})…`);
          const npm = process.platform === "win32" ? "npm.cmd" : "npm";
          const done = spawnSync(npm, ["install", "-g", INSTALL_SPEC], { stdio: "inherit" });
          durableBin = done.status === 0 ? findOnPath("isocan") : null;
          const bin = done.status === 0 && !durableBin ? globalBinDir() : null;
          if (durableBin) {
            report.cli = `installed globally (${durableBin})`;
          } else if (bin) {
            // Installed into a directory this shell cannot see. nvm, fnm, asdf
            // and volta all put binaries under a version they expect a shell
            // rc file to have exported — and an agent's subshell often sources
            // none. Say where it went, and the one line that reaches it.
            durableBin = path.join(bin, "isocan");
            report.cli = `installed at ${durableBin} — not on this PATH; export PATH="${bin}:$PATH"`;
          } else {
            report.cli = `install failed — run \`npm i -g ${INSTALL_SPEC}\` yourself`;
          }
        }

        // Setup deliberately creates NO canvas, and so needs no identity of
        // its own. Making one here would stamp it with whoever typed the
        // command — often an agent, acting for a person who has not said their
        // name yet. The web app is where the human names themselves, and
        // making a canvas there is one click; a name picked in the browser is
        // the person's, which is the point.
        const home = paths.isocanHome();
        const port = daemonPort(cmd);
        const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
        // The daemon outlives the command that starts it, so it has to belong
        // to a copy that outlives it too. Run through npx, THIS copy is a
        // cache directory npm deletes — and every command from the CLI we just
        // installed would find that daemon and call it stale (#48). So when we
        // are the transient one, the installed copy is handed the daemon.
        const transient = (await whichInstall(path.resolve(myRoot()))).kind === "npx";
        const handOff = transient ? durableBin : null;
        try {
          // Setup is what you run after an upgrade, so a daemon left over from
          // an older copy is replaced rather than reported: "make this
          // directory work" includes serving today's app, not yesterday's.
          const before = await client.healthz();
          if (handOff) {
            const owner = rootOfBin(handOff);
            if (!before || path.resolve(before.root ?? "") !== owner) {
              const done = spawnSync(handOff, ["restart", "--port", String(port)], {
                encoding: "utf8",
                shell: process.platform === "win32",
                env: { ...process.env, ISOCAN_HOME: home },
              });
              if (done.status === 0) {
                report.restarted = before
                  ? `the daemon was running ${before.root} — restarted on the installed copy`
                  : `started on the installed copy, not this temporary one (${myRoot()})`;
              } else {
                // Not fatal: a daemon from this copy is worth more than no
                // daemon at all — it just won't outlive the cache, and the
                // installed CLI will offer to restart it.
                report.restarted =
                  `could not start the daemon from ${handOff} ` +
                  `(${(done.stderr || done.error?.message || "").trim().split("\n").pop() ?? "no output"}) — ` +
                  "using this copy instead; `isocan restart` once it is on your PATH";
              }
            }
          } else if (before && stalenessOf(before).stale) {
            const { stopDaemons } = await import("@isocan/server");
            await stopDaemons(port, home);
            await fs.rm(path.join(home, ".stale-warned"), { force: true });
            report.restarted = `${stalenessOf(before).why} — restarted on this build`;
          }
          await client.ensureDaemon();
          report.app = client.base;
        } catch (err) {
          report.app = `not running — \`isocan serve\` (${(err as Error).message})`;
        }

        // A person at a terminal gets the app opened for them; a script or an
        // agent gets the URL to hand over.
        const open = opts.open ?? Boolean(process.stdout.isTTY);
        if (open && report.app === client.base) {
          spawn(process.platform === "darwin" ? "open" : "xdg-open", [client.base], {
            stdio: "ignore",
            detached: true,
          }).unref();
        }

        if (globals.json) return printJson(report);
        printKeyValues(report);
        console.log(
          `\nOpen ${client.base} — pick your name, make a canvas — then tell your agent` +
            "\nto use the isocan-collab skill.",
        );
      },
    ),
  );

// ---------- projects ----------

const project = program.command("project").description("Create, list, edit, and delete projects — each project is a canvas");

project
  .command("create <title>")
  .description("Create a project")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .action(
    run(async (title: string, opts: { description?: string; prop: Record<string, string> }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const projectId = newProjectId();
      await sendOp(ctx, null, {
        type: "project.create",
        projectId,
        title,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(Object.keys(opts.prop).length > 0 ? { properties: opts.prop } : {}),
      });
      if (ctx.json) return printJson({ projectId });
      console.log(`created project ${projectId} — "${title}"`);
      const config = await readConfig(ctx.home);
      if (!config.defaultProjectId) {
        await writeConfig(ctx.home, { ...config, defaultProjectId: projectId });
        console.log(`(set as default project)`);
      }
    }),
  );

project
  .command("list")
  .description("List projects — in a bound directory, that directory's project (--all for every one)")
  .option("--all", "every project in the home, not just this directory's")
  .action(
    run(async (opts: { all?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const all = await ctx.client.listProjects();
      // A bound directory shows its own canvas: an agent that landed here
      // should not go wandering through every other project in the home.
      // Ergonomics, not a wall — same user, same home, --all opens it.
      const projects =
        !opts.all && ctx.binding ? all.filter((p) => p.id === ctx.binding!.projectId) : all;
      if (projects.length < all.length) {
        console.error(
          `(this directory's project only — --all for the other ${all.length - projects.length})`,
        );
      }
      if (ctx.json) return printJson(projects);
      const config = await readConfig(ctx.home);
      printTable(
        projects.map((p) => ({
          id: p.id + (p.id === config.defaultProjectId ? " *" : ""),
          title: truncate(p.title, 30),
          description: truncate(p.description, 40),
          updated: p.updatedAt,
          by: p.updatedBy.name,
        })),
      );
    }),
  );

project
  .command("show [ref]")
  .description("Show project details")
  .action(
    run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.projectRef = ref;
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const dirs = await dirsOf(ctx.home, p.id);
      if (ctx.json) {
        return printJson({
          ...p,
          itemCount: Object.keys(snapshot.canvas.items).length,
          ...(dirs.length > 0 ? { directories: dirs } : {}),
        });
      }
      printKeyValues({
        id: p.id,
        title: p.title,
        description: p.description || "(none)",
        properties: formatProps(p.properties) || "(none)",
        ...(dirs.length > 0 ? { directory: dirs.join(", ") } : {}),
        items: String(Object.keys(snapshot.canvas.items).length),
        threads: String(Object.keys(snapshot.canvas.threads).length),
        trash: String(snapshot.canvas.trash.length),
        created: `${p.createdAt} by ${p.createdBy.name}`,
        updated: `${p.updatedAt} by ${p.updatedBy.name}`,
      });
    }),
  );

project
  .command("edit [ref]")
  .description("Edit project details")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .option("--rm-prop <key>", "remove a property (repeatable)", (v: string, prev: string[]) => [...prev, v], [])
  .action(
    run(
      async (
        ref: string | undefined,
        opts: { title?: string; description?: string; prop: Record<string, string>; rmProp: string[] },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        if (ref !== undefined) ctx.projectRef = ref;
        const p = await resolveProject(ctx);
        const patch = metaPatch(opts);
        if (Object.keys(patch).length === 0) throw new Error("nothing to change");
        await sendOp(ctx, p.id, { type: "project.update", patch });
        console.log(`updated project ${p.id}`);
      },
    ),
  );

project
  .command("delete [ref]")
  .description("Delete a project (requires --force; not undoable)")
  .option("--force", "confirm deletion")
  .action(
    run(async (ref: string | undefined, opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.projectRef = ref;
      const p = await resolveProject(ctx);
      if (!opts.force) {
        throw new Error(`deleting "${p.title}" is not undoable — re-run with --force`);
      }
      await sendOp(ctx, p.id, { type: "project.delete" });
      const config = await readConfig(ctx.home);
      if (config.defaultProjectId === p.id) {
        await writeConfig(ctx.home, {});
      }
      // A marker left standing would quietly re-materialize the project on
      // the next mutating command — deleting the canvas unbinds the dir too.
      if (ctx.binding?.projectId === p.id) {
        await fs.rm(markerFile(ctx.binding.root), { force: true }).catch(() => {});
        console.log(`(unbound ${ctx.binding.root} — removed ${markerFile(ctx.binding.root)})`);
      }
      console.log(`deleted project ${p.id} (recoverable by hand in deleted-projects/)`);
    }),
  );

program
  .command("use <ref>")
  .description("Bind this directory to a project (--home: set the home-wide fallback instead)")
  .option(
    "--home",
    "set the home-wide default, consulted only in directories not bound to a project",
  )
  .action(
    run(async (ref: string, opts: { home?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      ctx.projectRef = ref;
      const p = await resolveProject(ctx);
      if (opts.home) {
        await writeConfig(ctx.home, { ...(await readConfig(ctx.home)), defaultProjectId: p.id });
        console.log(`home default project: ${p.id} — "${p.title}"`);
        return;
      }
      const root = await bindableRoot(process.cwd(), ctx.home);
      if (!root) {
        throw new Error(
          "this directory cannot hold a binding (a home directory binds everything under it) — " +
            "`isocan use <ref> --home` sets the home-wide default instead",
        );
      }
      const file = await writeMarker(root, { projectId: p.id, title: p.title });
      await recordDir(ctx.home, root, p.id);
      console.log(`this directory now means "${p.title}" (${p.id}) — bound via ${file}`);
    }),
  );

// ---------- items ----------

/** Shared placement rule for new items: --at > --anchor > left of the
 * leftmost item > the origin. */
function placementFor(
  snapshot: CanvasSnapshotResponse,
  opts: { at?: string; anchor?: string },
): Placement {
  if (opts.at) return parseXY(opts.at);
  if (opts.anchor) return { anchorItemId: resolveItem(snapshot, opts.anchor).id };
  const leftmost = Object.values(snapshot.canvas.items).reduce<Item | null>(
    (best, item) => (best === null || item.x < best.x ? item : best),
    null,
  );
  return leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 };
}

/** --size WxH, or the given default. */
function sizeFor(
  size: string | undefined,
  fallback: { width: number; height: number },
): { width: number; height: number } {
  if (!size) return fallback;
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`--size expects WxH, got: ${size}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

program
  .command("add <file>")
  .description("Upload a file as a new canvas item (default placement: left of the leftmost item)")
  .option("--at <x,y>", "place at world coordinates")
  .option("--anchor <item>", "place to the left of this item")
  .option("--size <WxH>", "display size, e.g. 480x360")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .action(
    run(
      async (
        file: string,
        opts: {
          at?: string;
          anchor?: string;
          size?: string;
          title?: string;
          description?: string;
          prop: Record<string, string>;
        },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        // `add` can start an empty canvas, so it may bind this directory to
        // a fresh project when nothing else answers (#60).
        const { project: p, snapshot } = await projectAndSnapshot(ctx, { create: true });
        const data = await fs.readFile(file);
        const filename = path.basename(file);
        const mimeType = mimeFor(filename);
        await narrate(ctx, p.id, { status: `adding ${truncate(filename, 24)}…` });
        const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);

        const { width, height } = sizeFor(opts.size, defaultSize(mimeType));
        const placement = placementFor(snapshot, opts);
        const itemId = newItemId();
        const result = await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType,
            filename,
            size: upload.size,
          },
          width,
          height,
          placement,
          ...(opts.title !== undefined ? { title: opts.title } : {}),
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          ...(Object.keys(opts.prop).length > 0 ? { properties: opts.prop } : {}),
        });
        const placed = (result.envelope.op as { placement: { x: number; y: number } }).placement;
        if (ctx.json) return printJson({ itemId, placement: placed });
        console.log(`added ${itemId} (${filename}) at ${placed.x},${placed.y}`);
      },
    ),
  );

program
  .command("browse <url>")
  .description(
    "Project a live site onto the canvas as a mini-browser item — point it at the localhost dev server you're building",
  )
  .option("--at <x,y>", "place at world coordinates")
  .option("--anchor <item>", "place to the left of this item")
  .option("--size <WxH>", "display size (default 800x600)")
  .option("--title <title>")
  .action(
    run(
      async (
        url: string,
        opts: { at?: string; anchor?: string; size?: string; title?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { project: p, snapshot } = await projectAndSnapshot(ctx, { create: true });
        const site = normalizeSiteUrl(url);
        const filename = siteFilename(site);
        await narrate(ctx, p.id, { status: `projecting ${truncate(siteLabel(site), 32)}…` });
        // The blob IS the URL: a text/uri-list, so this is an ordinary
        // item.add — undo, versions, and `isocan edit` need nothing new.
        const upload = await ctx.client.uploadBlob(
          p.id,
          Buffer.from(`${site}\n`),
          BROWSER_MIME,
          filename,
        );
        const { width, height } = sizeFor(opts.size, { width: 800, height: 600 });
        const itemId = newItemId();
        const result = await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType: BROWSER_MIME,
            filename,
            size: upload.size,
          },
          width,
          height,
          placement: placementFor(snapshot, opts),
          title: opts.title ?? siteLabel(site),
        });
        const placed = (result.envelope.op as { placement: { x: number; y: number } }).placement;
        if (ctx.json) return printJson({ itemId, url: site, placement: placed });
        console.log(`projected ${site} as ${itemId} at ${placed.x},${placed.y}`);
      },
    ),
  );

program
  .command("ls")
  .description("List items on the canvas")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      await narrate(ctx, p.id, { status: "surveying the canvas…" });
      const items = Object.values(snapshot.canvas.items);
      if (ctx.json) return printJson(items);
      printTable(
        items.map((i) => ({
          id: i.id,
          title: truncate(i.title, 24),
          mime: i.versions.find((v) => v.id === i.currentVersionId)?.mimeType ?? "?",
          pos: `${i.x},${i.y}`,
          size: `${i.width}x${i.height}`,
          vers: String(i.versions.length),
          "updated by": i.updatedBy.name,
        })),
      );
    }),
  );

program
  .command("show <item>")
  .description("Show an item's full metadata and version stack")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await narrate(ctx, p.id, {
        cursor: itemCenter(item),
        status: `looking at "${truncate(item.title || item.id, 24)}"`,
      });
      if (ctx.json) return printJson(item);
      const current = item.versions.find((v) => v.id === item.currentVersionId);
      printKeyValues({
        id: item.id,
        title: item.title,
        description: item.description || "(none)",
        filename: current?.filename ?? "?",
        mime: current?.mimeType ?? "?",
        position: `${item.x},${item.y}`,
        size: `${item.width}x${item.height}`,
        properties: formatProps(item.properties) || "(none)",
        versions: `${item.versions.length} (current: ${item.currentVersionId})`,
        created: `${item.createdAt} by ${item.createdBy.name}`,
        updated: `${item.updatedAt} by ${item.updatedBy.name}`,
      });
    }),
  );

program
  .command("mv <item> <x> <y>")
  .description("Move an item")
  .allowUnknownOption() // lets negative coordinates through: isocan mv itm -80 420
  .action(
    run(async (ref: string, x: string, y: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await sendOp(ctx, p.id, { type: "item.move", itemId: item.id, x: Number(x), y: Number(y) });
      console.log(`moved ${item.id} to ${x},${y}`);
    }),
  );

program
  .command("set <item>")
  .description("Update an item's title/description/properties; --size resizes it")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .option("--rm-prop <key>", "remove a property (repeatable)", (v: string, prev: string[]) => [...prev, v], [])
  .option("--size <WxH>", "resize, e.g. 480x360")
  .action(
    run(
      async (
        ref: string,
        opts: { title?: string; description?: string; prop: Record<string, string>; rmProp: string[]; size?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { project: p, snapshot } = await projectAndSnapshot(ctx);
        const item = resolveItem(snapshot, ref);
        const patch = metaPatch(opts);
        let did = false;
        if (Object.keys(patch).length > 0) {
          await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch });
          did = true;
        }
        if (opts.size) {
          const match = opts.size.match(/^(\d+)x(\d+)$/);
          if (!match) throw new Error(`--size expects WxH, got: ${opts.size}`);
          await sendOp(ctx, p.id, {
            type: "item.resize",
            itemId: item.id,
            width: Number(match[1]),
            height: Number(match[2]),
          });
          did = true;
        }
        if (!did) throw new Error("nothing to change");
        console.log(`updated ${item.id}`);
      },
    ),
  );

program
  .command("edit <item> [file]")
  .description("Create a new version — from a file, or in $EDITOR")
  .action(
    run(async (ref: string, file: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      const current = item.versions.find((v) => v.id === item.currentVersionId)!;
      // Announce the edit BEFORE the slow part (upload, or a human in
      // $EDITOR) — the applied op will resolve this back into "done".
      await narrate(ctx, p.id, {
        activity: { kind: "working", itemId: item.id },
        cursor: itemCenter(item),
        status: `editing "${truncate(item.title || item.id, 24)}"…`,
      });

      let data: Buffer;
      let filename: string;
      let mimeType: string;
      if (file) {
        data = await fs.readFile(file);
        filename = path.basename(file);
        mimeType = mimeFor(filename);
      } else {
        const editor = process.env.EDITOR ?? process.env.VISUAL;
        if (!editor) throw new Error("no $EDITOR set — pass a file instead");
        const original = await ctx.client.downloadBlob(p.id, current.blobHash);
        const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-edit-")), current.filename);
        await fs.writeFile(tmp, original);
        const status = spawnSync(editor, [tmp], { stdio: "inherit", shell: false });
        if (status.status !== 0) throw new Error(`${editor} exited with ${status.status}`);
        data = await fs.readFile(tmp);
        if (data.equals(original)) {
          console.log("no changes — no new version created");
          return;
        }
        filename = current.filename;
        mimeType = current.mimeType;
      }

      const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);
      const versionId = newVersionId();
      await sendOp(ctx, p.id, {
        type: "item.addVersion",
        itemId: item.id,
        version: { id: versionId, blobHash: upload.blobHash, mimeType, filename, size: upload.size },
      });
      console.log(`new version ${versionId} of ${item.id} (${item.versions.length + 1} total)`);
    }),
  );

program
  .command("versions <item>")
  .description("List an item's version stack")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await narrate(ctx, p.id, {
        cursor: itemCenter(item),
        status: `comparing versions of "${truncate(item.title || item.id, 24)}"`,
      });
      if (ctx.json) return printJson(item.versions);
      printTable(
        item.versions.map((v, index) => ({
          "": v.id === item.currentVersionId ? "▶" : "",
          id: v.id,
          n: String(index + 1),
          filename: v.filename,
          size: String(v.size),
          created: `${v.createdAt} by ${v.createdBy.name}`,
        })),
      );
    }),
  );

const version = program.command("version").description("Version operations");
version
  .command("promote <item> <versionId>")
  .description("Bring a version to the top of the stack")
  .action(
    run(async (ref: string, versionId: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      const match =
        item.versions.find((v) => v.id === versionId) ??
        item.versions.find((v) => v.id.startsWith(versionId));
      if (!match) throw new Error(`no version matches "${versionId}"`);
      await sendOp(ctx, p.id, {
        type: "item.setCurrentVersion",
        itemId: item.id,
        versionId: match.id,
      });
      console.log(`current version of ${item.id}: ${match.id}`);
    }),
  );

program
  .command("rm <items...>")
  .description("Delete item(s) to the trash — several at once is one undo step")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveItem(snapshot, ref).id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.delete", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.delete", itemIds: ids });
      }
      console.log(`moved ${ids.join(", ")} to trash (isocan restore ${ids.join(" ")})`);
    }),
  );

program
  .command("restore <items...>")
  .description("Restore item(s) from the trash")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveTrashed(snapshot, ref).item.id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.restore", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.restore", itemIds: ids });
      }
      console.log(`restored ${ids.join(", ")}`);
    }),
  );

// ---------- comments ----------

const comment = program
  .command("comment")
  .description("Comment threads on the canvas")
  .addHelpText(
    "after",
    `
A thread starts with one comment — anchored to an item (--item, the pin
follows the item) or freestanding at a canvas spot (--at x,y). Replies grow
the thread; every comment is stamped with its author's identity.

Address someone with @Name (their identity name or presence label; first
names work: "@Dimitri"). Mentions are resolved when the comment is posted
and drive \`isocan wait\`'s notification filter.

Link an item with #Title (its exact title, case-insensitive, or its full
id: "#itm_…"). References are resolved when the comment is posted; in the
web app the chip flies the reader to the item.`,
  );

/** Build the comment payload, resolving @Name mentions against everyone the
 * author can see (canvas actors plus the live presence roster, labels too)
 * and #Title references against the live items. */
async function newComment(
  ctx: Ctx,
  projectId: string,
  snapshot: CanvasSnapshotResponse,
  body: string,
): Promise<NewComment> {
  const candidates: MentionCandidate[] = collectCanvasActors(snapshot.canvas);
  const sessions = await ctx.client.listSessions(projectId).catch(() => []);
  for (const s of sessions) {
    candidates.push(s.actor);
    if (s.label) candidates.push({ id: s.actor.id, name: s.label });
  }
  const mentions = extractMentions(body, candidates);
  const items = extractItemRefs(body, collectItemRefCandidates(snapshot.canvas));
  return {
    id: newCommentId(),
    body,
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

comment
  .command("add <text>")
  .description("Start a thread — anchored to an item or freestanding at --at")
  .option("--item <item>", "anchor to this item")
  .option("--at <x,y>", "freestanding at world coordinates")
  .action(
    run(async (text: string, opts: { item?: string; at?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx, { create: true });
      if (!opts.item && !opts.at) throw new Error("pass --item <item> or --at <x,y>");
      let x: number, y: number, anchorItemId: string | null;
      if (opts.item) {
        const item = resolveItem(snapshot, opts.item);
        anchorItemId = item.id;
        // Anchored pins store an offset from the item origin: just off the
        // item's top-right corner.
        x = item.width + 12;
        y = 0;
      } else {
        ({ x, y } = parseXY(opts.at!));
        anchorItemId = null;
      }
      const threadId = newThreadId();
      await sendOp(ctx, p.id, {
        type: "thread.create",
        threadId,
        x,
        y,
        anchorItemId,
        comment: await newComment(ctx, p.id, snapshot, text),
      });
      console.log(`started thread ${threadId}`);
    }),
  );

comment
  .command("reply <thread> <text>")
  .description("Reply to a thread")
  .action(
    run(async (threadRef: string, text: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const thread = resolveThread(snapshot, threadRef);
      await sendOp(ctx, p.id, {
        type: "thread.reply",
        threadId: thread.id,
        comment: await newComment(ctx, p.id, snapshot, text),
      });
      console.log(`replied to ${thread.id}`);
      // The receipt is the moment an agent feels finished — and the moment
      // it walks off the canvas, leaving a human talking to a face that
      // isn't listening. So the last line it reads here is the next move.
      // Only for an agent mid-session: a person replying is just replying.
      if (await readSessionFile(ctx.home, ctx.actor.id)) {
        console.log(`  → now park: isocan wait --json --timeout <sec>`);
      }
    }),
  );

comment
  .command("anchor <thread> [item]")
  .description("Re-pin a thread: anchor it to an item, or detach it with --at")
  .option("--at <x,y>", "detach: make the thread freestanding at world coordinates")
  .addHelpText(
    "after",
    `
Made for the "comment first, item second" flow: a freestanding comment asks
for something, you build the item, then anchor the thread to it so the pin
follows the item from now on.`,
  )
  .action(
    run(
      async (threadRef: string, itemRef: string | undefined, opts: { at?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const { project: p, snapshot } = await projectAndSnapshot(ctx);
        const thread = resolveThread(snapshot, threadRef);
        let x: number, y: number, anchorItemId: string | null;
        if (itemRef) {
          const item = resolveItem(snapshot, itemRef);
          anchorItemId = item.id;
          // Same spot as `comment add --item`: just off the top-right corner.
          x = item.width + 12;
          y = 0;
        } else if (opts.at) {
          ({ x, y } = parseXY(opts.at));
          anchorItemId = null;
        } else {
          throw new Error("pass an item to anchor to, or --at x,y to detach");
        }
        await sendOp(ctx, p.id, { type: "thread.setAnchor", threadId: thread.id, anchorItemId, x, y });
        console.log(
          anchorItemId
            ? `anchored ${thread.id} to ${anchorItemId}`
            : `detached ${thread.id} — freestanding at ${x},${y}`,
        );
      },
    ),
  );

comment
  .command("list")
  .description("List comment threads")
  .option("--item <item>", "only threads anchored to this item")
  .action(
    run(async (opts: { item?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      await narrate(ctx, p.id, { status: "reading the comments…" });
      let threads = Object.values(snapshot.canvas.threads);
      if (opts.item) {
        const item = resolveItem(snapshot, opts.item);
        threads = threads.filter((t) => t.anchorItemId === item.id);
      }
      if (ctx.json) return printJson(threads);
      if (threads.length === 0) return printTable([]);
      for (const t of threads) {
        const anchor = t.main
          ? "★ main"
          : t.anchorItemId
            ? `on ${t.anchorItemId}`
            : `at ${t.x},${t.y}`;
        console.log(`${t.id} (${anchor})`);
        for (const c of t.comments) {
          console.log(`  ${c.author.name} · ${c.createdAt}`);
          console.log(`    ${c.body}`);
        }
      }
    }),
  );

comment
  .command("main [thread]")
  .description("Show, designate, or clear the canvas's main thread")
  .option("--clear", "demote the current main thread back to a canvas pin")
  .addHelpText(
    "after",
    `
The main thread is the designated agent↔user channel: the web app renders it
as a docked chat panel instead of a canvas pin, and \`isocan wait\` ALWAYS
wakes on comments landing in it — no @-mention needed. At most one thread is
main. With no argument, prints the current main thread.`,
  )
  .action(
    run(async (threadRef: string | undefined, opts: { clear?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const current = mainThread(snapshot.canvas);
      if (opts.clear) {
        if (!current) throw new Error("no main thread to clear");
        await sendOp(ctx, p.id, { type: "thread.setMain", threadId: null });
        return console.log(`cleared main thread (was ${current.id})`);
      }
      if (!threadRef) {
        if (ctx.json) return printJson(current);
        return console.log(current ? `main thread: ${current.id}` : "no main thread");
      }
      const thread = resolveThread(snapshot, threadRef);
      await sendOp(ctx, p.id, { type: "thread.setMain", threadId: thread.id });
      console.log(`main thread: ${thread.id}`);
    }),
  );

comment
  .command("rm <thread>")
  .description("Delete a thread")
  .action(
    run(async (threadRef: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const thread = resolveThread(snapshot, threadRef);
      await sendOp(ctx, p.id, { type: "thread.delete", threadId: thread.id });
      console.log(`deleted thread ${thread.id}`);
    }),
  );

// ---------- presence sessions ----------

const session = program
  .command("session")
  .description("Presence session — your live cursor on the canvas")
  .addHelpText(
    "after",
    `
Sessions live in the daemon and expire after a few idle minutes; any session
command refreshes yours, and performing operations auto-revives it. While a
session is active presence narrates itself: every operation moves your cursor
to where it happened, reads (\`show\`, \`ls\`, \`comment list\`, …) set a derived
status, and posting a comment clears it. \`work --say\` puts it in your own
words — those outrank the derived narration until your next comment.`,
  );

session
  .command("start")
  .description("Appear on the canvas; ops will move your cursor as you work")
  .option("--label <label>", "display name override")
  .action(
    run(async (opts: { label?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      // Appearing is the start of work: an unbound directory gets its canvas
      // here if the handshake didn't already make one (#60).
      const p = await resolveProject(ctx, { create: true });
      const existing = await readSessionFile(ctx.home, ctx.actor.id);
      if (existing) {
        await ctx.client.endSession(existing.projectId, existing.sessionId).catch(() => {});
      }
      const created = await ctx.client.createSession(p.id, ctx.actor, opts.label);
      await writeSessionFile(ctx.home, ctx.actor.id, {
        projectId: p.id,
        sessionId: created.sessionId,
        ...(opts.label !== undefined ? { label: opts.label } : {}),
      });
      console.log(
        `session ${created.sessionId} live on "${p.title}" — cursor follows your ops (ttl ${Math.round(created.ttlMs / 1000)}s, any command refreshes it)`,
      );
    }),
  );

session
  .command("move <x> <y>")
  .description("Move your cursor to world coordinates")
  .allowUnknownOption() // negative coordinates
  .action(
    run(async (x: string, y: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      await touchSession(ctx, p.id, {
        cursor: { x: Number(x), y: Number(y) },
        activity: null,
      });
      console.log(`cursor at ${x},${y}`);
    }),
  );

session
  .command("point <item>")
  .description("Move your cursor to an item")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await touchSession(ctx, p.id, {
        cursor: { x: item.x + item.width / 2, y: item.y + item.height / 2 },
        activity: null,
      });
      console.log(`pointing at ${item.id}`);
    }),
  );

session
  .command("work [item]")
  .description("Show yourself busy — cursor animates around an item (or --at a spot) until you move, finish an op, or go idle")
  .option("--at <x,y>", "work at a freestanding canvas location instead of an item")
  .option("--say <status>", "status line to show while working")
  .action(
    run(async (ref: string | undefined, opts: { at?: string; say?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      if (!ref && !opts.at) throw new Error("pass an item or --at x,y");
      let activity: import("@isocan/core").PresenceActivity;
      let cursor: { x: number; y: number };
      let where: string;
      if (ref) {
        const item = resolveItem(snapshot, ref);
        activity = { kind: "working", itemId: item.id };
        cursor = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
        where = item.id;
      } else {
        const point = parseXY(opts.at!);
        activity = { kind: "working", ...point };
        cursor = point;
        where = opts.at!;
      }
      await touchSession(ctx, p.id, {
        activity,
        cursor,
        ...(opts.say !== undefined ? { status: opts.say } : {}),
      });
      console.log(`working on ${where}${opts.say ? ` — ${opts.say}` : ""}`);
    }),
  );

session
  .command("say [status]")
  .description("Set (or clear) the status line under your cursor")
  .action(
    run(async (status: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      await touchSession(ctx, p.id, { status: status ?? null });
      console.log(status ? `status: ${status}` : "status cleared");
    }),
  );

session
  .command("end")
  .description("Leave the canvas")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const active = await readSessionFile(ctx.home, ctx.actor.id);
      if (active) {
        await ctx.client.endSession(active.projectId, active.sessionId).catch(() => {});
        await writeSessionFile(ctx.home, ctx.actor.id, null);
      }
      // The pointer is a cache; the daemon is the truth. Sweep every CLI
      // session this actor still holds, so a pointer lost to a crash or a
      // migration cannot leave a face blinking after its agent has left.
      const swept = await ctx.client
        .endActorSessions(ctx.actor.id, "cli")
        .catch(() => ({ ended: 0 }));
      console.log(active || swept.ended > 0 ? "session ended" : "no active session");
    }),
  );

program
  .command("who")
  .description("Who is on this canvas right now (--all: everyone who has touched it)")
  .option("--all", "include names from the canvas history, not just live sessions")
  .action(
    run(async (opts: { all?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const sessions = await ctx.client.listSessions(p.id);
      if (opts.all) {
        const known = await knownNames(ctx, p, sessions);
        if (ctx.json) return printJson(known);
        return printTable(
          known.map((n) => ({ name: n.name, id: n.id, live: n.live ? "yes" : "—" })),
        );
      }
      if (ctx.json) return printJson(sessions);
      printTable(
        sessions.map((s) => ({
          who: s.label ?? s.actor.name,
          kind: s.kind,
          cursor: s.cursor ? `${Math.round(s.cursor.x)},${Math.round(s.cursor.y)}` : "—",
          selection: String(s.selection.length || "—"),
          activity: s.activity
            ? "itemId" in s.activity
              ? `working on ${s.activity.itemId}`
              : `working at ${Math.round(s.activity.x)},${Math.round(s.activity.y)}`
            : "—",
          status: s.status ?? "—",
          seen: s.lastSeen,
        })),
      );
    }),
  );

/** A name in use on a canvas — from a live session or from its history. Keyed
 * by NAME, not actor: one person can have worked under several, and every one
 * of them still answers to `@Name`. Agents read this to pick a free one. */
interface KnownName {
  name: string;
  /** Who answers to it. */
  id: string;
  /** They are on the canvas right now, under this name. */
  live: boolean;
}

async function knownNames(
  ctx: Ctx,
  project: Project,
  sessions: PresenceSession[],
): Promise<KnownName[]> {
  const known = new Map<string, KnownName>();
  const add = (name: string, id: string, live: boolean) => {
    const key = name.toLowerCase();
    const prior = known.get(key);
    if (!prior) known.set(key, { name, id, live });
    else if (live) known.set(key, { ...prior, live: true });
  };
  const { canvas } = await ctx.client.snapshot(project.id);
  // The project's own author counts: they named the canvas before touching it.
  for (const actor of [project.createdBy, project.updatedBy]) add(actor.name, actor.id, false);
  for (const candidate of collectCanvasNames(canvas)) add(candidate.name, candidate.id, false);
  for (const session of sessions) {
    add(session.actor.name, session.actor.id, true);
    if (session.label) add(session.label, session.actor.id, true);
  }
  return [...known.values()].sort(
    (a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name),
  );
}

// ---------- waiting on collaborators ----------

function describeEntry(entry: import("@isocan/core").LogEntry): string {
  const op = entry.envelope.op;
  const who = entry.envelope.actor.name;
  switch (op.type) {
    case "thread.create": {
      const where = op.anchorItemId
        ? `on ${op.anchorItemId}`
        : `at ${Math.round(op.x)},${Math.round(op.y)}`;
      return `${who} started thread ${op.threadId} (${where}): "${op.comment.body}"`;
    }
    case "thread.reply":
      return `${who} replied on ${op.threadId}: "${op.comment.body}"`;
    case "thread.setAnchor":
      return op.anchorItemId
        ? `${who} anchored thread ${op.threadId} to ${op.anchorItemId}`
        : `${who} detached thread ${op.threadId} (at ${Math.round(op.x)},${Math.round(op.y)})`;
    case "thread.setMain":
      return op.threadId
        ? `${who} made ${op.threadId} the main thread`
        : `${who} cleared the main thread`;
    default: {
      const target =
        (op as { itemId?: string }).itemId ?? (op as { threadId?: string }).threadId ?? "";
      return `${who} — ${op.type}${target ? ` ${target}` : ""}`;
    }
  }
}

/** Where a thread sits in world coordinates, anchored or freestanding. */
function threadLocus(
  snapshot: CanvasSnapshotResponse,
  thread: CommentThread,
): { x: number; y: number } {
  const anchor = thread.anchorItemId ? snapshot.canvas.items[thread.anchorItemId] : undefined;
  return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
}

/**
 * The wake IS the status: the moment `wait` returns with a summons, land the
 * agent's presence on the summoning canvas — cursor at the thread, status
 * "reading your comment…" — before it runs a single command. This closes the
 * silent stretch between "summoned" and "first op" without the agent having
 * to remember anything; the daemon retires the status when the reply lands.
 */
async function landPresence(
  ctx: Ctx,
  entry: WatchedLogEntry,
  snap: () => Promise<CanvasSnapshotResponse>,
): Promise<void> {
  const op = entry.envelope.op as { threadId: string };
  const snapshot = await snap();
  const thread = snapshot.canvas.threads[op.threadId];
  const cursor = thread ? threadLocus(snapshot, thread) : null;
  const patch: import("@isocan/core").UpdateSessionRequest = {
    status: "reading your comment…",
    statusSource: "lifecycle",
    activity: null,
    ...(cursor ? { cursor } : {}),
  };
  const active = await readSessionFile(ctx.home, ctx.actor.id);
  if (active && active.projectId === entry.projectId) {
    return touchSession(ctx, entry.projectId, patch);
  }
  // Summoned to a canvas the session isn't on: move over, keeping the label
  // the human knows this agent by.
  if (active) await ctx.client.endSession(active.projectId, active.sessionId).catch(() => {});
  const created = await ctx.client.createSession(entry.projectId, ctx.actor, active?.label);
  await writeSessionFile(ctx.home, ctx.actor.id, {
    projectId: entry.projectId,
    sessionId: created.sessionId,
    ...(active?.label !== undefined ? { label: active.label } : {}),
  });
  await ctx.client.updateSession(entry.projectId, created.sessionId, patch);
}

program
  .command("wait")
  .description(
    "Block until someone comments for you on this canvas — the agent's feedback loop",
  )
  .option("--all-ops", "wake on any operation by another actor, not just comments")
  .option("--timeout <sec>", "give up after this many seconds (exit code 2)")
  .option("--since <seq>", "wake on anything after this oplog position instead of now")
  .addHelpText(
    "after",
    `
The wait is on ONE canvas — this directory's (#60), or the one --project or
--since names. An agent belongs to the canvas of the directory it works in,
and that canvas is where the human reaches it.

A comment wakes you when it @-mentions you (identity name or session label),
lands in a MAIN thread (\`comment main\`), or lands in a thread you wrote
in or were mentioned in. Everything else — including comments that mention
nobody — is ether: visible in \`tail\`, but not actionable. --all-ops wakes
on everything.

Run this in the FOREGROUND, as one tool call: the call returning is your
wake-up. Detached (\`nohup\`, \`&\`, output redirected to a file you poll) it
still holds your cursor but cannot wake you — a file is not a notification.
Size --timeout to the longest call your harness allows. Exit 2 is silence,
not dismissal: park again. A wait that expires never means the collaboration
is over — only the human saying so does.

While parked, the cursor you left on the canvas says "waiting for you…";
waking on a summons then moves your presence for you: your cursor lands on
the thread that woke you, showing "reading your comment…" until your next
command or reply. No \`session start\` needed after a wake.`,
  )
  .action(
    run(async (
      opts: { allOps?: boolean; timeout?: string; since?: string },
      cmd: Command,
    ) => {
      const ctx = await ctxOf(cmd);
      // ONE canvas, always (#60): the --project/--since one, or whatever
      // this directory resolves to. There is no home-wide mode — an agent
      // belongs to the canvas of the directory it works in, and its canvas
      // is where the human reaches it.
      const p = await resolveProject(ctx);
      // Seed from the watch route itself — the very call the loop will live
      // on — even when --since already names the position. Proving it works
      // HERE is what keeps a wait that cannot poll from ever advertising
      // itself as parked: it dies before it touches presence.
      const seeded = (await ctx.client.watchLog({ only: [p.id] })).cursors;
      let cursors: Record<string, number> = {
        [p.id]:
          opts.since !== undefined
            ? Number(opts.since)
            : (seeded[p.id] ?? (await ctx.client.snapshot(p.id)).lastSeq),
      };
      const deadline = opts.timeout ? Date.now() + Number(opts.timeout) * 1000 : null;

      // Waiting is presence: show it, and keep it alive while parked. The
      // canvas session — the cursor the human actually sees — says it is
      // waiting. Torn down on every way out — a canvas must never show an
      // agent listening when no process is.
      const session = await readSessionFile(ctx.home, ctx.actor.id);
      // Retract everything the wait advertised. The canvas status is sticky
      // text on a session that outlives us — nothing clears it but this. A
      // wake that landed a handoff status is the one exception: that claim
      // is now the truth, and the daemon retires it when the reply lands.
      let woken = false;
      const stopPresence = async () => {
        if (session && !woken) {
          // Don't resurrect an expired session just to blank it: if it is
          // gone, nothing is left claiming to wait. (Re-read the file: the
          // heartbeat may have revived the session under a new id.)
          const active = await readSessionFile(ctx.home, ctx.actor.id);
          if (active) {
            await ctx.client
              .updateSession(active.projectId, active.sessionId, { status: null })
              .catch(() => {});
          }
        }
      };
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
          void stopPresence().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
        });
      }
      const say = async (status: string) => {
        // The visible cursor must say it too: a parked agent whose canvas
        // session read as silent (or worse, "working") is exactly the lie
        // this narration exists to prevent. touchSession also keeps that
        // session alive for the whole park instead of letting it expire.
        if (session) {
          await touchSession(ctx, session.projectId, { status, statusSource: "lifecycle" }).catch(
            () => {},
          );
        }
      };

      // Names I answer to: identity name, plus my session label if any.
      const selfNames: MentionCandidate[] = [ctx.actor];
      if (session?.label) selfNames.push({ id: ctx.actor.id, name: session.label });
      const addressesMe = (c: NewComment | Comment) =>
        (c.mentions ?? []).includes(ctx.actor.id) ||
        extractMentions(c.body, selfNames).length > 0;

      // A comment is for me when it addresses me, lands in the MAIN thread
      // (the designated agent↔user channel — always actionable), or lands in
      // a thread I'm part of (wrote in / was mentioned in). Everything else
      // is ether — not actionable. `snap` is fetched lazily, per canvas per
      // poll batch.
      const isForMe = async (
        op: Operation,
        snap: () => Promise<CanvasSnapshotResponse>,
      ): Promise<boolean> => {
        if (op.type !== "thread.create" && op.type !== "thread.reply") return false;
        if (addressesMe(op.comment)) return true;
        // Snapshot state, not the op, decides mainness: it also catches the
        // thread.create that BIRTHS the main thread (op.main or a setMain
        // landing in the same batch).
        const thread = (await snap()).canvas.threads[op.threadId];
        if (thread?.main) return true;
        if (op.type === "thread.reply") {
          if (thread?.comments.some((c) => c.author.id === ctx.actor.id || addressesMe(c))) {
            return true;
          }
        }
        return false;
      };

      try {
        await say("waiting for you…");

        for (;;) {
          const remaining = deadline === null ? Infinity : deadline - Date.now();
          if (remaining <= 0) {
            // Exit 2 is silence, not dismissal. Say so on the way out: an
            // agent that reads "timed out" as "we're done here" is the most
            // common way a session dies with nobody deciding to end it.
            console.error(
              "wait: timed out with no feedback — nobody came yet. Park again; " +
                "the session ends when the human says so, not when a wait expires.",
            );
            process.exitCode = 2;
            return;
          }
          const window = Math.max(1, Math.min(30_000, remaining === Infinity ? 30_000 : remaining));
          const batch = await ctx.client.watchLog({ cursors, waitMs: window, only: [p.id] });
          cursors = batch.cursors;
          const snaps = new Map<string, Promise<CanvasSnapshotResponse>>();
          const snapOf = (projectId: string) => () => {
            let pending = snaps.get(projectId);
            if (!pending) snaps.set(projectId, (pending = ctx.client.snapshot(projectId)));
            return pending;
          };
          const matches: WatchedLogEntry[] = [];
          for (const entry of batch.entries) {
            if (entry.envelope.actor.id === ctx.actor.id) continue;
            if (opts.allOps || (await isForMe(entry.envelope.op, snapOf(entry.projectId)))) {
              matches.push(entry);
            }
          }
          if (matches.length > 0) {
            // A summons (a comment for me) lands presence on its canvas
            // automatically — cursor on the thread, "reading your comment…"
            // — so the canvas never goes silent between wake and first op.
            const summons = matches.find(
              (m) =>
                m.envelope.op.type === "thread.create" ||
                m.envelope.op.type === "thread.reply",
            );
            if (summons) {
              woken = await landPresence(ctx, summons, snapOf(summons.projectId)).then(
                () => true,
                () => false,
              );
            }
            // The documented loop parks with --json, so the nudge the
            // human-readable branch prints below has to live here too —
            // otherwise the agents who follow the skill are the only ones
            // who never get told what comes next.
            if (ctx.json) {
              return printJson({
                cursors,
                entries: matches,
                next: "reply on the thread, then `isocan wait` again — a lap ends parked",
              });
            }
            for (const entry of matches) {
              console.log(describeEntry(entry));
              const op = entry.envelope.op;
              if (op.type === "thread.create" || op.type === "thread.reply") {
                console.log(`  → isocan comment reply ${op.threadId} "…"`);
              }
            }
            if (woken && summons) {
              console.log(
                `(your cursor already sits on that thread — it shows ` +
                  `"reading your comment…" until your next command or reply)`,
              );
            }
            return;
          }
          await say("waiting for you…"); // heartbeat between polls
        }
      } finally {
        // Woken, timed out, or thrown out by a daemon that cannot watch —
        // every way out of the loop retracts the presence it advertised.
        await stopPresence();
      }
    }),
  );

program
  .command("tail")
  .description("Print recent operations; -f follows the live stream")
  .option("-f, --follow", "keep streaming new operations as they land")
  .option("-n, --lines <n>", "recent entries to show first (default 10)")
  .action(
    run(async (opts: { follow?: boolean; lines?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const printEntry = (entry: import("@isocan/core").LogEntry) => {
        if (ctx.json) return console.log(JSON.stringify(entry));
        const cause = entry.cause ? ` [${entry.cause.kind} of #${entry.cause.targetSeq}]` : "";
        console.log(`#${entry.seq}  ${entry.envelope.ts}  ${describeEntry(entry)}${cause}`);
      };
      const all = await ctx.client.getLog(p.id, 0);
      for (const entry of all.slice(-Number(opts.lines ?? 10))) printEntry(entry);
      let seq = all.length > 0 ? all[all.length - 1]!.seq : 0;
      if (!opts.follow) return;
      for (;;) {
        const entries = await ctx.client.getLog(p.id, seq, 30_000);
        for (const entry of entries) printEntry(entry);
        if (entries.length > 0) seq = entries[entries.length - 1]!.seq;
      }
    }),
  );

// ---------- undo/redo & trash ----------

program
  .command("undo")
  .description("Undo your last operation (undo is per-actor — never a collaborator's)")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const entry = await ctx.client.undo(p.id, ctx.actor);
      console.log(`undid: applied ${entry.envelope.op.type}`);
    }),
  );

program
  .command("redo")
  .description("Redo your last undone operation")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const entry = await ctx.client.redo(p.id, ctx.actor);
      console.log(`redid: applied ${entry.envelope.op.type}`);
    }),
  );

program
  .command("gc")
  .description("Reclaim storage: compact the oplog and sweep unreachable blobs")
  .option("--dry-run", "report what would be freed without deleting anything")
  .option("--keep-ops <n>", "how many recent operations to keep undoable (default 500)")
  .action(
    run(async (opts: { dryRun?: boolean; keepOps?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const report = await ctx.client.gc(p.id, {
        ...(opts.dryRun ? { dryRun: true } : {}),
        ...(opts.keepOps !== undefined ? { keepOps: Number(opts.keepOps) } : {}),
      });
      if (ctx.json) return printJson(report);
      const verb = report.dryRun ? "would sweep" : "swept";
      printKeyValues({
        oplog: `${report.retainedEntries} entries kept, ${report.droppedEntries} ${report.dryRun ? "would be archived" : "archived"}`,
        reachable: `${report.reachableBlobs} blobs (${formatBytes(report.reachableBytes)})`,
        [verb]: `${report.sweptBlobs} blobs (${formatBytes(report.sweptBytes)})`,
        ...(report.skippedRecentBlobs > 0
          ? { "skipped (too recent)": String(report.skippedRecentBlobs) }
          : {}),
      });
    }),
  );

const trash = program.command("trash").description("List, restore, or permanently empty deleted items");

trash
  .command("list")
  .description("List trashed items")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      if (ctx.json) return printJson(snapshot.canvas.trash);
      printTable(
        snapshot.canvas.trash.map((t) => ({
          id: t.item.id,
          title: truncate(t.item.title, 30),
          deleted: `${t.deletedAt} by ${t.deletedBy.name}`,
        })),
      );
    }),
  );

trash
  .command("restore <items...>")
  .description("Restore trashed item(s)")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveTrashed(snapshot, ref).item.id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.restore", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.restore", itemIds: ids });
      }
      console.log(`restored ${ids.join(", ")}`);
    }),
  );

trash
  .command("empty")
  .description("Empty the trash (requires --force; not undoable)")
  .option("--force", "confirm")
  .action(
    run(async (opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      if (!opts.force) {
        throw new Error(
          `emptying the trash (${snapshot.canvas.trash.length} items) is not undoable — re-run with --force`,
        );
      }
      await sendOp(ctx, p.id, { type: "trash.empty" });
      console.log("trash emptied");
    }),
  );

program.parseAsync().catch((err: unknown) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
