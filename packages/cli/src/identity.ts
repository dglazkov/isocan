import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import type { Actor } from "@isocan/core";
import { newActorId } from "@isocan/core";
import { paths } from "@isocan/server";
import { harnessSessions, harnessVarsFor, type HarnessSession } from "./harness.ts";

interface IdentityFile extends Actor {
  createdAt: string;
  // Future: an `auth` block (provider, tokens). Actor.id stays the stable key.
}

/**
 * A machine holds one person and any number of agents, and no two of them are
 * the same person.
 *
 * Three slots, most specific first. A SESSION identity
 * (`~/.isocan/agents.json`, keyed by the session id the harness puts in the
 * environment) is one agent, in whatever directory it happens to work — the
 * only slot that can tell two agents apart when they share one, because a
 * directory has a single identity file and both of them would read it. A
 * DIRECTORY identity (`<dir>/.isocan/identity.json`, found by walking up from
 * the working directory) belongs to whoever works there. The HOME identity
 * (`~/.isocan/identity.json`) belongs to whoever owns the machine — you.
 *
 * So an agent naming itself never renames the human, and the human's canvas is
 * never created under an agent's name. One slot per machine was the old
 * design, and the skill told agents to claim it — so the last agent to
 * introduce itself became the user.
 */
export interface ResolvedIdentity {
  actor: Actor;
  /** "session" = this agent, whatever directory it is in. "directory" = an
   * agent's, in a working directory. "home" = the human's. */
  source: "session" | "directory" | "home";
  file: string;
  /** The harness that named this session, when `source` is "session". */
  harness?: string;
}

export const localIdentityFile = (dir: string) => path.join(dir, ".isocan", "identity.json");

async function readFrom(file: string): Promise<Actor | null> {
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as IdentityFile;
    return raw.id && raw.name ? { id: raw.id, name: raw.name } : null;
  } catch {
    return null;
  }
}

export async function readIdentity(home: string): Promise<Actor | null> {
  return readFrom(paths.identityFile(home));
}

/**
 * The nearest directory identity at or above `cwd` — an agent that named
 * itself in a project still speaks as itself from a subdirectory of it.
 *
 * Two floors under the walk. The isocan home is never a directory identity:
 * `~/.isocan/identity.json` is the human's slot by definition. And the walk
 * stops below `$HOME`, because everything above it belongs to the person, not
 * to a piece of work — without that, `ISOCAN_HOME=/tmp/x isocan …` in any
 * project would climb out and adopt the real user's name as if an agent had
 * left it there.
 */
export async function findLocalIdentity(
  cwd: string,
  home: string,
): Promise<{ actor: Actor; file: string } | null> {
  const isocanHome = path.resolve(home);
  const userHome = path.resolve(os.homedir());
  let dir = path.resolve(cwd);
  for (;;) {
    if (dir !== userHome && path.join(dir, ".isocan") !== isocanHome) {
      const file = localIdentityFile(dir);
      const actor = await readFrom(file);
      if (actor) return { actor, file };
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return null;
    dir = parent;
  }
}

/* ── The session registry ────────────────────────────────────────────────
 *
 * `~/.isocan/agents.json` maps `<harness>:<session id>` to the actor speaking
 * through it. Keyed by session, but the actor id is looked up BY NAME, so an
 * agent that comes back tomorrow under the name it used today keeps the
 * history it made — the same promise `writeIdentity` makes to the human.
 */

interface SessionBinding extends Actor {
  boundAt: string;
  harness: string;
}

interface AgentRegistry {
  sessions: Record<string, SessionBinding>;
}

/** Bindings this old are dropped on the next write — but never the newest one
 * under a given name, because that is the anchor the name reuses to stay the
 * same person. An abandoned session costs one line; a forgotten name costs an
 * agent its history. */
const PRUNE_AFTER_DAYS = 30;

async function readRegistry(home: string): Promise<AgentRegistry> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.agentsFile(home), "utf8")) as AgentRegistry;
    return raw?.sessions && typeof raw.sessions === "object" ? raw : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

/** Newest first — "newest" is how both the innermost agent and the surviving
 * name are chosen. */
function byRecency(entries: [string, SessionBinding][]): [string, SessionBinding][] {
  return [...entries].sort(([, a], [, b]) => b.boundAt.localeCompare(a.boundAt));
}

/**
 * The actor this process is ALREADY bound as, under the key `--session` would
 * claim. The caller needs it to tell its own name apart from a rival's.
 */
export async function plannedSessionActor(home: string): Promise<Actor | null> {
  const registry = await readRegistry(home);
  const session = bindKey(registry, await harnessSessions(home), await harnessVarsFor(home));
  const binding = registry.sessions[session.key];
  return binding ? { id: binding.id, name: binding.name } : null;
}

/**
 * Who this process is, when it has said so before.
 *
 * A nested agent sees its own session id AND the ids of whatever launched it,
 * so several keys can be bound at once. The newest binding wins: an agent
 * names itself when it starts, so the most recently claimed session is the
 * closest one to this process.
 */
export async function findSessionIdentity(
  home: string,
): Promise<{ actor: Actor; file: string; harness: string } | null> {
  const present = await harnessSessions(home);
  if (present.length === 0) return null;
  const { sessions } = await readRegistry(home);
  const bound = present.flatMap((s) => {
    const entry = sessions[s.key];
    return entry ? ([[s.key, entry]] as [string, SessionBinding][]) : [];
  });
  const [newest] = byRecency(bound);
  if (!newest) return null;
  const [, binding] = newest;
  return {
    actor: { id: binding.id, name: binding.name },
    file: paths.agentsFile(home),
    harness: binding.harness,
  };
}

/**
 * The session to claim. An unclaimed one first: a nested agent inherits the
 * variables of the agent that launched it, and that one has already taken its
 * own key — so the key still free is this process's own.
 */
function bindKey(registry: AgentRegistry, present: HarnessSession[], looked: string[]) {
  if (present.length === 0) {
    throw new Error(
      "no harness session in the environment — `--session` names the agent running this " +
        `command, and nothing here says which one that is (looked for ${looked.join(", ")}). ` +
        "Export ISOCAN_SESSION_ID yourself, or add your harness's variable to config.json as " +
        '`{"harnessVars": {"<name>": "<VAR>"}}`, or use `--here` to name this directory instead.',
    );
  }
  return present.find((s) => !registry.sessions[s.key]) ?? present[0]!;
}

function prune(registry: AgentRegistry): void {
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const keep = new Set<string>();
  const seen = new Set<string>();
  for (const [key, binding] of byRecency(Object.entries(registry.sessions))) {
    if (!seen.has(binding.name)) {
      seen.add(binding.name);
      keep.add(key); // the anchor for this name, however old
    }
    if (Date.parse(binding.boundAt) >= cutoff) keep.add(key);
  }
  for (const key of Object.keys(registry.sessions)) {
    if (!keep.has(key)) delete registry.sessions[key];
  }
}

/**
 * How long a claim on a name stands after it was made, when nothing can be
 * seen to be using it. Liveness is the real answer, but there is a window —
 * between naming yourself and starting a presence session — where an agent is
 * working and nothing on any canvas says so, and two agents launched together
 * pass through that window at the same moment. Recency covers it.
 */
const CLAIM_STANDS_MS = 30 * 60 * 1000;

/**
 * Name the agent running this command. Two of them in one directory get one
 * slot each, and neither touches the directory's identity or the human's.
 *
 * `live` is the actor ids with a face on some canvas right now; empty when no
 * daemon is running, which costs the check nothing it cannot do without.
 */
export async function writeSessionIdentity(
  home: string,
  name: string,
  fresh = false,
  live: ReadonlySet<string> = new Set(),
): Promise<{ actor: Actor; harness: string }> {
  const registry = await readRegistry(home);
  const session = bindKey(registry, await harnessSessions(home), await harnessVarsFor(home));
  const others = byRecency(
    Object.entries(registry.sessions).filter(([key, b]) => key !== session.key && b.name === name),
  );
  const held = others.find(
    ([, b]) => live.has(b.id) || Date.now() - Date.parse(b.boundAt) < CLAIM_STANDS_MS,
  );
  if (held && !fresh) {
    const [, binding] = held;
    throw new Error(
      `"${name}" is already another session's name here (${binding.id}, ` +
        `${live.has(binding.id) ? "on a canvas right now" : "claimed just now"}) — ` +
        `@${name} would reach both of you, and taking it would make you one actor ` +
        "wearing two faces. Pick another name, or `--new` to be a second " +
        `${name} on purpose.`,
    );
  }
  // Only a claim nobody is standing on is inherited: that is yesterday's
  // session of the same agent, and the history it made is still its own.
  const existing = fresh ? null : (registry.sessions[session.key] ?? others[0]?.[1]);
  const actor: Actor = { id: existing?.id ?? newActorId(), name };
  registry.sessions[session.key] = {
    ...actor,
    harness: session.harness,
    boundAt: new Date().toISOString(),
  };
  prune(registry);
  await fs.mkdir(path.dirname(paths.agentsFile(home)), { recursive: true });
  await fs.writeFile(paths.agentsFile(home), JSON.stringify(registry, null, 2));
  return { actor, harness: session.harness };
}

/**
 * Who this command speaks as: this agent, else the agent working here, else
 * the human — most specific first. The session slot is path-independent by
 * design, so an agent that named itself keeps its name after it wanders into
 * another directory, and two agents sharing one directory stay two people.
 */
export async function resolveIdentity(
  home: string,
  cwd: string,
): Promise<ResolvedIdentity | null> {
  const session = await findSessionIdentity(home);
  if (session)
    return {
      actor: session.actor,
      source: "session",
      file: session.file,
      harness: session.harness,
    };
  const local = await findLocalIdentity(cwd, home);
  if (local) return { actor: local.actor, source: "directory", file: local.file };
  const actor = await readIdentity(home);
  return actor ? { actor, source: "home", file: paths.identityFile(home) } : null;
}

async function write(file: string, actor: Actor): Promise<Actor> {
  const identity: IdentityFile = { ...actor, createdAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(identity, null, 2));
  return actor;
}

/** Rename in place — the actor id is the stable key, so your history stays
 * yours — unless `fresh`, which makes you a new person entirely. */
export async function writeIdentity(home: string, name: string, fresh = false): Promise<Actor> {
  const existing = fresh ? null : await readIdentity(home);
  return write(paths.identityFile(home), { id: existing?.id ?? newActorId(), name });
}

export async function writeLocalIdentity(
  dir: string,
  name: string,
  fresh = false,
): Promise<Actor> {
  const file = localIdentityFile(dir);
  const existing = fresh ? null : await readFrom(file);
  return write(file, { id: existing?.id ?? newActorId(), name });
}

/** First-run flow: prompt on a TTY, otherwise fail with instructions. */
export async function requireIdentity(home: string, cwd: string): Promise<Actor> {
  const existing = await resolveIdentity(home, cwd);
  if (existing) return existing.actor;
  if (!process.stdin.isTTY) {
    // Nothing here is interactive, so this is an agent or a script: the name
    // it needs is its own, in the directory it is working in.
    throw new Error(
      'no identity configured — run `isocan identity --name "Your Name" --session` first ' +
        "(or `--here` to name the directory rather than yourself)",
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const name = (await rl.question("Welcome to isocan! What should we call you? ")).trim();
  rl.close();
  if (!name) throw new Error("a name is required");
  const actor = await writeIdentity(home, name);
  console.error(`Hi ${actor.name} — identity saved to ${paths.identityFile(home)}`);
  return actor;
}
