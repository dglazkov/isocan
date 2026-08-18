import type { Actor } from "./model.ts";
import type { Operation } from "./ops.ts";
import { OpValidationError } from "./errors.ts";
import { newActorId } from "./ids.ts";

export type ActorClaimOp = Extract<Operation, { type: "actor.claim" }>;

/**
 * The actor registry: which session speaks as whom. Identity used to be the
 * one mutation that never became an operation — four stores, no single
 * writer, and two clients re-implementing the same continuity rule over
 * different storage (#55). `actor.claim` moves it here: the daemon holds
 * `sessionKey → Actor`, claims serialize at the single writer, and the
 * registry's history is an oplog like everything else's.
 *
 * There is no lookup by name anywhere in this file. A resuming agent presents
 * the SAME session key — harnesses name conversations, not processes, so the
 * key survives resume — and is handed the same actor back. Name-based
 * resumption is what made a returning Kenny indistinguishable from a second
 * Kenny; the deliberate way back for an agent whose conversation is truly
 * gone is `as`, which is reincarnation, not a coincidence of spelling.
 *
 * Trust: there is no authentication. Any client can present any session key,
 * which is fine for a daemon that only listens on localhost for the people
 * and agents of one machine — worth stating rather than leaving implied.
 */
export interface ActorBinding extends Actor {
  /** When this key last claimed. Recency is the liveness proxy for the gap
   * between claiming a name and putting a face on a canvas. */
  boundAt: string;
}

export interface ActorRegistry {
  /** Keyed by `<harness>:<session id>`. */
  claims: Record<string, ActorBinding>;
}

export const emptyActorRegistry = (): ActorRegistry => ({ claims: {} });

/** A key→actor row as served over the API. */
export interface ActorBindingRecord {
  key: string;
  actor: Actor;
  boundAt: string;
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

/** Bindings older than this are dropped on the next claim. History does not
 * live here — the oplog and the canvases carry it, and `as` is the way back —
 * so an abandoned session's row earns nothing by staying. */
const PRUNE_AFTER_DAYS = 30;

/**
 * How long a claim stands as proof its owner is alive, when no face on any
 * canvas says so. Presence is the real answer, but there is a window between
 * claiming a name and starting a session where an agent is working invisibly
 * — `as` must not be able to steal an actor through it.
 */
const CLAIM_STANDS_MS = 30 * 60 * 1000;

export interface ClaimContext {
  registry: ActorRegistry;
  /** Everyone every canvas answers to — live faces AND names remembered from
   * history, the same set an @-mention resolves against. */
  held: readonly NameHolder[];
  /** The envelope timestamp — claims are pure; the caller owns the clock. */
  now: string;
  /** Injectable for tests. */
  mintId?: () => string;
}

export interface ClaimResult {
  registry: ActorRegistry;
  /** Who the claiming session now is — stamped into the envelope, which is
   * how the caller (and a crash-recovery replay) learns the answer. */
  actor: Actor;
}

/**
 * The identity reducer. Validates a claim against everything the daemon can
 * see — the registry, live presence, every canvas's history — and returns
 * the bound actor plus the next registry. Runs only at the single writer, so
 * two agents claiming at the same moment serialize: the second is refused or
 * allocated a different name BY CONSTRUCTION, not by a client-side pre-check
 * both of them can pass at once.
 */
export function applyClaim(ctx: ClaimContext, op: ActorClaimOp): ClaimResult {
  const mint = ctx.mintId ?? newActorId;
  const mine = ctx.registry.claims[op.sessionKey];

  const settle = (actor: Actor): ClaimResult => ({
    registry: prune(bindClaim(ctx.registry, { actor, ts: ctx.now, op }), ctx.now),
    actor,
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
    if (mine) return settle({ id: mine.id, name: mine.name });
    return settle({ id: mint(), name: allocateName(ctx) });
  }

  if (mine) {
    // Same key: resumption, or a rename in place — the id is the history.
    if (!sameName(mine.name, op.name)) requireFree(ctx, op, mine.id);
    return settle({ id: mine.id, name: op.name });
  }

  requireFree(ctx, op, undefined);
  return settle({ id: mint(), name: op.name });
}

/**
 * The registry effect of a logged claim — replayable from the envelope alone,
 * because validation already happened when the entry was logged. One actor is
 * one session: binding a key to an actor releases any other key still holding
 * it, so an `as` reclaim leaves the abandoned session a stranger rather than
 * a second face.
 */
export function bindClaim(
  registry: ActorRegistry,
  envelope: { actor: Actor; ts: string; op: ActorClaimOp },
): ActorRegistry {
  const { actor, ts, op } = envelope;
  const claims: Record<string, ActorBinding> = {};
  for (const [key, binding] of Object.entries(registry.claims)) {
    if (binding.id === actor.id && key !== op.sessionKey) continue;
    claims[key] = binding;
  }
  claims[op.sessionKey] = { id: actor.id, name: actor.name, boundAt: ts };
  return { claims };
}

/** Deliberate return of an actor whose conversation is gone. Refused while
 * the actor is visibly someone — a live face, or a session that claimed
 * recently enough to still be working — so the suggestion "use `as` if you
 * are them" cannot be followed by somebody who is not. */
function reincarnate(
  ctx: ClaimContext,
  op: ActorClaimOp,
  as: string,
  mine: ActorBinding | undefined,
): Actor {
  const known =
    Object.values(ctx.registry.claims).find((binding) => binding.id === as) ??
    ctx.held.find((holder) => holder.actor.id === as)?.actor;
  if (!known && !op.name) {
    throw new OpValidationError(
      "unknown-actor",
      `no actor ${as} is known here — pass a name to bring one in from elsewhere`,
    );
  }
  const wornLive = mine?.id !== as && ctx.held.some((h) => h.live && h.actor.id === as);
  const otherSession = Object.entries(ctx.registry.claims).find(
    ([key, binding]) =>
      key !== op.sessionKey &&
      binding.id === as &&
      Date.parse(ctx.now) - Date.parse(binding.boundAt) < CLAIM_STANDS_MS,
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
  const bound = Object.entries(ctx.registry.claims).find(
    ([key, b]) => key !== op.sessionKey && sameName(b.name, name) && b.id !== selfId,
  );
  if (!holder && !bound) return;
  const takenBy = holder?.actor.id ?? bound![1].id;
  const where = holder
    ? `${holder.actor.id}, ${holder.live ? "on" : "known to"} "${holder.project}"`
    : `${bound![1].id}, claimed by another session`;
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
  for (const binding of Object.values(ctx.registry.claims)) {
    taken.add(binding.name.trim().toLowerCase());
  }
  for (let round = 1; ; round++) {
    for (const base of ISOCAN_NAMES) {
      const name = round === 1 ? base : `${base} ${round}`;
      if (!taken.has(name.toLowerCase())) return name;
    }
  }
}

function prune(registry: ActorRegistry, now: string): ActorRegistry {
  const cutoff = Date.parse(now) - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const claims = Object.fromEntries(
    Object.entries(registry.claims).filter(([, b]) => Date.parse(b.boundAt) >= cutoff),
  );
  return { claims };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
