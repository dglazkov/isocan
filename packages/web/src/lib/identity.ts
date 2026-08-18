import type { Actor, ActorClaimOp } from "@isocan/core";
import { newId } from "@isocan/core";
import { claimActor } from "./api.ts";

const KEY = "isocan.identity";
const ROSTER_KEY = "isocan.identities";
/** A browser is not a directory of people — enough for the names you switch
 * between, not a growing archive. */
const MAX_REMEMBERED = 8;

/**
 * Who this browser is, answered by the daemon. Entering under a name issues
 * `actor.claim` — the same operation the CLI's `identity --session` sends —
 * so "coming back as a name you used before returns the SAME actor" is ONE
 * rule, applied at the single writer, instead of one implementation per
 * client over different storage (#58).
 *
 * What stays in localStorage is memory, not authority. Beside the current
 * identity sits a roster of the personas this browser has worn (#43): each
 * remembers its actor AND the session key it claims that actor with, so
 * switching back is a resume — same key, same id, same history — and never a
 * coincidence of spelling. The daemon decides whether the claim stands; the
 * roster only remembers which actors are this browser's to ask for.
 */
interface Persona extends Actor {
  /** The session key this persona claims with. Durable per browser — the
   * web's analog of a harness session id. Absent on rosters written before
   * #58; minted on the next resume. */
  key?: string;
}

export function readIdentity(): Actor | null {
  const current = parsePersona(read(KEY));
  return current ? { id: current.id, name: current.name } : null;
}

/** Everyone this browser has been, most recently used first. */
export function knownIdentities(): Actor[] {
  return personas().map(({ id, name }) => ({ id, name }));
}

/**
 * Enter under a name: the one the dialog calls. A persona this browser has
 * worn before resumes — the daemon is asked to bind its key to the same
 * actor. Anyone else is a fresh claim, which the daemon REFUSES if somebody
 * on a canvas already answers to the name (the refusal names the holder);
 * refusal surfaces as a thrown ApiError for the dialog to show.
 */
export async function enterAs(name: string): Promise<Actor> {
  const trimmed = name.trim();
  const known = personas().find((p) => sameName(p.name, trimmed));
  if (known) return resume(known);
  const key = mintKey();
  return claimInto(key, { type: "actor.claim", sessionKey: key, name: trimmed });
}

/** Same person, new label: keeps the id, so everything you have done stays
 * yours. Matches `isocan identity --name --session`, which renames the same
 * way — one rule, one writer. */
export async function renameIdentity(name: string): Promise<Actor> {
  const trimmed = name.trim();
  const current = parsePersona(read(KEY));
  if (!current) return enterAs(trimmed);
  const key = current.key ?? mintKey();
  // `as` pins the id: even if the daemon has pruned this key's binding, the
  // rename must not quietly mint a stranger.
  return claimInto(key, { type: "actor.claim", sessionKey: key, as: current.id, name: trimmed });
}

/** Become someone this browser already knows. */
export async function adoptIdentity(actor: Actor): Promise<Actor> {
  const known = personas().find((p) => p.id === actor.id);
  return resume(known ?? { ...actor });
}

/**
 * Step out. The roster survives — leaving is not forgetting — so the dialog
 * can offer the way back in.
 */
export function signOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Private mode: the identity was never durable to begin with.
  }
}

/** Resume a persona: same key, same actor. `as` + `name` make the claim
 * whole even when the daemon no longer remembers the binding. */
function resume(persona: Persona): Promise<Actor> {
  const key = persona.key ?? mintKey();
  return claimInto(key, {
    type: "actor.claim",
    sessionKey: key,
    as: persona.id,
    name: persona.name,
  });
}

async function claimInto(key: string, op: ActorClaimOp): Promise<Actor> {
  const { envelope } = await claimActor(op);
  return become({ id: envelope.actor.id, name: envelope.actor.name, key });
}

function personas(): Persona[] {
  const raw = read(ROSTER_KEY);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const roster: Persona[] = [];
  for (const entry of raw) {
    const persona = parsePersona(entry);
    if (!persona || seen.has(persona.id)) continue;
    seen.add(persona.id);
    roster.push(persona);
  }
  return roster.slice(0, MAX_REMEMBERED);
}

function become(persona: Persona): Actor {
  const roster = [persona, ...personas().filter((known) => known.id !== persona.id)];
  write(KEY, persona);
  write(ROSTER_KEY, roster.slice(0, MAX_REMEMBERED));
  return { id: persona.id, name: persona.name };
}

const mintKey = (): string => `web:${newId("per").slice(4)}`;

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function parsePersona(value: unknown): Persona | null {
  if (!value || typeof value !== "object") return null;
  const { id, name, key } = value as Partial<Persona>;
  if (typeof id !== "string" || typeof name !== "string" || !id || !name) return null;
  return { id, name, ...(typeof key === "string" && key ? { key } : {}) };
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota: this session still works, it just won't be
    // remembered — better than refusing to let anyone in.
  }
}
