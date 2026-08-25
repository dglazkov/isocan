import type { Actor } from "./model.ts";
import type { Operation } from "./ops.ts";
import type { ActorClaim } from "./badge.ts";
import { OpValidationError } from "./errors.ts";
import { newActorId } from "./ids.ts";
import { type ActorColors, type ActorNames, isIdentityColor } from "./identity.ts";

export type ActorClaimOp = Extract<Operation, { type: "actor.claim" }>;
export type ActorSetColorOp = Extract<Operation, { type: "actor.setColor" }>;

/**
 * The actor registry: who everyone is, and who may speak as them. Identity
 * used to be the one mutation that never became an operation — four stores,
 * no single writer, and two clients re-implementing the same continuity rule
 * over different storage (#55). `actor.claim` moved it here: claims serialize
 * at the single writer, and the registry's history is an oplog like
 * everything else's.
 *
 * The registry has TWO HALVES, and this file only holds one of them. That
 * split is the two-ledger rule made mechanical, and it is not cosmetic:
 *
 * - The PUBLIC face — ids, the name each one goes by now, chosen colors — is
 *   canvas state. It is `ActorRegistry`, it lives in the `Store`, it
 *   replicates, and it REPLAYS: `bindName` reconstructs it from the actors
 *   oplog alone.
 * - The PRIVATE half — the claims table, which badge may speak as which
 *   actor — is desk state (`ActorClaim`, in `badge.ts`). It lives behind the
 *   desk, it never replicates, and it is written DIRECTLY rather than
 *   replayed. It has to be: claims key on badge ids, and badge ids stay out
 *   of the oplog, so the claims table is not reconstructible from the log at
 *   all. Two ledgers, two writes — it falls out rather than being imposed.
 *
 * There is no lookup by name anywhere in this file. A resuming agent presents
 * the SAME session key under the same badge — harnesses name conversations,
 * not processes, so the key survives resume — and is handed the same actor
 * back. Name-based resumption is what made a returning Kenny
 * indistinguishable from a second Kenny; the deliberate way back for an agent
 * whose conversation is truly gone is `as`, which is reincarnation, not a
 * coincidence of spelling.
 *
 * Trust: the home knows WHO IS ASKING (a badge it minted), and — as of
 * mechanism 5 — whether the actor a request names is one that badge claims.
 * That check is `claimsActor` below: one line, run by the engine inside the
 * single-writer chain, and deliberately desk-blind. Nothing in this file has
 * ever heard of a badge record; it is handed claim ROWS and judges actors.
 */

/** The name one actor goes by now, and when they took it. */
export interface ActorNameRow {
  name: string;
  /** The claim that set this name. Recency lives here rather than being
   * scanned out of the claims, which is what makes a name outlive the
   * session that took it. */
  at: string;
}

/** Actor id → the name they go by now. */
export type ActorNamesRegistry = Record<string, ActorNameRow>;

export interface ActorRegistry {
  /**
   * The name each actor goes by now, keyed by ACTOR id.
   *
   * Stored rather than derived from the claims, and that is a bug fix as much
   * as a re-key: a name used to live only on a claim row, so an actor whose
   * claim went away silently reverted to whatever name was stamped on each
   * op — "Dion 2" still talking in a thread after Dion 2 became Di, which is
   * the exact failure the registry exists to prevent. A name is the actor's,
   * the way a color already was.
   */
  names: ActorNamesRegistry;
  /** Chosen identity colors, keyed by ACTOR id — deliberately not by session
   * key and not on the Actor itself: an Actor is stamped onto every op and
   * every comment, and a color that rode along would be a thousand copies of
   * a preference, each frozen at the moment it was written. Here it is one
   * row that answers for all of them, past and future. */
  colors: ActorColors;
}

export const emptyActorRegistry = (): ActorRegistry => ({ names: {}, colors: {} });

/** A claim row as served over the API — to the badge that holds it, and to
 * nobody else. `key` is the claim's `sessionKey`: a client's own index into
 * its own badge's claims, which is all it ever was for a client. */
export interface ActorBindingRecord {
  key: string;
  actor: Actor;
  boundAt: string;
  /** See ActorClaim.canvasId. */
  canvasId?: string;
}

/** Somebody a canvas answers to. Not only the faces on it right now: an
 * @-mention reaches a name that was used once and put down, so a name stays
 * taken after its wearer goes quiet. */
export interface NameHolder {
  actor: Actor;
  /** Canvas title, for saying where. */
  canvas: string;
  /** Wearing it at this moment, rather than remembered from the history. */
  live: boolean;
}

/**
 * **A name that starts the way your harness does.**
 *
 * Three agents called Isaac, Kenny and Nico tell a person nothing about which
 * is which, and the person is the one who has to @-mention the right one. A
 * Claude that comes up as Charlie is legible at a glance.
 *
 * **The initial only, and never the vendor's own name.** `--agent-help` is
 * emphatic that an agent needs a name of its own — "Claude", "GPT" and
 * "Gemini" are all wrong, and any harness must be able to run that guide. A
 * shared first letter is a hint; the name is still the agent's. The cost is
 * real and worth naming: after a week "Charlie" does read as "the Claude one",
 * which is a little of the coupling that rule exists to prevent. Taken
 * deliberately, because the legibility is worth more at three agents on a
 * canvas than the purity is.
 *
 * **Two harnesses can share a letter, and one letter can hold two agents.**
 * `claude-code` and `codex` both start with C, and two Claudes are ordinary.
 * Both fall out of the same rule rather than needing one of their own: the
 * roster is drawn in order and skips what is taken, so the second C agent is
 * Cass, not "Charlie 2". When a letter's three are gone, allocation falls
 * through to the isocan roster below, which is also where an unknown harness —
 * or no harness at all — starts.
 */
const INITIAL_NAMES: Readonly<Record<string, readonly string[]>> = {
  a: ["Ada", "Arlo", "Anya", "Amos", "Aziz", "Alba", "Ansel", "Ari"],
  b: ["Bo", "Bram", "Bea", "Bodhi", "Basil", "Bex", "Boaz", "Bree"],
  c: ["Charlie", "Cass", "Cleo", "Cyrus", "Coral", "Caleb", "Cato", "Ciri"],
  d: ["Dara", "Dov", "Della", "Dex", "Duna", "Dmitri", "Dot", "Devi"],
  e: ["Esme", "Ewan", "Elu", "Ezra", "Effie", "Enzo", "Eira", "Emrys"],
  f: ["Fen", "Faye", "Flor", "Felix", "Fiora", "Fitz", "Freya", "Fox"],
  g: ["Gina", "Gus", "Gale", "Greta", "Gideon", "Goro", "Gwen", "Gil"],
  h: ["Hana", "Hugo", "Hale", "Hester", "Hiro", "Hopper", "Hedy", "Halcyon"],
  i: ["Ines", "Ivo", "Isla", "Idris", "Ilse", "Iggy", "Ione", "Ilya"],
  j: ["Juno", "Jai", "Jess", "Jonah", "Jade", "Joss", "Juniper", "Jules"],
  k: ["Kit", "Kai", "Kira", "Knox", "Kesh", "Kova", "Kaya", "Kepler"],
  l: ["Lore", "Luca", "Liv", "Lyra", "Linus", "Lark", "Leif", "Lumen"],
  m: ["Mira", "Milo", "Mae", "Marlow", "Mika", "Moss", "Maren", "Mordecai"],
  n: ["Noor", "Nils", "Nell", "Nova", "Nyx", "Nero", "Nadia", "Niko"],
  o: ["Orin", "Ola", "Odie", "Otis", "Oona", "Osric", "Opal", "Oren"],
  p: ["Pip", "Pax", "Posy", "Perrin", "Piper", "Prue", "Pascal", "Poe"],
  q: ["Quinn", "Quill", "Qi", "Quest", "Quenna", "Quade", "Qadir", "Quincy"],
  r: ["Remy", "Rue", "Ro", "Rowan", "Rex", "Reva", "Rafi", "Ridley"],
  s: ["Sage", "Soren", "Sol", "Sable", "Sunny", "Sasha", "Sig", "Selah"],
  t: ["Tess", "Thea", "Toma", "Tobin", "Tully", "Tarek", "Tamsin", "Tycho"],
  u: ["Uma", "Uri", "Udo", "Ulla", "Umber", "Unwin", "Ursa", "Usha"],
  v: ["Vera", "Vik", "Vale", "Vesper", "Vida", "Volt", "Verity", "Viggo"],
  w: ["Wren", "Wes", "Willa", "Wilder", "Wynn", "Wade", "Wanda", "Wolfe"],
  x: ["Xan", "Xia", "Xola", "Xeno", "Ximena", "Xerxes", "Xanthe", "Xu"],
  y: ["Yuki", "Yael", "Yann", "Yara", "Yves", "Yusuf", "Yorick", "Yumi"],
  z: ["Zia", "Zed", "Zoe", "Zane", "Zora", "Zeph", "Zuri", "Zamir"],
};

/**
 * The harness that named this session, out of the session key.
 *
 * Keys are `<harness>:<session id>` (`ops.ts`), so this needs no new field on
 * the op and no round trip — every replica replaying the same claim sees the
 * same key and derives the same letter, which is what keeps allocation
 * deterministic on both surfaces.
 */
/**
 * A stable 32-bit hash of a string — FNV-1a, in six lines and no dependency.
 *
 * Used to pick WHERE in a roster allocation starts, so that two agents who
 * cannot see each other do not both reach for the same first name. It has to
 * be a hash rather than `Math.random()` for two separate reasons:
 *
 * - **Same claimant, same answer.** A session that re-claims in a scope where
 *   its name is free gets the name it had, rather than a new one each time.
 * - **The suite stays honest.** A test that asserts a name is asserting
 *   something real; with a random pick it would be asserting the weather.
 *
 * Randomness would in fact have been *safe* here, which is worth writing down
 * because it is not obvious: an allocated name is stamped into the claim's
 * envelope and replay re-binds it from that stamp (`file-store.ts` calls
 * `bindName(registry, { actor: entry.envelope.actor })`, never `applyClaim`).
 * Allocation runs once, on the writer. Determinism is a convenience here, not
 * a correctness requirement — the opposite of the reducer, where it is the
 * whole game.
 */
function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A roster walked from a hashed starting point, wrapping — so the first free
 * name is *a* name rather than always the same one.
 *
 * In-order allocation meant the first Claude on every canvas anywhere was
 * Charlie, every demo and every screenshot. Worse where it counts: two scopes
 * that cannot see each other both reach for the head of the list, which is
 * precisely the collision `ClaimContext.preferred` exists to paper over.
 * Starting at a different index per claimant makes independent collisions
 * unlikely rather than certain, and costs nothing — a scope that CAN see a
 * name still skips it, exactly as before.
 */
function firstFree(roster: readonly string[], taken: Set<string>, seed: string): string | null {
  const start = roster.length > 0 ? hashOf(seed) % roster.length : 0;
  for (let i = 0; i < roster.length; i++) {
    const name = roster[(start + i) % roster.length]!;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return null;
}

export function harnessOf(sessionKey: string | undefined): string | null {
  const harness = sessionKey?.split(":")[0]?.trim();
  return harness ? harness : null;
}

/** Names hiding in the letters of "isocan" — where allocation starts when the
 * harness is unknown, and where it lands when a letter's names run out. */
export const ISOCAN_NAMES = [
  "Isaac",
  "Kenny",
  "Nico",
  "Sonia",
  "Iona",
  "Osian",
  "Isao",
  "Cana",
] as const;

/**
 * Where a replica asks its home for a name that is free THERE — the one
 * question about a shared namespace that a replica cannot answer for itself.
 *
 * A route constant rather than a literal in two files, for the same reason
 * `DOOR_ROUTE` is one: the caller and the answerer live in different modules,
 * and two spellings of one path is a divergence waiting to happen.
 */
export const FREE_NAME_ROUTE = "/api/actors/free-name";

/** The answer: one name, free in the asking badge's scope. Deliberately one
 * name and not the taken set — see the route in `http.ts`. */
export interface FreeNameResponse {
  name: string;
}

/**
 * How long a claim stands as proof its owner is alive, when no face on any
 * canvas says so. Presence is the real answer, but there is a window between
 * claiming a name and starting a session where an agent is working invisibly
 * — `as` must not be able to steal an actor through it.
 */
const CLAIM_STANDS_MS = 30 * 60 * 1000;

export interface ClaimContext {
  registry: ActorRegistry;
  /**
   * The presenting badge's own claims. Its rows are what "mine" means: a
   * session key found here is this holder resuming itself.
   */
  own: readonly ActorClaim[];
  /**
   * The pre-badge shelf row for THIS claim's session key, if the one-time
   * migration left one. Counts as "mine" exactly once; adopting it is the
   * caller's job (see `ClaimResult.adopted`).
   */
  shelved?: ActorClaim;
  /**
   * Every claim a NAME may be judged against — mechanism 10's narrowing.
   * The presenting badge's own rows, the rows of badges admitted where this
   * one is admitted, and the migration shelf. NOT the whole home: name
   * uniqueness exists so `@`-mentions resolve and the facepile reads, which
   * are roster needs, so the question is asked of exactly the rosters this
   * badge can see. Two strangers on unrelated canvases can both have an
   * Isaac, and neither ever hears about the other.
   *
   * The solo home degenerates correctly: a local daemon's badge is admitted
   * to the canvases it works on, so this is the whole table again — the same
   * code, with the scope emerging from the badge rather than hard-coded.
   */
  scoped: readonly ActorClaim[];
  /**
   * Every claim on the actor `as` names, from ANYWHERE on the desk. Actor ids
   * are global and never recycled (mechanism 10), so "is somebody already
   * this actor" is a global question even though "is this name taken" is not
   * — otherwise a stranger could reincarnate a live actor merely by being
   * admitted somewhere else.
   */
  claimants: readonly ActorClaim[];
  /**
   * **Does a badge that is NOT this one already speak as the actor `as` names,
   * under a key this claimant is not presenting?** — gathered, never derived
   * here.
   *
   * It is a boolean rather than the rows themselves because this file has
   * never heard of a badge and must not start: the reducer judges actors, the
   * gathering knows who is holding what (`Engine.claimContext`). What the
   * boolean buys is the tightening mechanism 6 asks for — see `admit`, where
   * "resuming somebody who is already somebody needs a vouch" replaces
   * "resuming somebody who is *visibly* somebody needs a vouch".
   */
  heldElsewhere?: boolean;
  /**
   * **The attribute that vouches for `as`** — the second satisfier of
   * resumption's one rule (mechanism 6), or absent when nothing does.
   *
   * A string and not a badge, for `heldElsewhere`'s reason: what the reducer
   * needs to know is that somebody who is already this actor has proved the
   * same thing this claimant has proved — `email:jordan@acme.test`, held by
   * her laptop and now by her phone. Who holds it is the gathering's business.
   *
   * It is carried rather than collapsed into a boolean because a refusal and
   * an audit both want to name it, and because a vouch nobody can name is the
   * kind of authorization that is impossible to review.
   */
  vouchedBy?: string;
  /** Everyone the canvases IN SCOPE answer to — live faces AND names
   * remembered from history, the same set an @-mention resolves against.
   * Scoped to the claiming badge's admissions, for mechanism 10's reason. */
  held: readonly NameHolder[];
  /**
   * A name the AUTHORITY over this namespace has already picked out as free —
   * the home's answer, when this daemon is a replica and the claimant supplied
   * no name of their own. Absent on a home, which IS the authority, and absent
   * whenever a name was supplied: an explicit name is judged, never allocated.
   *
   * It exists because a replica and its home ask "is this name taken" in
   * DIFFERENT SCOPES, and both are right. Scope is the presenting badge's
   * admissions (mechanism 10), and a fresh replica's local badge has none —
   * so every roster name looks free to it, while the home judges the very same
   * name against the rosters that badge can see THERE and refuses. Two scopes,
   * one name. Allocation is the only place that mismatch is worth closing: an
   * allocated name is a question about a shared namespace, and on a replica
   * the home owns the namespace. See `Engine.claim` for why a CLAIM still does
   * not forward.
   *
   * A preference and not an instruction: it is checked against the local scope
   * below like any other candidate, and skipped if it is taken here.
   */
  preferred?: string;
  /** The envelope timestamp — claims are pure; the caller owns the clock. */
  now: string;
  /** Injectable for tests. */
  mintId?: () => string;
}

export interface ClaimResult {
  /** The public half, replayable — what the store persists. */
  registry: ActorRegistry;
  /** Who the claiming session now is — stamped into the envelope, which is
   * how the caller (and a crash-recovery replay) learns the answer. */
  actor: Actor;
  /** The private half: the presenting badge's claim list after this claim.
   * The engine hands it to the desk. Not replayable, and not meant to be. */
  claims: ActorClaim[];
  /** A shelved legacy row this claim adopted, if any — the sessionKey whose
   * pre-badge claim now belongs to the presenting badge. The desk deletes it;
   * adoption is one-time and first-come. */
  adopted?: string;
}

/**
 * The identity reducer. Validates a claim against everything the daemon can
 * see — the registry, the claims table, live presence, every canvas's history
 * — and returns the bound actor plus BOTH halves of the effect. Runs only at
 * the single writer, so two agents claiming at the same moment serialize: the
 * second is refused or allocated a different name BY CONSTRUCTION, not by a
 * client-side pre-check both of them can pass at once.
 */
export function applyClaim(ctx: ClaimContext, op: ActorClaimOp): ClaimResult {
  const mint = ctx.mintId ?? newActorId;
  const own = ctx.own;
  // "Mine" is this badge's row under this session key. A shelved legacy row
  // for the same key counts as mine too, once: a client presenting the
  // sessionKey it always presented is handed its actor exactly as it was
  // before the badge existed — today's posture, preserved for one hop and
  // then extinguished, because adoption deletes the shelf row.
  const shelved = ctx.shelved;
  const claimed = own.find((row) => row.sessionKey === op.sessionKey);
  const mine = claimed ?? shelved;
  const adopted = !claimed && shelved ? op.sessionKey : undefined;

  const settle = (actor: Actor): ClaimResult => ({
    registry: bindName(ctx.registry, { actor, ts: ctx.now }),
    actor,
    claims: bindClaim(own, { actor, ts: ctx.now, op }),
    ...(adopted !== undefined ? { adopted } : {}),
  });

  if (op.as) {
    if (op.fresh) {
      throw new OpValidationError("bad-op", "`as` resumes an existing actor; `fresh` mints a new one — pick one");
    }
    return settle(reincarnate(ctx, op, op.as, mine));
  }

  if (op.fresh) {
    // A second Kenny on purpose: no collision checks, a brand-new actor.
    return settle({ id: mint(), name: op.name ?? allocateName(ctx, op.sessionKey) });
  }

  if (!op.name) {
    // "Who am I?" / "hand me a name": resume this key, or allocate.
    if (mine) return settle({ id: mine.actorId, name: nameOf(ctx, mine.actorId) });
    return settle({ id: mint(), name: allocateName(ctx, op.sessionKey) });
  }

  if (mine) {
    // Same key: resumption, or a rename in place — the id is the history.
    if (!sameName(nameOf(ctx, mine.actorId), op.name)) requireFree(ctx, op, mine.actorId);
    return settle({ id: mine.actorId, name: op.name });
  }

  requireFree(ctx, op, undefined);
  return settle({ id: mint(), name: op.name });
}

/**
 * The PUBLIC effect of a logged claim — replayable from the envelope alone,
 * because validation already happened when the entry was logged. Taking a
 * name IS the act of naming an actor, so a claim writes one row: actor id →
 * name.
 *
 * Newest wins, judged by the stamp rather than by arrival order. Replay
 * normally delivers entries oldest-first and the guard never fires — but the
 * one-time migrations append entries stamped with their ORIGINAL timestamps
 * onto the end of a log that already has newer ones, so log order is not time
 * order there, and a two-month-old legacy row must not re-letter an actor who
 * was renamed last week.
 */
export function bindName(
  registry: ActorRegistry,
  envelope: { actor: Actor; ts: string },
): ActorRegistry {
  const { actor, ts } = envelope;
  const current = registry.names[actor.id];
  if (current && current.at > ts) return registry;
  return { ...registry, names: { ...registry.names, [actor.id]: { name: actor.name, at: ts } } };
}

/**
 * The PRIVATE effect of a claim: this badge's claim list, after it.
 *
 * One actor is one claim PER BADGE — binding a session key to an actor
 * releases any other key on the SAME badge still holding it, so an `as`
 * reclaim leaves the abandoned session a stranger rather than a second face.
 * Eviction stops at the badge on purpose: two badges may hold one actor (a
 * pass mints a badge carrying a named claim — "Jordan's tab and her daemon"),
 * so "one actor, one holder" was never going to survive, and the narrower
 * rule is already the shape the pass needs.
 */
export function bindClaim(
  claims: readonly ActorClaim[],
  envelope: { actor: Actor; ts: string; op: ActorClaimOp },
): ActorClaim[] {
  const { actor, ts, op } = envelope;
  const kept = claims.filter(
    (row) => row.actorId !== actor.id && row.sessionKey !== op.sessionKey,
  );
  kept.push({
    actorId: actor.id,
    boundAt: ts,
    sessionKey: op.sessionKey,
    ...(op.canvasId !== undefined ? { canvasId: op.canvasId } : {}),
  });
  return kept;
}

/**
 * A claim that was HANDED OVER rather than made — what redeeming a pass
 * writes onto the redeeming badge's list (phase 8).
 *
 * It sits beside `bindClaim` because it is the other way a row gets onto a
 * badge, and it is a separate function because the two differ in every detail
 * that matters:
 *
 * - **No session key.** Nobody presented one. A pass is redeemed by a surface
 *   that has not yet decided which of its conversations this is, and inventing
 *   a key here would put a string the home cannot verify into the one field
 *   the design says the home must never trust. The row is still found by every
 *   question that matters, because `claimsActor` — the membership check that
 *   decides whether this badge may speak as this actor — asks about the actor
 *   and never about the key.
 * - **No eviction by key**, for the same reason; only the badge's own earlier
 *   row for the SAME actor is replaced, so redeeming twice (two passes, one
 *   actor) leaves one row rather than two.
 * - **It is not `applyClaim`, and it is not `as`.** `as` is reincarnation, and
 *   `reincarnate` refuses while the actor is visibly somebody — which, at the
 *   exact moment a pass is redeemed, it always is: Jordan's tab is open on the
 *   canvas she just minted from. A handoff is the opposite gesture from a
 *   claim. Nobody is asserting anything; a holder that already is this actor
 *   said so, on the record, when it minted the pass.
 */
export function bindHandoff(
  claims: readonly ActorClaim[],
  envelope: { actor: Actor; ts: string; canvasId?: string },
): ActorClaim[] {
  const { actor, ts, canvasId } = envelope;
  return [
    ...claims.filter((row) => row.actorId !== actor.id),
    { actorId: actor.id, boundAt: ts, ...(canvasId !== undefined ? { canvasId } : {}) },
  ];
}

/**
 * The membership check — mechanism 5, entire.
 *
 * Everywhere an actor is named, the name must be one the speaker's badge
 * vouches for: ops, undo/redo (or you could undo someone else's work by
 * naming them), and every presence beat, including a daemon's RELAYED
 * presence, where one connection carries several actors and each of them must
 * be in the badge's claims.
 *
 * It takes claim ROWS, not a badge — this file has never heard of badges and
 * must not start now. That is the trick of the whole mechanism: the reducer
 * keeps judging actors and the oplog keeps carrying `actor` and `clientId`
 * with badge ids nowhere in it, while enforcement lands UNDER the vocabulary.
 * The rules that already looked like authorization — `comment.update`'s "only
 * the author", actor-scoped undo — become authorization the moment an actor
 * means something, with the isomorphism contract untouched.
 */
export function claimsActor(claims: readonly ActorClaim[], actorId: string): boolean {
  return claims.some((row) => row.actorId === actorId);
}

/** The refusal, in one voice wherever the check runs. The honest client's
 * remedy is always the same and always available — claim first, which the
 * agent guide already teaches as the first act. */
export function notYourActor(actorId: string): OpValidationError {
  return new OpValidationError(
    "not-your-actor",
    `this badge does not speak for ${actorId} — claim that actor first ` +
      "(`isocan identity --session`, or the web app's identity dialog); " +
      "`--as <actor id>` is how a holder that lost its badge comes back, and since " +
      "phase 9 it needs a vouch when another surface still speaks as them — a pass " +
      "from that surface, or the address they signed in with",
  );
}

/**
 * Choosing the color you wear (`actor.setColor`). Home-scoped like a claim,
 * applied by the engine against the registry, and NOT undoable — the same
 * posture as naming yourself. A null color puts you back on the color your id
 * implies, which is why "no row" and "the derived color" mean the same thing.
 */
export function applyActorColor(
  registry: ActorRegistry,
  op: ActorSetColorOp,
): ActorRegistry {
  if (op.color !== null && !isIdentityColor(op.color)) {
    throw new OpValidationError("bad-op", `not a color: ${op.color}`);
  }
  const colors = { ...registry.colors };
  if (op.color === null) delete colors[op.actorId];
  else colors[op.actorId] = op.color;
  return { ...registry, colors };
}

/**
 * The name every actor goes by now, keyed by actor id — the wire shape.
 *
 * A read, not a derivation. It used to walk every claim and take the newest
 * per actor; recency is stored now, so replay order does that work and a name
 * survives the claim that made it.
 */
export function actorNames(registry: ActorRegistry): ActorNames {
  const names: ActorNames = {};
  for (const [actorId, row] of Object.entries(registry.names)) names[actorId] = row.name;
  return names;
}

/**
 * Deliberate return of an actor whose conversation is gone — and, since phase
 * 9 stage 2, **never an open assertion.**
 *
 * Resuming an actor somebody else is already speaking as needs a VOUCH: a
 * surface that already is them handed it over (a pass), or the claimant proved
 * the attribute that surface proved (an attestation). Without one, the answers
 * are the three refusals in `admit` — so the suggestion "use `as` if you are
 * them" cannot be followed by somebody who is not.
 */
function reincarnate(
  ctx: ClaimContext,
  op: ActorClaimOp,
  as: string,
  mine: ActorClaim | undefined,
): Actor {
  const registered = ctx.registry.names[as];
  const known: Actor | undefined = registered
    ? { id: as, name: registered.name }
    : ctx.held.find((holder) => holder.actor.id === as)?.actor;
  if (!known && !op.name) {
    throw new OpValidationError(
      "unknown-actor",
      `no actor ${as} is known here — pass a name to bring one in from elsewhere`,
    );
  }
  /**
   * **A vouch, and there are two ways to have one.** (Mechanism 3's
   * resumption rule, and mechanism 6 standing on it.)
   *
   * The design's sentence is one rule: *"The `as:` lever stops being open
   * assertion: resuming an actor now requires a vouch. A badge already holding
   * the claim vouches for anyone… past that, the routes split by what the
   * actor has: a person's actor resumes on a matching attestation (a person
   * has an inbox); an agent's on a pass."*
   *
   * So: **one predicate, two satisfiers, and deliberately not two special
   * cases.** Phase 8 carved the first — a keyless handoff row, written by
   * redeeming a pass — and phase 9 stage 2 adds the second — an attestation
   * this badge shares with a badge that already claims the actor. Both say the
   * same thing in different currencies: *somebody who is already this actor
   * said so*. The pass says it by having been minted; the inbox says it by
   * being the same inbox. Everything below reads `vouched` and never asks
   * which, which is what keeps them one rule.
   *
   * `handed` is this badge's own keyless row — see the argument below for why
   * it is NOT "any row on this badge".
   */
  const vouched = handedRow(ctx, as, mine) || ctx.vouchedBy !== undefined;
  return admit(ctx, op, as, known, vouched);
}

/**
 * The refusals, and the vouch that switches them off.
 *
 * Split from `reincarnate` so the one-rule-two-satisfiers line above is
 * readable as one statement, and so the three refusal reasons sit together
 * where they can be compared.
 */
function admit(
  ctx: ClaimContext,
  op: ActorClaimOp,
  as: string,
  known: Actor | undefined,
  vouched: boolean,
): Actor {
  const wornLive = !vouched && ctx.held.some((h) => h.live && h.actor.id === as);
  /**
   * **Somebody else's badge already speaks as this actor** — the tightening
   * phase 9 stage 2 owes, and the thing that makes attestation worth having.
   *
   * Until this line, `as` was refused only while the actor was *visibly*
   * somebody: live on a canvas, or claimed within the half hour. Which meant
   * that half an hour after Jordan closed her laptop, anybody who knew her
   * actor id could simply be her — the desk design's own complaint about
   * mechanism 6, verbatim: *"today the honest path is refused (name taken) and
   * the dishonest one (`as:`) is open to anyone — exactly backwards."*
   * Resumption is the honest path arriving, and it would be worth nothing if
   * the dishonest one stayed open beside it: a phone that can prove its
   * address gains exactly what a stranger already had.
   *
   * **Where it stops, and why it stops there.** A claim under THE SAME SESSION
   * KEY is not "elsewhere", so the shipped lost-badge recovery still works:
   * `/api/actors/orphaned` names the actor behind a key the caller already
   * holds, and `--as` with that key brings it back. That route is phase 3's,
   * it is what an agent harness whose credential was cleared actually does,
   * and nothing else replaces it — a replacement holds no claims, so it cannot
   * even SEE the badge that is holding its actor, let alone kill it. Breaking
   * it to close this would have traded a real recovery for a hole that stayed
   * open anyway.
   *
   * So the honest statement of what this buys: **a session key is a weak
   * vouch and an attestation is a strong one.** A caller that knows the actor
   * id but not the conversation key can no longer wait half an hour and be
   * somebody — which is every stranger on a shared canvas, because actor ids
   * ride in the oplog and are visible to anyone admitted while session keys
   * are not. A caller that knows both is where the weak vouch runs out, and
   * the answer to that is the strong one.
   *
   * Rows on THIS badge are not "elsewhere" (that is `otherSession` below, a
   * narrower and older refusal), and a killed badge holds nothing at all: the
   * desk drops it from every query, so a stolen laptop stops blocking its
   * owner's return the moment it is ended.
   */
  const heldElsewhere = !vouched && ctx.heldElsewhere === true;
  // Somebody else's claim on this actor, anywhere on the desk — another badge,
  // another session key on this one, or a shelved legacy row. Rows under THIS
  // session key are excluded wherever they sit: a browser persona resuming
  // itself sends `as` AND its own key, and must not be refused as theft by its
  // own past self.
  const otherSession =
    !vouched &&
    ctx.claimants.some(
      (row) =>
        row.sessionKey !== op.sessionKey &&
        row.actorId === as &&
        Date.parse(ctx.now) - Date.parse(row.boundAt) < CLAIM_STANDS_MS,
    );
  if (wornLive || heldElsewhere || otherSession) {
    throw new OpValidationError(
      "name-taken",
      `${as} is somebody else here (${
        wornLive
          ? "live on a canvas"
          : heldElsewhere
            ? "another surface already speaks as them"
            : "claimed by another session just now"
      }) — becoming them would be one actor wearing two faces. ` +
        "Be handed it by a surface that already is them (`isocan pass`, or “Work from your " +
        "terminal…”), or prove the address they signed in with.",
    );
  }
  const name = op.name ?? known!.name;
  if (op.name && !sameName(known?.name ?? "", op.name)) requireFree(ctx, op, as);
  return { id: as, name };
}

/**
 * The first satisfier: this badge holds a HANDED-OVER claim on this actor — a
 * row with no session key, which is what redeeming a pass writes
 * (`bindHandoff`).
 *
 * Keying an actor this badge can already speak as grants it nothing it did not
 * have a moment ago — mechanism 5's check is `claimsActor`, which asks about
 * the BADGE and never about the key, so every process presenting this badge
 * could already write as this actor before it asked.
 *
 * **Phase 8 forced it, and without it the pass does not work.** A pass hands
 * one actor to a SECOND badge — "Jordan's tab and her daemon", which
 * `bindClaim` has anticipated since phase 3 — so from the moment a pass is
 * redeemed there are legitimately two holders of one actor. Every later `as`
 * from the endowed badge (a replica's `ensureClaim` after a restart, a CLI
 * keying the identity it was just handed) would otherwise meet `wornLive`,
 * because the OTHER holder's tab is live, or `heldElsewhere`, because that
 * holder is a different badge, or `otherSession`, because it claimed within
 * the half hour — and be refused from being the person it was handed thirty
 * seconds ago.
 *
 * **Deliberately NOT "any row on this badge".** A keyed row belongs to a
 * session: on one machine every agent shares the CLI's badge, so letting a
 * second session key an actor a first is holding would unseat a working agent
 * (`bindClaim` evicts the old key), and that refusal is exactly what
 * `claims.test.ts`'s "`as` is refused while the actor was claimed moments ago"
 * protects. A handoff row belongs to no session, so there is nothing to
 * unseat — one row per actor per badge is what `bindClaim` and `bindHandoff`
 * both maintain, so "there is a keyless row" and "no session holds it here"
 * are the same statement.
 */
function handedRow(ctx: ClaimContext, as: string, mine: ActorClaim | undefined): boolean {
  return (
    mine?.actorId === as ||
    ctx.own.some((row) => row.actorId === as && row.sessionKey === undefined)
  );
}

/** Throw if `name` answers to anyone who is not `selfId`. */
function requireFree(ctx: ClaimContext, op: ActorClaimOp, selfId: string | undefined): void {
  const name = op.name!;
  const holder = ctx.held.find(
    (h) => sameName(h.actor.name, name) && h.actor.id !== selfId,
  );
  // A name is taken when somebody ANSWERS to it: held on a canvas, or claimed
  // by a session that is not this one. A name row alone does not reserve a
  // name — an actor nobody speaks as any more is a name that was used, and
  // `held` already remembers those.
  const bound = ctx.scoped.find(
    (row) =>
      row.sessionKey !== op.sessionKey &&
      row.actorId !== selfId &&
      sameName(nameOf(ctx, row.actorId), name),
  );
  if (!holder && !bound) return;
  const takenBy = holder?.actor.id ?? bound!.actorId;
  const where = holder
    ? `${holder.actor.id}, ${holder.live ? "on" : "known to"} "${holder.canvas}"`
    : `${bound!.actorId}, claimed by another session`;
  throw new OpValidationError(
    "name-taken",
    `"${name}" is taken here (${where}) — @${name} would reach both of you. Pick another ` +
      `name, or claim without one to be handed a free one; \`--as ${takenBy}\` if you are ` +
      `${name} returning from a lost session, or \`--new\` to be a second ${name} on purpose.`,
  );
}

/**
 * The next free isocan name: the roster in order, then numbered rounds
 * ("Isaac 2", …) — allocation can always answer.
 *
 * Exported so a home can answer `FREE_NAME_ROUTE` with the SAME function that
 * would allocate here. Building a second, similar allocator for that route is
 * exactly the shape of the bug it exists to fix.
 */
export function allocateName(ctx: ClaimContext, sessionKey?: string | null): string {
  const taken = new Set<string>();
  for (const holder of ctx.held) taken.add(holder.actor.name.trim().toLowerCase());
  for (const row of ctx.scoped) taken.add(nameOf(ctx, row.actorId).trim().toLowerCase());
  // The authority's pick goes first, and is still checked here — so allocation
  // keeps its one promise even when the home's answer has gone stale between
  // the asking and the claiming, or when there was no home to ask.
  //
  // It outranks the harness pick deliberately, and only replicas ever have
  // one: `preferred` is the home's answer about a namespace this machine
  // cannot see, and a legible initial is not worth handing out a name that is
  // taken where it counts. On a home — which is every machine that has not
  // been pointed at one — it is absent and the initial leads.
  const preferred = ctx.preferred?.trim();
  if (preferred && !taken.has(preferred.toLowerCase())) return preferred;
  // A name starting the way the harness does, when the harness is one we can
  // take a letter from — eight per letter, entered at a point derived from
  // this claimant's session key. Skipping what is taken is what makes a second
  // Claude another C name rather than "Charlie 2".
  const seed = sessionKey?.trim() || "";
  const initial = harnessOf(sessionKey ?? undefined)?.toLowerCase()[0];
  const byLetter = (initial && INITIAL_NAMES[initial]) || [];
  const lettered = firstFree(byLetter, taken, seed);
  if (lettered) return lettered;
  // The isocan roster: where an unknown harness starts, and where a letter
  // that is used up lands. Walked the same way.
  const roster = firstFree(ISOCAN_NAMES, taken, seed);
  if (roster) return roster;
  // Numbered rounds. Allocation can always answer — that is its one promise —
  // and this is the floor it stands on when 216 names are somehow all worn.
  for (let round = 2; ; round++) {
    for (const base of ISOCAN_NAMES) {
      const name = `${base} ${round}`;
      if (!taken.has(name.toLowerCase())) return name;
    }
  }
}

/** What an actor is called now. An actor with a claim but no name row is one
 * the registry has never been told about — answer with nothing rather than
 * inventing, so a name comparison simply does not match. */
function nameOf(ctx: ClaimContext, actorId: string): string {
  return ctx.registry.names[actorId]?.name ?? "";
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
