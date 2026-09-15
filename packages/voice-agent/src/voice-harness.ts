import { spawn } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket as NodeSocket } from "ws";
import { readConfigFile, readMarker, updateConfigFile } from "@isocan/server";
import { agentSessionOf, machineAgentKey } from "./agent-key.ts";
import { readRcAgents, upsertRcAgent } from "./rc-rows.ts";
import { statSync } from "node:fs";
import { ApiError, connect, matchRef, type CanvasHandle, type ListedItem } from "@isocan/api";
import {
  BROWSER_MIME,
  CANVAS_GROUPS_REQUIRED,
  canvasUrlWithPass,
  drawingSvg,
  drawingViewBox,
  inkBounds,
  inScope,
  itemKind,
  sortCanvases,
  DRAWING_MIME,
  DRAWING_PROPERTIES,
  newCanvasId,
  newCommentId,
  newThreadId,
  newVersionId,
  normalizeSiteUrl,
  parseCanvasAddress,
  siteLabel,
  type InkStroke,
} from "@isocan/core";

/**
 * **The voice harness** (Paul, 11 Sep 2026) — a local process that is enrolled
 * on a canvas like any other agent, and a page you talk to.
 *
 * Why a harness and not a page with a socket: enrolment is what makes the
 * operations *somebody's*. An enrolment mints an actor and a session key, and
 * the rc spawns this process the way it spawns any adapter; every operation
 * the microphone produces is sent with that identity, so the canvas says who
 * typed, `@Name` reaches them, and undo and the oplog treat a spoken change
 * exactly like a clicked one. A page holding its own socket would be a second
 * surface with a second vocabulary — the thing
 * `docs/research/2026-08-24-voice.md` refuses by name.
 *
 * Two faces, one process model — and both are `bin/voice-agent.js`, the
 * package's own entry point:
 *
 * - **`voice-agent --acp`** — the adapter the rc spawns (`isocan rc`, through
 *   the harness registry). It speaks ACP over stdio (initialize / session/new /
 *   session/prompt), and when a summons arrives it hands it to the standing
 *   local server — starting one, detached, if none is up — so the summons
 *   appears in the conversation instead of being spent on a turn nobody
 *   watches.
 * - **`voice-agent`** — the standing server itself: the page, the capture,
 *   the key, and the operations. It lives as long as the person wants it to,
 *   which is the whole point: a microphone is not a turn. A person starts it
 *   that way (`npm start -w @isocan/voice-agent`, or `npx voice-agent`); the rc
 *   starts the same file with `--acp` and lets it start this one detached.
 *
 * The key is the harness's, not the page's: it is POSTed once over loopback,
 * stored `0600` under `~/.isocan/voice/key.json`, and never written by the
 * page anywhere at all. Speech can also be transcribed by the browser's own
 * recogniser when no key is stored, and typed commands take the same path as
 * spoken ones — so the operation pipeline is provable with no key and no
 * spend, which is how it was verified.
 */

export const VOICE_HARNESS = "voice";
export const DEFAULT_VOICE_PORT = 7654;

/** The one sentence for a harness process that predates a pull: its routes
 * and daemon client are frozen at start while it serves the fresh dist page.
 * Spelled once, because three refusals answer with it (join, create, switch). */
export const STALE_HARNESS =
  "this harness build is older than the daemon it speaks to — pull the latest isocan, " +
  "rebuild, and restart the voice harness";

/** Everything this feature owns, under `~/.isocan`. */
export function voiceDir(home: string): string {
  return path.join(home, "voice");
}
export function voiceKeyFile(home: string): string {
  return path.join(voiceDir(home), "key.json");
}
export function voiceServerFile(home: string): string {
  return path.join(voiceDir(home), "server.json");
}
export function voiceLogFile(home: string): string {
  return path.join(voiceDir(home), "log.json");
}
export function voicePromptFile(home: string): string {
  return path.join(voiceDir(home), "prompt.txt");
}

/**
 * **The rules, in one place, because they are now editable.**
 *
 * They used to be a string literal inside `liveSetup`, which was fine while
 * nobody could see them and wrong the moment somebody could change them: an
 * inspector showing a copy of the rules is an inspector showing something the
 * model may not have been told. One constant, read by the setup builder and
 * written by the page through `/prompt`, is the only way the text on screen
 * and the text in the session can be the same text.
 */
export const VOICE_RULES =
  "You are Voice, an enrolled agent on an isocan canvas, talking out loud with the collaborator who owns it. " +
  "Keep replies concise (1-2 sentences): you are a real-time voice in the room, not a report. " +
  "MANDATORY: When the collaborator asks to create, modify, rename, delete, move, comment on, or react to anything on the canvas, " +
  "YOU MUST IMMEDIATELY CALL THE CORRESPONDING TOOL. NEVER reply in speech that you will do it, or that you did it, without calling the tool first.\n" +
  "Tool mapping rules:\n" +
  "- 'delete <item>' or 'remove <item>' -> call delete_item\n" +
  "- 'comment on <item> ...' or 'add comment ...' -> call comment_on_item\n" +
  "- 'react to <item> ...' or 'add reaction ...' or 'thumbs up on <item>' -> call item_react\n" +
  "- 'move <item> ...' -> call move_item\n" +
  "- 'rename <item> to <title>' or 'update <item> description to <desc>' -> update_item\n" +
  "- 'draw ...' or 'sketch ...' -> call drawing_add\n" +
  "The tools are the canvas's own operations, they are instant, and every one of them is undoable. " +
  "You have full read access to canvas items, versions, presence, and threads to understand project state. " +
  "If a request needs heavy asynchronous work (generating large codebases, design critiques), say you are " +
  "putting it in the Chat and use `say`. " +
  "If you cannot tell which item they mean, use `read_canvas` first or ask.";

/** How much of an edited prompt is kept: long enough for a real instruction,
 *  short enough that a paste cannot become the session's whole context. */
export const PROMPT_MAX = 8000;

/** The person's edited rules, or null when they have not written any. */
export async function readVoicePrompt(home: string): Promise<string | null> {
  const raw = await fs.readFile(voicePromptFile(home), "utf8").catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  });
  const text = raw?.trim();
  return text ? text : null;
}

/** Write the edited rules, or forget them with `null` (the reset). */
export async function writeVoicePrompt(home: string, text: string | null): Promise<void> {
  const file = voicePromptFile(home);
  if (text === null) {
    await fs.rm(file, { force: true });
    return;
  }
  await fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, text.endsWith("\n") ? text : `${text}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

/**
 * **The text a live session is actually given, built in one place.**
 *
 * Two things call this: the session start, and the inspector. The inspector
 * exists to show what the model is told, so it cannot be allowed a second
 * opinion about what that is — if these ever disagree, the panel is lying.
 */
export function voiceInstruction(
  rules: string,
  instructions?: { source: string; text: string } | null,
): string {
  const block = instructions
    ? `\n\n=== PROJECT INSTRUCTIONS (${instructions.source}) ===\n${instructions.text}\n=== END PROJECT INSTRUCTIONS ===\n`
    : "";
  return rules + block;
}

/** What a canvas has to answer for the snapshot: two reads, nothing else. */
export interface SnapshotCanvas {
  canvasId: string;
  canvas: {
    items(): Promise<{ id: string; title?: string }[]>;
    threads(): Promise<{ id: string; comments: unknown[] }[]>;
  };
}

/**
 * **Everything a live session is handed, in one place.**
 *
 * This exists because the inspector must not have a second opinion. The rules
 * are the person's (or the default's); the project instructions come from the
 * project directory bound to this canvas; the canvas snapshot is rebuilt now,
 * because ids are what a tool call echoes and yesterday's ids are wrong. The
 * same function is called by the session start and by `GET /prompt`, so the
 * text on screen and the text in the session cannot drift apart.
 *
 * The tools are in the same setup message and are NOT part of this text — the
 * inspector says so rather than implying the rules are the whole instruction.
 */
export async function liveInstructionParts(
  home: string,
  target: SnapshotCanvas,
): Promise<{
  rules: { default: string; edited: string | null; effective: string };
  project: { source: string; text: string; capped: boolean } | null;
  snapshot: { items: number; threads: number; text: string };
  instructions: { source: string; text: string };
  sent: string;
}> {
  const edited = await readVoicePrompt(home).catch(() => null);
  const effective = edited ?? VOICE_RULES;
  const contextItems = await target.canvas.items().catch(() => []);
  const contextThreads = await target.canvas.threads().catch(() => []);
  const snapshotText =
    "Current canvas state (ids are authoritative — echo them in tool calls):\n" +
    `- items: ${contextItems.map((i) => `${i.title ?? "untitled"} [${i.id}]`).join("; ") || "none"}\n` +
    `- threads: ${contextThreads.map((t) => `${t.id} (${t.comments.length} comments)`).join("; ") || "none"}`;
  const project = await resolveProjectInstructions(home, target.canvasId).catch(() => null);
  const instructions = {
    source: project?.source ?? "canvas",
    text: [project?.text, snapshotText].filter(Boolean).join("\n\n"),
  };
  return {
    rules: { default: VOICE_RULES, edited, effective },
    project: project ? { source: project.source, text: project.text, capped: project.capped } : null,
    snapshot: { items: contextItems.length, threads: contextThreads.length, text: snapshotText },
    instructions,
    sent: voiceInstruction(effective, instructions),
  };
}

export async function readVoiceLog(home: string): Promise<ToolLogEntry[]> {
  try {
    const file = voiceLogFile(home);
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content) as ToolLogEntry[];
  } catch {
    return [];
  }
}

export async function writeVoiceLog(home: string, entries: ToolLogEntry[]): Promise<void> {
  const dir = voiceDir(home);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = voiceLogFile(home);
  await fs.writeFile(file, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
}

export interface VoiceKey {
  /** Only Gemini: the live conversation *is* Gemini Live, and the batch
   * transcription fallback goes to the same provider. A second provider —
   * OpenAI, inferred from an `sk-` prefix — sat in this type, the page and the
   * tests for a path the conversation never took. */
  provider: "gemini";
  key: string;
}

/**
 * **No validation, and nothing to infer.**
 *
 * This used to reject a key whose prefix was not `AIza…` or `sk-…`, which is a
 * client-side guess about a format that changes, failing closed on the one
 * person who knows better. Paul pasted a real key, the page said no, and the
 * feature looked broken before it had run. Any non-empty key is stored, and
 * **the provider is the judge** — its error is surfaced verbatim, in its own
 * words.
 */

/** The stored key, or null. A file that is not 0600 is refused rather than
 * read: a key that leaked its own permissions is worth telling somebody
 * about, and reading it anyway would hide the one fact worth knowing. */
export async function readVoiceKey(home: string): Promise<VoiceKey | null> {
  const file = voiceKeyFile(home);
  try {
    const stat = await fs.stat(file);
    if ((stat.mode & 0o777) !== 0o600) {
      throw new Error(`${file} is mode ${(stat.mode & 0o777).toString(8)}, not 600 — refusing to read it`);
    }
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as VoiceKey;
    if (!parsed?.key || !parsed.provider) return null;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeVoiceKey(home: string, value: VoiceKey): Promise<string> {
  const dir = voiceDir(home);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = voiceKeyFile(home);
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600); // an existing file keeps its old mode otherwise
  return file;
}

export async function forgetVoiceKey(home: string): Promise<void> {
  await fs.rm(voiceKeyFile(home), { force: true });
}

/**
 * **The key this harness claims under, and its inverse — the two halves of one
 * decision.**
 *
 * The key is `machineAgentKey(home, name)` — this machine's own key for the
 * agent, derived in `agent-key.ts` with the CLI's rule, and the very key the rc
 * injects into a summoned turn. It used to be `agent:<name>`, which is what the
 * CLI used before room phase 3.5, and leaving it there made the harness's first
 * claim and the CLI's enrolment claim two different sessions on one actor: the
 * second was refused as "somebody else here" for the half hour the desk
 * remembers a claim. One key, three moments (start by hand, enrol, summon).
 *
 * The inverse exists because of a rename: the KEY is the conversation a badge
 * bound the actor to and the NAME is a label the person can change, so a
 * restart that rebuilds the key from the name presents a key nobody holds.
 * `<harness>:<session>`, first colon only — a session id may contain one.
 */
export function identityOfKey(sessionKey: string): { harness: string; session: string } {
  const at = sessionKey.indexOf(":");
  return at < 0
    ? { harness: "agent", session: sessionKey }
    : { harness: sessionKey.slice(0, at), session: sessionKey.slice(at + 1) };
}

export function voiceIdentityFile(home: string): string {
  return path.join(voiceDir(home), "identity.json");
}

/**
 * **Which actor this microphone speaks as, and the key it holds it under.**
 *
 * The two are not the same thing, and treating them as one is what made a
 * rename half-happen. An agent is FIRST claimed under this machine's key for
 * the name it was born with (`machineAgentKey`), and that is fine at birth —
 * but the key then lives on the badge for the life of the actor, while the NAME
 * is a label the registry owns and the person can change at the microphone. A
 * start that rebuilds the key from the name presents a key nobody holds
 * (refused: "Nova is taken here") or, worse, the key that IS held under the old
 * name and renames the actor back.
 *
 * So the identity is recorded: the actor id and the key, with the name as a
 * copy of the label for saying what this harness is without a round trip.
 * Nothing downstream may treat the key as who somebody is — the id is the
 * identity, and the name is a label.
 */
export interface VoiceIdentity {
  actorId: string;
  sessionKey: string;
  /** The name the actor went by when this was written — a label, refreshed on
   * every claim. The registry is the authority. */
  name: string;
}

export async function readVoiceIdentity(home: string): Promise<VoiceIdentity | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(voiceIdentityFile(home), "utf8")) as VoiceIdentity;
    if (!parsed?.actorId || !parsed?.sessionKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeVoiceIdentity(home: string, value: VoiceIdentity): Promise<void> {
  await fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 });
  const file = voiceIdentityFile(home);
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

export async function forgetVoiceIdentity(home: string): Promise<void> {
  await fs.rm(voiceIdentityFile(home), { force: true });
}

/**
 * **Claim who this microphone is — resuming rather than re-asserting.**
 *
 * With a remembered identity the claim carries NO name, which is the op's own
 * rule for a key already worn: *"Who am I?" / "hand me a name"* — a key that
 * is mine comes back with the name it goes by now. So a restart after a rename
 * resumes the actor under the key it was bound with and is told the new name,
 * instead of asserting the stale one from the environment.
 *
 * The first run's claim asserts the name, because the name IS the key at
 * birth: `machineAgentKey(home, name)` is this machine's key for that agent,
 * and it is the key the rc injects when it summons the agent later.
 *
 * A remembered key the daemon refuses — the badge lost its claims, or the
 * actor was withdrawn — is forgotten and the first-run path takes over, said
 * out loud rather than swallowed. A claim is idempotent, so this costs one
 * round trip per start and nothing else.
 */
export async function claimVoiceIdentity(options: {
  home: string;
  client: {
    claimActor: (op: { type: "actor.claim"; sessionKey: string; name?: string; canvasId?: string }) => Promise<{
      envelope: { actor: { id: string; name: string } };
    }>;
    actorBindings: () => Promise<{ key: string; actor: { id: string; name: string } }[]>;
  };
  /** The name asked for: `--as`, the record, the enrolment row, or the default.
   * A name that is not the actor's is refused rather than obeyed, said out
   * loud — never silently rename the agent back. */
  name: string;
  /** The key the environment injected, when it did: `ISOCAN_HARNESS:ISOCAN_SESSION_ID`
   * from a summoned turn. It is a conversation, not a name, and it is the
   * strongest thing this harness can know about who it is — richer than the
   * record, because it survives both a rename and a lost record. */
  injected?: string | null;
  canvasId?: string;
  onLine?: (line: string) => void;
}): Promise<{ actor: { id: string; name: string }; harness: string; session: string }> {
  const say = options.onLine ?? (() => {});
  const remembered = await readVoiceIdentity(options.home).catch(() => null);
  const wanted = await machineAgentKey(options.home, options.name);
  const rows = await options.client.actorBindings().catch(() => null);

  /**
   * **A key this badge already holds is a conversation, and a claim under it
   * is a resumption.**
   *
   * Three ways to know the key, strongest first: the one the environment
   * injected (the daemon's own row says whose it is), the record this harness
   * keeps (it remembers the key even when the name has moved away from it),
   * and the machine key the name derives — which is what a first run claims.
   * The first two cover a second machine's enrolment and a home whose `voice/`
   * directory was cleared. In every one of them the name is NOT asserted, and
   * that is the rule that matters: a claim that names an actor already bound is
   * a rename, so a machine would rename the agent back without meaning to.
   *
   * The name's key is only asserted on the first claim — the enrolment in
   * miniature, where the name IS the key.
   */
  const resume =
    remembered && (rows === null || rows.some((row) => row.key === remembered.sessionKey))
      ? remembered.sessionKey
      : rows?.find((row) => row.key === options.injected)?.key ??
        (rows?.some((row) => row.key === wanted) ? wanted : null);

  if (resume) {
    try {
      const { envelope } = await options.client.claimActor({ type: "actor.claim", sessionKey: resume });
      const actor = envelope.actor;
      await writeVoiceIdentity(options.home, { actorId: actor.id, sessionKey: resume, name: actor.name });
      /* The name asked for is a label somebody else is still using. Said, not
         obeyed: obeying it is how a restart used to rename the actor back. */
      if (options.name && !sameWord(actor.name, options.name)) {
        say(
          `this harness answers as “${actor.name}” — the name it was started with (“${options.name}”) is stale, ` +
            `and nothing was renamed. To change what it is called, say so at the microphone.`,
        );
      }
      return { actor, ...identityOfKey(resume) };
    } catch (err) {
      // A remembered key the daemon refuses (the badge lost its claims, the
      // actor was withdrawn) is forgotten out loud and claimed afresh.
      say(`could not resume what this harness remembered — ${(err as Error).message}; claiming afresh`);
      await forgetVoiceIdentity(options.home).catch(() => {});
      if (resume === wanted) throw err;
    }
  }

  const { envelope } = await options.client.claimActor({
    type: "actor.claim",
    sessionKey: wanted,
    name: options.name,
    ...(options.canvasId !== undefined ? { canvasId: options.canvasId } : {}),
  });
  const actor = envelope.actor;
  await writeVoiceIdentity(options.home, { actorId: actor.id, sessionKey: wanted, name: actor.name });
  return { actor, ...identityOfKey(wanted) };
}

/** Two names are the same name when they differ only in case and space — the
 * comparison the registry makes (`sameName`), kept local because the question
 * here is whether a LABEL moved, not whether a name is free. */
function sameWord(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Memory: what the agent keeps between sessions
 * ------------------------------------------------------------------ */

/**
 * **A memory is a sentence, when it was stored, and which session said it.**
 *
 * There is no permission prompt and no page round-trip here, on purpose.
 * Memory is the harness's own file, written beside the key it already holds —
 * `~/.isocan/voice/memories.json`, mode 0600. It survives a restart because it
 * is a file; it needs no grant because it is not the person's folder; it needs
 * no daemon because it is not canvas state. (The browser does have a private
 * persistent filesystem of its own — OPFS, `navigator.storage.getDirectory()`
 * — with no prompt at all, and that is the right home for anything PAGE-side.
 * The harness's memory belongs to the harness, so that it outlives the page.)
 *
 * `session` is the enrolled actor the microphone speaks as, and `presenceId`
 * the daemon presence session that was live when it was written, when there
 * was one. Together they are what makes a memory attributable — the person can
 * see who stored what, and when, in the log and in the memory list.
 */
export interface Memory {
  id: string;
  text: string;
  tags: string[];
  /** When it was stored, ISO. */
  at: string;
  /** The enrolled actor this is attributed to. */
  session: string;
  /** The daemon presence session live at the time, when there was one. */
  presenceId?: string;
}

/** A spoken sentence, not a document: caps keep the file readable by a person. */
export const MAX_MEMORY_TEXT = 4000;
export const MAX_MEMORY_TAGS = 8;
export const MAX_MEMORY_TAG_LEN = 64;

export function voiceMemoryFile(home: string): string {
  return path.join(voiceDir(home), "memories.json");
}

/**
 * Every memory, oldest first. A missing, unreadable or malformed file is an
 * empty list rather than a thrown error: a corrupt memory must never be the
 * reason the harness cannot start, and the next write repairs the file.
 */
/**
 * **The old file, read once so nobody loses a memory.**
 *
 * Memory used to live here — `~/.isocan/voice/memories.json`, 0600, the
 * harness's own store. Paul's ruling moved the agent's state to the page's OPFS
 * (the DirectoryHandle is for the person's files), so this file is now only a
 * source for the one-time migration: `GET /memory/legacy` hands the entries to
 * the page, the page writes them into OPFS, and `POST /memory/migrated` renames
 * the file aside — kept, not deleted, and never re-imported. After that the
 * harness owns no memory at all.
 *
 * A missing or malformed file is an empty list rather than a thrown error: a
 * corrupt legacy file must not be the reason the harness cannot start, and the
 * entries it did hold are recoverable by hand.
 */
export async function readLegacyMemories(home: string): Promise<Memory[]> {
  try {
    const raw = await fs.readFile(voiceMemoryFile(home), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : ((parsed as { memories?: unknown })?.memories ?? []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((one): one is Memory => {
        const m = one as Partial<Memory>;
        return typeof m?.id === "string" && typeof m?.text === "string";
      })
      .map((one) => ({
        id: one.id,
        text: one.text,
        tags: Array.isArray(one.tags) ? one.tags.filter((t) => typeof t === "string") : [],
        at: typeof one.at === "string" ? one.at : "",
        session: typeof one.session === "string" ? one.session : "unknown",
        ...(typeof one.presenceId === "string" ? { presenceId: one.presenceId } : {}),
      }));
  } catch {
    return [];
  }
}

/** Move the legacy file aside, keeping its bytes. The page says when. */
export async function retireLegacyMemories(home: string): Promise<string | null> {
  const file = voiceMemoryFile(home);
  const kept = `${file}.migrated`;
  try {
    await fs.access(file);
  } catch {
    return null; // nothing to retire
  }
  await fs.rename(file, kept);
  return kept;
}

/** Tags arrive from a model: a string, an array, or nothing. Normalise, cap. */
export function normalizeTags(tags: unknown): string[] {
  const list = Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [];
  const out: string[] = [];
  for (const one of list) {
    if (typeof one !== "string") continue;
    const tag = one.trim().slice(0, MAX_MEMORY_TAG_LEN);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_MEMORY_TAGS) break;
  }
  return out;
}

/** What the page answers for one memory question. */
export interface MemoryAnswer {
  ok: boolean;
  id?: string;
  at?: string;
  tags?: string[];
  memory?: Memory | null;
  memories?: Memory[];
  count?: number;
  recentIds?: string[];
  error?: string;
}

/**
 * **The harness asks the page; the page owns the store.**
 *
 * Memory lives in the page's OPFS (per-origin, persistent, no prompt) because
 * that is where the agent's own state belongs — Paul's ruling. The harness is
 * the model-facing side: it does not keep memories and cannot read the store;
 * it asks over the same socket the file tools use, and names every way the
 * question can fail (no page, no answer in time, the page closing mid-question)
 * rather than reporting an empty store it never saw.
 *
 * The contract the page must satisfy is unchanged — `{id, text, tags, at,
 * session, presenceId}` — and so is the honesty: search is substring, the model
 * cannot delete or enumerate, and every write is logged with its text.
 */
export function createMemoryBroker(channel: FileChannel, opts: { timeoutMs?: number } = {}) {
  const timeoutMs = opts.timeoutMs ?? FS_ASK_TIMEOUT_MS;
  const waiting = new Map<
    string,
    { resolve: (answer: MemoryAnswer) => void; timer: ReturnType<typeof setTimeout> }
  >();

  function settle(callId: string, answer: MemoryAnswer): boolean {
    const held = waiting.get(callId);
    if (!held) return false;
    clearTimeout(held.timer);
    waiting.delete(callId);
    held.resolve(answer);
    return true;
  }

  return {
    waiting: (): number => waiting.size,
    abandon: (): void => {
      for (const [callId, held] of waiting) {
        clearTimeout(held.timer);
        waiting.delete(callId);
        held.resolve({ ok: false, error: "the page closed before it answered" });
      }
    },
    answer: (callId: string, answer: MemoryAnswer): boolean => settle(callId, answer),
    ask: async (
      op: "remember" | "read" | "search",
      payload: Record<string, unknown>,
    ): Promise<MemoryAnswer> => {
      if (!channel.connected()) {
        return {
          ok: false,
          error: "no page is connected — memory lives in the page's own store, which is where it is kept",
        };
      }
      const callId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      return await new Promise<MemoryAnswer>((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(callId);
          resolve({ ok: false, error: `the page did not answer the ${op} request in time` });
        }, timeoutMs);
        waiting.set(callId, { resolve, timer });
        channel.send({ memory: { callId, op, ...payload } });
      });
    },
  };
}

export type MemoryBroker = ReturnType<typeof createMemoryBroker>;

/**
 * **The model's three memory tools, and nothing else's.**
 *
 * Deliberately narrow, exactly as before the move: write, read one, search.
 * No delete and no list-everything — a memory the model can erase or quietly
 * enumerate is one the person cannot trust. Forgetting and listing happen in
 * the page, from the page's own store.
 */
export async function runMemoryTool(
  name: "remember" | "read_memory" | "search_memory",
  args: Record<string, unknown>,
  ask: (op: "remember" | "read" | "search", payload: Record<string, unknown>) => Promise<MemoryAnswer>,
  who: { session: string; presenceId?: string | null },
): Promise<{ ok: boolean; said: string; answer: { ok: boolean; [k: string]: unknown } }> {
  if (name === "remember") {
    const text = String(args.text ?? "").trim().slice(0, MAX_MEMORY_TEXT);
    if (!text) {
      return { ok: false, said: "a memory needs text", answer: { ok: false, error: "a memory needs text" } };
    }
    const tags = normalizeTags(args.tags);
    const answer = await ask("remember", {
      text,
      tags,
      session: who.session,
      ...(who.presenceId ? { presenceId: who.presenceId } : {}),
    });
    if (!answer.ok) {
      const error = answer.error ?? "the page could not store that";
      return { ok: false, said: error, answer: { ok: false, error } };
    }
    return {
      ok: true,
      said: `remembered (${answer.id}): ${text.slice(0, 120)}${tags.length ? ` [${tags.join(", ")}]` : ""}`,
      answer: { ok: true, id: answer.id, at: answer.at, tags: answer.tags ?? tags },
    };
  }
  if (name === "read_memory") {
    const id = String(args.id ?? "").trim();
    const answer = await ask("read", { id });
    if (!answer.ok || !answer.memory) {
      const error = answer.error ?? `no memory with id "${id}"`;
      return {
        ok: false,
        said: error,
        answer: {
          ok: false,
          error,
          ...(answer.recentIds ? { recentIds: answer.recentIds } : {}),
        },
      };
    }
    return {
      ok: true,
      said: `memory ${answer.memory.id}: ${answer.memory.text.slice(0, 160)}`,
      answer: { ok: true, memory: answer.memory },
    };
  }
  const query = String(args.query ?? "");
  const answer = await ask("search", { query });
  if (!answer.ok) {
    const error = answer.error ?? "the page could not search its store";
    return { ok: false, said: error, answer: { ok: false, error } };
  }
  const memories = answer.memories ?? [];
  return {
    ok: true,
    said: query.trim()
      ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"} matching "${query}"`
      : `${memories.length} memories`,
    answer: {
      ok: true,
      query,
      match: "case-insensitive substring over text and tags — not semantic search",
      count: memories.length,
      memories: memories.slice(-50),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Files: read over a folder the person granted, through the page
 * ------------------------------------------------------------------ */

/** How long a page has to answer a file question before it is a refusal. */
export const FS_ASK_TIMEOUT_MS = 20_000;
/** Caps on what ever reaches the model: a folder is not a corpus. */
export const MAX_FILE_CHARS = 64_000;
export const MAX_DIR_ENTRIES = 500;

/**
 * **The folder belongs to the person; the page is the only one who can ask for
 * it.**
 *
 * A `FileSystemDirectoryHandle` is a browser thing — this process cannot hold
 * one, and must never be able to read a person's disk by itself. So `list_dir`
 * and `read_file` are not reads the harness performs: they are questions it
 * asks the page over the socket the page already has, and the page answers
 * from the handle the person picked with a real click. That is why there is no
 * daemon directory track in this file and no `fs` import: the capability lives
 * exactly where the permission lives.
 *
 * `folder` is only ever the folder's NAME as the page reported it. The handle
 * itself never crosses this boundary — nothing here can read anything later
 * without the page asking again.
 */
export interface FsGrantState {
  folder: string | null;
  /** When it was granted, ISO. */
  at?: string;
}

/** What the page answers for one file question. */
export interface FsAnswer {
  ok: boolean;
  content?: string;
  entries?: { name: string; kind: "file" | "directory"; size?: number; modified?: string }[];
  truncated?: boolean;
  bytes?: number;
  error?: string;
}

/**
 * **A path inside the granted folder, or a refusal that says why.**
 *
 * The page is the authority — it holds the handle and does the walking — but a
 * refusal from here is instant and legible, and a `..` that reaches the page is
 * a `..` the page must also be trusted to catch. `allowEmpty` is for
 * `list_dir` (the root of the grant); `read_file` on the folder itself is not a
 * file and says so.
 */
export function safeGrantPath(
  raw: unknown,
  opts: { allowEmpty?: boolean } = {},
): { ok: true; path: string } | { ok: false; error: string } {
  const given = String(raw ?? "").trim();
  if (!given || given === "." || given === "./") {
    return opts.allowEmpty
      ? { ok: true, path: "" }
      : { ok: false, error: "a path is required — the granted folder itself is not a file" };
  }
  if (/^([a-zA-Z]:)?[\\/]/.test(given) || given.startsWith("~")) {
    return { ok: false, error: `"${given}" is an absolute path; paths are relative to the granted folder` };
  }
  const segments = given.replace(/^\.\//, "").split(/[\\/]/);
  if (segments.some((one) => one === "..")) {
    return { ok: false, error: `"${given}" climbs out of the granted folder — nothing outside it can be read` };
  }
  return { ok: true, path: segments.filter(Boolean).join("/") };
}

/** What the broker needs from the page's socket, and nothing else. */
export interface FileChannel {
  /** True while a page is on the socket. */
  connected(): boolean;
  send(message: unknown): void;
}

/**
 * **Ask the page, and wait for the answer.**
 *
 * One request at a time is not a limitation worth engineering around: the model
 * is the only caller, and the page is one reader. Every way this can fail is
 * named — no page, no grant, no answer in time, the page closing mid-question —
 * because "the model read nothing and said nothing" is the failure a person
 * cannot debug.
 */
export function createFileBroker(channel: FileChannel, opts: { timeoutMs?: number } = {}) {
  const timeoutMs = opts.timeoutMs ?? FS_ASK_TIMEOUT_MS;
  let grant: FsGrantState = { folder: null };
  const waiting = new Map<
    string,
    { resolve: (answer: FsAnswer) => void; timer: ReturnType<typeof setTimeout> }
  >();

  function settle(callId: string, answer: FsAnswer): boolean {
    const held = waiting.get(callId);
    if (!held) return false;
    clearTimeout(held.timer);
    waiting.delete(callId);
    held.resolve(answer);
    return true;
  }

  return {
    state: (): FsGrantState => grant,
    waiting: (): number => waiting.size,
    grant: (folder: string | null, at: string = new Date().toISOString()): FsGrantState => {
      grant = folder ? { folder, at } : { folder: null };
      return grant;
    },
    /** A page went away: every question it owed is refused, not left hanging. */
    abandon: (): void => {
      for (const [callId, held] of waiting) {
        clearTimeout(held.timer);
        waiting.delete(callId);
        held.resolve({ ok: false, error: "the page closed before it answered" });
      }
    },
    answer: (callId: string, answer: FsAnswer): boolean => settle(callId, answer),
    ask: async (op: "list_dir" | "read_file", path: string): Promise<FsAnswer> => {
      if (!channel.connected()) {
        return {
          ok: false,
          error:
            "no page is connected — files are read through the page, which is where the person grants the folder",
        };
      }
      if (!grant.folder) {
        return {
          ok: false,
          error: 'no folder has been granted — in the page, press "Choose a folder" and pick one',
        };
      }
      const callId = `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      return await new Promise<FsAnswer>((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(callId);
          resolve({ ok: false, error: `the page did not answer the ${op} request in time` });
        }, timeoutMs);
        waiting.set(callId, { resolve, timer });
        channel.send({ fs: { callId, op, path, folder: grant.folder } });
      });
    },
  };
}

export type FileBroker = ReturnType<typeof createFileBroker>;

/**
 * **The model's two file tools, with the grant and the source in the answer.**
 *
 * `source` is the point of the attribution rule: a fact read from a file is
 * worth nothing to the person if the model cannot say which file it came from,
 * so every successful read carries `folder/path` back — and the caller records
 * it in the tool log. Truncation is explicit rather than silent, for the same
 * reason: a half-read file that looks whole is worse than a refusal.
 */
export async function runFileTool(
  name: "list_dir" | "read_file",
  args: Record<string, unknown>,
  ask: (op: "list_dir" | "read_file", path: string) => Promise<FsAnswer>,
  grant: FsGrantState,
): Promise<{ ok: boolean; said: string; answer: { ok: boolean; [k: string]: unknown } }> {
  const checked = safeGrantPath(args.path, { allowEmpty: name === "list_dir" });
  if (!checked.ok) {
    return { ok: false, said: checked.error, answer: { ok: false, error: checked.error } };
  }
  const answer = await ask(name, checked.path);
  if (!answer.ok) {
    const error = answer.error ?? "the page could not read that";
    return { ok: false, said: error, answer: { ok: false, error, path: checked.path } };
  }
  if (name === "list_dir") {
    const all = answer.entries ?? [];
    const entries = all.slice(0, MAX_DIR_ENTRIES);
    const truncated = Boolean(answer.truncated) || all.length > entries.length;
    const where = `${grant.folder ?? "the granted folder"}${checked.path ? `/${checked.path}` : ""}`;
    return {
      ok: true,
      said: `${entries.length} ${entries.length === 1 ? "entry" : "entries"} in ${where}${truncated ? " (truncated)" : ""}`,
      answer: { ok: true, folder: grant.folder, path: checked.path, count: entries.length, truncated, entries },
    };
  }
  const full = answer.content ?? "";
  const content = full.slice(0, MAX_FILE_CHARS);
  const truncated = Boolean(answer.truncated) || content.length < full.length;
  const source = `${grant.folder ?? "the granted folder"}/${checked.path}`;
  return {
    ok: true,
    said: `read ${source} (${content.length} chars${truncated ? ", truncated" : ""})`,
    answer: {
      ok: true,
      folder: grant.folder,
      path: checked.path,
      source,
      bytes: answer.bytes ?? Buffer.byteLength(full, "utf8"),
      truncated,
      content,
    },
  };
}

/* ------------------------------------------------------------------ *
 * The model: a preference, and the provider's own list
 * ------------------------------------------------------------------ */

/**
 * **The model, as a preference rather than a constant.**
 *
 * Paul: “we should be able to select (and type our own) gemini model,
 * sometimes we have access to beta models not in the public list.” A beta name
 * cannot live in a source file, so the choice is stored the way the key is —
 * one small file, nothing inferred — and the provider is the judge of whether
 * it works.
 */
export function voiceModelFile(home: string): string {
  return path.join(voiceDir(home), "model.json");
}

/** The stored preference: the name the Live API takes, and when it was chosen. */
export interface VoiceModel {
  /** Always `models/<id>`, the form the Live API takes. */
  model: string;
  /** When it was chosen — a person reading the file later wants to know. */
  at: string;
}

/** The stored choice, or null — a preference, not a config to validate. */
export async function readVoiceModel(home: string): Promise<VoiceModel | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(voiceModelFile(home), "utf8")) as VoiceModel;
    return parsed?.model ? parsed : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Stored 0600 like the key: a name somebody typed is not a secret, and not a file to leave readable either. */
export async function writeVoiceModel(home: string, model: string): Promise<string> {
  const dir = voiceDir(home);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = voiceModelFile(home);
  await fs.writeFile(file, `${JSON.stringify({ model, at: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
  return file;
}

/** Forget it: the shipped default is what a new session uses next. */
export async function forgetVoiceModel(home: string): Promise<void> {
  await fs.rm(voiceModelFile(home), { force: true });
}

/**
 * **A model name is a SHAPE, and this is the only local rule about it.**
 *
 * It cannot be a list: the whole reason the field exists is names the public
 * list does not carry. So this checks the shape and says that it is a shape
 * check, and everything else is the provider's answer. Measured: a malformed
 * name reaches the provider and comes back with the SAME message a real-but-
 * text-only model gets (“not found for API version v1beta, or is not supported
 * for bidiGenerateContent”), so the shape is the one thing worth telling apart
 * on this side.
 */
export function modelNameShape(asked: string): { ok: true; name: string } | { ok: false; why: string } {
  const trimmed = asked.trim();
  if (!trimmed) return { ok: false, why: "no model name was given" };
  const name = trimmed.startsWith("models/") ? trimmed : `models/${trimmed}`;
  if (!/^models\/[A-Za-z0-9._-]+$/.test(name)) {
    return {
      ok: false,
      why:
        `“${asked}” is not shaped like a Gemini model name — a name is letters, digits, dots, dashes and ` +
        `underscores, optionally after “models/”. (Checked here, not at the provider: nothing was sent.)`,
    };
  }
  return { ok: true, name };
}

export interface ProviderModel {
  /** `models/<id>`, the provider's own name for it. */
  name: string;
  displayName: string;
  /** The provider's description, first line, bounded. */
  description: string;
  methods: string[];
  /** The provider's OWN signal that this model holds a Live session. */
  live: boolean;
}

/**
 * **The provider's list, in the provider's words.**
 *
 * Measured against the live API on 13 Sep 2026: 55 models, each carrying
 * `name`, `displayName`, `description` and `supportedGenerationMethods` — and
 * exactly SEVEN with `bidiGenerateContent`, which is the Live API's own method
 * name. That field is the honest “can this hold a voice session” signal, and
 * it is read from the provider rather than hardcoded here.
 */
export async function listModels(
  key: VoiceKey,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; models: ProviderModel[]; answer: string }> {
  try {
    const r = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": key.key },
    });
    const body = await r.text();
    if (!r.ok) return { ok: false, models: [], answer: `${r.status} ${body.slice(0, 300)}` };
    const parsed = JSON.parse(body) as {
      models?: { name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }[];
    };
    const models = (parsed.models ?? []).map((one) => ({
      name: one.name ?? "",
      displayName: one.displayName ?? one.name ?? "",
      description: (one.description ?? "").split("\n")[0]!.slice(0, 240),
      methods: one.supportedGenerationMethods ?? [],
      live: (one.supportedGenerationMethods ?? []).includes("bidiGenerateContent"),
    }));
    const live = models.filter((one) => one.live).length;
    return { ok: true, models, answer: `the provider lists ${models.length} models, ${live} of them Live` };
  } catch (err) {
    return { ok: false, models: [], answer: `could not reach the provider: ${String((err as Error).message ?? err)}` };
  }
}

/**
 * **Is this model one the provider will talk through?**
 *
 * Asked, not looked up: the list is a hint and the handshake is the answer. A
 * name that is not in the list — a beta model an operator has — is tried
 * anyway, because that is the case this control exists for.
 *
 * The two failures are told apart on this side because the provider does NOT
 * tell them apart. Measured, 13 Sep 2026: a text-only model and a name that
 * does not exist both close the Live socket with code 1008 and the identical
 * sentence “is not found for API version v1beta, or is not supported for
 * bidiGenerateContent”. The list says which of the two it is; the provider's
 * sentence is handed over verbatim either way.
 */
export async function testModel(options: {
  asked: string;
  key: VoiceKey;
  known?: ProviderModel[];
  WebSocketImpl?: typeof WebSocket;
  urlFor?: (key: string) => string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; model?: string; answer: string; why: string }> {
  const shape = modelNameShape(options.asked);
  if (!shape.ok) return { ok: false, answer: shape.why, why: "not a model name" };
  const model = shape.name;
  const known = options.known?.find((one) => one.name === model);

  // What the list knows, said before anything is opened: which is the whole
  // difference between “that model does not exist” and “that model is not one
  // you can talk through”.
  const fromTheList = known
    ? known.live
      ? `the provider lists ${model} as Live (${known.displayName})`
      : `the provider lists ${model} (${known.displayName}), but WITHOUT bidiGenerateContent — it is not a model you can hold a voice session with`
    : `the provider's list does not carry ${model} — a beta model you have access to may still work, so this was tried anyway`;

  const url = options.urlFor ? options.urlFor(options.key.key) : liveUrl(options.key.key);
  const Socket = options.WebSocketImpl ?? WebSocket;
  const outcome = await new Promise<{ ok: boolean; answer: string; code?: number }>((resolve) => {
    let settled = false;
    const finish = (value: { ok: boolean; answer: string; code?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(value);
    };
    const timer = setTimeout(
      () => finish({ ok: false, answer: `the provider did not answer within ${(options.timeoutMs ?? 12_000) / 1000}s` }),
      options.timeoutMs ?? 12_000,
    );
    const socket = new Socket(url);
    socket.onopen = () => socket.send(JSON.stringify(liveSetup(model)));
    socket.onmessage = async (event: { data: unknown }) => {
      const raw = event?.data;
      const text =
        typeof raw === "string"
          ? raw
          : raw instanceof Uint8Array || raw instanceof ArrayBuffer
            ? new TextDecoder().decode(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw)
            : raw && typeof (raw as { text?: () => Promise<string> }).text === "function"
              ? await (raw as { text: () => Promise<string> }).text()
              : "";
      let message: Record<string, unknown> = {};
      try {
        message = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message.setupComplete) finish({ ok: true, answer: "accepted: the provider completed the setup" });
      else if (message.error) finish({ ok: false, answer: JSON.stringify(message.error).slice(0, 400) });
    };
    socket.onerror = () => finish({ ok: false, answer: "the live socket refused the connection" });
    socket.onclose = (event: { code?: number; reason?: string }) => {
      const code = event?.code ?? 0;
      // The provider's sentence is handed over in full where it fits: cutting
      // it mid-word ("… Call Mod") reads as corruption rather than as a limit.
      const reason = event?.reason ? String(event.reason).slice(0, 900) : "";
      finish({ ok: false, answer: `${code}${reason ? ` — ${reason}` : " (no reason given)"}`, code });
    };
  });

  if (outcome.ok) return { ok: true, model, answer: outcome.answer, why: fromTheList };

  /**
   * **Three failures, three different sentences — because they need different
   * fixes.** Measured on 13 Sep 2026:
   *
   *   1007  a model that IS Live but does not send audio out: the transcribe
   *         and translate models answer the setup and then refuse the response
   *         modality. “Live” in the list is not “a voice you can talk with”.
   *   1008  the provider's one sentence for BOTH “no such model” and “a real
   *         model that cannot hold a Live session”, which is why the list is
   *         consulted before saying which this is.
   *   other the provider's words are the whole answer, and are handed over.
   */
  const why =
    outcome.code === 1007
      ? `${model} is a Live model, but not a conversational one: the provider accepted the setup and then refused the ` +
        `response modality — this one does not send AUDIO back. Transcription and translation models are Live and are ` +
        `not a voice to talk with; the conversation needs a model that takes audio in AND answers in audio.`
      : known
        ? known.live
          ? `the provider lists ${model} as Live, so this refusal is about something else — its own words are above`
          : `${model} is a real model, but not a Live one: Live needs a model that takes audio in and sends audio back ` +
            `(bidiGenerateContent), and this one offers ${known.methods.join(", ") || "no methods"}. A text-only model name is the ` +
            `easiest mistake to make in that field.`
        : `no model by this name is in the provider's list, so this was tried anyway and the provider refused it — a beta model you have access to would be here too, which is why the field exists. Its exact name is what matters.`;
  return { ok: false, model, answer: outcome.answer, why };
}

/* ------------------------------------------------------------------ *
 * What a sentence means
 * ------------------------------------------------------------------ */

export interface PlannedOp {
  /** The operation, as `@isocan/api` sends it. */
  op: { type: string; [key: string]: unknown };
  /** What to say afterwards, in the person's words. */
  said: string;
}

export interface PlanContext {
  items: ListedItem[];
  /** The canvas's Chat thread, when there is one. */
  mainThreadId: string | null;
}

/** A spoken reference: an exact item id, a title prefix, or an ordinal ("the second screen"). */
export function resolveSpokenRef(ref: string, items: ListedItem[]): ListedItem | null {
  const raw = ref.trim();
  if (!raw) return null;
  // 1. Direct match by item id (exact or prefix)
  const exactId = items.filter((i) => i.id === raw || i.id.toLowerCase() === raw.toLowerCase());
  if (exactId.length === 1) return exactId[0]!;
  const prefixId = items.filter((i) => i.id.startsWith(raw) || i.id.toLowerCase().startsWith(raw.toLowerCase()));
  if (prefixId.length === 1) return prefixId[0]!;

  const wanted = raw.toLowerCase().replace(/^the\s+/, "");
  const ordinal = wanted.match(/^(first|second|third|fourth|fifth|last|newest|oldest)\b/);
  if (ordinal) {
    const ordered = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    const pick =
      ordinal[1] === "first"
        ? ordered[0]
        : ordinal[1] === "last" || ordinal[1] === "newest"
          ? ordered[ordered.length - 1]
          : ordinal[1] === "oldest"
            ? ordered[0]
            : ordered[["", "first", "second", "third", "fourth", "fifth"].indexOf(ordinal[1]!) - 1];
    return pick ?? null;
  }
  const exact = items.filter((i) => i.title?.toLowerCase() === wanted);
  if (exact.length === 1) return exact[0]!;
  const prefixed = items.filter((i) => i.title?.toLowerCase().startsWith(wanted));
  return prefixed.length === 1 ? prefixed[0]! : null;
}

/**
 * **The spoken grammar, as a pure function.** Deterministic on purpose: the
 * first build has to be provable without a key and without spend, and a
 * sentence that maps to an operation is a fact a test can hold. A model that
 * reads freer sentences can sit in front of this later and emit the same
 * plans — the plan is the contract, not the parser.
 *
 * Every verb here is an operation the canvas already had. Nothing in this file
 * invents a vocabulary, which is the property that keeps voice honest.
 */
export function planVoice(text: string, ctx: PlanContext): { plans: PlannedOp[]; what?: string } {
  const said = text.trim();
  if (!said) return { plans: [] };
  const lower = said.toLowerCase();

  const quick = (item: ListedItem | null) => (item ? say(item.title ?? "that", item.id) : "that one");
  const say = (title: string, id: string) => `“${title}” (${id.slice(0, 10)})`;

  // Reads — answered, no operation sent. A voice surface that can only write
  // is a voice surface nobody can aim.
  if (/\b(?:who\s+is\s+here|who\s+is\s+present|presence)\b/i.test(lower)) {
    return { plans: [], what: "read_presence" };
  }
  if (/^(what|who|which)\b/.test(lower) || /\b(list|tell me)\b/.test(lower)) {
    return { plans: [], what: describeCanvas(ctx) };
  }
  if (/\b(?:read\s+item|show\s+item|open\s+item)\s+(.+)/i.test(lower)) {
    const targetRef = lower.match(/\b(?:read\s+item|show\s+item|open\s+item)\s+(.+)/i)![1]!.trim();
    const item = resolveSpokenRef(targetRef, ctx.items);
    if (item) {
      return { plans: [], what: `Item “${item.title}” (${item.id}): kind ${item.kind}, position (${item.x}, ${item.y}).` };
    }
  }

  // Add / Create a note, item, card:
  // e.g. "add a note that says hello from the voice log"
  // e.g. "add a note called Test that says hello"
  // e.g. "create a note called Foo saying Bar"
  // e.g. "add note Hello World"
  let m = said.match(/^(?:please\s+)?(?:add|create|make|new|post)\s+(?:an?\s+)?(?:note|card|item|doc|document)\s+(?:called|named|titled)\s+["“]?([^"”\n]+?)["”]?\s+(?:that\s+says|saying|with\s+text|containing|content)\s+["“]?([^"”\n]+)["”]?$/i);
  if (m) {
    const title = m[1]!.trim();
    const bodyText = m[2]!.trim();
    return {
      plans: [
        {
          op: { type: "item.add", title, text: bodyText },
          said: `added note “${title}” saying “${bodyText}”`,
        },
      ],
    };
  }

  m = said.match(/^(?:please\s+)?(?:add|create|make|new|post)\s+(?:an?\s+)?(?:note|card|item|doc|document)\s+(?:that\s+says|saying|with\s+text|containing)\s+["“]?([^"”\n]+)["”]?$/i);
  if (m) {
    const bodyText = m[1]!.trim();
    const title = bodyText.length > 25 ? bodyText.slice(0, 22) + "..." : bodyText;
    return {
      plans: [
        {
          op: { type: "item.add", title, text: bodyText },
          said: `added note “${title}”`,
        },
      ],
    };
  }

  m = said.match(/^(?:please\s+)?(?:add|create|make|new)\s+(?:an?\s+)?(?:note|card|item|doc|document)\s+["“]?([^"”\n]+)["”]?$/i);
  if (m) {
    const title = m[1]!.trim();
    return {
      plans: [
        {
          op: { type: "item.add", title, text: "" },
          said: `added note “${title}”`,
        },
      ],
    };
  }

  m = said.match(/^(?:please\s+)?(?:re)?(?:name|title|retitle|rename)\s+(.+?)\s+(?:to|as)\s+(.+)$/i);
  if (m) {
    const item = resolveSpokenRef(m[1]!, ctx.items);
    if (!item) return { plans: [], what: `I could not tell which one “${m[1]}” is.` };
    return {
      plans: [{ op: { type: "item.update", itemId: item.id, title: m[2]!.trim() }, said: `renamed ${quick(item)}` }],
    };
  }

  m = said.match(/^(?:please\s+)?(?:delete|remove|bin|trash)\s+(.+)$/i);
  if (m) {
    const item = resolveSpokenRef(m[1]!, ctx.items);
    if (!item) return { plans: [], what: `I could not tell which one “${m[1]}” is.` };
    return { plans: [{ op: { type: "item.delete", itemId: item.id }, said: `deleted ${quick(item)}` }] };
  }

  m = said.match(/^(?:please\s+)?restore\s+(.+)$/i);
  if (m) {
    const ref = m[1]!.trim();
    return {
      plans: [{ op: { type: "item.restore", ref }, said: `restored ${ref}` }],
    };
  }

  m = said.match(/^(?:please\s+)?resize\s+(.+?)\s+(?:to\s+)?(\d+)\s*(?:x|by|\s+)\s*(\d+)$/i);
  if (m) {
    const item = resolveSpokenRef(m[1]!, ctx.items);
    if (!item) return { plans: [], what: `I could not tell which one “${m[1]}” is.` };
    const width = Number(m[2]);
    const height = Number(m[3]);
    return {
      plans: [
        { op: { type: "item.resize", itemId: item.id, width, height }, said: `resized ${quick(item)} to ${width}x${height}` },
      ],
    };
  }

  // Move: by a delta, or to a place on the plane. Both are the same op — and
  // the preposition is read rather than inferred, because "move X to 400, 200"
  // and "move X by 400, 200" are the same four numbers and different places.
  m = said.match(/^(?:please\s+)?move\s+(.+?)\s+(by|to|left|right|up|down)\s+(.+)$/i);
  if (m) {
    const item = resolveSpokenRef(m[1]!, ctx.items);
    if (!item) return { plans: [], what: `I could not tell which one “${m[1]}” is.` };
    const here = { x: Number(item.x ?? 0), y: Number(item.y ?? 0) };
    const how = m[2]!.toLowerCase();
    const rest = m[3]!.toLowerCase();
    const pair = rest.match(/^(-?\d+)\s*(?:,|\s+and\s+)\s*(-?\d+)$/);
    const amount = rest.match(/-?\d+/);
    let x = here.x;
    let y = here.y;
    if (how === "by" || how === "to") {
      if (!pair) {
        return { plans: [], what: `“${m[3]}” is not a place I understand — say “by 60, 0” or “to 400, 200”.` };
      }
      const [dx, dy] = [Number(pair[1]), Number(pair[2])];
      if (how === "to") {
        x = dx;
        y = dy;
      } else {
        x += dx;
        y += dy;
      }
    } else {
      const step = amount ? Number(amount[0]) : 60;
      if (how === "left") x -= step;
      else if (how === "right") x += step;
      else if (how === "up") y -= step;
      else y += step;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { plans: [], what: `I could not work out where “${m[2]}” puts that one.` };
    }
    return {
      plans: [
        { op: { type: "item.move", itemId: item.id, x: Math.round(x), y: Math.round(y) }, said: `moved ${quick(item)} to ${Math.round(x)}, ${Math.round(y)}` },
      ],
    };
  }

  m = said.match(/^(?:please\s+)?(?:say|note|notify|tell everyone)\s+(.+)$/i);
  if (m) {
    return { plans: [{ op: { type: "thread.reply", body: m[1]!.trim() }, said: `said: ${m[1]!.trim()}` }] };
  }

  m = said.match(/^(?:please\s+)?ask\s+(.+)$/i);
  if (m) {
    return { plans: [{ op: { type: "thread.reply", body: `? ${m[1]!.trim()}` }, said: `asked: ${m[1]!.trim()}` }] };
  }

  m = said.match(/^(?:please\s+)?(?:comment|reply|write)\s+(?:on\s+)?(.+?)[:,]\s*(.+)$/i);
  if (m) {
    const item = resolveSpokenRef(m[1]!, ctx.items);
    if (!item) return { plans: [], what: `I could not tell which one “${m[1]}” is.` };
    return {
      plans: [{ op: { type: "thread.create", itemId: item.id, body: m[2]!.trim() }, said: `commented on ${quick(item)}` }],
    };
  }

  return {
    plans: [],
    what:
      `I know: add a note [called X] [that says Y], rename X to Y, delete X, move X by dx, dy, resize X to WxH, restore X, say …, ask …, comment on X: … . ` +
      `I heard “${said}”.`,
  };
}

function describeCanvas(ctx: PlanContext): string {
  if (ctx.items.length === 0) return "This canvas is empty.";
  // Ids, not just titles: a read that describes state without naming it is
  // unusable for a follow-up action — "delete that" needs something to echo.
  const named = ctx.items.slice(0, 8).map((i) => `${i.title ?? "untitled"} [${i.id}]`);
  const more = ctx.items.length > named.length ? `, and ${ctx.items.length - named.length} more` : "";
  return `${ctx.items.length} things here: ${named.join("; ")}${more}.`;
}

/* ------------------------------------------------------------------ *
 * Speech to text, at the harness, with the harness's key
 * ------------------------------------------------------------------ */

export interface Transcript {
  text: string;
  provider: string;
}

/**
 * **Audio over loopback, key over loopback, provider from the harness.** The
 * page never sees either. WAV on the wire because both providers take it and
 * neither takes the browser's `webm` opus without a conversion this file would
 * then own.
 */
export async function transcribe(options: {
  wav: ArrayBuffer;
  key: VoiceKey;
  fetchImpl?: typeof fetch;
  model?: string;
}): Promise<Transcript> {
  const doFetch = options.fetchImpl ?? fetch;
  const bytes = new Uint8Array(options.wav);
  const model = options.model ?? "gemini-2.5-flash";
  const r = await doFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(options.key.key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Transcribe this audio exactly as spoken. Answer with the transcription and nothing else." },
              { inline_data: { mime_type: "audio/wav", data: base64(bytes) } },
            ],
          },
        ],
      }),
    },
  );
  const j = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(`gemini: ${j.error?.message ?? r.status}`);
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  return { text, provider: "gemini" };
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/* ------------------------------------------------------------------ *
 * The Live API: the socket, the model, and the tools
 * ------------------------------------------------------------------ */

/**
 * **Gemini's Live API, not transcribe-then-act** (Paul, 11 Sep 2026: *"it
 * should just be sending to the Gemini live api (or whatever the latest
 * is)"*). A stateful bidirectional WebSocket — `BidiGenerateContent` — where
 * audio goes up as 16 kHz PCM and comes back as 24 kHz PCM plus text, and
 * where the model can call the canvas's operations as tools.
 *
 * The custody rule does not change with the protocol: **the harness opens the
 * socket and holds the key; the page only ever sends audio to loopback.** The
 * page capture is already 16 kHz PCM, so nothing here resamples — the page
 * knows its own `AudioContext.sampleRate`, which is the side that has to.
 *
 * Function calling is synchronous: a tool call blocks the conversation until
 * it is answered, which is the right shape for canvas operations — they are
 * one local round trip — and the wrong shape for making a screen. Slow asks
 * belong in the Chat, as the research note says; the tool list here is the
 * fast set.
 *
 * `gemini-3.8-live` verified current on 15 Sep 2026 against Google's Live
 * API docs; the docs call `gemini-3.1-flash-live-preview` a legacy preview
 * and recommend 3.8 Live. A preview name moves; `--model` and
 * `LiveSessionOptions.model` exist so a person can move with it without a
 * release.
 */
export const LIVE_MODEL = "models/gemini-3.8-live";

export function liveUrl(key: string, host = "generativelanguage.googleapis.com"): string {
  return (
    `wss://${host}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` +
    `?key=${encodeURIComponent(key)}`
  );
}

/** The tool surface: exactly the fast set of operations a sentence can be,
 * declared so the model calls them rather than describing them. */
/** The tool surface: the canvas's operation vocabulary and read tools,
 * declared so the model calls them directly and decides what to do. */
export const LIVE_TOOLS = [
  // --- Canvas & Project Mutation Operations (Derived from @isocan/core Operation types) ---
  {
    name: "add_item",
    description:
      "Add something to the canvas. A note: title + text. A live web page: pass url (e.g. 'add a web page', " +
      "'put localhost:3000 on the canvas', 'show me example.com'). A page is an ordinary item whose content is a " +
      "text/uri-list, so it renders as a live site.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "The title of the new item." },
        text: { type: "STRING", description: "The note's markdown or text content." },
        url: { type: "STRING", description: "A web address to add as a live page (http(s) or host:port)." },
        kind: { type: "STRING", description: "What kind of item: 'note' (default) or 'site'." },
        x: { type: "NUMBER", description: "Optional x position on canvas." },
        y: { type: "NUMBER", description: "Optional y position on canvas." },
      },
      required: [],
    },
  },
  {
    name: "rename_item",
    description: "Rename something on the canvas. Use the item's current title, prefix, or ordinal phrase.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item's title, a prefix of it, or an ordinal phrase." },
        title: { type: "STRING", description: "The new title." },
      },
      required: ["item_ref", "title"],
    },
  },
  {
    name: "update_item",
    description: "Update an item's title or description on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item's title, prefix, or id." },
        title: { type: "STRING", description: "Optional new title." },
        description: { type: "STRING", description: "Optional new description." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "delete_item",
    description: "Delete or remove an item from the canvas (e.g. 'delete the Greeting', 'remove that card'). Sends item to trash.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item title, prefix, or id to delete." } },
      required: ["item_ref"],
    },
  },
  {
    name: "restore_item",
    description: "Restore an item from the trash back to the canvas.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item to restore." } },
      required: ["item_ref"],
    },
  },
  {
    name: "move_item",
    description: "Move an item across the canvas (e.g. 'move Checkout screen right 50', 'move the note up 100'). Supports by_x/by_y or to_x/to_y.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Item title, prefix, or id." },
        by_x: { type: "NUMBER", description: "Relative horizontal shift in pixels." },
        by_y: { type: "NUMBER", description: "Relative vertical shift in pixels." },
        to_x: { type: "NUMBER", description: "Absolute target x coordinate." },
        to_y: { type: "NUMBER", description: "Absolute target y coordinate." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "resize_item",
    description: "Resize an item on the canvas to width and height.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING" },
        width: { type: "NUMBER", description: "Width in pixels." },
        height: { type: "NUMBER", description: "Height in pixels." },
      },
      required: ["item_ref", "width", "height"],
    },
  },
  {
    name: "say",
    description: "Say something in the canvas Chat, where every parked agent hears it.",
    parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
  },
  {
    name: "ask",
    description: "Ask the person a question on the canvas, pinned to the Chat.",
    parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
  },
  {
    name: "comment_on_item",
    description: "Add a comment or note to an existing canvas item (e.g. 'comment on Checkout that we need a button', 'add comment to Greeting').",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item title, prefix, or id to comment on." }, text: { type: "STRING", description: "The comment text." } },
      required: ["item_ref", "text"],
    },
  },
  {
    name: "item_add_version",
    description:
      "Add a NEW version of content to an existing item — a checkpoint the person can switch back to. Use for " +
      "'add a version', 'save this as another version', 'attach this text to X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item title, prefix, or id." },
        content: { type: "STRING", description: "The new version's full text/markdown." },
        filename: { type: "STRING", description: "Optional filename for the version." },
        mime: { type: "STRING", description: "Optional MIME type (default text/markdown)." },
      },
      required: ["item_ref", "content"],
    },
  },
  {
    name: "thread_create",
    description:
      "Start a new conversation thread — anchored to an item (item_ref) or at a canvas point (x, y). Use for " +
      "'start a thread about X', 'open a discussion here', 'make a note on X'. For a comment on an item, comment_on_item is the same act.",
    parameters: {
      type: "OBJECT",
      properties: {
        body: { type: "STRING", description: "The first comment in the thread." },
        item_ref: { type: "STRING", description: "Item to anchor the thread to." },
        x: { type: "NUMBER", description: "Canvas x if not anchored to an item." },
        y: { type: "NUMBER", description: "Canvas y if not anchored to an item." },
        main: { type: "BOOLEAN", description: "Make this the canvas's main Chat thread (only when none exists)." },
      },
      required: ["body"],
    },
  },
  {
    name: "thread_set_anchor",
    description: "Move a thread's pin: anchor it to an item, or to a point. Use for 'anchor that thread to X', 'move the discussion to X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        thread_id: { type: "STRING", description: "The thread to move." },
        item_ref: { type: "STRING", description: "Item to anchor it to (omit for a point)." },
        x: { type: "NUMBER" },
        y: { type: "NUMBER" },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "thread_set_main",
    description: "Make a thread the canvas's main Chat thread — where `notify` and the Chat panel read and write. Use for 'make this the main thread'.",
    parameters: {
      type: "OBJECT",
      properties: { thread_id: { type: "STRING", description: "The thread to promote." } },
      required: ["thread_id"],
    },
  },
  {
    name: "thread_delete",
    description: "Delete a conversation thread (undoable). Use for 'delete that thread', 'remove the discussion'.",
    parameters: {
      type: "OBJECT",
      properties: { thread_id: { type: "STRING", description: "The thread to delete." } },
      required: ["thread_id"],
    },
  },
  {
    name: "comment_update",
    description: "Rewrite a comment you wrote — a working note that changes as the work does. Use for 'edit that comment', 'change my comment to …'.",
    parameters: {
      type: "OBJECT",
      properties: {
        thread_id: { type: "STRING", description: "The thread the comment is in." },
        comment_id: { type: "STRING", description: "The comment to rewrite." },
        body: { type: "STRING", description: "The new text." },
      },
      required: ["thread_id", "comment_id", "body"],
    },
  },
  {
    name: "notify",
    description: "Say something in the canvas Chat (the main thread), so parked agents and people read it. Use for 'tell everyone', 'post in the Chat'.",
    parameters: {
      type: "OBJECT",
      properties: { text: { type: "STRING", description: "What to post." } },
      required: ["text"],
    },
  },
  {
    name: "actor_claim",
    description:
      "Give this agent the name THE PERSON has just said — the name it writes under, is @-mentioned by, and appears as " +
      "on the canvas. Use it only when the person names the agent themselves ('call yourself Nova', 'your name is Ada'); " +
      "never a name you chose for yourself, and never one you read on the canvas. The person is asked to confirm the " +
      "name before anything changes, so the claim can be refused.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "The name the person said, verbatim." },
      },
      required: ["name"],
    },
  },
  {
    name: "actor_set_color",
    description: "Change the colour this agent's presence wears on the canvas. Use for 'make me green', 'change my colour to blue'.",
    parameters: {
      type: "OBJECT",
      properties: { color: { type: "STRING", description: "A CSS colour (hex or name)." } },
      required: ["color"],
    },
  },
  {
    name: "actor_set_mark",
    description: "Change the emoji mark this agent's presence wears instead of its initial. Use for 'make my mark a fox', 'set my mark to 🔥'.",
    parameters: {
      type: "OBJECT",
      properties: { mark: { type: "STRING", description: "An emoji." } },
      required: ["mark"],
    },
  },
  {
    name: "actor_join",
    description:
      "Fold another actor this machine owns into this one, so both names answer as the same presence. Use only when the person " +
      "names the other actor explicitly ('join my other name', 'merge those two').",
    parameters: {
      type: "OBJECT",
      properties: { other_actor_id: { type: "STRING", description: "The actor id that should stop answering on its own." } },
      required: ["other_actor_id"],
    },
  },
  {
    name: "agent_enroll",
    description: "Enrol another agent on this canvas so it can be summoned by name. Use for 'enrol Codex', 'add that agent to this canvas'.",
    parameters: {
      type: "OBJECT",
      properties: {
        actor_id: { type: "STRING", description: "The agent's actor id." },
        name: { type: "STRING", description: "The name it answers to." },
      },
      required: ["actor_id", "name"],
    },
  },
  {
    name: "agent_withdraw",
    description: "Withdraw an enrolled agent from this canvas. Use for 'withdraw that agent', 'remove it from the canvas'.",
    parameters: {
      type: "OBJECT",
      properties: { actor_id: { type: "STRING", description: "The agent's actor id." } },
      required: ["actor_id"],
    },
  },
  {
    name: "drawing_add",
    description: "Draw ink or a sketch on the canvas using the pen tool (maps to item.add with kind=drawing and SVG strokes).",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Title or label for the sketch (default 'Sketch')." },
        color: { type: "STRING", description: "Hex color (e.g. '#23262b' or '#ff0000')." },
        width: { type: "NUMBER", description: "Stroke width in pixels (default 3)." },
        points: {
          type: "ARRAY",
          description: "List of points {x, y} tracing the stroke.",
          items: {
            type: "OBJECT",
            properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
            required: ["x", "y"],
          },
        },
      },
      required: ["points"],
    },
  },
  {
    name: "item_react",
    description: "Add or remove an emoji mark/reaction on an item (e.g. 'thumbs up on Checkout', 'react with ❤️ on Greeting', 'vote dot').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item to react to." },
        emoji: { type: "STRING", description: "The emoji mark (e.g. '👍', '❤️', '🔥', '⭐')." },
        on: { type: "BOOLEAN", description: "True to add the reaction, false to remove it (default true)." },
        at_x: { type: "NUMBER", description: "Optional x fraction (0..1) on the item for heat map." },
        at_y: { type: "NUMBER", description: "Optional y fraction (0..1) on the item for heat map." },
      },
      required: ["item_ref", "emoji"],
    },
  },
  {
    name: "find_items",
    description: "Search and find items on the canvas matching a query or keyword.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Search query string." },
      },
      required: ["query"],
    },
  },
  {
    name: "items_move",
    description: "Move multiple items together by a spatial delta (maps to core 'items.move').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to move.",
          items: { type: "STRING" },
        },
        by_x: { type: "NUMBER", description: "Horizontal delta to move by." },
        by_y: { type: "NUMBER", description: "Vertical delta to move by." },
      },
      required: ["item_refs", "by_x", "by_y"],
    },
  },
  {
    name: "items_delete",
    description: "Delete multiple items to the trash simultaneously (maps to core 'items.delete').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to delete.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "items_restore",
    description: "Restore multiple deleted items from the trash back to the canvas (maps to core 'items.restore').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to restore.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "item_set_current_version",
    description: "Switch an item's active visible version (convergence operation, maps to core 'item.setCurrentVersion').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Title, prefix, or id of the item." },
        version_ref: { type: "STRING", description: "Version id or ordinal like 'first' or 'last'." },
      },
      required: ["item_ref", "version_ref"],
    },
  },
  {
    name: "viewport_focus",
    description: "Center and zoom the collaborator's canvas view onto a specific item.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Item title or id to center on." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "viewport_pan",
    description: "Move the collaborator's camera to world coordinates and optional zoom level.",
    parameters: {
      type: "OBJECT",
      properties: {
        x: { type: "NUMBER", description: "Target world x coordinate." },
        y: { type: "NUMBER", description: "Target world y coordinate." },
        zoom: { type: "NUMBER", description: "Optional zoom level." },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "selection_set",
    description: "Select one or more items on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to select.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "selection_clear",
    description: "Clear active selection on the canvas.",
    parameters: { type: "OBJECT", properties: {} },
  },

  // --- Read & Inspection Tools (Answering Questions from Live Canvas State) ---
  {
    name: "project_switch",
    description:
      "Move this session to another canvas (project), without restarting — after this EVERY operation lands on the new " +
      "canvas, and the page says which one. Use for 'switch to Launch plan', 'work on the Winter canvas', 'open the other " +
      "project'. The new canvas's items are in the answer.",
    parameters: {
      type: "OBJECT",
      properties: {
        canvas_ref: { type: "STRING", description: "The canvas to move to: its title (or prefix), or its id." },
      },
      required: ["canvas_ref"],
    },
  },
  {
    name: "project_update",
    description:
      "Rename or re-describe a canvas (project). With no canvas_ref it is the canvas this session is working on; " +
      "give a title or id to change another one. Use for 'rename this canvas to Launch plan', 'call the project " +
      "Winter work', 'give it a description'.",
    parameters: {
      type: "OBJECT",
      properties: {
        canvas_ref: { type: "STRING", description: "A canvas title (or prefix) or id. Default: this session's canvas." },
        title: { type: "STRING", description: "The new title." },
        description: { type: "STRING", description: "The new one-line description." },
      },
      required: [],
    },
  },
  {
    name: "project_create",
    description:
      "Create a new canvas (project), with the title THE PERSON gave it. Use for 'make a new canvas called Launch plan', " +
      "'start a project for the redesign'. It is created, not entered: this session stays where it is until someone " +
      "switches to it.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "The canvas's title, in the person's words." },
        description: { type: "STRING", description: "Optional one-line description." },
      },
      required: ["title"],
    },
  },
  {
    name: "project_list",
    description:
      "List the canvases (projects) this home has, each with its id, and mark the one this session is working on. " +
      "Use for 'what projects are there', 'list my canvases', 'where am I'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "read_canvas",
    description: "Inspect the canvas: list all active items, their titles, kinds, positions, and current versions.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "read_item",
    description: "Read the full text content and metadata of a specific item on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item's title, prefix, or id." } },
      required: ["item_ref"],
    },
  },
  {
    name: "read_threads",
    description: "Read discussion threads and comments on the canvas or on a specific item.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "Optional item title or id." } },
    },
  },
  {
    name: "read_presence",
    description: "Check who is currently live on this canvas and which agents are enrolled.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "remember",
    description:
      "Store a durable note for future sessions — a fact the person asked you to remember, a decision, " +
      "a preference. It is written to the harness's own file beside its key and survives restarts. " +
      "Retrieval is case-insensitive SUBSTRING search over the text and tags (see search_memory), so " +
      "write the words you would later search for. Every memory is visible to, and deletable by, the person.",
    parameters: {
      type: "OBJECT",
      properties: {
        text: { type: "STRING", description: "The memory itself, as a sentence." },
        tags: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Optional tags to search by later (up to 8).",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "list_dir",
    description:
      "List files and folders inside the folder the person granted to this harness through the page. " +
      "The path is relative to that folder (omit it, or use \".\", for the root); nothing outside the " +
      "grant can be listed or read. Fails with an explanation when no page is connected, or no folder " +
      "has been granted yet.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path inside the granted folder; omit for the root." },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Read one text file from the folder the person granted, by its path relative to that folder's root. " +
      "The answer names the file it came from (folder/path) — say which file a fact came from when you use it. " +
      "Large files come back truncated with a flag rather than silently shortened.",
    parameters: {
      type: "OBJECT",
      properties: { path: { type: "STRING", description: "Relative path of the file inside the granted folder." } },
      required: ["path"],
    },
  },
  {
    name: "read_memory",
    description: "Read one stored memory in full by its id (ids come from remember and search_memory).",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING", description: "The memory id, e.g. mem_…" } },
      required: ["id"],
    },
  },
  {
    name: "search_memory",
    description:
      "Find stored memories by case-insensitive SUBSTRING match over their text and tags — NOT semantic " +
      "recall: a synonym you did not write will not be found. An empty query lists everything stored, " +
      "newest last.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Words to match; empty for everything." } },
    },
  },
];

/** Find and format project instructions (AGENTS.md / CLAUDE.md) for this canvas's project. */
export async function resolveProjectInstructions(
  home: string,
  canvasId: string,
): Promise<{ source: string; text: string; capped: boolean } | null> {
  const dirs = await fs.readFile(path.join(home, "dirs.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  let projectDir: string | null = null;
  for (const [dir, id] of Object.entries(dirs)) {
    if (id === canvasId) {
      const marker = await readMarker(dir).catch(() => null);
      if (marker && marker.canvasId === canvasId) {
        projectDir = dir;
        break;
      }
    }
  }
  if (!projectDir) {
    const rcRows = await readRcAgents(home).catch(() => []);
    const match = rcRows.find((r) => r.canvasId === canvasId && r.cwd);
    if (match) {
      const marker = await readMarker(match.cwd).catch(() => null);
      if (marker && marker.canvasId === canvasId) projectDir = match.cwd;
    }
  }
  if (!projectDir) {
    const marker = await readMarker(process.cwd()).catch(() => null);
    if (marker && marker.canvasId === canvasId) projectDir = process.cwd();
  }
  if (!projectDir) return null;

  const candidates = [
    path.join(projectDir, "AGENTS.md"),
    path.join(projectDir, "CLAUDE.md"),
  ];

  for (const file of candidates) {
    try {
      const content = await fs.readFile(file, "utf8");
      const maxLen = 12000;
      const capped = content.length > maxLen;
      const text = capped
        ? content.slice(0, maxLen) + "\n\n[... project instructions truncated for Live context budget ...]"
        : content;
      return { source: path.basename(file), text, capped };
    } catch {}
  }
  return null;
}

/** What the setup message is: the whole contract with the API in one object. */
export function liveSetup(
  model: string = LIVE_MODEL,
  instructions?: { source: string; text: string } | null,
  rules: string = VOICE_RULES,
): object {
  /**
   * The extended-thinking model needs its thinking depth named at setup
   * (its docs: `thinking_config`, levels low/medium/high, no minimal), and
   * the plain 3.8 Live refuses a thinkingLevel outright — so the field is
   * model-shaped, never sent generally. ponytail: `low` is fixed; expose a
   * flag when a person asks to trade latency for reasoning depth.
   */
  const thinkingConfig = model.includes("extended-thinking")
    ? { thinkingConfig: { thinkingLevel: "low" } }
    : {};
  return {
    setup: {
      model,
      generationConfig: {
        responseModalities: ["AUDIO"],
        ...thinkingConfig,
      },
      systemInstruction: {
        parts: [{ text: voiceInstruction(rules, instructions) }],
      },
      tools: [{ functionDeclarations: LIVE_TOOLS }],
    },
  };
}

/** A tool call, as a plan: the same vocabulary the typed grammar produces, so
 * a spoken `move` and a typed one are one implementation. */
export function planForCall(name: string, args: Record<string, unknown>): { plans: PlannedOp[]; what?: string } {
  const ref = typeof args.item_ref === "string" ? args.item_ref : "";
  const text = typeof args.text === "string" ? args.text : "";
  switch (name) {
    case "add_item": {
      const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
      if (rawUrl !== "" || args.kind === "site") {
        if (rawUrl === "") {
          return { plans: [], what: "adding a site needs a url — say the address to project" };
        }
        let site: string;
        try {
          site = normalizeSiteUrl(rawUrl);
        } catch (err) {
          return { plans: [], what: `that is not a web address — ${(err as Error).message}` };
        }
        const title = String(args.title ?? siteLabel(site));
        return {
          plans: [
            {
              op: {
                type: "item.add",
                title,
                text: `${site}\n`,
                mime: BROWSER_MIME,
                x: args.x !== undefined ? Number(args.x) : undefined,
                y: args.y !== undefined ? Number(args.y) : undefined,
              },
              said: `add "${title}" as a web page`,
            },
          ],
        };
      }
      const title = String(args.title ?? "New note");
      /* **A title with no body still makes a note.** "Add a note called
         Banana" is how a person says it, and the model answers it with
         `{title: "Banana"}` and no text. An empty body is not a note the
         daemon accepts — an empty blob is refused with `empty blob body` — so
         the title becomes the body, which is what the note would say anyway.
         Found by driving the path: the model got the tool call right and the
         canvas answered with a refusal. */
      const text = String(args.text ?? "").trim() || title;
      return {
        plans: [
          {
            op: {
              type: "item.add",
              title,
              text,
              x: args.x !== undefined ? Number(args.x) : undefined,
              y: args.y !== undefined ? Number(args.y) : undefined,
            },
            said: `add "${title}"`,
          },
        ],
      };
    }
    case "update_item":
    case "rename_item": {
      const hasTitle = args.title !== undefined && args.title !== null;
      const hasDesc = args.description !== undefined && args.description !== null;
      let label: string;
      if (hasTitle && hasDesc) {
        label = `renamed "${ref}" to "${args.title}" and updated description`;
      } else if (hasTitle) {
        label = `renamed "${ref}" to "${args.title}"`;
      } else if (hasDesc) {
        label = `description updated on "${ref}"`;
      } else {
        label = `updated "${ref}"`;
      }
      return {
        plans: [
          {
            op: {
              type: "item.update",
              ref,
              title: hasTitle ? String(args.title) : undefined,
              description: hasDesc ? String(args.description) : undefined,
            },
            said: label,
          },
        ],
      };
    }
    case "delete_item":
      return { plans: [{ op: { type: "item.delete", ref }, said: `deleted ${ref}` }] };
    case "restore_item":
      return { plans: [{ op: { type: "item.restore", ref }, said: `restored ${ref}` }] };
    case "resize_item":
      return {
        plans: [
          {
            op: {
              type: "item.resize",
              ref,
              width: Number(args.width ?? 320),
              height: Number(args.height ?? 240),
            },
            said: `resized ${ref}`,
          },
        ],
      };
    case "move_item": {
      const by = args.by_x !== undefined || args.by_y !== undefined;
      return {
        plans: [
          {
            op: {
              type: "item.move",
              ref,
              by,
              x: by ? Number(args.by_x ?? 0) : Number(args.to_x ?? 0),
              y: by ? Number(args.by_y ?? 0) : Number(args.to_y ?? 0),
            },
            said: `moved ${ref}`,
          },
        ],
      };
    }
    case "say":
      return { plans: [{ op: { type: "thread.reply", body: text }, said: `said: ${text}` }] };
    case "ask":
      return { plans: [{ op: { type: "thread.reply", body: `? ${text}` }, said: `asked: ${text}` }] };
    case "comment_on_item":
      return { plans: [{ op: { type: "thread.create", ref, body: text }, said: `commented on ${ref}` }] };
    case "item_add_version": {
      const itemRef = typeof args.item_ref === "string" ? args.item_ref : "";
      return {
        plans: [
          {
            op: {
              type: "item.addVersion",
              ref: itemRef,
              body: String(args.content ?? args.text ?? ""),
              ...(args.filename !== undefined ? { filename: String(args.filename) } : {}),
              ...(args.mime !== undefined ? { mime: String(args.mime) } : {}),
            },
            said: `add a version to ${itemRef}`,
          },
        ],
      };
    }
    case "thread_create": {
      const itemRef = typeof args.item_ref === "string" && args.item_ref !== "" ? args.item_ref : undefined;
      const body = String(args.body ?? args.text ?? "");
      return {
        plans: [
          {
            op: {
              type: "thread.create",
              ...(itemRef !== undefined ? { ref: itemRef } : {}),
              body,
              ...(args.x !== undefined ? { x: Number(args.x) } : {}),
              ...(args.y !== undefined ? { y: Number(args.y) } : {}),
              ...(args.main === true ? { main: true } : {}),
            },
            said: itemRef ? `start a thread on ${itemRef}` : "start a thread",
          },
        ],
      };
    }
    case "thread_set_anchor":
      return {
        plans: [
          {
            op: {
              type: "thread.setAnchor",
              threadId: String(args.thread_id ?? ""),
              ...(typeof args.item_ref === "string" && args.item_ref !== "" ? { ref: args.item_ref } : {}),
              ...(args.x !== undefined ? { x: Number(args.x) } : {}),
              ...(args.y !== undefined ? { y: Number(args.y) } : {}),
            },
            said: `move thread ${args.thread_id}`,
          },
        ],
      };
    case "thread_set_main":
      return { plans: [{ op: { type: "thread.setMain", threadId: String(args.thread_id ?? "") }, said: `make ${args.thread_id} the main thread` }] };
    case "thread_delete":
      return { plans: [{ op: { type: "thread.delete", threadId: String(args.thread_id ?? "") }, said: `delete thread ${args.thread_id}` }] };
    case "comment_update":
      return {
        plans: [
          {
            op: {
              type: "comment.update",
              threadId: String(args.thread_id ?? ""),
              commentId: String(args.comment_id ?? ""),
              body: String(args.body ?? args.text ?? ""),
            },
            said: `edit comment ${args.comment_id}`,
          },
        ],
      };
    case "notify":
      return { plans: [{ op: { type: "thread.reply", body: text, notify: true }, said: "post in the Chat" }] };
    case "actor_set_color":
      return { plans: [{ op: { type: "actor.setColor", color: String(args.color ?? "") }, said: `change my colour to ${args.color}` }] };
    case "actor_set_mark":
      return { plans: [{ op: { type: "actor.setMark", mark: String(args.mark ?? "") }, said: `make my mark ${args.mark}` }] };
    case "actor_join":
      return { plans: [{ op: { type: "actor.join", from: String(args.other_actor_id ?? "") }, said: `join ${args.other_actor_id}` }] };
    case "agent_enroll":
      return {
        plans: [
          {
            op: { type: "agent.enroll", actorId: String(args.actor_id ?? ""), agentName: String(args.name ?? "") },
            said: `enrol ${args.name}`,
          },
        ],
      };
    case "agent_withdraw":
      return { plans: [{ op: { type: "agent.withdraw", actorId: String(args.actor_id ?? "") }, said: `withdraw ${args.actor_id}` }] };
    case "drawing_add": {
      const color = String(args.color ?? "#23262b");
      const strokeWidth = Number(args.width ?? 3);
      const rawPoints = (args.points as Array<{ x: number; y: number }>) ?? [{ x: 100, y: 100 }, { x: 200, y: 200 }];
      const strokes: InkStroke[] = [{ color, width: strokeWidth, points: rawPoints }];
      const box = inkBounds(strokes) ?? { minX: 100, minY: 100, maxX: 300, maxY: 300 };
      const svg = drawingSvg(strokes, box);
      const width = Math.max(80, box.maxX - box.minX + 16);
      const height = Math.max(80, box.maxY - box.minY + 16);
      return {
        plans: [
          {
            op: {
              type: "item.add",
              title: String(args.title ?? "Sketch"),
              content: svg,
              mime: DRAWING_MIME,
              properties: DRAWING_PROPERTIES,
              width,
              height,
              x: box.minX - 8,
              y: box.minY - 8,
            },
            said: `drew “${args.title ?? "Sketch"}” with the pen tool`,
          },
        ],
      };
    }
    case "item_react":
      return {
        plans: [
          {
            op: {
              type: "item.react",
              ref,
              emoji: String(args.emoji ?? "👍"),
              on: args.on !== false,
              ...(args.at_x !== undefined && args.at_y !== undefined ? { at: { x: Number(args.at_x), y: Number(args.at_y) } } : {}),
            },
            said: `${args.on === false ? "removed" : "added"} reaction ${args.emoji ?? "👍"} on ${ref}`,
          },
        ],
      };
    case "items_move": {
      const refs = (args.item_refs as string[]) ?? [];
      const byX = Number(args.by_x ?? 0);
      const byY = Number(args.by_y ?? 0);
      return {
        plans: refs.map((r) => ({
          op: { type: "item.move", ref: r, by: true, x: byX, y: byY },
          said: `moved ${r} by ${byX}, ${byY}`,
        })),
      };
    }
    case "items_delete": {
      const refs = (args.item_refs as string[]) ?? [];
      return {
        plans: refs.map((r) => ({
          op: { type: "item.delete", ref: r },
          said: `deleted ${r}`,
        })),
      };
    }
    case "items_restore": {
      const refs = (args.item_refs as string[]) ?? [];
      return {
        plans: refs.map((r) => ({
          op: { type: "item.restore", ref: r },
          said: `restored ${r}`,
        })),
      };
    }
    case "item_set_current_version": {
      const vRef = String(args.version_ref ?? "");
      return {
        plans: [
          {
            op: { type: "item.setCurrentVersion", ref, versionRef: vRef },
            said: `switched version of ${ref} to ${vRef}`,
          },
        ],
      };
    }
    case "viewport_focus":
    case "viewport_pan":
    case "selection_set":
    case "selection_clear":
      return { plans: [], what: `__${name}__` };
    case "find_items":
      return { plans: [], what: "__find_items__" };
    case "read_canvas":
      return { plans: [], what: "__read_canvas__" };
    case "read_item":
      return { plans: [], what: "__read_item__" };
    case "read_threads":
      return { plans: [], what: "__read_threads__" };
    case "read_presence":
      return { plans: [], what: "__read_presence__" };
    default:
      return { plans: [], what: `the model called ${name}, which this harness does not have` };
  }
}

/**
 * **What was minted, in words — never what it turned out to do.**
 *
 * Paul's log showed an `update_item` that changed a description logged as
 * "renamed": the label had been written by the tool's author rather than read
 * off the operation, and the operation is the only thing that knows. These
 * are action phrases because the outcome is not known yet — the daemon's
 * answer is what says the change landed, and it replaces this wording rather
 * than sitting behind it.
 */
export function describeMintedOp(op: { type: string; [key: string]: unknown }, targetName?: string): string {
  const ref = targetName || (op.ref as string) || (op.itemId as string) || "item";
  switch (op.type) {
    case "item.add":
      return op.mime === BROWSER_MIME
        ? `add "${op.title ?? "Note"}" as a web page`
        : `add "${op.title ?? "Note"}"`;
    case "item.update": {
      const hasTitle = op.title !== undefined && op.title !== null;
      const hasDesc = op.description !== undefined && op.description !== null;
      if (hasTitle && hasDesc) return `update "${ref}": new title "${op.title}", new description`;
      if (hasTitle) return `update "${ref}": new title "${op.title}"`;
      if (hasDesc) return `update "${ref}": new description`;
      return `update "${ref}"`;
    }
    case "item.delete":
      return `delete "${ref}"`;
    case "item.restore":
      return `restore "${ref}"`;
    case "item.move":
      return `move "${ref}" to ${op.x}, ${op.y}`;
    case "item.resize":
      return `resize "${ref}" to ${op.width}x${op.height}`;
    case "item.setCurrentVersion":
      return `switch "${ref}" to version ${op.versionId ?? op.versionRef}`;
    case "item.react":
      return `${op.on === false ? "remove" : "add"} reaction ${op.emoji ?? ""} on "${ref}"`;
    case "thread.create":
      return `start a thread on "${ref}"`;
    case "item.addVersion":
      return `add a version to "${ref}"`;
    case "thread.reply":
      return op.notify === true ? "post in the Chat" : `reply in thread ${op.threadId ?? ""}`;
    case "thread.setAnchor":
      return `move thread ${op.threadId} to "${ref}"`;
    case "thread.setMain":
      return `make thread ${op.threadId} the main thread`;
    case "thread.delete":
      return `delete thread ${op.threadId}`;
    case "comment.update":
      return `edit comment ${op.commentId}`;
    case "actor.setColor":
      return `change my colour to ${op.color}`;
    case "actor.setMark":
      return `make my mark ${op.mark}`;
    case "actor.join":
      return `join ${op.from} into this actor`;
    case "agent.enroll":
      return `enrol ${op.agentName}`;
    case "agent.withdraw":
      return `withdraw ${op.actorId}`;
    case "drawing.add":
      return `draw "${op.title ?? "Drawing"}" with the pen tool`;
    case "trash.empty":
      return `empty the canvas trash`;
    default:
      return `${op.type} on "${ref}"`;
  }
}

/** A plan that could not be minted, and why — the reason kept apart from
 * the sentence the model reads, because the log should show the reason under
 * the operation's own name and nothing should read as an outcome. */
export interface RefusedPlan {
  type: string;
  said: string;
  message: string;
}

/** What the model asked for, turned into operations the canvas can apply:
 * a spoken reference resolved against what is actually here, and a delta
 * turned into the absolute position `item.move` takes. A reference nobody can
 * resolve is REFUSED in words rather than guessed at. */
export function resolveLivePlans(
  plans: PlannedOp[],
  items: ListedItem[],
  trashItems: ListedItem[] = [],
): { ready: PlannedOp[]; refused: RefusedPlan[] } {
  const ready: PlannedOp[] = [];
  const refused: RefusedPlan[] = [];
  for (const plan of plans) {
    const op = { ...plan.op } as { type: string; [key: string]: unknown };
    let targetLabel: string | undefined;
    if (op.type !== "item.add") {
      const ref = typeof op.ref === "string" ? op.ref : null;
      if (ref !== null) {
        const candidateList = op.type === "item.restore" ? [...trashItems, ...items] : items;
        const item = resolveSpokenRef(ref, candidateList);
        if (!item) {
          const said = `could not resolve “${ref}”`;
          refused.push({ type: op.type, said, message: `${op.type} failed — ${said}` });
          continue;
        }
        delete op.ref;
        op.itemId = item.id;
        if (op.type === "item.move" && op.by === true) {
          op.x = Number(item.x ?? 0) + Number(op.x ?? 0);
          op.y = Number(item.y ?? 0) + Number(op.y ?? 0);
        }
        delete op.by;
        if (op.type === "item.setCurrentVersion") {
          const vRef = String(op.versionRef ?? "");
          let verId = vRef;
          if (item.versions) {
            const match = item.versions.find(
              (v) => v.id === vRef || v.filename === vRef || vRef.includes(v.id.slice(0, 8))
            );
            if (match) verId = match.id;
            else if (vRef === "first" && item.versions[0]) verId = item.versions[0].id;
            else if (vRef === "last" && item.versions.length) verId = item.versions[item.versions.length - 1]!.id;
          }
          op.versionId = verId;
          delete op.versionRef;
        }
        targetLabel = item.title || item.id;
      }
    }
    // Derived from the operation that was actually minted and the item it
    // actually resolved to — never from the sentence that asked for it.
    plan.said = describeMintedOp(op, targetLabel);
    ready.push({ op, said: plan.said });
  }
  return { ready, refused };
}

export interface LiveCallbacks {
  onHeard?: (text: string) => void;
  onText?: (text: string) => void;
  /** The model asked for an operation. Answers with what to say back to it. */
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Last chance to add context — recent actions with their ids and acks —
   * to every tool result the model sees. */
  decorateResponse?: (answer: Record<string, unknown>) => Record<string, unknown>;
  onAudio?: (pcm: Uint8Array) => void;
  onState?: (state: string, bad?: boolean) => void;
  onEvent?: (event: string, details?: Record<string, unknown>) => void;
}

export interface LiveSession {
  send(pcm: Uint8Array): void;
  close(): void;
  readonly ready: Promise<boolean>;
}

/**
 * **One live session.** Opened by the harness, fed by the page, and closed
 * when either side says so. A failure is reported in the provider's own
 * words: a key the provider rejects, a model it does not have, a quota — the
 * message is the message, and guessing at its cause on this side is how the
 * key panel came to refuse a real key.
 */
export function startLiveSession(options: {
  key: VoiceKey;
  model?: string;
  instructions?: { source: string; text: string } | null;
  /** The rules the person has edited, if any — the inspector shows the same text. */
  rules?: string;
  callbacks?: LiveCallbacks;
  urlFor?: (key: string) => string;
  WebSocketImpl?: typeof WebSocket;
}): LiveSession {
  const Socket = options.WebSocketImpl ?? WebSocket;
  const callbacks = options.callbacks ?? {};
  const url = options.urlFor
    ? options.urlFor(options.key.key)
    : options.key.provider === "gemini"
      ? liveUrl(options.key.key)
      : liveUrl(options.key.key);
  const socket = new Socket(url);
  let settled = false;
  let settle: (value: boolean) => void = () => {};
  let audioUpFrames = 0;
  let audioDownFrames = 0;

  callbacks.onEvent?.("socket_opening", { url: url.split("?")[0] });

  const ready = new Promise<boolean>((resolve) => {
    settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    socket.onopen = () => {
      callbacks.onEvent?.("socket_open", { model: options.model ?? LIVE_MODEL });
      socket.send(JSON.stringify(liveSetup(options.model ?? LIVE_MODEL, options.instructions, options.rules ?? VOICE_RULES)));
    };
    socket.onerror = () => {
      callbacks.onState?.("the live socket refused", true);
      settle(false);
    };
    socket.onclose = (event: any) => {
      const code = event?.code;
      const reason = event?.reason ? String(event.reason) : "";
      callbacks.onEvent?.("socket_closed", { code, reason, audioUpFrames, audioDownFrames });
      if (code && code !== 1000) {
        const closeMsg = `provider closed socket: code ${code}${reason ? ` — ${reason}` : ""}`;
        callbacks.onState?.(closeMsg, true);
      }
      settle(false);
    };
    socket.onmessage = (event: { data: unknown }) => {
      void handleMessage(event.data);
    };
  });

  async function handleMessage(raw: unknown): Promise<void> {
    let text: string;
    if (typeof raw === "string") text = raw;
    else if (raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
      text = new TextDecoder().decode(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw);
    } else if (raw && typeof (raw as { text?: () => Promise<string> }).text === "function") {
      text = await (raw as { text: () => Promise<string> }).text();
    } else {
      return;
    }
    let message: Record<string, any>;
    try {
      message = JSON.parse(text) as Record<string, any>;
    } catch {
      return;
    }
    if (message.error) {
      // The provider's own words, verbatim: it is the judge of the key, the
      // model and the quota, and a paraphrase here is how a real key came to
      // be called invalid.
      callbacks.onState?.(String(message.error.message ?? JSON.stringify(message.error)), true);
      settle(false);
      return;
    }
    if (message.setupComplete) {
      callbacks.onEvent?.("setup_complete", {});
      callbacks.onState?.("live", false);
      settle(true);
      return;
    }
    const content = message.serverContent;
    if (content) {
      if (content.inputTranscription?.text) callbacks.onHeard?.(content.inputTranscription.text);
      if (content.outputTranscription?.text) callbacks.onText?.(content.outputTranscription.text);
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.text) callbacks.onText?.(part.text);
        if (part.inlineData?.data) {
          audioDownFrames++;
          const bytes = Buffer.from(part.inlineData.data, "base64");
          callbacks.onAudio?.(bytes);
        }
      }
      if (content.interrupted) callbacks.onState?.("the model was interrupted", false);
      // **A turn boundary, as the provider reported it.** This is the one
      // signal that says the model heard a whole utterance; without it a
      // silent session and a slow one look identical in the log, which is
      // exactly how a broken resampler spent a day disguised as a UI problem.
      // Recorded, never inferred from a frame counter.
      if (content.turnComplete) callbacks.onEvent?.("turn_complete", {});
      // The extended-thinking model keeps reasoning (and calling tools) after
      // `turnComplete: true` — its docs say the idle signal is this, and it is
      // passed through for the log rather than interpreted.
      const status = content.interaction_status ?? message.interaction_status;
      if (status) callbacks.onEvent?.("interaction_status", { status });
    }
    if (message.toolCall?.functionCalls) {
      const responses: Record<string, unknown>[] = [];
      for (const call of message.toolCall.functionCalls) {
        const answer = await (callbacks.onToolCall?.(call.name, call.args ?? {}) ?? Promise.resolve({ ok: true }));
        responses.push({
          id: call.id,
          name: call.name,
          response: callbacks.decorateResponse ? callbacks.decorateResponse(answer) : answer,
        });
      }
      // Function calling is synchronous: the conversation waits for this, so
      // it carries the RESULT of the operation, not a promise of one.
      socket.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
  }

  return {
    send(pcm) {
      if (socket.readyState !== 1) return;
      audioUpFrames++;
      socket.send(
        JSON.stringify({
          // `realtimeInput.audio` is the current field. `mediaChunks` is marked
          // "DEPRECATED: Use one of `audio`, `video`, or `text` instead" in
          // ai.google.dev/api/live, and this tree once carried it by accident.
          realtimeInput: { audio: { data: Buffer.from(pcm).toString("base64"), mimeType: "audio/pcm;rate=16000" } },
        }),
      );
    },
    close() {
      try {
        socket.close();
      } catch {
        // already gone
      }
    },
    ready,
  };
}

/* ------------------------------------------------------------------ *
 * The standing server: the page, and the operations it sends
 * ------------------------------------------------------------------ */

/** Does the provider accept this key? Its own words, either way. */
export async function checkKey(
  key: VoiceKey,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; answer: string; provider: string }> {
  try {
    const r = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.key)}`,
    );
    const body = await r.text();
    return { ok: r.ok, answer: r.ok ? "accepted" : `${r.status} ${body.slice(0, 300)}`, provider: "gemini" };
  } catch (err) {
    return { ok: false, answer: `could not reach the provider: ${String((err as Error).message ?? err)}`, provider: key.provider };
  }
}

/**
 * **The operations a person has to agree to.**
 *
 * Every one of these destroys something a person can see: an item on the
 * canvas, or a set of them. Keyed on the OPERATION, not the tool name, so a
 * second tool that deletes something is gated by existing and the typed path
 * is gated by the same rule as the spoken one.
 * Rescued from the harness lane that died (3cebbfe2) — the gate is the piece
 * `actor_claim` needs, because a name is also the person's to give.
 */
export const DESTRUCTIVE_OPS = new Set(["item.delete", "items.delete"]);

/** How long the person has to answer before the gate closes itself. */
export const CONFIRM_TIMEOUT_MS = 60_000;

/**
 * **The question, in the person's words rather than the log's.**
 *
 * `said` is an action label written for a record that is already past —
 * "deleted the Greeting" — and a question built from it reads like a thing
 * that already happened. Composed from the OPERATION (and the reference the
 * person spoke), so the page asks about the act and the log still records the
 * label.
 *
 * `items` is how a typed delete gets named: the grammar hands over an
 * `itemId` it has already resolved, and "delete “that item”" is not a
 * question anybody can answer.
 */
export function theQuestion(plans: readonly PlannedOp[], items: readonly ListedItem[] = []): string {
  return plans
    .map((one) => {
      const op = one.op as { type: string; ref?: string; itemId?: string };
      if (op.type !== "item.delete" && op.type !== "items.delete") return one.said;
      const ref = op.ref ?? items.find((item) => item.id === op.itemId)?.title;
      return `delete “${ref ?? "that item"}”`;
    })
    .join("; ");
}
/**
 * **The enrolment's name moves too, or the rename is only half done.**
 *
 * The rc's row is a cache of the registry's name — `rc.ts` says so in as many
 * words, "the registry stays the authority on names" — and a cache nobody
 * refreshes is a lie the person hears: `isocan who`, the agent tray and
 * `rc turn <name>` all read it, so after a rename they would still be
 * summoning a name the agent no longer answers to.
 *
 * Rows are keyed on (canvasId, actorId), so this is the LABEL moving and never
 * a new enrolment: the id, the harness, the working directory and the ACP
 * session handle stay exactly as they were. Every row for this actor in this
 * home, not only this canvas's — one machine answers for one actor, and its
 * rows elsewhere would otherwise keep the old name in front of somebody.
 *
 * Returns how many rows moved, so the answer can say so instead of implying it.
 */
async function renameEnrolments(home: string, actorId: string, name: string): Promise<number> {
  const rows = await readRcAgents(home).catch(() => []);
  const mine = rows.filter((row) => row.actorId === actorId && !sameWord(row.name, name));
  for (const row of mine) await upsertRcAgent(home, { ...row, name });
  return mine.length;
}
export interface VoiceServerOptions {
  home: string;
  port?: number;
  /** The identity to speak as — the enrolled agent's session key, or absent
   * to resolve the ambient one the way the CLI does. */
  identity?: { session: string; harness?: string };
  /** The canvas to send to; absent means this directory's. */
  canvas?: string;
  /** The daemon this harness should speak to, when it is not the one the
   * ambient environment names. */
  daemonPort?: number;
  onLine?: (line: string) => void;
  /** The Live model, when it is not the current default. */
  model?: string;
  /** The socket address, for a test that needs a local stand-in. */
  liveUrl?: (key: string) => string;
  /** How long the person has to answer a gated operation's question. A test
   * shortens it; a person gets a minute. */
  confirmTimeoutMs?: number;
  /** How long a page has to answer a file question, for a test. */
  fsTimeoutMs?: number;
  /** The same, for a memory question. */
  memoryTimeoutMs?: number;
  /** The network, for a test. */
  fetchImpl?: typeof fetch;
  /** WebSocket implementation override for tests. */
  WebSocketImpl?: any;
}

export interface ToolLogEntry {
  id: string;
  timestamp: string;
  type: "tool_call" | "session_event" | "utterance";
  source?: "live" | "typed" | "system" | undefined;
  name?: string | undefined;
  args?: Record<string, unknown> | undefined;
  op?: { type: string; said?: string | undefined; target?: string | undefined } | undefined;
  result?: { ok: boolean; answer?: unknown; error?: string | undefined; [k: string]: unknown } | undefined;
  event?: string | undefined;
  reason?: string | undefined;
  details?: Record<string, unknown> | string | undefined;
}

export interface VoiceServerState {
  port: number;
  url: string;
  name: string;
  canvas: string;
  lines: string[];
  session: { state: "idle" | "live" | "muted" | "ended" };
  toolLog: ToolLogEntry[];
  /** A destructive operation waiting for the person's answer, if any: the
   * page renders it and posts the answer back to /confirm. */
  confirm: { id: string; what: string } | null;
}

/**
 * **Resolve where this harness was told to be, not where the process happens
 * to be standing.** `connect()` reads the home and the port out of the
 * environment (`paths.isocanHome()`), which is right for a CLI typed in a
 * shell and wrong for a harness handed a home as an argument: the harness
 * would silently speak to a different isocan than the one it serves — in a
 * test, the developer's real `~/.isocan`. Setting them for the call and
 * putting them back is the honest way to say which place this is.
 */
async function withHome<T>(home: string, port: number | undefined, work: () => Promise<T>): Promise<T> {
  const beforeHome = process.env.ISOCAN_HOME;
  const beforePort = process.env.ISOCAN_PORT;
  process.env.ISOCAN_HOME = home;
  if (port !== undefined) process.env.ISOCAN_PORT = String(port);
  try {
    return await work();
  } finally {
    if (beforeHome === undefined) delete process.env.ISOCAN_HOME;
    else process.env.ISOCAN_HOME = beforeHome;
    if (beforePort === undefined) delete process.env.ISOCAN_PORT;
    else process.env.ISOCAN_PORT = beforePort;
  }
}

/**
 * **One canvas handle, resolved once and reused.** `connect()` resolves the
 * same way every CLI command does — the directory marker, `ISOCAN_CANVAS`, the
 * ambient session key — so a harness started by the rc and a harness started
 * by hand speak as the same collaborator when they are given the same
 * identity.
 */
async function handleFor(options: VoiceServerOptions): Promise<{
  canvas: CanvasHandle;
  name: string;
  actorId: string;
  canvasLabel: string;
  canvasId: string;
  daemon: string;
  mainThreadId: string | null;
}> {
  const home = await withHome(options.home, options.daemonPort, async () =>
    connect(options.identity ? { identity: options.identity } : {}),
  );
  const canvas = await home.canvas(options.canvas);
  const threads = await canvas.threads();
  const main = threads.find((t) => t.main) ?? null;
  const daemon = canvas.ctx.client.base;
  return {
    canvas,
    name: home.actor.name,
    actorId: home.actor.id,
    canvasLabel: canvas.title,
    canvasId: canvas.id,
    daemon,
    mainThreadId: main?.id ?? null,
  };
}

/**
 * **The session key this harness speaks under — read off the daemon's own
 * row, never rebuilt from the name.**
 *
 * `voice-agent` claims `agent:<name>`, and the name is the one thing a claim
 * CHANGES: a key recomputed from the new name would be a second conversation
 * for the same actor, and the daemon refuses to re-key a live actor (one
 * actor, two faces — the refusal that stops a second session unseating a
 * working agent). So the row that already binds this actor is the answer.
 */
async function theKeyWeHold(canvas: CanvasHandle, actorId: string): Promise<string | null> {
  const rows = await canvas.ctx.client.actorBindings().catch(() => null);
  return rows?.find((row) => row.actor.id === actorId)?.key ?? null;
}

/** Send one planned operation through the API handle, so a spoken change is
 * the same operation a click would have made. */
async function applyPlan(
  canvas: CanvasHandle,
  plan: PlannedOp,
  ctx: PlanContext,
  onIo?: (status: "sent" | "ack" | "err", said: string, err?: string) => void,
): Promise<{ seq?: number; target?: string; ack: string }> {
  const op = plan.op as { type: string; [key: string]: unknown };
  // The daemon's answer should name the thing a person named, not its id.
  const nameOf = (id: unknown): string => ctx.items.find((one) => one.id === id)?.title || String(id ?? "item");
  onIo?.("sent", plan.said);
  try {
    let result: { seq?: number; target?: string; ack: string };
    switch (op.type) {
      case "item.add": {
        const added = await canvas.add({
          title: String(op.title ?? "Note"),
          content: String(op.text ?? op.content ?? ""),
          mime: (op.mime as string) ?? "text/markdown",
          ...(op.properties ? { properties: op.properties as Record<string, string> } : {}),
          ...(op.x !== undefined && op.y !== undefined ? { at: { x: Number(op.x), y: Number(op.y) } } : {}),
          ...(op.width !== undefined && op.height !== undefined ? { size: { width: Number(op.width), height: Number(op.height) } } : {}),
        });
        result = { target: added.id, ack: `added ${added.title}` };
        break;
      }
      case "item.update": {
        // The title is a `MetaPatch` field, not a property — `set()`'s property
        // bag would write a property NAMED title, which is a different act.
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.update",
          itemId: op.itemId as string,
          patch: {
            ...(op.title !== undefined ? { title: String(op.title) } : {}),
            ...(op.description !== undefined ? { description: String(op.description) } : {}),
          },
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `updated "${nameOf(op.itemId)}" (seq ${ack.seq})` };
        break;
      }
      case "item.move": {
        await canvas.move(op.itemId as string, op.x as number, op.y as number);
        result = { target: op.itemId as string, ack: `moved "${nameOf(op.itemId)}" to ${op.x}, ${op.y}` };
        break;
      }
      case "item.resize": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.resize",
          itemId: op.itemId as string,
          width: Math.round(Number(op.width ?? 320)),
          height: Math.round(Number(op.height ?? 240)),
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `resized "${nameOf(op.itemId)}" (seq ${ack.seq})` };
        break;
      }
      case "item.delete": {
        await canvas.remove(op.itemId as string);
        result = { target: op.itemId as string, ack: `deleted "${nameOf(op.itemId)}"` };
        break;
      }
      case "item.setCurrentVersion": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.setCurrentVersion",
          itemId: op.itemId as string,
          versionId: op.versionId as string,
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `switched "${nameOf(op.itemId)}" to another version (seq ${ack.seq})` };
        break;
      }
      case "item.restore": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.restore",
          itemId: op.itemId as string,
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `restored "${nameOf(op.itemId)}" (seq ${ack.seq})` };
        break;
      }
      case "item.react": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.react",
          itemId: op.itemId as string,
          emoji: String(op.emoji),
          on: Boolean(op.on),
          ...(op.at ? { at: op.at as { x: number; y: number } } : {}),
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `reacted ${op.emoji} on "${nameOf(op.itemId)}" (seq ${ack.seq})` };
        break;
      }
      case "thread.reply": {
        let sentReply: { threadId: string; commentId: string };
        if (op.notify === true) sentReply = await canvas.notify(op.body as string);
        else if (ctx.mainThreadId) sentReply = await canvas.reply(ctx.mainThreadId, op.body as string);
        else sentReply = await canvas.notify(op.body as string);
        result = {
          target: sentReply.threadId,
          ack: op.notify === true ? "posted in the Chat" : `replied in thread ${sentReply.threadId}`,
        };
        break;
      }
      case "thread.create": {
        if (op.itemId !== undefined && op.itemId !== null) {
          const res = await canvas.comment(op.itemId as string, String(op.body ?? ""));
          result = { target: res.threadId, ack: `started a thread on "${nameOf(op.itemId)}"` };
          break;
        }
        const threadId = newThreadId();
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "thread.create",
          threadId,
          x: Number(op.x ?? 0),
          y: Number(op.y ?? 0),
          anchorItemId: null,
          comment: { id: newCommentId(), body: String(op.body ?? "") },
        });
        result = { seq: ack.seq, target: threadId, ack: `started a thread (seq ${ack.seq})` };
        break;
      }
      case "item.addVersion": {
        const mime = String(op.mime ?? "text/markdown");
        const filename = String(op.filename ?? "version.md");
        const upload = await canvas.ctx.client.uploadBlob(
          canvas.id,
          Buffer.from(String(op.body ?? ""), "utf8"),
          mime,
          filename,
        );
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "item.addVersion",
          itemId: op.itemId as string,
          version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: mime, filename, size: upload.size },
        });
        result = { seq: ack.seq, target: op.itemId as string, ack: `added a version to "${nameOf(op.itemId)}" (seq ${ack.seq})` };
        break;
      }
      case "thread.setAnchor": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "thread.setAnchor",
          threadId: String(op.threadId),
          anchorItemId: (op.itemId as string) ?? null,
          x: Number(op.x ?? 0),
          y: Number(op.y ?? 0),
        });
        result = { seq: ack.seq, target: String(op.threadId), ack: `anchored thread ${op.threadId} (seq ${ack.seq})` };
        break;
      }
      case "thread.setMain": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "thread.setMain",
          threadId: String(op.threadId),
        });
        result = { seq: ack.seq, target: String(op.threadId), ack: `made ${op.threadId} the main thread (seq ${ack.seq})` };
        break;
      }
      case "thread.delete": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "thread.delete",
          threadId: String(op.threadId),
        });
        result = { seq: ack.seq, target: String(op.threadId), ack: `deleted thread ${op.threadId} (seq ${ack.seq})` };
        break;
      }
      case "comment.update": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "comment.update",
          threadId: String(op.threadId),
          commentId: String(op.commentId),
          body: String(op.body ?? ""),
        });
        result = { seq: ack.seq, target: String(op.commentId), ack: `edited comment ${op.commentId} (seq ${ack.seq})` };
        break;
      }
      case "actor.setColor": {
        const actorId = canvas.ctx.actor.id;
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "actor.setColor",
          actorId,
          color: String(op.color),
        });
        result = { seq: ack.seq, target: actorId, ack: `colour set to ${op.color} (seq ${ack.seq})` };
        break;
      }
      case "actor.setMark": {
        const actorId = canvas.ctx.actor.id;
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "actor.setMark",
          actorId,
          mark: String(op.mark),
        });
        result = { seq: ack.seq, target: actorId, ack: `mark set to ${op.mark} (seq ${ack.seq})` };
        break;
      }
      case "actor.join": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "actor.join",
          from: String(op.from),
          into: canvas.ctx.actor.id,
        });
        result = { seq: ack.seq, target: String(op.from), ack: `joined ${op.from} into this actor (seq ${ack.seq})` };
        break;
      }
      case "agent.enroll": {
        const agent = { id: String(op.actorId), name: String(op.agentName ?? op.actorId) };
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, { type: "agent.enroll", agent });
        result = { seq: ack.seq, target: agent.id, ack: `enrolled ${agent.name} (seq ${ack.seq})` };
        break;
      }
      case "agent.withdraw": {
        const ack = await canvas.ctx.client.sendOp(canvas.id, canvas.ctx.actor, {
          type: "agent.withdraw",
          actorId: String(op.actorId),
        });
        result = { seq: ack.seq, target: String(op.actorId), ack: `withdrew ${op.actorId} (seq ${ack.seq})` };
        break;
      }
      default:
        throw new Error(`the voice harness has no way to send ${op.type}`);
    }
    onIo?.("ack", plan.said);
    return result;
  } catch (err) {
    onIo?.("err", plan.said, (err as Error).message);
    throw err;
  }
}

export async function startVoiceServer(options: VoiceServerOptions): Promise<{
  state: VoiceServerState;
  close: () => Promise<void>;
}> {
  const home = options.home;
  /**
   * **Which canvas this session is working on — and the one thing that moves
   * while it runs.** `project_switch` re-resolves this handle against another
   * canvas: every tool call, the page's facts, the presence heartbeat, the
   * "open canvas" pass and the state file read it at the moment they act, so
   * what moves is the session, not a copy of it.
   */
  let target = await handleFor(options);
  /**
   * **The harness writes down who it is.** The record is what makes a restart
   * resume this actor under the key it is bound with, so it cannot be the CLI
   * verb's private business: a harness started by a test, by a script or by
   * `rc`'s detached spawn is the same harness, and a rename it made has to
   * survive the next start of any of them. The key comes off the daemon's own
   * row rather than being rebuilt from the name — the name is the thing a
   * rename changes.
   */
  {
    const key = await theKeyWeHold(target.canvas, target.actorId).catch(() => null);
    if (key) {
      await writeVoiceIdentity(home, { actorId: target.actorId, sessionKey: key, name: target.name }).catch(() => {});
    }
  }
  const lines: string[] = [];
  let sessionState: "idle" | "live" | "muted" | "ended" = "idle";
  let activeLiveSession: LiveSession | null = null;
  let activeAudioPage: NodeSocket | null = null;
  /** The model the running session was opened with, or null when idle. */
  let liveModelInUse: string | null = null;
  const initialLog = await readVoiceLog(home).catch(() => []);
  /**
   * **The file is the record; `toolLog` is the window.**
   *
   * This used to write `toolLog` back to the file, so the 200-entry display
   * cap silently truncated the persisted log on every entry — older calls
   * disappeared as new ones arrived. `record` carries the whole file plus
   * everything this process adds; the ring buffer is only what `/state` and
   * the live view show.
   */
  const record: ToolLogEntry[] = [...initialLog];
  /** What the model just did, with its ids — the referent for "that one". */
  const recentActions: Array<{ tool: string; op: string; id?: string; ack: string }> = [];
  const toolLog: ToolLogEntry[] = [...initialLog].slice(-200);
  const logListeners = new Set<(entry: ToolLogEntry) => void>();

  let presenceSessionId: string | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let audioStatsTimer: NodeJS.Timeout | null = null;
  let pageAudioInBytes = 0;
  let pageAudioInFrames = 0;
  let providerAudioOutFrames = 0;
  let providerAudioInFrames = 0;
  let pageAudioOutBytes = 0;
  let daemonOpsSent = 0;
  let daemonOpsAck = 0;
  let daemonOpsErr = 0;

  const harnessLogPath = path.join(voiceDir(home), "harness.log");
  void fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 }).catch(() => {});

  const logLine = (category: string, message: string, details?: unknown) => {
    const ts = new Date().toISOString();
    const det = details !== undefined ? " " + (typeof details === "string" ? details : JSON.stringify(details)) : "";
    const line = `[${ts}] [${category}] ${message}${det}`;
    lines.push(line);
    if (lines.length > 100) lines.shift();
    console.log(line);
    options.onLine?.(line);
    void fs.appendFile(harnessLogPath, line + "\n", { mode: 0o600 }).catch(() => {});
  };

  async function announcePresence(currentStatus: string) {
    try {
      if (!presenceSessionId) {
        const sessionRes = await target.canvas.ctx.client.createSession(
          target.canvasId,
          { id: target.actorId, name: target.name },
          target.name,
          VOICE_HARNESS,
          "cli",
        );
        presenceSessionId = sessionRes.sessionId;
        logLine("presence", `created session on daemon`, { sessionId: presenceSessionId });
      }
      await target.canvas.ctx.client.updateSession(target.canvasId, presenceSessionId, {
        status: currentStatus,
      });
      logLine("presence", `status updated: "${currentStatus}"`);
    } catch (e) {
      logLine("presence", `announcement error: ${(e as Error).message}`);
    }
  }

  function recordToolLog(entry: Omit<ToolLogEntry, "id" | "timestamp">): ToolLogEntry {
    const item: ToolLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      source: entry.source ?? (entry.type === "utterance" ? "typed" : "live"),
      ...entry,
    };
    record.push(item);
    toolLog.push(item);
    while (toolLog.length > 200) toolLog.shift();
    void writeVoiceLog(home, record).catch(() => {});
    for (const listener of logListeners) {
      try { listener(item); } catch {}
    }
    return item;
  }

  // A boundary in the stream: without it, a restart looks like the log simply
  // losing entries, which is exactly what it used to do.
  recordToolLog({
    type: "session_event",
    source: "system",
    event: "harness restarted",
    details: { kind: "harness_restarted", port: options.port },
  });

  const narrate = (line: string) => {
    lines.push(line);
    if (lines.length > 50) lines.shift();
    options.onLine?.(line);
  };

  /**
   * **The gate the model cannot open.**
   *
   * An operation a person has to agree to is held here until the PERSON
   * answers: the page is told what is about to happen and posts `/confirm`
   * with a yes or a no. No answer within the window is a no — an unattended
   * microphone is not consent — and a second question replaces the first,
   * because a person can only answer one thing at a time.
   *
   * A model-supplied `force` or `confirmed` argument is not consulted: it never
   * reaches this function, which is the point.
   */
  let pending: { id: string; what: string; resolve: (allow: boolean) => void } | null = null;
  let announce: ((message: unknown) => void) | null = null;

  /**
   * The question waiting for an answer, in the shape the page reads.
   *
   * A function rather than an inline `pending ? … : null` because of a real
   * narrowing trap: `pending` is only ever assigned inside `askThePerson`, so
   * at the points in the outer flow that build `/state`, TypeScript narrows it
   * to `null` and the true branch becomes `never` — which does not typecheck.
   * A function body gets fresh narrowing, so this reads the live value and the
   * types stay honest. (The dead lane's rescued WIP left this failing.)
   */
  function pendingQuestion(): { id: string; what: string } | null {
    return pending ? { id: pending.id, what: pending.what } : null;
  }

  /**
   * Files are read through the page, so this is the same shape as the gate
   * above: ask over the socket the page already has, wait for the answer, and
   * refuse in words when it never comes. `announce` is the page's channel and
   * is null exactly when no page is connected — which is one of the refusals.
   */
  const files = createFileBroker(
    { connected: () => Boolean(announce), send: (message) => announce?.(message) },
    options.fsTimeoutMs ? { timeoutMs: options.fsTimeoutMs } : {},
  );

  /**
   * Memory is the same conversation, about the page's OWN state: the page
   * keeps it in OPFS (per-origin, persistent, no prompt), and this process
   * only ever asks. Paul's ruling, 2026-09-13.
   */
  const memories = createMemoryBroker(
    { connected: () => Boolean(announce), send: (message) => announce?.(message) },
    options.memoryTimeoutMs ? { timeoutMs: options.memoryTimeoutMs } : {},
  );

  function askThePerson(what: string): Promise<boolean> {
    const timeout = options.confirmTimeoutMs ?? CONFIRM_TIMEOUT_MS;
    pending?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const id = `cfm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const timer = setTimeout(() => {
        if (pending?.id !== id) return;
        pending = null;
        recordToolLog({ type: "session_event", event: `the confirmation expired: ${what}`, reason: "no answer" });
        narrate(`confirmation expired without an answer: ${what}`);
        announce?.({ confirm: null });
        resolve(false);
      }, timeout);
      pending = {
        id,
        what,
        resolve: (allow: boolean) => {
          clearTimeout(timer);
          if (pending?.id === id) pending = null;
          resolve(allow);
        },
      };
      // Recorded as well as asked: the log is the only place that can answer
      // "did it ask before it deleted that?" a week later.
      recordToolLog({
        type: "session_event",
        event: `waiting for the person: ${what}`,
        details: { kind: "confirm_requested", id, what },
      });
      narrate(`confirmation requested: ${what}`);
      announce?.({ confirm: { id, what } });
    });
  }

  /**
   * **One rename, two callers — and both go through here.**
   *
   * The model's tool call and the person's own press in the settings drawer are
   * the same act, so they are the same function: the name is claimed IN PLACE
   * under the session key this harness already holds (the actor keeps its id,
   * so its comments, its ops and its undo history stay its own), and then every
   * copy of the name moves — canvas state's enrolment record, this machine's rc
   * roster rows, and this harness's own record of who it is. A second
   * implementation would be a second set of copies to keep in step, which is
   * the bug this function exists to prevent.
   *
   * The callers differ in exactly one thing, and it is what happened BEFORE
   * this runs: a rename the MODEL proposed goes through the person's gate
   * first, and a POST from the drawer is the person's own press — the person
   * is already the authority there, and asking them to confirm their own
   * click would be a second question with one answer.
   */
  async function renameThisAgent(name: string): Promise<
    | { ok: true; actor: { id: string; name: string }; answer: string; seq: number; standing: boolean; rows: number }
    | { ok: false; error: string }
  > {
    const wanted = name.trim();
    if (!wanted) return { ok: false, error: "a claim needs a name" };
    if (wanted.length > 60) {
      return { ok: false, error: `“${wanted.slice(0, 30)}…” is too long for a name — a name is what people call you` };
    }
    if (wanted.toLowerCase() === target.name.toLowerCase()) {
      return {
        ok: true,
        actor: { id: target.actorId, name: target.name },
        answer: `this agent is already called “${target.name}” — nothing to change`,
        seq: 0,
        standing: false,
        rows: 0,
      };
    }
    const key = await theKeyWeHold(target.canvas, target.actorId);
    if (!key) {
      return { ok: false, error: "this harness has no session key on this daemon, so there is nothing to rename" };
    }
    try {
      const claimed = await target.canvas.ctx.client.claimActor({
        type: "actor.claim",
        sessionKey: key,
        name: wanted,
        canvasId: target.canvasId,
      });
      const actor = claimed.envelope.actor;
      const was = target.name;
      target.name = actor.name;
      target.canvas.ctx.actor.name = actor.name;
      /* The face follows the name. A presence session is created with a label,
         so the old one keeps wearing the old name until it ends — and a face
         with the wrong name on it is the exact confusion the registry exists to
         stop. */
      if (presenceSessionId) {
        await target.canvas.ctx.client.endSession(target.canvasId, presenceSessionId).catch(() => {});
        presenceSessionId = null;
      }
      await announcePresence("enrolled — nobody is listening right now");
      /* **The name is recorded in three more places than the registry, and
         every one of them is a name a person can hear.** The claim above moved
         the authority; these move the copies — the canvas's enrolment record
         (what `rc turn <name>`, the agent tray and `isocan who` read), the rc's
         roster rows for this machine, and this harness's own record of who it
         is. A rename that left any of them behind would be a rename the person
         hears contradicted.

         The standing first. `agent.enroll` is the op the reducer describes as
         exactly this — "re-enrolling updates the record in place: the standing
         was already there, the rules (or the name) changed" — so the same actor
         is enrolled again with its rules handed back VERBATIM: the name moves,
         nothing else does. */
      let standing = false;
      try {
        const snap = await target.canvas.ctx.client.snapshot(target.canvasId);
        const record = (snap.canvas.agents ?? {})[actor.id] as { rules?: unknown } | undefined;
        if (record) {
          await target.canvas.ctx.client.sendOp(target.canvasId, target.canvas.ctx.actor, {
            type: "agent.enroll",
            agent: { id: actor.id, name: actor.name },
            ...(record.rules !== undefined ? { rules: record.rules } : {}),
          });
          standing = true;
        }
      } catch {
        // The registry rename has already happened and is the truth; a copy
        // that could not be refreshed is reported rather than pretended.
        standing = false;
      }
      const rows = await renameEnrolments(home, actor.id, actor.name).catch(() => 0);
      await writeVoiceIdentity(home, { actorId: actor.id, sessionKey: key, name: actor.name }).catch(() => {});
      await rememberWhatIAm();
      // The page's own headings name the agent; told, so a listening tab does
      // not keep saying the old name back to the person.
      announce?.({ agent: { name: actor.name } });

      const alsoMoved: string[] = [];
      if (standing) alsoMoved.push(`the enrolment on “${target.canvasLabel}” summons it by that name now`);
      if (rows > 0) alsoMoved.push(`${rows} machine enrolment row${rows === 1 ? "" : "s"} moved with it`);
      const answer =
        `this agent now answers to “${actor.name}” (it was “${was}”)` +
        (alsoMoved.length > 0
          ? ` — ${alsoMoved.join(", ")}`
          : ` — nothing on this machine had it enrolled, so nothing else had to move`);
      narrate(`renamed: “${was}” → “${actor.name}”`);
      return { ok: true, actor: { id: actor.id, name: actor.name }, answer, seq: claimed.seq, standing, rows };
    } catch (err) {
      // The daemon's own words: a name somebody already answers to is a
      // refusal with a reason, and the reason names the way back.
      return { ok: false, error: `not renamed — ${(err as Error).message}` };
    }
  }

  /**
   * **One switch, two callers** — the model's tool call and the settings
   * drawer's canvas picker. The work is the same and must not drift: resolve
   * the reference the way every other surface does (`matchRef`: id exact, then
   * a unique title prefix), end this agent's presence in the room it is
   * leaving, re-resolve the session's handle so every later operation lands on
   * the new canvas, drop the model's referents (an id from the old canvas does
   * not resolve here), tell the page, and write down where it is.
   *
   * Nothing is minted: switching is not an edit to either canvas.
   */
  async function switchThisSession(ref: string): Promise<
    | { ok: true; canvas: { id: string; title: string }; previous: { id: string; title: string }; items: { id: string; title?: string }[]; answer: string; unchanged?: boolean }
    | { ok: false; error: string; notFound?: boolean; code?: string }
  > {
    const wanted = ref.trim();
    if (!wanted) return { ok: false, error: "a switch needs the canvas to move to" };
    let next: { id: string; title: string };
    try {
      next = matchRef(await target.canvas.ctx.client.listCanvases(), wanted);
    } catch (err) {
      // `notFound` names the NO-MATCH case only: an ambiguous local prefix
      // is a different refusal and must not fall through to the public
      // catalogue, where a unique public title could silently win. The
      // daemon's refusal code rides along so the drawer can say the same
      // stale-build sentence the join path says.
      const message = (err as Error).message;
      return {
        ok: false,
        error: message,
        notFound: message.startsWith("no canvas matches"),
        ...((err as { code?: string }).code !== undefined ? { code: (err as { code?: string }).code } : {}),
      };
    }
    if (next.id === target.canvasId) {
      return {
        ok: true,
        canvas: { id: target.canvasId, title: target.canvasLabel },
        previous: { id: target.canvasId, title: target.canvasLabel },
        items: [],
        answer: `this session is already on “${target.canvasLabel}” — nothing to move`,
        unchanged: true,
      };
    }
    const was = { id: target.canvasId, title: target.canvasLabel };
    try {
      /* The room changes with the work: the presence session on the old canvas
         is ended, not left to look like somebody still standing in a room this
         agent has left. */
      if (presenceSessionId) {
        await target.canvas.ctx.client.endSession(was.id, presenceSessionId).catch(() => {});
        presenceSessionId = null;
      }
      target = await handleFor({ ...options, canvas: next.id });
      recentActions.splice(0, recentActions.length);
      const here = await target.canvas.items().catch(() => []);
      const answer =
        `moved to the canvas “${target.canvasLabel}” [${target.canvasId}] — ` +
        `${here.length} item${here.length === 1 ? "" : "s"}: ${here.map((i) => `${i.title} [${i.id}]`).join("; ") || "none"}. ` +
        `Every operation from here lands on it.`;
      await announcePresence(sessionState === "live" ? "listening" : "enrolled — nobody is listening right now");
      await rememberWhatIAm();
      // The page's header and facts panel name the canvas: told, so a tab that
      // is listening does not sit there naming the room the session just left.
      announce?.({ canvas: { title: target.canvasLabel, id: target.canvasId } });
      narrate(`switched canvas: “${was.title}” → “${target.canvasLabel}”`);
      return {
        ok: true,
        canvas: { id: target.canvasId, title: target.canvasLabel },
        previous: was,
        items: here.map((i) => ({ id: i.id, title: i.title })),
        answer,
      };
    } catch (err) {
      return { ok: false, error: `could not move to “${next.title}” — ${(err as Error).message}` };
    }
  }

  /**
   * **A pasted address or pass, turned into a canvas this session can be
   * on.**
   *
   * The same act `isocan setup <address>` performs, for a person at the
   * drawer instead of a terminal: a pass is redeemed (the daemon forwards to
   * the home that minted it, and this badge comes away admitted), or a
   * pass-less address arrives through the home's door — and then the switch
   * WAITS for the canvas to actually land here, because "moved" printed
   * before the replica has arrived would be the page lying.
   *
   * A bare `pss_…` token is the one shape with no canvas in it: the
   * redemption's answer IS the canvas name, which is why the caller leaves
   * `canvasId` out and reads it back from the result.
   *
   * `joinFromHome` is swallowed for the reason the CLI swallows it: on a
   * daemon that is the home itself it answers not-a-replica, and the wait
   * below is the verdict either way — the canvas is there, or it is not.
   */
  async function joinCanvasArrival(request: {
    canvasId?: string;
    origin?: string;
    pass?: string;
  }): Promise<{ ok: true; canvasId: string } | { ok: false; error: string }> {
    try {
      let canvasId = request.canvasId;
      let noHomeToAsk: string | null = null;
      if (request.pass) {
        const answer = await target.canvas.ctx.client.redeemPass(request.pass, request.origin);
        canvasId = answer.canvasId;
      } else if (!canvasId) {
        return { ok: false, error: "nothing to join: name a canvas" };
      } else {
        const refused = await target.canvas.ctx.client.joinFromHome(canvasId, request.origin).catch((err: unknown) => {
          // 409 not-a-replica: this daemon has nobody to ask — the canvas is
          // either already here (admitted or link-discoverable) or it never
          // will be. Keep the sentence; the wait decides which.
          if (err instanceof ApiError && err.code === "not-a-replica") {
            noHomeToAsk = err.message;
            return null;
          }
          return err;
        });
        if (refused) throw refused;
      }
      const deadline = Date.now() + 15_000;
      for (;;) {
        const local = await target.canvas.ctx.client.listCanvases().catch(() => []);
        if (local.some((canvas) => canvas.id === canvasId)) return { ok: true, canvasId: canvasId! };
        if (noHomeToAsk) return { ok: false, error: noHomeToAsk };
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return {
        ok: false,
        error: request.pass
          ? `the pass was redeemed and this machine is admitted, but “${canvasId}” has not arrived here yet — try again in a moment`
          : `this machine was let in at the door, but “${canvasId}” has not arrived here yet — try again in a moment`,
      };
    } catch (err) {
      // The daemon refuses an old client outright (426 canvas-groups-required):
      // the harness process was started before the pull and is frozen there.
      // Say the fix, not the daemon's "update isocan" sentence.
      if (err instanceof ApiError && err.code === CANVAS_GROUPS_REQUIRED) {
        return { ok: false, error: STALE_HARNESS };
      }
      return { ok: false, error: `not joined — ${(err as Error).message}` };
    }
  }

  /**
   * **One enrolment, two callers** — the model's `agent_enroll` tool and the
   * drawer's "Enrol from here".
   *
   * The same four things `isocan rc add <name> --harness voice` does, in the
   * same order and for the same reasons (that function's comments carry the
   * argument): the standing as an `agent.enroll` op on the canvas, the cursor
   * row seeded at THAT op so a comment arriving before the first summons still
   * reaches it, and this machine's rc half — harness, working directory, and no
   * ACP session yet.
   *
   * The one difference from the CLI verb is that nothing is MINTED here: the
   * actor is already this harness's own, renamed or not, so the enrolment
   * records the actor that speaks rather than claiming a name that might have
   * moved. `rules` are left alone — absent means the default (the owner's word
   * alone wakes it), which is the same thing `rc add` without `--listen` means,
   * and re-enrolling must never quietly widen a gate.
   */
  async function enrolThisAgent(): Promise<
    | { ok: true; enrolled: true; adapter: { harness: string; declared: boolean }; answer: string }
    | { ok: false; error: string }
  > {
    try {
      const enrolled = await target.canvas.ctx.client.sendOp(target.canvasId, target.canvas.ctx.actor, {
        type: "agent.enroll",
        agent: { id: target.actorId, name: target.name },
      });
      // The cursor row is born WITH the standing: a comment landing five
      // minutes from now must reach the first summons, so the floor is the
      // enrolment op itself.
      await target.canvas.ctx.client
        .parkClaim({ canvasId: target.canvasId, actorId: target.actorId, seedAt: enrolled.seq })
        .catch(() => {});
      const existing = (await readRcAgents(home).catch(() => [])).find(
        (row) => row.canvasId === target.canvasId && row.actorId === target.actorId,
      );
      await upsertRcAgent(home, {
        canvasId: target.canvasId,
        actorId: target.actorId,
        name: target.name,
        harness: VOICE_HARNESS,
        cwd: existing?.cwd ?? process.cwd(),
        sessionId: existing?.sessionId ?? null,
      });
      /**
       * **The adapter is not a thing that can be missing any more.**
       *
       * It used to be: `voice` was only runnable if a person had written
       * `{"acpAdapters": {"voice": ["node", "<bin>", "--acp"]}}` into their
       * config by hand, so an enrolment could succeed on a canvas and still
       * leave nothing able to start the agent, and this flag is what said so.
       * This harness now writes that declaration itself when it starts
       * (`registerVoiceHarness`) — and this endpoint only runs inside a
       * standing harness — so by the time an enrolment can arrive, the thing
       * that starts the agent exists. The field is kept because it is part of
       * this response's shape, not because there is a case left that can make
       * it false.
       */
      const declared = true;
      const answer = `enrolled “${target.name}” on “${target.canvasLabel}” — it answers on this canvas now`;
      narrate(`enrolled: “${target.name}” on “${target.canvasLabel}”`);
      return { ok: true, enrolled: true, adapter: { harness: VOICE_HARNESS, declared }, answer };
    } catch (err) {
      return { ok: false, error: `not enrolled — ${(err as Error).message}` };
    }
  }

  /**
   * **What a session started right now would use, and where that came from.**
   *
   * `--model` wins for the run it was typed in; otherwise the choice the page
   * stored; otherwise the shipped default. The SOURCE is reported with the
   * name because a picker that shows one model while the session uses another
   * is the failure this control exists to end — and a silent override is how
   * that happens.
   */
  const resolveModel = async (): Promise<{ model: string; source: "flag" | "stored" | "default" }> => {
    if (options.model) return { model: options.model, source: "flag" };
    const stored = await readVoiceModel(home).catch(() => null);
    if (stored?.model) return { model: stored.model, source: "stored" };
    return { model: LIVE_MODEL, source: "default" };
  };

  /** Everything the page — and a check — needs to say what this harness is
   * connected to: the canvas by title AND id, the daemon, the home it answers
   * to, the actor and whether it is enrolled, and the provider and model the
   * audio goes to. Paul: "I also have no clue what project or isocan service
   * the isocan voice agent is connected to." */
  const factsFor = async () => {
    const stored = await readVoiceKey(home).catch(() => null);
    const chosen = await resolveModel();
    const config = await readConfigFile<{ home?: string }>(home).catch(() => ({}) as { home?: string });
    const enrolled = (await readRcAgents(home).catch(() => [])).some(
      // Matched by ACTOR, not by name: an enrolment row is this agent's
      // standing on this canvas, and a rename must not make the page say
      // nothing can summon it while the row stands. The row's own name is the
      // roster's to change.
      (row) => row.canvasId === target.canvasId && row.actorId === target.actorId && row.harness === VOICE_HARNESS,
    );
    return {
      name: target.name,
      port: options.port ?? DEFAULT_VOICE_PORT,
      version: voiceVersion(),
      updated: voiceUpdated(),
      canvas: { title: target.canvasLabel, id: target.canvasId },
      daemon: target.daemon,
      home: config.home ?? "no home configured — the daemon's default",
      agent: { name: target.name, id: target.actorId, enrolled },
      provider: {
        name: stored?.provider ?? null,
        model: chosen.model,
        // Where that name came from, so a person is never left guessing why
        // the page's choice is not the one in use.
        modelSource: chosen.source,
        // The model the RUNNING session was opened with; null when idle. The
        // facts can then say “in use: X” without either side inferring it.
        modelLive: liveModelInUse,
        key: stored !== null,
      },
      session: { state: sessionState },
      // Memory is the page's now (OPFS, per-origin): the harness cannot count
      // it, and says so by not pretending to. The legacy file it used to keep
      // is offered once at GET /memory/legacy so nothing is orphaned.
      memory: { store: "page-opfs", legacy: voiceMemoryFile(home) },
      // The grant, visible: which folder the agent may read through the page,
      // and since when. The page shows this; nothing here reads it.
      files: { granted: files.state().folder !== null, folder: files.state().folder, at: files.state().at ?? null },
      // A page that is not on the socket still sees the question: the state
      // poll is how the typed path's confirmation reaches it at all.
      confirm: pendingQuestion(),
    };
  };

  /**
   * **One name-move, two doors.**
   *
   * `POST /actor` (the person, in the settings drawer) and the model's
   * `actor_claim` tool are the same act: the daemon claims the name, and every
   * copy of it on this machine moves with the authority. This body used to live
   * inside the tool handler, which is exactly why the page had no way to claim
   * a name — the capability existed for the model and not for the person.
   *
   * `ask` is the whole difference between the two doors. The model must ask the
   * person first, because a rename it decided on its own is not the person's to
   * hear about afterwards. A request that arrives from the page's drawer IS the
   * person acting: the button press is the confirmation, and answering
   * Allow/Deny for the name they just typed would be a second confirmation of
   * the same act. The gate is not weakened — it is not consulted because it has
   * already been satisfied by the hand that asked.
   */
  async function claimName(
    wantedRaw: unknown,
    opts: { ask: boolean },
  ): Promise<{
    ok: boolean;
    actorId?: string;
    name?: string;
    answer: string;
    error?: string;
    /** The agent already answered to this name; nothing moved. */
    unchanged?: boolean;
    moved?: number;
    standing?: boolean;
    seq?: number;
  }> {
    const wanted = String(wantedRaw ?? "").trim();
    if (!wanted) return { ok: false, answer: "", error: "a name is required" };
    if (wanted.length > 60) {
      return {
        ok: false,
        answer: "",
        error: `“${wanted.slice(0, 30)}…” is too long for a name — a name is what people call you`,
      };
    }
    if (wanted.toLowerCase() === target.name.toLowerCase()) {
      return {
        ok: true,
        actorId: target.actorId,
        name: target.name,
        unchanged: true,
        answer: `this agent is already called “${target.name}” — nothing to change`,
      };
    }
    const what = `rename this agent to “${wanted}” (it is “${target.name}” now)`;
    if (opts.ask && !(await askThePerson(what))) {
      return { ok: false, answer: "", error: `not done — the person did not confirm: ${what}` };
    }
    const key = await theKeyWeHold(target.canvas, target.actorId);
    if (!key) {
      return {
        ok: false,
        answer: "",
        error: "this harness has no session key on this daemon, so there is nothing to rename",
      };
    }
    let claimed: Awaited<ReturnType<typeof target.canvas.ctx.client.claimActor>>;
    try {
      claimed = await target.canvas.ctx.client.claimActor({
        type: "actor.claim",
        sessionKey: key,
        name: wanted,
        canvasId: target.canvasId,
      });
    } catch (err) {
      // The daemon's own words: a name somebody already answers to is a refusal
      // with a reason, and the reason names the way back.
      return { ok: false, answer: "", error: `not renamed — ${(err as Error).message}` };
    }
    const actor = claimed.envelope.actor;
    const was = target.name;
    target.name = actor.name;
    /* The face follows the name. A presence session is created with a label, so
       the old one keeps wearing the old name until it ends — and a face with
       the wrong name on it is the exact confusion the registry exists to stop. */
    if (presenceSessionId) {
      await target.canvas.ctx.client.endSession(target.canvasId, presenceSessionId).catch(() => {});
      presenceSessionId = null;
    }
    await announcePresence("enrolled — nobody is listening right now");
    /* **The name is recorded in three more places than the registry, and every
       one of them is a name a person can hear.** The claim above moved the
       authority; these move the copies — the canvas's enrolment record (what
       `rc turn <name>`, the agent tray and `isocan who` read), the rc's roster
       row for this machine, and this harness's own record of who it is. A
       rename that left any of them behind would be a rename the person hears
       contradicted. */
    let standing = false;
    try {
      const snap = await target.canvas.ctx.client.snapshot(target.canvasId);
      const record = (snap.canvas.agents ?? {})[actor.id] as { rules?: unknown } | undefined;
      if (record) {
        await target.canvas.ctx.client.sendOp(target.canvasId, target.canvas.ctx.actor, {
          type: "agent.enroll",
          agent: { id: actor.id, name: actor.name },
          ...(record.rules !== undefined ? { rules: record.rules } : {}),
        });
        standing = true;
      }
    } catch {
      // The registry rename has already happened and is the truth; a copy that
      // could not be refreshed is reported rather than pretended.
      standing = false;
    }
    const moved = await renameEnrolments(home, actor.id, actor.name).catch(() => 0);
    await writeVoiceIdentity(home, { actorId: actor.id, sessionKey: key, name: actor.name }).catch(() => {});
    await rememberWhatIAm();
    // The page's own headings name the agent; told, so a listening tab does not
    // keep saying the old name back to the person.
    announce?.({ agent: { name: actor.name } });

    const alsoMoved: string[] = [];
    if (standing) alsoMoved.push(`the enrolment on “${target.canvasLabel}” summons it by that name now`);
    if (moved > 0) alsoMoved.push(`${moved} machine enrolment row${moved === 1 ? "" : "s"} moved with it`);
    const answer =
      `this agent now answers to “${actor.name}” (it was “${was}”)` +
      (alsoMoved.length > 0
        ? ` — ${alsoMoved.join(", ")}`
        : ` — nothing on this machine had it enrolled, so nothing else had to move`);
    return { ok: true, actorId: actor.id, name: actor.name, answer, moved, standing, seq: claimed.seq };
  }

  const server = http.createServer((req, res) => {
    const t0 = performance.now();
    let reqBytes = 0;
    req.on("data", (chunk: Buffer) => { reqBytes += chunk.length; });
    /**
     * **`/harness` is the page's spelling of this door, and it is the same door.**
     *
     * The page is served in two ways: in dev by Vite on 5199, which proxies
     * `/harness/*` here (same origin, so the audio socket survives HMR), and in
     * production by this process, out of `dist/`. The page cannot have two
     * sets of paths — one spelling in dev and another served — so the prefix is
     * stripped here, once, and everything below routes exactly as it always
     * did. A request for `/harness/state` IS a request for `/state`.
     */
    if (req.url === "/harness" || req.url?.startsWith("/harness/") || req.url?.startsWith("/harness?")) {
      req.url = req.url.slice("/harness".length) || "/";
    }
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${options.port || DEFAULT_VOICE_PORT}`);
    res.on("finish", () => {
      const dur = (performance.now() - t0).toFixed(1);
      logLine("http", `${req.method} ${url.pathname} status=${res.statusCode} in=${reqBytes}b duration=${dur}ms`);
    });
    const respond = (code: number, body: unknown, type = "application/json") => {
      const payload = type === "application/json" ? JSON.stringify(body) : body;
      res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(payload);
    };
    const readBody = async (): Promise<Record<string, unknown> | string> => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        // A key is a kilobyte and a WAV is a minute; 32MB is a ceiling on
        // something that should never be near it.
        if (size > 32 * 1024 * 1024) throw new Error("that body is too big for this door");
        chunks.push(chunk as Buffer);
      }
      const raw = Buffer.concat(chunks);
      if (raw.length === 0) return {};
      const text = raw.toString("utf8");
      if (text.trimStart().startsWith("{")) return JSON.parse(text) as Record<string, unknown>;
      if (text.trimStart().startsWith('"')) return JSON.parse(text) as string;
      return { raw };
    };
    /** A file out of the built page, when there is one there. False means
     * "not a page file", and the caller decides what that costs. */
    const servePage = async (out: http.ServerResponse, wanted: string): Promise<boolean> => {
      const dir = voiceDistDir();
      const file = path.resolve(dir, wanted);
      if (file !== dir && !file.startsWith(dir + path.sep)) return false;
      try {
        const body = await fs.readFile(file);
        out.writeHead(200, {
          "Content-Type": PAGE_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        out.end(body);
        return true;
      } catch {
        return false;
      }
    };
    const guard = (work: () => Promise<void>) => {
      void work().catch((err) => respond(500, { error: String((err as Error).message ?? err) }));
    };
    void (async () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${options.port || DEFAULT_VOICE_PORT}`);
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        if (!(await servePage(res, "voice.html"))) respond(503, pageNotBuilt(), "text/html; charset=utf-8");
        return;
      }
      /**
       * The page's own furniture: the built bundle, the fonts, the icon, and
       * `/voice` — the dev server's spelling of the page, kept so a bookmark
       * from dev works here. Anything else is not this harness's to answer.
       */
      if (req.method === "GET" && url.pathname !== "/favicon.ico") {
        const wanted = url.pathname === "/voice" ? "voice.html" : url.pathname.replace(/^\/+/, "");
        if (await servePage(res, wanted)) return;
      }
      if (req.method === "GET" && url.pathname === "/connection") {
        // Machine-readable, because "what is this agent connected to" is a
        // question a check should be able to ask without a screenshot.
        respond(200, await factsFor());
        return;
      }
      if (req.method === "GET" && url.pathname === "/favicon.ico") {
        // A browser asks by itself. Answering 405 made the console look broken
        // for a page that is working.
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
        return;
      }
      if (req.method === "GET" && url.pathname === "/state") {
        respond(200, { ...(await factsFor()), lines });
        return;
      }
      if (req.method === "GET" && url.pathname === "/open") {
        try {
          const config = await readConfigFile<{ home?: string }>(home).catch(() => ({}) as { home?: string });
          const origin = config.home ?? target.daemon;
          const { token } = await target.canvas.ctx.client.mintPass(target.canvasId);
          const redirectUrl = canvasUrlWithPass(origin, target.canvasId, token);
          if (req.headers.accept?.includes("application/json")) {
            respond(200, { url: redirectUrl, canvasId: target.canvasId });
            return;
          }
          res.writeHead(302, { Location: redirectUrl, "Cache-Control": "no-store" });
          res.end();
          return;
        } catch (err) {
          respond(500, { error: `could not mint pass: ${(err as Error).message}` });
          return;
        }
      }
      if (url.pathname === "/prompt") {
        /**
         * **What the model is told, and the one place the rules are written.**
         *
         * `sent` is built by the same function the session start calls, so the
         * panel cannot show a rule the session does not use. Two facts ride
         * along because leaving them out would make the panel a comfortable
         * lie: the tool declarations travel in the same setup message (outside
         * this text), and the model-test control opens a socket with the rules
         * alone. The generated blocks say what they are and why they are not
         * editable here.
         */
        const asPayload = async () => {
          const parts = await liveInstructionParts(home, target);
          return {
            rules: parts.rules,
            generated: [
              {
                what: "Project instructions",
                source: parts.project?.source ?? "none found",
                text: parts.project?.text ?? "",
                truncated: parts.project?.capped ?? false,
                why: "read from the project directory bound to this canvas — the project owns this file, not this page",
              },
              {
                what: "Canvas snapshot",
                source: `${parts.snapshot.items} items, ${parts.snapshot.threads} threads`,
                text: parts.snapshot.text,
                truncated: false,
                why: "rebuilt at every session start, because the ids in it are what a tool call has to echo",
              },
            ],
            tools: LIVE_TOOLS.map((one) => one.name),
            sent: parts.sent,
            cap: PROMPT_MAX,
            note:
              "The rules are yours to edit; everything below them is generated for each session and is shown rather than hidden. " +
              "The tool list is sent in the same setup message, outside this text, and the Test-model control sends the rules alone.",
          };
        };
        if (req.method === "GET") {
          respond(200, await asPayload());
          return;
        }
        if (req.method === "POST") {
          const body = await readBody();
          const object = typeof body === "string" ? {} : body;
          if (object.reset === true) {
            await writeVoicePrompt(home, null);
            recordToolLog({ type: "session_event", source: "system", event: "system prompt: back to the default rules" });
          } else {
            const text = String(object.text ?? "").trim();
            if (text === "") {
              respond(400, { error: "empty rules are not rules — reset to the default instead" });
              return;
            }
            if (text.length > PROMPT_MAX) {
              respond(400, { error: `that is ${text.length} characters; the cap is ${PROMPT_MAX}` });
              return;
            }
            await writeVoicePrompt(home, text);
            recordToolLog({ type: "session_event", source: "system", event: `system prompt: edited (${text.length} characters)` });
          }
          respond(200, await asPayload());
          return;
        }
        respond(405, { error: "GET or POST" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/memory/legacy") {
        // The one-time migration source: what the harness used to own, offered
        // to the page so nobody loses a memory because the shelf moved. Empty
        // once `POST /memory/migrated` has retired the file.
        const entries = await readLegacyMemories(home);
        respond(200, { entries, count: entries.length, file: voiceMemoryFile(home) });
        return;
      }
      if (req.method === "GET" && url.pathname === "/fs") {
        const state = files.state();
        respond(200, { ...state, granted: state.folder !== null });
        return;
      }
      if (req.method === "GET" && url.pathname === "/models") {
        const stored = await readVoiceKey(home).catch(() => null);
        if (!stored) {
          respond(200, { ok: false, models: [], answer: "no key stored, so there is no list to fetch" });
          return;
        }
        const list = await listModels(stored, options.fetchImpl);
        narrate(`model list: ${list.answer}`);
        respond(200, list);
        return;
      }
      if (req.method === "GET" && url.pathname === "/log") {
        // The persisted file is the record; the in-memory copy covers entries
        // not yet flushed. Merged by id, so a restart or a raced write cannot
        // duplicate or hide one.
        const diskLog = await readVoiceLog(home).catch(() => []);
        const map = new Map<string, ToolLogEntry>();
        for (const e of diskLog) if (e && e.id) map.set(e.id, e);
        for (const e of toolLog) if (e && e.id) map.set(e.id, e);
        const merged = Array.from(map.values());
        merged.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
        respond(200, { entries: merged, count: merged.length });
        return;
      }
      /**
       * **`GET /daemons` + `POST /daemon` — the one the harness cannot change
       * from here, said rather than 405'd.**
       *
       * The daemon is not a preference of the session: it is what this process
       * attached to at START, and the handles it is holding — the canvas
       * client, the provider socket, the presence sessions, the identity — all
       * belong to it. Telling somebody that mid-flight would mean re-resolving
       * every one of them to satisfy a control nobody needs, so the honest
       * answer is the truth of the shape: here is the daemon this harness is
       * on, and here is the command that starts it against another one.
       *
       * `found` is the shape the page reads (`{found: [...]}`), and the entry
       * carries why it is the only one, because "the list has one item" is not
       * a fact a reader can act on.
       */
      if (req.method === "GET" && url.pathname === "/daemons") {
        let reachable = false;
        let canvases = 0;
        try {
          canvases = (await target.canvas.ctx.client.listCanvases()).length;
          reachable = true;
        } catch {}
        respond(200, {
          found: [
            {
              url: target.daemon,
              current: true,
              reachable,
              canvases,
              reason:
                "the daemon this harness attached to when it started — this session's canvas handles, " +
                "provider socket and presence live there, so it cannot move while it runs",
            },
          ],
          current: target.daemon,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/daemon") {
        const body = await readBody();
        const asked = typeof body === "string" ? {} : body;
        const wanted = String(asked.url ?? "").trim();
        const remedy = "ISOCAN_PORT=<port> npm start -w @isocan/voice-agent";
        const error =
          `this harness cannot change daemon while it runs: it attached to ${target.daemon} at start, and this ` +
          `session's canvas handles, provider socket and presence are that daemon's. ` +
          `Stop it and start it against the one you want — ${remedy}` +
          (wanted ? ` (asked for ${wanted})` : "");
        recordToolLog({
          type: "tool_call",
          source: "typed",
          name: "daemon_change",
          args: { url: wanted, via: "settings" },
          result: { ok: false, error },
        });
        respond(400, { error, current: target.daemon, remedy });
        return;
      }
      /**
       * **`POST /enrol` — the drawer's "Enrol from here".**
       *
       * The page's step for an actor nothing can summon posts `{ name }`; the
       * name is the page's own reading of who this is, and the answer is the
       * harness's, so the request body is deliberately not trusted for
       * anything but the trigger. `enrolThisAgent` does the work — the same
       * function the model's `agent_enroll` tool runs.
       */
      if (req.method === "POST" && url.pathname === "/enrol") {
        const enrolled = await enrolThisAgent();
        if (!enrolled.ok) {
          recordToolLog({
            type: "tool_call",
            source: "typed",
            name: "agent_enroll",
            args: { via: "settings" },
            result: { ok: false, error: enrolled.error },
          });
          respond(400, { error: enrolled.error });
          return;
        }
        recordToolLog({
          type: "tool_call",
          source: "typed",
          name: "agent_enroll",
          args: { via: "settings" },
          op: { type: "agent.enroll", said: `enrolled ${target.name}`, target: target.actorId },
          result: { ok: true, answer: enrolled.answer, via: "settings", ...enrolled.adapter },
        });
        respond(200, {
          ok: true,
          enrolled: true,
          actor: { id: target.actorId, name: target.name },
          canvas: { id: target.canvasId, title: target.canvasLabel },
          adapter: enrolled.adapter,
          answer: enrolled.answer,
        });
        return;
      }
      /**
       * **`GET /canvases` and `POST /canvas` — the project picker.**
       *
       * The contract's shape, from the page's side (`isocan-xsh.8`): a list
       * with `{ id, title }` and a POST naming the one to move to. The rules are
       * the same two the list and the switch already follow everywhere else —
       * `inScope` for the shelf (a canvas put away is not somebody's next
       * project) and `matchRef` for the reference — so the picker cannot offer
       * a canvas the CLI would refuse or move to a different one than the id
       * says.
       *
       * The switch itself is `switchThisSession`: the same function the model's
       * tool call runs, so the presence room, the page, the state file and the
       * model's referents move together whichever surface asked.
       *
       * **`public` rides along** — the daemon's own public catalogue
       * (`/api/public`), so the picker can mark a published canvas and offer
       * one this machine has never visited. A POST naming one of them is the
       * pass-less arrival: the door's link grant decides.
       *
       * ponytail: the catalogue is this daemon's, not a federation across
       * homes — a replica advertises only what is listed locally. Fan out
       * over `client.homes()` when a replica should advertise its home's
       * catalogue too.
       */
      if (req.method === "GET" && url.pathname === "/canvases") {
        const [canvases, catalogue] = await Promise.all([
          target.canvas.ctx.client.listCanvases(),
          target.canvas.ctx.client.publicCanvases().catch(() => ({ canvases: [] })),
        ]);
        const shown = sortCanvases(canvases.filter((c) => inScope(c, "live") || c.id === target.canvasId), "recent");
        respond(200, {
          canvases: shown.map((c) => ({ id: c.id, title: c.title, current: c.id === target.canvasId })),
          // The whole catalogue, NOT deduped against the local list: on a home
          // daemon every listed canvas is also link-discoverable, so the page
          // marks the rows it already holds rather than printing them twice.
          public: catalogue.canvases,
          current: target.canvasId,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/canvas") {
        const body = await readBody();
        const asked = typeof body === "string" ? {} : body;
        // A reference, not an id: the page sends what the picker holds, and a
        // person may type a title into the same field — or paste a whole
        // canvas address with its `#pss_…` pass on the end, the bare pass
        // token, or even the entire "Bring your own agent…" paragraph with the
        // address buried in a command line. Any of them joins a canvas this
        // machine does not know yet (`isocan setup <address>`'s act, from the
        // drawer).
        const wanted = String(asked.ref ?? asked.id ?? asked.canvas ?? "").trim();
        const fail = (error: string, notFound = false): void => {
          recordToolLog({
            type: "tool_call",
            source: "typed",
            name: "project_switch",
            args: { canvas_ref: wanted, via: "settings" },
            result: { ok: false, error },
          });
          respond(notFound ? 404 : 400, { error });
        };
        // The paste may be the whole "Bring your own agent…" paragraph — the
        // address sits inside a command line with prose around it. Pull the
        // address (and its #pss_… pass) out of whatever surrounds it; a bare
        // pass token may likewise ride in prose. The regex only NOMINATES a
        // candidate; parseCanvasAddress does the real validation.
        const embedded = /(?:https?:\/\/)?(?:\[[0-9A-Fa-f:.]*\]|[A-Za-z0-9][A-Za-z0-9.-]*)(?::\d+)?\/p\/[A-Za-z0-9_-]+(?:#[^\s"']+)?/.exec(wanted)?.[0];
        const address = parseCanvasAddress(wanted) ?? (embedded ? parseCanvasAddress(embedded) : null);
        const barePass = /pss_[^.\s]+\.[\w-]+/.exec(wanted)?.[0] ?? null;
        let moved;
        if (address || barePass) {
          const pass = address?.pass ?? barePass ?? undefined;
          const arrival = await joinCanvasArrival(
            address
              ? { canvasId: address.canvasId, origin: address.origin, ...(pass ? { pass } : {}) }
              : { pass: pass! },
          );
          if (!arrival.ok) {
            fail(arrival.error);
            return;
          }
          moved = await switchThisSession(arrival.canvasId);
        } else {
          moved = await switchThisSession(wanted);
        }
        // Nothing local matched: a published canvas is still joinable — the
        // door's link grant admits, and the switch then finds it arrived.
        if (!moved.ok && moved.notFound) {
          const catalogue = await target.canvas.ctx.client.publicCanvases().catch(() => ({ canvases: [] }));
          // `matchRef` is typed over the daemon's Canvas rows; the catalogue's
          // are the same two fields, so the same two rules apply by hand.
          const rows = catalogue.canvases;
          const byId = rows.find((c) => c.id === wanted);
          const byTitle = byId ? [] : rows.filter((c) => c.title.toLowerCase().startsWith(wanted.toLowerCase()));
          const hit = byId ?? (byTitle.length === 1 ? byTitle[0] : null);
          if (hit) {
            const arrival = await joinCanvasArrival({ canvasId: hit.id, origin: hit.home });
            if (!arrival.ok) {
              fail(arrival.error);
              return;
            }
            moved = await switchThisSession(hit.id);
          }
        }
        if (!moved.ok) {
          fail(moved.code === CANVAS_GROUPS_REQUIRED ? STALE_HARNESS : moved.error, moved.notFound);
          return;
        }
        recordToolLog({
          type: "tool_call",
          source: "typed",
          name: "project_switch",
          args: { canvas_ref: wanted, via: "settings" },
          result: { ok: true, answer: moved.answer, canvasId: moved.canvas.id, from: moved.previous.id },
        });
        respond(200, {
          ok: true,
          canvas: moved.canvas,
          previous: moved.previous,
          answer: moved.answer,
          ...(moved.unchanged ? { unchanged: true } : {}),
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/canvas/create") {
        const body = await readBody();
        const asked = typeof body === "string" ? {} : body;
        const title = String(asked.title ?? "").trim();
        if (!title) {
          respond(400, { error: "a canvas title is required" });
          return;
        }
        const canvasId = newCanvasId();
        try {
          await target.canvas.ctx.client.sendOp(null, target.canvas.ctx.actor, {
            type: "project.create",
            canvasId,
            title,
          });
          const switched = await switchThisSession(canvasId);
          respond(200, {
            ok: true,
            canvas: { id: canvasId, title },
            switched: switched.ok,
          });
        } catch (err) {
          const stale = (err as { code?: string }).code === CANVAS_GROUPS_REQUIRED;
          respond(502, { error: stale ? STALE_HARNESS : (err as Error).message });
        }
        return;
      }
      /**
       * **`POST /actor` — the person naming this agent, from the settings
       * drawer.**
       *
       * The page's contract (bead `isocan-xsh.8`, and `docs/voice.md` from the
       * person's side) is one POST with `{ name }`, answered with the new actor
       * or a refusal shown VERBATIM — "that name is taken" is the daemon's
       * sentence and the page prints it as it stands. It runs the same
       * `renameThisAgent` the model's tool call runs, so the two cannot drift
       * about the actor id, the key, or any of the copies of the name.
       *
       * No question is asked here, and that is the one difference. The gate
       * exists because a MODEL's proposal must become the person's decision;
       * this request IS the person's decision — they are at the page, and the
       * drawer's button is what sent it. Asking them to confirm their own
       * click would be a second question with one answer, in the vocabulary
       * the page reserves for the model ("The agent wants to …").
       */
      if (req.method === "POST" && url.pathname === "/actor") {
        const body = await readBody();
        const asked = typeof body === "string" ? {} : body;
        const requested = String(asked.name ?? "");
        const renamed = await renameThisAgent(requested);
        if (!renamed.ok) {
          const code = /too long|a name is required|needs a name/.test(renamed.error)
            ? 400
            : /taken|already answers|already has/i.test(renamed.error)
              ? 409
              : 502;
          recordToolLog({
            type: "tool_call",
            source: "typed",
            name: "actor_claim",
            args: { name: requested, via: "settings" },
            result: { ok: false, error: renamed.error },
          });
          respond(code, { ok: false, error: renamed.error });
          return;
        }
        // No `say`: this request came from a page that is looking at the
        // answer already. The live socket — if a tab has one open — is told by
        // `renameThisAgent`, and every tab reads /state.
        recordToolLog({
          type: "tool_call",
          source: "typed",
          name: "actor_claim",
          args: { name: requested, via: "settings" },
          op: { type: "actor.claim", said: `renamed to “${renamed.actor.name}”`, target: renamed.actor.id },
          result: {
            ok: true,
            answer: renamed.answer,
            via: "settings",
            ...(renamed.seq ? { seq: renamed.seq } : {}),
            enrolments: renamed.rows,
            standing: renamed.standing,
          },
        });
        respond(200, {
          ok: true,
          actor: renamed.actor,
          canvas: { id: target.canvasId, title: target.canvasLabel },
          answer: renamed.answer,
          resumed: renamed.seq === 0,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/confirm") {
        const body = await readBody();
        const asked = typeof body === "string" ? {} : body;
        const id = String(asked.id ?? "");
        if (!pending || pending.id !== id) {
          respond(200, {
            ok: false,
            error: `nothing is waiting for ${id ? `"${id}"` : "an answer"} — it was already answered, or it expired`,
          });
          return;
        }
        const allow = asked.allow === true;
        const what = pending.what;
        pending.resolve(allow);
        recordToolLog({
          type: "session_event",
          event: allow ? `the person allowed: ${what}` : `the person declined: ${what}`,
          details: { kind: allow ? "confirm_allowed" : "confirm_declined", what },
        });
        narrate(allow ? `allowed by the person: ${what}` : `declined by the person: ${what}`);
        respond(200, { ok: true, allowed: allow });
        return;
      }
      if (req.method === "POST" && url.pathname === "/session/start") {
        // This is intent, not a socket or a provider session. Permission may
        // still be pending, refused, or lost with a page reload.
        recordToolLog({ type: "session_event", event: "session requested; waiting for audio connection" });
        respond(200, { ok: true, state: sessionState });
        return;
      }
      if (req.method === "POST" && url.pathname === "/session/mute") {
        if (sessionState === "live") {
          sessionState = "muted";
          void announcePresence("muted");
          recordToolLog({ type: "session_event", event: "session muted" });
        }
        respond(200, { ok: true, state: sessionState });
        return;
      }
      if (req.method === "POST" && url.pathname === "/session/unmute") {
        if (sessionState === "muted") {
          sessionState = "live";
          void announcePresence("listening");
          recordToolLog({ type: "session_event", event: "session unmuted" });
        }
        respond(200, { ok: true, state: sessionState });
        return;
      }
      if (req.method === "POST" && url.pathname === "/session/end") {
        sessionState = "ended";
        void announcePresence("enrolled — nobody is listening right now");
        recordToolLog({ type: "session_event", event: "session ended", reason: "user ended" });
        activeAudioPage?.close();
        if (activeLiveSession) {
          try { activeLiveSession.close(); } catch {}
          activeLiveSession = null;
          liveModelInUse = null;
        }
        respond(200, { ok: true, state: sessionState });
        return;
      }
      if (req.method !== "POST") {
        respond(405, {
          error:
            "the voice harness answers GET /, /state, /connection, /log, /canvases, /daemons, /models, /memory/legacy, /fs and POST /actor, /canvas, /daemon, /key, /model, /model/test, /audio, /utterance, /summons, /session/*, /confirm, /fs/grant, /fs/result, /memory/result, /memory/migrated",
        });
        return;
      }
      const body = await readBody();
      if (url.pathname === "/model") {
        const posted: Record<string, unknown> = typeof body === "string" ? { model: body } : body;
        const asked = String(posted.model ?? "").trim();
        const applying = sessionState === "live" || sessionState === "muted";
        const appliesTo = applying ? "the next session" : "now";
        if (!asked) {
          await forgetVoiceModel(home);
          narrate("model choice forgotten — back to the shipped default");
          respond(200, { ok: true, model: LIVE_MODEL, source: "default", appliesTo });
          return;
        }
        const shape = modelNameShape(asked);
        if (!shape.ok) {
          respond(400, { error: shape.why });
          return;
        }
        await writeVoiceModel(home, shape.name);
        narrate(applying ? `model: ${shape.name} — stored, the next session uses it` : `model: ${shape.name}`);
        respond(200, { ok: true, model: shape.name, source: "stored", appliesTo });
        return;
      }
      if (url.pathname === "/model/test") {
        const posted: Record<string, unknown> = typeof body === "string" ? { model: body } : body;
        const asked = String(posted.model ?? "").trim();
        const stored = await readVoiceKey(home).catch(() => null);
        if (!stored) {
          respond(200, { ok: false, answer: "no key stored, so there is nothing to ask the provider", why: "" });
          return;
        }
        // The list is asked for FIRST so a refusal can say which of the two
        // identical provider messages this is: “no such model” or “a real
        // model that cannot hold a Live session”.
        const list = await listModels(stored, options.fetchImpl);
        const result = await testModel({
          asked,
          key: stored,
          known: list.models,
          ...(options.WebSocketImpl ? { WebSocketImpl: options.WebSocketImpl } : {}),
          ...(options.liveUrl ? { urlFor: options.liveUrl } : {}),
        });
        narrate(`model check ${result.model ?? asked}: ${result.ok ? "accepted" : result.answer}`);
        respond(200, result);
        return;
      }
      if (url.pathname === "/memory/result") {
        const posted = typeof body === "string" ? {} : body;
        const callId = String(posted.callId ?? "");
        const taken = memories.answer(callId, {
          ok: posted.ok === true,
          ...(typeof posted.id === "string" ? { id: posted.id } : {}),
          ...(typeof posted.at === "string" ? { at: posted.at } : {}),
          ...(Array.isArray(posted.tags) ? { tags: posted.tags.filter((t) => typeof t === "string") } : {}),
          ...(posted.memory && typeof posted.memory === "object" ? { memory: posted.memory as Memory } : {}),
          ...(Array.isArray(posted.memories) ? { memories: posted.memories as Memory[] } : {}),
          ...(typeof posted.count === "number" ? { count: posted.count } : {}),
          ...(Array.isArray(posted.recentIds) ? { recentIds: posted.recentIds.filter((r) => typeof r === "string") } : {}),
          ...(typeof posted.error === "string" ? { error: posted.error } : {}),
        });
        if (!taken) {
          respond(200, {
            ok: false,
            error: "nothing is waiting for that callId — it expired, or it was already answered",
          });
          return;
        }
        respond(200, { ok: true });
        return;
      }
      if (url.pathname === "/memory/migrated") {
        const posted = typeof body === "string" ? {} : body;
        const count = typeof posted.count === "number" ? posted.count : 0;
        const kept = await retireLegacyMemories(home);
        narrate(kept ? `legacy memories retired to ${path.basename(kept)} (${count} imported)` : "no legacy memories to retire");
        recordToolLog({
          type: "session_event",
          event: kept ? `legacy memories migrated to the page's store (${count} entries)` : "legacy memory file absent at migration",
          details: { kind: "memory_migrated", count, kept: kept ? path.basename(kept) : null },
        });
        respond(200, { ok: true, migrated: count, kept: kept ? path.basename(kept) : null });
        return;
      }
      if (url.pathname === "/fs/grant") {
        const posted = typeof body === "string" ? { folder: body } : body;
        const named = typeof posted.folder === "string" ? posted.folder.trim() : "";
        const granted = posted.granted !== false && named !== "";
        const state = files.grant(granted ? named : null);
        narrate(granted ? `the person granted a folder: ${named}` : "the person revoked the granted folder");
        recordToolLog({
          type: "session_event",
          event: granted ? `folder granted: ${named}` : "folder grant revoked",
          details: { kind: granted ? "fs_granted" : "fs_revoked", folder: state.folder },
        });
        respond(200, { ok: true, ...state, granted: state.folder !== null });
        return;
      }
      if (url.pathname === "/fs/result") {
        const posted = typeof body === "string" ? {} : body;
        const callId = String(posted.callId ?? "");
        const taken = files.answer(callId, {
          ok: posted.ok === true,
          ...(typeof posted.content === "string" ? { content: posted.content } : {}),
          ...(Array.isArray(posted.entries)
            ? { entries: posted.entries as NonNullable<FsAnswer["entries"]> }
            : {}),
          ...(posted.truncated === true ? { truncated: true } : {}),
          ...(typeof posted.bytes === "number" ? { bytes: posted.bytes } : {}),
          ...(typeof posted.error === "string" ? { error: posted.error } : {}),
        });
        if (!taken) {
          respond(200, {
            ok: false,
            error: "nothing is waiting for that callId — it expired, or it was already answered",
          });
          return;
        }
        respond(200, { ok: true });
        return;
      }
      if (url.pathname === "/key") {
        if (typeof body === "object" && body.forget === true) {
          await forgetVoiceKey(home);
          narrate("key forgotten");
          respond(200, { provider: null });
          return;
        }
        // Either shape: the form posts `{key, provider}`, and a bare string is
        // tolerated because a hand-made request is not a mistake worth a 400.
        // The `provider` field is ignored now — there is one provider, and the
        // page still sends the field for a harness that predates this.
        const posted: Record<string, unknown> = typeof body === "string" ? { key: body } : body;
        const key = String(posted.key ?? "").trim();
        if (!key) {
          respond(400, { error: "no key in that body" });
          return;
        }
        await writeVoiceKey(home, { provider: "gemini", key });
        narrate("key stored for gemini");
        respond(200, { provider: "gemini", path: voiceKeyFile(home) });
        return;
      }
      if (url.pathname === "/key/test") {
        const stored = await readVoiceKey(home);
        if (!stored) {
          respond(200, { ok: false, answer: "no key stored" });
          return;
        }
        // One cheap authenticated call, and the provider's answer VERBATIM:
        // a wrong key is found the moment it is pasted rather than at the
        // first utterance, which is the difference between a five-second fix
        // and an hour of debugging the wrong layer.
        const result = await checkKey(stored, options.fetchImpl);
        narrate(`key check (${stored.provider}): ${result.ok ? "accepted" : result.answer}`);
        respond(200, result);
        return;
      }
      if (url.pathname === "/audio") {
        const stored = await readVoiceKey(home);
        if (!stored) {
          respond(200, { text: "", reason: "no key stored, so the harness cannot transcribe — set one in the panel, or use the browser's own recogniser" });
          return;
        }
        const wav = typeof body === "string" ? undefined : body.wav;
        if (!(wav instanceof Buffer) && !(wav instanceof Uint8Array)) {
          respond(400, { error: "expected raw audio bytes" });
          return;
        }
        const bytes = wav as Uint8Array;
        const out = await transcribe({
          wav: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          key: stored,
          ...(typeof body === "object" && typeof body.model === "string" ? { model: body.model } : {}),
        });
        narrate(`heard (${out.provider}): ${out.text || "nothing"}`);
        respond(200, { text: out.text, provider: out.provider });
        return;
      }
      if (url.pathname === "/utterance") {
        const asObject = typeof body === "string" ? {} : body;
        const text = String(asObject.text ?? "");
        const source = String(asObject.source ?? "spoken");
        const items = await target.canvas.items();
        const ctx: PlanContext = { items, mainThreadId: target.mainThreadId };
        const { plans, what } = planVoice(text, ctx);
        /* The same gate as the spoken path, keyed on the operation: a typed
           "delete the Greeting" is the same act as a spoken one, so it is the
           same question. */
        const destroying = plans.filter((one) => DESTRUCTIVE_OPS.has(one.op.type));
        const asked = theQuestion(destroying, items);
        if (destroying.length > 0 && !(await askThePerson(asked))) {
          const refused = `not done — the person did not confirm: ${asked}`;
          respond(200, { reply: refused, sent: [], failed: [], state: "refused", source });
          return;
        }
        const sent: string[] = [];
        const failed: string[] = [];
        for (const plan of plans) {
          // Same rule as the live path: the label is read off the operation
          // and the item it is aimed at, and the answer is what the apply did.
          const op = plan.op as { type: string; [key: string]: unknown };
          const targetItem = typeof op.itemId === "string" ? items.find((one) => one.id === op.itemId) : undefined;
          const intent = describeMintedOp(op, targetItem?.title);
          try {
            const applied = await applyPlan(target.canvas, plan, ctx, onIo);
            sent.push(applied.ack);
            narrate(`sent: ${plan.op.type} — ${intent} → ${applied.ack}`);
            recordToolLog({
              type: "utterance",
              source: source === "spoken" || source === "live" ? "live" : "typed",
              name: "utterance",
              args: { text, source },
              op: { type: plan.op.type, said: intent },
              result: { ok: true, answer: applied.ack },
            });
          } catch (err) {
            const msg = (err as Error).message;
            failed.push(`${plan.op.type} failed — ${msg}`);
            narrate(`refused: ${plan.op.type} failed — ${msg}`);
            recordToolLog({
              type: "utterance",
              source: source === "spoken" || source === "live" ? "live" : "typed",
              name: "utterance",
              args: { text, source },
              op: { type: plan.op.type, said: `failed — ${msg}` },
              result: { ok: false, error: `${plan.op.type} failed — ${msg}` },
            });
          }
        }
        respond(200, {
          reply: what ?? (sent.length ? sent.join("; ") : "nothing to send"),
          sent,
          failed,
          state: failed.length ? "some operations were refused" : "ready",
          source,
        });
        return;
      }
      if (url.pathname === "/summons") {
        const summons = typeof body === "string" ? {} : body;
        const who = String(summons.name ?? "an agent");
        const prompt = String(summons.prompt ?? "");
        narrate(`summoned by ${who}: ${prompt.slice(0, 300)}`);
        // The whole prompt, in the harness's own log. The narration ring is
        // bounded to 300 characters of it, and a summons is the one thing a
        // person who was not looking at the page still has to be able to read
        // afterwards — it is somebody's word, and it is what the microphone
        // was asked to do.
        recordToolLog({
          type: "session_event",
          source: "system",
          name: "summons",
          event: `summoned by ${who}`,
          details: { kind: "summons", by: who, prompt },
        });
        respond(200, { lines });
        return;
      }
      respond(404, { error: "no such door" });
      return;
    })().catch((err) => respond(500, { error: String((err as Error).message ?? err) }));
  });

  const onIo = (status: "sent" | "ack" | "err", said: string, err?: string) => {
    if (status === "sent") {
      daemonOpsSent++;
      logLine("daemon-io", `dispatching op (${daemonOpsSent} sent): ${said}`);
    } else if (status === "ack") {
      daemonOpsAck++;
      logLine("daemon-io", `acknowledged op (${daemonOpsAck} ack): ${said}`);
    } else {
      daemonOpsErr++;
      logLine("daemon-io", `refused op (${daemonOpsErr} errors): ${said} — ${err}`);
    }
  };

  /**
   * **The live door.** The page streams 16 kHz PCM here; this process holds
   * the provider socket and the key. Supports both /live and /audio paths.
   * Everything the model does comes back through the callbacks below, and a
   * tool call is answered with the RESULT of the operation because function
   * calling is synchronous.
   */
  const live = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname.replace(/^\/harness(?=\/|$)/, "") || "/";
    if (pathname === "/live" || pathname === "/audio" || pathname === "/broker") {
      live.handleUpgrade(request, socket, head, (ws) => {
        live.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });
  live.on("connection", (page: NodeSocket, request: { url?: string }) => {
    const brokerOnly = new URL(request.url ?? "/audio", "http://localhost").pathname === "/broker";
    let pageSession: LiveSession | null = null;
    let liveFailure = "";
    const say = (message: unknown) => {
      if (page.readyState === page.OPEN) page.send(JSON.stringify(message));
    };
    // A new page is not the old page's permission, nor an answer to its
    // outstanding questions. The new owner must report its actual grant.
    pending?.resolve(false);
    files.abandon();
    memories.abandon();
    files.grant(null);
    announce = say;
    const onLog = (entry: ToolLogEntry) => say({ type: "tool_log", entry });
    logListeners.add(onLog);
    // Register cleanup BEFORE key/model/context awaits. Previously a close
    // in that window left /state live and could start a provider for a dead page.
    page.on("close", () => {
      logListeners.delete(onLog);
      if (announce === say) {
        if (pending) {
          const what = pending.what;
          pending.resolve(false);
          recordToolLog({ type: "session_event", event: `the page closed with a question unanswered: ${what}`, reason: "page closed" });
        }
        announce = null;
        files.abandon();
        memories.abandon();
        files.grant(null);
      }
      pageSession?.close();
      if (activeAudioPage === page) {
        activeAudioPage = null;
        activeLiveSession = null;
        liveModelInUse = null;
        sessionState = "ended";
        void announcePresence("enrolled — nobody is listening right now");
        recordToolLog({ type: "session_event", event: "closed", reason: liveFailure || "page closed" });
      }
    });
    page.on("message", (data: Buffer, isBinary: boolean) => {
      if (!isBinary && String(data) === "broker:ping") say({ broker: "ready" });
      else if (isBinary && sessionState !== "muted") pageSession?.send(new Uint8Array(data));
    });
    say({ broker: "ready" });
    // This door restores page capabilities only: no key read, model lookup,
    // provider connection or session-state change. Audio is a separate act.
    if (brokerOnly) return;
    const previous = activeAudioPage;
    activeAudioPage = page;
    previous?.close();
    void (async () => {
      const stored = await readVoiceKey(home).catch((err) => {
        say({ state: String((err as Error).message), bad: true });
        return null;
      });
      if (page.readyState !== page.OPEN || activeAudioPage !== page) return;
      if (!stored) {
        say({
          state: "no key stored — set one in the panel and the microphone will use the Live API",
          bad: true,
          live: false,
        });
        page.close();
        return;
      }
      const current = await resolveModel();
      narrate(`opening a live session on ${current.model} (${current.source})`);
      // The same builder the inspector reads, so what the panel shows and what
      // the session is told are one text, not two copies of one.
      const parts = await liveInstructionParts(home, target);
      if (page.readyState !== page.OPEN || activeAudioPage !== page) return;
      liveModelInUse = current.model;
      const session = startLiveSession({
        key: stored,
        instructions: parts.instructions,
        rules: parts.rules.effective,
        model: current.model,
        ...(options.liveUrl ? { urlFor: options.liveUrl } : {}),
        ...(options.WebSocketImpl ? { WebSocketImpl: options.WebSocketImpl } : {}),
        callbacks: {
          // Every tool result carries the last few actions with their ids and
          // acks, so "delete that comment" has a referent the model can echo
          // without another read turn.
          decorateResponse: (answer) => ({ ...answer, recent: recentActions.slice(-5) }),
          onEvent: (event: string, details?: Record<string, unknown>) => {
            if (event === "socket_closed" && activeAudioPage === page) {
              say({ state: "provider connection closed", live: false });
              page.close();
            }
            narrate(`live socket: ${event} ${JSON.stringify(details ?? {})}`);
            recordToolLog({
              type: "session_event",
              source: "live",
              event,
              ...(details ? { args: details, details } : {}),
              ...(details?.reason ? { reason: String(details.reason) } : {}),
            });
          },
          onState: (state: string, bad?: boolean) => {
            if (bad) liveFailure = state;
            if (state === "live" && activeAudioPage === page && page.readyState === page.OPEN) {
              if (sessionState !== "muted") sessionState = "live";
              void announcePresence(sessionState === "muted" ? "muted" : "listening");
              recordToolLog({ type: "session_event", source: "live", event: "session opened" });
            }
            if (state.includes("interrupted")) {
              recordToolLog({ type: "session_event", source: "live", event: "interrupted", reason: state });
            } else if (state === "turn_complete") {
              recordToolLog({ type: "session_event", source: "live", event: "turn_complete" });
            }
            say({ state, bad });
          },
          onHeard: (text: string) => {
            say({ heard: text });
            // Both directions of speech belong in the record: a log of tool
            // calls alone cannot answer "did the model reply in words instead
            // of acting?", which is the question the log exists to settle.
            recordToolLog({
              type: "session_event",
              source: "live",
              event: `heard: ${text}`,
              details: { kind: "heard", text },
            });
          },
          onText: (text: string) => {
            say({ text });
            recordToolLog({
              type: "session_event",
              source: "live",
              event: `voice said: ${text}`,
              details: { kind: "reply", text },
            });
          },
          onAudio: (pcm: Uint8Array) => {
            if (page.readyState === page.OPEN) page.send(pcm);
          },
          onToolCall: async (name, args) => {
            const { canvas: snapCanvas } = await target.canvas.ctx.client.snapshot(target.canvas.id);
            const items = Object.values(snapCanvas.items).map((item) => ({ ...item, kind: itemKind(item) }));
            const trashItems = Object.values(snapCanvas.trash ?? {}).map((t) => ({ ...t.item, kind: itemKind(t.item) }));

            // 0. Memory: the page's own store (OPFS), asked over the socket —
            //    the same pattern as the file tools. No canvas, no daemon.
            if (name === "remember" || name === "read_memory" || name === "search_memory") {
              try {
                const outcome = await runMemoryTool(
                  name,
                  args as Record<string, unknown>,
                  (op, payload) => memories.ask(op, payload),
                  { session: target.name, presenceId: presenceSessionId },
                );
                narrate(outcome.said);
                // The write is recorded with its text: a memory about the person
                // is attributable and visible, never a private note.
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: outcome.answer,
                });
                return outcome.answer;
              } catch (err) {
                const message = String((err as Error).message ?? err);
                narrate(`${name} failed: ${message}`);
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: message },
                });
                return { ok: false, error: message };
              }
            }

            // 0b. Files: a question to the page, which holds the grant.
            if (name === "list_dir" || name === "read_file") {
              const outcome = await runFileTool(
                name,
                args as Record<string, unknown>,
                (op, path) => files.ask(op, path),
                files.state(),
              );
              narrate(outcome.said);
              // The folder and the file are recorded with the answer: content
              // read from a person's disk is attributable, always.
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: outcome.answer,
              });
              return outcome.answer;
            }

            /* **Who this agent IS — the one act here that changes no canvas.**
               It goes through the person for the reason the tool is not
               `actor.rename`: a model that can name itself is a model that can
               be talked into naming itself by anything it reads, and the name
               is what @-mentions, presence and every comment it wrote are
               filed under. So the name is proposed by the model, ANSWERED by
               the person, and only then claimed — in place, under the session
               key this harness already holds, so the actor keeps its id and
               its history. */
            if (name === "actor_claim") {
              const outcome = await claimName(args.name, { ask: true });
              if (!outcome.ok) {
                const error = outcome.error ?? "the claim failed";
                say({ text: error, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error },
                });
                return { ok: false, error };
              }
              say({ text: outcome.answer });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                ...(outcome.unchanged
                  ? {}
                  : { op: { type: "actor.claim", said: `renamed to “${outcome.name}”`, target: outcome.actorId } }),
                result: {
                  ok: true,
                  answer: outcome.answer,
                  ...(outcome.seq !== undefined ? { seq: outcome.seq } : {}),
                  ...(outcome.moved !== undefined ? { enrolments: outcome.moved } : {}),
                  ...(outcome.standing !== undefined ? { standing: outcome.standing } : {}),
                },
              });
              if (!outcome.unchanged) {
                recentActions.push({
                  tool: name,
                  op: "actor.claim",
                  ...(outcome.actorId ? { id: outcome.actorId } : {}),
                  ack: outcome.answer,
                });
                if (recentActions.length > 20) recentActions.shift();
              }
              return { ok: true, actor: { id: outcome.actorId, name: outcome.name }, answer: outcome.answer };
            }
            // 1. Read & Inspection tools:
            if (name === "project_switch") {
              const refuseSwitch = (message: string) => {
                say({ text: message, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: message },
                });
                return { ok: false, error: message };
              };
              const moved = await switchThisSession(String(args.canvas_ref ?? ""));
              if (!moved.ok) return refuseSwitch(moved.error);
              // A move that moved nothing says so without pretending.
              if (moved.previous.id === moved.canvas.id) {
                say({ text: moved.answer });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: true, answer: moved.answer },
                });
                return { ok: true, canvas: moved.canvas, answer: moved.answer };
              }
              say({ text: moved.answer });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, answer: moved.answer, canvasId: moved.canvas.id, from: moved.previous.id },
              });
              return { ok: true, canvas: moved.canvas, previous: moved.previous, items: moved.items, answer: moved.answer };
            }
            if (name === "project_update") {
              const hasTitle = typeof args.title === "string" && args.title.trim() !== "";
              const hasDescription = typeof args.description === "string" && args.description.trim() !== "";
              if (!hasTitle && !hasDescription) {
                const err = "nothing to change — a canvas edit needs a new title or a description";
                say({ text: err, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: err },
                });
                return { ok: false, error: err };
              }
              const ref = typeof args.canvas_ref === "string" ? args.canvas_ref.trim() : "";
              let canvas: { id: string; title: string };
              try {
                /* `matchRef` is the one spelling of "which canvas did they
                   mean" — id exact, then a unique title prefix — shared with
                   `--canvas` everywhere else, so a spoken reference and a
                   typed one cannot disagree. */
                canvas = ref
                  ? matchRef(await target.canvas.ctx.client.listCanvases(), ref)
                  : { id: target.canvasId, title: target.canvasLabel };
              } catch (err) {
                const message = (err as Error).message;
                say({ text: message, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: message },
                });
                return { ok: false, error: message };
              }
              const patch: { title?: string; description?: string } = {
                ...(hasTitle ? { title: String(args.title).trim() } : {}),
                ...(hasDescription ? { description: String(args.description).trim() } : {}),
              };
              try {
                const ack = await target.canvas.ctx.client.sendOp(canvas.id, target.canvas.ctx.actor, {
                  type: "project.update",
                  patch,
                });
                if (canvas.id === target.canvasId && patch.title !== undefined) target.canvasLabel = patch.title;
                const answer = `updated “${canvas.title}” [${canvas.id}]${patch.title ? ` — now “${patch.title}”` : ""}`;
                say({ text: answer });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  op: { type: "project.update", said: `renamed the canvas “${canvas.title}”`, target: canvas.id },
                  result: { ok: true, answer, seq: ack.seq },
                });
                recentActions.push({ tool: name, op: "project.update", id: canvas.id, ack: answer });
                if (recentActions.length > 20) recentActions.shift();
                return { ok: true, canvas: { id: canvas.id, title: patch.title ?? canvas.title }, answer };
              } catch (err) {
                const message = `the canvas was not changed — ${(err as Error).message}`;
                say({ text: message, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: message },
                });
                return { ok: false, error: message };
              }
            }
            if (name === "project_create") {
              const title = String(args.title ?? "").trim();
              if (!title) {
                const err = "a new canvas needs a title — ask the person what to call it";
                say({ text: err, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: err },
                });
                return { ok: false, error: err };
              }
              const canvasId = newCanvasId();
              const description = typeof args.description === "string" ? args.description.trim() : "";
              try {
                /* Home-scoped, exactly as `isocan canvas create` sends it:
                   the envelope names no canvas, because the canvas does not
                   exist until this op makes it. */
                const ack = await target.canvas.ctx.client.sendOp(null, target.canvas.ctx.actor, {
                  type: "project.create",
                  canvasId,
                  title,
                  ...(description ? { description } : {}),
                });
                const answer =
                  `created the canvas “${title}” [${canvasId}] — this session is still on “${target.canvasLabel}”; ` +
                  `switch to it when the person wants to work there`;
                say({ text: answer });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  op: { type: "project.create", said: `made the canvas “${title}”`, target: canvasId },
                  result: { ok: true, answer, seq: ack.seq, canvasId },
                });
                recentActions.push({ tool: name, op: "project.create", id: canvasId, ack: answer });
                if (recentActions.length > 20) recentActions.shift();
                return { ok: true, canvas: { id: canvasId, title }, answer };
              } catch (err) {
                const message = `the canvas was not made — ${(err as Error).message}`;
                say({ text: message, bad: true });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: message },
                });
                return { ok: false, error: message };
              }
            }
            if (name === "project_list") {
              /* **The shelf is out of the way unless it is asked for** (#194),
                 and the rule is `inScope` — the same one the app's home list
                 and `isocan canvas list` use, so "my projects" means one thing
                 on every surface. The session's own canvas is listed whatever
                 it is: a person asked where they are. */
              const canvases = await target.canvas.ctx.client.listCanvases();
              const shown = sortCanvases(
                canvases.filter((c) => inScope(c, "live") || c.id === target.canvasId),
                "recent",
              );
              const answer =
                shown.length === 0
                  ? "this home has no canvases yet"
                  : shown
                      .map((c) => `${c.title}${c.id === target.canvasId ? " (this session is here)" : ""} [${c.id}]`)
                      .join("; ");
              say({ text: answer });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, count: shown.length, answer },
              });
              return {
                ok: true,
                count: shown.length,
                current: target.canvasId,
                canvases: shown.map((c) => ({ id: c.id, title: c.title })),
                answer,
              };
            }
            if (name === "read_canvas") {
              const summary = items.map((i) => ({
                id: i.id,
                title: i.title,
                kind: i.kind,
                position: { x: i.x, y: i.y, width: i.width, height: i.height },
                currentVersionId: i.currentVersionId,
              }));
              const text = describeCanvas({ items, mainThreadId: target.mainThreadId });
              say({ text });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, count: items.length, answer: text },
              });
              return { ok: true, canvas: text, items: summary };
            }
            if (name === "read_item") {
              const ref = String(args.item_ref ?? "");
              const item = resolveSpokenRef(ref, items);
              if (!item) {
                const err = `could not find an item matching "${ref}" on this canvas`;
                say({ text: err });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  result: { ok: false, error: err },
                });
                return { ok: false, error: err };
              }
              let content = "";
              try {
                const currentVersion = item.versions?.find((v) => v.id === item.currentVersionId);
                if (currentVersion?.blobHash) {
                  const buf = await target.canvas.ctx.client.downloadBlob(target.canvas.id, currentVersion.blobHash);
                  content = buf.toString("utf8");
                }
              } catch {}
              const MAX_CONTENT_LEN = 4000;
              const byteLen = Buffer.byteLength(content, "utf8");
              const isTruncated = content.length > MAX_CONTENT_LEN;
              const bodyText = isTruncated
                ? content.slice(0, MAX_CONTENT_LEN) + `\n\n[... content truncated after ${MAX_CONTENT_LEN} characters; full length: ${content.length} characters (${byteLen} bytes) ...]`
                : content;
              const answer = {
                id: item.id,
                title: item.title,
                kind: item.kind,
                content: bodyText,
                truncated: isTruncated,
                characterCount: content.length,
                byteLength: byteLen,
              };
              say({ text: `Item "${item.title}": ${bodyText.slice(0, 150)}` });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, answer },
              });
              return { ok: true, item: answer };
            }
            if (name === "find_items") {
              const query = String(args.query ?? "").toLowerCase();
              const hits = items.filter(
                (i) =>
                  (i.title && i.title.toLowerCase().includes(query)) ||
                  (i.id && i.id.toLowerCase().includes(query)),
              );
              const summary = hits.map((i) => ({
                id: i.id,
                title: i.title,
                kind: i.kind,
                position: { x: i.x, y: i.y },
              }));
              const text = hits.length
                ? `Found ${hits.length} items matching "${query}": ${hits.map((i) => `“${i.title}”`).join(", ")}.`
                : `No items found matching "${query}".`;
              say({ text });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, count: hits.length, answer: summary },
              });
              return { ok: true, count: hits.length, items: summary };
            }
            if (name === "read_threads") {
              const ref = args.item_ref ? String(args.item_ref) : null;
              let targetItem: ListedItem | null = null;
              if (ref) {
                targetItem = resolveSpokenRef(ref, items);
                if (!targetItem) {
                  const err = `could not find item matching "${ref}"`;
                  say({ text: err });
                  recordToolLog({
                    type: "tool_call",
                    source: "live",
                    name,
                    args: args as Record<string, unknown>,
                    result: { ok: false, error: err },
                  });
                  return { ok: false, error: err };
                }
              }
              const allThreads = await target.canvas.threads().catch(() => []);
              const filtered = targetItem
                ? allThreads.filter((t) => t.anchorItemId === targetItem!.id)
                : allThreads;
              const threadList = filtered.map((t) => ({
                id: t.id,
                anchor: { itemId: t.anchorItemId, x: t.x, y: t.y },
                comments: t.comments.map((c) => ({ id: c.id, body: c.body, author: c.author?.name, at: c.createdAt })),
              }));
              // The prose names the ids too: the model reads the answer, and a
              // comment it cannot name is a comment it cannot edit or delete.
              const threadText = threadList.length
                ? threadList
                    .map(
                      (t) =>
                        `thread ${t.id}${t.anchor.itemId ? ` on ${t.anchor.itemId}` : ""}: ` +
                        t.comments
                          .map((c) => `${c.id}${c.author ? ` (${c.author})` : ""} “${String(c.body).slice(0, 80)}”`)
                          .join(", "),
                    )
                    .join("; ")
                : "no threads on this canvas yet";
              say({ text: threadText });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, count: threadList.length, answer: threadText },
              });
              return { ok: true, count: threadList.length, threads: threadList, answer: threadText };
            }
            if (name === "read_presence") {
              const sessions = await target.canvas.ctx.client.listSessions(target.canvas.id).catch(() => []);
              const rcRows = await readRcAgents(home).catch(() => []);
              const enrolled = rcRows.filter((r) => r.canvasId === target.canvas.id).map((r) => ({ name: r.name, harness: r.harness }));
              const liveSessions = sessions.map((s) => ({ who: s.label ?? s.actor.name, kind: s.harness ?? s.kind, status: s.status }));
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, liveSessions, enrolled },
              });
              return { ok: true, liveSessions, enrolled };
            }
            if (name === "viewport_focus") {
              const ref = String(args.item_ref ?? "");
              const item = resolveSpokenRef(ref, items);
              if (!item) return { ok: false, error: `could not find item matching "${ref}"` };
              say({ type: "viewport_focus", itemId: item.id, x: item.x, y: item.y });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, focused: item.title },
              });
              return { ok: true, focused: item.title };
            }
            if (name === "viewport_pan") {
              say({ type: "viewport_pan", x: Number(args.x ?? 0), y: Number(args.y ?? 0), zoom: args.zoom ? Number(args.zoom) : undefined });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, x: args.x, y: args.y },
              });
              return { ok: true, panned: { x: args.x, y: args.y } };
            }
            if (name === "selection_set") {
              const refs = (args.item_refs as string[]) ?? [];
              const selectedIds = refs.map((r) => resolveSpokenRef(r, items)?.id).filter(Boolean);
              say({ type: "selection_set", selected: selectedIds });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true, count: selectedIds.length },
              });
              return { ok: true, selectedCount: selectedIds.length };
            }
            if (name === "selection_clear") {
              say({ type: "selection_clear" });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: true },
              });
              return { ok: true, cleared: true };
            }

            // Not gated but ABSENT: emptying the trash and deleting the whole
            // project have no operation behind them here, so there is nothing
            // to confirm. Said plainly, because "requires confirmation" would
            // promise a door that does not exist.
            if (name === "trash_empty" || name === "project_delete") {
              const err =
                `${name} is not wired to this harness — there is no confirmation it can ask for it, and nothing was changed. ` +
                "A person does that in the app, where the canvas can be seen while it happens.";
              say({ text: err });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: false, error: err },
              });
              return { ok: false, error: err };
            }

            // 2. Canvas mutation operations:
            const plan = planForCall(name, args as Record<string, unknown>);
            if (plan.plans.length === 0) {
              const err = plan.what ?? `unknown tool: "${name}" is not in this harness's vocabulary`;
              say({ text: err, state: err, bad: true });
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                result: { ok: false, error: err },
              });
              return { ok: false, error: err };
            }

            const { ready, refused } = resolveLivePlans(plan.plans, items, trashItems);

            /* A gated plan stops here until the person says yes, and the
               model is told what they said. Nothing is minted before the
               answer: the gate is above the apply, not beside it. Resolved
               first, so the question names the item that was actually found. */
            const destroying = ready.filter((one) => DESTRUCTIVE_OPS.has(one.op.type));
            if (destroying.length > 0) {
              const what = theQuestion(destroying, items);
              if (!(await askThePerson(what))) {
                const err = `not done — the person did not confirm: ${what}`;
                say({ text: err });
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  op: { type: destroying[0]!.op.type, said: `not confirmed — ${what}` },
                  result: { ok: false, error: err },
                });
                return { ok: false, error: err };
              }
            }

            const sent: string[] = [];
            const failed: string[] = [];
            for (const one of ready) {
              try {
                const applied = await applyPlan(target.canvas, one, { items, mainThreadId: target.mainThreadId }, onIo);
                // The intent, derived from the minted operation and its actual
                // arguments; the ack is the outcome, produced by the apply.
                // The label never claims what the outcome was, and the answer
                // the model and the log see is the daemon's, not the label's.
                const intent = one.said;
                sent.push(applied.ack);
                recentActions.push({
                  tool: name,
                  op: one.op.type,
                  ...(applied.target ? { id: applied.target } : {}),
                  ack: applied.ack,
                });
                if (recentActions.length > 20) recentActions.shift();
                narrate(`sent: ${one.op.type} — ${intent} → ${applied.ack}`);
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  op: {
                    type: one.op.type,
                    said: intent,
                    ...(applied.target ? { target: applied.target } : {}),
                    ...(applied.seq !== undefined ? { seq: applied.seq } : {}),
                  },
                  result: {
                    ok: true,
                    answer: applied.ack,
                    ...(applied.seq !== undefined ? { seq: applied.seq } : {}),
                    ...(applied.target ? { target: applied.target } : {}),
                  },
                });
              } catch (err) {
                const msg = (err as Error).message;
                const failureMsg = `${one.op.type} failed — ${msg}`;
                failed.push(failureMsg);
                recentActions.push({ tool: name, op: one.op.type, ack: failureMsg });
                if (recentActions.length > 20) recentActions.shift();
                narrate(`refused: ${failureMsg}`);
                recordToolLog({
                  type: "tool_call",
                  source: "live",
                  name,
                  args: args as Record<string, unknown>,
                  op: { type: one.op.type, said: `failed — ${msg}` },
                  result: { ok: false, error: failureMsg },
                });
              }
            }
            for (const r of refused) {
              failed.push(r.message);
              narrate(`refused: ${r.message}`);
              recordToolLog({
                type: "tool_call",
                source: "live",
                name,
                args: args as Record<string, unknown>,
                op: { type: r.type, said: r.said },
                result: { ok: false, error: r.message },
              });
            }
            say({ sent, failed, state: failed.length ? "some operations were refused" : "live", bad: failed.length > 0 });
            return {
              ok: failed.length === 0,
              ...(sent.length ? { sent } : {}),
              ...(failed.length ? { failed, error: failed.join("; ") } : {}),
              ...(plan.what ? { note: plan.what } : {}),
            };
          },
        },
      });
      pageSession = activeLiveSession = session;
      const ok = await session.ready;
      if (!ok && page.readyState === page.OPEN) {
        // Loud, and never a silent fallback: a quiet failure here is what made
        // a credential problem look like a grammar problem.
        say({ state: "Live session could not start — " + (liveFailure || "the provider refused, see above"), bad: true, live: false });
        page.close();
      }
    })().catch((err) => {
      say({ state: String((err as Error).message ?? err), bad: true, live: false });
      page.close();
    });
  });

  const port = options.port ?? DEFAULT_VOICE_PORT;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  // The port ASKED for is not always the port GIVEN: `--voice-port 0` is the
  // way to say "any free one", and a state file that recorded the zero would
  // send every reader to a door nobody is behind.
  const bound = server.address();
  const listening = typeof bound === "object" && bound ? bound.port : port;
  const url = `http://127.0.0.1:${listening}/`;
  const state: VoiceServerState = {
    port: listening,
    url,
    name: target.name,
    canvas: target.canvasLabel,
    lines,
    session: { state: sessionState },
    toolLog,
    confirm: pendingQuestion(),
  };
  /** What this harness says it is, for anything reading from outside — the
   * standing-server probe, and whoever looks at the file a week later. Written
   * again whenever it stops being true. */
  const rememberWhatIAm = async (): Promise<void> => {
    state.name = target.name;
    state.canvas = target.canvasLabel;
    await fs.mkdir(voiceDir(home), { recursive: true, mode: 0o700 });
    await fs.writeFile(
      voiceServerFile(home),
      `${JSON.stringify({ pid: process.pid, port: listening, url, name: state.name, canvas: state.canvas, at: new Date().toISOString() }, null, 2)}\n`,
      { mode: 0o600 },
    );
  };
  await rememberWhatIAm();

  // Registering is a fact about being up: the rc can reach this harness only
  // through config.json's acpAdapters, and the honest moment to write it is now
  // that the page is standing and the summons has something to attach to.
  const registered = await registerVoiceHarness(home).catch((err: Error) => {
    logLine("harness", `could not register as the "${VOICE_HARNESS}" harness — ${err.message}`);
    return null;
  });
  if (registered?.state === "written") {
    logLine("harness", `registered as the "${VOICE_HARNESS}" harness in config.json's acpAdapters — \`isocan rc\` can summon it now`);
  } else if (registered?.state === "kept") {
    logLine("harness", `config.json already declares a "${VOICE_HARNESS}" harness (${registered.declared?.join(" ")}) — leaving it alone`);
  }

  // Announce presence on the canvas so `isocan who` and the canvas facepile
  // show the voice agent in the room:
  void announcePresence("enrolled — nobody is listening right now");
  heartbeatTimer = setInterval(() => {
    const s = sessionState === "live" ? "listening" : sessionState === "muted" ? "muted" : "enrolled — nobody is listening right now";
    void announcePresence(s);
  }, 10000);

  audioStatsTimer = setInterval(() => {
    if (sessionState === "live") {
      logLine("audio-stats", "live streaming throughput", {
        inFromPage: `${pageAudioInFrames} frames (${pageAudioInBytes}B)`,
        outToProvider: `${providerAudioOutFrames} frames`,
        inFromProvider: `${providerAudioInFrames} frames`,
        outToPage: `${pageAudioOutBytes}B`,
        totalDaemonOpsAck: daemonOpsAck,
      });
    }
  }, 3000);

  logLine("startup", `Voice harness active on port ${listening}`, {
    canvas: `${target.canvasLabel} (${target.canvasId})`,
    agent: `${target.name} (${target.actorId})`,
    daemon: target.daemon,
    model: options.model ?? LIVE_MODEL,
    keyConfigured: (await readVoiceKey(home).catch(() => null)) !== null,
  });

  return {
    state,
    close: async () => {
      if (audioStatsTimer) clearInterval(audioStatsTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (presenceSessionId) {
        await target.canvas.ctx.client.endSession(target.canvasId, presenceSessionId).catch(() => {});
        presenceSessionId = null;
      }
      logLine("shutdown", `Voice harness stopped on port ${listening}`);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(voiceServerFile(home), { force: true });
    },
  };
}

/**
 * **The page itself, from the build `npm run build -w @isocan/voice-agent`
 * leaves in `dist/`.**
 *
 * The harness used to GENERATE the page it served (`voice-harness-page.ts`, a
 * few hundred lines of template that had drifted a long way from the page the
 * package actually owns: `voice.html` + `src/main.ts` + `src/voiceAudio.ts`,
 * with its own tests, its own resampler and its own setup panel). Two pages
 * meant the served one was the untested one — and it was the older one, with a
 * fractional resampler that zeroed most samples at 44.1 kHz. The page is the
 * package's own artifact now, and serving it is serving a directory.
 *
 * `dist/` is built, not committed, so a harness started without one says so
 * rather than serving a blank: the answer to `GET /` names the command.
 *
 * The page asks for the harness under `/harness` (the Vite dev server's proxy
 * path, so dev and served are the same page), which the request handler strips
 * before routing. The assets are the only thing served from here; every door
 * is still the harness's own.
 */
const PAGE_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Where the built page is: `new URL("../dist", import.meta.url)`. */
export function voiceDistDir(): string {
  return fileURLToPath(new URL("../dist", import.meta.url));
}

/** What `GET /` answers when there is no build: the one fact that is missing,
 * and the command that settles it — never a blank page. */
function pageNotBuilt(): string {
  return (
    "<!doctype html><meta charset=\"utf-8\"><title>Voice — the page is not built</title>" +
    "<body style=\"font:15px/1.5 system-ui;padding:2rem;max-width:44rem;margin:auto\">" +
    "<h1>The page is not built yet</h1>" +
    "<p>This harness serves <code>dist/</code>, which <code>npm run build -w @isocan/voice-agent</code> writes. " +
    "<code>npm start -w @isocan/voice-agent</code> builds it first.</p>" +
    "<p>The harness itself is up, so this is the only thing missing.</p>"
  );
}

/** Is a harness already standing where the adapter or a second start would
 * find it? A file is a claim; the port is the fact. */
export async function standingVoiceServer(
  home: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ pid: number; port: number; url: string } | null> {
  try {
    const raw = JSON.parse(await fs.readFile(voiceServerFile(home), "utf8")) as { pid: number; port: number; url: string };
    if (!raw?.port) return null;
    const r = await fetchImpl(`http://127.0.0.1:${raw.port}/state`).catch(() => null);
    if (!r?.ok) return null;
    return raw;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The ACP face: what makes this a harness, which is what invites it
 * ------------------------------------------------------------------ */

interface Rpc {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * **The ACP agent, in full.** The wire is newline-delimited JSON-RPC 2.0 with
 * `protocolVersion` 1, verified against the rc's client (`acp.ts`): initialize,
 * session/new, session/load, session/prompt, and `stopReason: "end_turn"`.
 *
 * A voice turn ends the moment it is acknowledged, deliberately. The rc's turn
 * is a summons, not a conversation: the microphone belongs to a process that
 * outlives the turn (the standing server this face forwards to), so the
 * summons appears in the conversation and the turn closes cleanly rather than
 * holding a 10-minute ceiling open on a room that may be empty.
 */
export function createAcpAgent(options: {
  forward: (summons: { name: string; prompt: string }) => Promise<{ url?: string; refused?: string } | null>;
  name: string;
  out?: (message: unknown) => void;
}): { handle: (message: Rpc) => Promise<void> } {
  const out = options.out ?? ((message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`));
  const sessions = new Set<string>();
  return {
    handle: async (message: Rpc) => {
      const { id, method, params = {} } = message;
      const reply = (result: unknown) => out({ jsonrpc: "2.0", id, result });
      const fail = (code: number, text: string) => out({ jsonrpc: "2.0", id, error: { code, message: text } });
      try {
        switch (method) {
          case "initialize":
            reply({
              protocolVersion: 1,
              agentCapabilities: { loadSession: true, promptCapabilities: { image: false, audio: false } },
              authMethods: [],
              agentInfo: { name: "isocan voice-agent", version: "0.1.0" },
            });
            return;
          case "session/new": {
            const sessionId = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            sessions.add(sessionId);
            reply({ sessionId });
            return;
          }
          case "session/load": {
            const sessionId = String(params.sessionId ?? "");
            sessions.add(sessionId);
            reply({});
            return;
          }
          case "session/prompt": {
            const prompt = promptText(params.prompt);
            const forwarded = await options.forward({ name: options.name, prompt }).catch(() => null);
            // What went wrong is said in the refusal's OWN words: a refusal
            // that paraphrases is a refusal that hides the command that fixes
            // it, which is the whole of what it is for.
            const text = forwarded?.refused
              ? forwarded.refused
              : forwarded?.url
                ? `The voice harness is standing at ${forwarded.url} — the summons is in its conversation.`
                : "The voice harness could not open its local page; start one with `npm start -w @isocan/voice-agent`.";
            out({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: { type: "text", text },
                },
              },
            });
            reply({ stopReason: "end_turn" });
            return;
          }
          case "session/cancel":
            reply({});
            return;
          default:
            fail(-32601, `the voice harness does not speak ${method ?? "that"}`);
        }
      } catch (err) {
        fail(-32000, String((err as Error).message ?? err));
      }
    },
  };
}

function promptText(prompt: unknown): string {
  if (typeof prompt === "string") return prompt;
  if (Array.isArray(prompt)) {
    return prompt
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: string }).text ?? "") : ""))
      .join(" ")
      .trim();
  }
  return "";
}

/** Where this package's own entry point is, so the detached server is this
 * build and not whatever is on the PATH. */
function voiceEntry(): string {
  return fileURLToPath(new URL("../bin/voice-agent.js", import.meta.url));
}

/** What this harness is, in the form a person's `config.json` takes. */
export interface VoiceRegistration {
  state: "written" | "already" | "kept";
  /** What a declaration that is not ours names, when there was one. */
  declared?: string[];
}

/**
 * **The harness registers itself, in the one place `isocan rc` looks.**
 *
 * The rc resolves a harness through `~/.isocan/config.json`'s `acpAdapters`
 * (`packages/cli/src/harnesses.ts`, `adapterFor`): a named command and its
 * arguments, and nothing else is needed — no registry entry, no PATH lookup,
 * no new code in the CLI. A person used to have to write that declaration by
 * hand *before* an enrolment could stand anything up, which meant an agent
 * could be enrolled on a canvas and have nothing able to start it.
 *
 * So the package writes its own: **this file**, by absolute path, run by the
 * interpreter that is running this code (`process.execPath`), with `--acp` —
 * the file a person starts, which is one entry with two ways in, so a summons
 * runs exactly what the person's own command runs.
 *
 * A declaration by hand WINS and is left alone: `adapterFor` reads config
 * first for exactly this reason, and a person who pointed `voice` at their own
 * bridge (or their own checkout — the path above is absolute, and a checkout
 * that moves is a declaration that did not) meant it. `written` and `already`
 * are what the start line narrates.
 */
export async function registerVoiceHarness(home: string): Promise<VoiceRegistration> {
  const entry = [process.execPath, voiceEntry(), "--acp"];
  const raw = await readConfigFile<{ acpAdapters?: Record<string, string[] | string> }>(home);
  const declared = raw.acpAdapters?.[VOICE_HARNESS];
  if (Array.isArray(declared) && declared.length === entry.length && declared.every((part, i) => part === entry[i])) {
    return { state: "already" };
  }
  if (declared !== undefined) {
    return { state: "kept", declared: Array.isArray(declared) ? declared : declared.trim().split(/\s+/) };
  }
  await updateConfigFile(home, { acpAdapters: { ...(raw.acpAdapters ?? {}), [VOICE_HARNESS]: entry } });
  return { state: "written" };
}

/** A line on stderr: the adapter's stdout is JSON-RPC and nothing else. */
function adapterLine(message: string): void {
  process.stderr.write(`[${new Date().toISOString()}] [voice-adapter] ${message}\n`);
}

/**
 * **Which canvas, and which name, from the enrolment record.**
 *
 * The rc's record is the authority on what this agent answers on: a summons
 * carries a name and a canvas in its environment, and those are the enrolling
 * caller's hint, not the fact. The row is the fact — it is what `rc add`
 * wrote, it names the canvas the person enrolled the agent on, and it is the
 * same row `isocan who` and the summons roster read.
 *
 * One agent may stand on several canvases, so a hint that matches a row is
 * honoured; without a hint the name decides; and a single row is the answer
 * rather than a guess.
 */
export function enrolmentForVoice(
  rows: { canvasId: string; name: string; harness: string | null }[],
  options: { name: string; canvas?: string },
): { canvasId: string; name: string; harness: string | null } | null {
  const mine = rows.filter((row) => row.harness === VOICE_HARNESS);
  if (mine.length === 0) return null;
  const onCanvas = options.canvas ? mine.filter((row) => row.canvasId === options.canvas) : [];
  const pool = onCanvas.length > 0 ? onCanvas : mine;
  const byName = pool.find((row) => row.name === options.name);
  return byName ?? (pool.length === 1 ? pool[0]! : null);
}

/** The command that fixes "nothing can summon this", in full, with the
 * canvas filled in when the caller knew one. A refusal that does not name its
 * fix is a refusal somebody has to go and research. */
export function notEnrolledLine(name: string, canvas?: string): string {
  return (
    `The voice harness is not enrolled here, so nothing can summon it.\n` +
    `Enrol it, on the canvas it should answer on, with:\n` +
    `  isocan rc add ${name} --harness ${VOICE_HARNESS} --canvas ${canvas ?? "<canvas id>"}\n` +
    `(\`isocan ls --kind canvas\` lists the canvases; the enrolment is what makes the summons, the identity and the canvas resolve without environment variables.)`
  );
}

/**
 * **Enough adapter to be invited.** A summons with no harness standing starts
 * one — detached, so it outlives the turn — and then hands the summons over.
 * The canvas comes from the enrolment record, which is what makes the
 * operations the microphone sends this agent's; the environment the rc
 * injects is a hint that the record can correct.
 *
 * Which path ran — attached to a server already standing, or started one
 * detached — is LOGGED, not only said in the reply: the difference is a
 * microphone that was already open and one that opened just now, and it is
 * invisible from the conversation alone.
 */
export async function runVoiceAdapter(options: { home: string; name: string; canvas?: string }): Promise<void> {
  /**
   * **The name a summons appears under is the one the agent ANSWERS to, not
   * the key it was injected with.** The rc injects the session id — the
   * conversation the actor is bound under — and after a rename that is the old
   * name by design, because the key does not move. The harness's own record
   * knows what it is called now, so the adapter asks that first and falls back
   * to the injected name on the first run, when they are the same thing.
   */
  const remembered = await readVoiceIdentity(options.home).catch(() => null);
  const name = remembered?.name ?? options.name;
  const rows = await readRcAgents(options.home).catch(() => []);
  const enrolled = enrolmentForVoice(rows, { ...options, name });
  const target = enrolled ? { name: enrolled.name, canvas: enrolled.canvasId } : null;
  const refusal = target
    ? null
    : notEnrolledLine(name, options.canvas ?? process.env.ISOCAN_CANVAS ?? undefined);
  if (refusal) adapterLine(`refused: ${refusal.split("\n")[0]}`);
  else if (target && target.canvas !== options.canvas) {
    adapterLine(`canvas resolved from the enrolment record: ${target.canvas} (the environment said ${options.canvas ?? "nothing"})`);
  }

  const forward = async (summons: { name: string; prompt: string }) => {
    if (!target) return { refused: refusal! };
    const standing = await standingVoiceServer(options.home);
    const chosen = standing ?? (await startDetachedServer({ home: options.home, name: target.name, canvas: target.canvas }));
    if (!chosen) return null;
    adapterLine(
      standing
        ? `attached to the voice harness already standing on port ${chosen.port}`
        : `started a voice harness detached on port ${chosen.port}`,
    );
    await fetch(`http://127.0.0.1:${chosen.port}/summons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: summons.name, prompt: summons.prompt }),
    }).catch(() => {});
    return { url: chosen.url };
  };
  const agent = createAcpAgent({ forward, name });
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let at = buffer.indexOf("\n");
    while (at >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (line.trim()) {
        let parsed: Rpc | null = null;
        try {
          parsed = JSON.parse(line) as Rpc;
        } catch {
          parsed = null;
        }
        if (parsed) void agent.handle(parsed);
      }
      at = buffer.indexOf("\n");
    }
  });
  await new Promise<void>((resolve) => process.stdin.on("end", resolve));
}

/** Start the standing server as a child that survives this process — the
 * adapter's turn ends, the microphone should not. */
async function startDetachedServer(options: { home: string; name: string; canvas?: string }): Promise<{ port: number; url: string } | null> {
  const port = DEFAULT_VOICE_PORT;
  const args = [voiceEntry(), "--port", String(port)];
  if (options.canvas) args.push("--canvas", options.canvas);
  // The identity is a KEY, not a name: the one the rc injected when there is
  // one, else this machine's key for the name the enrolment record gives — the
  // same key `isocan rc add` claimed and the same one a later summons injects.
  // Passing the name as a session id is what made the detached server resume
  // nothing and mint an actor called after a MAC.
  const session = process.env.ISOCAN_SESSION_ID ?? agentSessionOf(await machineAgentKey(options.home, options.name));
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ISOCAN_SESSION_ID: session,
      ISOCAN_HARNESS: process.env.ISOCAN_HARNESS ?? "agent",
    },
  });
  child.unref();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const standing = await standingVoiceServer(options.home);
    if (standing) return standing;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

/**
 * **Which build is running, and when the code behind it was last written.**
 * The evening's confusion was not knowing whether the page in front of you was
 * the old one or the new one, and a page that cannot answer that is a page
 * somebody tests the wrong version of. The version is the CLI's own; the time
 * is the newest modification of this feature's source, read from disk, so it
 * says when the RUNNING code was written rather than when it was released.
 */
function voiceVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.join(here, "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "unreleased";
  } catch {
    return "unreleased";
  }
}

function voiceUpdated(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const files = ["voice-harness.ts", "main.ts", "voiceAudio.ts"].map((name) => statSync(path.join(here, name)).mtimeMs);
    return new Date(Math.max(...files)).toISOString().replace("T", " ").slice(0, 16) + "Z";
  } catch {
    return "unknown";
  }
}

/** `~/.isocan` for the process, the way every other CLI command finds it. */
export function isocanHome(): string {
  return process.env.ISOCAN_HOME ?? path.join(os.homedir(), ".isocan");
}
