import type { IncomingHttpHeaders } from "node:http";

/**
 * **The door's meter** (phase 13.7 — the innkeeper's obligations).
 *
 * `innkeeper.md` promises rate limits at the door in the same breath as it
 * says badges are free: *"badges are free to mint; free may not mean
 * unmetered."* This file is that sentence, and nothing else — it knows about
 * headers and clocks and has never heard of Fastify, the desk, or a canvas.
 *
 * **What is actually being protected.** Not CPU and not bandwidth: a mint
 * writes a row to the desk, forever, for a caller who by construction has
 * proved nothing. An unmetered door is a stranger's write access to the
 * home's smallest, most permanent table. So the meter counts MINTS, never
 * requests — a caller that already holds a badge costs the desk nothing and
 * is never metered, which is why the door's own "already badged" branch runs
 * before this one is consulted (see `http.ts`).
 *
 * In memory, one instance, no persistence. That is honest for a home that
 * runs at `max-instances=1` (`infra/70-cloud-run.sh`) and it is the same
 * model the presence hub already uses. A restart forgives everybody, which
 * is the right failure direction for a limit whose worst outcome is refusing
 * a real visitor.
 */

/** 20 a minute, burst 20 — the user's number. Sized so that no honest caller
 * can reach it and no flooder can do much with it: a browser mints once and
 * keeps a cookie for a year, a CLI mints once and keeps `identity.json`, and
 * a replica mints once per home. Twenty is what a person retrying by hand,
 * or a test suite booting daemons, can spend without noticing. */
export const MINT_PER_MINUTE = 20;
export const MINT_BURST = 20;

/** Its own name, never shared with another meaning — `not-admitted` is 403
 * because a fresh badge would be refused identically, and this one is 429
 * because waiting genuinely fixes it. Two different recoveries must not
 * arrive under one code. */
export const TOO_MANY_BADGES = "too-many-badges";

/** How long until one token is back, in whole seconds — what goes in
 * `Retry-After`, and what the message says out loud. */
export interface MintRefusal {
  retryAfter: number;
}

interface TokenBucketsOptions {
  burst?: number;
  perMinute?: number;
  /** Injected so the refill is testable without waiting a minute. Written as
   * a thunk rather than captured as `Date.now` so a spy installed after
   * construction is still seen. */
  now?: () => number;
  /** The most keys held at once. See `evict`. */
  cap?: number;
}

interface Bucket {
  tokens: number;
  /** When `tokens` was last true. */
  at: number;
}

/**
 * A token bucket per key, refilling continuously.
 *
 * Continuous refill rather than a fixed window on purpose: a window lets a
 * caller spend the whole budget in the last second of one window and the
 * whole budget in the first second of the next, so a "20 a minute" window is
 * really 40 a second twice a minute. Refilling steadily has no such seam, and
 * it makes `Retry-After` a real number instead of "however long is left of a
 * minute you cannot see".
 */
export class TokenBuckets {
  private readonly buckets = new Map<string, Bucket>();
  private readonly burst: number;
  private readonly perSecond: number;
  private readonly now: () => number;
  private readonly cap: number;

  constructor(options: TokenBucketsOptions = {}) {
    this.burst = options.burst ?? MINT_BURST;
    this.perSecond = (options.perMinute ?? MINT_PER_MINUTE) / 60;
    this.now = options.now ?? (() => Date.now());
    this.cap = options.cap ?? 10_000;
  }

  /** Distinct keys held right now. The one number worth putting in a log line
   * next to a refusal — see `clientAddress` for why a home where this stays
   * at 1 while refusals climb is a home whose key is wrong. */
  get size(): number {
    return this.buckets.size;
  }

  /** Spend one token for `key`, or say when the next one arrives. `null` is
   * "go ahead" — the allowed path is the one with nothing to unpack. */
  take(key: string): MintRefusal | null {
    const t = this.now();
    const held = this.buckets.get(key);
    const tokens = held ? this.refilled(held, t) : this.burst;
    if (tokens < 1) {
      // Recorded even though nothing was spent: the elapsed time is now
      // banked, so a caller that hammers during a refusal is neither
      // punished (no penalty accrues) nor rewarded (no free reset).
      this.buckets.set(key, { tokens, at: t });
      return { retryAfter: Math.max(1, Math.ceil((1 - tokens) / this.perSecond)) };
    }
    if (!held && this.buckets.size >= this.cap) this.evict(t);
    this.buckets.set(key, { tokens: tokens - 1, at: t });
    return null;
  }

  private refilled(bucket: Bucket, t: number): number {
    const elapsed = Math.max(0, t - bucket.at) / 1000;
    return Math.min(this.burst, bucket.tokens + elapsed * this.perSecond);
  }

  /**
   * **The map is bounded, because it is written to by strangers.**
   *
   * Without this, the meter is itself the denial of service it was added to
   * prevent: one instance, one process, and a flood from many addresses (or
   * from one address that can vary its key — see `clientAddress`'s residual
   * risk) grows a `Map` until the home dies. Ten thousand keys is roughly a
   * megabyte and far more distinct callers than this home expects.
   *
   * Full buckets go first, and they are free: a bucket that has refilled to
   * `burst` is indistinguishable from a key that was never seen, so dropping
   * it changes no answer. Only if that frees nothing — ten thousand callers
   * all currently rate-limited — does the least-recently-touched entry go,
   * and THAT one does change an answer: the caller it belonged to gets a
   * fresh bucket. Stated rather than hidden, because it is the price of a
   * bounded meter and it is the right one: a home under a ten-thousand-key
   * flood has a bigger problem than one attacker's extra twenty badges.
   */
  private evict(t: number): void {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, bucket] of this.buckets) {
      if (this.refilled(bucket, t) >= this.burst) {
        this.buckets.delete(key);
        continue;
      }
      if (bucket.at < oldestAt) {
        oldestAt = bucket.at;
        oldestKey = key;
      }
    }
    if (this.buckets.size >= this.cap && oldestKey !== null) this.buckets.delete(oldestKey);
  }
}

// ---- whose bucket is this? ----

interface ProxyPosture {
  /** Is this daemon listening only to its own machine? `http.ts`'s
   * `loopbackBound` is the caller that knows. */
  loopback: boolean;
  /** How many trailing `X-Forwarded-For` entries this home's own
   * infrastructure appended. Overrides the default below; `ISOCAN_PROXY_HOPS`
   * is how an operator sets it without a deploy of new code. */
  hops?: number;
}

/**
 * **Whose bucket this request draws from — the whole correctness of the
 * meter, and the one decision here that can fail silently.**
 *
 * A bucket keyed on the raw socket address is right on a laptop and
 * catastrophic behind a load balancer, where every request arrives from the
 * balancer: the entire internet lands in one bucket, the first flood locks
 * out every legitimate visitor, and it does it at 429, looking exactly like
 * the feature working. That is this codebase's oldest failure — the cheerful
 * wrong answer — wearing a rate limit.
 *
 * The real client address is in `X-Forwarded-For`. But that header is
 * caller-supplied, and a home that believes all of it has a meter a flooder
 * walks around by sending a different fake value every request. Both wrong
 * answers are bad, so whom to believe is decided here, out loud.
 *
 * **READ FROM `infra/` — what is actually in front of this service.**
 * `80-load-balancer.sh` builds a global external application load balancer
 * (`EXTERNAL_MANAGED`) over a serverless NEG pointing at Cloud Run;
 * `70-cloud-run.sh` deploys that service with `--ingress=all` and an
 * `allUsers` invoker binding. So there is at least one Google-operated proxy
 * in front, always. A client controls a PREFIX of the chain and can neither
 * remove nor reorder the SUFFIX the infrastructure appended — which is the
 * only structural fact available, and it is what this function stands on:
 * count from the right, never from the left.
 *
 * **READ FROM GOOGLE'S DOCS, AND NOT MEASURED AGAINST THE DEV HOME BY THE
 * SESSION THAT WROTE THIS — how far from the right.** Google's external ALB
 * *appends* two entries, the address it saw the connection come from and then
 * its own, to whatever the caller sent. So the chain arrives as:
 *
 *     <client-ip>, <lb-ip>                 — a caller that sent no header
 *     <caller's claim>, <client-ip>, <lb-ip>  — a caller that sent one
 *
 * **In neither case is the leftmost entry the client address**, and in the
 * first case NO entry is caller-supplied: the caller's claim, when there is
 * one, is pushed left as a third entry. The address to key on is one from the
 * right in both, so `hops` defaults to 1.
 *
 * That default is the one thing here that is a vendor's documentation rather
 * than this repo's own scripts, and the standing lesson is that a comment
 * reasoning about a vendor is a hypothesis. It is therefore a hypothesis that
 * cannot fail in silence:
 *
 *   - `ISOCAN_PROXY_HOPS` moves it without a code change, for the day
 *     somebody measures the real chain and it is not 1. Measuring it is one
 *     request against the dev home with the refusal log open; nobody on this
 *     branch has done it.
 *   - Every refusal is logged with the chain it was keyed from and the number
 *     of distinct keys the meter holds (`TokenBuckets.size`). **A home whose
 *     refusals climb while its distinct-key count sits at 1 is a home keyed
 *     on its own load balancer.** That is the collapse, and that log line is
 *     how somebody at 3am sees it instead of concluding the limit works.
 *
 * **A loopback-bound daemon takes none of this.** Nothing is in front of it,
 * so every `X-Forwarded-For` it sees is pure fabrication; it keys on the
 * socket address, which is always its own machine. One bucket for the
 * machine is the true answer there — a local daemon serves one person — and
 * `loopbackBound` is the same question mechanism 5 already asks to decide
 * whether localhost trust stands.
 *
 * **What an attacker can still do, stated so nobody rediscovers it.**
 *
 *   1. `--ingress=all` means the `*.run.app` URL is reachable without going
 *      through the load balancer, and that path appends fewer entries. A
 *      caller that sends nothing arrives with a one-entry chain and falls
 *      back to the shared socket bucket, which is safe; but a caller that
 *      sends `X-Forwarded-For: <anything>` arrives as `<anything>,
 *      <client-ip>`, where one from the right IS the caller's own claim — so
 *      a flooder who finds the run.app address can mint without limit by
 *      varying it. The fix is one flag in `infra/70-cloud-run.sh`
 *      (`--ingress=internal-and-cloud-load-balancing`), which this change
 *      deliberately does not make: it is a provisioning decision with a
 *      blast radius of its own.
 *   2. Anyone with twenty addresses has twenty buckets. A per-IP meter is a
 *      speed bump for a distributed flood, and it is the right speed bump:
 *      quotas are the answer to volume, and `phases.md` leaves quotas as
 *      tuning.
 *   3. Sharing an address — CGNAT, a school, an office — shares a bucket, so
 *      an innocent visitor can be metered by a neighbour. That is why the
 *      page path withholds the badge rather than the page (see
 *      `registerPages`): the softest refusal that still protects the desk.
 */
export function clientAddress(
  headers: IncomingHttpHeaders,
  socketAddress: string | undefined,
  posture: ProxyPosture,
): string {
  const hops = posture.loopback ? 0 : (posture.hops ?? configuredHops());
  if (hops > 0) {
    const chain = forwardedChain(headers);
    const entry = chain[chain.length - 1 - hops];
    // Out of range means the chain is SHORTER than the infrastructure is
    // supposed to make it, which means this request did not come the way the
    // infrastructure sends them. Falling back to the socket address is the
    // conservative direction: a caller cannot claim its own private bucket by
    // sending a short chain, it can only join the shared one.
    if (entry) return entry;
  }
  return socketAddress ?? "unknown";
}

/** The full `X-Forwarded-For` chain, oldest first.
 *
 * **Deliberately unlike `isSecureRequest`'s `headerValue`, which takes the
 * first of a repeated header.** For `x-forwarded-proto` any copy answers the
 * same question. For a chain, repeated headers are consecutive SEGMENTS of
 * one list, and the trustworthy entries are at the end — so taking only the
 * first header would throw away exactly the half this function counts from.
 * They are joined in order instead. */
function forwardedChain(headers: IncomingHttpHeaders): string[] {
  const raw = headers["x-forwarded-for"];
  const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return joined
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** `ISOCAN_PROXY_HOPS`, read per call rather than at import: it is
 * configuration the way `ISOCAN_ALLOWED_ORIGINS` is, and a test that sets it
 * must not need a module reset to be believed. Anything that is not a
 * non-negative integer is the default rather than a crash — a home that
 * refused to boot over a typo in a tuning knob would be a worse innkeeper
 * than one that meters slightly wrongly and says so in the log. */
function configuredHops(): number {
  const raw = process.env.ISOCAN_PROXY_HOPS;
  if (raw === undefined) return 1;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 1;
}
