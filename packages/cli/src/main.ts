import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import type {
  AgentRules,
  EnrolledAgent,
  Persona,
  RunFinding,
  InboxEntry,
  Actor,
  BadgeSummary,
  CanvasAddress,
  CanvasLinkState,
  CanvasSnapshotResponse,
  GcReport,
  GrantSubject,
  Comment,
  CommentThread,
  Item,
  MentionCandidate,
  NewComment,
  Operation,
  Placement,
  PresenceSession,
  Canvas,
  SweepReport,
  UpgradeVerdict,
  WatchedLogEntry,
} from "@isocan/core";
import {
  fitMoves,
  type FitTarget,
  BROWSER_MIME,
  DEFAULT_HOME_URL,
  DEFAULT_PORT,
  DRAWING_FILENAME,
  DRAWING_MIME,
  DRAWING_PROPERTIES,
  DRAWING_TITLE,
  COMMAND_NAME,
  IDENTITY_COLORS,
  INSTALL_SPEC,
  LINK,
  grantSubjectOf,
  capabilityOf,
  normalizeSubject,
  PASS_TTL_MS,
  actorNameIn,
  canvasUrl,
  itemUrl,
  sessionState,
  urlWithPass,
  workbenchUrl,
  canvasUrlWithPass,
  parseCanvasAddress,
  setupCommand,
  actorsAnswerTo,
  cancelledSince,
  commandFileText,
  findCommand,
  healthPath,
  parseCommandFile,
  collectCanvasActors,
  bySeverity,
  checkDesign,
  designSystem,
  designSystemProperties,
  parseDesign,
  toCss,
  toDtcg,
  recentActivity,
  collectCanvasNames,
  collectItemRefCandidates,
  extractItemRefs,
  ALIGN_EDGES,
  ITEM_KINDS,
  alignMoves,
  annotationsOf,
  distributeMoves,
  drawingViewBox,
  SHORTCUTS,
  formatMoves,
  shortcutsAsText,
  elapsedLabel,
  extractMentions,
  isIdentityColor,
  isDrawingItem,
  skillNameFrom,
  // This file already has a `skillSource`: the directory of the skill this
  // build ships. Core's answers a different question — where a PUBLISHED
  // skill lives — so it comes in under a name that says which.
  skillSource as publishedSkill,
  itemKind,
  mergeDrawings,
  opMatchesFilters,
  renamedFilename,
  mainThread,
  newCommentId,
  anchorOffset,
  buildCorpus,
  buildRecap,
  harvestPreferences,
  cleanFilePath,
  FILE_PROP,
  copyProperties,
  duplicatePlacements,
  newGroupId,
  needsDesignSystem,
  TEXT_FACES,
  TEXT_FACE_PROP,
  TEXT_FILENAME,
  TEXT_MIME,
  TEXT_PROPERTIES,
  TEXT_STYLES,
  textStyleFrom,
  AREA_DEFAULT_SIZE,
  AREA_FILENAME,
  AREA_MIME,
  AREA_PROPERTIES,
  AREA_TINT_PROP,
  PLACEMENT_GAP,
  SPRINT_BOARD,
  BOARD_GAP,
  BOARD_PROP,
  BRIEF_PROP,
  boardLayout,
  boardAreaFor,
  boardOf,
  briefCard,
  briefItem,
  areaInner,
  areasOf,
  findArea,
  freeSpotIn,
  itemsIn,
  isArea,
  TEXT_STYLE_PROP,
  textBox,
  textTitle,
  fileOf,
  newItemId,
  newCanvasId,
  newThreadId,
  newVersionId,
  // Core's is the pure, total computation; this file's `normalizeHomeUrl`
  // wraps it with the refusals a person typing an address has earned. Two
  // names because they answer two questions — see both doc comments.
  normalizeHomeUrl as normalizeAddress,
  normalizeSiteUrl,
  siteFilename,
  siteLabel,
  MAP_PARENT_PROP,
  MAP_PROP,
  mapChildren,
  mapOf,
  mapOutline,
  tidyMap,
  mapsOn,
  newMapId,
  importDesign,
  importedBody,
  serializeDesign,
  contextPieces,
  contextReport,
  convergePlan,
  isRefusal,
  openAsks,
  itemThread,
  bindVerdict,
  takenSentence,
  PERSONA_DIR,
  parsePersona,
  goalLine,
  personaWarnings,
  runFindings,
  tallyOutcomes,
  inboxOn,
  inboxNewestFirst,
  inboxTally,
  inboxLine,
  namesFor,
  PARK_ADOPTED_CODE,
  dispatchReason,
  isSystemActor,
  newId,
  rulesOf,
  SYSTEM_ACTOR,
  docStatus,
  statusProblems,
  toJsonCanvas,
  describeLosses,
  contextMark,
  markPatch,
  markLabel,
  isSlide,
  slidePatch,
  slides,
  SLIDE_EMOJI,
  majors,
  majorLine,
  track,
  at,
  past,
  span,
  ago,
  opWords,
  sortCanvases,
  filterCanvases,
  isCanvasSort,
  CANVAS_SORTS,
  FORMAT_MODES,
  isFormatMode,
  type FormatMode,
  lensActs,
  lensEntries,
  lensLive,
  lensLiveList,
  lensLiveWords,
  lensGroups,
  lensShape,
  lensSubjects,
  lensSubjectLabels,
  filterLens,
  lensKinds,
  type LensFilter,
  LENS_REFUSAL,
  type LensBy,
  type LensLog,
  type LensSource,
  PAPERS,
  PAPER_PROP,
  PAPER_SIZE,
  isFaceMark,
  PHASES,
  SPRINT_END,
  phaseSpec,
  parseDuration,
  clockLabel,
  sprintState,
  remainingSeconds,
  phaseOver,
  hidesVotes,
  handInPatch,
  handedInFor,
  agentActorIds,
  tally,
  wallFor,
} from "@isocan/core";
import { buildStamp, describeBuild, paths, plausibleSha, readConfigFile, stalenessOf } from "@isocan/server";
import { canvasRefOf, makeCtx, metaPatch, readConfig, writeConfig, type Ctx } from "./ctx.ts";
import {
  type HomeRecord,
  type ResolveOptions,
  baseForCwd,
  ensureDirBinding,
  homeAddressOf,
  readHomeRecord,
  matchRef,
  resolveCanvas,
} from "@isocan/api";
import {
  bindableRoot,
  dirsOf,
  findBinding,
  markerFile,
  readMarker,
  recordDir,
  writeMarker,
} from "@isocan/server";
import { DEFAULT_MODE, DIRECT_VAR, refuseDaemonVerb, resolveDeclared } from "@isocan/api";
import { CanvasHandle, activityRows, buildComment } from "@isocan/api";
import { defaultCloneDir, gitRemote } from "./gitrepo.ts";
import { ApiError, DaemonClient, type Health } from "@isocan/api";
import {
  adoptIdentity,
  readIdentity,
  claimSessionIdentity,
  HOME_CLAIM_KEY,
  noIdentityHere,
  reclaimIdentity,
  resolveIdentity,
  retireStrandedIdentities,
  writeIdentity,
} from "@isocan/api";
import { agentGuide } from "./agent-guide.ts";
import { harnessSessions } from "@isocan/api";
import { adoptRcAgent, gateTurn, readRcAgents, removeRcAgent, setRcSessionId, upsertRcAgent } from "./rc.ts";
import { AcpAgentProcess, adapterEnv, adapterFor, enrolmentKey } from "./acp.ts";
import {
  checkoutState,
  planUpgrade,
  whichInstall,
  type Install,
  type UpgradePlan,
} from "./upgrade.ts";
import { shaOfRoot } from "@isocan/api";
import {
  adoptGlobal,
  applySwap,
  autoUpgrade,
  currentBuild,
  currentSha,
  flipTo,
  lastRefusal,
  listBuilds,
  upgradePolicy,
  type Adoption,
  type Build,
} from "./managed.ts";
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
  // Not the literal it was: `isocan --version` is the first thing anybody runs
  // to answer "which isocan is this", and `0.1.0` answered it identically for
  // every build ever shipped. This is THIS CLI's build — the daemon's may
  // differ, which is what `isocan status` is for.
  .version(describeBuild(buildStamp()))
  .option("--json", "machine-readable JSON output (any command)")
  .option("--port <port>", "daemon port (default 4441)")
  .option("--agent-help", "how to collaborate on a canvas as an agent: the whole protocol")
  .option(
    "--canvas <ref>",
    "canvas id or title prefix (default: this directory's binding, then `isocan use --home`)",
  )
  // The old spelling, kept working and kept out of help — same reason the
  // `project` verb keeps its alias.
  .addOption(new Option("--project <ref>").hideHelp())
  // Commander renders an aliased subcommand as `canvas|project`, in the
  // command list and in its own usage line; help advertises the new word only.
  // Inherited by every subcommand.
  .configureHelp({
    commandUsage: (cmd) => {
      let ancestors = "";
      for (let up = cmd.parent; up; up = up.parent) ancestors = `${up.name()} ${ancestors}`;
      return `${ancestors}${cmd.name()} ${cmd.usage()}`;
    },
    subcommandTerm: (cmd) =>
      cmd.name() +
      (cmd.options.length > 0 ? " [options]" : "") +
      cmd.registeredArguments
        .map((arg) => (arg.required ? ` <${arg.name()}>` : ` [${arg.name()}]`))
        .join(""),
  })
  .addHelpText(
    "after",
    `
Agents, start here:
  \`isocan --agent-help\` is the collaboration protocol in full — naming
  yourself, appearing on the canvas, answering comments, parking on \`wait\`.
  It ships inside this build, so it always describes the commands below.

The system:
  A local daemon owns the state; this CLI and the web app are equal clients.
  Every command here sends the same operation the web app would, so changes
  appear live in any open browser — and vice versa.

  canvas    a canvas; list with \`isocan canvas list\`
  item       a file rendered on the canvas (markdown, image, video, HTML) at
             x,y world coordinates (+x right, +y down)
  browser    \`isocan browse <url>\` projects a live site onto the canvas —
             point it at the localhost dev server you're building and the
             human watches it run (vite HMR keeps it fresh by itself)
  version    every \`edit\` stacks a new version on the item; \`version promote\`
             brings any older one back to the top
  comment    threads pinned to an item (--item) or a spot (--at x,y); write
             @Name to address someone, \`comment anchor\` to re-pin a thread.
             One thread may be \`comment main\`: the canvas's Chat, as the
             web app calls it — docked rather than pinned, and \`wait\` always
             wakes on comments landing there
  undo       per-actor: \`isocan undo\` reverts YOUR last change, never a
             collaborator's
  trash      deleted items are recoverable until \`trash empty --force\`

Conventions:
  <item> and <thread> arguments accept an id, an id prefix, or a title prefix.
  A directory is bound to its canvas by <dir>/.isocan/project.json — written
  automatically when an agent names itself here (\`identity --session\`), or
  by hand with \`isocan use <canvas>\`. Commands run anywhere under it
  resolve there (nearest marker wins, like .git); the marker is meant to be
  committed, so a clone knows which canvas it is. --canvas overrides per
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
  canvasId: string;
  sessionId: string;
  label?: string;
  /** The thread this session picked up, and when. Kept HERE as well as in the
   * daemon so that any command which reads the canvas can notice a
   * cancellation without a second round trip — the snapshot it already
   * fetched has the thread in it. */
  onThread?: string;
  onThreadAt?: string;
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

/** The active session for this canvas, or an error telling how to start one. */
async function requireSession(ctx: Ctx, canvasId: string): Promise<SessionFile> {
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  if (!session || session.canvasId !== canvasId) {
    throw new Error("no active session on this canvas — run `isocan session start` first");
  }
  return session;
}

/** Update the session; if it expired while we were thinking, quietly start a
 * fresh one (same label) and retry — working makes you visible again. */
async function touchSession(
  ctx: Ctx,
  canvasId: string,
  patch: import("@isocan/core").UpdateSessionRequest,
): Promise<void> {
  const active = await requireSession(ctx, canvasId);
  // Every update re-states who is holding the session, so `identity --name`
  // re-labels the live cursor on the next command instead of leaving the old
  // name standing until the session expires.
  const beat = { actor: ctx.actor, ...patch };
  try {
    announceCancel(await ctx.client.updateSession(canvasId, active.sessionId, beat));
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const created = await ctx.client.createSession(canvasId, ctx.actor, active.label, ctx.harness ?? undefined);
    await writeSessionFile(ctx.home, ctx.actor.id, { ...active, sessionId: created.sessionId });
    announceCancel(await ctx.client.updateSession(canvasId, created.sessionId, beat));
  }
}

/**
 * The thread you are working on has been called off — said loudly, on the
 * output of whatever command you just ran.
 *
 * This is the only way a cancellation reaches an agent MID-TURN. It is not
 * watching the canvas while it works; it is running tools, and every tool
 * beats on presence, so presence is where the news can find it. Said once per
 * cancellation, because a warning repeated on every command is a warning
 * nobody reads.
 */
let announcedCancel: string | null = null;
function announceCancel(res: { cancelled?: { threadId: string; by: string; at: string } }): void {
  const cancel = res.cancelled;
  if (!cancel || announcedCancel === `${cancel.threadId}@${cancel.at}`) return;
  announcedCancel = `${cancel.threadId}@${cancel.at}`;
  console.error(
    `\n⚠ ${cancel.by} CANCELLED this (${cancel.threadId}). Stop now: say where you got to, ` +
      `leave nothing half-made on the canvas, and do not finish the last bit.\n` +
      `  isocan command show cancel\n`,
  );
}

/**
 * Auto-narration: presence follows the work, whether or not the agent
 * remembers to say anything. Commands call this with a status derived from
 * what they are doing ("looking at …", "editing …"); the daemon treats it as
 * INFERRED, so it never displaces a status the agent set with `say`/`--say`,
 * and any applied op sweeps it away. Best-effort on purpose: no session on
 * this canvas means no narration, and no failure here may break a command.
 */
async function narrate(
  ctx: Ctx,
  canvasId: string,
  patch: import("@isocan/core").UpdateSessionRequest,
): Promise<void> {
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  if (!session || session.canvasId !== canvasId) return;
  await touchSession(ctx, canvasId, { ...patch, statusSource: "inferred" }).catch(() => {});
}

/** World center of an item — where narration points the cursor. */
function itemCenter(item: Item): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

async function sendOp(ctx: Ctx, canvasId: string | null, op: Operation, group?: string) {
  // Ops bound to an active session move its cursor to the op's locus
  // (presence piggyback) — the daemon matches clientId to the session.
  const session = await readSessionFile(ctx.home, ctx.actor.id);
  const clientId =
    session && canvasId !== null && session.canvasId === canvasId
      ? session.sessionId
      : undefined;
  return ctx.client.sendOp(canvasId, ctx.actor, op, clientId, undefined, group);
}

/** Resolve an item by exact id, id prefix, or title prefix. */
function resolveItem(snapshot: CanvasSnapshotResponse, ref: string): Item {
  if (ref.trim() === "") throw new Error("which item? pass an item id or title");
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
  // Every string starts with "", so a blank ref used to match the FIRST
  // thread — which is how an agent with an unset variable posts into a
  // conversation nobody pointed it at.
  if (ref.trim() === "") throw new Error("which thread? pass a thread id");
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

async function canvasAndSnapshot(
  ctx: Ctx,
  opts?: ResolveOptions,
): Promise<{ canvas: Canvas; snapshot: CanvasSnapshotResponse }> {
  const canvas = await resolveCanvas(ctx, opts);
  const snapshot = await ctx.client.snapshot(canvas.id);
  // A cancellation has to reach an agent MID-TURN, and an agent mid-turn is
  // not watching the canvas — it is running commands. Nearly all of them come
  // through here with the whole canvas in hand, so the check costs nothing:
  // no extra request, and it works for `ls` and `get` as well as for the
  // commands that happen to touch presence.
  await noticeCancel(ctx, canvas.id, snapshot);
  return { canvas, snapshot };
}

/** Note locally which thread we are answering, so a later command can date a
 * cancellation without asking the daemon what it already told us. */
async function rememberThread(ctx: Ctx, canvasId: string, threadId: string | null): Promise<void> {
  const active = await readSessionFile(ctx.home, ctx.actor.id);
  if (!active || active.canvasId !== canvasId) return;
  const { onThread: _was, onThreadAt: _when, ...rest } = active;
  await writeSessionFile(ctx.home, ctx.actor.id, {
    ...rest,
    ...(threadId ? { onThread: threadId, onThreadAt: new Date().toISOString() } : {}),
  });
}

/** Say it once, loudly, on the output of whatever they just ran. */
async function noticeCancel(
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
): Promise<void> {
  const active = await readSessionFile(ctx.home, ctx.actor.id);
  if (!active?.onThread || active.canvasId !== canvasId) return;
  const thread = snapshot.canvas.threads[active.onThread];
  if (!thread) return;
  const cancel = cancelledSince(thread, active.onThreadAt ?? null);
  if (!cancel || cancel.author.id === ctx.actor.id) return;
  announceCancel({ cancelled: { threadId: thread.id, by: cancel.author.name, at: cancel.createdAt } });
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
): Promise<{ name: string; id: string; canvas: string } | null> {
  try {
    const globals = cmd.optsWithGlobals() as {
      port?: string;
      canvas?: string;
      project?: string;
    };
    const home = paths.isocanHome();
    const port = Number(globals.port ?? process.env.ISOCAN_PORT ?? DEFAULT_PORT);
    const client = new DaemonClient((await baseForCwd(home, port)).base, home);
    if (!(await client.health())) return null;
    // A hand-built context, for one lookup that must not start a daemon. The
    // home questions are answered from the same record `makeCtx` uses and by
    // the same helpers — a second spelling of "where does this canvas live"
    // would be a second thing to keep in step (`readHomeRecord`).
    const birthHome = (await client.healthz())?.home ?? null;
    let record: Promise<HomeRecord> | null = null;
    const homes = () => (record ??= readHomeRecord(client, birthHome));
    const ctx: Ctx = {
      client,
      actor,
      json: false,
      // This path builds a context for a named actor rather than for this
      // process's own session, so there is no harness to speak of.
      harness: null,
      home,
      binding: await findBinding(process.cwd(), home),
      birthHome,
      homes,
      async homeOf(canvasId: string) {
        return homeAddressOf(await homes(), canvasId);
      },
      ...(canvasRefOf(globals) !== undefined ? { canvasRef: canvasRefOf(globals)! } : {}),
    };
    const canvas = await resolveCanvas(ctx);
    const wanted = actor.name.toLowerCase();
    const clash = (await new CanvasHandle(ctx, canvas).who()).find(
      (known) => known.id !== actor.id && known.name.toLowerCase() === wanted,
    );
    return clash ? { name: clash.name, id: clash.id, canvas: canvas.title } : null;
  } catch {
    return null; // no daemon, no canvas, nothing to collide with
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
    const client = new DaemonClient((await baseForCwd(home, port)).base, home);
    if (!(await client.health())) return;
    await client.updateSession(session.canvasId, session.sessionId, { actor });
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

/**
 * One emoji, or "none" to go back to the initial.
 *
 * `isFaceMark` is core's rule and is the same gate the app's picker passes
 * through: exactly one grapheme, and a pictograph rather than a letter. A
 * mark is a SHARED fact — it is drawn on every face on every canvas — so a
 * terminal that accepted "hello" would put a word where a glyph goes on
 * somebody else's screen.
 */
function parseFaceMark(input: string): string | null {
  const wanted = input.trim();
  if (wanted === "" || wanted.toLowerCase() === "none" || wanted.toLowerCase() === "default") {
    return null;
  }
  if (!isFaceMark(wanted)) {
    throw new Error(
      `not an emoji: ${input} — one emoji (⚓, 🌈), or "none" to go back to your initial`,
    );
  }
  return wanted;
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
    "--join <actorId>",
    "fold that actor into the one this session is — its comments, mentions and undo become yours; cannot be undone",
  )
  .option(
    "--color <color>",
    'the color you wear on every canvas — a palette name (e.g. "teal") or a hex, "none" to go back to the one your id implies',
  )
  .option(
    "--mark <emoji>",
    'one emoji worn instead of your initial, everywhere your face is drawn — "none" to go back to the letter',
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
          join?: string;
          color?: string;
          mark?: string;
        },
        cmd: Command,
      ) => {
        const home = paths.isocanHome();
        const client = new DaemonClient((await baseForCwd(home, daemonPort(cmd))).base, home);
        await retireStrandedIdentities(process.cwd(), home);
        /**
         * **Two actors become one person** (multi-identity phase 5). The same
         * `actor.join` the web app's identity menu sends: home-scoped, applied
         * to the registry, refused unless this machine's badge speaks for both
         * actors. Nothing in the log is rewritten; every reader resolves the
         * old id to this one from now on.
         */
        if (opts.join !== undefined) {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error(await noIdentityHere(client, home));
          const from = opts.join.trim();
          await client.sendOp(null, resolved.actor, {
            type: "actor.join",
            from,
            into: resolved.actor.id,
          });
          console.log(
            `${from} is now ${resolved.actor.name} (${resolved.actor.id}) — everything it wrote, ` +
              "every mention of it, and its undo are yours; the log keeps the old id on each entry",
          );
          return;
        }
        // Choosing your color is a mutation on the actor registry, the same
        // one the web app's identity menu sends — so both clients change the
        // color everyone sees, not a local preference each keeps to itself.
        if (opts.color !== undefined) {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error(await noIdentityHere(client, home));
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
        /**
         * **The face mark, on the surface that has no faces.**
         *
         * A terminal draws nobody's avatar, so the obvious reading is that
         * this belongs to the app alone. It does not: the mark is a fact
         * about the ACTOR, stored in the same registry as the name and the
         * colour, and it shows on every canvas somebody else is looking at.
         * An agent that can name and colour itself and cannot mark itself is
         * the shape this project calls a habit — a fact one client can set
         * and the other cannot.
         *
         * `none` clears it, the same word `--color` takes, so the two read
         * the same at the prompt.
         */
        if (opts.mark !== undefined) {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error(await noIdentityHere(client, home));
          const mark = parseFaceMark(opts.mark);
          await client.sendOp(null, resolved.actor, {
            type: "actor.setMark",
            actorId: resolved.actor.id,
            mark,
          });
          console.log(
            mark === null
              ? `${resolved.actor.name} wears their initial again`
              : `${resolved.actor.name} now wears ${mark}`,
          );
          if (!opts.name && !opts.session && !opts.as && opts.color === undefined) return;
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
              ...(bound ? { canvasId: bound.canvasId } : {}),
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
              // A canvas born through the handshake is born at the BIRTH
              // DEFAULT when this machine has one, and the marker it writes
              // says so. Nothing else on the machine is consulted: where the
              // canvas in the next directory lives has nothing to do with
              // where this new one goes.
              const landed = await ensureDirBinding(
                client,
                home,
                actor,
                (await client.healthz().catch(() => null))?.home ?? null,
              );
              if (landed) {
                console.log(
                  `this directory's canvas: "${landed.canvas.title}" (${landed.canvas.id})` +
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
          // The file is one half; the claim on the machine's badge is the
          // other, and a RENAME has to reach it or the registry goes on
          // answering with the old name — which would put the old name back
          // on every comment the new one writes, the exact failure the
          // registry exists to prevent.
          //
          // Best-effort, and deliberately so: the name IS saved, and a daemon
          // that is not running is not a reason to fail a write to a local
          // file. Whatever this machine does next claims it.
          if (await client.health()) {
            await reclaimIdentity(client, { actor, key: HOME_CLAIM_KEY }).catch((err: Error) => {
              console.error(`warning: this home still knows you as somebody else — ${err.message}`);
            });
          }
          await relabelLiveSession(cmd, actor);
          const taken = await nameCollision(cmd, actor);
          if (taken) {
            console.error(
              `warning: "${taken.name}" is already used on "${taken.canvas}" by ${taken.id} — ` +
                "@-mentions can't tell you apart; pick another name",
            );
          }
        } else {
          const resolved = await resolveIdentity(client, home);
          if (!resolved) throw new Error(await noIdentityHere(client, home));
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
      const client = new DaemonClient((await baseForCwd(home, daemonPort(cmd))).base, home);
      await retireStrandedIdentities(process.cwd(), home);
      const resolved = await resolveIdentity(client, home);
      if (!resolved) throw new Error(await noIdentityHere(client, home));
      // `--json` is promised by the global help for ANY command, and this was
      // the only one that ignored it — found because a script asked for the
      // machine's name, got the prose form, and printed an empty string where
      // a person's name belonged. A flag that is silently a no-op is worse
      // than one that is not offered.
      if ((cmd.optsWithGlobals() as { json?: boolean }).json) {
        return printJson({
          ...resolved.actor,
          source: resolved.source,
          ...(resolved.harness !== undefined ? { harness: resolved.harness } : {}),
          badge: (await client.badgeId()) ?? null,
          home: client.base,
        });
      }
      const suffix = resolved.source === "session" ? " — this agent session" : "";
      console.log(`${resolved.actor.name} (${resolved.actor.id})${suffix}`);
      // The badge, never its secret. Nothing is DONE to a badge in this phase
      // — getting one is automatic and invisible, which is the point of it —
      // but when a 401 shows up, "am I recognized here, and as which holder?"
      // is the one question a person or an agent genuinely needs answered.
      const badgeId = await client.badgeId();
      if (badgeId) console.log(`badge ${badgeId} at ${client.base}`);
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
      // A direct machine has said it runs no daemon. Starting one here would
      // give it a second replica queueing toward a home the CLI already talks
      // to, and every later command would reach whichever it happened to find.
      const declared = await resolveDeclared(home);
      if (declared?.mode === "direct") {
        throw refuseDaemonVerb("serve", declared.at ?? "its home");
      }
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
      /**
       * **On a direct machine, `status` is about the home** — because that is
       * the only process this machine's commands ever speak to.
       *
       * The alternative was to leave it probing 127.0.0.1 and print "daemon:
       * not running", which is true and useless: it is the answer a broken
       * machine gives, and a direct machine is working exactly as configured.
       * `status` is the first place anybody looks when something is wrong, so
       * it has to be able to say "nothing is wrong, and here is why there is
       * no daemon".
       */
      const declared = await resolveDeclared(paths.isocanHome());
      const direct = declared?.mode === "direct" ? declared.at : null;
      // The one raw health fetch left in the CLI — `status` wants the body
      // shape, not `healthz()`'s null-or-Health. The path still comes from the
      // address (see `healthPath`), so this cannot drift from every other
      // probe the way a literal would.
      const daemonBase = direct ?? `http://127.0.0.1:${port}`;
      const res = await fetch(`${daemonBase}${healthPath(daemonBase)}`, {
        // A hosted home over the internet is not a loopback port; half a
        // second is a fine deadline for one and a coin-flip for the other.
        signal: AbortSignal.timeout(direct ? 5_000 : 500),
      }).catch(() => null);
      if (!res?.ok) {
        console.log(
          direct
            ? `mode: direct — no daemon here; commands speak to ${direct}\n` +
              `home: NOT ANSWERING — every command against this canvas will fail until it does`
            : `daemon: not running (port ${port})`,
        );
        return;
      }
      const health = (await res.json()) as {
        pid: number;
        startedAt: string;
        version: string;
        root?: string;
        codeAt?: string;
        home?: string;
        /** Auto-upgrade phase 2. Absent on a homeless or offline daemon, and
         * on any daemon older than the field — absent is never "current". */
        upgrade?: UpgradeVerdict;
      };
      /**
       * **Which canvases live where** — the second read, and the one that
       * makes the role line true.
       *
       * The health body's `home` is the BIRTH DEFAULT now and nothing else, so
       * a status built from it alone would describe a machine holding six
       * canvases at two homes as "replica of one of them". `GET /api/homes` is
       * the route that can answer, and this is one of the four callers it was
       * built for. Best-effort: a daemon older than the route still gets the
       * old sentence out of its own one field, which for that daemon is the
       * whole truth.
       */
      const record = await readHomeRecord(
        new DaemonClient(daemonBase, paths.isocanHome()),
        health.home ?? null,
      ).catch(() => null);
      const summary: HomeSummary = { birth: record?.birth ?? health.home ?? null, rows: record?.rows ?? {} };
      if (globals.json) {
        // The health body verbatim — `stalenessOf` and older readers parse
        // this — plus the two things it cannot say for itself.
        return printJson({
          ...health,
          role: roleLine(summary, daemonBase),
          ...(record && !record.legacy ? { canvases: record.rows, links: record.links } : {}),
        });
      }
      const { stale, why } = stalenessOf(health);
      printKeyValues({
        ...(direct
          ? { mode: `direct — no daemon here; commands speak to ${direct}`, home: direct }
          : { daemon: `running on http://127.0.0.1:${port}` }),
        // What this daemon is. A daemon that stopped serving pages for a canvas
        // without saying so reads as a broken daemon, and `status` is the first
        // place anybody looks.
        role: roleLine(summary, daemonBase),
        pid: String(health.pid),
        since: health.startedAt,
        // The sha, not just `0.1.0` — every build says `0.1.0`, so the field
        // named after the question was the one with no answer in it.
        version: describeBuild(health),
        // Which copy is serving matters as soon as there is more than one:
        // an npx cache, a global install and a checkout all look identical
        // from the outside.
        running: health.root ?? "(a build too old to say)",
        // Whether item content serves from its own origin (content-origin
        // plan, stage 2). Best-effort: a daemon older than the route just
        // doesn't get the line.
        ...(await new DaemonClient(daemonBase, paths.isocanHome())
          .serving()
          .then((s) => ({
            "content origin": s.contentBase ?? "none — item content serves from the app origin",
          }))
          .catch(() => ({}))),
        // Staleness is "the daemon on this port is older than this CLI", and
        // on a direct machine the process answering is somebody else's home.
        // Comparing a laptop's CLI to a server's deploy and then offering
        // `isocan restart` would name a command that refuses on this machine.
        ...(stale && !direct ? { stale: `${why} — \`isocan restart\`` } : {}),
        /**
         * **What the home runs, when the home was asked** (auto-upgrade phase
         * 2). Present only when there is a verdict, so a machine with no home,
         * no network, or a home too old to name its own commit gets no line
         * rather than a reassuring one. `--json` carries the whole verdict —
         * both shas, both dates, the home — because that is the form an agent
         * acts on; this is the person's one line.
         */
        ...(health.upgrade
          ? {
              upgrade: health.upgrade.available
                ? `${health.upgrade.why} — \`isocan upgrade\``
                : `current with ${health.upgrade.home} (${health.upgrade.homeCommit})`,
            }
          : {}),
        /**
         * **What this machine will DO about an upgrade** (auto-upgrade phase
         * 4), which is a different question from whether one is available and
         * is not answerable from anywhere else. Agents set these controls on a
         * person's behalf, so a mode nobody can read back is a mode nobody can
         * check. Always present, including `off` — the whole value of the line
         * is that a machine which has stopped upgrading says so.
         */
        upgrades: await upgradePolicy(
          paths.isocanHome(),
          (await whichInstall(path.resolve(myRoot()), paths.isocanHome())).kind,
        ).then((policy) => `${policy.mode} — ${policy.why}`),
        /**
         * **A build this machine tried and refused** (journey Scene 2). The
         * refusal was reported once, at the moment it happened, into whatever
         * transcript was open — which on an unattended machine is nobody's.
         * Without a line here, a machine that has quietly stopped upgrading
         * looks exactly like one that has nothing to upgrade to.
         */
        ...(await lastRefusal(paths.isocanHome()).then((refusal) =>
          refusal
            ? { "upgrade refused": `${refusal.sha} — ${refusal.why}` }
            : {},
        )),
      });
    }),
  );

/**
 * **What this daemon is, in ONE phrasing** — shared by `isocan status` and
 * `isocan home`, because two commands answering the same question in two
 * vocabularies is how a person ends up believing they are different questions.
 *
 * It takes a summary rather than an address now (phase 10.3), and that is the
 * whole change: a daemon is no longer one of two things. It is the home of
 * some canvases and a replica for others, and the mixed sentence has nowhere
 * else to be said.
 *
 * **The two degenerate cases render byte-compatibly with what they always
 * did**, and deliberately so — a pure home and a pure replica are the two rigs
 * everybody actually has, phase 10.5's Dion walk reads the first out loud, and
 * a phase that changed the words for both would be a phase that made everyone
 * re-learn a sentence to be told nothing new.
 */
interface HomeSummary {
  /** Where a canvas born here goes; null for "it stays here". */
  birth: string | null;
  /** Every canvas this daemon holds → its home, null for "here". */
  rows: Record<string, string | null>;
}

function roleLine(summary: HomeSummary, base: string): string {
  const homeLine = `home — this daemon holds the canvases and serves the app at ${base}`;
  const replicaLine = (url: string) => `replica of ${url} — ops to CLIs, pages at the home`;
  const values = Object.values(summary.rows);
  const local = values.filter((home) => home === null).length;
  const remote = new Map<string, number>();
  for (const home of values) if (home !== null) remote.set(home, (remote.get(home) ?? 0) + 1);

  // A machine with nothing on it yet is described by where it is HEADING —
  // which is what `isocan home <url>` on a fresh machine, and `isocan setup`
  // against a home, both produce, and what both have always printed.
  if (local === 0 && remote.size === 0) return summary.birth ? replicaLine(summary.birth) : homeLine;
  // A pure home: everything here is its own, and nothing is going anywhere else.
  if (remote.size === 0 && summary.birth === null) return homeLine;
  // A pure replica: nothing of its own, one home, and that home is also where
  // the next canvas goes. The birth check matters — a machine that holds one
  // dev canvas but births locally still serves pages, so "pages at the home"
  // would be a lie about it.
  if (local === 0 && remote.size === 1 && summary.birth !== null && remote.has(summary.birth)) {
    return replicaLine(summary.birth);
  }
  // The mixed rig, which had no sentence at all before this phase. Ordered
  // biggest first: on a machine with six canvases at dev and one at prod, the
  // first thing to say is dev.
  const parts: string[] = [];
  if (local > 0) parts.push(`home of ${local} canvas${local === 1 ? "" : "es"}`);
  if (remote.size > 0) {
    const listed = [...remote.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([url, count]) => `${url} (${count})`);
    const last = listed.pop()!;
    parts.push(`replica of ${listed.length > 0 ? `${listed.join(", ")} and ${last}` : last}`);
  }
  if (summary.birth) parts.push(`new canvases → ${summary.birth}`);
  return parts.join("; ");
}

/**
 * **Is this canvas's socket to its home carrying anything** — in one cell.
 *
 * Short by construction: the table is scanned, not read. `live` is the only
 * word anybody needs to see, so everything else is shaped to be unmissable
 * beside a column of them, and the sentence explaining it goes underneath
 * (`linkTrouble`).
 *
 * A canvas whose home is this daemon has no link to report and gets a dash —
 * not "down", which would be a daemon describing its own store as unreachable.
 */
function linkColumn(home: string | null, state: CanvasLinkState | undefined): string {
  if (home === null) return "—";
  if (!state) return "NOT DIALLED";
  if (state.connected) return state.relayedAt ? `live (${state.facesRelayed} up)` : "live";
  return state.opens === 0 ? "NEVER CONNECTED" : "reconnecting";
}

/**
 * The sentence under the cell, or null when there is nothing wrong.
 *
 * It says what the silence used to hide: presence for this canvas is not
 * moving, which on the reading end looks exactly like a canvas nobody else is
 * on. Naming that consequence is the point — "the socket is down" is a fact
 * about plumbing, and "nobody can see you there" is the thing somebody is
 * actually trying to find out.
 */
function linkTrouble(home: string | null, state: CanvasLinkState | undefined): string | null {
  if (home === null || state?.connected) return null;
  const consequence =
    "nobody at the home can see anyone here on it, and ops written there are not arriving";
  if (!state) {
    return (
      `this daemon holds no link for it at ${home}; ${consequence}. ` +
      "`isocan restart` if it does not appear within a few seconds."
    );
  }
  const tries = `${state.failures} attempt${state.failures === 1 ? "" : "s"}`;
  const why = state.lastFailure ? `, ${state.lastFailure}` : "";
  return state.opens === 0
    ? `its socket to ${home} has never connected (${tries}${why}); ${consequence}.`
    : `its socket to ${home} is down (${tries}${why}), last carried at ` +
      `${state.connectedAt}; ${consequence}.`;
}

/**
 * **Why this roster may be shorter than the canvas** — or null when there is
 * no reason to doubt it.
 *
 * `isocan who` merges two things that look identical once printed: the faces
 * of this daemon's own clients, and the faces mirrored in from the home. If
 * the socket carrying the second set is not up, the command prints a short,
 * confident table of everybody local and says nothing about the rest of the
 * canvas — which reads as *nobody else is here*, the single most misleading
 * sentence this system can produce. It sent one agent looking for a bug in
 * its own presence for an evening.
 *
 * So: when a canvas lives at a home and its link is not carrying, say so, and
 * say it as a limit on the answer rather than as a fact about plumbing.
 */
async function rosterCaveat(ctx: Ctx, canvasId: string): Promise<string | null> {
  const record = await ctx.homes().catch(() => null);
  if (!record || record.legacy) return null;
  const home = homeAddressOf(record, canvasId);
  if (home === null) return null;
  const state = record.links
    .flatMap((link) => link.canvases ?? [])
    .find((canvas) => canvas.canvasId === canvasId);
  if (state?.connected) return null;
  const why = linkTrouble(home, state);
  return why === null ? null : `this is only who this machine can see — ${why}`;
}

/**
 * Stop whoever holds the port, bring this build up in its place.
 *
 * The one stop-and-start dance in the CLI. `isocan restart` was it; phase
 * 7.5's `isocan home` needs exactly the same sequence (a daemon reads its
 * home once, at boot, so writing `config.json` only takes effect on the next
 * one), and a second copy of it would be a second place for the `.stale-warned`
 * reset and the come-up wait to drift.
 *
 * Note what it does NOT do: talk to the daemon first. Nothing here holds a
 * socket, a badge or a watch on the process it is about to kill — which is
 * why `home` is plumbing like `restart` and `status` are, and does not build
 * a `Ctx`. A command that had opened a session on the old daemon would be
 * killing its own correspondent mid-sentence.
 */
async function restartDaemon(
  home: string,
  port: number,
): Promise<{ stopped: number[]; health: Health | null; client: DaemonClient }> {
  const { stopDaemons } = await import("@isocan/server");
  const stopped = await stopDaemons(port, home);
  const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
  await client.ensureDaemon();
  const health = await client.healthz(2000);
  await fs.rm(path.join(home, ".stale-warned"), { force: true });
  return { stopped, health, client };
}

program
  .command("restart")
  .description("Stop the daemon and start this build in its place — what an upgrade needs")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const home = paths.isocanHome();
      const port = daemonPort(cmd);
      // Before the upgrade, not after it: on a direct machine there is no
      // daemon to bring back on current code, so applying a pending upgrade
      // here would be work done toward a process that is never going to start.
      const declared = await resolveDeclared(home);
      if (declared?.mode === "direct") {
        throw refuseDaemonVerb("restart", declared.at ?? "its home");
      }
      /**
       * **The second idle point** (auto-upgrade phase 4). `restart` already
       * means "come back on current code", so applying a pending upgrade
       * before the restart is the command doing what it says rather than a
       * new behaviour bolted onto it. It runs BEFORE the stop, while the old
       * daemon is still answering, because the verdict rides that daemon's
       * health body — asking a daemon that has already been killed which
       * build the home runs would produce no verdict and no upgrade, forever.
       */
      const mineNow = shaOfRoot(home, myRoot());
      const applied = await autoUpgrade({
        home,
        install: await whichInstall(path.resolve(myRoot()), home),
        health: await new DaemonClient(`http://127.0.0.1:${port}`, home).healthz(),
        spec: INSTALL_SPEC,
        ...(mineNow ? { protect: [mineNow] } : {}),
      });
      if (applied) console.error(applied);
      const { stopped, health, client } = await restartDaemon(home, port);
      const globals = cmd.optsWithGlobals() as { json?: boolean };
      if (globals.json) return printJson({ stopped, ...(applied ? { upgraded: applied } : {}), ...(health ?? {}) });
      printKeyValues({
        stopped: stopped.length > 0 ? stopped.join(", ") : "(nothing was running)",
        daemon: `running on ${client.base}`,
        pid: String(health?.pid ?? "?"),
        running: health?.root ?? "(unknown build)",
      });
    }),
  );

/**
 * **Where a canvas born here is born, and where each canvas already here
 * lives** — phase 7.5's verb, re-scoped by phase 10.3.
 *
 * `config.json` has had a `home` key since phase 6 and `resolveHomeUrl` has
 * always read it; nothing could ever WRITE it, so the only ways to reach it
 * were an environment variable and a text editor. That is a missing verb, not
 * a missing feature, and it is not only a developer's problem: commitment 2
 * says `isocan serve` on a rented VM is a complete home, so anybody pointing
 * their daemon at their own innkeeper's home walks straight into it.
 *
 * **What it sets narrowed, and the narrowing is the point.** It used to demote
 * a whole daemon: every canvas on the machine started being written somewhere
 * else. Now the home is a property of the CANVAS — the marker has said so
 * since Scene 0 — and this key is the **birth default**, consulted when a
 * canvas is minted and never again. So `isocan home <url>` moves nothing that
 * already exists, `--clear` un-moves nothing either, and phase 14's flip of a
 * shipped default address cannot re-point anybody's work. The key was
 * re-purposed rather than renamed on purpose: an upgraded daemon reading an
 * old `config.json` finds `home` set, births new canvases there, and — with
 * the boot migration freezing everything already held at that address — behaves
 * on upgrade day exactly as it did the day before.
 *
 * **This is not phase 6 being undone, and it is not phase 7.5 being undone
 * either.** Phase 6 refused a `--home` FLAG on `isocan serve`, on the same
 * grounds as `ISOCAN_BIND` and `ISOCAN_STORE`: where canvases go is innkeeper
 * configuration, not a per-invocation choice an agent reaches for. Phase 10.3
 * is exactly where somebody would reintroduce it — "just let this one command
 * name a home" — and the answer is still no. What travels beside a birth is
 * not a flag; it is the marker's assertion, committed configuration read out
 * of `.isocan/project.json`.
 *
 * **No compiled-in default, still.** `isocan home` with no address SHOWS;
 * there is no address baked in for it to fall back to, because a CLI
 * shipping with `isocan.io` as its default would turn `isocan serve` in this
 * checkout into a replica of production. The flip belongs with phase 14's
 * promotion gesture, where it is one line.
 *
 * **It keeps its restart** (phase 10.3's ruling 5). Correctness no longer
 * demands one — a live `PUT /api/homes/birth` is filed as a follow-up — but
 * `pointDaemonAtHome`'s read-back verification is this repo's own standing
 * lesson embodied: a step that cannot read back the state it wanted has
 * verified nothing.
 */
program
  .command("home [url]")
  .description("Where new canvases are born, and where each canvas here lives")
  .option("--clear", "birth canvases here from now on — nothing already here moves")
  .option("--force", "set the address even though nothing answered there")
  .action(
    run(async (
      url: string | undefined,
      opts: { clear?: boolean; force?: boolean },
      cmd: Command,
    ) => {
      const globals = cmd.optsWithGlobals() as { json?: boolean };
      const isocanHome = paths.isocanHome();
      const port = daemonPort(cmd);
      const base = `http://127.0.0.1:${port}`;
      const client = new DaemonClient(base, isocanHome);
      if (url !== undefined && opts.clear) {
        throw new Error(
          "`isocan home <url>` sets a home and `isocan home --clear` removes one — not both",
        );
      }
      /**
       * **A direct machine has no birth default to set**, because it has no
       * daemon to hold one: a canvas made here is posted to the home and born
       * at the home, which is the only address in play. Writing `config.json`'s
       * `home` key would leave a setting that does nothing, waiting to confuse
       * whoever reads the file — and the restart this verb performs would
       * refuse anyway.
       */
      const declared = await resolveDeclared(isocanHome);
      if (declared?.mode === "direct") {
        const at = declared.at ?? "its home";
        throw new Error(
          `this machine is direct, so there is no birth default to set: a canvas made here ` +
            `is born at ${at}, which is the only home in play. \`isocan direct\` shows that ` +
            "address and `isocan direct --clear` gives this machine a daemon of its own, " +
            "which is what would make this verb mean something again.",
        );
      }

      // What the daemon ACTUALLY is, off the health route — the same source
      // `Ctx.birthHome` reads and for the same reason: a config file edited
      // five minutes ago and a daemon running since Tuesday must not be allowed
      // to disagree about where a canvas born now would go. The config file is
      // read too, but only to NOTICE that disagreement.
      const health = await client.healthz(500);
      const config = await readConfig(isocanHome);
      const written = typeof config.home === "string" ? config.home.trim() : "";
      const configured = written || null;
      const live = health?.home ?? null;
      // The per-canvas half, which the health route cannot answer — see
      // `HOMES_ROUTE`. Null when no daemon is running, which is a state this
      // verb deliberately supports: it is what somebody runs to find out why
      // nothing works.
      const record = health ? await readHomeRecord(client, live).catch(() => null) : null;
      const summary: HomeSummary = { birth: live, rows: record?.rows ?? {} };

      // `resolveHomeUrl` reads the environment FIRST, and `ensureDaemon` hands
      // the daemon this process's environment — so with `ISOCAN_HOME_URL` set,
      // writing the file would change nothing and the restart would bring the
      // daemon back on the variable's address. Silently. Refusing is the only
      // honest answer; the variable is the thing to remove.
      const override = process.env.ISOCAN_HOME_URL?.trim();

      if (url === undefined && !opts.clear) {
        const target = live ?? configured;
        const reachable = target ? await homeAnswers(target) : null;
        /**
         * **Per canvas, because that is where the answer lives now.**
         *
         * The reading half of this verb used to have one thing to say and it
         * was about the machine. A person on a machine holding work at two
         * homes has a different question — *which of my canvases is at which,
         * and is that home up* — and before this there was no way to ask it
         * short of reading `.isocan/project.json` files by hand.
         *
         * Titles come from the daemon's own list, so a canvas that is recorded
         * but has not replicated yet still gets a row (its id, no title): the
         * record is the thing being reported, and hiding a row because the
         * canvas has not arrived would hide exactly the case somebody is
         * debugging.
         */
        const titles = new Map<string, string>();
        for (const canvas of health ? await client.listCanvases().catch(() => []) : []) {
          titles.set(canvas.id, canvas.title);
        }
        const answering = new Map(record?.links.map((link) => [link.url, link.reachable]) ?? []);
        /**
         * **Whether each canvas's socket is actually carrying anything.**
         *
         * The column this report was missing, and the reason somebody spent an
         * evening on it: `answering` above is the home's HTTP half, and it says
         * yes for a home that is perfectly up while a canvas's presence goes
         * nowhere. Writes forward over HTTP; faces ride the socket. A row that
         * showed only the address could not tell those apart.
         */
        const linkStates = new Map(
          (record?.links ?? []).flatMap((link) =>
            (link.canvases ?? []).map((state) => [state.canvasId, state] as const),
          ),
        );
        const canvases = Object.entries(record?.rows ?? {})
          .map(([id, at]) => ({
            id,
            title: titles.get(id) ?? "(not here yet)",
            home: at,
            state: linkStates.get(id),
          }))
          .sort((a, b) => a.title.localeCompare(b.title));
        if (globals.json) {
          return printJson({
            // `role` and `home` keep their names and their shapes; what they
            // MEAN is the birth default now, which is the one whole-daemon
            // answer that survived the phase. `canvases` is the new question.
            role: live ? "replica" : "home",
            home: live,
            birth: live,
            daemon: base,
            running: health !== null,
            ...(configured !== live ? { configured } : {}),
            ...(reachable
              ? { reachable: reachable.ok, ...(reachable.ok ? {} : { why: reachable.why }) }
              : {}),
            ...(record ? { canvases: record.rows, links: record.links } : {}),
            ...(override ? { override } : {}),
          });
        }
        printKeyValues({
          role: health ? roleLine(summary, base) : `unknown — no daemon is running on ${base}`,
          "birth default": live
            ? `${live} — a canvas born here is born there; nothing already here moved`
            : "here — a canvas born here stays here",
          ...(health
            ? {}
            : {
                configured: configured
                  ? `${configured} (config.json) — start a daemon to make it so`
                  : "nothing — canvases born here stay here",
              }),
          ...(reachable
            ? {
                answering: reachable.ok
                  ? `yes — ${target} is up`
                  : `NO (${reachable.why}) — writes to canvases there are refused while it cannot be reached`,
              }
            : {}),
          // The one disagreement worth naming: somebody wrote the file and
          // never restarted, so the running daemon is still the old thing.
          ...(health && configured !== live
            ? {
                pending: `config.json says ${configured ?? "no home"} — \`isocan restart\` to take it`,
              }
            : {}),
          ...(override ? { note: `ISOCAN_HOME_URL=${override} is set and overrides all of this` } : {}),
        });
        if (canvases.length > 0) {
          console.log("\ncanvases");
          printTable(
            canvases.map((canvas) => ({
              canvas: canvas.title,
              id: canvas.id,
              home:
                canvas.home === null
                  ? "here — this daemon is its home"
                  : `${canvas.home}${
                      answering.get(canvas.home) === false
                        ? "  (NOT answering — writes refused)"
                        : ""
                    }`,
              link: linkColumn(canvas.home, canvas.state),
            })),
          );
          // The detail under the short column. Kept out of the table because a
          // close code and a reason are a sentence, and a sentence in a cell
          // pads every other row out to its width.
          for (const canvas of canvases) {
            const why = linkTrouble(canvas.home, canvas.state);
            if (why) console.log(`\nnote: ${canvas.id} — ${why}`);
          }
        }
        return;
      }

      const target = opts.clear ? null : normalizeHomeUrl(url!);
      const { changed, stopped, reachable } = await pointDaemonAtHome({
        isocanHome,
        port,
        target,
        configured,
        live,
        force: opts.force ?? false,
      });

      // The sentence that makes the change safe to make, said in both
      // directions. What everybody wants to know when they type this is not
      // "did it write the file" but "what did that do to the work I already
      // have" — and the answer is now *nothing*, which is worth saying rather
      // than leaving somebody to find out.
      const already = Object.values(summary.rows).filter((at) => at !== null).length;
      const moved = target
        ? `canvases born here will be born at ${target} — nothing already here moved`
        : `canvases born here stay here from now on` +
          (already > 0
            ? ` — the ${already} canvas${already === 1 ? "" : "es"} already at a home still answer${already === 1 ? "s" : ""} to it`
            : "");
      const after: HomeSummary = { birth: target, rows: summary.rows };

      if (!changed) {
        if (globals.json) {
          return printJson({
            role: target ? "replica" : "home",
            home: target,
            birth: target,
            restarted: false,
            daemon: base,
          });
        }
        printKeyValues({
          role: roleLine(after, base),
          unchanged: target
            ? "canvases born here already go to that home"
            : "canvases born here already stay here",
        });
        return;
      }

      if (globals.json) {
        return printJson({
          role: target ? "replica" : "home",
          home: target,
          birth: target,
          restarted: true,
          stopped,
          daemon: base,
          ...(reachable ? { reachable: reachable.ok } : {}),
        });
      }
      printKeyValues({
        role: roleLine(after, base),
        birth: moved,
        wrote: paths.configFile(isocanHome),
        daemon:
          stopped.length > 0
            ? `restarted on ${base} (was ${stopped.join(", ")})`
            : `started on ${base}`,
        ...(reachable && !reachable.ok
          ? {
              warning:
                `${target} did not answer (${reachable.why}) — a canvas born there ` +
                "will be refused until it does",
            }
          : {}),
      });
    }),
  );

/**
 * **`isocan direct` — show, set, or undo this machine's mode.**
 *
 * The sibling of `isocan home`, and it exists for the reason every refusal in
 * `direct.ts` names it: a setting with no off switch is a trap. `setup` can
 * put a machine into direct mode from a guess, and a guess a person cannot
 * inspect and reverse is a guess that will eventually be wrong on somebody's
 * laptop with no way out of it.
 *
 * It writes `config.json` and nothing else — no restart, unlike `isocan home`,
 * because there is no daemon whose boot-time read has to be re-taken. Going
 * the other way (`--clear`) leaves the daemon to be started by the next
 * command that wants one, which is what `ensureDaemon` has always done.
 */
program
  .command("direct [url]")
  .description("Work without a local daemon, speaking to the home itself — show, set, or undo")
  .option("--clear", "run a daemon here again, with a replica of its own")
  .action(
    run(async (url: string | undefined, opts: { clear?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as { json?: boolean };
      const isocanHome = paths.isocanHome();
      if (url !== undefined && opts.clear) {
        throw new Error(
          "`isocan direct <url>` goes direct and `isocan direct --clear` undoes it — not both",
        );
      }
      const override = process.env[DIRECT_VAR]?.trim();
      // The same refusal `isocan home` gives for `ISOCAN_HOME_URL`, for the
      // same reason: the variable wins over the file, so writing the file
      // would change nothing and report success.
      if (override && (url !== undefined || opts.clear)) {
        throw new Error(
          `${DIRECT_VAR}=${override} is set in this shell and wins over the config file — ` +
            `unset it first (\`unset ${DIRECT_VAR}\`), then run this again`,
        );
      }
      const config = await readConfig(isocanHome);
      const written = typeof config.direct === "string" ? config.direct.trim() : "";

      if (url === undefined && !opts.clear) {
        const declared = await resolveDeclared(isocanHome);
        const at = declared?.mode === "direct" ? declared.at : null;
        if (globals.json) {
          return printJson({
            mode: declared?.mode ?? DEFAULT_MODE,
            direct: at,
            ...(override ? { override } : {}),
            configured: written || null,
          });
        }
        return printKeyValues({
          mode:
            declared?.mode === "direct"
              ? `direct — no daemon here; commands speak to ${at ?? "the address in this directory's marker"}`
              : "daemon — this machine runs one, with a replica of its own",
          ...(override ? { [DIRECT_VAR]: `${override} (set in this shell; wins over the file)` } : {}),
          ...(written ? { configured: `${written} (${paths.configFile(isocanHome)})` } : {}),
        });
      }

      if (opts.clear) {
        if (!written) {
          return printKeyValues({ mode: "daemon — already; nothing was configured" });
        }
        delete config.direct;
        await writeConfig(isocanHome, config);
        return printKeyValues({
          mode: "daemon — this machine will run one again",
          was: written,
          wrote: paths.configFile(isocanHome),
          next: "the next command that needs a daemon starts it (`isocan status` to look)",
        });
      }

      // Reachability is checked and REFUSED here, not warned about, and that
      // is the difference from `isocan home --force`. A birth default that
      // does not answer costs you the next canvas you make; a direct machine
      // pointed at an address that does not answer cannot run a single
      // command, because there is no replica underneath to fall back to.
      const target = normalizeHomeUrl(url!);
      const answers = await homeAnswers(target);
      if (!answers.ok) {
        throw new Error(
          `nothing answered at ${target} (${answers.why}) — a direct machine has no local ` +
            "replica to fall back on, so every command here would fail. Check the address, " +
            "or leave this machine on its daemon.",
        );
      }
      config.direct = target;
      await writeConfig(isocanHome, config);
      printKeyValues({
        mode: `direct — no daemon here; commands speak to ${target}`,
        wrote: paths.configFile(isocanHome),
        note: "`isocan direct --clear` gives this machine a daemon and a replica again",
      });
    }),
  );

/**
 * **Point this daemon at a home, for real** — the machinery behind
 * `isocan home <url>`, extracted in phase 8 because `isocan setup <address>`
 * has to do the identical thing.
 *
 * Extracted rather than reimplemented, and rather than shelling out to
 * `isocan home`. Scene 5's one command is Priya's three steps collapsed into
 * a line, and the first of those steps IS "answer to that home" — so setup
 * needs this whole sequence, refusals included. A second way to write
 * `config.json` would be a second place for the `ISOCAN_HOME_URL` refusal, the
 * reachability check and the read-once-at-boot restart to drift, and the
 * symptom of that drift is a daemon that reports a home it is not serving.
 *
 * Everything here is `isocan home`'s reasoning, unchanged:
 *
 * - the environment variable WINS over the file, so writing the file while it
 *   is set changes nothing and the restart would silently come back on the
 *   variable's address. Refusing is the only honest answer.
 * - a home that does not answer is REPORTED, not quietly accepted: a canvas
 *   that lives at an unreachable home refuses every write and queues nothing.
 *   `--force` is the escape, and it is the caller's to offer. (Phase 10.3
 *   makes this warning much less urgent and no less honest — nothing breaks
 *   until a canvas is born there — so the escape stays.)
 * - a no-op does not bounce the daemon — anything parked on `isocan wait`
 *   loses its socket to a restart, and setting the birth default to what it
 *   already is should cost nobody their connection.
 * - the daemon reads this once, at boot, so the restart is what makes the
 *   write true, and the health route afterwards is what proves it did. Phase
 *   10.3's ruling 5 kept that restart deliberately: correctness no longer
 *   needs it (a live `PUT /api/homes/birth` is a filed follow-up), but a step
 *   that cannot read back the state it wanted has verified nothing.
 */
async function pointDaemonAtHome(opts: {
  isocanHome: string;
  port: number;
  /** The address to answer to; null clears it and makes this daemon a home. */
  target: string | null;
  /** What `config.json` says now, and what the running daemon actually is. */
  configured: string | null;
  live: string | null;
  force: boolean;
}): Promise<{
  changed: boolean;
  stopped: number[];
  reachable: { ok: boolean; why: string } | null;
}> {
  const { isocanHome, port, target, configured, live, force } = opts;
  const override = process.env.ISOCAN_HOME_URL?.trim();
  if (override) {
    throw new Error(
      `ISOCAN_HOME_URL=${override} is set in this shell and wins over the config file — ` +
        "unset it first (`unset ISOCAN_HOME_URL`), then run this again",
    );
  }
  const reachable = target ? await homeAnswers(target) : null;
  if (reachable && !reachable.ok && !force) {
    throw new Error(
      `nothing answered at ${target} (${reachable.why}) — a daemon whose home is ` +
        "unreachable refuses every write to a canvas that lives there, and nothing is " +
        `queued. \`isocan home ${target} --force\` sets it anyway.`,
    );
  }
  if (configured === target && live === target) return { changed: false, stopped: [], reachable };

  const config = await readConfig(isocanHome);
  if (target) config.home = target;
  else delete config.home;
  await writeConfig(isocanHome, config);

  const { stopped, health: after } = await restartDaemon(isocanHome, port);
  const became = after?.home ?? null;
  if (became !== target) {
    throw new Error(
      `wrote ${paths.configFile(isocanHome)} but the daemon came back birthing canvases ` +
        `${became ? `at ${became}` : "here"} — check that file`,
    );
  }
  return { changed: true, stopped, reachable };
}

/**
 * A home address, as somebody would type it — and the refusals that show the
 * shape rather than describing it.
 *
 * Deliberately permissive about WHERE: a home is as often
 * `http://192.168.1.9:4441` on a LAN as it is `https://isocan.io`. Strict
 * about WHAT, because the two mistakes are predictable — a bare hostname, and
 * a canvas link pasted out of a browser bar.
 *
 * **The computation moved to `@isocan/core` in phase 10.3; the REFUSALS
 * stayed here**, and the split is the point rather than a tidy-up. Under many
 * homes the daemon normalizes addresses it reads off disk — config keys,
 * marker fields, `identity.json`'s `auth` block — where a throw would be a
 * daemon that will not boot over a trailing slash, so `normalizeAddress` is
 * total. What a PERSON typed is a different question with a different right
 * answer, and it is asked in exactly one place: here, where the person is.
 */
function normalizeHomeUrl(input: string): string {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `not an address: "${raw}" — a home looks like https://isocan.io or http://127.0.0.1:4441`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`a home is reached over http or https, not ${url.protocol} — got "${raw}"`);
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    // Almost always a canvas link, copied from the address bar. Naming the
    // origin it contains is more useful than naming the rule it broke.
    throw new Error(`that is a page at ${url.origin}, not a home — try \`isocan home ${url.origin}\``);
  }
  return normalizeAddress(raw);
}

/** Does the address answer as a home? The health route, which is what the
 * daemon itself will dial — `healthPath` picks `/api/healthz` for anything
 * that is not loopback, because Google's frontend swallows the bare path. */
async function homeAnswers(url: string): Promise<{ ok: boolean; why: string }> {
  try {
    const res = await fetch(`${url}${healthPath(url)}`, { signal: AbortSignal.timeout(5000) });
    return res.ok
      ? { ok: true, why: "" }
      : { ok: false, why: `it answered ${res.status} — is that address a home?` };
  } catch (err) {
    const why = (err as Error).name === "TimeoutError" ? "no answer in 5s" : (err as Error).message;
    return { ok: false, why };
  }
}

program
  .command("upgrade")
  .description("Fetch the newest isocan and restart the daemon on it")
  .option("--no-restart", "fetch only; leave the running daemon alone")
  .option(
    "--rollback",
    "go back to the build before this one — a symlink flip, and no network at all",
  )
  .option("--pin <sha>", "hold this machine on a build already in builds/, and stop auto there")
  .option("--unpin", "let this machine follow its home again")
  .action(
    run(async (
      opts: { restart?: boolean; rollback?: boolean; pin?: string; unpin?: boolean },
      cmd: Command,
    ) => {
      const home = paths.isocanHome();
      const port = daemonPort(cmd);

      /**
       * **A pin is a recorded decision, not a one-off flip** (auto-upgrade
       * phase 4): it has to survive a home that moves, which is the only
       * situation anybody sets one in. So it writes `config.json` and then
       * flips, in that order — a pin that flipped and failed to record itself
       * would be undone by the next park.
       *
       * **It can only name a build already in `builds/`.** Reaching an
       * arbitrary commit would mean building from source, which is a separate
       * project rather than a flag; and a pin that named a sha this machine
       * cannot produce would be a machine that refuses to upgrade and cannot
       * reach the build it is holding out for.
       */
      if (opts.pin !== undefined || opts.unpin) {
        const config = await readConfig(home);
        if (opts.unpin) {
          delete config.upgradePin;
          await writeConfig(home, config);
          console.log("unpinned — this machine follows its home again");
          return;
        }
        const wanted = plausibleSha(opts.pin);
        const builds = await listBuilds(home);
        const found = wanted ? builds.find((build) => build.sha === wanted) : undefined;
        if (!found) {
          throw new Error(
            `no build ${opts.pin} in ${paths.buildsDir(home)} — ` +
              (builds.length > 0
                ? `this machine has ${builds.map((b) => b.sha).join(", ")}`
                : "this machine has none, so there is nothing to pin to") +
              ". A pin names a build you already have; reaching further would mean " +
              "building from source",
          );
        }
        config.upgradePin = found.sha;
        await writeConfig(home, config);
        const before = await currentSha(home);
        if (before !== found.sha) await flipTo(home, found.sha);
        console.log(
          `pinned to ${found.sha}${before && before !== found.sha ? ` (was ${before})` : ""} — ` +
            "auto upgrades stop here until `isocan upgrade --unpin`",
        );
        say(await adoptGlobal(home));
        if (opts.restart !== false) {
          const bin = path.join(found.root, "packages", "cli", "bin", "isocan.js");
          spawnSync(process.execPath, [bin, "--port", String(port), "restart"], {
            stdio: "inherit",
          });
        }
        return;
      }
      const install = await whichInstall(path.resolve(myRoot()), home);
      const plan = planUpgrade(
        install,
        install.kind === "checkout" ? checkoutState(install.root) : null,
        INSTALL_SPEC,
      );
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const shell = (command: string, args: string[], cwd?: string) =>
        spawnSync(command, args, { stdio: "inherit", ...(cwd ? { cwd } : {}) });

      /**
       * **The managed root: install aside, prove it, then flip one symlink**
       * (auto-upgrade phase 3). `swapBuild` returns the build now current, or
       * null when nothing moved — the same two answers the branches below give
       * by other means, so the restart at the end of this action does not have
       * to know which path got here.
       */
      if (opts.rollback || plan.action === "swap") {
        const moved = await swapBuild({
          home,
          rollback: opts.rollback === true,
          install,
          plan,
          port,
        });
        if (opts.restart === false) {
          console.log(
            moved
              ? "the daemon still runs the old build — `isocan restart` when you're ready"
              : "nothing changed, and nothing was restarted",
          );
          return;
        }
        if (!moved) {
          // Nothing was swapped, so bouncing the daemon would be theatre —
          // unless it is serving some other copy, which is the one case where
          // an upgrade that changed nothing still has work to do.
          const health = await new DaemonClient(`http://127.0.0.1:${port}`, home).healthz();
          if (!health || !stalenessOf(health).stale) {
            console.log("the daemon is already running this build");
            return;
          }
        }
        // Re-exec THE BUILD WE JUST POINTED AT — by path, never by PATH. This
        // process is running the OLD build's code, and no symlink flip moves a
        // running process; the whole point of the flip is that the next
        // command resolves differently, and this is that next command.
        const bin = moved
          ? path.join(moved.root, "packages", "cli", "bin", "isocan.js")
          : path.join(install.root, "packages", "cli", "bin", "isocan.js");
        spawnSync(process.execPath, [bin, "--port", String(port), "restart"], {
          stdio: "inherit",
        });
        return;
      }

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
      if (plan.action === "none") {
        // Nothing was fetched, so bouncing the daemon would be theatre —
        // unless it is serving some other copy, which is the one case where
        // an upgrade that changed nothing still has work to do. On a direct
        // machine there is no daemon to be serving anything, so the exception
        // has no case to cover: what got upgraded is this CLI, and it is
        // already the copy that will run next time.
        const { direct } = await baseForCwd(home, port);
        const health = direct
          ? null
          : await new DaemonClient(`http://127.0.0.1:${port}`, home).healthz();
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

/**
 * **Install aside, prove it, flip one symlink, keep three** — the managed
 * upgrade, and the whole of auto-upgrade phase 3.
 *
 * Returns the build `current` now points at, or null when nothing moved. The
 * ORDER is the design: every step before the flip happens in a directory
 * nothing resolves through, so a failure anywhere in it leaves the machine
 * running exactly what it was running, with a message about why. The flip is
 * the only irreversible-looking moment and it is one `rename`.
 *
 * **The oracle is the home, and it is a precondition rather than a request.**
 * `want` is the sha the home reports (auto-upgrade phase 2 put it on the
 * health body); `installBuild` refuses to promote a release tip that carries
 * a different one, because npm can fetch exactly one build and installing
 * whatever the tip happens to hold is how the flapping the design warns about
 * starts. A machine with no home, or an offline one, has no verdict and takes
 * the tip — which is what `npm i -g` did before any of this existed.
 */
async function swapBuild(options: {
  home: string;
  rollback: boolean;
  install: Install;
  plan: UpgradePlan;
  port: number;
}): Promise<Build | null> {
  const { home, rollback, install, plan, port } = options;
  const before = await currentSha(home);

  /**
   * **Rollback is a directory read and a symlink flip, and it stays that
   * small.** A person reaches for it exactly when the current build — the code
   * this command is itself executing — is suspect, so it must not depend on a
   * network, a home, or anything that can be slow or absent.
   */
  if (rollback) {
    const previous = (await listBuilds(home)).find((build) => build.sha !== before);
    if (!previous) {
      throw new Error(
        `there is no other build in ${paths.buildsDir(home)} to go back to` +
          (before ? ` — ${before} is the only one kept` : ""),
      );
    }
    await flipTo(home, previous.sha);
    console.log(`rolled back to ${previous.sha}${before ? ` from ${before}` : ""}`);
    say(await adoptGlobal(home));
    return previous;
  }

  const health = await new DaemonClient(`http://127.0.0.1:${port}`, home).healthz();
  const want = health?.upgrade?.homeCommit ?? null;
  if (want && before === want) {
    // Already on what the home runs. There is still adoption to do on a
    // machine whose PATH has not been moved yet, which is why this returns
    // through the same door rather than early.
    console.log(`already on ${want}, which is what ${health?.upgrade?.home} runs`);
    say(await adoptGlobal(home));
    return null;
  }

  console.error(`isocan: ${plan.message}`);
  /**
   * The mechanism is `applySwap`, shared with the unattended points (auto-
   * upgrade phase 4). This branch only narrates it — and the protected build
   * it adds is THIS process's own: cleanup deleting the tree the running
   * command is executing out of does not stop it, it breaks it halfway
   * through.
   */
  const mine = shaOfRoot(home, myRoot());
  const swapped = await applySwap({
    home,
    spec: INSTALL_SPEC,
    want,
    install,
    ...(mine ? { protect: [mine] } : {}),
  });
  if (swapped.shelved) {
    console.error(
      `isocan: ${swapped.shelved} is now reachable as a build — ` +
        "`isocan upgrade --rollback` comes back to it",
    );
  }
  if (!swapped.ok) throw new Error(swapped.why);
  console.log(swapped.why);
  say(swapped.adoption);
  if (swapped.step === "current") return null;
  if (swapped.removed.length > 0) {
    console.error(
      `isocan: removed old build${swapped.removed.length > 1 ? "s" : ""} ` +
        swapped.removed.join(", "),
    );
  }
  return (await currentBuild(home)) ?? null;
}

/** Adoption is reported on stderr whenever it did something or failed to:
 * silence would leave a person whose PATH could not be moved believing the
 * upgrade took. A PATH that already ran through `current` is not news. */
function say(adoption: Adoption | null): void {
  if (adoption && (adoption.moved || !adoption.managed)) console.error(`isocan: ${adoption.why}`);
}

program
  .command("stop")
  .description("Stop the daemon — asks the port who it is, so a stale one can't hide")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const { stopDaemons } = await import("@isocan/server");
      const declared = await resolveDeclared(paths.isocanHome());
      if (declared?.mode === "direct") {
        throw refuseDaemonVerb("stop", declared.at ?? "its home");
      }
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

/**
 * **`isocan open` — and the pass it quietly hands the browser it spawns.**
 *
 * Mechanism 2's line, and the reason a person's second machine is not a
 * stranger in their own browser: *"`isocan open` appends a pass minted by her
 * daemon's badge — Scene 5's outward flow, pointed the other way."* It matters
 * twice over. It keeps her own surfaces working when she turns the LINK GRANT
 * OFF, since a pass admits regardless of what the link says; and it carries
 * whatever actor claim this machine's badge holds — on a pass-enrolled
 * machine, herself — so picking "Priya" in the browser is a resume rather than
 * a re-mint or a refusal.
 *
 * **The pass goes to the BROWSER and never to the terminal.** The spawned tab
 * gets the fragment; the line printed on stdout is the clean, pass-less
 * address. That asymmetry is the whole point and it is not an oversight to be
 * tidied up later: the printed line is what an agent copies onto a thread and
 * what a person pastes into Slack, and a bearer credential that rides into a
 * chat log because a verb printed it is not a mistake anybody gets to make
 * twice. A fragment never reaches a server, so the spawned URL leaks into no
 * access log either — the browser's own history is where it ends, and it is
 * spent the moment the page loads.
 */
program
  .command("open [item]")
  .description(
    "Open the canvas in your browser — as you, with a one-use pass the browser keeps. " +
      "Name an item and it opens full screen",
  )
  .option(
    "--workbench",
    "open the workbench — the agent room — instead; with an item, it is on the stage",
  )
  .action(
    run(async (ref: string | undefined, opts: { workbench?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      // Full screen is a ROUTE, which is the whole reason the CLI can take
      // part in it at all: there is no op to send — what somebody is looking
      // at is not a mutation — but there IS an address, and handing over an
      // address is something a terminal is good at. `isocan open <item>` and
      // a person pressing Enter on that item land on the same page.
      const { canvas, snapshot } =
        ref === undefined
          ? { canvas: await resolveCanvas(ctx), snapshot: null }
          : await canvasAndSnapshot(ctx);
      const item = snapshot === null ? null : resolveItem(snapshot, ref!);
      // **THIS canvas's home, never the daemon's** (phase 10.3). The
      // one-origin rule is per canvas: a canvas has exactly one door, and it is
      // the door of the home that holds it. Opening `127.0.0.1` for a canvas
      // that lives at dev lands a person on the daemon's page signpost — a 404
      // that is a correct answer to the wrong question — and opening dev's
      // address for a canvas that lives on this laptop is the same mistake
      // pointing the other way, which is the one this rename exists to make
      // unwriteable. `null` means this daemon really is its home, and then its
      // own base is the right origin. (The pass is minted at that same home, by
      // the daemon forwarding: that is where the badge lives that the browser's
      // redemption will be judged against.)
      const origin = (await ctx.homeOf(canvas.id)) ?? ctx.client.base;
      // The workbench is the same kind of thing full screen is — a cover
      // route — so the flag only changes which address gets built. An agent
      // that wants a person watching the agent room hands them this.
      const url = opts.workbench
        ? workbenchUrl(origin, canvas.id, item?.id)
        : item
          ? itemUrl(origin, canvas.id, item.id)
          : canvasUrl(origin, canvas.id);
      const token = await browserPass(ctx, canvas.id);
      // The pass goes on the END of whichever address was built — canvas or
      // item — because a fragment is only a fragment if nothing follows it.
      // `urlWithPass` is the one spelling of that; `canvasUrlWithPass` is now
      // its canvas-shaped caller. The browser strips the fragment on arrival
      // (`lib/arrival.ts`), so the route it is left standing on is the one
      // that was asked for.
      spawn(
        process.platform === "darwin" ? "open" : "xdg-open",
        [token ? urlWithPass(url, token) : url],
        { stdio: "ignore", detached: true },
      ).unref();
      console.log(url);
    }),
  );

/**
 * The pass `isocan open` hands the browser, or null when there is none to be
 * had.
 *
 * **It endows the machine's PERSON, not whoever typed the command**, and that
 * is a real decision. The one-origin rule says the daemon serves ops to CLIs
 * and never pages to persons — so whoever is about to look at the page this
 * spawns is the human who owns this machine, not the agent that ran the verb.
 * An agent's `isocan open` that made the browser be *Nico* would be the
 * directory-identity bug (#56) reborn in a new slot: the last agent through
 * the door becomes the user. So the actor comes from `identity.json`, the one
 * slot that belongs to the human, and an agent-only machine (no person in that
 * file at all) mints the admission-only shape instead — which is still worth
 * having, because admission is the half that survives the link being switched
 * off.
 *
 * **Nothing here may break `open`.** Opening the canvas is the job; the pass
 * is an improvement on it. A home that cannot be reached, a claim the badge
 * cannot prove, a daemon too old to have the route — every one of them lands
 * on the plain address, which is exactly what this verb printed for its whole
 * life before phase 8.
 */
async function browserPass(ctx: Ctx, canvasId: string): Promise<string | null> {
  const person = await readIdentity(ctx.home);
  try {
    if (!person) return (await ctx.client.mintPass(canvasId)).token;
    try {
      return (await ctx.client.mintPass(canvasId, person.id)).token;
    } catch (err) {
      // `not-your-actor` means this machine's badge has never claimed its own
      // human — the home identity is a local file that nothing ever claimed
      // (see `reclaimIdentity`). `DaemonClient` retries that refusal on its
      // own, but with the key of whoever this COMMAND speaks as, which for an
      // agent is not the person we are asking about. So claim the person's
      // key explicitly and ask once more.
      if (!(err instanceof ApiError) || err.code !== "not-your-actor") throw err;
      await reclaimIdentity(ctx.client, { actor: person, key: HOME_CLAIM_KEY });
      return (await ctx.client.mintPass(canvasId, person.id)).token;
    }
  } catch {
    return null;
  }
}

/**
 * **Share** — the verb half of the Share dialog, and the first gesture in this
 * CLI that is not a canvas op.
 *
 * That is worth stating rather than discovering. Every other verb here turns
 * into an `Operation` applied by the one reducer; this one acts on the OUTSIDE
 * world — grants, addresses, who may knock — so its parity with the button
 * lives at the daemon API instead (the journey's rule 5: "pretending it is an
 * op would make the oplog lie"). Button and verb drive exactly the same three
 * routes, and neither of them spells a URL: `@isocan/core` does.
 *
 Five shapes, one endpoint:
 *
 * - `isocan share` — the address to send, whether the link is on, and who has
 *   been invited by name.
 * - `isocan share --link off` / `--link on` — revoke, or grant again.
 * - `isocan share --link view` — the link admits to LOOKING (#88): viewers
 *   land on the deck full screen and every write is refused by the home. The
 *   people already in on the link are re-rooted to view, not expelled.
 * - `isocan share <email>` — **phase 9 stage 2's slot, filled.** The home
 *   writes the row, and whoever proves that address is admitted whether or not
 *   the link is on. On a home that has borrowed no attester the request is
 *   still sent and the home's own `no-attester` explains why it cannot: a
 *   client-side "not yet" would be a second copy of a policy that varies by
 *   which home the canvas lives at — and on a machine with two homes, by which
 *   canvas you are standing in.
 * - `isocan share --revoke <email>` — un-invite, which EXPELS them unless a
 *   surviving grant still covers them. It takes the sentence, not the row id:
 *   a person who wants somebody out knows their address.
 *
 * **An agent can do all four, and that is deliberate.** Signing in is a
 * person's gesture — an agent has no inbox and no browser — but *inviting
 * somebody by name* is ordinary collaboration work, and an agent that could
 * only hand out the link would be handing out more access than it was asked
 * to. Seeing what a badge has proved is `isocan badges`.
 *
 * **There is no owner**, deliberately, and this verb does not imply one: any
 * admitted badge may share or un-share, which is what the door actually does.
 *
 * On a replica every one of these forwards to the home, because the row that
 * decides who may enter lives there. Nothing here has to know that — but it is
 * why `isocan share --link off` run on a laptop really does turn the link off
 * for the world, rather than editing a local copy and reporting success.
 */
program
  .command("share")
  .description("Who may enter this canvas: the address to send, the \"anyone with the link\" grant, and who was invited by name")
  .argument("[who]", "an email to invite by name — they get in by proving that address")
  .option(
    "--link <on|off|view>",
    "turn the link grant on (anyone with the address can edit), off — OFF EXPELS the badges " +
      "that came in on it — or view: anyone with the address can look, and change nothing (#88)",
  )
  .option(
    "--revoke <who>",
    "un-invite somebody granted by name — EXPELS them unless another grant still covers them",
  )
  .action(
    run(async (who: string | undefined, opts: { link?: string; revoke?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const canvas = await resolveCanvas(ctx);
      // The one origin, per canvas: people always enter through the home that
      // holds THIS canvas, so the address handed out is that home's and never
      // this machine's 127.0.0.1 — the same rule `isocan open` follows, from
      // the same function. This is the string a person pastes to another
      // person, which makes it the worst place in the CLI to be approximately
      // right: a daemon-wide value here would send a stranger to a home that
      // has never heard of this canvas.
      const address = canvasUrl((await ctx.homeOf(canvas.id)) ?? ctx.client.base, canvas.id);
      /**
       * What the sweeps this invocation ran did, added up.
       *
       * Added up rather than overwritten because `--link off --revoke <who>`
       * is one gesture with two revocations, and reporting only the second
       * would say "1 expelled" about a command that expelled four. Absent from
       * a home that predates the sweep, which reads as nothing swept.
       */
      let swept: SweepReport | undefined;
      const sweepAlso = (report: SweepReport | undefined): void => {
        if (!report) return;
        swept = swept
          ? {
              expelled: swept.expelled + report.expelled,
              rerooted: swept.rerooted + report.rerooted,
            }
          : report;
      };

      if (opts.link !== undefined) {
        const want = opts.link.toLowerCase();
        if (want !== "on" && want !== "off" && want !== "view") {
          throw new Error(`--link wants on, off or view, got: ${opts.link}`);
        }
        const live = (await ctx.client.grants(canvas.id)).grants.find((g) => g.subject === LINK);
        // `on` and `view` are the same POST with a different capability, and
        // the home does the replacing when the link is already on the other
        // way — one gesture, whose sweep re-roots the people inside rather
        // than expelling them. Asking for what already stands does nothing,
        // for the toggle's reason: two people flipping it at once must not
        // turn one of them into a failure.
        if (want !== "off") {
          const capability = want === "view" ? ("view" as const) : ("edit" as const);
          if (!live || capabilityOf(live) !== capability) {
            sweepAlso((await ctx.client.createGrant(canvas.id, LINK, capability)).swept);
          }
        }
        // Off with no live row is not an error either — the gesture is "the
        // link is off", and it already is.
        if (want === "off" && live) {
          // **What the sweep did is remembered, not printed here.** Phase 9
          // made revocation expel people, and a gesture whose point is
          // expulsion has to be able to name its effect — but it belongs
          // BELOW the status lines, not above them, or the command opens with
          // a number nobody has been given a subject for yet. Absent from a
          // home that predates the sweep, which reads as nothing swept.
          sweepAlso((await ctx.client.revokeGrant(canvas.id, live.id)).swept);
        }
      }

      /**
       * **Un-invite, by the sentence rather than by the row id.**
       *
       * `--revoke jordan@acme.test` and not `--revoke gnt_7f3a`: a person who
       * wants somebody out knows their address, and knowing a grant id means
       * having first read a table to find it. The subject is spelled by the
       * same `grantSubjectOf` the invitation used, so the two halves of one
       * gesture cannot disagree about what was written.
       *
       * Refused loudly when no live row matches, rather than reported as a
       * success that did nothing — "Jordan is out" when Jordan is not out is
       * the worst possible answer here, and a mistyped address is the ordinary
       * way to get it.
       */
      if (opts.revoke !== undefined) {
        const subject = normalizeSubject(grantSubjectOf(opts.revoke));
        const live = (await ctx.client.grants(canvas.id)).grants.find(
          (g) => g.subject === subject,
        );
        if (!live) {
          throw new Error(
            `nothing on ${canvas.title} is granted to ${subject} — \`isocan share\` lists what is`,
          );
        }
        sweepAlso((await ctx.client.revokeGrant(canvas.id, live.id)).swept);
        console.log(`revoked ${subject} on ${canvas.title}`);
      }

      if (who !== undefined) {
        // Straight to the home: it owns whether it can verify this subject, and
        // a client-side "not yet" would be a second copy of a policy that
        // changes with a home's configuration. A home that has borrowed an
        // attester grants it; one that has not refuses with `no-attester` and
        // says what to do instead.
        const { grant } = await ctx.client.createGrant(canvas.id, grantSubjectOf(who));
        console.log(
          `granted ${grant.subject} on ${canvas.title} (${grant.id}) — they get in by ` +
            "proving that address; nothing was emailed from here",
        );
      }

      const { grants } = await ctx.client.grants(canvas.id);
      const link = grants.find((g) => g.subject === LINK) ?? null;
      // Just the names, not a whole snapshot: this command needs one string,
      // and the registry is what a rename reaches.
      const owner = actorNameIn(await ctx.client.actorNames(), canvas.createdBy);
      if (ctx.json) {
        return printJson({
          address,
          owner: canvas.createdBy,
          grants,
          ...(swept ? { swept } : {}),
        });
      }
      printKeyValues({
        address,
        // Whose canvas this is. It is the answer to the refusal `--link view`
        // gets from anybody else, so it belongs beside the link rather than
        // only in the error.
        owner,
        link: link
          ? capabilityOf(link) === "view"
            ? `view-only — anyone with the address can look, and change nothing (granted ${link.at.slice(0, 10)})`
            : `on — anyone with the address can enter (granted ${link.at.slice(0, 10)})`
          : // Phase 7's line here read "people already on this canvas keep
            // their access", and phase 9 made that false. Worse, with the
            // sweep's own count printed beside it the two lines contradicted
            // each other in one screen — which a walk against a real daemon
            // caught and no test would have.
            "off — new arrivals are turned away, and the badges that came in on it were expelled",
      });
      // Below the status, where a number has a subject.
      if (swept) console.log(sweptLine(swept));
      const others = grants.filter((g) => g.subject !== LINK);
      if (others.length > 0) {
        printTable(
          others.map((g) => ({ subject: g.subject, granted: g.at.slice(0, 10), by: g.grantedBy })),
        );
      }
    }),
  );

/**
 * **`isocan pass` — the escalation credential, minted from a terminal.**
 *
 * The journey is explicit that Scene 5's dialog is not the only way to get
 * one: *"any admitted session can mint the same pass from the CLI — how Priya
 * would enroll her own second machine."* Isomorphism is a house rule here, not
 * a courtesy, and this is the verb half of the button stage 3 builds. Neither
 * surface spells the command: `setupCommand` in `@isocan/core` does, so the
 * string the dialog shows and the string this prints agree by construction
 * rather than by two people remembering the same thing.
 *
 * **It is named after the thing it makes.** Every other name considered read
 * as the wrong gesture: `isocan enroll` and `isocan escalate` are imperatives
 * about a machine, and the machine they name is the one being enrolled — which
 * is the machine running `setup`, not this one. `isocan invite` is `isocan
 * share`, which already exists and is a different act. "Pass" is the word the
 * design, the journey, the refusal codes and the desk all already use.
 *
 * **What it prints is the whole command, never a bare token**, for one reason:
 * a person holding a bare token has to be told what to do with it, and being
 * told what to do with a credential is how credentials end up in the wrong
 * place. A line that begins `npx` is a line you paste into a terminal.
 *
 * **Share versus pass — the distinction to keep straight.** `isocan share`
 * hands a PERSON an address; they arrive thin, in a browser, and the door
 * decides. `isocan pass` hands a MACHINE a credential; it arrives thick,
 * admitted whatever the link grant says, and — by default — being you. The
 * first is an invitation and the second is a key, so the second is
 * short-lived, single-use, and not something to post anywhere.
 */
program
  .command("pass")
  .description(
    "Mint a short-lived, single-use pass: the one command that puts another machine of yours on this canvas",
  )
  .option(
    "--admit-only",
    "admit the machine but hand over no identity — it names itself when it arrives",
  )
  .action(
    run(async (opts: { admitOnly?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const canvas = await resolveCanvas(ctx);
      // The one origin again, and per canvas: a pass is minted at the home
      // that holds this canvas and redeemed there, so the address it rides on
      // is that home's — not this machine's next one, which is all a birth
      // default ever knows.
      const origin = (await ctx.homeOf(canvas.id)) ?? ctx.client.base;
      /**
       * **Two real shapes, and the default endows.**
       *
       * With a claim, the machine that redeems it arrives BEING you — Scene
       * 5's "the CLI arrives knowing who it speaks for", and the only honest
       * way to be the same person on a second surface, since self-claiming a
       * worn name is either refused or impersonation. That is the case this
       * verb exists for ("how Priya would enroll her own second machine"), so
       * it is what you get by typing nothing.
       *
       * `--admit-only` is not a stub. It is Scene 6's shape — Sonia claims her
       * OWN actor, never Inna's — and day-one `isocan open` before the human
       * has an actor to resume at all. The design says the claim slot is
       * optional and means it; a pass that always dragged an identity along
       * would make "let this machine in" impossible to say.
       *
       * The home refuses a claim this badge does not hold (`not-your-actor`,
       * mechanism 5's own check rather than a second spelling of it), so
       * "endow somebody else" is not reachable from here by construction.
       */
      const actor = opts.admitOnly ? null : ctx.actor;
      const { pass, token } = await ctx.client.mintPass(canvas.id, actor?.id);
      const command = setupCommand(origin, canvas.id, token);
      const minutes = Math.round(PASS_TTL_MS / 60_000);

      if (ctx.json) {
        return printJson({
          command,
          // The pass-bearing address, for a caller building its own line. The
          // clean address is `isocan share`'s, and that is the one to hand a
          // person — this one is a credential.
          address: canvasUrlWithPass(origin, canvas.id, token),
          canvas: canvasUrl(origin, canvas.id),
          expiresAt: pass.expiresAt,
          ...(actor ? { actor } : {}),
        });
      }
      printKeyValues({
        canvas: `${canvas.title} (${canvasUrl(origin, canvas.id)})`,
        identity: actor
          ? `${actor.name} (${actor.id}) — the machine that redeems this arrives as them`
          : "none — the machine that redeems this is admitted and names itself",
        expires: `in ${minutes} minutes (${pass.expiresAt})`,
      });
      console.log(`\nPaste this into a terminal on the other machine, in an empty directory:\n`);
      console.log(`  ${command}\n`);
      console.log(
        `That line is a credential — it works once, and only for the next ${minutes} minutes.\n` +
          "Do not post it on a thread and do not commit it. To invite a PERSON, hand them the\n" +
          "address from `isocan share` instead; they arrive in a browser with nothing installed.",
      );
    }),
  );

/**
 * **`isocan badges` — your own surfaces, and ending one.**
 *
 * The verb half of kill-a-badge (identity desk, mechanism 1), and the agent's
 * hands for the gesture the design describes as *"the stolen-laptop case"*.
 * It is here rather than only in a browser for the reason every verb in this
 * file is here: a canvas for people AND agents, and an agent that cannot see
 * which machines carry its identity cannot end one.
 *
 * **A surface is a badge that shares an identity with yours** — a badge
 * holding a claim on an actor your badge also claims. That is the whole rule,
 * and it is what makes the listing small and the gesture safe: a stranger has
 * no claim in common with you, so nobody can use this to expel anybody.
 *
 * **It asks the HOME**, and that is the point rather than a detail. A laptop
 * holds two badges — one at its own daemon, one at the home — and the local
 * one is not a boundary against somebody sitting at that keyboard. What
 * actually stops a stolen machine is that its badge AT THE HOME is ended: its
 * ops are refused and replication goes stale. So this verb shows the home's
 * list, and `--kill` ends a badge there.
 *
 * **Which home, on a machine with several?** A badge is not about one canvas,
 * so there is no canvas to read the answer off, and phase 10.3 left that as a
 * named seam rather than a solved problem: the daemon asks the birth default
 * when there is one, else the single home it dials, else nothing
 * (`HomeLinks.homeScoped`). On the two rigs anybody has — a pure home and a
 * machine with one home — that is exactly what it always did. On a mixed rig
 * it means this verb reports one home's surfaces and not the other's, which
 * is a narrow answer rather than a wrong one, and the fix when a scene forces
 * it is for the question to name its home.
 *
 * `--kill` rather than a second command, following `share --link off`: the
 * destructive act names its target explicitly, so no invocation of the bare
 * verb can ever end anything. And killing your OWN row is allowed and warned
 * about — signing this surface out is a real thing to want, and doing it by
 * accident is not.
 */
program
  .command("badges")
  .description("Every surface that carries your identity — and end one that should not")
  .option("--kill <badgeId>", "end that surface's recognition: it can no longer speak as you")
  .action(
    run(async (opts: { kill?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.kill !== undefined) {
        const { killed, swept } = await ctx.client.killBadge(opts.kill);
        if (ctx.json) return printJson({ killed, swept });
        printKeyValues({
          ended: `${killed.badgeId} (${surfaceKind(killed)})`,
          identity:
            killed.actors.map((a) => a.name || a.id).join(", ") ||
            "none — it spoke as nobody",
          canvases: `${killed.canvases} — ${sweptLine(swept)}`,
        });
        console.log(
          "\nThat holder is not recognised here any more. It composes with the link:\n" +
            "if it knocks again it gets a NEW badge with none of these claims, and the\n" +
            "grant decides whether that stranger is let back in — `isocan share --link off`.",
        );
        return;
      }
      const { badges } = await ctx.client.badges();
      if (ctx.json) return printJson({ badges });
      const now = new Date().toISOString();
      printTable(
        badges.map((badge) => ({
          badge: badge.badgeId,
          what: surfaceKind(badge),
          identity: badge.actors.map((a) => a.name || a.id).join(", ") || "—",
          // What this surface has PROVED (phase 9 stage 2). An agent has no
          // inbox and cannot sign in — but "which of my surfaces has proved
          // what" is exactly the kind of fact it must not need a person to
          // read out to it, and it is the answer to why a machine gets into a
          // canvas that was shared with one address by name.
          proved: badge.attested?.map((a) => a.replace(/^email:/, "")).join(", ") || "—",
          canvases: String(badge.canvases),
          seen: badge.self ? "now (this one)" : `${elapsedLabel(badge.lastSeen, now)} ago`,
        })),
      );
      console.log(
        "\n`isocan badges --kill <badge>` ends one. The row marked (this one) is the surface\n" +
          "you are typing at, so ending it signs this machine out.",
      );
    }),
  );

/** A browser tab or a machine, in one word. The carrier IS the answer — a
 * cookie badge is a browser by construction, because nothing else has a
 * cookie jar at the home's origin. */
function surfaceKind(badge: BadgeSummary): string {
  return badge.kind === "cookie" ? "browser" : "machine";
}

/** What a sweep did, in one line both this verb and `share` print. */
function sweptLine(swept: SweepReport): string {
  if (swept.expelled === 0 && swept.rerooted === 0) return "nobody was expelled";
  const parts = [`${swept.expelled} expelled`];
  // Named even when it is zero would be noise; named when it is not is the
  // half nobody expects — somebody stayed, because another grant still covers
  // them, which is the design's whole point about not expelling the invited.
  if (swept.rerooted > 0) parts.push(`${swept.rerooted} kept by another grant`);
  return parts.join(", ");
}

// ---------- clone: a repo, and the canvas it was committed with ----------

/**
 * **Clone a repo and land on the canvas it was committed with.**
 *
 * `.isocan/project.json` has been committable since #60 precisely so that "a
 * clone arrives already knowing WHICH canvas this directory is". This is the
 * verb that spends that: one command instead of clone, cd, setup.
 *
 * **It clones and readies. It does not install dependencies and does not run
 * anything from the repo.** `clone` borrows git's verb, and `git clone` has
 * never meant "and then execute what you fetched". The distinction earns its
 * keep here rather than being pedantry: the whole input is a URL somebody sent
 * you, and `npm install` runs the cloned repo's own `prepare` and
 * `postinstall`. A command that turns a link into arbitrary code execution
 * should be one you typed on purpose, so the next two lines are PRINTED and
 * not run.
 *
 * **And it creates no canvas**, for the reason `setup` creates none: a
 * `project.create` is stamped with whoever typed the command, which at this
 * moment is quite possibly an agent acting for a person who has not said their
 * name yet. The marker names the canvas; the first thing anybody ADDS
 * materializes it under that id (`resolveCanvas`'s `create` path). So this
 * reports what the clone is bound to and gets out of the way.
 */
program
  .command("clone <repo> [dir]")
  .description(
    "Clone a repo and ready it for canvas work — the canvas its .isocan marker names, " +
      "or a fresh one. Installs nothing from the repo",
  )
  .option("--force", "refresh the skill even if the cloned repo already has one")
  .action(
    run(
      async (
        repo: string,
        dir: string | undefined,
        opts: { force?: boolean },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals() as { json?: boolean };
        const remote = gitRemote(repo);
        const target = path.resolve(dir ?? defaultCloneDir(remote));
        if (await exists(target)) {
          throw new Error(
            `${target} already exists — \`isocan setup ${dir ?? defaultCloneDir(remote)}\` ` +
              "readies a directory you already have.",
          );
        }

        // Inherited stdio: git's progress is the only thing to look at while
        // this runs, and swallowing it to re-print a summary would be slower
        // AND less informative. A failure is git's message, not ours — it
        // knows far more about why a clone did not work than we could say.
        const cloned = spawnSync("git", ["clone", remote, target], { stdio: "inherit" });
        if (cloned.error) throw cloned.error;
        if (cloned.status !== 0) {
          throw new Error(`git clone failed (exit ${cloned.status}) — nothing was set up`);
        }

        const report: Record<string, string> = { repo: remote, directory: target };

        const skill = await installSkill(target, opts.force ?? false);
        report.skill =
          skill.state === "differs"
            ? `${path.relative(target, skill.path)} — differs from this build's copy; --force to refresh`
            : `${path.relative(target, skill.path)} (${skill.state})`;

        // The daemon has to be up for the next command to mean anything, and
        // whoever typed `isocan clone` has this build on their PATH by
        // definition — so unlike `setup` there is no CLI to install here.
        const home = paths.isocanHome();
        const port = daemonPort(cmd);
        const { base, direct } = await baseForCwd(home, port);
        const client = new DaemonClient(base, home);
        try {
          // A direct machine has nothing to ensure — the home is already up or
          // this clone has bigger problems, and `report.app` says which.
          if (!direct) await client.ensureDaemon();
          report.app = direct && !(await client.awaitHealth(5_000)) ? `${base} — not answering` : client.base;
        } catch (err) {
          report.app = `not running — \`isocan serve\` (${(err as Error).message})`;
        }

        // What the repo says this directory is. Read, never written: see the
        // doc above for why nothing is created here.
        const binding = await findBinding(target, home);
        if (!binding) {
          report.canvas =
            "none committed in this repo — `isocan use <canvas>` binds it to one, " +
            "or your agent's `isocan identity --session` makes one named after the directory";
        } else {
          const canvases = await client.listCanvases().catch(() => []);
          const here = canvases.find((p) => p.id === binding.canvasId);
          report.canvas = here
            ? `${here.title} (${binding.canvasId}) — already on this machine`
            : `${binding.title ?? "untitled"} (${binding.canvasId}) — not on this machine yet;` +
              " the first thing anyone adds materializes it under that id";
          if (binding.home) report.home = binding.home;
        }

        if (globals.json) return printJson(report);
        printKeyValues(report);
        // The two lines this deliberately did NOT run, if the repo looks like
        // it wants them. Printed, so the decision to execute the repo's code
        // stays the reader's.
        const node = await exists(path.join(target, "package.json"));
        const rel = path.relative(process.cwd(), target) || ".";
        console.log(
          `\ncd ${rel}` +
            (node ? "\nnpm install        # not run for you: it executes the repo's own scripts" : "") +
            "\n\nTell your agent to use the isocan-collab skill (or to run `isocan --agent-help`," +
            "\nwhich is the same instructions, shipped with this build).",
        );
      },
    ),
  );

// ---------- setup: one command, from any directory ----------

/** The skill this build ships, in the same relative place in a checkout and
 * in an `npm i -g github:…` install. */
const SKILL_NAME = "isocan-collab";
const skillSource = () =>
  fileURLToPath(new URL(`../../../.agents/skills/${SKILL_NAME}`, import.meta.url));
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

/**
 * **Which address a fresh machine gets pointed at, and whether it gets one at
 * all** — phase 14's default, and the two ways it is turned off.
 *
 * `ISOCAN_DEFAULT_HOME` set to an address REPLACES the shipped one; set to
 * empty it means "this build points fresh machines nowhere". It is not a
 * testing hatch bolted on: an innkeeper running isocan for their own
 * organisation ships the same CLI and wants their own home to be the default,
 * and the standing lesson applies — when a capability looks like it must be
 * compiled in, check whether what actually varies is an input the code already
 * needs. It grants no authority `ISOCAN_HOME_URL` does not already grant, and
 * far less: this one is consulted once, on a machine that has never held a
 * canvas, where that one wins over everything on every boot.
 *
 * **Unset in a checkout means no default**, which is the guard that matters
 * day to day. A checkout is a developer's machine — this repo's own
 * `npm run dev`, and every daemon the suite spawns — and pointing those at
 * production would be this project accidentally dogfooding the home strangers
 * are on. An EXPLICIT value still wins there, because somebody who exports it
 * in a checkout means it, and that is how the suite proves this flip works at
 * all (`setup-npx.test.ts`).
 */
async function defaultHomeUrl(): Promise<string | null> {
  const raw = process.env.ISOCAN_DEFAULT_HOME?.trim();
  if (raw !== undefined) return raw === "" ? null : raw;
  return (await runningFromCheckout()) ? null : DEFAULT_HOME_URL;
}

/**
 * **Has this machine ever held a canvas?** — the second half of who phase 14's
 * default may be written for.
 *
 * Asked of the DISK and not of the daemon, deliberately: `GET /api/projects`
 * is behind the door, and knocking on the door is what mints and stores a
 * badge. A plain `isocan setup` on a fresh machine must stay the command that
 * touches nothing — it creates no canvas, names nobody, and writes no
 * `identity.json` — and `setup.test.ts` asserts exactly that. Reading a
 * directory costs none of it.
 *
 * **Why "never held one" and not "has no birth default".** Somebody who has
 * been working locally for months also has no birth default, and silently
 * sending their next canvas to a hosted home would be the upgrade-day
 * behaviour change `DEFAULT_HOME_URL` refuses to ship at the resolver. Their
 * machine keeps birthing locally until they say otherwise, and `isocan home
 * https://isocan.io` is the whole of saying so.
 *
 * A missing directory is the fresh case and answers true; anything unreadable
 * answers false, which is the conservative direction — the cost of being
 * wrong here is a canvas born in the wrong place.
 */
async function neverHeldACanvas(isocanHome: string): Promise<boolean> {
  try {
    return (await fs.readdir(paths.canvasesDir(isocanHome))).length === 0;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ENOENT";
  }
}

/** This copy's package root — the thing a daemon's `root` is compared against. */
const myRoot = () => fileURLToPath(new URL("../../..", import.meta.url));

/**
 * **Is this argument a directory, or the address of a canvas to join?**
 *
 * `isocan setup [dir]` has meant "ready this directory" since #42, and Scene 5
 * gives the same word a second object: `setup isocan.io/p/7f3a…#<pass>`. An
 * argument that is *sometimes* a path and *sometimes* a URL is the kind of
 * thing that reads as obvious for a month and then bites, so the rule is
 * written down here rather than inferred at the call site, and it is decided
 * by the SHAPE of the string — never by what happens to exist on disk. A
 * disambiguation that asked the filesystem would mean `setup ./isocan.io` did
 * different things on two machines.
 *
 * In order, and the order is the whole rule:
 *
 * 1. **Anything that starts like a path is a path.** `.`, `..`, `/`, `~`, and
 *    a Windows drive letter. This is first so that a directory can always be
 *    named unambiguously — `setup ./whatever` is a directory even if somebody
 *    creates one called `isocan.io`.
 * 2. **Anything `parseCanvasAddress` accepts is an address**, pass and all.
 *    That is the same parser `@isocan/core` uses to spell the address in the
 *    first place, so "what setup accepts" and "what the dialog produces"
 *    cannot drift.
 * 3. **Anything that is trying to be an address is refused as one.** A scheme,
 *    or a first segment shaped like a hostname (a dot or a port, or
 *    `localhost`), means the person pasted an address — and a near-miss must
 *    say so, not go looking for a directory named `isocan.io/7f3a`. Phase 7's
 *    finding is that this system's default answer to a wrong address is a
 *    cheerful one; this is the same class of mistake at the one gesture where
 *    the person typing is a stranger who was thin thirty seconds ago.
 * 4. **Everything else is a directory**, exactly as before.
 *
 * Returns null for "this is a directory", so the caller reads as a branch
 * rather than as a catch.
 */
function setupAddress(raw: string): CanvasAddress | null {
  if (/^([.~]|\/|[a-zA-Z]:[\\/])/.test(raw)) return null;
  const parsed = parseCanvasAddress(raw);
  if (parsed) return parsed;
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const host = raw.split("/")[0] ?? "";
  const hostish = /^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?$/i.test(host);
  if (!scheme && !hostish) return null;
  throw new Error(
    `that is not a canvas address: "${raw}" — one looks like ` +
      "isocan.io/p/prj_7f3a, with the pass on the end when you were given one " +
      "(isocan.io/p/prj_7f3a#<pass>). `isocan share` on a machine that is " +
      "already on the canvas prints the address; `isocan pass` prints the whole command.",
  );
}

program
  .command("setup [target]")
  .description(
    "Ready a directory for canvas work — or, given a canvas address, put this machine on that canvas",
  )
  .option("--no-install", "don't install the isocan CLI when it isn't on PATH")
  .option("--open", "open the app in a browser (default when you're at a terminal)")
  .option("--no-open", "never open a browser")
  .option("--force", "refresh the skill even if this directory already has one")
  .option("--direct", "run no daemon here — speak to the home itself, keeping no local copy")
  .option("--daemon", "run a daemon here with a replica of its own, whatever this place looks like")
  .action(
    run(
      async (
        target: string | undefined,
        opts: {
          install?: boolean;
          open?: boolean;
          force?: boolean;
          direct?: boolean;
          daemon?: boolean;
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals() as { json?: boolean };
        /**
         * **Scene 5's one command, or the directory setup has always taken.**
         *
         * "One command — Priya's three steps collapsed to a line, because the
         * address carries everything setup would otherwise ask." What the
         * address carries is: which home to answer to (its origin), which
         * canvas this directory is (its path), and — in the fragment, which no
         * server ever sees — the credential that makes this machine's badge
         * welcome there and tells it whose it is.
         *
         * The joining form runs in the CWD, deliberately, and takes no
         * directory of its own. The scene is a person pasting into "a terminal
         * in an empty directory"; a `setup <address> <dir>` would be a second
         * argument nobody in the scene types, and the directory a person means
         * is the one they are standing in.
         */
        const arrival = target === undefined ? null : setupAddress(target);
        const work = arrival ? process.cwd() : path.resolve(target ?? process.cwd());
        if (!(await exists(work))) throw new Error(`no such directory: ${work}`);
        const report: Record<string, string> = {};

        /**
         * **Which way this machine works — decided here, once, and written
         * down** (phase 11).
         *
         * `setup` is the only command that guesses, and this is the whole of
         * the guessing. Everything after it reads `config.json`, so an agent
         * running fifty commands re-derives nothing and cannot find its canvas
         * moving between two replicas because a variable changed mid-session.
         * The shape is phase 14's birth default, deliberately: consulted at
         * setup, recorded with a receipt, and never applied to a machine that
         * has already made a decision.
         *
         * Precedence: the flags, then whatever was already declared
         * (environment or config), then the guess — and the guess can only
         * ever reach a machine ARRIVING at an address, because direct mode
         * with no home is a CLI with nothing to talk to.
         */
        const isocanHome = paths.isocanHome();
        if (opts.direct && opts.daemon) {
          throw new Error("`--direct` and `--daemon` are opposites — pick one");
        }
        if (opts.direct && !arrival) {
          throw new Error(
            "`isocan setup --direct` needs the canvas address to go direct TO: a machine with " +
              "no daemon and no home has nothing to talk to. Paste the address from the " +
              "canvas's own \"Run an agent in the cloud…\" dialog, or drop `--direct` to set " +
              "this directory up with a daemon of its own.",
          );
        }
        const declared = await resolveDeclared(isocanHome);
        const mode: "direct" | "daemon" = opts.direct
          ? "direct"
          : opts.daemon
            ? "daemon"
            : (declared?.mode ?? DEFAULT_MODE);
        const direct = mode === "direct" ? (arrival?.origin ?? declared?.at ?? null) : null;
        if (mode === "direct" && !direct) {
          throw new Error(
            `${DIRECT_VAR} says this machine runs no daemon, but nothing here says which ` +
              "home to speak to. Run `isocan setup <canvas address>`, or set the address " +
              `itself (${DIRECT_VAR}=https://isocan.io).`,
          );
        }
        // Said whenever it is not the ordinary answer, and it names the way
        // back in the same breath — the receipt rule `report.birth` follows.
        // It also names WHICH declaration decided it, because the two are
        // undone by different gestures and a report that conflated them would
        // name the wrong way out.
        if (direct) {
          const because = opts.direct
            ? "--direct"
            : declared?.from === "env"
              ? `${DIRECT_VAR} is set in this shell`
              : `already set in ${paths.configFile(isocanHome)}`;
          report.mode =
            `direct (${because}) — no daemon or local copy here; ` +
            `commands speak to ${direct} itself. \`isocan direct --clear\` for a daemon`;
        }

        const skill = await installSkill(work, opts.force ?? false);
        report.skill =
          skill.state === "differs"
            ? `${path.relative(work, skill.path)} — differs from this build's copy; --force to refresh`
            : `${path.relative(work, skill.path)} (${skill.state})`;

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

        // Setup with no address creates NO canvas, and so needs no identity of
        // its own. Making one here would stamp it with whoever typed the
        // command — often an agent, acting for a person who has not said their
        // name yet. The web app is where the human names themselves, and
        // making a canvas there is one click; a name picked in the browser is
        // the person's, which is the point.
        //
        // The JOINING form does not break that rule, it satisfies it from the
        // other side: it creates no canvas either — the canvas already exists
        // at the home and arrives here by replication — and the identity it
        // ends up holding was chosen by the person in a browser and HANDED
        // over, never minted here.
        const home = isocanHome;
        const port = daemonPort(cmd);
        const client = new DaemonClient(direct ?? `http://127.0.0.1:${port}`, home);
        // The daemon outlives the command that starts it, so it has to belong
        // to a copy that outlives it too. Run through npx, THIS copy is a
        // cache directory npm deletes — and every command from the CLI we just
        // installed would find that daemon and call it stale (#48). So when we
        // are the transient one, the installed copy is handed the daemon.
        const transient = (await whichInstall(path.resolve(myRoot()))).kind === "npx";
        const handOff = transient && !direct ? durableBin : null;
        /**
         * **The whole daemon paragraph, skipped** — this is what direct mode
         * IS, and every line of it is about a process this machine has decided
         * not to run: the npx hand-off, the staleness replacement, the restart
         * on the installed copy, and `ensureDaemon` itself.
         *
         * What replaces it is a reachability probe against the home, because
         * `daemonUp` is load-bearing three times below (the pass is redeemed
         * only when it is true, and a pass that goes unspent while the command
         * reports success is the bug the block below this one exists to
         * prevent). On a direct machine the question "is there something to
         * talk to" has the same shape and a different address.
         */
        if (direct) {
          const answering = await client.awaitHealth(5_000);
          report.app = answering
            ? client.base
            : `${client.base} — NOT ANSWERING; nothing on this machine works until it does`;
        } else {
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
        }

        /**
         * **"Is there something to talk to" — the one question, either way.**
         *
         * The name is now a slight lie on a direct machine, where nothing local
         * is up and what answered is the home. It kept the name deliberately:
         * three branches below gate on it (the pass, the marker, the record),
         * and each of them wants exactly this question. Renaming it to
         * `reachable` and leaving the branches identical would be churn; giving
         * direct mode its own flag would be two things to keep in step.
         */
        let daemonUp = report.app === client.base;

        /**
         * **Write the mode down — but only once the home has answered.**
         *
         * The order is the care. `config.direct` is what every later command
         * on this machine reads, and a machine recorded as direct against an
         * address that never answered is a machine where nothing works and
         * `isocan direct --clear` is the only way out — which the person would
         * have to know to type. So the probe comes first and this only runs
         * behind it, exactly as `isocan direct <url>` refuses an address that
         * does not answer.
         *
         * Written even when it is already written: the value can differ (a
         * second canvas at a different home), and an idempotent write of the
         * same string costs nothing.
         */
        if (direct && daemonUp) {
          const config = await readConfig(home);
          if (config.direct?.trim() !== direct) {
            config.direct = direct;
            await writeConfig(home, config);
            report.wrote = paths.configFile(home);
          }
        }

        /**
         * **Step one of the collapsed three: make this the machine's birth
         * default — but only if it has not got one.**
         *
         * This step used to be "answer to that home", and joining a canvas
         * meant repointing the whole machine. It does not any more: the home
         * is a property of the canvas, this key is only where the NEXT canvas
         * goes, and the refusal that used to stand here — *"this daemon
         * answers to X and that canvas lives at Y, joining it would repoint
         * this whole machine"* — defended a model phase 10.3 deleted. It is
         * gone with it.
         *
         * What replaced it is a narrower rule (ruling 4): **set the birth
         * default only when none is set, and say so.** Scene 5's one command
         * on a fresh machine behaves exactly as it always did — nothing is
         * configured, so the pasted address becomes where canvases are born,
         * which is what somebody joining their first team home wants. A
         * machine that already has one keeps it: joining a canvas at a second
         * home is now an ordinary thing to do, and silently moving where every
         * future canvas gets born would be a side effect nobody asked for.
         *
         * `isocan home`'s machinery, not a second copy of it — same refusals
         * (an `ISOCAN_HOME_URL` in the shell wins over the file and is refused
         * rather than silently ignored; a home that does not answer is named
         * rather than accepted), same write, same restart.
         *
         * `--force` is deliberately NOT passed through. On `isocan home` it is
         * the escape for somebody who knows their home is down and means it
         * anyway; here the very next thing we do is redeem a pass AT that
         * home, so an unreachable address is not a warning, it is the end of
         * the command — and the refusal says which address and why.
         */
        if (arrival && daemonUp && !direct) {
          const health = await client.healthz(2000);
          const configured = (await readConfig(home)).home?.trim() || null;
          const birth = health?.home ?? configured;
          if (!birth) {
            await pointDaemonAtHome({
              isocanHome: home,
              port,
              target: arrival.origin,
              configured,
              live: health?.home ?? null,
              force: false,
            });
            daemonUp = await client.awaitHealth();
            report.home = arrival.origin;
            report.birth =
              `new canvases here will be born at ${arrival.origin} — ` +
              "`isocan home --clear` if you would rather they stayed local";
          } else {
            report.home = birth;
            report.birth =
              birth === arrival.origin
                ? `${birth} — unchanged; that is already where canvases born here go`
                : `${birth} — unchanged. This canvas lives at ${arrival.origin} and stays ` +
                  `there; \`isocan home ${arrival.origin}\` if you want new ones born there too`;
          }
        }

        /**
         * **Phase 14's flip: a fresh machine is born answering to isocan.io.**
         *
         * The sibling of the block above, for the form with no address on it —
         * Scene 0 rather than Scene 5. Priya runs three steps, makes a canvas
         * in her browser a minute later, and it is at the hosted home; her
         * laptop and her desktop show the same canvas, "because multi-device
         * fell out before multi-user started." Without this line that canvas is
         * trapped on one machine, and the scene's last paragraph is false.
         *
         * `DEFAULT_HOME_URL` carries the argument for why the default is
         * consulted HERE and not as a fallback inside `resolveHomeUrl`. What
         * this block adds is the second half of the same care — **whose
         * machine may be flipped**, which is `neverHeldACanvas`, and:
         *
         * - **only when nothing is configured**, exactly as the arrival branch
         *   above. A machine with a birth default keeps it; that is somebody's
         *   answer and this is only a default.
         * - **only for an installed copy.** A checkout is a developer's
         *   machine — this repo's own `npm run dev`, and every daemon the suite
         *   spawns — and pointing those at production would be this project
         *   dogfooding somebody else's home by accident. `runningFromCheckout`
         *   is the same question setup already asks about the CLI on PATH.
         * - **never fatal.** `pointDaemonAtHome` refuses an address that does
         *   not answer, which is right for a person typing `isocan home` and
         *   wrong as the end of a first-run command: a fresh setup on a laptop
         *   with no network must still leave a working local daemon. So the
         *   refusal is caught and REPORTED — canvases stay local, and the line
         *   says why — rather than taking the whole command down with it.
         *
         * The report is the gesture's receipt, and it names the way back in
         * the same breath. This is the one place a person is told their next
         * canvas is going somewhere else.
         */
        const fresh = !arrival && daemonUp && !direct ? await defaultHomeUrl() : null;
        if (fresh) {
          const health = await client.healthz(2000);
          const configured = (await readConfig(home)).home?.trim() || null;
          const birth = health?.home ?? configured;
          if (!birth && (await neverHeldACanvas(home))) {
            try {
              await pointDaemonAtHome({
                isocanHome: home,
                port,
                target: fresh,
                configured,
                live: health?.home ?? null,
                force: false,
              });
              daemonUp = await client.awaitHealth();
              report.home = fresh;
              report.birth =
                `new canvases here will be born at ${fresh} — ` +
                "`isocan home --clear` if you would rather they stayed on this machine";
            } catch (err) {
              // Offline, or an `ISOCAN_HOME_URL` in this shell. Either way the
              // daemon is up and local, which is a working setup — so this is
              // a line in the report, not an exit code.
              report.birth =
                `canvases made here stay on this machine — could not set ${fresh} ` +
                `as the birth default (${(err as Error).message})`;
            }
          }
        }

        /**
         * **Step two: redeem the pass, so this machine is admitted and knows
         * whose it is.**
         *
         * The redemption forwards to the home (a pass is desk state; the row
         * lives where the door is), and what comes back is the ONLY
         * announcement of the endowed identity there will ever be — a handoff
         * claim carries no session key, and `GET /api/actors` answers by
         * session key, so nothing can ask again. It goes straight into
         * `identity.json`, this machine's person, which is the slot a human at
         * a fresh terminal resolves from before any daemon exists.
         *
         * `adoptIdentity` refuses to overwrite a DIFFERENT person already on
         * this machine, and setup says so rather than papering over it: a
         * command pasted out of a chat window is not the gesture that renames
         * the human who owns a laptop. The badge still holds the handed claim
         * either way — what is lost is only the convenience of it being the
         * default identity here.
         *
         * A pass-less address is a real and supported form; see below.
         */
        /**
         * **A pass that was not redeemed is a failure, and must say so.**
         *
         * This branch used to be silent when `daemonUp` was false: the pass
         * went unspent, no identity was written, nobody was admitted, and
         * the command exited 0 reporting everything else it had managed. A
         * person pasted a line out of a chat window, was told it worked, and
         * was not on the canvas.
         *
         * The probe that decided it is fixed above — it waits now instead of
         * asking once. This is the other half: if the daemon is genuinely not
         * there, the one thing the address was FOR did not happen, and
         * saying so is the whole difference between a setup that failed and a
         * setup that lied.
         */
        if (arrival?.pass && !daemonUp) {
          report.identity =
            "NOT redeemed — the daemon did not come up, so this pass is unspent and this " +
            "machine is not admitted. Run `isocan setup` again with the same address.";
        }
        if (arrival?.pass && daemonUp) {
          const answer = await client.redeemPass(arrival.pass, arrival.origin);
          if (!answer.actor) {
            report.identity = "admitted — this pass carried no identity, so name yourself here";
          } else {
            const { actor, adopted } = await adoptIdentity(home, answer.actor);
            report.identity = adopted
              ? `${actor.name} (${actor.id}) — handed over by the pass, saved to ${paths.identityFile(home)}`
              : `this machine already answers to ${actor.name} (${actor.id}); the pass's ` +
                `${answer.actor.name} (${answer.actor.id}) is admitted but not made default — ` +
                "`isocan whoami` shows which";
          }
        }

        /** Where a canvas made here would go — the health route's one field,
         * which is all it means now. The per-canvas answers come from the
         * record, and are read below, AFTER the join has had its chance to
         * write a row. */
        const birthHome = daemonUp ? ((await client.healthz(2000))?.home ?? null) : null;

        /**
         * **Step three: the marker, and the wait that proves the canvas is
         * really here.**
         *
         * The brief for this work said to verify that the canvas replicates
         * rather than to assume it, and the assumption is genuinely worth
         * distrusting: replication is a background sweep on the daemon, and
         * what makes the canvas appear in it is the badge's admission AT THE
         * HOME — written by the redemption for a pass, and by the canvas's
         * standing link grant when there is none. So this waits, briefly, for
         * the canvas to actually land, and says which of the two answers it
         * got. A setup that printed an address for a canvas that never arrived
         * would be the cheerful wrong address again, with a person's whole
         * first impression riding on it.
         *
         * The wait is bounded and its failure is not fatal: the marker is
         * written either way (it is the durable half — a clone carries it, and
         * the sweep keeps trying every couple of seconds), and the report says
         * plainly that nothing has arrived yet.
         */
        if (arrival && daemonUp) {
          const standing = await findBinding(work, home);
          // The same verdict `use` and the picker read (core's `bindVerdict`):
          // one directory, one canvas, and a marker naming somebody else is
          // not something to quietly rewrite. The SENTENCE stays this one —
          // arriving into a directory is a different moment from choosing to
          // bind one, and this is the moment where "run this somewhere else"
          // is the useful thing to say.
          if (standing && bindVerdict(standing, arrival.canvasId) === "taken") {
            // Not a merge and not a re-home: two canvases cannot share one
            // directory, and quietly rewriting the marker would orphan the
            // work the first one holds. `ctx.ts`'s `refuseHomeDisagreement`
            // makes a refusal about the same file in the same spirit. This one
            // is deliberately untouched by phase 10.3: it is about the
            // DIRECTORY holding two canvases, which no amount of many-homes
            // makes sensible, and it never had anything to do with which home
            // this machine answers to.
            throw new Error(
              `this directory is already this canvas: ${standing.canvasId} ` +
                `(${markerFile(standing.root)}). Joining ${arrival.canvasId} here would ` +
                "replace that binding — run this in an empty directory instead.",
            );
          }
          const root = standing?.root ?? (await bindableRoot(work, home));
          /**
           * **The pass-less arrival asks for its canvas by name.**
           *
           * With a pass, redemption already wrote the admission and the sweep
           * has the canvas in `?reach=admitted` before this line runs. Without
           * one, this machine holds nothing but the ADDRESS somebody pasted —
           * and since phase 8 stage 4 a replica no longer enumerates its home,
           * so nothing would ever offer it the canvas. `joinFromHome` is the
           * arrival saying which canvas it means; the home's own door decides,
           * exactly as it decided when the sweep used to dial it blind.
           *
           * Swallowed rather than thrown, because the report below already
           * says what happened and says it better: a refusal here means the
           * link is off, and `report.replicated` names the gesture that fixes
           * that (ask for a pass). Turning a legible report into a stack trace
           * would be a worse command.
           */
          if (!arrival.pass) {
            // **Naming the address is what makes it work on a machine that has
            // never been to that home** (phase 10.3). Before, the join went
            // wherever the daemon answered to and this call was only sensible
            // because setup had just pointed it there; now the arrival says
            // which home it came from, the daemon opens a link, and a machine
            // with a birth default somewhere else joins this canvas without
            // anything else moving.
            await client.joinFromHome(arrival.canvasId, arrival.origin).catch(() => null);
          }
          const landed = await canvasArrives(client, arrival.canvasId, 15_000);
          if (root) {
            report.marker = await writeMarker(root, {
              canvasId: arrival.canvasId,
              ...(landed?.title !== undefined ? { title: landed.title } : {}),
              home: arrival.origin,
            });
            await recordDir(home, root, arrival.canvasId);
          } else {
            report.marker =
              "not written — this directory cannot hold one (your home directory, or the " +
              "filesystem root). Run this in a project directory.";
          }
          report.replicated = landed
            ? // Nothing replicated on a direct machine, and saying it did
              // would be the one sentence that makes somebody believe they
              // can close the lid and keep working. What the probe actually
              // proved here is admission: the home listed the canvas for this
              // badge, which is the useful half either way.
              direct
              ? `"${landed.title}" — admitted at ${direct}; nothing is copied here`
              : `"${landed.title}" is on this machine`
            : "not yet — the home has not offered this canvas to this machine. " +
              (arrival.pass
                ? "The pass was redeemed, so this should heal on the next sweep."
                : "Without a pass you arrive under the canvas's link grant; if that is off, " +
                  "ask for a pass (`isocan pass`) from a session that is already on it.");
        }

        /**
         * Phase 7.5: finish the walk.
         *
         * Setup still creates NO canvas — the paragraph above stands, and it is
         * the reason there is a branch here at all. What changed is only what
         * setup REPORTS. A directory that already has a marker gets its
         * canvas's address AT THE HOME, which is the thing that used to be read
         * out of `.isocan/project.json` by hand; a directory that has none is
         * told what makes one, rather than being handed a bare origin and left
         * to guess.
         */
        const bound = daemonUp ? await findBinding(work, home) : null;
        /**
         * **The record, read last, and read per canvas.**
         *
         * Last, because the join above is what writes the row for a canvas
         * this machine has just been let onto — reading before it would
         * describe the machine as it was a second ago. Per canvas, because
         * that is the only honest question now: this directory's canvas has a
         * home, and it is not necessarily the one the next canvas would be
         * born at. A daemon serves the pages for the canvases whose home it
         * is, so `null` here really does mean "open it right here".
         */
        //
        // Asked only when there is something it could change: a canvas in this
        // directory, an address just joined, or a birth default. A plain
        // `isocan setup` on a fresh machine must stay the one command that
        // touches NOTHING — it creates no canvas, names nobody, and (because
        // this route is behind the door, and knocking on the door is what
        // mints and stores a badge) it must not even write `identity.json`.
        // That is asserted in `setup.test.ts`, and it is the reason this is
        // conditional rather than unconditional.
        const record =
          daemonUp && (arrival || bound || birthHome)
            ? await readHomeRecord(client, birthHome).catch(() => null)
            : null;
        // Said only when it is not the sentence a plain local daemon would
        // give: "your daemon is at 127.0.0.1 — and it is a home" is a line
        // that costs a reader a second and tells them nothing.
        if (record && (record.birth || Object.values(record.rows).some((at) => at !== null))) {
          report.app = `${client.base} — ${roleLine({ birth: record.birth, rows: record.rows }, client.base)}`;
        }
        const origin =
          (bound && record ? homeAddressOf(record, bound.canvasId) : birthHome) ?? client.base;
        const where = bound ? canvasUrl(origin, bound.canvasId) : origin;
        if (bound) report.canvas = where;
        else if (birthHome) {
          report.canvas = `${birthHome} — none in this directory yet: make one there, or \`isocan identity --session\` here`;
        }

        // A person at a terminal gets the app opened for them; a script or an
        // agent gets the URL to hand over. Never with a pass on it: `isocan
        // open` is the verb that escalates a browser, and a bearer credential
        // in a line setup printed is one that ends up in a transcript.
        const open = opts.open ?? Boolean(process.stdout.isTTY);
        if (open && daemonUp) {
          spawn(process.platform === "darwin" ? "open" : "xdg-open", [where], {
            stdio: "ignore",
            detached: true,
          }).unref();
        }

        if (globals.json) return printJson(report);
        printKeyValues(report);
        const agentLine =
          "\nTell your agent to use the isocan-collab skill (or to run `isocan --agent-help`," +
          "\nwhich is the same instructions, shipped with this build).";
        console.log(
          bound
            ? `\nThis directory's canvas: ${where}${agentLine}`
            : `\nOpen ${where} — pick your name, make a canvas.${agentLine}`,
        );
      },
    ),
  );

/**
 * Has the canvas actually replicated onto this machine yet?
 *
 * A poll and not a subscription, for the reason the home connection's own
 * sweep is one: what we are waiting for IS that sweep (every couple of
 * seconds), and there is no event to listen to from out here. Bounded, and a
 * null answer is a fact worth reporting rather than an error — the marker
 * stands, the sweep keeps trying, and the person is told the truth about what
 * is on their machine right now.
 */
async function canvasArrives(
  client: DaemonClient,
  canvasId: string,
  withinMs: number,
): Promise<Canvas | null> {
  const deadline = Date.now() + withinMs;
  for (;;) {
    const found = await client
      .listCanvases()
      .then((canvases) => canvases.find((canvas) => canvas.id === canvasId) ?? null)
      .catch(() => null);
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// ---------- canvases ----------

const canvas = program
  .command("canvas")
  .description("Create, list, edit, and delete canvases")
  // The verb agents and people typed for a year, kept working and kept out of
  // help (phase 13.5's rename): `isocan project list` still runs, nothing
  // scripted breaks, and the help and the agent guide advertise `canvas` only.
  .alias("project");

canvas
  .command("create <title>")
  .description("Create a canvas")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .action(
    run(async (title: string, opts: { description?: string; prop: Record<string, string> }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const canvasId = newCanvasId();
      await sendOp(ctx, null, {
        type: "project.create",
        canvasId,
        title,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(Object.keys(opts.prop).length > 0 ? { properties: opts.prop } : {}),
      });
      if (ctx.json) return printJson({ canvasId });
      console.log(`created canvas ${canvasId} — "${title}"`);
      const config = await readConfig(ctx.home);
      if (!config.defaultProjectId) {
        await writeConfig(ctx.home, { ...config, defaultProjectId: canvasId });
        console.log(`(set as default canvas)`);
      }
    }),
  );

canvas
  .command("list")
  .description("List canvases — in a bound directory, that directory's canvas (--all for every one)")
  .option("--all", "every canvas in the home, not just this directory's")
  .option("--sort <order>", "recent (default), name, or created")
  .option("--filter <text>", "only canvases whose title or description matches every word")
  .action(
    run(async (opts: { all?: boolean; sort?: string; filter?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const all = await ctx.client.listCanvases();
      // A bound directory shows its own canvas: an agent that landed here
      // should not go wandering through every other canvas in the home.
      // Ergonomics, not a wall — same user, same home, --all opens it.
      const canvases =
        !opts.all && ctx.binding ? all.filter((p) => p.id === ctx.binding!.canvasId) : all;
      if (canvases.length < all.length) {
        console.error(
          `(this directory's canvas only — --all for the other ${all.length - canvases.length})`,
        );
      }
      /**
       * The same ordering and the same matching the app uses (`core/
       * canvassort.ts`). A home screen and this command disagreeing about
       * which canvas is most recent is the drift core exists to prevent — and
       * at a hundred canvases the order is not a nicety, it is the feature.
       */
      if (opts.sort !== undefined && !isCanvasSort(opts.sort)) {
        throw new Error(`not an order: ${opts.sort} — ${CANVAS_SORTS.join(", ")}`);
      }
      const shown = sortCanvases(
        opts.filter ? filterCanvases(canvases, opts.filter) : canvases,
        opts.sort ?? "recent",
      );
      if (ctx.json) return printJson(shown);
      if (shown.length === 0 && opts.filter) {
        return console.log(`nothing matches "${opts.filter}"`);
      }
      const config = await readConfig(ctx.home);
      // Who touched it last, by the name they go by NOW — a canvas row has no
      // snapshot to carry the registry, so ask for it.
      const names = await ctx.client.actorNames();
      /* The same sentence the app's cards carry: who, what, how long ago.
         `updated` was a full ISO stamp, which is a machine's answer to a
         question a person asked — and it said nothing about WHAT happened. */
      const nowMs = Date.now();
      printTable(
        shown.map((p) => ({
          id: p.id + (p.id === config.defaultProjectId ? " *" : ""),
          title: truncate(p.title, 30),
          description: truncate(p.description, 30),
          last: `${actorNameIn(names, p.updatedBy)} ${opWords(p.lastOp) ?? "did something"}`,
          when: ago(p.updatedAt, nowMs) || "just now",
        })),
      );
    }),
  );

canvas
  .command("show [ref]")
  .description("Show canvas details")
  .action(
    run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.canvasRef = ref;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
        created: `${p.createdAt} by ${actorNameIn(snapshot.names, p.createdBy)}`,
        updated: `${p.updatedAt} by ${actorNameIn(snapshot.names, p.updatedBy)}`,
      });
    }),
  );

canvas
  .command("edit [ref]")
  .description("Edit canvas details")
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
        if (ref !== undefined) ctx.canvasRef = ref;
        const p = await resolveCanvas(ctx);
        const patch = metaPatch(opts);
        if (Object.keys(patch).length === 0) throw new Error("nothing to change");
        await sendOp(ctx, p.id, { type: "project.update", patch });
        console.log(`updated canvas ${p.id}`);
      },
    ),
  );

canvas
  .command("delete [ref]")
  .description("Delete a canvas (requires --force; not undoable)")
  .option("--force", "confirm deletion")
  .action(
    run(async (ref: string | undefined, opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.canvasRef = ref;
      const p = await resolveCanvas(ctx);
      if (!opts.force) {
        throw new Error(`deleting "${p.title}" is not undoable — re-run with --force`);
      }
      await sendOp(ctx, p.id, { type: "project.delete" });
      const config = await readConfig(ctx.home);
      if (config.defaultProjectId === p.id) {
        await writeConfig(ctx.home, {});
      }
      // A marker left standing would quietly re-materialize the canvas on
      // the next mutating command — deleting the canvas unbinds the dir too.
      if (ctx.binding?.canvasId === p.id) {
        await fs.rm(markerFile(ctx.binding.root), { force: true }).catch(() => {});
        console.log(`(unbound ${ctx.binding.root} — removed ${markerFile(ctx.binding.root)})`);
      }
      console.log(`deleted canvas ${p.id} (recoverable by hand in deleted-projects/)`);
    }),
  );

program
  .command("use <ref>")
  .description("Bind this directory to a canvas (--home: set the home-wide fallback instead)")
  .option(
    "--home",
    "set the home-wide default, consulted only in directories not bound to a canvas",
  )
  .option("--force", "rebind a directory that already belongs to another canvas")
  .action(
    run(async (ref: string, opts: { home?: boolean; force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      ctx.canvasRef = ref;
      const p = await resolveCanvas(ctx);
      if (opts.home) {
        await writeConfig(ctx.home, { ...(await readConfig(ctx.home)), defaultProjectId: p.id });
        console.log(`home default canvas: ${p.id} — "${p.title}"`);
        return;
      }
      const root = await bindableRoot(process.cwd(), ctx.home);
      if (!root) {
        throw new Error(
          "this directory cannot hold a binding (a home directory binds everything under it) — " +
            "`isocan use <ref> --home` sets the home-wide default instead",
        );
      }
      // The address, beside the id — the same promise `bindFresh` and the
      // session handshake write (offline-birth.md). Found while walking phase
      // 7.5's own outcome: with a home configured, binding by hand was the one
      // path that produced a marker naming no home, so a teammate cloning the
      // repo got "wherever the daemon reading this lives" for a canvas that
      // demonstrably lives somewhere. Absent still means that, and still has
      // to — every marker written before phase 6 lacks the key.
      //
      // **THIS canvas's home** (phase 10.3), not the birth default. The marker
      // is the assertion everything else in the phase reads back, so writing
      // "wherever the next canvas goes" into it for a canvas that lives
      // somewhere else would commit the disagreement that
      // `refuseHomeDisagreement` exists to refuse — to git, where a teammate
      // would clone it.
      /**
       * **Rebinding somebody else's directory is a choice, not a keystroke.**
       *
       * This overwrote the marker without a word. The marker is COMMITTED —
       * run `isocan use` in a repo a teammate bound and the file changes
       * under both of you, with the only evidence a line in `git status`
       * nobody was expecting. The web has refused this since the picker
       * shipped; the two surfaces simply disagreed, and the surface that was
       * right is the one whose gesture is cheapest.
       *
       * Adoption is NOT this case and is not touched: a marker already
       * naming this canvas is a fresh clone, and rewriting it changes
       * nothing (`bindVerdict`).
       */
      const claim = await readMarker(root);
      if (!opts.force && bindVerdict(claim, p.id) === "taken") {
        throw new Error(
          `${takenSentence(root, claim!)} — \`isocan use ${ref} --force\` rebinds it anyway`,
        );
      }
      const livesAt = await ctx.homeOf(p.id);
      const file = await writeMarker(root, {
        canvasId: p.id,
        title: p.title,
        ...(livesAt ? { home: livesAt } : {}),
      });
      await recordDir(ctx.home, root, p.id);
      // "Recognised" and "attached" are different facts about the world, so
      // the clone case says which one happened rather than claiming to have
      // changed a repo it did not touch.
      console.log(
        bindVerdict(claim, p.id) === "adopt"
          ? `this directory already meant "${p.title}" (${p.id}) — adopted via ${file}`
          : `this directory now means "${p.title}" (${p.id}) — bound via ${file}`,
      );
    }),
  );

// ---------- items ----------

/** Shared placement rule for new items: --at > --anchor > left of the
 * leftmost item > the origin. `--at` is a CHOSEN spot — naming coordinates
 * is pointing at them — and lands exactly there; the rest are computed and
 * may be tidied clear of what is already on the canvas (`Placement.chosen`). */
function placementFor(
  snapshot: CanvasSnapshotResponse,
  opts: { at?: string; anchor?: string; in?: string },
  /** The thing's size, when the caller knows it — what `--in` needs to find
   *  a spot inside the area that will hold it. */
  size?: { width: number; height: number },
): Placement {
  if (opts.at) return { ...parseXY(opts.at), chosen: true };
  // `--in <area>`: the first clear spot inside the sheet, and CHOSEN, because
  // the search already found it clear and the daemon must not tidy it out
  // of the area (`core/area.ts`).
  if (opts.in) {
    const area = findArea(snapshot.canvas, opts.in);
    if (!area) throw new Error(`no area called "${opts.in}" — \`isocan area ls\` names them`);
    const want = size ?? { width: 0, height: 0 };
    return { ...freeSpotIn(snapshot.canvas, area, want.width, want.height), chosen: true };
  }
  if (opts.anchor) return { anchorItemId: resolveItem(snapshot, opts.anchor).id };
  const leftmost = Object.values(snapshot.canvas.items).reduce<Item | null>(
    (best, item) => (best === null || item.x < best.x ? item : best),
    null,
  );
  return leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 };
}

/**
 * One of a closed set, or a refusal that says what the set is.
 *
 * A typo must not silently become the default: `--style headin` quietly
 * rendering body text is a person believing they set something they did not,
 * and they will only find out by squinting at a canvas from far away — which
 * is the exact thing the ladder exists to fix.
 */
function pickOne<T extends string>(
  flag: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  const found = allowed.find((a) => a === value.toLowerCase());
  if (!found) throw new Error(`--${flag} must be one of: ${allowed.join(", ")} — got: ${value}`);
  return found;
}

/**
 * **Say it at the moment it matters, not in a document.**
 *
 * The agent guide has always said to read the design system before building a
 * screen. A norm in a guide is a rule somebody has to remember, and an agent
 * that has just uploaded its second screen is exactly who has not.
 *
 * So the canvas says so, once, where the work happened — after the screen
 * lands, never instead of it. It does not refuse and it does not ask a
 * question: the screen is already made, and by the second one the choices are
 * already made too. What is missing is only the writing down, and the honest
 * version of that is derived from these screens rather than invented.
 *
 * On stderr, so a caller parsing stdout is unaffected, and silent under
 * `--json` for the same reason. Best-effort throughout — a canvas that cannot
 * be read is not a reason to fail an upload that already succeeded.
 */
async function noteMissingDesignSystem(ctx: Ctx, canvasId: string): Promise<void> {
  if (ctx.json) return;
  try {
    const snapshot = await ctx.client.snapshot(canvasId);
    const screens = Object.values(snapshot.canvas.items).filter(
      (item) => itemKind(item) === "screen",
    ).length;
    if (!needsDesignSystem(snapshot.canvas, screens)) return;
    console.error(
      `note: ${screens} screens here and no design system. ` +
        "`/design-system` derives one from what these screens already do; " +
        "`isocan design set <file>` writes one you have.",
    );
  } catch {
    // Noticing is a courtesy. It must never be the reason a command fails.
  }
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
  .option("--in <area>", "place inside this area, at the first clear spot")
  .option("--size <WxH>", "display size, e.g. 480x360")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .option(
    "--drawing",
    "an SVG you drew: lands as ink (no card, no titlebar) like the web app's Pen",
  )
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
          drawing?: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        // `add` can start an empty canvas, so it may bind this directory to
        // a fresh canvas when nothing else answers (#60).
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
        const data = await fs.readFile(file);
        const filename = path.basename(file);
        const mimeType = mimeFor(filename);
        if (opts.drawing && mimeType !== DRAWING_MIME) {
          throw new Error(`--drawing needs an SVG; ${filename} is ${mimeType}`);
        }
        await narrate(ctx, p.id, { status: `adding ${truncate(filename, 24)}…` });
        const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);

        // `kind=drawing` is the convention the web app's Pen writes, and what
        // both clients read to render ink without a card (core/drawing.ts).
        const properties = { ...opts.prop, ...(opts.drawing ? DRAWING_PROPERTIES : {}) };

        // Ink knows where it goes. A drawing's viewBox IS its world box — that
        // is the invariant the Pen writes and `merge` reads back — so unless
        // you say otherwise, ink lands on the coordinates it was drawn at
        // rather than at the next free slot in a default-sized card. Without
        // this, an agent's strokes appear somewhere other than where they say
        // they are, and two of them cannot be merged into one honest picture.
        const inkBox =
          opts.drawing && opts.at === undefined && opts.size === undefined
            ? drawingViewBox(data.toString("utf8"))
            : null;
        const { width, height } = inkBox
          ? {
              width: Math.ceil(inkBox.maxX) - Math.floor(inkBox.minX),
              height: Math.ceil(inkBox.maxY) - Math.floor(inkBox.minY),
            }
          : sizeFor(opts.size, defaultSize(mimeType));
        // Ink is not `chosen` and needs no flag: it is where the pen drew
        // it, meaningful by kind (`positionIsMeaningful`). Everything else
        // goes through `placementFor`, where `--at` is the chosen case.
        const placement = inkBox
          ? { x: Math.floor(inkBox.minX), y: Math.floor(inkBox.minY) }
          : placementFor(snapshot, opts, { width, height });
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
          ...(opts.title !== undefined ? { title: opts.title } : opts.drawing ? { title: DRAWING_TITLE } : {}),
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          ...(Object.keys(properties).length > 0 ? { properties } : {}),
        });
        const placed = (result.envelope.op as { placement: { x: number; y: number } }).placement;
        if (ctx.json) return printJson({ itemId, placement: placed });
        console.log(`added ${itemId} (${filename}) at ${placed.x},${placed.y}`);
        await noteMissingDesignSystem(ctx, p.id);
      },
    ),
  );

/**
 * **Do the bytes agree with the ops?**
 *
 * An item replicates; the bytes it names do not follow on their own — they
 * are pushed by hand when the item is made. Anything that stops that push
 * leaves a teammate holding the item, its title and its version, with "blob
 * not found" where the screen should be, and it never heals, because nothing
 * ever looks.
 *
 * It was reported that way and could not be answered from either machine:
 * a local read is served from the local copy, so the one question that
 * mattered — are the bytes AT THE HOME — had no way to be asked. The fix was
 * a hand re-upload and the confirmation was somebody else's reload, which is
 * a guess that happened to work.
 */
/**
 * **Copy items — the durable act behind the app's ⌘C/⌘V.**
 *
 * The clipboard is a UI idea and stays one: it is local, it is per-tab, and
 * nothing about it belongs on the wire. What both surfaces share is what
 * actually happens when you paste — new items, made from the old ones,
 * arranged the way they were. So the CLI has the ACT, not the clipboard, and
 * the two produce the same ops.
 *
 * Across canvases the bytes have to travel: a blob is addressed per canvas,
 * so a copy into another canvas re-uploads it there. Content addressing makes
 * that cheap to be right about — the same bytes hash the same on both sides,
 * so a canvas that already holds them gains nothing new.
 */
/**
 * **Say something in the Chat, in one command.**
 *
 * The Chat is the canvas's own conversation and the channel every parked
 * agent hears — `wait` wakes on anything landing there with no @-mention —
 * and it is also, in the app, the thing that raises a toast on somebody's
 * screen. So "notify the human" and "post to the Chat" are the same act, and
 * this is that act with the ceremony removed.
 *
 * The ceremony was the problem. Posting to the Chat meant knowing the main
 * thread's id: `comment main` to find it, then `comment reply <thr>` to
 * speak. `comment reply main` does not resolve. So an agent with something to
 * announce reached for `comment add`, which is a PIN — a thing stuck to a
 * spot on the canvas — and a canvas collected pins for announcements that
 * were never about anywhere in particular.
 *
 * On a canvas with no Chat yet, the first message births it, exactly as the
 * app's own `postToMain` does. Its coordinates are only where the pin would
 * land if the channel were ever demoted, and this end has no viewport to
 * offer, so they are the origin and say so.
 */
program
  .command("notify <message...>")
  .description("Say something in the Chat — every parked agent hears it, and the human sees it")
  .option("--item <ref...>", "items this is about, carried so a reader can act on them")
  .action(
    run(async (words: string[], opts: { item?: string[] }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const body = words.join(" ");
      const attached = (opts.item ?? []).map((ref) => resolveItem(snapshot, ref).id);
      const withItems = (comment: NewComment): NewComment =>
        attached.length === 0
          ? comment
          : { ...comment, items: [...new Set([...(comment.items ?? []), ...attached])] };

      const main = mainThread(snapshot.canvas);
      const comment = withItems(await newComment(ctx, p.id, snapshot, body));
      if (main) {
        await sendOp(ctx, p.id, { type: "thread.reply", threadId: main.id, comment });
        if (ctx.json) return printJson({ threadId: main.id, commentId: comment.id });
        console.log(`said in the Chat: ${body}`);
        return;
      }
      const threadId = newThreadId();
      await sendOp(ctx, p.id, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        comment,
      });
      if (ctx.json) return printJson({ threadId, commentId: comment.id, created: true });
      console.log(`started the Chat, and said: ${body}`);
    }),
  );

program
  .command("ask <question...>")
  .description("Ask the person a question and stop — the canvas shows you as waiting")
  .option("--item <item>", "pin the question to a thing, instead of the Chat")
  .action(
    run(async (words: string[], opts: { item?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const question = words.join(" ").trim();
      if (question === "") throw new Error("ask what?");

      /**
       * **`/ask` is the wire format, and it belongs to core.**
       *
       * `openAsk` reads a comment body for `^/ask`, and that derivation is
       * what puts an agent in the roster's `blocked` tier and prints *asked*
       * beside its name in the tray. Writing the prefix here rather than
       * asking the person to type it is the whole point of the verb: the
       * state is a consequence of the words, so the words must be exact.
       *
       * Left alone if it is already there, so `isocan ask "/ask …"` — which
       * somebody who has read the guide will type — does not become
       * `/ask /ask …` and fail to parse as anything.
       */
      const body = question.startsWith("/ask") ? question : `/ask ${question}`;
      const comment = await newComment(ctx, p.id, snapshot, body);

      if (opts.item) {
        // A question about one thing belongs on that thing, where somebody
        // looking at it will find it — `itemThread` is the same rule ⇧C uses,
        // so this reopens the item's conversation rather than starting a
        // second one beside it.
        const item = resolveItem(snapshot, opts.item);
        const existing = itemThread(snapshot.canvas, item.id);
        if (existing) {
          await sendOp(ctx, p.id, { type: "thread.reply", threadId: existing.id, comment });
          if (ctx.json) return printJson({ threadId: existing.id, commentId: comment.id });
          console.log(`asked on "${item.title}" — parked until somebody answers`);
          return;
        }
        const threadId = newThreadId();
        const { x, y } = anchorOffset(item);
        await sendOp(ctx, p.id, {
          type: "thread.create",
          threadId,
          x,
          y,
          anchorItemId: item.id,
          comment,
        });
        if (ctx.json) return printJson({ threadId, commentId: comment.id, created: true });
        console.log(`asked on "${item.title}" — parked until somebody answers`);
        return;
      }

      const main = mainThread(snapshot.canvas);
      if (main) {
        await sendOp(ctx, p.id, { type: "thread.reply", threadId: main.id, comment });
        if (ctx.json) return printJson({ threadId: main.id, commentId: comment.id });
        console.log("asked in the Chat — parked until somebody answers");
        return;
      }
      const threadId = newThreadId();
      await sendOp(ctx, p.id, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        comment,
      });
      if (ctx.json) return printJson({ threadId, commentId: comment.id, created: true });
      console.log("asked in the Chat — parked until somebody answers");
    }),
  );

program
  .command("copy <items...>")
  .description("Copy items — beside themselves, or into another canvas with --to")
  .option("--to <canvas>", "copy into this canvas instead of beside the originals")
  .option("--at <x,y>", "where the copy goes (default: clear ground beside the originals)")
  .action(
    run(async (items: string[], opts: { to?: string; at?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: from, snapshot } = await canvasAndSnapshot(ctx);
      const sources = items.map((ref) => resolveItem(snapshot, ref));
      // `--to` names a canvas the way every other ref does; without it the
      // copies land beside their originals.
      const target = opts.to
        ? matchRef(await ctx.client.listCanvases(), opts.to)
        : from;
      const sameCanvas = target.id === from.id;
      // The arrangement is placed against the canvas the copies LAND on —
      // beside the originals when that is the same one, on clear ground when
      // it is not.
      const into = sameCanvas ? snapshot.canvas : (await ctx.client.snapshot(target.id)).canvas;
      const placements = duplicatePlacements(
        into,
        sources,
        opts.at ? parseXY(opts.at) : undefined,
      );
      // One copy is one act: eight items land as eight ops under one id, and
      // one ⌘Z takes them all back. See `LogEntry.group`.
      const group = newGroupId();
      const made: string[] = [];
      for (const { item, x, y } of placements) {
        const version = item.versions.find((v) => v.id === item.currentVersionId);
        if (!version) continue;
        let blobHash = version.blobHash;
        if (!sameCanvas) {
          // Blobs are addressed per canvas, so the bytes have to be put where
          // the new item will look for them.
          const bytes = await ctx.client.downloadBlob(from.id, version.blobHash);
          const up = await ctx.client.uploadBlob(target.id, bytes, version.mimeType, version.filename);
          blobHash = up.blobHash;
        }
        const itemId = newItemId();
        await sendOp(ctx, target.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash,
            mimeType: version.mimeType,
            filename: version.filename,
            size: version.size,
          },
          width: item.width,
          height: item.height,
          // `--at` chose the spot, so the copies stay where they were put.
          placement: { x, y, ...(opts.at ? { chosen: true } : {}) },
          title: item.title,
          ...(item.description ? { description: item.description } : {}),
          properties: copyProperties(item, { sameCanvas }),
        }, group);
        made.push(itemId);
      }
      if (ctx.json) return printJson({ items: made, canvasId: target.id });
      const where = sameCanvas ? "beside the originals" : `into "${target.title}"`;
      console.log(`copied ${made.length} item${made.length === 1 ? "" : "s"} ${where}`);
      for (const id of made) console.log(`  ${id}`);
    }),
  );

program
  .command("blobs")
  .description("Check that this canvas's bytes reached its home — and send the ones that did not")
  .option("--push", "upload the blobs the home is missing")
  .action(
    run(async (opts: { push?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p } = await canvasAndSnapshot(ctx);
      const report = await ctx.client.reconcileBlobs(p.id, opts.push === true);
      if (ctx.json) return printJson(report);
      if (report.home === null) {
        console.log("this canvas lives here — its bytes are already where they belong");
        return;
      }
      console.log(`home     ${report.home}`);
      console.log(`checked  ${report.checked} blob${report.checked === 1 ? "" : "s"}`);
      if (report.unknown.length > 0) {
        // Never counted as missing and never pushed: a home that cannot be
        // reached has not said these are absent.
        console.log(`unknown  ${report.unknown.length} — the home did not answer about these`);
      }
      if (report.missing.length === 0) {
        console.log("missing  none — every blob this canvas names is at its home");
        return;
      }
      console.log(`missing  ${report.missing.length}`);
      for (const hash of report.missing) console.log(`         ${hash}`);
      if (report.pushed.length > 0) {
        console.log(`pushed   ${report.pushed.length} — re-check to confirm they landed`);
      } else {
        console.log("         `isocan blobs --push` sends them");
      }
    }),
  );

program
  .command("text [words...]")
  .description("Type words onto the canvas as a text node — chromeless, editable, and a real .md")
  // Markdown starts lines with `-`, and so do options, so a bullet typed as
  // an argument is read as a flag. `--` is the shell's own answer to that and
  // works today; `-f -` is the better door for anything with more than one
  // line in it, since arguments join with spaces the way `echo` does.
  .addHelpText(
    "after",
    "\nMulti-line markdown goes in on stdin, where nothing has to be escaped:\n" +
      "  printf '## Standup\\n- shipped\\n' | isocan text -f -\n" +
      "Words are joined with spaces, so a bullet given as an argument needs `--`\n" +
      "first: isocan text -- '- shipped'\n",
  )
  .option("--at <x,y>", "place at world coordinates")
  .option("--anchor <item>", "place to the left of this item")
  .option("--in <area>", "place inside this area, at the first clear spot")
  .option("--size <WxH>", "display size (default: measured from the words)")
  .option("--title <title>", "what it is called (default: its first line)")
  .option("-f, --file <path>", "take the words from a file, or `-` for stdin")
  .option(
    "--style <step>",
    "S | M | L | XL (or body | heading | title | display) — how far out it stays readable",
  )
  .option("--face <face>", "sans | mono | serif")
  .option("--paper <colour>", "yellow | pink | blue | green | grey — a post-it rather than a caption")
  .action(
    run(
      async (
        words: string[],
        opts: {
          at?: string;
          anchor?: string;
          size?: string;
          title?: string;
          file?: string;
          style?: string;
          face?: string;
          paper?: string;
        },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
        /**
         * The same thing the web app's Text tool makes: an ordinary
         * `item.add` whose blob is markdown, marked `kind=text` so both
         * clients draw it as words on the canvas rather than as a card
         * (core/textnode.ts). No new op, and stripping the property leaves an
         * ordinary markdown item rather than something broken.
         *
         * Words as a rest argument so `isocan text ship on friday` works
         * without quoting, which is how anybody types it the first time;
         * `--file -` is the door for a paragraph an agent has already
         * composed, where shell quoting is the enemy.
         */
        const body =
          opts.file !== undefined
            ? (opts.file === "-"
                ? await new Promise<string>((resolve, reject) => {
                    let text = "";
                    process.stdin.setEncoding("utf8");
                    process.stdin.on("data", (chunk) => (text += chunk));
                    process.stdin.on("end", () => resolve(text));
                    process.stdin.on("error", reject);
                  })
                : await fs.readFile(opts.file, "utf8"))
            : words.join(" ");
        if (body.trim() === "") {
          throw new Error("nothing to say — pass words, or --file <path> (or `-` for stdin)");
        }
        await narrate(ctx, p.id, { status: `writing ${truncate(textTitle(body), 24)}…` });
        const upload = await ctx.client.uploadBlob(
          p.id,
          Buffer.from(body, "utf8"),
          TEXT_MIME,
          TEXT_FILENAME,
        );
        // Measured from the words when nobody said otherwise: a note that
        // lands in a default card is a note somebody has to resize before
        // they can read it.
        // The ladder step decides the world size of the words and the column
        // they wrap in; `--size` still overrides the box outright.
        // The bar says S / M / L / XL and the property says body / heading /
        // title / display; both are accepted here, resolved by the one map
        // in core, so what a person read on the screen is a word the
        // terminal takes.
        const style = pickOne(
          "style",
          opts.style === undefined ? undefined : (textStyleFrom(opts.style) ?? opts.style),
          TEXT_STYLES,
          "body",
        );
        const face = pickOne("face", opts.face, TEXT_FACES, "sans");
        /**
         * Paper starts SQUARE rather than measured, and that is the point of
         * it: a post-it will not hold an essay, so it holds an idea. A note
         * measured to its words is a text node with a background — the shape
         * would be doing no work. `--size` still overrides, like everywhere.
         */
        const paper = opts.paper === undefined ? null : pickOne("paper", opts.paper, PAPERS, "yellow");
        const { width, height } = sizeFor(
          opts.size,
          paper === null ? textBox(body, style) : { width: PAPER_SIZE, height: PAPER_SIZE },
        );
        const itemId = newItemId();
        const result = await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType: TEXT_MIME,
            filename: TEXT_FILENAME,
            size: upload.size,
          },
          width,
          height,
          placement: placementFor(snapshot, opts, { width, height }),
          title: opts.title ?? textTitle(body),
          // Defaults are written as ABSENCE, so a plain `isocan text` makes
          // the byte-identical item the web's plain Text tool makes.
          properties: {
            ...TEXT_PROPERTIES,
            ...(style === "body" ? {} : { [TEXT_STYLE_PROP]: style }),
            ...(face === "sans" ? {} : { [TEXT_FACE_PROP]: face }),
            ...(paper === null ? {} : { [PAPER_PROP]: paper }),
          },
        });
        const placed = (result.envelope.op as { placement: { x: number; y: number } }).placement;
        if (ctx.json) return printJson({ itemId, placement: placed, title: opts.title ?? textTitle(body) });
        console.log(`wrote ${itemId} ("${textTitle(body)}") at ${placed.x},${placed.y}`);
      },
    ),
  );

/**
 * **Mind maps: a graph you can drag, from the terminal.**
 *
 * A node is a text item and an edge is a property naming the parent, so every
 * command here is `item.add` or `item.update` — nothing new reaches the wire,
 * and undo, replay and presence work on a map without being told maps exist.
 *
 * The layout is deliberately simple and deliberately here rather than in the
 * daemon's placement: an agent building thirty nodes from one sentence must
 * land something legible, and `nearestFreeSpot`'s ring search knows nothing
 * about which node is whose child. A child goes to the right of its parent and
 * stacks under its siblings, which is a tree somebody can read and then drag
 * into whatever shape they actually wanted.
 */
const MAP_GAP_X = 60;
const MAP_GAP_Y = 24;

function mapNodeSpot(
  snapshot: CanvasSnapshotResponse,
  mapId: string,
  parent: Item,
): { x: number; y: number } {
  const siblings = mapChildren(snapshot.canvas, mapId, parent.id);
  const x = parent.x + parent.width + MAP_GAP_X;
  if (siblings.length === 0) return { x, y: parent.y };
  // Under the lowest sibling, not under the newest: they are ordered by
  // creation and a re-parented node could be anywhere in that list.
  const lowest = siblings.reduce((low, s) => (s.y + s.height > low.y + low.height ? s : low));
  return { x, y: lowest.y + lowest.height + MAP_GAP_Y };
}

/** The map a reference names — an id, or the map a node belongs to, or the
 *  only one there is. Ambiguity is refused rather than guessed. */
function resolveMap(snapshot: CanvasSnapshotResponse, ref?: string): string {
  const maps = mapsOn(snapshot.canvas);
  if (ref) {
    const byId = maps.find((m) => m.id === ref || m.id.startsWith(ref));
    if (byId) return byId.id;
    const byTitle = maps.filter((m) => m.title.toLowerCase().startsWith(ref.toLowerCase()));
    if (byTitle.length === 1) return byTitle[0]!.id;
    if (byTitle.length > 1) {
      throw new Error(
        `"${ref}" matches ${byTitle.length} maps: ${byTitle.map((m) => m.title).join(", ")}`,
      );
    }
    // A node's id names the map it is in, which is how `map add --to <node>`
    // knows which map it is adding to without being told twice.
    const item = snapshot.canvas.items[ref];
    const viaItem = item ? mapOf(item) : null;
    if (viaItem) return viaItem;
    throw new Error(`no map called "${ref}"`);
  }
  if (maps.length === 1) return maps[0]!.id;
  if (maps.length === 0) throw new Error("no maps on this canvas — `isocan map new <title>` starts one");
  throw new Error(
    `which map? ${maps.map((m) => m.title).join(", ")} — name one, or use its id`,
  );
}

async function addMapNode(
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  words: string,
  mapId: string,
  parent: Item | null,
): Promise<{ itemId: string; x: number; y: number }> {
  const upload = await ctx.client.uploadBlob(
    canvasId,
    Buffer.from(words, "utf8"),
    TEXT_MIME,
    TEXT_FILENAME,
  );
  const { width, height } = sizeFor(undefined, textBox(words, "body"));
  const itemId = newItemId();
  const at = parent ? mapNodeSpot(snapshot, mapId, parent) : { x: 0, y: 0 };
  await sendOp(ctx, canvasId, {
    type: "item.add",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: TEXT_MIME,
      filename: TEXT_FILENAME,
      size: upload.size,
    },
    width,
    height,
    placement: at,
    title: textTitle(words),
    properties: {
      ...TEXT_PROPERTIES,
      [MAP_PROP]: mapId,
      ...(parent ? { [MAP_PARENT_PROP]: parent.id } : {}),
    },
  });
  return { itemId, ...at };
}

const map = program.command("map").description("Mind maps: nodes you can drag, links that follow");

map
  .command("new <words...>")
  .description("Start a map with a root node")
  .option("--canvas <canvas>")
  .option("--at <x,y>", "place the root at world coordinates")
  .action(
    run(async (words: string[], opts: { at?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const title = words.join(" ");
      const mapId = newMapId();
      const upload = await ctx.client.uploadBlob(
        p.id,
        Buffer.from(title, "utf8"),
        TEXT_MIME,
        TEXT_FILENAME,
      );
      const { width, height } = sizeFor(undefined, textBox(title, "body"));
      const itemId = newItemId();
      await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: TEXT_MIME,
          filename: TEXT_FILENAME,
          size: upload.size,
        },
        width,
        height,
        placement: placementFor(snapshot, opts),
        title: textTitle(title),
        properties: { ...TEXT_PROPERTIES, [MAP_PROP]: mapId },
      });
      if (ctx.json) return printJson({ mapId, rootId: itemId, title: textTitle(title) });
      console.log(`started ${mapId} with root ${itemId} ("${textTitle(title)}")`);
    }),
  );

map
  .command("add <words...>")
  .description("Add a node under another one")
  .requiredOption("--to <node>", "the parent node")
  .option("--canvas <canvas>")
  .action(
    run(async (words: string[], opts: { to: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const parent = resolveItem(snapshot, opts.to);
      const mapId = mapOf(parent);
      if (mapId === null) {
        throw new Error(
          `"${parent.title}" is not part of a map — \`isocan map new\` starts one, or link it into an existing map`,
        );
      }
      const made = await addMapNode(ctx, p.id, snapshot, words.join(" "), mapId, parent);
      if (ctx.json) return printJson(made);
      console.log(`added ${made.itemId} under "${parent.title}" at ${made.x},${made.y}`);
    }),
  );

map
  .command("link <node> <parent>")
  .description("Hang a node from a different parent — the line follows")
  .option("--canvas <canvas>")
  .action(
    run(async (nodeRef: string, parentRef: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const node = resolveItem(snapshot, nodeRef);
      const parent = resolveItem(snapshot, parentRef);
      if (node.id === parent.id) throw new Error("a node cannot hang from itself");
      const mapId = mapOf(parent);
      if (mapId === null) throw new Error(`"${parent.title}" is not part of a map`);
      // Both properties, because moving a node between maps is the same
      // gesture as re-parenting inside one and a half-moved node would be in
      // one map's set while drawing a line in another's.
      await sendOp(ctx, p.id, {
        type: "item.update",
        itemId: node.id,
        patch: { properties: { ...node.properties, [MAP_PROP]: mapId, [MAP_PARENT_PROP]: parent.id } },
      });
      if (ctx.json) return printJson({ itemId: node.id, parentId: parent.id, mapId });
      console.log(`"${node.title}" now hangs from "${parent.title}"`);
    }),
  );

map
  .command("show [map]")
  .description("Print the map as a tree")
  .option("--canvas <canvas>")
  .action(
    run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const mapId = resolveMap(snapshot, ref);
      const outline = mapOutline(snapshot.canvas, mapId);
      if (ctx.json) return printJson({ mapId, outline });
      console.log(outline);
    }),
  );

map
  .command("tidy [map]")
  .description("Lay the map out as a tree — one column per depth, parents centred on their children")
  .option("--canvas <canvas>")
  .option("--dry-run", "say what would move, and move nothing")
  .action(
    run(async (ref: string | undefined, opts: { dryRun?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const mapId = resolveMap(snapshot, ref);
      const moves = tidyMap(snapshot.canvas, mapId);
      if (ctx.json) return printJson({ mapId, moves });
      if (moves.length === 0) return console.log("already tidy — nothing moved");
      if (opts.dryRun) {
        for (const m of moves) {
          const node = snapshot.canvas.items[m.itemId];
          console.log(`  ${truncate(node?.title ?? m.itemId, 30).padEnd(30)} ${node?.x},${node?.y} → ${m.x},${m.y}`);
        }
        return console.log(`\n${moves.length} would move — run without --dry-run to do it`);
      }
      /**
       * **One op, so it is one undo.** The first thing anybody does after an
       * automatic layout is decide they preferred it before, and a tidy that
       * arrived as forty separate moves would need forty ⌘Zs to take back.
       */
      await sendOp(ctx, p.id, { type: "items.move", moves });
      console.log(`tidied ${moves.length} node${moves.length === 1 ? "" : "s"} — \`isocan undo\` puts them back`);
    }),
  );

map
  .command("ls")
  .description("Every map on this canvas")
  .option("--canvas <canvas>")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const maps = mapsOn(snapshot.canvas);
      if (ctx.json) return printJson(maps);
      if (maps.length === 0) {
        console.log("no maps here — `isocan map new <title>` starts one");
        return;
      }
      for (const m of maps) {
        console.log(`${m.id}  ${m.title} (${m.nodes} node${m.nodes === 1 ? "" : "s"})`);
      }
    }),
  );

program
  .command("browse <url>")
  .description(
    "Put a live site onto the canvas as a mini-browser item — point it at the localhost dev server you're building",
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
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
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
  .command("present <item>")
  .description("Present a view to the room: a main-thread comment carrying the workbench address")
  .option("--say <note>", "a sentence about why, ahead of the address")
  .action(
    run(async (ref: string, opts: { say?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      // A COMMENT, deliberately — an ephemeral "look here" channel was
      // designed for the workbench and rejected in review: everything it did,
      // a comment does better. Durable, attributed, it wakes the room (a
      // main-thread comment summons every parked agent), and "why did my tab
      // end up looking at X" has an answer in the record. The workbench and
      // the canvas both render the address as a link a person clicks — or
      // does not, which is the other half of the design: attention is
      // invited, never taken.
      const origin = (await ctx.homeOf(p.id)) ?? ctx.client.base;
      const address = workbenchUrl(origin, p.id, item.id);
      const body = opts.say ? `${opts.say} — ${address}` : address;
      const main = mainThread(snapshot.canvas);
      if (main) {
        const comment = await newComment(ctx, p.id, snapshot, body);
        await sendOp(ctx, p.id, { type: "thread.reply", threadId: main.id, comment });
        if (ctx.json) return printJson({ threadId: main.id, commentId: comment.id, address });
        console.log(`on the main thread: ${body}`);
      } else {
        // No main thread: the comment lands ON the item instead — a pin on
        // the thing itself is the next most honest place to say "look here".
        const threadId = newThreadId();
        const comment = await newComment(ctx, p.id, snapshot, body);
        await sendOp(ctx, p.id, {
          type: "thread.create",
          threadId,
          x: item.width + 12,
          y: 0,
          anchorItemId: item.id,
          comment,
        });
        if (ctx.json) return printJson({ threadId, commentId: comment.id, address });
        console.log(`pinned to ${item.id}: ${body}`);
      }
    }),
  );

program
  .command("save <items...>")
  .description("Write backed items out to the directory bound to this canvas")
  .option("--force", "overwrite a file that changed on disk outside the canvas")
  .action(
    run(async (refs: string[], opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      /**
       * The other direction from `＋`, and a GESTURE rather than a sync:
       * nothing watches, nothing writes on its own. An agent that has just
       * made a screen decides whether it is a file — `isocan set <item>
       * --file <path>` says where it belongs, this takes it there.
       *
       * The daemon owns every refusal (the jail, and drift), because the
       * daemon is the one with the filesystem. This verb only asks.
       */
      const written: string[] = [];
      for (const ref of refs) {
        const item = resolveItem(snapshot, ref);
        const where = fileOf(item);
        if (!where) {
          throw new Error(
            `"${item.title}" is not backed by a file — \`isocan set ${item.id} --file <path>\` first`,
          );
        }
        const out = await ctx.client.writeItem(p.id, item.id, opts.force ?? false);
        written.push(`${item.title} → ${out.path}`);
      }
      if (ctx.json) return printJson({ written });
      for (const line of written) console.log(line);
    }),
  );

program
  .command("teleport <canvas>")
  .description("Send a canvas to another home — its whole history, and the bytes with it")
  .option("--to <home>", "the home to send it to")
  .option("--dry-run", "say what would move, and move nothing")
  .action(
    run(async (ref: string, opts: { to?: string; dryRun?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const canvas = await resolveCanvas({ ...ctx, canvasRef: ref });
      if (!opts.to) throw new Error("teleport needs somewhere to send it: --to <home url>");
      /**
       * `--dry-run` means what its name means: nothing moves. It is worth
       * having because moving a canvas is not undoable by any gesture this
       * tool has — afterwards the far home holds the log and this one
       * forwards to it — so seeing the shape of the thing first (how many
       * ops, how many blobs, how much of it) is most of the confidence.
       */
      const report = await ctx.client.teleport(canvas.id, opts.to, opts.dryRun === true);
      if (ctx.json) return printJson(report);
      printKeyValues({
        canvas: `${canvas.title} (${canvas.id})`,
        to: report.to,
        history: `${report.entries} operation${report.entries === 1 ? "" : "s"}`,
        bytes: `${report.blobs} blob${report.blobs === 1 ? "" : "s"} (${formatBytes(report.bytes)})`,
      });
      if (!report.moved) {
        console.log("");
        console.log("nothing moved — this was a dry run. Run it again without --dry-run to send it.");
      } else {
        console.log("");
        console.log(`moved. ${canvas.title} lives at ${report.to} now; this daemon forwards to it.`);
      }
      /**
       * Said whether it moved or not, because the answer does not change and
       * somebody deciding whether to move a canvas should know before, not
       * discover after.
       */
      console.log("");
      console.log("what does NOT travel:");
      console.log("  who may enter — invite them again at the new home, and set its link");
      console.log("  names, colours and face marks — those are the old home's, and people");
      console.log("  arrive under whatever name was stamped on their ops");
    }),
  );

program
  .command("tree")
  .description("The directory bound to this canvas, as its home daemon lists it")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      // Owner-scoped by the daemon (loopback, local-home, bound) — this verb
      // only ASKS; the refusal names the remedy. The listing already hides
      // dotfiles, secret shapes and noise directories, so what prints is
      // what the workbench's files pane shows: one derivation, two surfaces.
      // The daemon states the fact; a terminal's remedy is a command, so
      // this surface is the one that names it (the app offers a field).
      const { roots } = await ctx.client.getTree(p.id).catch((err: Error) => {
        throw /no directory is bound/.test(err.message)
          ? new Error(`${err.message} — \`isocan use ${p.id}\` binds this one`)
          : err;
      });
      if (ctx.json) return printJson(roots);
      for (const root of roots) {
        console.log(root.root);
        for (const entry of root.entries) {
          const depth = entry.path.split("/").length - 1;
          const name = entry.path.split("/").pop()!;
          console.log(`${"  ".repeat(depth + 1)}${name}${entry.kind === "dir" ? "/" : ""}`);
        }
        if (root.truncated) console.log("  … truncated — the tree is larger than a listing");
      }
    }),
  );

/**
 * **Areas** — `core/area.ts`: a titled sheet things are placed on, walked
 * to, and read back from. `docs/projects/sprint/journey.md` is why: a
 * sprint is a board of them, one per phase. An area is an ordinary item
 * (`kind=area`) whose title is its name, whose blob is the card that says
 * what happens there, and whose box is the region; membership is geometry,
 * read by `ls --in`, `mv --in`, `format --in`, and `--in` on `text` and
 * `add`. Nothing here is a new op.
 */
const areaCmd = program
  .command("area")
  .description("Areas — titled sheets things are placed on; `--in <area>` on text, add, mv, ls and format");

areaCmd
  .command("new <title...>")
  .description("Lay an area — a titled sheet, to the right of everything unless --at says where")
  .option("--at <x,y>", "place the sheet's top-left at world coordinates")
  .option("--size <WxH>", `the sheet's size (default ${AREA_DEFAULT_SIZE.width}x${AREA_DEFAULT_SIZE.height})`)
  .option("--tint <colour>", "yellow | pink | blue | green | grey — a wash on the sheet")
  .option("--note <text>", "the card: what happens here, in a few lines")
  .action(
    run(
      async (
        words: string[],
        opts: { at?: string; size?: string; tint?: string; note?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const title = words.join(" ").trim();
        if (!title) throw new Error("an area needs a name");
        const tint = opts.tint === undefined ? null : pickOne("tint", opts.tint, PAPERS, "yellow");
        const { width, height } = sizeFor(opts.size, AREA_DEFAULT_SIZE);
        // The card is markdown, like a text node's words: what happens here.
        const card = (opts.note ?? "").trim();
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(card, "utf8"), AREA_MIME, AREA_FILENAME);
        /**
         * Where a sheet goes by default: to the RIGHT of everything, level
         * with the top of it — a new region beside the work, never over it.
         * `--at` is a chosen spot; this one is chosen too, because the
         * corner of a sheet is exactly where somebody meant it to be and a
         * sheet nudged by the tidy rule would land its contents somewhere
         * else on every replay.
         */
        const all = Object.values(snapshot.canvas.items);
        const right = all.length === 0 ? 0 : Math.max(...all.map((one) => one.x + one.width)) + PLACEMENT_GAP;
        const top = all.length === 0 ? 0 : Math.min(...all.map((one) => one.y));
        const placement: Placement = opts.at
          ? { ...parseXY(opts.at), chosen: true }
          : { x: right, y: top, chosen: true };
        const itemId = newItemId();
        await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType: AREA_MIME,
            filename: AREA_FILENAME,
            size: upload.size,
          },
          width,
          height,
          placement,
          title,
          properties: { ...AREA_PROPERTIES, ...(tint === null ? {} : { [AREA_TINT_PROP]: tint }) },
        });
        if (ctx.json) return printJson({ itemId, title, placement, width, height });
        console.log(`laid "${title}" (${itemId}) at ${"x" in placement ? `${placement.x},${placement.y}` : "?"}, ${width}x${height}`);
      },
    ),
  );

areaCmd
  .command("ls", { isDefault: true })
  .description("The areas, in reading order, and how much each holds")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await canvasAndSnapshot(ctx);
      const areas = areasOf(snapshot.canvas);
      const rows = areas.map((area) => ({
        id: area.id,
        title: area.title,
        holds: String(itemsIn(snapshot.canvas, area).length),
        pos: `${area.x},${area.y}`,
        size: `${area.width}x${area.height}`,
        tint: area.properties[AREA_TINT_PROP] ?? "",
      }));
      if (ctx.json) return printJson(rows);
      if (rows.length === 0) return console.log("no areas here — `isocan area new <title>` lays one");
      printTable(rows);
    }),
  );

program
  .command("ls")
  .description("List items on the canvas")
  .option("--kind <kind>", `only this kind: ${ITEM_KINDS.join(", ")}`)
  .option("--filter <text>", "only items whose title or filename contains this")
  .option("--reaction <emoji>", "only items wearing this mark")
  .option("--in <area>", "only what is inside this area (by its centre)")
  .action(
    run(async (opts: { kind?: string; filter?: string; reaction?: string; in?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      await narrate(ctx, p.id, { status: "surveying the canvas…" });
      if (opts.kind && !ITEM_KINDS.includes(opts.kind as never)) {
        throw new Error(`--kind expects one of ${ITEM_KINDS.join(", ")}, got: ${opts.kind}`);
      }
      const needle = opts.filter?.trim().toLowerCase();
      // `--in`: membership is geometry, read now — the same answer the app
      // gives when it drags a sheet and takes its contents along.
      const area = opts.in === undefined ? null : findArea(snapshot.canvas, opts.in);
      if (opts.in !== undefined && !area) {
        throw new Error(`no area called "${opts.in}" — \`isocan area ls\` names them`);
      }
      const held = area ? new Set(itemsIn(snapshot.canvas, area).map((one) => one.id)) : null;
      // The same two questions the web's files panel answers, so a canvas
      // reads the same way from either side.
      const items = Object.values(snapshot.canvas.items).filter((item) => {
        if (held && !held.has(item.id)) return false;
        if (opts.reaction && !(item.reactions?.[opts.reaction]?.length)) return false;
        if (opts.kind && itemKind(item) !== opts.kind) return false;
        if (!needle) return true;
        const current = item.versions.find((v) => v.id === item.currentVersionId);
        return (
          item.title.toLowerCase().includes(needle) ||
          (current?.filename ?? "").toLowerCase().includes(needle)
        );
      });
      if (ctx.json) return printJson(items.map((item) => ({ ...item, kind: itemKind(item) })));
      printTable(
        items.map((i) => ({
          id: i.id,
          // The marks it wears, ahead of the name — the same thing the bar
          // groups by, in the place a star used to sit.
          title: `${Object.keys(i.reactions ?? {}).join("")}${
            i.reactions ? " " : ""
          }${truncate(i.title, 22)}`,
          kind: itemKind(i),
          file: truncate(i.versions.find((v) => v.id === i.currentVersionId)?.filename ?? "?", 22),
          pos: `${i.x},${i.y}`,
          size: `${i.width}x${i.height}`,
          vers: String(i.versions.length),
          "updated by": actorNameIn(snapshot.names, i.updatedBy),
        })),
      );
    }),
  );

program
  .command("get <item> [out]")
  .description("Write an item's file to a path, or to stdout — reading is half of acting")
  // NOT --version: that is the program's own flag, and a subcommand that
  // borrows it prints the CLI's version instead of your file.
  .option("--rev <ref>", "a version id or its number in the stack (default: the current one)")
  .action(
    run(async (ref: string, out: string | undefined, opts: { rev?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      const version =
        opts.rev === undefined
          ? item.versions.find((v) => v.id === item.currentVersionId)
          : item.versions.find((v) => v.id === opts.rev) ?? item.versions[Number(opts.rev) - 1];
      if (!version) throw new Error(`no version ${opts.rev} on ${item.id}`);
      const data = await ctx.client.downloadBlob(p.id, version.blobHash);
      if (out) {
        await fs.writeFile(out, data);
        if (ctx.json) return printJson({ itemId: item.id, versionId: version.id, path: out, bytes: data.length });
        return console.log(`wrote ${out} (${formatBytes(data.length)} — ${version.filename})`);
      }
      // No path: the bytes themselves, so it pipes.
      process.stdout.write(data);
    }),
  );

program
  .command("show <item>")
  .description("Show an item's full metadata and version stack")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
        created: `${item.createdAt} by ${actorNameIn(snapshot.names, item.createdBy)}`,
        updated: `${item.updatedAt} by ${actorNameIn(snapshot.names, item.updatedBy)}`,
      });
    }),
  );

program
  .command("mv <item> [x] [y]")
  .description("Move an item — to x y, or by a delta with --by")
  .option("--by <dx,dy>", "move relative to where it is now, e.g. --by 0,-40")
  .option("--in <area>", "move it into this area, at the first clear spot")
  .allowUnknownOption() // lets negative coordinates through: isocan mv itm -80 420
  .action(
    run(
      async (
        ref: string,
        x: string | undefined,
        y: string | undefined,
        opts: { by?: string; in?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const item = resolveItem(snapshot, ref);
        // `--in`: the sheet's first clear spot, the search not counting the
        // item itself as in the way.
        const into = opts.in === undefined ? null : findArea(snapshot.canvas, opts.in);
        if (opts.in !== undefined && !into) {
          throw new Error(`no area called "${opts.in}" — \`isocan area ls\` names them`);
        }
        const without = { ...snapshot.canvas, items: { ...snapshot.canvas.items } };
        delete without.items[item.id];
        // Relative is what an agent usually means: nudging a thing clear of a
        // neighbour, the same gesture the arrow keys make in the web app.
        const target =
          into !== null
            ? freeSpotIn(without, into, item.width, item.height)
            : opts.by !== undefined
            ? (() => {
                const delta = parseXY(opts.by);
                return { x: item.x + delta.x, y: item.y + delta.y };
              })()
            : (() => {
                if (x === undefined || y === undefined) {
                  throw new Error("give x and y, or a delta with --by");
                }
                // `allowUnknownOption` is what lets `mv itm -80 420` through
                // with a negative x — and the same permission hands us the
                // FLAG as an operand when somebody writes `mv itm --to 300,200`
                // (an invention: the coordinates are positional). Unchecked,
                // `Number("--to")` is NaN, and NaN serializes to null, so the
                // item's position was permanently `null,null`. Say what was
                // wrong with what they typed.
                const at = { x: Number(x), y: Number(y) };
                if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) {
                  const bad = [!Number.isFinite(at.x) ? x : null, !Number.isFinite(at.y) ? y : null]
                    .filter((one) => one !== null)
                    .join(" ");
                  throw new Error(
                    `x and y are positional numbers, e.g. \`isocan mv <item> 300 200\` — got: ${bad}`,
                  );
                }
                return at;
              })();
        // What is drawn on a thing travels with it — the same rule the web app's
        // drag follows, so a move from either side keeps the marks in place.
        const dx = target.x - item.x;
        const dy = target.y - item.y;
        const marks = annotationsOf(snapshot.canvas, item.id);
        const moves = [
          { itemId: item.id, ...target },
          ...marks.map((mark) => ({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy })),
        ];
        await sendOp(
          ctx,
          p.id,
          moves.length === 1 ? { type: "item.move", ...moves[0]! } : { type: "items.move", moves },
        );
        console.log(
          `moved ${item.id} to ${target.x},${target.y}` +
            (marks.length > 0 ? ` (with ${marks.length} annotation${marks.length === 1 ? "" : "s"})` : ""),
        );
      },
    ),
  );

/** Send a tidy as ONE op, so undo takes the whole gesture back. */
async function applyMoves(
  ctx: Ctx,
  canvasId: string,
  moves: Array<{ itemId: string; x: number; y: number }>,
  done: string,
): Promise<void> {
  if (moves.length === 0) {
    console.log("already there — nothing moved");
    return;
  }
  await sendOp(
    ctx,
    canvasId,
    moves.length === 1 ? { type: "item.move", ...moves[0]! } : { type: "items.move", moves },
  );
  console.log(done);
}

program
  .command("react <emoji> <items...>")
  .description(
    "Wear an emoji on items — the same marks the canvas shows as chips; --off takes yours back",
  )
  .option("--off", "take your reaction back")
  .option("--who", "say who else is wearing it, rather than the count")
  .action(
    run(async (emoji: string, refs: string[], opts: { off?: boolean; who?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      // Reactions store ids and nothing else, so a name has to be looked up
      // NOW — which is the point: a rename reaches what somebody reacted to
      // before it (`lib/names.ts`, and the same rule mentions live by).
      const names = opts.who ? await ctx.client.actorNames() : undefined;
      const lines: string[] = [];
      for (const item of items) {
        // The op says what should be TRUE, not "flip it" — so running this
        // twice is not a way to react twice, and the inverse is exact.
        await sendOp(ctx, p.id, {
          type: "item.react",
          itemId: item.id,
          emoji,
          on: !opts.off,
        });
        const worn = (item.reactions?.[emoji] ?? []).filter((id) => id !== ctx.actor.id);
        const after = opts.off ? worn : [...worn, ctx.actor.id];
        lines.push(
          opts.who
            ? `${emoji} ${item.title} — ${after.length === 0 ? "nobody" : after.map((id) => names?.[id] ?? id).join(", ")}`
            : `${emoji} ${item.title} — ${after.length}`,
        );
      }
      if (ctx.json) {
        return printJson(
          items.map((item) => ({ itemId: item.id, emoji, on: !opts.off })),
        );
      }
      for (const line of lines) console.log(line);
    }),
  );

program
  .command("align <items...>")
  .description("Line items up on an edge — what the canvas's guides do, as a verb")
  .requiredOption(
    "--to <edge>",
    `left | hcenter | right | top | vcenter | bottom`,
  )
  .action(
    run(async (refs: string[], opts: { to: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const edge = opts.to.toLowerCase();
      if (!ALIGN_EDGES.includes(edge as never)) {
        throw new Error(`--to expects one of ${ALIGN_EDGES.join(", ")}, got: ${opts.to}`);
      }
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      const moves = alignMoves(items, edge as never);
      await applyMoves(ctx, p.id, moves, `aligned ${items.length} items to ${edge}`);
    }),
  );

program
  .command("fit <items...>")
  .description("Grow items to the size their content wants, and settle them so nothing overlaps")
  .option("--size <WxH>", "the size to grow to, when the file cannot say")
  .action(
    run(async (refs: string[], opts: { size?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      const asked = opts.size ? sizeFor(opts.size, { width: 0, height: 0 }) : null;

      const targets: FitTarget[] = [];
      const unmeasurable: string[] = [];
      for (const item of items) {
        if (asked) {
          targets.push({ itemId: item.id, ...asked });
          continue;
        }
        // What the file itself says. An SVG carries a viewBox and a PNG or
        // JPEG carries its dimensions in the header; an HTML page carries
        // nothing, because its size is whatever a browser decides when it lays
        // it out. So the CLI asks for one rather than inventing it.
        const size = await intrinsicSize(ctx, p.id, item);
        if (size) targets.push({ itemId: item.id, ...size });
        else unmeasurable.push(item.title || item.id);
      }
      if (unmeasurable.length > 0 && targets.length === 0) {
        throw new Error(
          `only a browser can measure a page: pass --size WxH for ${unmeasurable.join(", ")} ` +
            `(or press Shift F on the canvas, which measures it)`,
        );
      }
      const { resizes, moves } = fitMoves(snapshot.canvas, targets);
      for (const r of resizes) {
        await sendOp(ctx, p.id, { type: "item.resize", itemId: r.itemId, width: r.width, height: r.height });
      }
      if (moves.length > 0) await applyMoves(ctx, p.id, moves, `fitted ${targets.length} items`);
      else console.log(`fitted ${targets.length} items`);
      for (const name of unmeasurable) {
        console.log(`  skipped ${name} — only a browser can measure a page; pass --size`);
      }
    }),
  );

program
  .command("distribute <items...>")
  .description("Even out the gaps between items — the canvas's spacing measures, as a verb")
  .requiredOption("--axis <h|v>", "h across, v down")
  .action(
    run(async (refs: string[], opts: { axis: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const axis = opts.axis.toLowerCase();
      if (axis !== "h" && axis !== "v") throw new Error(`--axis expects h or v, got: ${opts.axis}`);
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      const moves = distributeMoves(items, axis);
      await applyMoves(ctx, p.id, moves, `spaced ${items.length} items ${axis === "h" ? "across" : "down"}`);
    }),
  );

program
  .command("merge <items...>")
  .description("Several drawings into one — what holding P does, as a verb")
  .option("--title <title>", "name for the merged drawing")
  .option("--keep", "leave the originals on the canvas instead of trashing them")
  .action(
    run(async (refs: string[], opts: { title?: string; keep?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      if (refs.length < 2) throw new Error("merge wants at least two drawings");
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      const notInk = items.filter((item) => !isDrawingItem(item));
      if (notInk.length > 0) {
        throw new Error(
          `not ink: ${notInk.map((i) => i.title).join(", ")} — merge is for drawings (isocan ls --kind drawing)`,
        );
      }

      // Read every part before writing anything: a merge that half-happens
      // leaves a canvas nobody can put back by hand.
      const parts = [];
      for (const item of items) {
        const version = item.versions.find((v) => v.id === item.currentVersionId);
        if (!version) throw new Error(`${item.title} has no current version`);
        const blob = await ctx.client.downloadBlob(p.id, version.blobHash);
        parts.push({ id: item.title, svg: blob.toString("utf8") });
      }
      const { svg, bounds } = mergeDrawings(parts);

      await narrate(ctx, p.id, { status: `merging ${items.length} drawings…` });
      const upload = await ctx.client.uploadBlob(
        p.id,
        Buffer.from(svg, "utf8"),
        DRAWING_MIME,
        DRAWING_FILENAME,
      );
      const itemId = newItemId();
      // Whole world units, the way the Pen places ink: the item box and the
      // SVG viewBox must be the same box or the strokes land somewhere else.
      const x = Math.floor(bounds.minX);
      const y = Math.floor(bounds.minY);
      await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: DRAWING_MIME,
          filename: DRAWING_FILENAME,
          size: upload.size,
        },
        width: Math.ceil(bounds.maxX) - x,
        height: Math.ceil(bounds.maxY) - y,
        // Not `chosen`: ink is where the pen drew it, meaningful by kind
        // (`positionIsMeaningful`), so it needs no flag to stay put.
        placement: { x, y },
        title: opts.title ?? DRAWING_TITLE,
        properties: DRAWING_PROPERTIES,
      });
      // Two ops, so two undos — said out loud rather than discovered. The
      // originals go to the TRASH, not the void: a merge you disagree with is
      // one `isocan restore` from being reversed.
      if (!opts.keep) {
        await sendOp(ctx, p.id, { type: "items.delete", itemIds: items.map((i) => i.id) });
      }
      if (ctx.json) return printJson({ itemId, merged: items.map((i) => i.id) });
      console.error(
        `${itemId} — ${items.length} drawings in one` +
          (opts.keep ? " (originals kept)" : `, originals in the trash (isocan restore ${items[0]!.id})`) +
          (opts.keep ? "" : "\nthat was two ops: undo twice to put it all back"),
      );
    }),
  );

program
  .command("shortcuts")
  .description("Every key the canvas answers to — the same list the app's ? panel shows")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      // The list is core's, not the app's: an agent telling somebody which key
      // to press must be reading the same page they are looking at.
      if (ctx.json) return printJson(SHORTCUTS);
      console.log(shortcutsAsText());
    }),
  );

program
  .command("format [mode]")
  .description("Tidy the canvas — `grid` straightens the lines (default), `smart` reads it")
  .option("--dry-run", "say what would move, move nothing")
  .option("--per-row <n>", "how many per row")
  .option("--in <area>", "tidy only what is inside this area, within it")
  .action(
    run(async (mode: string | undefined, opts: { dryRun?: boolean; perRow?: string; in?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const perRow = opts.perRow === undefined ? undefined : Number(opts.perRow);
      /**
       * `--in <area>`: the same arrangement over the sheet's contents only,
       * starting at the sheet's inner corner — a wall formatted as a wall.
       * The rest of the canvas is not in the fold, so it does not move.
       */
      const area = opts.in === undefined ? null : findArea(snapshot.canvas, opts.in);
      if (opts.in !== undefined && !area) {
        throw new Error(`no area called "${opts.in}" — \`isocan area ls\` names them`);
      }
      const scope = area
        ? {
            ...snapshot.canvas,
            items: Object.fromEntries(itemsIn(snapshot.canvas, area).map((one) => [one.id, one])),
          }
        : snapshot.canvas;
      const origin = area ? { x: areaInner(area).x, y: areaInner(area).y } : undefined;
      if (perRow !== undefined && (!Number.isFinite(perRow) || perRow < 1)) {
        throw new Error(`--per-row wants a number: ${opts.perRow}`);
      }
      /**
       * **A bare `format` is a `grid`**, which is the arrangement that reads
       * nothing into the canvas. `smart` interprets — lineage, kinds, what
       * belongs under what — and moving somebody's work on an interpretation
       * should be asked for by name.
       */
      if (mode !== undefined && !isFormatMode(mode)) {
        throw new Error(`not a format: ${mode} — ${FORMAT_MODES.join(", ")}`);
      }
      const chosen: FormatMode | undefined = mode;
      const moves = formatMoves(scope, {
        ...(chosen ? { mode: chosen } : {}),
        ...(perRow === undefined ? {} : { perRow }),
        ...(origin ? { origin } : {}),
      });
      if (opts.dryRun) {
        if (ctx.json) return printJson(moves);
        if (moves.length === 0) return console.error("already formatted — nothing would move");
        return printTable(
          moves.map((m) => ({
            item: m.itemId,
            title: truncate(snapshot.canvas.items[m.itemId]?.title ?? "?", 28),
            from: `${snapshot.canvas.items[m.itemId]?.x},${snapshot.canvas.items[m.itemId]?.y}`,
            to: `${m.x},${m.y}`,
          })),
        );
      }
      // One items.move, so the whole tidy is one undo. A tidy you cannot take
      // back in one press is a tidy nobody dares run.
      await applyMoves(ctx, p.id, moves, `formatted ${moves.length} items`);
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
  .option(
    "--file <path>",
    "back this item with a file at <path>, relative to the bound directory (--file '' unbacks it)",
  )
  .option(
    "--keep-filename",
    "rename the item but leave the file under its old name (default: the file follows the title)",
  )
  .action(
    run(
      async (
        ref: string,
        opts: {
          title?: string;
          description?: string;
          prop: Record<string, string>;
          rmProp: string[];
          size?: string;
          keepFilename?: boolean;
          file?: string;
        },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const item = resolveItem(snapshot, ref);
        const patch = metaPatch(opts);
        /**
         * **Where this item belongs on disk** — a canvas fact, so it rides
         * as a property on the same op every other property rides
         * (`docs/projects/workbench/files-on-disk.md`). `--file ''` unbacks
         * it: the item stays, it simply stops claiming a place.
         *
         * Nothing is written here. Backing an item says where it goes;
         * `isocan save` is the gesture that takes it there, and keeping the
         * two apart is the whole point — an agent decides for itself whether
         * a screen it just made is a file.
         */
        if (opts.file !== undefined) {
          if (opts.file.trim() === "") {
            patch.removeProperties = [...(patch.removeProperties ?? []), FILE_PROP];
          } else {
            const clean = cleanFilePath(opts.file);
            if (!clean) {
              throw new Error(
                `${opts.file} is not a path this canvas can name — relative to the bound directory, no dot segments`,
              );
            }
            patch.properties = { ...(patch.properties ?? {}), [FILE_PROP]: clean };
          }
        }
        let did = false;
        if (Object.keys(patch).length > 0) {
          // Renaming an item renames its file — the same act the web app
          // performs, through the same op, or the two would disagree about
          // what `isocan get` hands you after a rename.
          const current = item.versions.find((v) => v.id === item.currentVersionId);
          const filename =
            opts.title !== undefined && !opts.keepFilename && current
              ? renamedFilename(snapshot.canvas, item.id, opts.title, current.filename)
              : undefined;
          await sendOp(ctx, p.id, {
            type: "item.update",
            itemId: item.id,
            patch,
            ...(filename && filename !== current?.filename ? { filename } : {}),
          });
          if (filename && filename !== current?.filename) {
            console.log(`file renamed to ${filename}`);
          }
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
          created: `${v.createdAt} by ${actorNameIn(snapshot.names, v.createdBy)}`,
        })),
      );
    }),
  );

const version = program.command("version").description("Version operations");
version
  .command("promote <item> <versionId>")
  .description("Bring a version to the top of the stack — `get` follows it; the disk does not")
  .action(
    run(async (ref: string, versionId: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      /**
       * **Promoting moves the canvas and not the disk**, and a backed item is
       * the one place that difference bites: `get` follows the stack, the file
       * in the tree keeps whatever was last written there, and an agent
       * reading the path instead of the item works from the version the human
       * just set aside. Nothing writes a file on its own, so the honest thing
       * is to say which command would.
       */
      const backed = fileOf(item);
      if (backed) {
        console.log(`  ${backed} still holds whatever was last written — isocan save ${item.id}`);
      }
    }),
  );

program
  .command("rm <items...>")
  .description("Delete item(s) to the trash — several at once is one undo step")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveTrashed(snapshot, ref).item.id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.restore", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.restore", itemIds: ids });
      }
      console.log(`restored ${ids.join(", ")}`);
    }),
  );

/** Everything on stdin — how a command body arrives from a pipe. */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

program
  .command("choose <item>")
  .description("This one won: fold a variation back onto what it was made from")
  .option("--canvas <canvas>")
  .option("--dry-run", "say what it would do, and do nothing")
  .action(
    run(async (ref: string, opts: { dryRun?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const chosen = resolveItem(snapshot, ref);
      const plan = convergePlan(snapshot.canvas, chosen.id);
      if (isRefusal(plan)) throw new Error(plan.refused);

      const parent = snapshot.canvas.items[plan.parentId]!;
      const losing = plan.trash.filter((id) => id !== chosen.id).length;
      if (opts.dryRun) {
        if (ctx.json) return printJson(plan);
        console.log(
          `"${chosen.title}" would become v${parent.versions.length + 1} of "${parent.title}", ` +
            `and ${plan.trash.length} item${plan.trash.length === 1 ? "" : "s"} would go to the trash`,
        );
        return;
      }

      /**
       * **One group, so the decision undoes as a decision.**
       *
       * The research that asked for this wanted a composite op with a
       * computed inverse. Op grouping landed since and does the same job out
       * of ops that already exist and already replay: one `⌘Z` takes the
       * version back off the parent AND brings every child out of the trash,
       * because they share a group and undo walks the contiguous run.
       *
       * The group is an ID, not a name: grouping matches by string equality,
       * so two decisions sharing a human label and landing next to each other
       * would merge into one undo. What records the decision is the version
       * on the source and the named children in the trash.
       */
      const group = newGroupId();
      await sendOp(
        ctx,
        p.id,
        { type: "item.addVersion", itemId: plan.parentId, version: plan.version },
        group,
      );
      for (const id of plan.trash) {
        await sendOp(ctx, p.id, { type: "item.delete", itemId: id }, group);
      }

      if (ctx.json) {
        return printJson({ parentId: plan.parentId, trashed: plan.trash, label: plan.label });
      }
      console.error(
        `"${chosen.title}" is v${parent.versions.length + 1} of "${parent.title}"` +
          (losing > 0 ? `, and ${losing} other${losing === 1 ? "" : "s"} went to the trash` : "") +
          " — one undo takes it all back",
      );
    }),
  );

// ---------- what an agent will read ----------

/**
 * **The personas this directory holds** — `.agents/personas/*.md`.
 *
 * A directory rather than a canvas, deliberately and for now: a persona file
 * is what a harness reads at the moment it starts, with no daemon, no badge
 * and no network. `docs/projects/personas/design.md` stages the canvas last
 * for exactly that reason. The parsing is core's, so this listing and the
 * app's panel cannot disagree about what a persona says.
 */
async function personaFiles(root: string): Promise<Array<{ file: string; persona: Persona }>> {
  const dir = path.join(root, PERSONA_DIR);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out: Array<{ file: string; persona: Persona }> = [];
  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    const text = await fs.readFile(path.join(dir, name), "utf8").catch(() => null);
    if (text === null) continue;
    const persona = parsePersona(text, name);
    // A README beside the personas is a README, not a broken persona.
    if (persona) out.push({ file: path.join(PERSONA_DIR, name), persona });
  }
  return out;
}

/** Where personas live for THIS invocation: the bound directory when there is
 *  one, otherwise the cwd — so `isocan persona ls` works in a checkout that
 *  has never been bound to a canvas. */
async function personaRoot(ctx: Ctx): Promise<string> {
  return ctx.binding?.root ?? process.cwd();
}

const persona = program
  .command("persona")
  .description("The roles an agent can take on here — `.agents/personas/`");

persona
  .command("ls", { isDefault: true })
  .description("Every persona in this directory, and what it is judged on")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const root = await personaRoot(ctx);
      const found = await personaFiles(root);
      if (found.length === 0) {
        console.log(
          `no personas here — a persona is a file in ${PERSONA_DIR}/, ` +
            "and `isocan persona show <name>` prints one",
        );
        return;
      }
      if (ctx.json) {
        console.log(JSON.stringify(found.map((f) => ({ ...f.persona, file: f.file })), null, 2));
        return;
      }
      for (const { persona: p } of found) {
        console.log(`${p.name}  ${p.description}`);
        for (const goal of p.goals) console.log(`  · ${goalLine(goal)}`);
        // **The warnings are printed with the persona, not behind a flag.** A
        // persona that cannot fail is the thing this feature exists to make
        // impossible, and it is invisible unless somebody says so where it is
        // read.
        for (const warning of personaWarnings(p)) console.log(`  ! ${warning}`);
      }
    }),
  );

persona
  .command("show <name>")
  .description("One persona in full — its goals, its trigger, and its lens")
  .action(
    run(async (name: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const root = await personaRoot(ctx);
      const found = await personaFiles(root);
      const match =
        found.find((f) => f.persona.name === name) ??
        found.find((f) => f.persona.name.startsWith(name));
      if (!match) {
        throw new Error(
          found.length === 0
            ? `no personas here — nothing in ${PERSONA_DIR}/`
            : `no persona called "${name}" — there is ${found.map((f) => f.persona.name).join(", ")}`,
        );
      }
      const p = match.persona;
      if (ctx.json) {
        console.log(JSON.stringify({ ...p, file: match.file }, null, 2));
        return;
      }
      console.log(`${p.name} — ${p.description}`);
      console.log(`  file      ${match.file}`);
      if (p.model) console.log(`  model     ${p.model}${p.effort ? ` · ${p.effort}` : ""}`);
      if (p.tools.length) console.log(`  tools     ${p.tools.join(", ")}`);
      console.log(
        `  trigger   ${
          p.trigger.kind === "schedule"
            ? p.trigger.cron
            : p.trigger.kind === "push"
              ? `push to ${p.trigger.to}${p.trigger.paths ? ` (${p.trigger.paths.join(", ")})` : ""}`
              : "manual — somebody has to run it"
        }`,
      );
      if (p.runs) console.log(`  runs      ${p.runs}`);
      console.log(p.goals.length ? "  judged on" : "  judged on nothing yet");
      for (const goal of p.goals) console.log(`    · ${goalLine(goal)}\n      ${goal.measuredBy}`);
      for (const warning of personaWarnings(p)) console.log(`  ! ${warning}`);
    }),
  );

persona
  .command("runs <name>")
  .description("What this persona's runs found, and what was decided about each")
  .action(
    run(async (name: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const root = await personaRoot(ctx);
      const found = await personaFiles(root);
      const match =
        found.find((f) => f.persona.name === name) ??
        found.find((f) => f.persona.name.startsWith(name));
      if (!match) throw new Error(`no persona called "${name}"`);
      const dir = path.join(root, match.persona.runs ?? "docs/reviews/");
      const names = (await fs.readdir(dir).catch(() => [] as string[]))
        .filter((f) => f.endsWith(`-${match.persona.name}.md`))
        .sort()
        .reverse();
      const runs: Array<{ page: string; findings: RunFinding[] }> = [];
      for (const file of names) {
        const page = await fs.readFile(path.join(dir, file), "utf8").catch(() => null);
        if (page !== null) runs.push({ page: file, findings: runFindings(page) });
      }
      if (ctx.json) return console.log(JSON.stringify(runs, null, 2));
      if (runs.length === 0) {
        return console.log(`no runs yet — \`node scripts/persona-run.mjs ${match.persona.name}\``);
      }
      for (const r of runs) {
        console.log(r.page);
        for (const f of r.findings) console.log(`  ${f.outcome.padEnd(11)} ${f.finding}`);
        if (r.findings.length === 0) console.log("  nothing found");
      }
      /**
       * **The tally, and no ratio.** An accept rate over five findings is
       * noise, and a trust score that governs autonomy before it means
       * anything is a way to lose trust in trust. The numbers are here from
       * the first run; what to make of them waits until there are enough to
       * argue about.
       */
      const tally = tallyOutcomes(runs.flatMap((r) => r.findings));
      console.log(
        `\n${tally.accepted} accepted · ${tally.rejected} rejected · ${tally.unanswered} unanswered`,
      );
    }),
  );

/**
 * **Everything addressed to you, wherever it landed.**
 *
 * `docs/research/2026-08-29-the-inbox.md`. The rule is `inboxOn` in core —
 * the same one `isocan wait` has used for weeks to decide whether a comment is
 * for the agent, moved so the person gets the identical answer rather than a
 * second one written later.
 *
 * **A list, not a count.** Read state lives in the browser's `localStorage`
 * per canvas per actor, so a count here would either be wrong or would need a
 * durable read marker — an operation, and one whose cheap form the research
 * recommends designing before anybody writes it. Until then this says what
 * exists and lets you decide what is new.
 */
/**
 * **Where a document stands**, read out of its own front matter.
 *
 * Exists so `scripts/roadmap.mjs` has ONE reader — core's `docStatus` — rather
 * than a second little parser of its own, which is exactly how the roadmap
 * would come to disagree with the docs it is a view of. That disagreement is
 * the bug the whole arrangement exists to fix: on the day it was written,
 * `2026-08-26-attaching-a-directory.md` held two contradictory verdicts, both
 * dated the same day.
 */
const doc = program.command("doc").description("What this repo's own documents say about themselves");

doc
  .command("status <file>")
  .description("Where one document stands, and what is wrong with how it says so")
  .action(
    run(async (file: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const text = await fs.readFile(path.resolve(process.cwd(), file), "utf8");
      const status = docStatus(text);
      const problems = statusProblems(status);
      if (ctx.json) return printJson({ ...status, problems });
      console.log(`${status.status}${status.since ? ` since ${status.since}` : ""}`);
      if (status.note) console.log(`  ${status.note}`);
      if (status.blockedBy) console.log(`  blocked by ${status.blockedBy}`);
      if (status.supersededBy) console.log(`  superseded by ${status.supersededBy}`);
      if (status.see.length) console.log(`  see ${status.see.join(", ")}`);
      for (const problem of problems) console.log(`  ! ${problem}`);
    }),
  );

/**
 * **Export this canvas to JSON Canvas** — jsoncanvas.org, the open format
 * Obsidian and others read. `docs/research/json-canvas.md` costed it and
 * recommended export first; `toJsonCanvas` in core is the mapping.
 *
 * **Export only.** Import is not here and is not next: the format carries no
 * versions, no threads, no actors, no properties and no oplog, so reading one
 * in would mint a canvas whose history begins at import. Pretending a round
 * trip exists is how somebody loses work.
 */
program
  .command("export <file>")
  .description("Write this canvas as JSON Canvas (jsoncanvas.org)")
  .option("--canvas <canvas>", "which canvas")
  .action(
    run(async (file: string, opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      /**
       * A site item's URL lives in its BYTES, not in the version record, so
       * core cannot reach it — the resolver is what turns those items into
       * real `link` nodes instead of files. Fetched only for the handful of
       * `text/uri-list` items rather than for the whole canvas: an export that
       * downloads every blob to read four of them is a slow export.
       */
      const bodies = new Map<string, string>();
      for (const item of Object.values(snapshot.canvas.items)) {
        const v = item.versions.find((x) => x.id === item.currentVersionId);
        if (v?.mimeType !== BROWSER_MIME) continue;
        const bytes = await ctx.client.downloadBlob(p.id, v.blobHash).catch(() => null);
        if (bytes) bodies.set(item.id, bytes.toString("utf8"));
      }
      const { file: out, lost } = toJsonCanvas(snapshot.canvas, {
        bodyOf: (item) => bodies.get(item.id) ?? null,
      });
      await fs.writeFile(path.resolve(process.cwd(), file), JSON.stringify(out, null, 2) + "\n");
      if (ctx.json) return printJson({ file, nodes: out.nodes.length, edges: out.edges.length, lost });
      console.log(`${file} — ${out.nodes.length} nodes, ${out.edges.length} edges`);
      /**
       * **What did not cross, said out loud.** An export that quietly drops
       * half a canvas is the worst kind of success: it looks like a backup.
       */
      const losses = describeLosses(lost);
      if (losses.length) {
        console.log(`the format has no room for ${losses.join(", ")} — this is not a backup`);
      }
    }),
  );

program
  .command("inbox")
  .description("Comments addressed to you, across every canvas here")
  .option("--canvas <canvas>", "just this one")
  .option("--mentions", "only where somebody named you — not the Chat, not threads you are in")
  .option("-n, --limit <n>", "how many to show (default 20)")
  .action(
    run(async (opts: { canvas?: string; mentions?: boolean; limit?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const canvases = opts.canvas
        ? [await resolveCanvas({ ...ctx, canvasRef: opts.canvas })]
        : await ctx.client.listCanvases();
      /**
       * The names you answer to include the label this session is wearing —
       * an agent called "Percy" this run is @Percy to everybody on the canvas,
       * and `wait` has always looked for both.
       */
      const session = await readSessionFile(ctx.home, ctx.actor.id).catch(() => null);
      const names = namesFor(ctx.actor, session?.label ?? null);
      const entries: InboxEntry[] = [];
      for (const canvas of canvases) {
        // One canvas failing to answer must not silence the rest: an inbox
        // that goes empty because a replica is unreachable is an inbox that
        // lies in the only direction that matters.
        const snapshot = await ctx.client.snapshot(canvas.id).catch(() => null);
        if (!snapshot) continue;
        entries.push(
          ...inboxOn(snapshot.canvas, ctx.actor, names, canvas.id, canvas.title, snapshot.joined),
        );
      }
      const wanted = opts.mentions ? entries.filter((e) => e.reason === "mentioned") : entries;
      const ordered = inboxNewestFirst(wanted).slice(0, Number(opts.limit ?? 20));
      if (ctx.json) return printJson(ordered);
      if (ordered.length === 0) {
        return console.log(
          opts.mentions ? "nobody has named you" : "nothing addressed to you",
        );
      }
      for (const entry of ordered) {
        console.log(inboxLine(entry));
        console.log(
          `  ${entry.reason} · ${new Date(entry.comment.createdAt).toLocaleString()}` +
            `\n  reply: isocan --project ${entry.canvasId} comment reply ${entry.threadId} "…"`,
        );
      }
      const tally = inboxTally(wanted);
      console.log(
        `\n${tally.mentioned} named you · ${tally["main-thread"]} in the Chat · ` +
          `${tally["in-your-thread"]} in threads you are in`,
      );
    }),
  );

const context = program
  .command("context")
  .description("What an agent will actually read when it starts work here")
  .option("--canvas <canvas>");

/**
 * **Stage 2's verbs** (`docs/projects/context/design.md`): pin an item into
 * context, keep one out of it. Both are `item.update` with a property, so this
 * adds no operation — the same answer `mapParent` reached for edges.
 */
function markVerb(name: "pin" | "exclude" | "unmark", mark: "pinned" | "excluded" | null, blurb: string) {
  context
    .command(`${name} <item>`)
    .description(blurb)
    .option("--canvas <canvas>")
    .action(
      run(async (itemRef: string, opts: { canvas?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        if (opts.canvas) ctx.canvasRef = opts.canvas;
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const item = resolveItem(snapshot, itemRef);
        const was = contextMark(item);
        if (was === mark) {
          return console.log(
            mark === null
              ? `"${item.title}" was not marked`
              : `"${item.title}" is already ${markLabel(mark)}`,
          );
        }
        await sendOp(ctx, p.id, {
          type: "item.update",
          itemId: item.id,
          patch: markPatch(mark),
        });
        console.log(
          mark === null
            ? `"${item.title}" is no longer ${markLabel(was!)}`
            : `"${item.title}" is ${markLabel(mark)}`,
        );
      }),
    );
}

markVerb("pin", "pinned", "Say an agent should read this first");
markVerb("exclude", "excluded", "Say an agent should skip this — it stays on the canvas");
markVerb("unmark", null, "Take back a pin or an exclusion");

context
  .command("show", { isDefault: true })
  .description("The list itself")
  .option("--canvas <canvas>")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);

      /**
       * **The design system's findings, read rather than assumed.**
       *
       * "Is there one" is a different question from "is it any good", and the
       * view is worth much less if it answers only the first. This costs one
       * blob fetch and turns "Design system v3" into "Design system v3, two
       * findings" — which is the difference between a list and a report.
       *
       * A system that cannot be read is not a failure of this command: it is
       * reported as present with no findings, because saying "0 problems"
       * about something unparseable would be a false clean bill.
       */
      let designProblems: number | undefined;
      const design = designSystem(snapshot.canvas);
      if (design) {
        try {
          const current =
            design.versions.find((v) => v.id === design.currentVersionId) ?? design.versions[0];
          if (current) {
            const blob = await ctx.client.downloadBlob(p.id, current.blobHash);
            designProblems = checkDesign(parseDesign(blob.toString("utf8"))).length;
          }
        } catch {
          // Unreadable: say nothing rather than something wrong.
        }
      }

      const pieces = contextPieces(snapshot.canvas, {
        // The guide this BUILD ships, which is the one an agent here has read
        // — not "the latest", which is a different machine's business.
        guideVersion: describeBuild(buildStamp()),
        ...(designProblems === undefined ? {} : { designProblems }),
      });
      if (ctx.json) return printJson(pieces);
      console.log(contextReport(pieces));
    }),
  );

// ---------- the slide deck ----------

/**
 * **The deck** (#87): which items full screen flips through. The same
 * property-not-operation answer `context pin` reached — `item.update`
 * already carries it — so this verb and the web menu's "Make this a slide"
 * cannot disagree about what a slide is, and there is no deck URL to mint:
 * full screen is already an address, and `show` prints the first slide's.
 */
const slidesCmd = program
  .command("slides")
  .description(`The deck ${SLIDE_EMOJI} — which items full screen flips through, in reading order`);

function slideVerb(name: "add" | "rm", on: boolean, blurb: string) {
  slidesCmd
    .command(`${name} <items...>`)
    .description(blurb)
    .option("--canvas <canvas>")
    .action(
      run(async (refs: string[], opts: { canvas?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        if (opts.canvas) ctx.canvasRef = opts.canvas;
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        for (const ref of refs) {
          const item = resolveItem(snapshot, ref);
          if (isSlide(item) === on) {
            console.log(
              on ? `"${item.title}" is already a slide` : `"${item.title}" was not a slide`,
            );
            continue;
          }
          await sendOp(ctx, p.id, {
            type: "item.update",
            itemId: item.id,
            patch: slidePatch(on),
          });
          console.log(
            on
              ? `${SLIDE_EMOJI} "${item.title}" is a slide`
              : `"${item.title}" is out of the deck — it stays on the canvas`,
          );
        }
      }),
    );
}

slideVerb("add", true, "Mark items as slides — bare arrows in full screen stop only at these");
slideVerb("rm", false, "Take items out of the deck — they stay on the canvas");

slidesCmd
  .command("show", { isDefault: true })
  .description("The deck in reading order, and the address to hand an audience")
  .option("--canvas <canvas>")
  .action(
    run(async (opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const deck = slides(snapshot.canvas);
      if (ctx.json) {
        return printJson(deck.map((item) => ({ id: item.id, title: item.title })));
      }
      if (deck.length === 0) {
        return console.log(
          "No slides marked — full screen flips through every item, in reading order.\n" +
            "Narrow it: isocan slides add <item>",
        );
      }
      deck.forEach((item, i) => console.log(`${i + 1}. ${item.title} (${item.id})`));
      // THIS canvas's home, never the daemon's — the same one-door rule
      // `isocan open` follows: the address you hand an audience must be the
      // door of the home that holds the canvas.
      const origin = (await ctx.homeOf(p.id)) ?? ctx.client.base;
      console.log(`\nThe deck's address (the first slide, full screen):`);
      console.log(itemUrl(origin, p.id, deck[0]!.id));
    }),
  );

// ---------- the design sprint ----------

/**
 * **The sprint's clock, read and set from the terminal** — the facilitator's
 * chair (`docs/research/2026-09-01-design-sprint.md`).
 *
 * Nothing here is stored anywhere new. `phase` posts a `/sprint <phase>` line
 * to the Chat — the same shape `ask` gives `/ask` — and `sprintState` in core
 * derives the running phase from the newest such line, so this verb, the
 * app's clock chip and any agent reading the Chat agree by construction. A
 * hand-in is `item.update` with one property. The tally is a read over
 * reactions. The bell is `isocan wait --timeout <remainingSeconds>`, which the
 * `/sprint` command's body spells out.
 */
const sprintCmd = program
  .command("sprint")
  .description("The design sprint — which phase the Chat says is running, its clock, and what was handed in")
  .addHelpText(
    "after",
    `
A sprint is a script the facilitator runs over verbs you already have. Phases:
  ${PHASES.map((p) => p.name).join(" ")}  (and: end)

  isocan sprint                        # phase, clock, hand-ins, tally
  isocan sprint phase crazy8s 8m       # call a phase (posts /sprint to the Chat)
  isocan sprint handin <items...>      # these were made for the current phase
  isocan sprint tally                  # human dots and agent dots, apart
  isocan sprint end                    # the sprint is over
  isocan wait --timeout $(isocan sprint --json | jq .remainingSeconds)   # the bell`,
  );

/** Say a line in the Chat — replying to it, or starting it. The shape
 * `notify` and `ask` both use; here so the phase line lands where the
 * derivation reads. */
async function sayInChat(
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  body: string,
): Promise<{ threadId: string; commentId: string }> {
  const comment = await newComment(ctx, canvasId, snapshot, body);
  const main = mainThread(snapshot.canvas);
  if (main) {
    await sendOp(ctx, canvasId, { type: "thread.reply", threadId: main.id, comment });
    return { threadId: main.id, commentId: comment.id };
  }
  const threadId = newThreadId();
  await sendOp(ctx, canvasId, {
    type: "thread.create",
    threadId,
    x: 0,
    y: 0,
    anchorItemId: null,
    main: true,
    comment,
  });
  return { threadId, commentId: comment.id };
}

sprintCmd
  .command("show", { isDefault: true })
  .description("The phase the Chat says is running, how long is left, and what was handed in")
  .option("--canvas <canvas>")
  .action(
    run(async (opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const state = sprintState(snapshot.canvas);
      const now = Date.now();
      if (!state) {
        if (ctx.json) return printJson({ running: false, marks: PHASES.filter((ph) => ph.mark).map((ph) => ({ phase: ph.name, mark: ph.mark })) });
        return console.log(
          "No sprint running here. Ask for one with /sprint in the Chat, or call a phase:\n" +
            "  isocan sprint phase map 45m",
        );
      }
      const remaining = remainingSeconds(state, now);
      const sessions = await ctx.client.listSessions(p.id).catch(() => [] as PresenceSession[]);
      const agents = agentActorIds(sessions, snapshot.canvas);
      const rows =
        state.phase.mark === null ? [] : tally(wallFor(snapshot.canvas, state), state.phase.mark, agents);
      if (ctx.json) {
        return printJson({
          running: true,
          phase: state.phase.name,
          label: state.phase.label,
          kind: state.phase.kind,
          mark: state.phase.mark,
          note: state.note,
          facilitatorId: state.facilitatorId,
          facilitatorName: state.facilitatorName,
          startedAt: state.startedAt,
          endsAt: state.endsAt,
          remainingSeconds: remaining,
          over: phaseOver(state, now),
          hidesVotes: hidesVotes(state, now),
          handedIn: state.handedIn.map((i) => ({ id: i.id, title: i.title })),
          area: state.area ? { id: state.area.id, title: state.area.title, x: state.area.x, y: state.area.y, width: state.area.width, height: state.area.height } : null,
          tally: rows.map((r) => ({ id: r.item.id, title: r.item.title, humans: r.humans, agents: r.agents, actorIds: r.actorIds })),
          marks: PHASES.filter((ph) => ph.mark).map((ph) => ({ phase: ph.name, mark: ph.mark })),
        });
      }
      const clock =
        remaining === null ? "no clock — runs until the next phase" : remaining === 0 ? "the bell has rung" : `${clockLabel(remaining)} left`;
      const names = new Map<string, string>();
      for (const s of sessions) names.set(s.actor.id, s.label ?? s.actor.name);
      const who = names.get(state.facilitatorId) ?? state.facilitatorName;
      console.log(`${state.phase.label} (${state.phase.kind}) · ${clock} · called by ${who}${state.note ? ` — ${state.note}` : ""}`);
      console.log(state.area ? `on the board: ${state.area.title} (${state.area.id})` : "no board laid — `isocan sprint board` lays one");
      console.log(
        state.handedIn.length === 0
          ? "handed in: nothing yet"
          : `handed in: ${state.handedIn.length} — ${state.handedIn.map((i) => i.title).join(", ")}`,
      );
      if (state.phase.mark) {
        console.log(
          `votes: ${state.phase.mark}${hidesVotes(state, now) ? " — hidden in the app until the bell; you are reading the record" : ""}`,
        );
        if (rows.length > 0) {
          printTable(rows.map((r) => ({ sketch: r.item.title, humans: String(r.humans), agents: String(r.agents) })));
        }
      }
    }),
  );

sprintCmd
  .command("phase <phase> [rest...]")
  .description("Call a phase — posts /sprint <phase> [duration] [note] to the Chat, which is what starts the clock")
  .option("--canvas <canvas>")
  .action(
    run(async (phase: string, rest: string[], opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const spec = phaseSpec(phase);
      if (!spec) {
        throw new Error(
          `"${phase}" is not a phase. One of: ${PHASES.map((p) => p.name).join(" ")} — or \`isocan sprint end\``,
        );
      }
      const seconds = rest[0] !== undefined ? parseDuration(rest[0]) : null;
      const note = (seconds === null ? rest : rest.slice(1)).join(" ").trim();
      const body = `/sprint ${spec.name}${rest[0] !== undefined && seconds !== null ? ` ${rest[0]}` : ""}${note ? ` ${note}` : ""}`;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const posted = await sayInChat(ctx, p.id, snapshot, body);
      const box = seconds ?? spec.defaultSeconds;
      if (ctx.json) return printJson({ ...posted, phase: spec.name, seconds: box, body });
      console.log(
        `${spec.label} · ${box === null ? "no clock" : clockLabel(box)}${spec.mark ? ` · votes with ${spec.mark}` : ""} — said in the Chat`,
      );
      if (box !== null) console.log(`the bell: isocan wait --timeout ${box}`);
    }),
  );

/**
 * **The board** (sprint phase 1): the eleven sheets of `SPRINT_BOARD`, laid
 * in one row to the right of everything as one group — so one ⌘Z takes the
 * whole board away — each an area wearing `board=<key>` and carrying its
 * card. Idempotent: a sheet that already exists (by key) is left where it
 * is, so running this twice lays nothing twice and a board somebody has
 * rearranged is not put back.
 */
sprintCmd
  .command("board")
  .description("Lay the board — one sheet per stretch of the week, to the right of everything")
  .option("--at <x,y>", "the first sheet's top-left (default: right of everything)")
  .option("--canvas <canvas>")
  .action(
    run(async (opts: { at?: string; canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const all = Object.values(snapshot.canvas.items);
      const origin = opts.at
        ? parseXY(opts.at)
        : {
            x: all.length === 0 ? 0 : Math.max(...all.map((one) => one.x + one.width)) + BOARD_GAP,
            y: all.length === 0 ? 0 : Math.min(...all.map((one) => one.y)),
          };
      const group = newGroupId();
      const laid: { key: string; itemId: string; title: string; x: number; y: number }[] = [];
      const kept: { key: string; itemId: string; title: string }[] = [];
      for (const sheet of boardLayout(origin)) {
        const existing = boardAreaFor(snapshot.canvas, sheet.key);
        if (existing) {
          kept.push({ key: sheet.key, itemId: existing.id, title: existing.title });
          continue;
        }
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(sheet.card, "utf8"), AREA_MIME, AREA_FILENAME);
        const itemId = newItemId();
        await sendOp(
          ctx,
          p.id,
          {
            type: "item.add",
            itemId,
            version: {
              id: newVersionId(),
              blobHash: upload.blobHash,
              mimeType: AREA_MIME,
              filename: AREA_FILENAME,
              size: upload.size,
            },
            width: sheet.width,
            height: sheet.height,
            // Chosen: the board is laid where the layout says, edge to edge,
            // and a sheet the tidy rule moved would put its phase somewhere
            // else on every replay.
            placement: { x: sheet.x, y: sheet.y, chosen: true },
            title: sheet.title,
            properties: { ...AREA_PROPERTIES, [AREA_TINT_PROP]: sheet.tint, [BOARD_PROP]: sheet.key },
          },
          group,
        );
        laid.push({ key: sheet.key, itemId, title: sheet.title, x: sheet.x, y: sheet.y });
      }
      if (ctx.json) return printJson({ laid, kept, origin });
      if (laid.length === 0) return console.log(`the board is already laid — ${kept.length} sheets, nothing added`);
      console.log(`laid ${laid.length} sheet${laid.length === 1 ? "" : "s"}${kept.length > 0 ? ` (${kept.length} already there)` : ""}: ${laid.map((one) => one.title).join(" · ")}`);
      console.log("one undo takes the whole board away; `isocan area ls` names the sheets");
    }),
  );

/**
 * **The brief** (sprint phase 1): what the setup round answered, as a card
 * on the Brief sheet. Written once as a text node wearing `brief=1`; every
 * later call writes the next VERSION of the same card, so the brief's
 * history is on its stack and there is never a second brief.
 */
sprintCmd
  .command("brief")
  .description("Write the brief onto the Brief sheet — a new version each time, never a second card")
  .option("--goal <sentence>", "the long-term goal, in one sentence")
  .option("--question <q>", "a sprint question (repeatable)", (one: string, all: string[]) => [...all, one], [] as string[])
  .option("--decider <name>", "the one person who decides — never an agent")
  .option("--sketcher <name>", "somebody sketching, person or agent (repeatable)", (one: string, all: string[]) => [...all, one], [] as string[])
  .option("--cut <which>", "four days | one day | one hour")
  .option("--canvas <canvas>")
  .action(
    run(
      async (
        opts: { goal?: string; question: string[]; decider?: string; sketcher: string[]; cut?: string; canvas?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        if (opts.canvas) ctx.canvasRef = opts.canvas;
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const card = briefCard({
          ...(opts.goal ? { goal: opts.goal } : {}),
          ...(opts.question.length > 0 ? { questions: opts.question } : {}),
          ...(opts.decider ? { decider: opts.decider } : {}),
          ...(opts.sketcher.length > 0 ? { sketchers: opts.sketcher } : {}),
          ...(opts.cut ? { cut: opts.cut } : {}),
        });
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(card, "utf8"), TEXT_MIME, TEXT_FILENAME);
        const version = {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: TEXT_MIME,
          filename: TEXT_FILENAME,
          size: upload.size,
        };
        const existing = briefItem(snapshot.canvas);
        if (existing) {
          await sendOp(ctx, p.id, { type: "item.addVersion", itemId: existing.id, version });
          if (ctx.json) return printJson({ itemId: existing.id, version: existing.versions.length + 1 });
          return console.log(`the brief has a new version (${existing.versions.length + 1}) — S fans the history`);
        }
        // A new brief lands on the Brief sheet when the board is laid, and
        // wherever `text` would put it otherwise — a brief without a board
        // is still a brief.
        const sheet = boardAreaFor(snapshot.canvas, "brief");
        const size = { width: 900, height: 600 };
        const placement: Placement = sheet
          ? { ...freeSpotIn(snapshot.canvas, sheet, size.width, size.height), chosen: true }
          : placementFor(snapshot, {}, size);
        const itemId = newItemId();
        await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version,
          width: size.width,
          height: size.height,
          placement,
          title: "Brief",
          properties: { ...TEXT_PROPERTIES, [BRIEF_PROP]: "1" },
        });
        if (ctx.json) return printJson({ itemId, version: 1, placement });
        console.log(`the brief is on the board${sheet ? "" : " (no Brief sheet — laid where text goes)"} — react ✅ on it when it is right`);
      },
    ),
  );

sprintCmd
  .command("end [note...]")
  .description("The sprint is over — no phase, no clock")
  .option("--canvas <canvas>")
  .action(
    run(async (note: string[], opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      if (!sprintState(snapshot.canvas)) throw new Error("no sprint is running here");
      const words = note.join(" ").trim();
      const posted = await sayInChat(ctx, p.id, snapshot, `/sprint ${SPRINT_END}${words ? ` ${words}` : ""}`);
      if (ctx.json) return printJson(posted);
      console.log("the sprint is over — said in the Chat");
    }),
  );

sprintCmd
  .command("handin <items...>")
  .description("Mark items as handed in for the current phase (a property; undo takes it back)")
  .option("--phase <phase>", "a phase other than the running one")
  .option("--canvas <canvas>")
  .action(
    run(async (refs: string[], opts: { phase?: string; canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const state = sprintState(snapshot.canvas);
      const phase = opts.phase ? phaseSpec(opts.phase)?.name : state?.phase.name;
      if (!phase) {
        throw new Error(
          opts.phase
            ? `"${opts.phase}" is not a phase`
            : "no sprint is running — hand in to a phase by name with --phase <phase>",
        );
      }
      for (const ref of refs) {
        const item = resolveItem(snapshot, ref);
        if (handedInFor(item) === phase) {
          console.log(`"${item.title}" is already in for ${phase}`);
          continue;
        }
        await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: handInPatch(phase) });
        console.log(`"${item.title}" handed in for ${phase}`);
      }
    }),
  );

sprintCmd
  .command("tally [mark]")
  .description("Who wore the vote's mark on each sketch — human dots and agent dots, apart")
  .option("--canvas <canvas>")
  .action(
    run(async (mark: string | undefined, opts: { canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (opts.canvas) ctx.canvasRef = opts.canvas;
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const state = sprintState(snapshot.canvas);
      const emoji = mark ?? state?.phase.mark ?? null;
      if (!emoji) throw new Error("which mark? the running phase is not a vote — `isocan sprint tally 🔴`");
      const sessions = await ctx.client.listSessions(p.id).catch(() => [] as PresenceSession[]);
      const agents = agentActorIds(sessions, snapshot.canvas);
      const wall = state ? wallFor(snapshot.canvas, state) : Object.values(snapshot.canvas.items);
      const rows = tally(wall, emoji, agents);
      if (ctx.json) {
        return printJson(rows.map((r) => ({ id: r.item.id, title: r.item.title, humans: r.humans, agents: r.agents, actorIds: r.actorIds })));
      }
      if (rows.length === 0) return console.log(`nobody has worn ${emoji} yet`);
      const names = new Map<string, string>();
      for (const s of sessions) names.set(s.actor.id, s.label ?? s.actor.name);
      printTable(
        rows.map((r) => ({
          sketch: r.item.title,
          humans: String(r.humans),
          agents: String(r.agents),
          who: r.actorIds.map((id) => names.get(id) ?? id).join(", "),
        })),
      );
    }),
  );

// ---------- the design system ----------

const style = program
  .command("design")
  // What this was called for an afternoon. Muscle memory is cheap to keep and
  // expensive to break; the NAME is `design`, and the docs only say that.
  .alias("style")
  .description("This canvas's design system — a DESIGN.md, tokens and all")
  .addHelpText(
    "after",
    `
The design system is an ITEM on the canvas, not a file in a repo: it sits
beside the designs it governs, both surfaces can read it, and it versions like
everything else. Read it before you build a screen, and cite it when you do.

The format is DESIGN.md (github.com/google-labs-code/design.md): typed design
tokens in the front matter, the reasoning in the sections.

  isocan design                  # print it
  isocan design --css            # custom properties, ready to paste
  isocan design --tokens         # W3C design tokens, for anything downstream
  isocan design check            # references, colours, contrast, sections
  isocan design set DESIGN.md    # write it (a new version if one exists)

None yet? \`/design-system\` in a composer asks an agent to derive one from the
screens already on the canvas — what they ALREADY do, rather than a system
somebody invented and imposed.`,
  );

style
  .command("show", { isDefault: true })
  .description("Print the design system (--css or --tokens for the machine-readable halves)")
  .option("--css", "custom properties, ready to paste into the screen you are building")
  .option("--tokens", "W3C design tokens (designtokens.org) — Figma, Style Dictionary, Tailwind")
  .action(
    run(async (opts: { css?: boolean; tokens?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const item = designSystem(snapshot.canvas);
      if (!item) {
        throw new Error(
          `${p.title} has no design system yet — write one with \`isocan design set DESIGN.md\`, ` +
            `or ask for /design-system and an agent will derive it from the screens already here`,
        );
      }
      const version = item.versions.find((v) => v.id === item.currentVersionId);
      if (!version) throw new Error(`${item.title} has no current version`);
      const text = (await ctx.client.downloadBlob(p.id, version.blobHash)).toString("utf8");
      const doc = parseDesign(text);

      // The machine-readable halves. A design system nobody can export stops
      // at the edge of this canvas.
      if (opts.css) return console.log(toCss(doc.tokens));
      if (opts.tokens) return printJson(toDtcg(doc.tokens));
      if (ctx.json) {
        return printJson({
          itemId: item.id,
          title: item.title,
          versions: item.versions.length,
          tokens: doc.tokens,
          sections: doc.sections.map((section) => section.title),
          body: text,
        });
      }
      // The body alone on stdout so it can be piped into something that
      // follows it; everything else goes to stderr.
      console.error(`${item.title} (${item.id}, v${item.versions.length})`);
      console.log(text);
    }),
  );

style
  .command("check")
  .description("Is the design system usable — references, colours, contrast, sections")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const item = designSystem(snapshot.canvas);
      if (!item) {
        throw new Error(
          `${p.title} has no design system — isocan design set DESIGN.md, or ask for /design-system`,
        );
      }
      const version = item.versions.find((v) => v.id === item.currentVersionId);
      if (!version) throw new Error(`${item.title} has no current version`);
      const text = (await ctx.client.downloadBlob(p.id, version.blobHash)).toString("utf8");
      const findings = bySeverity(checkDesign(parseDesign(text)));
      if (ctx.json) return printJson(findings);
      if (findings.length === 0) return console.error(`${item.title}: nothing to fix`);
      printTable(
        findings.map((f) => ({
          "": f.severity === "error" ? "✗" : f.severity === "warning" ? "!" : "·",
          where: f.where,
          what: truncate(f.what, 52),
          fix: truncate(f.fix ?? "—", 44),
        })),
      );
      // An error is something WRONG, not something that could be better — so
      // only errors fail a script that runs this.
      if (findings.some((f) => f.severity === "error")) process.exitCode = 1;
    }),
  );

style
  .command("set")
  .description("Write the design system (a new version when one already exists)")
  .argument("<file>", "markdown or CSS describing the system")
  .option("--title <title>", "name for the item", "DESIGN.md")
  .action(
    run(async (file: string, opts: { title: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
      const data = await fs.readFile(file);
      const filename = path.basename(file);
      const mimeType = mimeFor(filename);
      const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);
      const version = {
        id: newVersionId(),
        blobHash: upload.blobHash,
        mimeType,
        filename,
        size: upload.size,
      };
      const existing = designSystem(snapshot.canvas);
      if (existing) {
        // A version, never a replacement: the style you are moving away from
        // is the thing you will want to compare against tomorrow.
        await sendOp(ctx, p.id, { type: "item.addVersion", itemId: existing.id, version });
        console.error(`${existing.id} — design system v${existing.versions.length + 1} (V shows the stack)`);
        return;
      }
      const itemId = newItemId();
      await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version,
        width: 560,
        height: 720,
        placement: placementFor(snapshot, {}),
        title: opts.title,
        properties: designSystemProperties(),
      });
      console.error(`${itemId} — design system for ${p.title} (isocan design)`);
    }),
  );

style
  .command("import")
  .description("Land somebody else's theme as this canvas's design system")
  .argument("<file>", "a stylesheet of custom properties, or a W3C token JSON")
  .option("--dry-run", "read it and report, without writing anything")
  .option("--title <title>", "name for the item", "DESIGN.md")
  .action(
    run(async (file: string, opts: { dryRun?: boolean; title: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const text = await fs.readFile(file, "utf8");
      const { tokens, problems, format } = importDesign(text, path.basename(file));
      const counts = {
        colors: Object.keys(tokens.colors ?? {}).length,
        typography: Object.keys(tokens.typography ?? {}).length,
        rounded: Object.keys(tokens.rounded ?? {}).length,
        spacing: Object.keys(tokens.spacing ?? {}).length,
      };
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) {
        // Nothing read is a failure, not an empty success — writing an empty
        // design system over a real one would be the worst outcome here.
        throw new Error(
          `nothing to import from ${path.basename(file)}${problems.length ? ` — ${problems[0]}` : ""}`,
        );
      }
      const body = importedBody(path.basename(file), tokens);
      const markdown = serializeDesign(tokens, body);

      // Problems go to STDERR whichever mode this is in: they qualify the
      // result, and an agent reading `--json` off stdout needs the caveat as
      // much as a person reading the summary does.
      for (const problem of problems) console.error(`note: ${problem}`);

      if (opts.dryRun) {
        if (ctx.json) return printJson({ format, counts, problems, markdown });
        console.log(markdown);
        console.error(
          `${format}: ${counts.colors} colours, ${counts.typography} type roles, ${counts.rounded} radii, ${counts.spacing} spacings — nothing written`,
        );
        return;
      }

      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
      const filename = "DESIGN.md";
      const upload = await ctx.client.uploadBlob(
        p.id,
        Buffer.from(markdown, "utf8"),
        "text/markdown",
        filename,
      );
      const version = {
        id: newVersionId(),
        blobHash: upload.blobHash,
        mimeType: "text/markdown",
        filename,
        size: upload.size,
      };
      const existing = designSystem(snapshot.canvas);
      if (existing) {
        // A version, never a replacement — the same rule `design set` holds
        // to, and it matters more here: an import is exactly the moment
        // somebody discovers they wanted the old one back.
        await sendOp(ctx, p.id, { type: "item.addVersion", itemId: existing.id, version });
        if (ctx.json) return printJson({ itemId: existing.id, format, counts, problems });
        console.error(
          `${existing.id} — design system v${existing.versions.length + 1} from ${path.basename(file)}`,
        );
        return;
      }
      const itemId = newItemId();
      await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version,
        width: 560,
        height: 720,
        placement: placementFor(snapshot, {}),
        title: opts.title,
        properties: designSystemProperties(),
      });
      if (ctx.json) return printJson({ itemId, format, counts, problems });
      console.error(`${itemId} — design system for ${p.title}, imported from ${path.basename(file)}`);
    }),
  );

// ---------- slash commands ----------

const command = program
  .command("command")
  .description("Slash commands: the work a message can ask for")
  .addHelpText(
    "after",
    `
A slash command is a message, not a button. "/format tighten the rows" posted
as a comment is a request an AGENT carries out — which is why the same request
can be typed into the web app's composer or sent from here with
\`isocan comment add\`, and why undo, history, and old clients keep working:
it is text in a comment.

A command's body is its skill: the instructions you follow when you see one.
When a comment starts with /name, run \`isocan command show <name>\` and do
what it says.

isocan ships some; this home can add its own (or shadow a built-in) —
\`isocan command add tidy ./tidy.md\`, which writes ~/.isocan/commands/tidy.md.
Removing your own gives the built-in back.`,
  );

command
  .command("list", { isDefault: true })
  .description("Every command available here")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const commands = await ctx.client.commands();
      if (ctx.json) return printJson(commands);
      printTable(
        commands.map((c) => ({
          command: `/${c.name}`,
          usage: c.usage || "—",
          does: truncate(c.description, 48),
          from: c.source,
        })),
      );
    }),
  );

command
  .command("show")
  .description("What a command tells an agent to do — the whole body")
  .argument("<name>", "command name, with or without the slash")
  .action(
    run(async (name: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const wanted = name.replace(/^\//, "").toLowerCase();
      const found = findCommand(await ctx.client.commands(), wanted);
      if (!found) throw new Error(`no command called /${wanted} (isocan command list)`);
      if (ctx.json) return printJson(found);
      // The body alone on stdout, so it can be piped into something that
      // follows it. Everything else goes to stderr.
      console.error(`/${found.name} ${found.usage} — ${found.description} (${found.source})`);
      console.log(found.body);
    }),
  );

command
  .command("add")
  .description("Write a command for this home (shadows a built-in of the same name)")
  .argument("[name]", "command name: lowercase letters, digits, dashes")
  .argument("[file]", "markdown file; omit to read stdin")
  .option("--from <ref>", "a published skill: owner/repo/path/SKILL.md, or an https URL")
  .option("--yes", "with --from: install it, having read what it says")
  .option("--description <text>", "one line for the menu (when the file has no frontmatter)")
  .option("--usage <text>", "how the arguments read, e.g. '[note]'")
  .addHelpText(
    "after",
    `
--from fetches a published skill and PRINTS IT, and installs nothing until you
run it again with --yes. That gate is deliberate: a command's body is read as
instructions by every future agent on this canvas, so "what does it say" and
"where did it come from" get answered before it lands, not after.

  isocan command add --from mattpocock/skills/skills/productivity/grilling/SKILL.md
  isocan command add --from <same> --yes`,
  )
  .action(
    run(async (name: string | undefined, file: string | undefined, opts: { from?: string; yes?: boolean; description?: string; usage?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);

      if (opts.from) {
        const source = publishedSkill(opts.from);
        if (!source) {
          throw new Error(
            `cannot tell where "${opts.from}" comes from — use owner/repo/path/SKILL.md or an https URL`,
          );
        }
        const res = await fetch(source.url);
        if (!res.ok) throw new Error(`${source.url} — HTTP ${res.status}`);
        const text = await res.text();
        const asName = (name ?? skillNameFrom(opts.from) ?? "").replace(/^\//, "").toLowerCase();
        if (!COMMAND_NAME.test(asName)) {
          throw new Error(`could not name this skill from its path — pass one: isocan command add <name> --from …`);
        }
        const parsed = parseCommandFile(asName, text);
        if (!parsed) throw new Error(`${source.url} has no instructions in it`);
        if (!opts.yes) {
          // Show the whole thing. A skill you have not read is a stranger you
          // have given a seat at your canvas.
          console.error(`/${asName} — from ${source.label}\n${source.url}\n`);
          console.log(text);
          console.error(
            `\nread that? then: isocan command add ${asName} --from ${opts.from} --yes`,
          );
          return;
        }
        await ctx.client.saveCommand(asName, text);
        console.error(`/${asName} installed from ${source.label} (isocan command rm ${asName})`);
        return;
      }

      if (!name) throw new Error("pass a name, or --from <ref> to fetch a published skill");
      const wanted = name.replace(/^\//, "").toLowerCase();
      if (!COMMAND_NAME.test(wanted)) {
        throw new Error(`not a command name: ${wanted} (lowercase letters, digits, dashes)`);
      }
      const raw = file ? await fs.readFile(file, "utf8") : await readStdin();
      if (raw.trim() === "") throw new Error("a command needs instructions — nothing was given");
      // Frontmatter in the file wins; the flags fill in what it does not say.
      const parsed = parseCommandFile(wanted, raw);
      const text =
        parsed && !opts.description && !opts.usage
          ? raw
          : commandFileText({
              description: opts.description ?? parsed?.description ?? `Run the ${wanted} command`,
              usage: opts.usage ?? parsed?.usage ?? "",
              body: parsed?.body ?? raw,
            });
      await ctx.client.saveCommand(wanted, text);
      console.error(`/${wanted} is available here — try it in the composer, or /${wanted} in a comment`);
    }),
  );

command
  .command("rm")
  .description("Remove one of this home's commands (a shadowed built-in comes back)")
  .argument("<name>", "command name")
  .action(
    run(async (name: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const wanted = name.replace(/^\//, "").toLowerCase();
      await ctx.client.deleteCommand(wanted);
      const back = findCommand(await ctx.client.commands(), wanted);
      console.error(back ? `/${wanted} is the built-in again` : `/${wanted} is gone`);
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
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  body: string,
): Promise<NewComment> {
  // The API's one spelling (`buildComment`), so a mention posted from a
  // script and from this CLI resolve identically (iso-api phase 2).
  return buildComment(ctx.client, canvasId, snapshot, body);
}

comment
  .command("add <text>")
  .description("Start a thread — anchored to an item or freestanding at --at")
  .option("--item <item>", "anchor to this item")
  .option("--at <x,y>", "freestanding at world coordinates")
  .action(
    run(async (text: string, opts: { item?: string; at?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx, { create: true });
      if (!opts.item && !opts.at) throw new Error("pass --item <item> or --at <x,y>");
      let x: number, y: number, anchorItemId: string | null;
      if (opts.item) {
        const item = resolveItem(snapshot, opts.item);
        anchorItemId = item.id;
        // Anchored pins store an offset from the item origin, and where that
        // lands is core's to say — one spelling, so ⇧C in the app and this
        // command put a thread in the same place (`anchorOffset`).
        ({ x, y } = anchorOffset(item));
      } else {
        ({ x, y } = parseXY(opts.at!));
        anchorItemId = null;
      }
      const threadId = newThreadId();
      const first = await newComment(ctx, p.id, snapshot, text);
      await sendOp(ctx, p.id, {
        type: "thread.create",
        threadId,
        x,
        y,
        anchorItemId,
        comment: first,
      });
      // The comment id comes back because a note posted while working is one
      // you will want to rewrite: `comment edit <thread> <comment> "…"`.
      if (ctx.json) return printJson({ threadId, commentId: first.id });
      console.log(`started thread ${threadId} (${first.id})`);
    }),
  );

comment
  .command("reply <thread> <text>")
  .description("Reply to a thread")
  .action(
    run(async (threadRef: string, text: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const thread = resolveThread(snapshot, threadRef);
      const comment = await newComment(ctx, p.id, snapshot, text);
      await sendOp(ctx, p.id, {
        type: "thread.reply",
        threadId: thread.id,
        comment,
      });
      if (ctx.json) return printJson({ threadId: thread.id, commentId: comment.id });
      // The id is here because a note you post while working is one you will
      // want to rewrite: `comment edit <thread> <comment> "…"`.
      console.log(`replied to ${thread.id} (${comment.id})`);
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
        const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
        const thread = resolveThread(snapshot, threadRef);
        let x: number, y: number, anchorItemId: string | null;
        if (itemRef) {
          const item = resolveItem(snapshot, itemRef);
          anchorItemId = item.id;
          // Same spot as `comment add --item`, from the same function.
          ({ x, y } = anchorOffset(item));
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
  .option("--open", "only questions nobody has answered yet")
  .action(
    run(async (opts: { item?: string; open?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      await narrate(ctx, p.id, { status: "reading the comments…" });

      /**
       * **What is waiting on a person, from the terminal.**
       *
       * The canvas has shown this since `openAsk` shipped — an agent that has
       * asked reads as *asked* in the tray and *blocked* in `isocan who`. The
       * terminal could not list what those questions WERE, which is the wrong
       * way round for a feature about the moment an agent needs a person: the
       * one who most needs to re-read the question is the one who asked it.
       *
       * `openAsks` is core's, so this list and that badge cannot disagree.
       */
      if (opts.open) {
        const asks = openAsks(snapshot.canvas);
        if (ctx.json) return printJson(asks);
        if (asks.length === 0) {
          console.log("nothing is waiting on an answer");
          return;
        }
        for (const ask of asks) {
          const thread = snapshot.canvas.threads[ask.threadId]!;
          const where = thread.main
            ? "the Chat"
            : thread.anchorItemId
              ? `"${snapshot.canvas.items[thread.anchorItemId]?.title ?? thread.anchorItemId}"`
              : `${thread.x},${thread.y}`;
          console.log(`${actorNameIn(snapshot.names, { id: ask.askerId, name: ask.askerId })} · on ${where}`);
          console.log(`  ${ask.body}`);
          console.log(`  reply: isocan comment reply ${ask.threadId} "…"`);
        }
        return;
      }

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
          console.log(`  ${actorNameIn(snapshot.names, c.author)} · ${c.createdAt}`);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
  .command("edit <thread> <comment> <text>")
  .description("Rewrite a comment you wrote — a working note that changes as the work does")
  .action(
    run(async (threadRef: string, commentId: string, text: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const thread = resolveThread(snapshot, threadRef);
      const existing = thread.comments.find((c) => c.id === commentId);
      if (!existing) throw new Error(`no comment ${commentId} on ${thread.id}`);
      // Mentions and #refs are resolved against the NEW body, the same way a
      // fresh comment resolves them.
      const resolved = await newComment(ctx, p.id, snapshot, text);
      await sendOp(ctx, p.id, {
        type: "comment.update",
        threadId: thread.id,
        commentId,
        body: text,
        ...(resolved.mentions ? { mentions: resolved.mentions } : {}),
        ...(resolved.items ? { items: resolved.items } : {}),
      });
      const took = elapsedLabel(existing.createdAt, new Date().toISOString());
      if (ctx.json) return printJson({ threadId: thread.id, commentId, took });
      console.log(`edited ${commentId} — ${took} since it was posted`);
    }),
  );

comment
  .command("rm <thread>")
  .description("Delete a thread")
  .action(
    run(async (threadRef: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      const p = await resolveCanvas(ctx, { create: true });
      const existing = await readSessionFile(ctx.home, ctx.actor.id);
      if (existing) {
        await ctx.client.endSession(existing.canvasId, existing.sessionId).catch(() => {});
      }
      const created = await ctx.client.createSession(p.id, ctx.actor, opts.label, ctx.harness ?? undefined);
      await writeSessionFile(ctx.home, ctx.actor.id, {
        canvasId: p.id,
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
      const p = await resolveCanvas(ctx);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await touchSession(ctx, p.id, {
        cursor: { x: item.x + item.width / 2, y: item.y + item.height / 2 },
        activity: null,
      });
      console.log(`pointing at ${item.id}`);
    }),
  );

session
  .command("on <thread>")
  .description("Say you have picked up a thread — it shows under the comment that asked")
  .option("--say <status>", "what you are doing, shown live in the thread")
  .action(
    run(async (ref: string, opts: { say?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const thread = resolveThread(snapshot, ref);
      await rememberThread(ctx, p.id, thread.id);
      await touchSession(ctx, p.id, {
        activity: { kind: "working", threadId: thread.id },
        // The thread you are ANSWERING, which survives walking off to work on
        // the items it is about — unlike `activity`, which is where you stand.
        onThread: thread.id,
        cursor: threadLocus(snapshot, thread),
        ...(opts.say ? { status: opts.say, statusSource: "explicit" as const } : {}),
      });
      console.error(
        `on ${thread.id}${opts.say ? ` — "${opts.say}"` : ""} (posting a reply clears it)`,
      );
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      const p = await resolveCanvas(ctx);
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
        await ctx.client.endSession(active.canvasId, active.sessionId).catch(() => {});
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
      const p = await resolveCanvas(ctx);
      const sessions = await ctx.client.listSessions(p.id);
      // For the STATE column: blocked derives from open asks, which live in
      // threads — one snapshot, so the column and the workbench roster answer
      // from the same canvas the same way (core/roster.ts, one derivation).
      const { canvas } = await ctx.client.snapshot(p.id);
      // Said on stderr, before the answer and in both shapes: it qualifies
      // what follows, and an agent reading `--json` off stdout needs the
      // caveat as much as a person reading the table does.
      const caveat = await rosterCaveat(ctx, p.id);
      if (caveat) console.error(`note: ${caveat}`);
      if (opts.all) {
        // The API's derivation, consumed rather than copied — `who --all` and
        // a script's `canvas.who()` must answer with one list.
        const known = await new CanvasHandle(ctx, p).who();
        if (ctx.json) return printJson(known);
        return printTable(
          known.map((n) => ({ name: n.name, id: n.id, live: n.live ? "yes" : "—" })),
        );
      }
      /**
       * **The roster tells the truth about absent agents** (phase 6,
       * journey 7). Standing agents get rows beside the live sessions —
       * `answerable` exactly when a live rc holds a connection claiming
       * them (the daemon's connection-bound fact, never a TTL), `enrolled`
       * when the record stands but nobody is listening. Three readings,
       * distinguishable without knowing how any of it works.
       */
      const answering = new Set(
        (await ctx.client.rcAnswering(p.id).catch(() => ({ actorIds: [] as string[] }))).actorIds,
      );
      const liveActorIds = new Set(sessions.filter((s) => s.kind !== "rc").map((s) => s.actor.id));
      const standing = Object.values(canvas.agents ?? {})
        .filter((a) => !liveActorIds.has(a.actor.id))
        .map((a) => ({
          actor: a.actor,
          state: answering.has(a.actor.id) ? ("answerable" as const) : ("enrolled" as const),
        }));
      if (ctx.json) return printJson({ sessions, standing });
      printTable([
        ...sessions.map((s) => ({
          who: s.label ?? s.actor.name,
          // `kind` says cli-or-web; `harness` says WHICH agent. Two agents in
          // one terminal are two `cli` rows, and telling them apart is the
          // reason a person opens this table at all.
          kind: s.harness ?? s.kind,
          // Derived, never asserted: blocked (an unanswered /ask), working,
          // parked (wait's lifecycle status, readable now that statusSource
          // crosses the wire), quiet, here. The workbench renders the same
          // states from the same function.
          state: sessionState(s, canvas, Date.now()),
          cursor: s.cursor ? `${Math.round(s.cursor.x)},${Math.round(s.cursor.y)}` : "—",
          selection: String(s.selection.length || "—"),
          activity: describeActivity(s.activity),
          status: s.status ?? "—",
          seen: s.lastSeen,
        })),
        ...standing.map((a) => ({
          who: a.actor.name,
          kind: "agent",
          state: a.state,
          cursor: "—",
          selection: "—",
          activity: "—",
          status:
            a.state === "answerable"
              ? "answers if you comment"
              : "enrolled — nobody is listening right now",
          seen: "—",
        })),
      ]);
    }),
  );

program
  .command("activity")
  .description("What somebody has been doing on this canvas — newest first")
  .argument("[who]", "actor id or name (default: everyone, most recent first)")
  .option("-n, --limit <n>", "how many acts to show", "10")
  .action(
    run(async (who: string | undefined, opts: { limit: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      const limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit < 1) throw new Error(`--limit wants a number: ${opts.limit}`);

      // Which actors to report on. A name is what a person types; an id is what
      // an op carries — accept either, and say plainly when nobody answers.
      const everyone = collectCanvasActors(snapshot.canvas);
      const actors = who
        ? everyone.filter(
            (a) =>
              a.id === who ||
              actorNameIn(snapshot.names, a).toLowerCase() === who.toLowerCase() ||
              a.name.toLowerCase() === who.toLowerCase(),
          )
        : everyone;
      if (who && actors.length === 0) {
        throw new Error(`nobody on ${p.title} answers to ${who} (isocan who --all)`);
      }

      // The API's assembly, shared with `canvas.activity()` — the WHO filter
      // above is the CLI's own affordance, the shaping is one spelling.
      const rows = activityRows(snapshot, actors, limit);

      if (ctx.json) return printJson(rows);
      if (rows.length === 0) return printTable([]);
      printTable(
        rows.map((r) => ({
          when: r.at,
          who: r.who,
          did: r.kind,
          what: truncate(r.subject, 28),
          ...(r.itemId ? { item: r.itemId } : { item: "—" }),
          said: r.body ? truncate(r.body.replace(/\s+/g, " "), 40) : "—",
        })),
      );
    }),
  );

/** What a session says it is busy with, for a table. */
function describeActivity(activity: PresenceSession["activity"]): string {
  if (!activity) return "—";
  if ("itemId" in activity) return `working on ${activity.itemId}`;
  if ("threadId" in activity) return `on thread ${activity.threadId}`;
  return `working at ${Math.round(activity.x)},${Math.round(activity.y)}`;
}

// The list agents read to pick a free name — `KnownName` and its derivation
// live in `@isocan/api` now (`CanvasHandle.who()`), consumed above, because a
// script asking "who has touched this canvas" must get the same answer as
// `isocan who --all` (iso-api phase 2).

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
    case "agent.enroll":
      return `${who} enrolled ${op.agent.name} — answerable on this canvas`;
    case "agent.withdraw":
      return `${who} dismissed ${op.actorId} — no longer answering here`;
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
    // Claim the thread, not just the spot: the person who asked is looking at
    // the thread, and "somebody's cursor is near that pin" is a guess the
    // renderer should not have to make. This is what puts "reading your
    // comment…" under their message a second after they send it.
    activity: { kind: "working", threadId: op.threadId },
    onThread: op.threadId,
    ...(cursor ? { cursor } : {}),
  };
  const active = await readSessionFile(ctx.home, ctx.actor.id);
  if (active && active.canvasId === entry.canvasId) {
    return touchSession(ctx, entry.canvasId, patch);
  }
  // Summoned to a canvas the session isn't on: move over, keeping the label
  // the human knows this agent by.
  if (active) await ctx.client.endSession(active.canvasId, active.sessionId).catch(() => {});
  const created = await ctx.client.createSession(entry.canvasId, ctx.actor, active?.label, ctx.harness ?? undefined);
  await writeSessionFile(ctx.home, ctx.actor.id, {
    canvasId: entry.canvasId,
    sessionId: created.sessionId,
    ...(active?.label !== undefined ? { label: active.label } : {}),
  });
  await ctx.client.updateSession(entry.canvasId, created.sessionId, patch);
}

program
  .command("wait")
  .description(
    "Block until someone comments for you on this canvas — the agent's feedback loop",
  )
  .option("--all-ops", "wake on any operation by another actor, not just comments")
  .option(
    "--item <ref>",
    "only wake on changes touching this item (repeatable) — implies --all-ops",
    (value: string, prev: string[]) => [...prev, value],
    [],
  )
  .option(
    "--op <type>",
    'only wake on these operations, e.g. item.addVersion or "item.*" (repeatable) — implies --all-ops',
    (value: string, prev: string[]) => [...prev, value],
    [],
  )
  .option("--timeout <sec>", "give up after this many seconds (exit code 2)")
  .option(
    "--since <seq>",
    "start from this oplog position instead of your stored cursor (a repair tool — it also resets the stored cursor)",
  )
  .addHelpText(
    "after",
    `
The wait is on ONE canvas — this directory's (#60), or the one --canvas or
--since names. An agent belongs to the canvas of the directory it works in,
and that canvas is where the human reaches it.

A comment wakes you when it @-mentions you (identity name or session label),
lands in a MAIN thread (\`comment main\`), or lands in a thread you wrote
in or were mentioned in. Everything else — including comments that mention
nobody — is ether: visible in \`tail\`, but not actionable. --all-ops wakes
on everything.

--item and --op narrow which CHANGES wake you, so a watcher does not spend a
turn deciding it does not care:

  isocan wait --item itm_abc --op item.addVersion --json --timeout 900

A summons still wakes you through any filter. Being told to stop is not noise,
and an agent you cannot reach is worse than one that wakes too often — the
JSON says which it was (\`reason\`: "summons" or "change").

Run this in the FOREGROUND, as one tool call: the call returning is your
wake-up. Detached (\`nohup\`, \`&\`, output redirected to a file you poll) it
still holds your cursor but cannot wake you — a file is not a notification.
Size --timeout to the longest call your harness allows. Exit 2 is silence,
not dismissal: park again. A wait that expires never means the collaboration
is over — only the human saying so does.

Your place in the log outlives the process: the daemon keeps a cursor per
actor per canvas, so a park that is killed — mid-gap, mid-turn, however —
resumes exactly where it left off when you park again. Nothing lands in a
gap unseen, and --since is a repair tool, not something to remember. An
entry handed to a turn that died before finishing comes back flagged
\`redelivered\` — you may already have answered it; check the thread before
answering twice. One park per actor per canvas: parking again adopts the
cursor, and the older park exits 3 ("another park adopted this actor's
cursor") — that exit means stand down, not park again.

While parked, the cursor you left on the canvas says "waiting for you…";
waking on a summons then moves your presence for you: your cursor lands on
the thread that woke you, showing "reading your comment…" until your next
command or reply. No \`session start\` needed after a wake.`,
  )
  .action(
    run(async (
      opts: { allOps?: boolean; timeout?: string; since?: string; item: string[]; op: string[] },
      cmd: Command,
    ) => {
      const ctx = await ctxOf(cmd);
      // ONE canvas, always (#60): the --canvas/--since one, or whatever
      // this directory resolves to. There is no home-wide mode — an agent
      // belongs to the canvas of the directory it works in, and its canvas
      // is where the human reaches it.
      const p = await resolveCanvas(ctx);
      // Seed from the watch route itself — the very call the loop will live
      // on — even when --since already names the position. Proving it works
      // HERE is what keeps a wait that cannot poll from ever advertising
      // itself as parked: it dies before it touches presence.
      // Item refs are resolved ONCE, here: a filter naming something that does
      // not exist is a typo, and finding out by waiting forever is the worst
      // way to learn it.
      const snapshot = await ctx.client.snapshot(p.id);
      const wantedItems = opts.item.map((ref) => resolveItem(snapshot, ref).id);
      const wantedTypes = opts.op;
      const filtered = wantedItems.length > 0 || wantedTypes.length > 0;
      const seeded = (await ctx.client.watchLog({ only: [p.id] })).cursors;
      /**
       * **The durable cursor** (on-demand phase 1). The daemon keeps one row
       * per actor per canvas, so the park's place in the log is no longer a
       * `let` that dies with the process — a killed park resumes exactly, and
       * `--since` is a repair tool rather than required knowledge. Claiming
       * ADOPTS the row (one reader, newest wins): the lease below is what a
       * delivery or advance must carry, and a refusal means another park has
       * taken over and this one stands down (exit 3).
       *
       * `redeliverUpTo` is the third door's mechanism: entries a previous
       * park handed to a turn that left no trace come back FLAGGED, never as
       * new — the turn may already have answered them.
       */
      let lease: string | null = null;
      let redeliverUpTo: number | null = null;
      let start =
        opts.since !== undefined
          ? Number(opts.since)
          : (seeded[p.id] ?? (await ctx.client.snapshot(p.id)).lastSeq);
      try {
        const claim = await ctx.client.parkClaim({
          canvasId: p.id,
          actorId: ctx.actor.id,
          ...(opts.since !== undefined ? { since: Number(opts.since) } : {}),
        });
        lease = claim.parkId;
        start = claim.cursor;
        redeliverUpTo = claim.redeliverUpTo;
      } catch (err) {
        // A daemon from before the row existed: park the old way — the
        // in-process cursor — rather than refusing to park at all.
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
      let cursors: Record<string, number> = { [p.id]: start };
      // Called with `return` from inside the loop, so the presence teardown
      // in the `finally` below still runs — a displaced park must not leave
      // a "waiting" cursor behind on its way out.
      const standDown = () => {
        console.error(
          "wait: another park adopted this actor's cursor — it is answering now. " +
            "Standing down; do not park again unless that park is yours to replace.",
        );
        process.exitCode = 3;
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
              .updateSession(active.canvasId, active.sessionId, { status: null })
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
          await touchSession(ctx, session.canvasId, { status, statusSource: "lifecycle" }).catch(
            () => {},
          );
        }
      };

      // Names I answer to: identity name, plus my session label if any.
      const selfNames = namesFor(ctx.actor, session?.label ?? null);

      // The flags, restated as the rule grammar core's `dispatchReason`
      // reads — the same `AgentRules` an enrolment stores, so this park and
      // the rc's dispatch apply ONE composition: mentioned / main-thread /
      // in-your-thread pierces any filter, your own ops never wake you, and
      // filters narrow the changes. `--all-ops` is the `["*"]` spelling.
      const waitRules: AgentRules | undefined = filtered
        ? { items: wantedItems, ops: wantedTypes }
        : opts.allOps
          ? { ops: ["*"] }
          : undefined;

      // Null while the daemon is answering; the moment it stopped, otherwise.
      let offlineSince: number | null = null;
      let complained = false;

      /**
       * **The first idle point** (auto-upgrade phase 4). An agent waiting for
       * feedback is idle by definition, so this is the one moment in a
       * session when swapping the build under it costs nobody anything.
       *
       * Checked on every lap rather than once at the top, because a park lasts
       * minutes to hours and the home moves during it — a single check when
       * the park opened would miss every build cut while the agent was
       * actually waiting, which is all of them.
       *
       * It runs CONCURRENTLY with the long-poll and never blocks it. That is
       * why `installBuild` spawns instead of `spawnSync`: a synchronous npm
       * install here would stop the poll answering and stop the presence
       * heartbeat beating, and the canvas would show a frozen agent for a
       * minute as a side effect of keeping itself current.
       */
      const install = await whichInstall(path.resolve(myRoot()), ctx.home);
      // The build this park is running out of: cleanup deleting it would not
      // stop this process, it would break it mid-park.
      const parkedOn = shaOfRoot(ctx.home, myRoot());
      let upgraded: string | null = null;
      let upgrading = false;
      const considerUpgrade = () => {
        if (upgrading || upgraded) return;
        upgrading = true;
        void (async () => {
          const health = await ctx.client.healthz().catch(() => null);
          upgraded = await autoUpgrade({
            home: ctx.home,
            install,
            health,
            spec: INSTALL_SPEC,
            ...(parkedOn ? { protect: [parkedOn] } : {}),
          });
        })()
          .catch(() => {})
          .finally(() => {
            upgrading = false;
          });
      };

      try {
        await say("waiting for you…");

        for (;;) {
          considerUpgrade();
          const remaining = deadline === null ? Infinity : deadline - Date.now();
          if (remaining <= 0) {
            // Exit 2 is silence, not dismissal. Say so on the way out: an
            // agent that reads "timed out" as "we're done here" is the most
            // common way a session dies with nobody deciding to end it.
            if (upgraded) console.error(upgraded);
            console.error(
              "wait: timed out with no feedback — nobody came yet. Park again; " +
                "the session ends when the human says so, not when a wait expires.",
            );
            process.exitCode = 2;
            return;
          }
          const window = Math.max(1, Math.min(30_000, remaining === Infinity ? 30_000 : remaining));
          /**
           * **A daemon that goes away mid-park is not the end of the park.**
           *
           * This is a LONG-POLL against the local daemon — always, even for a
           * canvas whose home is elsewhere, because the CLI's one address is
           * `127.0.0.1`. So anything that restarts that daemon severs the
           * connection under a parked agent: `isocan restart`, an upgrade, a
           * laptop waking up. Before this, the fetch rejected and the whole
           * command exited 1 with `error: fetch failed` — an agent that had
           * done nothing wrong, told nothing useful, and dropped out of a
           * session it was supposed to be holding. Found the hard way: a
           * developer restarting a daemon all afternoon knocked every parked
           * agent off, and one of them wrote its own retry loop to survive.
           *
           * A connection-level failure is therefore a PAUSE, not an end. The
           * cursors are unchanged, so nothing is missed on the way back —
           * `watchLog` resumes exactly where it was, and the ops written while
           * the daemon was down are still in the log to be read.
           *
           * The deadline is still the deadline: retrying cannot outlive the
           * `--timeout` the caller asked for, so a daemon that never comes
           * back still ends the park on time rather than hanging forever.
           */
          let batch;
          try {
            batch = await ctx.client.watchLog({ cursors, waitMs: window, only: [p.id] });
            // Back after a gap: say so, and put presence back. The daemon that
            // went away took the session with it, so the canvas has been
            // showing nothing where this agent should be.
            if (offlineSince !== null) {
              const gap = Math.round((Date.now() - offlineSince) / 1000);
              console.error(`wait: daemon back after ${gap}s — still parked, nothing missed`);
              offlineSince = null;
              await say("waiting for you…");
            }
          } catch (err) {
            // The daemon ANSWERING with a refusal is a different thing
            // entirely and must not be retried into a loop — an `ApiError`
            // means somebody was there to say no. Only a connection that
            // never got an answer is a blip.
            if (err instanceof ApiError) throw err;
            /**
             * **A park that outlives its daemon brings it back.**
             *
             * Retrying a dead socket forever was half a fix. It stopped the
             * park exiting on a restart, which was the reported bug — but if
             * nothing else happened to run a command, nothing ever started
             * the daemon again, and the agent sat in a silent loop looking
             * parked while hearing nothing. Which is the same failure as
             * before wearing a calmer face, and harder to notice: the first
             * version at least said `error: fetch failed`.
             *
             * Every other verb in this CLI auto-starts the daemon it needs.
             * A park is the one command that runs for minutes with no daemon
             * of its own to lean on, so it is the one that most needs to.
             * `ensureDaemon` no-ops when something is already answering, so
             * this costs a health check per retry and nothing else.
             */
            if (offlineSince === null) offlineSince = Date.now();
            await ctx.client.ensureDaemon().catch(() => {});
            // …and say it out loud, once, after long enough that a restart
            // is not worth mentioning. Silence is what made this look like a
            // healthy park; three seconds of it is a fact worth one line.
            if (!complained && Date.now() - offlineSince > 3000) {
              complained = true;
              console.error(
                "wait: the daemon stopped answering — retrying, and starting it if it is gone. " +
                  "Still parked; nothing that lands meanwhile is missed.",
              );
            }
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          cursors = batch.cursors;
          const snaps = new Map<string, Promise<CanvasSnapshotResponse>>();
          const snapOf = (canvasId: string) => () => {
            let pending = snaps.get(canvasId);
            if (!pending) snaps.set(canvasId, (pending = ctx.client.snapshot(canvasId)));
            return pending;
          };
          const matches: WatchedLogEntry[] = [];
          let summoned = false;
          for (const entry of batch.entries) {
            const op = entry.envelope.op;
            // THE routing composition, imported (core's `dispatchReason`,
            // phase 4): self never wakes, a summons pierces any filter, a
            // change is taken when the rules ask. The snapshot is fetched
            // only when the decision needs canvas state — a comment's
            // thread, or an item filter.
            const needCanvas =
              op.type === "thread.create" ||
              op.type === "thread.reply" ||
              (waitRules?.items?.length ?? 0) > 0;
            const snapshot = needCanvas ? await snapOf(entry.canvasId)() : null;
            const reason = dispatchReason(
              op,
              entry.envelope.actor.id,
              {
                actorId: ctx.actor.id,
                names: selfNames,
                rules: waitRules,
                ...(snapshot?.joined !== undefined ? { joined: snapshot.joined } : {}),
              },
              snapshot?.canvas ?? null,
            );
            if (!reason) continue;
            if (reason !== "change") summoned = true;
            matches.push(entry);
          }
          if (matches.length > 0) {
            // Record the delivery BEFORE anything is shown or advertised: a
            // lease refusal here means another park owns this actor's cursor
            // now, and this one must vanish without emitting a single entry —
            // two parks both presenting the same comment as new is the exact
            // failure the row exists to prevent. Any other failure is fatal
            // for the same reason in mirror: a wake the row never heard about
            // would come back unmarked next time.
            if (lease) {
              try {
                await ctx.client.parkDelivered({
                  canvasId: p.id,
                  actorId: ctx.actor.id,
                  parkId: lease,
                  tip: cursors[p.id] ?? 0,
                });
              } catch (err) {
                if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
                  return standDown();
                }
                throw err;
              }
            }
            // Entries a previous park handed to a turn that died carry the
            // flag: the turn may already have answered them.
            const flagged =
              redeliverUpTo === null
                ? matches
                : matches.map((m) =>
                    m.seq <= redeliverUpTo ? { ...m, redelivered: true } : m,
                  );
            // A summons (a comment for me) lands presence on its canvas
            // automatically — cursor on the thread, "reading your comment…"
            // — so the canvas never goes silent between wake and first op.
            const summons = matches.find(
              (m) =>
                m.envelope.op.type === "thread.create" ||
                m.envelope.op.type === "thread.reply",
            );
            if (summons) {
              woken = await landPresence(ctx, summons, snapOf(summons.canvasId)).then(
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
                entries: flagged,
                reason: summoned ? "summons" : "change",
                /**
                 * **The wake carries the upgrade** (auto-upgrade phase 4), in
                 * the same message as the feedback it woke for, because an
                 * agent reads one payload and then acts. A separate channel
                 * would be a notice nobody read. `agent-guide.md` ships inside
                 * the build, so the line tells the agent to re-read it.
                 */
                ...(upgraded ? { upgraded } : {}),
                next: summoned
                  ? "reply on the thread, then `isocan wait` again — a lap ends parked"
                  : "do the work the change asks for, then `isocan wait` again — a lap ends parked",
              });
            }
            if (upgraded) console.error(upgraded);
            for (const entry of flagged) {
              const again = entry.redelivered
                ? " (delivered before — you may already have answered; check the thread)"
                : "";
              console.log(`${describeEntry(entry)}${again}`);
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
          // Nothing matched: settle the noise so no future park re-reads it.
          // A lease refusal is the displaced park finding out; any other
          // failure is survivable — the next claim merely re-scans noise.
          if (lease) {
            try {
              await ctx.client.parkAdvance({
                canvasId: p.id,
                actorId: ctx.actor.id,
                parkId: lease,
                to: cursors[p.id] ?? 0,
              });
            } catch (err) {
              if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
                return standDown();
              }
            }
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

/**
 * **Standing agents** (agents-on-demand phase 2). Two spellings of one
 * machinery, and the split IS the vocabulary (decided 2026-08-30): `isocan
 * rc` is what a person types, `isocan agent` is what an agent types — same
 * verbs, different words, so who may do what is legible in what they type.
 *
 * The agent's verb is the containment: `isocan agent add` takes no --canvas
 * and no --dir, both come from where the agent already stands, so an agent
 * can only ever add an agent beside itself. Where the person's word for an
 * add is checked (decided 2026-08-30): in the open — every add is an op in
 * the log with the adding agent as author, narrated live by a running rc,
 * and withdrawal is one gesture away; a mechanical gate waits for phase 4,
 * where a summoned turn gives it something real to anchor to.
 */

/** Both add verbs land here; `contained` is the agent spelling's rule. */
/**
 * The enrolment's two moves plus its records, shared by the verbs and the
 * rc's web-ask handler (agent-custody mechanism 2): claim the actor
 * first-claim on THIS machine's badge, enroll it, seed its cursor at the
 * enrolment op, write the rc half. Whoever calls this is the machine that
 * answers for the agent — which is the custody design in one sentence.
 */
async function mintAndEnrol(
  ctx: Ctx,
  canvasId: string,
  name: string,
  opts: { cwd: string; harness: string | null; rules?: unknown },
): Promise<Actor> {
  // The actor is minted through the same claim everything else uses, keyed
  // per NAME on this badge — so re-enrolling Sian after a withdrawal hands
  // the same Sian back, history intact; so does enrolling Sian on a SECOND
  // canvas from this machine (standing agents, phase 1): one machine, one
  // Sian, standing wherever she is enrolled. A name worn by somebody else is
  // refused by the registry rather than silently doubled. Phase 3 rebinds the actor to
  // its adapter-born session key when a session first exists.
  const claimed = await ctx.client.claimActor({
    type: "actor.claim",
    // The SAME key the rc's injected environment will present when this
    // agent's sessions run (acp.ts `enrolmentKey`): the mint claim IS the
    // session binding, so a CLI-added agent needs no rebinding, ever.
    sessionKey: enrolmentKey(name),
    name,
  });
  const agent = claimed.envelope.actor;
  const enrolled = await ctx.client.sendOp(canvasId, ctx.actor, {
    type: "agent.enroll",
    agent,
    ...(opts.rules !== undefined ? { rules: opts.rules } : {}),
  });
  // The cursor row is born WITH the standing (phase 4, journey 3): a
  // comment landing five minutes after this — rc running or not — must
  // reach the agent's first summons, so the row's floor is the enrolment
  // op itself, never "whenever something first claimed".
  await ctx.client
    .parkClaim({ canvasId, actorId: agent.id, seedAt: enrolled.seq })
    .catch(() => {});
  await upsertRcAgent(ctx.home, {
    canvasId,
    actorId: agent.id,
    name: agent.name,
    harness: opts.harness,
    cwd: opts.cwd,
    sessionId: null,
  });
  return agent;
}

async function enrolAgent(
  cmd: Command,
  name: string,
  opts: { dir?: string; harness?: string; rules?: string },
  contained: boolean,
): Promise<void> {
  const ctx = await ctxOf(cmd);
  if (contained && canvasRefOf(cmd.optsWithGlobals() as { canvas?: string; project?: string }, null) !== undefined) {
    throw new Error(
      "`isocan agent add` enrolls beside itself — no --canvas. Pointing anywhere is a person's gesture: `isocan rc add`.",
    );
  }
  const p = await resolveCanvas(ctx);
  const cwd = path.resolve(opts.dir ?? process.cwd());
  // The rc half's harness: a flag (rc add), else the enrolling caller's own
  // — an agent enrolls an agent like itself — else null, "not yet said".
  const harness = opts.harness ?? ctx.harness ?? null;
  const rules: unknown = opts.rules !== undefined ? JSON.parse(opts.rules) : undefined;
  const agent = await mintAndEnrol(ctx, p.id, name, { cwd, harness, rules });
  if (ctx.json) return printJson({ enrolled: agent, canvasId: p.id });
  console.log(
    `enrolled ${agent.name} — answerable on "${p.title}". A running \`isocan rc\` picks this up without a restart; nothing runs until something arrives.`,
  );
}

/** Both remove verbs land here — the standing goes, the history stays. */
async function withdrawAgent(cmd: Command, name: string, contained: boolean): Promise<void> {
  const ctx = await ctxOf(cmd);
  if (contained && canvasRefOf(cmd.optsWithGlobals() as { canvas?: string; project?: string }, null) !== undefined) {
    throw new Error(
      "`isocan agent remove` withdraws beside itself — no --canvas. Pointing anywhere is a person's gesture: `isocan rc remove`.",
    );
  }
  const p = await resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(p.id);
  const agents = snapshot.canvas.agents ?? {};
  const row = Object.values(agents).find(
    (a) => a.actor.id === name || a.actor.name.toLowerCase() === name.toLowerCase(),
  );
  if (!row) {
    const standing = Object.values(agents).map((a) => a.actor.name);
    throw new Error(
      `no standing agent "${name}" on "${p.title}"` +
        (standing.length > 0 ? ` — standing here: ${standing.join(", ")}` : " — nobody is enrolled here"),
    );
  }
  await ctx.client.sendOp(p.id, ctx.actor, { type: "agent.withdraw", actorId: row.actor.id });
  await removeRcAgent(ctx.home, p.id, row.actor.id);
  if (ctx.json) return printJson({ withdrawn: row.actor, canvasId: p.id });
  console.log(
    `dismissed ${row.actor.name} — the standing is withdrawn, the history untouched.`,
  );
}

const agentCommand = program
  .command("agent")
  .description("Standing agents, spoken by an agent — add or dismiss one beside yourself")
  .addHelpText(
    "after",
    `
The agent spelling of \`isocan rc\`'s verbs, and the syntax is the
containment: no --canvas, no --dir — the agent you add lives on THIS
directory's canvas, beside you. Add one when a person asks you to; the add
is an op everyone can read, and a running \`isocan rc\` narrates it.`,
  );

agentCommand
  .command("add <name>")
  .description("Enrol an agent beside yourself — on this canvas, in this directory")
  .option("--rules <json>", "routing rules, stored as handed over (interpreted from phase 4)")
  .action(
    run(async (name: string, opts: { rules?: string }, cmd: Command) =>
      enrolAgent(cmd, name, opts, true),
    ),
  );

agentCommand
  .command("remove <name>")
  .description("Withdraw an agent's standing here — on a person's word")
  .action(run(async (name: string, _opts: unknown, cmd: Command) => withdrawAgent(cmd, name, true)));

agentCommand
  .command("rules [name]")
  .description("What an agent answers for here, and why — the routing rules, readable in one place")
  .action(
    run(async (name: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const agents = Object.values((await ctx.client.snapshot(p.id)).canvas.agents ?? {});
      const wanted = name
        ? agents.filter((a) => a.actor.name.toLowerCase() === name.toLowerCase() || a.actor.id === name)
        : agents;
      if (name && wanted.length === 0) throw new Error(`no standing agent "${name}" on "${p.title}"`);
      if (ctx.json) {
        return printJson(
          wanted.map((a) => ({ actor: a.actor, rules: rulesOf(a.rules) })),
        );
      }
      if (wanted.length === 0) {
        console.log(`nobody is enrolled on "${p.title}"`);
        return;
      }
      for (const a of wanted) {
        const rules = rulesOf(a.rules);
        const parts: string[] = [];
        if (rules.items?.length) parts.push(`changes touching ${rules.items.join(", ")}`);
        if (rules.ops?.length) parts.push(`ops: ${rules.ops.join(", ")}`);
        console.log(
          `${a.actor.name} — ${parts.length > 0 ? parts.join("; ") : "comments addressed to them (the default)"}`,
        );
      }
      // The standing truths, once — they hold through every rule set, and
      // "readable in one place" means the exceptions are readable too.
      console.log(
        "(always: a comment naming an agent — or landing in the Chat, or in a thread they are part of — " +
          "comes through any rule set; an agent's own ops never wake it)",
      );
    }),
  );

const rcCommand = program
  .command("rc")
  .description("Answer for this canvas's enrolled agents — a person's long-running command")
  .addHelpText(
    "after",
    `
Bare \`isocan rc\` takes no arguments: the directory's binding supplies the
canvas, the enrolment records supply the roster. Starting it spawns nothing
— it enables. It narrates events as they happen (an enrolment, a
withdrawal, a summons); the roster is read where rosters are read,
\`isocan who\`. Ctrl-C stops answering for everyone; the enrolments survive
to its next start.

An agent never starts an rc — inside a harness session this refuses, and
the agent's spelling of the verbs is \`isocan agent\`.`,
  );

rcCommand
  .command("add <name>")
  .description("Enrol an agent — the person's point-anywhere form")
  .option("--dir <path>", "the agent's working directory (default: here)")
  .option("--harness <name>", "how its sessions start (default: yours, else unsaid)")
  .option("--rules <json>", "routing rules, stored as handed over (interpreted from phase 4)")
  .action(
    run(async (name: string, opts: { dir?: string; harness?: string; rules?: string }, cmd: Command) =>
      enrolAgent(cmd, name, opts, false),
    ),
  );

rcCommand
  .command("remove <name>")
  .description("Withdraw an agent's standing on this canvas")
  .action(run(async (name: string, _opts: unknown, cmd: Command) => withdrawAgent(cmd, name, false)));

rcCommand
  .command("turn <name> <prompt...>")
  .description("Start one turn in an enrolled agent and read its stopReason (phase 3 plumbing)")
  .addHelpText(
    "after",
    `
The machinery dispatch (phase 4) will drive on a summons, driven by hand:
spawn the agent's ACP adapter, resume its session (or start one), send the
prompt, narrate the turn, print the stopReason. The session survives this
process — the resume handle is stored in the enrolment's rc half, and a
handle that fails to load twice is replaced by a fresh session rather than
an error. Adapters: claude-code ships known; others are declared in
~/.isocan/config.json as {"acpAdapters": {"<harness>": ["cmd", "arg"]}}.`,
  )
  .action(
    run(async (name: string, promptWords: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      // A person's verb, like bare rc: an agent puppeting another agent's
      // turns is not a gesture this phase grants.
      if ((await harnessSessions(ctx.home)).length > 0) {
        throw new Error(
          "`isocan rc turn` is a person's verb, and this is a harness session — an agent reaches " +
            "another agent by commenting, not by driving its turns.",
        );
      }
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const record = Object.values(snapshot.canvas.agents ?? {}).find(
        (a) => a.actor.name.toLowerCase() === name.toLowerCase() || a.actor.id === name,
      );
      if (!record) throw new Error(`no standing agent "${name}" on "${p.title}"`);
      // The rc half: where and how. Missing (a web add, no rc ever parked
      // here) means this process supplies them, the same adoption the
      // parked rc makes.
      let row = (await readRcAgents(ctx.home)).find(
        (r) => r.canvasId === p.id && r.actorId === record.actor.id,
      );
      if (!row) {
        row = {
          canvasId: p.id,
          actorId: record.actor.id,
          name: record.actor.name,
          harness: null,
          cwd: process.cwd(),
          sessionId: null,
        };
        await upsertRcAgent(ctx.home, row);
      }
      const spec = await adapterFor(ctx.home, row.harness);
      if (!spec) {
        throw new Error(
          `no ACP adapter is known for harness "${row.harness}" — declare one in ~/.isocan/config.json: ` +
            `{"acpAdapters": {"${row.harness}": ["command", "arg"]}}`,
        );
      }
      // The binding: make the machine badge answer for the enrolled actor
      // under the key the injected environment presents. For a CLI-added
      // agent this is the mint claim resuming (a no-op); for a web-added
      // one it is the one rebinding the spike showed is needed.
      await ctx.client.claimActor({
        type: "actor.claim",
        sessionKey: enrolmentKey(record.actor.name),
        as: record.actor.id,
      });

      console.error(`rc: starting ${spec.command} for ${record.actor.name} in ${row.cwd}`);
      const agent = await AcpAgentProcess.spawn(spec, {
        cwd: row.cwd,
        env: adapterEnv(p.id, record.actor.name),
      });
      try {
        const session = await agent.ensureSession(row.cwd, row.sessionId);
        console.error(
          session.resumed
            ? `rc: session ${session.sessionId} resumed`
            : `rc: session ${session.sessionId} started${row.sessionId ? " (the stored one would not load — rebuilt)" : ""}`,
        );
        await setRcSessionId(ctx.home, p.id, record.actor.id, session.sessionId);
        const turn = await agent.prompt(session.sessionId, promptWords.join(" "), (event) => {
          if (event.kind === "chunk" && event.text) process.stdout.write(event.text);
          else if (event.kind === "tool") console.error(`rc: [tool] ${event.detail}`);
          else if (event.kind === "permission") console.error(`rc: [permission] ${event.detail}`);
        });
        process.stdout.write("\n");
        console.error(`rc: turn ended — stopReason ${turn.stopReason}`);
        if (turn.stopReason !== "end_turn") process.exitCode = 1;
      } finally {
        agent.close();
      }
    }),
  );

rcCommand.action(
  run(async (_opts: unknown, cmd: Command) => {
    const ctx = await ctxOf(cmd);
    /**
     * The user/agent divide, enforced (the naming door's residue, decided
     * 2026-08-30): an rc inside a harness session would block the tool call
     * until the harness kills it, while standing up a parent-of-agents no
     * person started. The divide lives in the vocabulary; this is the
     * vocabulary holding.
     */
    const sessions = await harnessSessions(ctx.home);
    if (sessions.length > 0) {
      throw new Error(
        "`isocan rc` is a person's verb, and this is a harness session — a bare rc here would block " +
          "this turn until the harness kills it. Your spelling of its verbs is `isocan agent`.",
      );
    }
    const p = await resolveCanvas(ctx);
    const rosterOf = async () => {
      const snapshot = await ctx.client.snapshot(p.id);
      return snapshot.canvas.agents ?? {};
    };
    const rcCwd = process.cwd();
    // The rc supplies WHERE and HOW for enrolments that arrived without an
    // rc half — the web's adds, and any it missed while down. Quiet: this is
    // record housekeeping, not an event. The home half stays authoritative:
    // rc rows for this canvas with no standing enrolment are dead, reaped.
    const reconcile = async (roster: Record<string, import("@isocan/core").EnrolledAgent>) => {
      for (const record of Object.values(roster)) {
        await adoptRcAgent(ctx.home, {
          canvasId: p.id,
          actorId: record.actor.id,
          name: record.actor.name,
          harness: null,
          cwd: rcCwd,
          sessionId: null,
        });
      }
      for (const row of await readRcAgents(ctx.home)) {
        if (row.canvasId === p.id && !roster[row.actorId]) {
          await removeRcAgent(ctx.home, p.id, row.actorId);
        }
      }
    };
    // Names for the withdraw narration: state drops the row before the op is
    // read here, so remember every name this process has seen.
    const known = new Map<string, string>();
    const opening = await rosterOf();
    for (const [id, row] of Object.entries(opening)) known.set(id, row.actor.name);
    await reconcile(opening);
    /**
     * The parked rc announces itself: a presence session of kind "rc" —
     * rendered nowhere (no cursor, no face, no roster row), it exists so the
     * add-agent dialog can say "an rc is parked here" instead of guessing.
     * TTL retires it if this process dies rudely; the heartbeat below keeps
     * it alive while parked. This is a convenience signal, NOT the
     * "answerable" truth — that is phase 6's, connection-bound.
     */
    const announced = await ctx.client
      .createSession(p.id, ctx.actor, undefined, undefined, "rc")
      .catch(() => null);
    const standDownAnnouncement = async () => {
      if (announced) await ctx.client.endSession(p.id, announced.sessionId).catch(() => {});
    };
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        void standDownAnnouncement().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
      });
    }
    // Quiet at start, the way `claude rc` is — but never mute about WHERE.
    // The first real user's first stumble was exactly this: a title with no
    // address is a place you cannot get to. Two lines: where this is, and
    // what happens next (with the door named when the roster is empty — a
    // how-to-add is not a roster listing). Names stay unlisted; `isocan
    // who` is where rosters are read.
    const origin = (await ctx.homeOf(p.id).catch(() => null)) ?? ctx.client.base;
    console.log(`rc: answering on "${p.title}" — ${canvasUrl(origin, p.id)}`);
    const enrolledCount = Object.keys(opening).length;
    console.log(
      enrolledCount === 0
        ? "rc: nobody is enrolled yet — Add an agent in the tray at that address; this rc picks it up without a restart"
        : `rc: ${enrolledCount} ${enrolledCount === 1 ? "agent" : "agents"} enrolled (\`isocan who\` names them) — quiet until something arrives (Ctrl-C stops answering)`,
    );

    /**
     * **Dispatch** (phase 4). One quiet connection, fanned out: the rc holds
     * a phase-1 cursor row per enrolled agent (adopting it — a plain `wait`
     * park as the same actor is displaced, per the phase-1 door), reads the
     * log once per lap from the earliest of them, and applies core's
     * `dispatchReason` per agent — the same composition `wait` imports, so
     * the park and the dispatcher cannot drift. A summons carries every
     * pending matched entry; ops landing mid-turn sit behind the cursor and
     * become the next summons when the turn completes. The rc sees
     * `end_turn` directly, so completion is an explicit advance, not the
     * park's inferred evidence.
     */
    interface AgentDispatch {
      parkId: string;
      cursor: number;
      redeliverUpTo: number | null;
      /** Matched entries awaiting a turn, in log order. */
      pending: WatchedLogEntry[];
      scannedTip: number;
      busy: boolean;
      /** After a failed turn: hold the pending batch until this passes —
       * a broken adapter must not hot-loop; the thread already carries the
       * refusal (phase 5). */
      retryAfter: number;
      /** Turn-start times inside the sliding hour — the ceiling's memory. */
      turnTimes: number[];
      /** Consecutive turns whose batch held no person's word — the cycle
       * guard's count. A human comment resets it. */
      agentChain: number;
      /** Which limit is holding the current batch, so its refusal is said
       * once, not once per lap. */
      held: "ceiling" | "cycle" | null;
    }
    /** The limits (phase 5): a ceiling on turns per agent per hour, and a
     * bound on agent-to-agent chains. `config.json`'s `rcLimits` hook
     * overrides either. */
    const limitsConfig = await readConfigFile<{
      rcLimits?: { turnsPerHour?: number; agentChain?: number };
    }>(ctx.home);
    const TURNS_PER_HOUR = limitsConfig.rcLimits?.turnsPerHour ?? 12;
    const AGENT_CHAIN = limitsConfig.rcLimits?.agentChain ?? 3;
    /** The system voice, into the thread where the person is looking —
     * journey 5's acceptance. Never authored as the agent (words in a dead
     * agent's mouth) and never as the person (sentences no person wrote). */
    const sayInThread = async (threadId: string | null, body: string): Promise<void> => {
      if (!threadId) return;
      await ctx.client
        .sendOp(p.id, SYSTEM_ACTOR, {
          type: "thread.reply",
          threadId,
          comment: { id: newId("cmt"), body },
        })
        .catch(() => {});
    };
    const threadOf = (entries: WatchedLogEntry[]): string | null => {
      const comment = entries.find(
        (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
      );
      return comment ? (comment.envelope.op as { threadId: string }).threadId : null;
    };
    const dispatches = new Map<string, AgentDispatch>();
    // Where each standing began — the floor for a cursor row that does not
    // exist yet (a web add with no rc parked, and nothing to claim it since).
    // One log read at start; the enrol verb and the live enroll event carry
    // their own seqs.
    const enrolSeqs = new Map<string, number>();
    for (const entry of await ctx.client.getLog(p.id, 0)) {
      if (entry.envelope.op.type === "agent.enroll") {
        enrolSeqs.set(entry.envelope.op.agent.id, entry.seq);
      }
    }
    const claimAgent = async (actorId: string, seedAt?: number): Promise<void> => {
      if (dispatches.has(actorId)) return;
      try {
        const floor = seedAt ?? enrolSeqs.get(actorId);
        const claim = await ctx.client.parkClaim({
          canvasId: p.id,
          actorId,
          ...(floor !== undefined ? { seedAt: floor } : {}),
        });
        dispatches.set(actorId, {
          parkId: claim.parkId,
          cursor: claim.cursor,
          redeliverUpTo: claim.redeliverUpTo,
          pending: [],
          scannedTip: claim.cursor,
          busy: false,
          retryAfter: 0,
          turnTimes: [],
          agentChain: 0,
          held: null,
        });
      } catch (err) {
        console.log(`rc: could not hold ${known.get(actorId) ?? actorId}'s cursor — ${(err as Error).message}`);
      }
    };
    for (const actorId of Object.keys(opening)) await claimAgent(actorId);

    /**
     * **The connection IS the fact** (phase 6). This hold, re-issued
     * back-to-back forever, is what makes the roster's `answerable` true:
     * the daemon counts these agents answerable exactly while a hold is
     * open, and a dead rc's socket closes instantly — no window, no TTL
     * lie, per journey 7. Ten-second holds so a fresh enrolment joins the
     * claim within seconds; the microsecond gap between holds can only err
     * toward "not answerable", the permitted direction.
     */
    void (async () => {
      for (;;) {
        try {
          const held = await ctx.client.rcHold({
            canvasId: p.id,
            actorIds: [...dispatches.keys()],
            waitMs: 10_000,
          });
          /**
           * **The handshake's last hop** (agent-custody mechanism 2): the Web
           * UI's "add an agent" arrives inside the hold, and THIS process —
           * the one that will answer for the agent — makes the same moves
           * `isocan agent add` makes, so the actor is born first-claim on
           * this machine's badge and the relayed face vouches. The web
           * dialog watches for the enroll op to land; a refusal here (a name
           * already worn) is narrated where the rc's person is looking and
           * surfaces at the dialog as its countdown running out.
           */
          for (const ask of held.asks ?? []) {
            console.log(`rc: ${ask.from.name} asked from the canvas to add ${ask.name} — enrolling here`);
            try {
              await mintAndEnrol(ctx, p.id, ask.name, { cwd: rcCwd, harness: null });
            } catch (err) {
              console.log(`rc: could not enrol ${ask.name} — ${(err as Error).message}`);
            }
          }
        } catch {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    })();


    /**
     * **The auto-upgrade window, restored** (the design's open question,
     * settled at phase 4's door): `considerUpgrade` lost its park when
     * summoned sessions stopped parking — but the rc IS the parked process
     * now, and its quiet laps are the idle point. Same machinery as `wait`'s:
     * concurrent, never blocking the poll.
     */
    const install = await whichInstall(path.resolve(myRoot()), ctx.home);
    const parkedOn = shaOfRoot(ctx.home, myRoot());
    let upgraded: string | null = null;
    let upgrading = false;
    const considerUpgrade = () => {
      if (upgrading || upgraded) return;
      upgrading = true;
      void (async () => {
        const health = await ctx.client.healthz().catch(() => null);
        upgraded = await autoUpgrade({
          home: ctx.home,
          install,
          health,
          spec: INSTALL_SPEC,
          ...(parkedOn ? { protect: [parkedOn] } : {}),
        });
        if (upgraded) console.log(`rc: ${upgraded}`);
      })()
        .catch(() => {})
        .finally(() => {
          upgrading = false;
        });
    };

    /** The fixed brief around the wait-shaped payload (phase 4's door):
     * identical for fresh and loaded sessions — delivery differs, content
     * never does — with orientation and the guide pointer carrying the
     * cold-arrival weight instead of 15k inlined tokens. */
    const summonsPrompt = (
      agentName: string,
      payload: { reason: string; entries: WatchedLogEntry[] },
    ): string =>
      `You are ${agentName}, an agent enrolled on the isocan canvas "${p.title}". ` +
      `This is a summons: activity addressed to you arrived while nothing was running for you. ` +
      `Work from this directory through the \`isocan\` CLI — \`isocan --agent-help\` is the full ` +
      `protocol if you need orientation, and \`isocan comment reply <threadId> "…"\` answers a comment. ` +
      `Address what the payload below carries, reply on its thread, and then simply finish your ` +
      `turn: do NOT run \`isocan wait\` — your session rests when you stop, and new activity ` +
      `summons you again.\n\n` +
      `The payload (the same shape \`isocan wait --json\` returns):\n` +
      JSON.stringify(payload, null, 2);

    /** One summoned turn: adapter up, session loaded-or-new, presence on
     * while it runs and gone when it ends (journey 2's acceptance — the
     * summoned equivalent of the park's `landPresence`). */
    const runSummons = async (record: EnrolledAgent, dispatch: AgentDispatch): Promise<void> => {
      const entries = dispatch.pending.splice(0);
      const tip = dispatch.scannedTip;
      try {
        await runSummonsInner(record, dispatch, entries, tip);
      } catch (err) {
        // The batch goes back on the shelf: in-process it retries after the
        // pause below; across a crash the un-advanced cursor row redelivers
        // it marked. Either way nothing is silently dropped.
        dispatch.pending.unshift(...entries);
        throw err;
      }
    };

    const runSummonsInner = async (
      record: EnrolledAgent,
      dispatch: AgentDispatch,
      entries: WatchedLogEntry[],
      tip: number,
    ): Promise<void> => {
      const flagged =
        dispatch.redeliverUpTo === null
          ? entries
          : entries.map((e) => (e.seq <= dispatch.redeliverUpTo! ? { ...e, redelivered: true } : e));
      dispatch.redeliverUpTo = null;
      const summoned = flagged.some(
        (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
      );
      const reason = summoned ? "summons" : "change";
      const from = flagged[0]?.envelope.actor.name ?? "someone";
      console.log(
        `rc: summons for ${record.actor.name} (${reason}, from ${from}, ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"}) — starting a session`,
      );
      try {
        await ctx.client.parkDelivered({
          canvasId: p.id,
          actorId: record.actor.id,
          parkId: dispatch.parkId,
          tip,
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
          console.log(`rc: another park adopted ${record.actor.name}'s cursor — standing down for it`);
          dispatches.delete(record.actor.id);
          return;
        }
        throw err;
      }
      const row =
        (await readRcAgents(ctx.home)).find(
          (r) => r.canvasId === p.id && r.actorId === record.actor.id,
        ) ?? {
          canvasId: p.id,
          actorId: record.actor.id,
          name: record.actor.name,
          harness: null,
          cwd: rcCwd,
          sessionId: null,
        };
      const spec = await adapterFor(ctx.home, row.harness);
      if (!spec) {
        throw new Error(`no ACP adapter for harness "${row.harness}" — config.json's acpAdapters hook declares one`);
      }
      // The binding (phase 3): idempotent for CLI-added agents, the one
      // rebinding a web-added one needs.
      await ctx.client.claimActor({
        type: "actor.claim",
        sessionKey: enrolmentKey(record.actor.name),
        as: record.actor.id,
      });
      // Presence: the summoned session is SEEN — it appears when the turn
      // starts and fades when it ends, because the session ends, not a TTL.
      const firstComment = flagged.find(
        (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
      );
      const face = await ctx.client
        .createSession(p.id, record.actor, undefined, row.harness ?? "agent")
        .catch(() => null);
      // Where the summons points, so the face lands somewhere rather than
      // floating unplaced: the summoning thread, or (a routed change) the
      // first changed item. `working` is re-asserted on every beat below —
      // it is what animates the cursor, and each applied op retires it.
      const threadId = firstComment
        ? (firstComment.envelope.op as { threadId: string }).threadId
        : null;
      const changedItemId = (flagged[0]?.envelope.op as { itemId?: string }).itemId ?? null;
      let working: import("@isocan/core").PresenceActivity | null = null;
      if (face) {
        const snapshot = await ctx.client.snapshot(p.id).catch(() => null);
        const thread = threadId ? snapshot?.canvas.threads[threadId] : undefined;
        const item = !threadId && changedItemId ? snapshot?.canvas.items[changedItemId] : undefined;
        working = threadId
          ? { kind: "working", threadId }
          : item
            ? { kind: "working", itemId: item.id }
            : null;
        await ctx.client
          .updateSession(p.id, face.sessionId, {
            status: threadId ? "reading your comment…" : "looking at what changed…",
            statusSource: "lifecycle",
            ...(working ? { activity: working } : {}),
            ...(threadId ? { onThread: threadId } : {}),
            ...(snapshot && thread ? { cursor: threadLocus(snapshot, thread) } : {}),
            ...(item ? { cursor: itemCenter(item) } : {}),
          })
          .catch(() => {});
        // The face's id goes into the actor's session pointer file — the
        // loan that makes the agent's OWN CLI commands presence-visible
        // inside the turn: `narrate` finds a session and speaks, and every
        // op carries a clientId, so the cursor traces the real work. This
        // is the same wiring `session start` does for a direct agent; a
        // summoned one just has it done for it. Taken back in the finally
        // below: a dangling pointer would have the actor's NEXT direct
        // command revive a face nobody ended.
        const before = await readSessionFile(ctx.home, record.actor.id);
        if (before && !(before.canvasId === p.id && before.sessionId === face.sessionId)) {
          await ctx.client.endSession(before.canvasId, before.sessionId).catch(() => {});
        }
        await writeSessionFile(ctx.home, record.actor.id, {
          canvasId: p.id,
          sessionId: face.sessionId,
          ...(threadId ? { onThread: threadId, onThreadAt: new Date().toISOString() } : {}),
        }).catch(() => {});
      }
      const beat = (patch: import("@isocan/core").UpdateSessionRequest): void => {
        if (!face) return;
        void ctx.client
          .updateSession(p.id, face.sessionId, { actor: record.actor, ...patch })
          .catch(() => {});
      };
      // A turn's ceiling (10 min) outlives the presence TTL (5), so a face
      // with no beats would be swept away mid-work — the "mostly idle" bug's
      // silent half. The interval is the floor under everything else.
      const heartbeat = setInterval(() => beat({}), 60_000);
      heartbeat.unref?.();
      const agent = await AcpAgentProcess.spawn(spec, {
        cwd: row.cwd,
        env: adapterEnv(p.id, record.actor.name),
      });
      try {
        const session = await agent.ensureSession(row.cwd, row.sessionId);
        await setRcSessionId(ctx.home, p.id, record.actor.id, session.sessionId);
        console.log(
          `rc: ${record.actor.name}'s session ${session.resumed ? "resumed" : "started"} in ${row.cwd}`,
        );
        // The event stream the adapter is already sending, spent on the face:
        // each tool call becomes an inferred status (so it never displaces
        // anything the agent said with `--say`) and re-asserts `working`.
        // Throttled — a busy turn fires tools faster than a status is worth
        // repainting.
        let lastToolBeat = 0;
        const turn = await agent.prompt(
          session.sessionId,
          summonsPrompt(record.actor.name, { reason, entries: flagged }),
          (event) => {
            if (event.kind === "permission") console.log(`rc: [${record.actor.name}] permission: ${event.detail}`);
            if (event.kind === "tool" && event.detail && Date.now() - lastToolBeat >= 2_000) {
              lastToolBeat = Date.now();
              const title = event.detail.length > 80 ? `${event.detail.slice(0, 79)}…` : event.detail;
              beat({
                status: title,
                statusSource: "inferred",
                ...(working ? { activity: working } : {}),
              });
            }
          },
        );
        console.log(`rc: ${record.actor.name}'s turn ended — stopReason ${turn.stopReason}`);
        // Completion, explicitly: the rc SAW the turn end, so the cursor
        // advances now rather than waiting for the park's inferred evidence.
        await ctx.client
          .parkAdvance({ canvasId: p.id, actorId: record.actor.id, parkId: dispatch.parkId, to: tip })
          .then(() => {
            dispatch.cursor = tip;
          })
          .catch(() => {});
      } finally {
        clearInterval(heartbeat);
        agent.close();
        // The loan comes back: whatever session the pointer names on this
        // canvas ends with the turn (the CLI inside may have revived an
        // expired face under a NEW id — end that one too, not just ours),
        // and the pointer itself is removed so nothing dangles.
        const left = await readSessionFile(ctx.home, record.actor.id);
        if (left && left.canvasId === p.id) {
          if (face && left.sessionId !== face.sessionId) {
            await ctx.client.endSession(p.id, left.sessionId).catch(() => {});
          }
          await writeSessionFile(ctx.home, record.actor.id, null).catch(() => {});
        }
        if (face) await ctx.client.endSession(p.id, face.sessionId).catch(() => {});
      }
    };

    let cursors: Record<string, number> = { [p.id]: 0 };
    const lapFrom = () => {
      // One shared read from the earliest cursor any agent still needs;
      // narration (enrolments, withdrawals) keys off startTip below so old
      // history is never re-told.
      let from = startTip;
      for (const d of dispatches.values()) if (d.scannedTip < from) from = d.scannedTip;
      return from;
    };
    const startTip = (await ctx.client.watchLog({ only: [p.id] })).cursors[p.id] ?? 0;
    cursors = { [p.id]: lapFrom() };
    let lastRoster = opening;
    let offlineSince: number | null = null;
    for (;;) {
      considerUpgrade();
      let batch;
      try {
        // A held or busy agent must not wait a full poll window for its
        // next chance: an op is not the only thing that changes the answer
        // — a turn ending does too, and the log says nothing about that.
        const eager = [...dispatches.values()].some((d) => d.busy || d.pending.length > 0);
        batch = await ctx.client.watchLog({ cursors, waitMs: eager ? 2_000 : 30_000, only: [p.id] });
        if (offlineSince !== null) {
          console.log(`rc: daemon back after ${Math.round((Date.now() - offlineSince) / 1000)}s — nothing missed`);
          offlineSince = null;
        }
      } catch (err) {
        // The same pause-not-end rule the park earned: a daemon restart
        // severs the poll under a process that did nothing wrong.
        if (err instanceof ApiError) throw err;
        if (offlineSince === null) {
          offlineSince = Date.now();
          console.log("rc: the daemon stopped answering — retrying, and starting it if it is gone");
        }
        await ctx.client.ensureDaemon().catch(() => {});
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      cursors = batch.cursors;
      // The announcement's heartbeat, every lap (≤30s against a 5-minute
      // TTL) — and re-made when a daemon restart took the session with it.
      if (announced) {
        await ctx.client.updateSession(p.id, announced.sessionId, {}).catch(async () => {
          const again = await ctx.client
            .createSession(p.id, ctx.actor, undefined, undefined, "rc")
            .catch(() => null);
          if (again) announced.sessionId = again.sessionId;
        });
      }
      const lapTip = batch.cursors[p.id] ?? 0;
      const snapshot = batch.entries.length > 0 ? await ctx.client.snapshot(p.id) : null;
      // The roster survives quiet laps. The instrumented CI failure that
      // forced this: both agents mid-turn, both replies landing in ONE lap
      // — consumed into pending — and every later lap empty, so a
      // lap-scoped roster read as {} and the dispatch loop below skipped
      // every agent forever. A quiet machine staggers the replies and
      // never meets this; a loaded one meets it in one run out of four.
      if (snapshot) {
        lastRoster = snapshot.canvas.agents ?? {};
        for (const [id, row] of Object.entries(lastRoster)) known.set(id, row.actor.name);
      }
      const roster = lastRoster;
      for (const entry of batch.entries) {
        const op = entry.envelope.op;
        const by = entry.envelope.actor;
        if (op.type === "agent.enroll") {
          known.set(op.agent.id, op.agent.name);
          if (entry.seq > startTip) {
            console.log(`rc: ${by.name} enrolled ${op.agent.name} — answerable here`);
            const adopted = await adoptRcAgent(ctx.home, {
              canvasId: p.id,
              actorId: op.agent.id,
              name: op.agent.name,
              harness: null,
              cwd: rcCwd,
              sessionId: null,
            });
            if (adopted) console.log(`rc: supplying where and how for ${op.agent.name} — ${rcCwd}`);
            await claimAgent(op.agent.id, entry.seq);
          }
          continue;
        }
        if (op.type === "agent.withdraw" && entry.seq > startTip) {
          console.log(`rc: ${by.name} dismissed ${known.get(op.actorId) ?? op.actorId} — no longer answering here`);
          await removeRcAgent(ctx.home, p.id, op.actorId);
          dispatches.delete(op.actorId);
          continue;
        }
        // Route to every enrolled agent whose composition matches — the
        // same `dispatchReason` a `wait` park applies.
        for (const record of Object.values(roster)) {
          const dispatch = dispatches.get(record.actor.id);
          if (!dispatch || entry.seq <= dispatch.scannedTip) continue;
          const reason = dispatchReason(
            op,
            by.id,
            {
              actorId: record.actor.id,
              names: [{ id: record.actor.id, name: record.actor.name }],
              rules: rulesOf(record.rules),
            },
            snapshot?.canvas ?? null,
          );
          if (reason) dispatch.pending.push(entry);
        }
      }
      // Every agent has now been shown everything up to the lap tip — the
      // evaluated watermark moves for busy agents too, or a long turn would
      // re-read (and re-queue) the same entries every lap. The park ROW
      // settles only for quiet, idle agents; a busy agent's row advances at
      // its turn's end.
      for (const [actorId, dispatch] of dispatches) {
        const before = dispatch.scannedTip;
        dispatch.scannedTip = Math.max(dispatch.scannedTip, lapTip);
        if (!dispatch.busy && dispatch.pending.length === 0 && dispatch.scannedTip > before) {
          await ctx.client
            .parkAdvance({ canvasId: p.id, actorId, parkId: dispatch.parkId, to: dispatch.scannedTip })
            .then(() => {
              dispatch.cursor = dispatch.scannedTip;
            })
            .catch(() => {});
        }
      }
      for (const [actorId, dispatch] of dispatches) {
        if (dispatch.busy || dispatch.pending.length === 0) continue;
        if (Date.now() < dispatch.retryAfter) continue;
        const record = roster[actorId];
        if (!record) continue;

        /**
         * **A limit and a reason** (phase 5). The decision is `gateTurn` in
         * rc.ts — pure arithmetic, unit-tested there — and this loop only
         * gathers the inputs and obeys: every hold leaves its trace where
         * somebody is looking (the system voice in the thread, the same
         * fact in the narration, once per hold), and nothing is dropped —
         * a held batch stays pending and dispatches the moment the limit
         * lifts.
         */
        const enrolledIds = new Set(Object.keys(roster));
        const hasPersonWord = dispatch.pending.some(
          (e) => !enrolledIds.has(e.envelope.actor.id) && !isSystemActor(e.envelope.actor.id),
        );
        const wasHeld = dispatch.held !== null;
        const verdict = gateTurn(
          dispatch,
          hasPersonWord,
          { turnsPerHour: TURNS_PER_HOUR, agentChain: AGENT_CHAIN },
          Date.now(),
        );
        if (verdict.verdict === "hold-cycle") {
          if (verdict.announce) {
            const line = `${record.actor.name} paused after ${dispatch.agentChain} agent-to-agent ${dispatch.agentChain === 1 ? "turn" : "turns"} with no person in the conversation — a human word resumes it.`;
            console.log(`rc: ${line}`);
            await sayInThread(threadOf(dispatch.pending), line);
          }
          continue;
        }
        if (verdict.verdict === "hold-ceiling") {
          dispatch.retryAfter = verdict.retryAfter;
          if (verdict.announce) {
            const line = `${record.actor.name} is at its ceiling — ${TURNS_PER_HOUR} turns in the past hour. This summons waits (about ${Math.max(1, Math.round((verdict.freesAt - Date.now()) / 60_000))} min).`;
            console.log(`rc: ${line}`);
            await sayInThread(threadOf(dispatch.pending), line);
          }
          continue;
        }
        if (wasHeld) {
          console.log(`rc: ${record.actor.name}'s hold lifted — dispatching what waited`);
        }
        const failedThread = threadOf(dispatch.pending);
        dispatch.busy = true;
        void runSummons(record, dispatch)
          .catch(async (err) => {
            // Silence surfaced (journey 5): the failure reaches the thread
            // it failed FOR, in the system voice — never as the agent, which
            // never ran, and never silently. The batch is not advanced; a
            // minute's pause keeps a broken adapter off a hot loop.
            const why = (err as Error).message;
            console.log(`rc: ${record.actor.name}'s turn FAILED — ${why} (retrying in 60s)`);
            await sayInThread(
              failedThread,
              `${record.actor.name} couldn't answer — ${why}. The summons is held and will be retried; \`isocan rc\`'s log has the detail.`,
            );
            dispatch.retryAfter = Date.now() + 60_000;
          })
          .finally(() => {
            dispatch.busy = false;
          });
      }
    }
  }),
);

program
  .command("tail")
  .description("Print recent operations; -f follows the live stream")
  .option("-f, --follow", "keep streaming new operations as they land")
  .option("-n, --lines <n>", "recent entries to show first (default 10)")
  .option("--archived", "include what gc compacted — the full history, from seq 1")
  .action(
    run(async (opts: { follow?: boolean; lines?: string; archived?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const printEntry = (entry: import("@isocan/core").LogEntry) => {
        if (ctx.json) return console.log(JSON.stringify(entry));
        const cause = entry.cause ? ` [${entry.cause.kind} of #${entry.cause.targetSeq}]` : "";
        console.log(`#${entry.seq}  ${entry.envelope.ts}  ${describeEntry(entry)}${cause}`);
      };
      // The archive is the history gc compacted, never deleted — asking for
      // it means asking for the WHOLE record, so without an explicit -n the
      // default ten-line window does not apply: truncating an archive replay
      // to its tail would be the live log again, with extra steps.
      const archived = opts.archived ? await ctx.client.getArchivedLog(p.id) : [];
      const all = [...archived, ...(await ctx.client.getLog(p.id, 0))];
      const shown =
        opts.lines !== undefined
          ? all.slice(-Number(opts.lines))
          : opts.archived
            ? all
            : all.slice(-10);
      for (const entry of shown) printEntry(entry);
      let seq = all.length > 0 ? all[all.length - 1]!.seq : 0;
      if (!opts.follow) return;
      for (;;) {
        const entries = await ctx.client.getLog(p.id, seq, 30_000);
        for (const entry of entries) printEntry(entry);
        if (entries.length > 0) seq = entries[entries.length - 1]!.seq;
      }
    }),
  );

program
  .command("timeline")
  .description("Where the seams are — the canvas's history as a track you could scrub")
  .option("-w, --width <n>", "how many buckets to draw (default 48)")
  .option("--majors", "just the seams, one per line")
  .action(
    run(async (opts: { width?: string; majors?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      // Archive first, then live — `buildRecap`'s contract, and for the same
      // reason: the story predates the live log on any canvas old enough to
      // have been compacted.
      const archived = await ctx.client.getArchivedLog(p.id);
      const live = await ctx.client.getLog(p.id, 0);
      const entries = [...archived, ...live];
      if (entries.length === 0) return console.log("nothing has happened here yet");
      const marks = majors(entries);
      if (opts.majors) {
        if (ctx.json) return printJson(marks);
        for (const m of marks) console.log(majorLine(m));
        return console.log(`\n${marks.length} seams across ${entries.length} entries`);
      }
      const buckets = track(entries, Number(opts.width ?? 48));
      if (ctx.json) return printJson({ entries: entries.length, buckets });
      /**
       * **The bar is drawn from WEIGHT, not from count** — which is the whole
       * point of the significance function. Forty moves and one birth are not
       * the same afternoon, and a histogram of raw entries would say they
       * were.
       */
      const peak = Math.max(...buckets.map((b) => b.weight), 1);
      const BLOCKS = " ▁▂▃▄▅▆▇█";
      const bar = buckets
        .map((b) => BLOCKS[Math.min(8, Math.round((b.weight / peak) * 8))])
        .join("");
      // A seam gets a tick under its own column, so the two lines read as one
      // picture rather than as a chart and a legend.
      const ticks = buckets.map((b) => (b.majors.length > 0 ? "\u2502" : " ")).join("");
      console.log(bar);
      console.log(ticks);
      console.log(
        `seq ${buckets[0]!.fromSeq}–${buckets[buckets.length - 1]!.toSeq} · ` +
          `${entries.length} entries · ${marks.length} seams` +
          (archived.length > 0 ? ` · ${archived.length} from the archive` : ""),
      );
      for (const m of marks.slice(-8)) console.log(`  ${majorLine(m)}`);
      if (marks.length > 8) console.log(`  … ${marks.length - 8} earlier — --majors for all`);
    }),
  );

program
  .command("lens [who]")
  .description("What somebody has MADE, across every canvas — grouped, and read-only")
  .option("--by <how>", "canvas (default), day, or kind")
  .option("--kind <kind>", "only this kind of thing")
  .option("--within <hours>", "only what was made in the last N hours")
  .option("--untouched", "only what nobody else has touched since")
  .option("-n, --limit <n>", "how many things to show (default 40)")
  .action(
    run(async (
      who: string | undefined,
      opts: { by?: string; limit?: string; kind?: string; within?: string; untouched?: boolean },
      cmd: Command,
    ) => {
      const ctx = await ctxOf(cmd);
      /**
       * **A lens, and deliberately not a canvas.**
       *
       * `docs/research/2026-08-30-standing-agents.md` is blunt about why: an
       * item's x/y belong to the canvas it is on, so a view gathering an
       * agent's work from five canvases holds REFERENCES and cannot hold the
       * items. Position is derived here — by canvas, by day, by kind — and
       * nothing is stored, which is what makes it safe to regenerate and
       * impossible to drag into an inconsistent state.
       */
      const canvases = await ctx.client.listCanvases();
      const sources: LensSource[] = [];
      for (const canvas of canvases) {
        const snap = await ctx.client.snapshot(canvas.id);
        sources.push({ canvasId: canvas.id, canvasTitle: canvas.title, canvas: snap.canvas });
      }
      const subjects = lensSubjects(sources);
      if (!who) {
        if (ctx.json) return printJson(subjects);
        if (subjects.length === 0) return console.log("nobody has made anything here yet");
        console.log("who to look at — `isocan lens <who>`\n");
        const labels = lensSubjectLabels(subjects);
        /* The one present-tense fact in a list of past-tense ones, and the
           same words the app's roster prints — from `lensLiveWords`, so
           neither surface invents its own phrasing for "standing by". */
        /* An older daemon has no such route, and the honest answer to "who
           is live" from a daemon that cannot say is silence — which is what
           `lensLiveWords` already renders for an empty set. Not a swallowed
           error: the same nothing, by the same rule. */
        const { where } = await ctx.client.presenceWhere().catch(() => ({ where: [] }));
        for (const s of subjects) {
          const said = lensLiveWords(lensLive(where, s.id));
          console.log(`  ${labels.get(s.id)}${said ? ` — ${said}` : ""}`);
        }
        return;
      }
      const wanted = subjects.find(
        (s) => s.id === who || s.name.toLowerCase().startsWith(who.toLowerCase()),
      );
      if (!wanted) throw new Error(`nobody here called "${who}" has made anything`);
      const by = (opts.by ?? "canvas") as LensBy;
      if (!["canvas", "day", "kind"].includes(by)) {
        throw new Error(`not an arrangement: ${by} — canvas, day, kind`);
      }
      /**
       * The same three narrowings the app offers, from the same function —
       * `isocan lens --kind screen` and the app's chip have to mean one thing
       * or the surfaces disagree about what an agent has been doing.
       */
      const within = opts.within === undefined ? undefined : Number(opts.within);
      if (within !== undefined && (!Number.isFinite(within) || within <= 0)) {
        throw new Error(`--within wants hours: ${opts.within}`);
      }
      const filter: LensFilter = {
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(within === undefined ? {} : { withinHours: within }),
        ...(opts.untouched ? { untouched: true } : {}),
      };
      const everything = lensEntries(sources, wanted.id);
      const all = filterLens(everything, filter, Date.now());
      if (all.length === 0 && everything.length > 0) {
        // A narrowed lens that matches nothing reads exactly like an agent who
        // has made nothing, and the kinds that ARE there is the useful half.
        const kinds = lensKinds(everything).map((k) => `${k.kind} (${k.count})`);
        return console.log(
          `nothing of ${wanted.name}'s matches that — they have ${kinds.join(", ")}`,
        );
      }
      const groups = lensGroups(all.slice(0, Number(opts.limit ?? 40)), by);
      if (ctx.json) return printJson({ actor: wanted, total: all.length, groups });
      if (all.length === 0) return console.log(`${wanted.name} has not made anything here`);
      const nowMs = Date.now();
      for (const group of groups) {
        console.log(`\n${group.label}`);
        for (const e of group.entries) {
          const touched = e.editedSince ? " ·edited since" : "";
          console.log(
            `  ${truncate(e.title, 34).padEnd(34)} ${e.kind.padEnd(9)} ${ago(e.at, nowMs).padStart(4)}${touched}`,
          );
        }
      }
      const spread = new Set(all.map((e) => e.canvasId)).size;
      const live = lensLive(
        (await ctx.client.presenceWhere().catch(() => ({ where: [] }))).where,
        wanted.id,
      );
      /* Named rather than counted, for the same reason the app names them:
         "on a canvas now" invites exactly one question, and the canvas
         somebody is sitting on is often not one of the ones listed above. */
      const titleOf = new Map(canvases.map((c) => [c.id, c.title]));
      const at = lensLiveList(live)
        .map((l) => `${l.state === "here" ? "" : "standing by on "}${titleOf.get(l.canvasId) ?? l.canvasId}`)
        .join(", ");
      console.log(
        `\n${wanted.name} made ${all.length} thing${all.length === 1 ? "" : "s"} across ` +
          `${spread} canvas${spread === 1 ? "" : "es"}${at ? ` · now on ${at}` : ""} — ${LENS_REFUSAL}`,
      );
    }),
  );

program
  .command("history [who]")
  .description("What somebody has been doing across every canvas here — newest first")
  .option("-n, --limit <n>", "how many acts to show (default 20)")
  .option("--canvas <ref>", "just one canvas")
  .action(
    run(async (who: string | undefined, opts: { limit?: string; canvas?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      /**
       * **Step one of the standing-agents plan** — the cross-canvas fold over
       * what is already recorded. No new state: every canvas's log already
       * says who did what and when, and until now the only way to read it was
       * one canvas at a time (`isocan activity`), which is the wrong shape for
       * the question people actually ask about an agent that works in several
       * places.
       *
       * `docs/research/2026-08-30-standing-agents.md` puts this first
       * deliberately: *"useful immediately, and it is the thing that tells you
       * whether standing agents are worth the rest of this."*
       */
      const canvases = await ctx.client.listCanvases();
      const only = opts.canvas
        ? canvases.filter((c) => c.id === opts.canvas || c.title === opts.canvas)
        : canvases;
      const names = await ctx.client.actorNames();
      const wanted = who?.toLowerCase();
      const logs: LensLog[] = [];
      for (const canvas of only) {
        logs.push({
          canvasId: canvas.id,
          canvasTitle: canvas.title,
          entries: await ctx.client.getLog(canvas.id, 0),
        });
      }
      /**
       * The same fold the app's lens runs, from core — this used to be a
       * second implementation of it, sorted and counted here by hand, which
       * is the drift the isomorphism law exists to stop. What differs is the
       * SELECTION, and that is now what gets passed: name or id, and a prefix
       * is enough, because an agent's name is a thing somebody types, not
       * pastes. Names resolve against the desk's current roster, so one agent
       * renamed twice is one agent rather than three.
       */
      const acts = lensActs(
        logs,
        (actor) =>
          !wanted ||
          actorNameIn(names, actor).toLowerCase().startsWith(wanted) ||
          actor.id === who,
        (actor) => actorNameIn(names, actor),
      );
      const shown = acts.slice(0, Number(opts.limit ?? 20));
      if (ctx.json) return printJson({ total: acts.length, acts: shown });
      if (acts.length === 0) {
        return console.log(who ? `nothing here by "${who}"` : "nothing has happened yet");
      }
      const nowMs = Date.now();
      printTable(
        shown.map((a) => ({
          when: ago(a.ts, nowMs) || "just now",
          who: a.actor,
          did: opWords(a.op) ?? a.op,
          canvas: truncate(a.canvasTitle, 28),
        })),
      );
      /* The count is the point of a cross-canvas view: "12 of 340, across 6
         canvases" is the shape of somebody's week. */
      /* And the shape from core too, so "across 6 canvases" is counted once
         rather than agreeing by coincidence with the page that says it. */
      const { canvases: where } = lensShape(acts);
      console.log(
        `\n${shown.length} of ${acts.length}, across ${where} canvas${where === 1 ? "" : "es"}`,
      );
    }),
  );

program
  .command("at <seq>")
  .description("The canvas as it stood at that point in its history — the scrubber, in words")
  .option("--items", "list the items that existed then")
  .action(
    run(async (seqArg: string, opts: { items?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const seq = Number(seqArg);
      if (!Number.isFinite(seq) || seq < 0) {
        throw new Error(`not a seq: ${seqArg} — \`isocan timeline\` shows the range`);
      }
      // Archive first, then live — the same contract `timeline` and
      // `buildRecap` hold, and for the same reason: on a canvas old enough to
      // have been compacted, the story predates the live log, and folding
      // from the live log alone would replay a history missing its beginning.
      const archived = await ctx.client.getArchivedLog(p.id);
      const live = await ctx.client.getLog(p.id, 0);
      const entries = [...archived, ...live];
      const range = span(entries);
      if (!range) return console.log("nothing has happened here yet");
      /**
       * **`at` is the same fold the daemon runs**, from core, so this and the
       * web scrubber agree about the past by construction rather than by two
       * implementations staying in step. The research's rule for the
       * significance function — *"the CLI must mark the same majors the web
       * does"* — is the same rule one level along: they must also RENDER the
       * same past.
       */
      const { state, skipped } = past(entries, seq);
      if (ctx.json) return printJson({ seq, span: range, state, skipped });
      if (!state) {
        return console.log(
          `nothing yet at #${seq} — this canvas was born at #${range.first}`,
        );
      }
      const items = Object.values(state.canvas.items);
      const where =
        seq >= range.last
          ? "now"
          : `#${seq} of #${range.last} — ${range.last - seq} entries ago`;
      printKeyValues({
        at: where,
        title: state.project.title,
        description: state.project.description || "(none)",
        items: String(items.length),
        threads: String(Object.keys(state.canvas.threads).length),
        trash: String(state.canvas.trash.length),
      });
      /**
       * **What would not replay, named.**
       *
       * A canvas that collected non-finite geometry before the reducer
       * checked still carries those entries, and the fold skips them rather
       * than throwing. Saying nothing would make this print a slightly wrong
       * past with total confidence — the shape `lessons.md` keeps catching.
       */
      for (const s2 of skipped) {
        console.log(`  skipped #${s2.seq} (${s2.kind}) — ${s2.why}`);
      }
      if (!opts.items) return;
      if (items.length === 0) return console.log("\n(no items yet)");
      console.log("");
      printTable(
        items.map((i) => ({
          id: i.id,
          title: truncate(i.title, 40),
          at: `${Math.round(i.x)},${Math.round(i.y)}`,
        })),
      );
    }),
  );

program
  .command("whatsnew")
  .description("What changed, for the person using this — one entry per day, newest first")
  .option("-n, --days <n>", "how many days to show (default 5)")
  .action(
    run(async (opts: { days?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { days } = await ctx.client.news();
      if (ctx.json) return printJson({ days });
      if (days.length === 0) {
        /* Not an error. A home with no notes is a home with nothing to say,
           and the same sentence covers a stripped install that shipped no
           docs — both are "nothing to tell you" rather than a failure. */
        return console.log("nothing noted yet");
      }
      for (const day of days.slice(0, Number(opts.days ?? 5))) {
        console.log(`\n${day.title}`);
        for (const item of day.items) console.log(`  · ${item}`);
      }
    }),
  );

program
  .command("recap")
  .description("The whole history at decaying resolution — old spans summarized, recent ops verbatim")
  .option("-n, --recent <n>", "recent entries to keep verbatim (default 10)")
  .action(
    run(async (opts: { recent?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      // The full record, archive first: buildRecap's contract is "oldest
      // first, archive then live", and the archive's count is what lets the
      // header say how much of the story predates the live log.
      const archived = await ctx.client.getArchivedLog(p.id);
      const live = await ctx.client.getLog(p.id, 0);
      const snap = await ctx.client.snapshot(p.id);
      const recap = buildRecap([...archived, ...live], {
        verbatim: Number(opts.recent ?? 10),
        archived: archived.length,
        canvas: snap.canvas,
      });
      if (ctx.json) return printJson(recap);
      if (recap.total === 0) return console.log("nothing has happened here yet");
      const day = (ts: string) => ts.slice(0, 10);
      console.log(
        `${recap.total} ops` +
          (recap.archived > 0 ? ` (${recap.archived} archived)` : "") +
          ` — summarized spans first, then the last ${recap.recent.length} verbatim`,
      );
      for (const w of recap.windows) {
        const when = day(w.fromTs) === day(w.toTs) ? day(w.fromTs) : `${day(w.fromTs)}…${day(w.toTs)}`;
        const who = w.actors
          .slice(0, 3)
          .map((a) => `${a.name} (${a.ops})`)
          .join(", ");
        // Three items titled "Acme Dashboard" is one name to a reader, not a
        // stutter — dedupe the display names, then take three.
        const what = [...new Set(w.items.map((i) => i.title ?? i.id))].slice(0, 3).join(", ");
        console.log(
          `#${w.fromSeq}–#${w.toSeq}  ${when}  ${w.count} ops` +
            (w.comments > 0 ? `, ${w.comments} comments` : "") +
            `  ${who}` +
            (what ? `  on ${what}` : ""),
        );
      }
      for (const entry of recap.recent) {
        console.log(`#${entry.seq}  ${entry.envelope.ts}  ${describeEntry(entry)}`);
      }
      if (recap.windows.length > 0) {
        console.log(`(any span at full resolution: isocan tail --archived — the record is all there)`);
      }
    }),
  );

// ---------- evals ----------

/**
 * **Stage 1 of the eval programme** (`docs/projects/evals/plan.md`), and it is
 * deliberately a REPORT rather than a score.
 *
 * The plan's own warning is the reason: "most eval work fails by starting at
 * 'pick a metric', which is a hypothesis nobody tested about work nobody
 * characterised." So this prints distributions and rows. Whoever reads them
 * can see how few there are, which is the finding on a young canvas.
 *
 * Local by default and by nature: it reads this machine's replica and writes
 * nothing anywhere. Comment text never leaves — Stage 6 puts it on the list of
 * what is never sent on any setting — which is also why there is no `--post`
 * and no canvas write here, only stdout.
 */
const evals = program
  .command("evals")
  .description("What people ask agents for here, and what happened next — a local report, no score")
  .addHelpText(
    "after",
    `
Two reads over data this canvas already has:

  isocan evals corpus     every ask, its outcome, and the ops it produced
  isocan evals pairs      version stacks where somebody kept an earlier take

Neither writes anything, to the canvas or anywhere else. \`--json\` on either
for the whole structure.

**Attribution is labelled, and one of the three labels is a guess.** An op is
tied to an ask by \`anchor\` (the thread is pinned to that item), by
\`reference\` (the ask or its answer named it), or by \`window\` (the agent
that was asked did it before anyone spoke again). Only the first two are
established; \`window\` is reported so the numbers are not empty and labelled
so it cannot be mistaken for the others.
`,
  );

evals
  .command("corpus", { isDefault: true })
  .description("Every ask on this canvas, its outcome, and the ops attributed to it")
  .option("-n, --recent <n>", "show only the last n asks (default 20)")
  .action(
    run(async (opts: { recent?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      // Archive first, then live — `buildRecap`'s contract, and for the same
      // reason: the asks worth studying are the old ones, and `gc` compacts
      // them out of the live log.
      const archived = await ctx.client.getArchivedLog(p.id);
      const live = await ctx.client.getLog(p.id, 0);
      const snap = await ctx.client.snapshot(p.id);
      const corpus = buildCorpus(snap.canvas, [...archived, ...live]);
      if (ctx.json) return printJson(corpus);

      const s = corpus.summary;
      if (s.asks === 0) {
        return console.log("nobody has asked an agent for anything here yet");
      }
      console.log(
        `${s.asks} asks — ${s.answered} answered, ${s.cancelled} cancelled, ${s.silent} silent`,
      );
      console.log(
        `${s.addressed} named somebody, ${s.broadcast} reached everybody through the Chat` +
          // Said out loud rather than left for the reader to infer, because
          // the two numbers look equally solid and are not: with nobody
          // enrolled, an agent's own receipt in the Chat is indistinguishable
          // from a question and is counted as one.
          (s.broadcastUnfiltered && s.broadcast > 0
            ? " — an upper bound: nobody is enrolled here, so agents' own replies are in it (isocan agent add)"
            : ""),
      );
      console.log(
        `${s.opsAttributed} ops attributed (${s.opsByAnchorOrReference} by anchor or reference, ` +
          `${s.opsAttributed - s.opsByAnchorOrReference} by window — a guess), ${s.opsUndone} later undone`,
      );
      if (s.commands.length > 0) {
        console.log(`commands: ${s.commands.map((c) => `/${c.name} ${c.count}`).join(", ")}`);
      }
      console.log("");
      const budget = Number(opts.recent ?? 20);
      for (const ask of corpus.asks.slice(-budget)) {
        // One line of the ask, not the whole thing: a corpus is read for its
        // shape, and the text is on the canvas for anyone who wants it.
        const said = ask.body.replace(/\s+/g, " ").slice(0, 72);
        const how = ask.produced.length === 0
          ? "no ops"
          : `${ask.produced.length} ops (${ask.produced.filter((o) => o.how !== "window").length} established)`;
        console.log(
          `${ask.at.slice(0, 16).replace("T", " ")}  ${ask.outcome.padEnd(9)} ${how.padEnd(24)} ` +
            `${ask.askedBy.name}: ${said}`,
        );
      }
      if (corpus.asks.length > budget) {
        console.log(`\n(${corpus.asks.length - budget} older — -n for more, --json for all)`);
      }
    }),
  );

evals
  .command("pairs")
  .description("Version stacks where somebody kept an earlier take — the labels Stage 4 needs")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const archived = await ctx.client.getArchivedLog(p.id);
      const live = await ctx.client.getLog(p.id, 0);
      const snap = await ctx.client.snapshot(p.id);
      const pairs = harvestPreferences(snap.canvas, [...archived, ...live]);
      if (ctx.json) return printJson(pairs);
      if (pairs.length === 0) {
        // The empty answer is the finding, so it says what would fill it
        // rather than just reporting nothing.
        return console.log(
          "no preference pairs here yet — a pair is somebody making an EARLIER version\n" +
            "current again while later ones existed, which is what choosing between\n" +
            "alternatives looks like in the log. Nothing generates them until somebody\n" +
            "reaches for /variation and then keeps one.",
        );
      }
      console.log(`${pairs.length} preference pairs`);
      for (const pair of pairs) {
        console.log(
          `${pair.chosenAt.slice(0, 16).replace("T", " ")}  ${pair.chosenBy} kept ${pair.chosen} ` +
            `over ${pair.against.length} on ${pair.title}`,
        );
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
      const p = await resolveCanvas(ctx);
      const entry = await ctx.client.undo(p.id, ctx.actor);
      /**
       * **This names ONE op even when a whole gesture was undone**, and that
       * is knowingly left. `isocan choose` undoes a version and two deletions;
       * this says "applied item.removeVersion".
       *
       * It is terse rather than wrong, and the honest fix is not cheap. The
       * engine returns the LAST entry it wrote as a receipt, and the inverse
       * entries carry NO group — redo works from the undo stack's target
       * sequence rather than from the log's grouping. Making this line count
       * the gesture means either changing that return shape or writing groups
       * onto inverses, and writing groups onto inverses touches what
       * `nextUndoGroup` sees for an actor. That is the undo path, changed for
       * a message.
       *
       * What closes the gap in the meantime is the command that made the
       * gesture: `isocan choose` says "one undo takes it all back" as it
       * does it, which is where the expectation belongs.
       */
      console.log(`undid: applied ${entry.envelope.op.type}`);
    }),
  );

program
  .command("redo")
  .description("Redo your last undone operation")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const entry = await ctx.client.redo(p.id, ctx.actor);
      console.log(`redid: applied ${entry.envelope.op.type}`);
    }),
  );

/** One GC report as the lines a person reads. Shared by the one-canvas sweep
 * and the home-wide one's totals: a home-wide sweep is the same measurement
 * added up, so it must not grow a second vocabulary for it. */
function gcLines(report: GcReport): Record<string, string> {
  const verb = report.dryRun ? "would sweep" : "swept";
  return {
    oplog: `${report.retainedEntries} entries kept, ${report.droppedEntries} ${report.dryRun ? "would be archived" : "archived"}`,
    reachable: `${report.reachableBlobs} blobs (${formatBytes(report.reachableBytes)})`,
    [verb]: `${report.sweptBlobs} blobs (${formatBytes(report.sweptBytes)})`,
    ...(report.skippedRecentBlobs > 0
      ? { "skipped (too recent)": String(report.skippedRecentBlobs) }
      : {}),
  };
}

program
  .command("gc")
  .description("Reclaim storage: compact the oplog and sweep unreachable blobs")
  .option("--dry-run", "report what would be freed without deleting anything")
  .option("--keep-ops <n>", "how many recent operations to keep undoable (default 500)")
  // One act, one place: collecting a home is the same act as collecting a
  // canvas, over a different set, so it is a flag on this verb rather than a
  // second one. `--all` also names no canvas, which is the point — it is the
  // command to run in a directory bound to nothing.
  .option("--all", "sweep every canvas you are admitted to at this home, not just this one")
  .action(
    run(async (opts: { dryRun?: boolean; keepOps?: string; all?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const request = {
        ...(opts.dryRun ? { dryRun: true } : {}),
        ...(opts.keepOps !== undefined ? { keepOps: Number(opts.keepOps) } : {}),
      };
      if (opts.all) {
        const home = await ctx.client.gcHome(request);
        if (ctx.json) return printJson(home);
        printTable(
          home.canvases.map((row) => ({
            canvas: row.canvasId,
            // A canvas that threw is a row, not a missing row: the sweep went
            // on without it, and the thing worth seeing is which one it was.
            swept: row.report
              ? `${row.report.sweptBlobs} blobs (${formatBytes(row.report.sweptBytes)})`
              : `failed: ${row.error ?? "unknown"}`,
            archived: row.report ? String(row.report.droppedEntries) : "",
          })),
        );
        console.log("");
        return printKeyValues({
          canvases: String(home.canvases.length),
          ...gcLines(home.totals),
        });
      }
      const p = await resolveCanvas(ctx);
      const report = await ctx.client.gc(p.id, request);
      if (ctx.json) return printJson(report);
      printKeyValues(gcLines(report));
    }),
  );

const trash = program.command("trash").description("List, restore, or permanently empty deleted items");

trash
  .command("list")
  .description("List trashed items")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await canvasAndSnapshot(ctx);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
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
      const { canvas: p, snapshot } = await canvasAndSnapshot(ctx);
      if (!opts.force) {
        throw new Error(
          `emptying the trash (${snapshot.canvas.trash.length} items) is not undoable — re-run with --force`,
        );
      }
      await sendOp(ctx, p.id, { type: "trash.empty" });
      console.log("trash emptied");
    }),
  );

// `--agent-help` is answered before commander parses anything, so it means the
// same thing wherever it is typed (`isocan --agent-help`, `isocan comment
// --agent-help`): stop, and print how to work here. Nothing above this line
// has run anything — the definitions are registrations only.
if (process.argv.slice(2).includes("--agent-help")) {
  console.log(agentGuide());
} else {
  program.parseAsync().catch((err: unknown) => {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  });
}

/**
 * The size a file itself declares, or null when only a renderer could know.
 *
 * An SVG carries a viewBox and a PNG or JPEG carries its dimensions a few
 * bytes into the header. An HTML page carries nothing: its size is whatever a
 * browser decides when it lays the thing out, which is why `isocan fit` asks
 * for `--size` there rather than guessing a number and calling it measured.
 */
async function intrinsicSize(
  ctx: Ctx,
  canvasId: string,
  item: Item,
): Promise<{ width: number; height: number } | null> {
  const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
  if (!version) return null;
  const cap = (w: number, h: number) => ({
    width: Math.max(80, Math.min(2400, Math.round(w))),
    height: Math.max(80, Math.min(2400, Math.round(h))),
  });
  if (version.mimeType === "image/svg+xml") {
    const bytes = await ctx.client.downloadBlob(canvasId, version.blobHash);
    const box = drawingViewBox(bytes.toString("utf8"));
    return box ? cap(box.maxX - box.minX, box.maxY - box.minY) : null;
  }
  if (version.mimeType === "image/png" || version.mimeType === "image/jpeg") {
    const bytes = await ctx.client.downloadBlob(canvasId, version.blobHash);
    const size = version.mimeType === "image/png" ? pngSize(bytes) : jpegSize(bytes);
    return size ? cap(size.width, size.height) : null;
  }
  return null;
}

/** IHDR is always the first chunk of a PNG. */
function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Walk the JPEG segments to the frame header that carries the dimensions. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    const length = (b[i + 2]! << 8) | b[i + 3]!;
    // SOF0..SOF15, skipping the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
    }
    i += 2 + length;
  }
  return null;
}
