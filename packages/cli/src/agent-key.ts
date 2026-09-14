import { createHmac, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ApiError, CLAIM_REFUSAL, type Actor, type ActorBindingRecord, type ActorClaimOp, type PostOpResponse } from "@isocan/core";
import { readRcAgents } from "./rc.ts";

/**
 * **Agent keys nobody else derives** (docs/projects/room/design.md, the claim
 * rule's second change; room phase 3.5).
 *
 * An enrolled agent's actor is claimed under a session key, and the same key
 * is what a summoned turn's injected environment presents, so the agent's own
 * CLI commands speak as it. The key used to be `agent:<name>`. The desk
 * resumes an actor for whoever presents the key it was claimed under (that is
 * lost-badge recovery, and it stays), and a name is visible to anyone admitted
 * to the canvas, so any badge could present `agent:Percy` with Percy's actor
 * id and become a second holder.
 *
 * Now the key is `agent:<mac>`, where `<mac>` is an HMAC-SHA256 over the
 * agent's name, keyed by a secret this machine keeps in `~/.isocan/agent-secret`
 * (mode 0600, created on first need, never printed or sent), truncated to 192
 * bits and written base64url. The same machine derives the same key every
 * time, so re-enrolling after a withdrawal, enrolling on a second canvas and a
 * re-badged machine all hand back the same actor. Another machine cannot
 * derive it. The name is not in the key: nothing reads a name out of a session
 * key (the desk reads the part before the first colon as the harness, which
 * stays `agent`), and leaving it out keeps the key opaque.
 *
 * A machine that loses this file loses its agents' keys, and gets them back
 * only through a pass (design.md, "given up, knowingly").
 */

export const AGENT_SECRET_FILE = "agent-secret";
const AGENT_HARNESS = "agent";
const PREFIX = `${AGENT_HARNESS}:`;
/** 24 bytes of the MAC: 192 bits, 32 base64url characters. */
const MAC_BYTES = 24;
const SECRET_BYTES = 32;

export const agentSecretFile = (home: string): string => path.join(home, AGENT_SECRET_FILE);

/** The key an agent's actor was claimed under before this phase. Read only to
 * find the claims that still need moving. */
export const legacyAgentKey = (name: string): string => `${PREFIX}${name}`;

/** The session half of an agent key, as `ISOCAN_SESSION_ID` carries it beside
 * `ISOCAN_HARNESS=agent`. */
export function agentSessionOf(key: string): string {
  if (!key.startsWith(PREFIX)) throw new Error(`not an agent key: ${key}`);
  return key.slice(PREFIX.length);
}

const secrets = new Map<string, Promise<Buffer>>();

function decodeSecret(file: string, text: string): Buffer {
  const secret = Buffer.from(text.trim(), "base64url");
  if (secret.length < SECRET_BYTES) {
    throw new Error(
      `${file} does not hold a usable agent secret. It is what this machine's agent keys are derived from; ` +
        "a new one would leave every agent enrolled from here unclaimable by this machine, so it is not replaced — " +
        "restore it, or move it aside and re-add the agents",
    );
  }
  return secret;
}

async function readOrCreateSecret(home: string): Promise<Buffer> {
  const file = agentSecretFile(home);
  try {
    return decodeSecret(file, await fs.readFile(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  // Created whole or not at all: written beside the name, then linked into
  // place, which fails if another process got there first. That process's
  // secret is the one kept.
  await fs.mkdir(home, { recursive: true });
  const fresh = randomBytes(SECRET_BYTES);
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}`;
  await fs.writeFile(temp, `${fresh.toString("base64url")}\n`, { mode: 0o600, flag: "wx" });
  try {
    await fs.link(temp, file);
    return fresh;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    return decodeSecret(file, await fs.readFile(file, "utf8"));
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
}

function machineSecret(home: string): Promise<Buffer> {
  let secret = secrets.get(home);
  if (!secret) {
    secret = readOrCreateSecret(home);
    secrets.set(home, secret);
    secret.catch(() => secrets.delete(home));
  }
  return secret;
}

/** The session key this machine claims `name`'s actor under. */
export async function machineAgentKey(home: string, name: string): Promise<string> {
  const mac = createHmac("sha256", await machineSecret(home))
    .update(`isocan agent key\n${name}`, "utf8")
    .digest()
    .subarray(0, MAC_BYTES)
    .toString("base64url");
  return `${PREFIX}${mac}`;
}

/** The two daemon calls the move makes. `DaemonClient` is one. */
export interface AgentKeyRoutes {
  actorBindings(keys?: string[]): Promise<ActorBindingRecord[]>;
  claimActor(op: ActorClaimOp): Promise<PostOpResponse>;
}

export interface KeysMoved {
  moved: Actor[];
  /** Claims the desk would not move, with its words and its reason
   * (`CLAIM_REFUSAL`, when the refusal carried one). */
  kept: { actor: Actor; why: string; reason?: string }[];
}

/**
 * **Move this badge's agents to machine keys.** Every claim this machine's
 * badge holds under an `agent:` key that is not the machine key for the
 * actor's name, when the key is the name's old one or the actor is in this
 * machine's rc rows, is claimed again under the machine key with `as`. The
 * desk keeps one row per actor per badge (`bindClaim` in `@isocan/core`), so
 * that claim retires the row under the old key in the same write, and a badge
 * presenting the old key afterwards no longer resumes the actor.
 *
 * Idempotent: a badge with nothing to move makes one read. `only` narrows the
 * move to one name, for an enrolment. A claim the desk refuses is left where
 * it is and reported: the actor is live on a canvas (a turn is running), was
 * claimed under the old key in the last minute, or another badge also holds
 * it under the old key. The first two pass, and the room's own claims under
 * the machine key try again at its next start and at each summons. The third
 * does not: the room meets the same refusal and says the agent is not held by
 * this machine (design.md, the claim rule, "Dual-held agents").
 */
export async function moveToMachineKeys(
  routes: AgentKeyRoutes,
  home: string,
  options: { only?: string } = {},
): Promise<KeysMoved> {
  const bindings = await routes.actorBindings();
  const result: KeysMoved = { moved: [], kept: [] };
  let rowIds: Set<string> | undefined;
  for (const binding of bindings) {
    if (!binding.key.startsWith(PREFIX) || binding.actor.name === "") continue;
    if (options.only !== undefined && binding.actor.name !== options.only && binding.key !== legacyAgentKey(options.only)) {
      continue;
    }
    const key = await machineAgentKey(home, binding.actor.name);
    if (binding.key === key) continue;
    if (binding.key !== legacyAgentKey(binding.actor.name)) {
      rowIds ??= new Set((await readRcAgents(home)).map((row) => row.actorId));
      if (!rowIds.has(binding.actor.id)) continue;
    }
    try {
      await routes.claimActor({ type: "actor.claim", sessionKey: key, as: binding.actor.id });
      result.moved.push(binding.actor);
    } catch (err) {
      const reason = err instanceof ApiError ? err.reason : undefined;
      result.kept.push({ actor: binding.actor, why: (err as Error).message, ...(reason ? { reason } : {}) });
    }
  }
  return result;
}

/** What a move says: nothing when nothing happened, otherwise one line for
 * the agents that moved and one per agent the desk would not move yet. An
 * agent another badge holds gets no line here: the room says it is not held
 * by this machine, in the words it uses for every such agent. */
export function keysMovedLines(result: KeysMoved): string[] {
  const lines: string[] = [];
  const n = result.moved.length;
  if (n > 0) {
    lines.push(
      `${n} ${n === 1 ? "agent" : "agents"} moved to this machine's own ${n === 1 ? "key" : "keys"} ` +
        `(${result.moved.map((a) => a.name).join(", ")}) — the name alone no longer claims ${n === 1 ? "it" : "them"}`,
    );
  }
  for (const { actor, why, reason } of result.kept) {
    if (reason === CLAIM_REFUSAL.heldElsewhere) continue;
    lines.push(`${actor.name} is still on the key its name derives — ${why}`);
  }
  return lines;
}
