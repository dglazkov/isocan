import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import type { Actor, ActorBindingRecord, ActorClaimOp } from "@isocan/core";
import { elapsedLabel, newActorId } from "@isocan/core";
import { paths } from "@isocan/server";
import { ApiError, type DaemonClient } from "./client.ts";
import { harnessSessions, harnessVarsFor } from "./harness.ts";

interface IdentityFile extends Actor {
  createdAt: string;
  /** The badges this machine holds, keyed by home address — filled in by
   * `DaemonClient`, which owns the door. Actor.id stays the stable key.
   *
   * Two things live in one file now, and they are not the same thing: the
   * human's name, and the MACHINE's credential. That is deliberate rather
   * than crowded — one badge per client home directory (per `~/.isocan`),
   * vouching for the person and every agent on the machine, so the
   * credential belongs beside the machine's person. It also means an
   * agent-only machine writes this file with no name in it; `readFrom`
   * returns null without `id`/`name`, so nothing mis-resolves. */
  auth?: Record<string, { badgeId: string; secret: string; at: string }>;
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
  /** The session key this actor is claimed under — the harness conversation's
   * for an agent, the home slot's for the human. What a re-claim presents. */
  key: string;
}

/**
 * The session key the HUMAN's actor is claimed under.
 *
 * `~/.isocan/identity.json` is a local file, and until mechanism 5 it was
 * ASSERTED in every request body and claimed by nothing — so the moment the
 * membership check went live it would have been refused with
 * `not-your-actor`, for every solo human on every machine, at once. The fix
 * is not to grandfather asserted actors (that hole never closes); it is to
 * make the human's actor a real claim on the machine's badge, minted the
 * first time that machine speaks for them.
 *
 * It is a key like any other, so everything downstream already works: one
 * actor per key per badge, `whoami` can find it, and a rename is the same
 * rename an agent does. The prefix cannot collide with a harness key —
 * `harnessSessions` builds `<harness>:<conversation id>`, and no harness is
 * called "home".
 */
export const HOME_CLAIM_KEY = "home:person";

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
): Promise<{ actor: Actor; harness: string; key: string } | null> {
  const present = await harnessSessions(home);
  if (present.length === 0) return null;
  await client.ensureDaemon();
  const bindings = await legacyTolerant(client.actorBindings(present.map((s) => s.key)));
  if (!bindings) return null;
  const newest = [...bindings].sort((a, b) => b.boundAt.localeCompare(a.boundAt))[0];
  if (!newest) return null;
  const harness = present.find((s) => s.key === newest.key)?.harness ?? "unknown";
  return { actor: newest.actor, harness, key: newest.key };
}

export interface ClaimOptions {
  /** Omitted: the daemon hands out the next free isocan name. */
  name?: string;
  /** Become a NEW actor even if the name is worn — a second Kenny on purpose. */
  fresh?: boolean;
  /** Resume an existing actor whose conversation (and session id) is gone. */
  as?: string;
  /** The canvas of the directory the claim is made from, when it is already
   * bound (#60) — recorded on the binding as informational scope. */
  projectId?: string;
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
  const bindings = await legacyTolerant(client.actorBindings(present.map((s) => s.key)));
  if (!bindings) {
    throw new Error(
      "the running daemon predates actor.claim and cannot name anyone — `isocan restart` " +
        "brings up this build's, then try again",
    );
  }
  const bound = new Set(bindings.map((b) => b.key));
  const session = present.find((s) => !bound.has(s.key)) ?? present[0]!;
  const op: ActorClaimOp = {
    type: "actor.claim",
    sessionKey: session.key,
    ...(options.name !== undefined ? { name: options.name } : {}),
    ...(options.fresh ? { fresh: true } : {}),
    ...(options.as !== undefined ? { as: options.as } : {}),
    ...(options.projectId !== undefined ? { projectId: options.projectId } : {}),
  };
  const { envelope } = await client.claimActor(op);
  return { actor: envelope.actor, harness: session.harness };
}

/**
 * GET /api/actors, asked of whatever daemon is running. A daemon from before
 * #57 has no such route — and no 404 either: its SPA fallback answers 200
 * with index.html for any unmatched GET, which parses to null. Either shape
 * means "this daemon has no registry", answered as null so the caller can
 * degrade while `warnIfStale` tells the user to restart.
 */
async function legacyTolerant<T>(request: Promise<T>): Promise<T | null> {
  try {
    const result = await request;
    return Array.isArray(result) ? result : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Why there is no identity here — the truthful version.
 *
 * "No identity configured" is right for a home nobody has ever named
 * themselves in, and WRONG for the case that actually happens: this machine's
 * badge was lost or wiped (a cleared `auth` block, a re-badged client, a home
 * that forgot), so the claims are still on the desk but on a badge nobody
 * holds. The identity IS configured; it is just not reachable from here. The
 * old message named neither the cause nor the way out, and pointed at
 * `--name`, which would mint a STRANGER and strand the history — the precise
 * mistake `--as` exists to prevent.
 *
 * Asked only about session keys this process already presents, so the answer
 * can only ever be "the conversation you are in belongs to that actor". A
 * message that listed the home's actors would be handing out a roster to
 * impersonate.
 *
 * Nothing is adopted. Coming back stays a deliberate act — `--as` — because a
 * badge that silently inherited whatever a session key pointed at would become
 * "anyone who learns a session key can take that actor" the moment claims
 * carry authorization.
 */
export async function noIdentityHere(client: DaemonClient, home: string): Promise<string> {
  const blank = 'no identity configured — run `isocan identity --name "Your Name" --session` first';
  let orphaned: ActorBindingRecord[];
  try {
    const present = await harnessSessions(home);
    if (present.length === 0) return blank;
    orphaned = (await client.orphanedActors(present.map((session) => session.key))) ?? [];
  } catch {
    return blank; // a daemon that cannot answer is not a reason to say nothing
  }
  const mine = orphaned[0];
  if (!mine) return blank;
  const badgeId = await client.badgeId();
  return (
    `no identity here — this machine's badge (${badgeId ?? "none"}) holds no claims, but ` +
    `this home has an actor on another badge: ${mine.actor.name} (${mine.actor.id}), ` +
    `named ${elapsedLabel(mine.boundAt, new Date().toISOString())} ago. That is this ` +
    `conversation's own session key, so if it is you, ` +
    `come back with \`isocan identity --session --as ${mine.actor.id}\` — ` +
    "`--name` would make you somebody new and leave your history behind."
  );
}

/**
 * The directory identity files the deleted slot left behind (#56, #59). One
 * may be sitting in any checkout an agent ever named itself in — this repo
 * had the Kenny that caused #55. It no longer speaks for anyone, but it is
 * also the only local record of which actor id made that directory's
 * history, so it is renamed aside rather than deleted, with a one-time
 * notice saying what it was and the deliberate way back (`--as`).
 */
export async function retireStrandedIdentities(cwd: string, home: string): Promise<void> {
  const isocanHome = path.resolve(home);
  const userHome = path.resolve(os.homedir());
  let dir = path.resolve(cwd);
  for (;;) {
    if (dir !== userHome && path.join(dir, ".isocan") !== isocanHome) {
      const file = path.join(dir, ".isocan", "identity.json");
      const stranded = await readFrom(file);
      if (stranded) {
        try {
          await fs.rename(file, `${file}.retired`);
          console.error(
            `note: ${file} held a directory identity — "${stranded.name}" ` +
              `(${stranded.id}). A directory cannot tell one agent from another, so it no ` +
              `longer speaks for anyone; the file was renamed aside to keep the record. ` +
              `To be that actor again on purpose: isocan identity --as ${stranded.id} ` +
              `--name "${stranded.name}"`,
          );
        } catch {
          // Read-only checkout: leave it be. It resolves to nobody either way.
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return;
    dir = parent;
  }
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
  const resolved: ResolvedIdentity | null = session
    ? {
        actor: session.actor,
        source: "session",
        file: paths.actorsFile(home),
        harness: session.harness,
        key: session.key,
      }
    : await readIdentity(home).then((actor) =>
        actor
          ? ({
              actor,
              source: "home",
              file: paths.identityFile(home),
              key: HOME_CLAIM_KEY,
            } as const)
          : null,
      );
  // Knowing who you are is knowing how to prove it: every caller that
  // resolves an identity gets the recovery wired, so no command has to
  // remember to. Registration only — nothing is sent until the home asks.
  if (resolved) client.reclaimWith(() => reclaimIdentity(client, resolved));
  return resolved;
}

/**
 * Claim the actor this command speaks as — landmine one and landmine two,
 * both defused by one act.
 *
 * The home identity is a local file that nothing ever claimed, so the first
 * time a machine speaks for its person the home refuses with
 * `not-your-actor`; a badge replaced at the door holds no claims at all, so
 * the first act after any recovery is refused the same way. Both are answered
 * by claiming, and `DaemonClient` calls this on exactly those two refusals —
 * which is why it costs nothing at all on the commands that do not need it,
 * and one invisible round trip on the ones that do.
 *
 * `as` + the name is the right instrument and not a loophole. It is the same
 * claim a browser persona sends to resume itself, and it is still judged:
 * refused while the actor is visibly somebody else, refused if the name now
 * answers to another actor this badge can see. What it does NOT do is mint
 * anybody — the id in the file is the id that lands on the badge, so an
 * upgraded human keeps their history instead of quietly becoming new. And a
 * same-key claim on a dead badge never trips the claim-stands window, because
 * `reincarnate` excludes the caller's own session key.
 */
export async function reclaimIdentity(
  client: DaemonClient,
  identity: { actor: Actor; key: string },
): Promise<void> {
  await client.claimActor({
    type: "actor.claim",
    sessionKey: identity.key,
    as: identity.actor.id,
    name: identity.actor.name,
  });
}

/** Read-merge, never clobber. The file holds the badge too now, and a write
 * that rebuilt it from the actor alone would delete the machine's credential
 * every time somebody renamed themselves. */
async function write(file: string, actor: Actor): Promise<Actor> {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    // No file yet, or unreadable — the write below makes one.
  }
  const identity: IdentityFile = {
    ...(current as Partial<IdentityFile>),
    ...actor,
    createdAt: new Date().toISOString(),
  };
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
    // it needs is its own, keyed by its session — unless its badge was lost,
    // in which case it has one already and needs telling.
    throw new Error(await noIdentityHere(client, home));
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const name = (await rl.question("Welcome to isocan! What should we call you? ")).trim();
  rl.close();
  if (!name) throw new Error("a name is required");
  const actor = await writeIdentity(home, name);
  console.error(`Hi ${actor.name} — identity saved to ${paths.identityFile(home)}`);
  return actor;
}
