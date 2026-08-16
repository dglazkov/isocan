import type { Actor } from "@isocan/core";
import { newActorId } from "@isocan/core";

const KEY = "isocan.identity";
const ROSTER_KEY = "isocan.identities";
/** A browser is not a directory of people — enough for the names you switch
 * between, not a growing archive. */
const MAX_REMEMBERED = 8;

/**
 * Web identity lives in localStorage; the CLI's lives in ~/.isocan. Two
 * personas per machine is honest for v1; authenticated identity later only
 * changes how an Actor is minted.
 *
 * Beside the current identity sits a roster of the ones this browser has
 * worn (#43). It exists because `Actor.id`, not the name, is what the canvas
 * remembers: your undo stack, your mentions, and the color of your cursor all
 * hang off it. So leaving and coming back as a name you used before has to
 * return you to the SAME actor, not a stranger who happens to share a name.
 */
export function readIdentity(): Actor | null {
  return parseActor(read(KEY));
}

/** Everyone this browser has been, most recently used first. */
export function knownIdentities(): Actor[] {
  const raw = read(ROSTER_KEY);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const roster: Actor[] = [];
  for (const entry of raw) {
    const actor = parseActor(entry);
    if (!actor || seen.has(actor.id)) continue;
    seen.add(actor.id);
    roster.push(actor);
  }
  return roster.slice(0, MAX_REMEMBERED);
}

/**
 * Enter under a name: the one the dialog calls. A name this browser has worn
 * before resumes that identity — same id, same history — rather than minting
 * a stranger. Anyone else is new.
 */
export function enterAs(name: string): Actor {
  const trimmed = name.trim();
  const known = knownIdentities().find((actor) => sameName(actor.name, trimmed));
  return become(known ?? { id: newActorId(), name: trimmed });
}

/** Same person, new label: keeps the id, so everything you have done stays
 * yours. Matches `isocan identity --name`, which also renames in place. */
export function renameIdentity(name: string): Actor {
  const current = readIdentity();
  const trimmed = name.trim();
  return become(current ? { ...current, name: trimmed } : { id: newActorId(), name: trimmed });
}

/** Become someone this browser already knows. */
export function adoptIdentity(actor: Actor): Actor {
  return become(actor);
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

function become(actor: Actor): Actor {
  const roster = [actor, ...knownIdentities().filter((known) => known.id !== actor.id)];
  write(KEY, actor);
  write(ROSTER_KEY, roster.slice(0, MAX_REMEMBERED));
  return actor;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function parseActor(value: unknown): Actor | null {
  if (!value || typeof value !== "object") return null;
  const { id, name } = value as Partial<Actor>;
  return typeof id === "string" && typeof name === "string" && id && name ? { id, name } : null;
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
