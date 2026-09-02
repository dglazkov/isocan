import type { Actor, ActorClaimOp } from "@isocan/core";
import { newId } from "@isocan/core";
import { claimActor, sendOp } from "./api.ts";

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

/**
 * The canvas in the address bar — the room a browser is naming itself in.
 *
 * The identity dialog is shown BEFORE the router mounts and before anything
 * is fetched, so a fresh browser landing on a canvas link has a badge that
 * has not been anywhere. Sending the canvas is what lets the home judge the
 * name against the roster that is actually about to see it (mechanism 10);
 * without it, a second Kenny walks straight in beside the first.
 */
function canvasInUrl(): string | undefined {
  try {
    return /^\/p\/([^/?#]+)/.exec(location.pathname)?.[1];
  } catch {
    return undefined; // no document (tests, a worker) — no room to name
  }
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
 * **Fold one persona into another** (`actor.join`, multi-identity phase 5) —
 * journey 6's last step. The same op the CLI's `identity --join` sends,
 * home-scoped like a colour: the registry records that `from` is `into` now,
 * every reader resolves the old id through it, and nothing in the log is
 * rewritten. The home refuses it unless this badge speaks for both, which is
 * why the menu only offers it for a persona the badge claims.
 *
 * On success the folded persona leaves this browser's roster: it answers to
 * nobody now, so "Switch to" it would be switching to an actor the home
 * shows as `into` anyway.
 */
export async function foldIdentity(from: Actor, into: Actor): Promise<void> {
  await sendOp(null, into, { type: "actor.join", from: from.id, into: into.id });
  forgetIdentity(from.id);
}

/** Drop a persona from the roster this browser remembers. */
function forgetIdentity(actorId: string): void {
  write(
    ROSTER_KEY,
    personas().filter((known) => known.id !== actorId),
  );
}

/**
 * Claim again what this browser is already wearing.
 *
 * The recovery path: the badge behind the cookie was replaced (cleared site
 * data, a wiped home, phase 9's kill-a-badge), so the home no longer knows
 * this tab speaks for its persona — while the tab goes on asserting it. A
 * resume is exactly the right shape, and it is the same one the roster uses:
 * same key, same actor, and `as` pins the id so recovery cannot quietly mint
 * a stranger.
 *
 * Nothing to do for a browser that has not entered under a name: it has no
 * persona to lose, and the identity dialog is the next thing it sees.
 */
export async function reclaimIdentity(): Promise<void> {
  const current = parsePersona(read(KEY));
  if (!current) return;
  await resume(current);
}

/**
 * **The person a pass handed this tab** — Scene 5's arrival, and the browser's
 * half of an obligation the CLI's `setup` meets by writing `identity.json`.
 *
 * The endowed identity is announced EXACTLY ONCE, in the redemption response.
 * A handed claim carries no session key on purpose (`bindHandoff`), and
 * `GET /api/actors` answers by session key — so nothing can ever ask again. A
 * tab that read that response and moved on would have stranded a person in
 * their own browser, one reload from being a stranger on their own canvas.
 *
 * **No claim goes out, and that is the point.** The badge behind this tab's
 * cookie already holds the row; mechanism 5's check is `claimsActor`, which
 * asks about the badge and never about the key, so every op this tab writes as
 * this actor is already permitted. Sending `actor.claim` here would be the tab
 * ASSERTING an identity it was HANDED — the one gesture `reincarnate` refuses
 * while somebody is visibly wearing the name, which at the moment of
 * redemption is always: the tab that minted the pass is open on the canvas.
 * The key gets bound the first time this browser does something that needs one
 * (a rename, a resume after the badge is replaced), where `as` is accepted
 * precisely because the keyless row is there.
 *
 * **It overwrites whoever this browser was, and the CLI deliberately does not.**
 * `setup` refuses to make a pasted command rename the human who owns a laptop,
 * because `identity.json` is that machine's one durable answer with nothing
 * behind it. A browser has a roster: the persona being displaced is still in
 * "Switch to", one click away, and the tab was opened by a link that says who
 * it is for. Refusing here would burn a single-use pass and leave the person
 * looking at somebody else's face, which is the opposite of what they clicked.
 */
export function adoptHandedIdentity(actor: Actor): Actor {
  return become({ id: actor.id, name: actor.name });
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
  const from = canvasInUrl();
  const { envelope } = await claimActor(from ? { ...op, canvasId: from } : op);
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
