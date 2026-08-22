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
  /** See ActorClaim.projectId. */
  projectId?: string;
}

/** Somebody a canvas answers to. Not only the faces on it right now: an
 * @-mention reaches a name that was used once and put down, so a name stays
 * taken after its wearer goes quiet. */
export interface NameHolder {
  actor: Actor;
  /** Canvas title, for saying where. */
  project: string;
  /** Wearing it at this moment, rather than remembered from the history. */
  live: boolean;
}

/** Names hiding in the letters of "isocan" — the allocation roster a claim
 * with no name draws from, in order. */
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
  /** Everyone the canvases IN SCOPE answer to — live faces AND names
   * remembered from history, the same set an @-mention resolves against.
   * Scoped to the claiming badge's admissions, for mechanism 10's reason. */
  held: readonly NameHolder[];
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
    return settle({ id: mint(), name: op.name ?? allocateName(ctx) });
  }

  if (!op.name) {
    // "Who am I?" / "hand me a name": resume this key, or allocate.
    if (mine) return settle({ id: mine.actorId, name: nameOf(ctx, mine.actorId) });
    return settle({ id: mint(), name: allocateName(ctx) });
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
    ...(op.projectId !== undefined ? { projectId: op.projectId } : {}),
  });
  return kept;
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
      "`--as <actor id>` is how a holder that lost its badge comes back",
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

/** Deliberate return of an actor whose conversation is gone. Refused while
 * the actor is visibly someone — a live face, or a session that claimed
 * recently enough to still be working — so the suggestion "use `as` if you
 * are them" cannot be followed by somebody who is not. */
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
  const wornLive = mine?.actorId !== as && ctx.held.some((h) => h.live && h.actor.id === as);
  // Somebody else's claim on this actor, anywhere on the desk — another badge,
  // another session key on this one, or a shelved legacy row. Rows under THIS
  // session key are excluded wherever they sit: a browser persona resuming
  // itself sends `as` AND its own key, and must not be refused as theft by its
  // own past self.
  const otherSession = ctx.claimants.some(
    (row) =>
      row.sessionKey !== op.sessionKey &&
      row.actorId === as &&
      Date.parse(ctx.now) - Date.parse(row.boundAt) < CLAIM_STANDS_MS,
  );
  if (wornLive || otherSession) {
    throw new OpValidationError(
      "name-taken",
      `${as} is somebody right now (${wornLive ? "live on a canvas" : "claimed by another session just now"}) — ` +
        "becoming them would be one actor wearing two faces",
    );
  }
  const name = op.name ?? known!.name;
  if (op.name && !sameName(known?.name ?? "", op.name)) requireFree(ctx, op, as);
  return { id: as, name };
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
    ? `${holder.actor.id}, ${holder.live ? "on" : "known to"} "${holder.project}"`
    : `${bound!.actorId}, claimed by another session`;
  throw new OpValidationError(
    "name-taken",
    `"${name}" is taken here (${where}) — @${name} would reach both of you. Pick another ` +
      `name, or claim without one to be handed a free one; \`--as ${takenBy}\` if you are ` +
      `${name} returning from a lost session, or \`--new\` to be a second ${name} on purpose.`,
  );
}

/** The next free isocan name: the roster in order, then numbered rounds
 * ("Isaac 2", …) — allocation can always answer. */
function allocateName(ctx: ClaimContext): string {
  const taken = new Set<string>();
  for (const holder of ctx.held) taken.add(holder.actor.name.trim().toLowerCase());
  for (const row of ctx.scoped) taken.add(nameOf(ctx, row.actorId).trim().toLowerCase());
  for (let round = 1; ; round++) {
    for (const base of ISOCAN_NAMES) {
      const name = round === 1 ? base : `${base} ${round}`;
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
