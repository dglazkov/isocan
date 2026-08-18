import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import type { Actor, ActorClaimOp } from "@isocan/core";
import { newActorId } from "@isocan/core";
import { paths } from "@isocan/server";
import type { DaemonClient } from "./client.ts";
import { harnessSessions, harnessVarsFor } from "./harness.ts";

interface IdentityFile extends Actor {
  createdAt: string;
  // Future: an `auth` block (provider, tokens). Actor.id stays the stable key.
}

/**
 * A machine holds one person and any number of agents, and no two of them are
 * the same person.
 *
 * Two slots, most specific first. A SESSION identity is one agent, in
 * whatever directory it happens to work — and it lives in the DAEMON, not in
 * a file here: naming yourself is `actor.claim`, a mutation applied by the
 * single writer like every other mutation in isocan (#57), so two agents
 * claiming one name at the same moment serialize instead of racing. The HOME
 * identity (`~/.isocan/identity.json`) belongs to whoever owns the machine —
 * you. It is the one slot that stays a local file, because a person opening a
 * fresh terminal is the only party with no session and no transcript, and
 * their name has to work before any daemon exists.
 *
 * So an agent naming itself never renames the human, and the human's canvas
 * is never created under an agent's name. One slot per machine was the old
 * design, and the skill told agents to claim it — so the last agent to
 * introduce itself became the user. A DIRECTORY slot
 * (`<dir>/.isocan/identity.json`) came next and failed the mirrored way: a
 * directory has one identity file, so it handed its name to whoever walked in
 * next (#56). Sessions are the slot that is actually per-agent.
 */
export interface ResolvedIdentity {
  actor: Actor;
  /** "session" = this agent, whatever directory it is in. "home" = the
   * human's. */
  source: "session" | "home";
  /** Where the slot lives, for saying so. */
  file: string;
  /** The harness that named this session, when `source` is "session". */
  harness?: string;
}

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

/* ── The session slot ────────────────────────────────────────────────────
 *
 * The daemon's registry maps `<harness>:<session id>` to the actor speaking
 * through it. The id is durable across resume — every harness names the
 * CONVERSATION, not the process — so a returning agent presents the same key
 * and is handed the same actor back. There is no lookup by name anywhere:
 * that is what made a returning Kenny indistinguishable from a second Kenny.
 * An agent whose conversation is truly gone comes back deliberately, with
 * `--as <actor id>`.
 */

/**
 * Who this process is, when it has said so before. Asks the daemon —
 * starting one if none answers, since the registry lives behind the single
 * writer now — but only when a harness session is in the environment at all:
 * a bare shell resolves the home identity offline, as it always has.
 *
 * A nested agent sees its own session id AND the ids of whatever launched
 * it, so several keys can be bound at once. The newest binding wins: an
 * agent names itself when it starts, so the most recently claimed session is
 * the closest one to this process.
 */
export async function findSessionIdentity(
  client: DaemonClient,
  home: string,
): Promise<{ actor: Actor; harness: string } | null> {
  const present = await harnessSessions(home);
  if (present.length === 0) return null;
  await client.ensureDaemon();
  const bindings = await client.actorBindings(present.map((s) => s.key));
  const newest = [...bindings].sort((a, b) => b.boundAt.localeCompare(a.boundAt))[0];
  if (!newest) return null;
  const harness = present.find((s) => s.key === newest.key)?.harness ?? "unknown";
  return { actor: newest.actor, harness };
}

export interface ClaimOptions {
  /** Omitted: the daemon hands out the next free isocan name. */
  name?: string;
  /** Become a NEW actor even if the name is worn — a second Kenny on purpose. */
  fresh?: boolean;
  /** Resume an existing actor whose conversation (and session id) is gone. */
  as?: string;
}

/**
 * Name the agent running this command: send `actor.claim` to the daemon and
 * be told who you are. Everything that used to be checked here — recency
 * windows, live faces, names remembered by canvases — is the reducer's
 * business now, checked atomically at the single writer.
 *
 * The key claimed is an unclaimed one first: a nested agent inherits the
 * variables of the agent that launched it, and that one has already taken
 * its own key — so the key still free is this process's own.
 */
export async function claimSessionIdentity(
  client: DaemonClient,
  home: string,
  options: ClaimOptions = {},
): Promise<{ actor: Actor; harness: string }> {
  const present = await harnessSessions(home);
  if (present.length === 0) {
    const looked = await harnessVarsFor(home);
    throw new Error(
      "no harness session in the environment — `--session` names the agent running this " +
        `command, and nothing here says which one that is (looked for ${looked.join(", ")}). ` +
        "Export ISOCAN_SESSION_ID yourself, or add your harness's variable to config.json as " +
        '`{"harnessVars": {"<name>": "<VAR>"}}`.',
    );
  }
  await client.ensureDaemon();
  const bound = new Set((await client.actorBindings(present.map((s) => s.key))).map((b) => b.key));
  const session = present.find((s) => !bound.has(s.key)) ?? present[0]!;
  const op: ActorClaimOp = {
    type: "actor.claim",
    sessionKey: session.key,
    ...(options.name !== undefined ? { name: options.name } : {}),
    ...(options.fresh ? { fresh: true } : {}),
    ...(options.as !== undefined ? { as: options.as } : {}),
  };
  const { envelope } = await client.claimActor(op);
  return { actor: envelope.actor, harness: session.harness };
}

/**
 * Who this command speaks as: this agent, else the human. The session slot is
 * path-independent by design, so an agent that named itself keeps its name
 * after it wanders into another directory, and two agents sharing one
 * directory stay two people.
 */
export async function resolveIdentity(
  client: DaemonClient,
  home: string,
): Promise<ResolvedIdentity | null> {
  const session = await findSessionIdentity(client, home);
  if (session)
    return {
      actor: session.actor,
      source: "session",
      file: paths.actorsFile(home),
      harness: session.harness,
    };
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

/** First-run flow: prompt on a TTY, otherwise fail with instructions. */
export async function requireIdentity(client: DaemonClient, home: string): Promise<Actor> {
  const existing = await resolveIdentity(client, home);
  if (existing) return existing.actor;
  if (!process.stdin.isTTY) {
    // Nothing here is interactive, so this is an agent or a script: the name
    // it needs is its own, keyed by its session.
    throw new Error(
      'no identity configured — run `isocan identity --name "Your Name" --session` first',
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
