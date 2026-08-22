import type { ActorClaim, ClaimTable } from "@isocan/core";

/**
 * The desk: the home's PRIVATE ledgers — who holds a badge, what it has been
 * admitted to, and which actors it may speak as.
 *
 * A second seam beside the `Store`, and deliberately not a widening of it.
 * The two-ledger rule is a rule about which data may TRAVEL — canvas state
 * replicates to every replica; the desk's ledgers are innkeeper-private and
 * never leave the home — and a shared interface would make that a convention
 * instead of a fact. With two seams, "is this replicated?" is answered by
 * which module a type is imported from.
 *
 * Like `store.ts`, this file has NO RUNTIME IMPORT AT ALL: one `import type`
 * from core, and nothing else. `FileDesk` (see `file-desk.ts`) is the default
 * backing; `daemon.ts` is the one place that names it. That split turns "the
 * transport compiles against the interface and nothing else" from a claim
 * into a grep — this file structurally cannot reach a backing, so no later
 * edit can quietly re-couple them.
 *
 * Phase 4 gives this a Firestore backing: one document per badge at
 * `badges/{badgeId}`, exactly the architecture's shape. Everything here is a
 * document read or write except `claims()`, which is a whole-table read a
 * cloud backing cannot do — see its comment.
 */

/** Why a badge is in a canvas. Phase 2 writes it and enforces nothing: the
 * address still admits, and this only writes down that it did. */
export type Provenance =
  /** This badge created the canvas — the bootstrap badge's first admission. */
  | { root: "created" }
  /** The address admitted it. Phase 7 rewrites this to the canvas's standing
   * link grant, which is the status quo demoted to data. */
  | { root: "link" }
  /** Redeemed a pass (phase 8). */
  | { root: "pass"; badgeId: string }
  /** Admitted by a grant (phase 7). */
  | { root: "grant"; grantId: string };

export interface Admission {
  canvasId: string;
  provenance: Provenance;
  at: string;
}

/** Which carrier this badge was minted for. Informational in phase 2 — both
 * carriers are accepted from anyone — and the handle a later phase needs to
 * say "cookie badges are browsers". */
export type BadgeKind = "cookie" | "bearer";

/**
 * One badge, as the desk holds it.
 *
 * Never crosses the wire: this type belongs here the way `LoadedProject`
 * belongs in `store.ts`. What a client sees of a badge is its id and, once,
 * its secret.
 *
 * `attestations` is DELIBERATELY absent. Phase 9 owns it, nothing writes it,
 * and an array that is always empty is a speculative clean seam where phase
 * 1's lesson asks for an honest leaky one.
 */
export interface BadgeRecord {
  badgeId: string;
  /** SHA-256 of the secret, hex. The desk never sees the plaintext — the
   * caller hashes before it gets here, so a leaked ledger leaks no bearer
   * tokens. Not a KDF, and not salted, on purpose: the secret is 256 bits of
   * CSPRNG output, so there is no dictionary to slow down and no shared
   * password space to de-duplicate, and a work factor would buy ~100ms of CPU
   * on the hot path of every request against a home pinned to one instance,
   * in exchange for nothing. The comparison is timing-safe; that is the
   * threat that is real. */
  secretHash: string;
  kind: BadgeKind;
  createdAt: string;
  lastSeen: string;
  /** The canvases this badge has been in. Written, never enforced, in phase
   * 2 — phase 3 re-asks `projectId ∈ admissions` per route, and a phase 3
   * that inherited empty lists would have to backfill them under a check
   * that was already live. */
  admissions: Admission[];
  /** Who this badge may speak as. Several, on purpose: a browser's personas,
   * or everyone a machine's daemon relays. */
  claims: ActorClaim[];
}

export interface Desk {
  init(): Promise<void>;

  /** Store a freshly minted record. */
  put(badge: BadgeRecord): Promise<void>;

  /** The hot path: every request, once. Null for a badge this home does not
   * know — a home that was wiped, and in phase 9 a badge that was killed. */
  badge(badgeId: string): Promise<BadgeRecord | null>;

  /** Freshen `lastSeen`. Separate from `put` because it happens on every
   * request and a backing may debounce it; the file backing does. */
  touch(badgeId: string, at: string): Promise<void>;

  /** Replace one badge's claim list. Called from the engine's chain, with
   * what `applyClaim` returned. */
  setClaims(badgeId: string, claims: ActorClaim[]): Promise<void>;

  /**
   * The whole claims table, badgeId → claims, with the migration shelf under
   * `SHELF`. What `applyClaim` needs to answer "is this name taken" and "was
   * this actor claimed just now".
   *
   * A FILE-BACKING AFFORDANCE WITH A KNOWN EXPIRY, recorded here so phase 4
   * is not surprised: Firestore cannot serve a whole-table read, so this
   * becomes `claimants(actorId)` (a `where("claimIds", "array-contains", …)`
   * over a denormalized id list) and `claimsOf(badgeId)`. Phase 3, which
   * narrows name checks to the claiming badge's admissions, is the phase that
   * naturally introduces them.
   */
  claims(): Promise<ClaimTable>;

  /** Record that this badge has been in this canvas. Policy-free in phase 2
   * — everyone is admitted; this only writes down that they were. */
  admit(badgeId: string, canvasId: string, provenance: Provenance): Promise<void>;

  // ---- the migration shelf; it dies when it empties ----

  /**
   * Adopt a shelved pre-badge claim onto a badge, once. Returns the row if
   * there was one. First-come: a sessionKey another badge already adopted is
   * gone, and its second claimant must use `--as`.
   */
  adopt(sessionKey: string, badgeId: string): Promise<ActorClaim | null>;

  /** Put pre-badge claims on the shelf — the one-time migrations' half of
   * the private ledger, keyed by the `sessionKey` that will come to collect
   * it. */
  shelve(rows: Record<string, ActorClaim>): Promise<void>;
}
