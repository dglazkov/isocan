import {
  cidrContains,
  inForce,
  noticeOf,
  NOT_ADMITTED,
  parseCidr,
  REFUSED,
  refusalInForce,
  refusalNoticeOf,
  refusalSentence,
  TAKEN_DOWN,
  takedownSentence,
  type Attestation,
  type CanvasTakedown,
  type Cidr,
  type HomeRefusal,
  type RefusalNotice,
  type TakedownNotice,
} from "@isocan/core";
import type { Desk } from "./desk.ts";

/**
 * **What this home refuses, in memory, read at the door** — operator phase 2
 * built it for takedowns, and operator phase 6 extends the SAME object to
 * home-scope refusals rather than standing a second registry beside it. The
 * design's own instruction, and the reason: the shape is one shape — *one
 * list the operator writes, lifts and reads, loaded into memory at boot on a
 * single-instance home and re-read on write, so the door's cost is a set
 * lookup* — so `daemon.ts` wires exactly one.
 *
 * Both halves are read on the request path — every canvas route, every
 * socket, every signed content read, every mint, every attestation, every
 * claim — and a desk read per request would put a Firestore round trip in
 * front of every page this home serves for the sake of rows empty on nearly
 * every home. So they are held here, and the rules that make that honest are
 * stated rather than assumed:
 *
 * 1. **For a takedown, the store's flag is the truth, not this.** `load`
 *    refuses on `takenDownAt`, durable and read from the backing every time a
 *    canvas is opened. The registry exists to produce the SENTENCE; a registry
 *    that lagged would mean a canvas correctly refused with the wrong words,
 *    never a canvas wrongly served.
 * 2. **For a refusal, the registry IS the door's answer** — there is no store
 *    flag underneath it — and the honesty comes from the other side: the act
 *    that writes the desk row writes this in the same request, in this
 *    process, and there is one writer. A second instance during a rollout is
 *    not reached for the seconds both run, the same bound the sweep and the
 *    socket hub live with, and it is closed at the next boot, which reads the
 *    desk.
 * 3. **The clock is handed in.** A refusal ends on its own (`expiresAt`), and
 *    "in force" is judged here against `now` on every read, never by deleting
 *    rows on a timer — so a `net:` block gone at `--for 10m` is one the door
 *    stops honouring the moment the clock passes it, and a test moves the
 *    clock rather than waiting.
 */
export class Refusals {
  private takedownRows = new Map<string, CanvasTakedown>();
  private refusalRows = new Map<string, HomeRefusal>();
  /** Parsed once per `net:` row, because the meter asks on every knock. */
  private nets = new Map<string, Cidr>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  /** The clock this registry judges expiry against, in epoch ms. The refuse
   * route derives a refusal's `at` and `expiresAt` from it, so the horizon it
   * writes and the horizon the door reads are measured on one clock — which is
   * what lets a test move `--for 10m` past its end without waiting. */
  nowMs(): number {
    return this.now();
  }

  /** Everything in force, at boot. Called once by `startDaemon`; a home that
   * never calls it answers "nothing is down and nobody is refused", which is
   * the truth about a home that has never had an operator. */
  async load(desk: Desk): Promise<void> {
    this.takedownRows = new Map((await desk.takedowns()).map((row) => [row.canvasId, row]));
    this.refusalRows = new Map();
    this.nets = new Map();
    for (const row of await desk.refusals()) this.remrefuse(row);
  }

  // ---- takedowns (operator phase 2) ----

  /** The act, having written the desk and the store, says so here. */
  remember(row: CanvasTakedown): void {
    if (inForce(row)) this.takedownRows.set(row.canvasId, row);
    else this.takedownRows.delete(row.canvasId);
  }

  /** The row in force for this canvas, or null — the door's whole question. */
  of(canvasId: string): CanvasTakedown | null {
    return this.takedownRows.get(canvasId) ?? null;
  }

  /** Is it down: the same question, where only the answer's truth is wanted. */
  has(canvasId: string): boolean {
    return this.takedownRows.has(canvasId);
  }

  /** Every row in force. The canvas list's read, and it is a read of a handful
   * of rows on a home that has any at all. */
  all(): CanvasTakedown[] {
    return [...this.takedownRows.values()];
  }

  /** What a surface is handed for one canvas, or null. */
  notice(canvasId: string): TakedownNotice | null {
    const row = this.of(canvasId);
    return row ? noticeOf(row) : null;
  }

  // ---- refusals (operator phase 6) ----

  /** The act, having written the desk, says so here. A lifted row is
   * forgotten; an in-force row (expiry in the future, or none) is held. The
   * expiry is judged on every READ rather than here, so a row remembered
   * before its horizon and asked after it answers correctly with no timer. */
  rememberRefusal(row: HomeRefusal): void {
    if (row.liftedAt === undefined) this.remrefuse(row);
    else {
      this.refusalRows.delete(row.subject);
      this.nets.delete(row.subject);
    }
  }

  private remrefuse(row: HomeRefusal): void {
    this.refusalRows.set(row.subject, row);
    if (row.kind === "net") {
      const cidr = parseCidr(row.subject.slice("net:".length));
      if (cidr) this.nets.set(row.subject, cidr);
    }
  }

  /** The refusal in force for one exact subject, or null. */
  refusalOf(subject: string): HomeRefusal | null {
    const row = this.refusalRows.get(subject);
    return row && refusalInForce(row, this.now()) ? row : null;
  }

  /**
   * **The refusal that turns this badge away at the door** — the first of the
   * badge's attestations that names a refused address, or null. The door hook
   * and `/api/attest` both ask it: acting with a badge that proved a refused
   * address, and proving it in the first place, are one fact from two sides.
   */
  refusingAttestation(attestations: readonly Attestation[]): HomeRefusal | null {
    for (const attestation of attestations) {
      const row = this.refusalOf(attestation.attribute);
      if (row) return row;
    }
    return null;
  }

  /** The refusal on one proved address, for `/api/attest`. */
  refusingAddress(attribute: string): HomeRefusal | null {
    return this.refusalOf(attribute);
  }

  /** The refusal on a name, for `actor.claim {as}` — `actor:<id>`. */
  refusingActor(actorId: string): HomeRefusal | null {
    return this.refusalOf(`actor:${actorId}`);
  }

  /**
   * **The refused network this address is inside, or null** — the mint
   * meter's question. A walk over the `net:` rows, which are a handful; an
   * expired row is skipped, which is how a `net:` block ends on its own.
   */
  refusingNet(address: string): HomeRefusal | null {
    const now = this.now();
    for (const [subject, cidr] of this.nets) {
      const row = this.refusalRows.get(subject);
      if (row && refusalInForce(row, now) && cidrContains(cidr, address)) return row;
    }
    return null;
  }

  /** Every refusal in force right now, for a listing or a lift. */
  allRefusals(): HomeRefusal[] {
    const now = this.now();
    return [...this.refusalRows.values()].filter((row) => refusalInForce(row, now));
  }

  /** What a surface is handed for one subject, or null. */
  refusalNotice(subject: string): RefusalNotice | null {
    const row = this.refusalOf(subject);
    return row ? refusalNoticeOf(row) : null;
  }
}

/**
 * **The url map the hosted home's edge is in front of** — `isocan-urlmap`,
 * from `infra/config.sh`, which is where the name is decided.
 *
 * Spelled here rather than read from the environment because the daemon has no
 * business knowing its own load balancer: the command is a LINE OF TEXT the
 * operator pastes into his own shell, run as himself against his own project,
 * and if this home is somebody else's with a different map name the command
 * fails loudly at their prompt rather than the daemon guessing quietly. The
 * override `infra/config.sh` honours is `ISOCAN_URLMAP_NAME`.
 */
export const CDN_URL_MAP = "isocan-urlmap";

/**
 * **The refusal a canvas that was taken down gives**, and it is the whole
 * message (design, "The record").
 *
 * **403 and `not-admitted`, with a `reason` of `taken-down`** — deliberately
 * the shape `withdrawn` already has, rather than a new code. Every client in
 * this repo already branches on `{code: NOT_ADMITTED, reason}`; it is the
 * truth (this home will not let anybody into that canvas); and a 404 would be
 * the *not found* the design names as the one thing a takedown must never
 * produce. The `error` field is the sentence itself, because the words come
 * from the home.
 */
export class TakenDownError extends Error {
  readonly code = NOT_ADMITTED;
  readonly reason = TAKEN_DOWN;
  readonly status = 403;
  constructor(readonly row: CanvasTakedown) {
    super(takedownSentence(row));
    this.name = "TakenDownError";
  }
}

/**
 * **The refusal a badge that proved a refused address, or knocked from a
 * refused network, is given** (operator phase 6) — 403 and `not-admitted`
 * with the reason `refused`, deliberately the shape `taken-down`, `withdrawn`
 * and `ended` already have rather than a new top-level code.
 *
 * The same three reasons `TakenDownError` gives: every client already branches
 * on `{code: NOT_ADMITTED, reason}`; it is the truth (this home will not admit
 * this badge); and a fresh badge would be refused identically, so it must not
 * be sent back to the door. The `error` is the sentence itself, from the home,
 * and `notice` carries the thin shape a surface renders.
 */
export class RefusedError extends Error {
  readonly code = NOT_ADMITTED;
  readonly reason = REFUSED;
  readonly status = 403;
  readonly notice: RefusalNotice;
  constructor(readonly row: HomeRefusal) {
    super(refusalSentence(row));
    this.name = "RefusedError";
    this.notice = refusalNoticeOf(row);
  }
}
