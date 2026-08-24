import type { ActorClaim, Grant, Pass } from "@isocan/core";

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
 * `badges/{badgeId}`, exactly the architecture's shape. Every method here is
 * a document read, a document write, or one indexed query — phase 3 retired
 * the whole-table `claims()` read that phase 2 left standing, because
 * narrowing name checks to a badge's admissions is the same motion.
 *
 * Phase 7 adds the desk's SECOND ledger of its own: grants, at `grants/{id}`,
 * the architecture's other row. They are here rather than on the `Store`
 * because a grant is innkeeper-private and must never travel — the design is
 * explicit that a grant is "written through the daemon API — never an op, per
 * the journey's rule 5" — so putting them behind this seam is what makes "no
 * grant ever appears in an oplog envelope" a fact about the code rather than
 * a convention somebody could break by adding an op.
 *
 * Phase 8 adds the THIRD: passes, at `passes/{id}`, in exactly the shape the
 * grants ledger has and for exactly the same reason — a pass is a credential
 * an innkeeper hands out, it must never travel to a replica, and the seam is
 * what makes that a fact rather than a convention. It is the one ledger with
 * a genuinely single-use row, and `redeemPass` is where that lives.
 *
 * ## The rule a query-backed desk lives or dies by
 *
 * `claimants`, `holdersOf` and `claimsIn` are served by INDEXED QUERIES over
 * the denormalized `claimIds` / `claimKeys` / `admittedTo` arrays, and a
 * backing that serves them that way MUST NOT KEEP A FALLBACK. No "if the
 * query came back empty, scan the collection". A fallback would make a badge
 * whose arrays were never written answer correctly anyway — which is phase
 * 3's named failure mode wearing a helpful face, and it would hide the one
 * bug that matters here until it was somebody else's outage. Let a forgotten
 * array answer nothing, loudly, on the first test that asks.
 *
 * `grantsFor` obeys the same rule, and phase 7 leans on it harder than the
 * claim queries do, because the answer is now the DOOR. "No grants for this
 * canvas means the link is implied" is the same fallback wearing the same
 * helpful face: it would make a canvas whose grant row was never written
 * admit everybody anyway, and the one bug that matters — a birth path that
 * forgot to write the row — would surface as an outage rather than as a test.
 * So the rows are written, everywhere a canvas can come into existence, and a
 * canvas with no rows admits nobody.
 */

/**
 * Why a badge is in a canvas — and, from phase 7, **revocation's grip**.
 *
 * Phase 9's sweep works by walking admissions whose root names a revoked
 * grant and re-running the door test on each, so a phase that writes this
 * wrong makes that sweep silently incomplete: an admission mis-rooted as
 * `link` is one no revocation can ever find. Every admission the door writes
 * now carries the grant that actually admitted it.
 */
export type Provenance =
  /** This badge created the canvas — the bootstrap badge's first admission.
   * The only root that is not "somebody let me in", and the only one a sweep
   * never touches. */
  | { root: "created" }
  /**
   * HISTORICAL, and kept because desks in the world are full of it: phase 2
   * through phase 6 wrote this for "the address admitted it", before the
   * link grant existed to point at. Nothing writes it any more. A sweep
   * cannot re-root one of these to a grant it never named, which is the
   * concrete cost of having written provenance before there was any, and the
   * reason phase 7 is careful to write `grant` from the first admission.
   */
  | { root: "link" }
  /**
   * Redeemed a pass (phase 8). `badgeId` is the badge that MINTED it, which is
   * what makes the chain walkable: a pass-derived admission inherits the root
   * of its minter, one hop at a time, so a sweep that starts at a revoked
   * grant reaches Jordan's daemon and Nico however many passes away they are.
   * Written by `redeemPass` in `passes.ts` and nowhere else.
   */
  | { root: "pass"; badgeId: string }
  /** Admitted by a grant — the ordinary case from phase 7 on. */
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

/**
 * One pass, as the desk holds it: the wire row plus the secret's hash.
 *
 * The split is the badge's, for the badge's reason. `Pass` (in core) is what
 * the API hands back and what a caller may keep; the hash never crosses the
 * wire and never leaves this seam, so a leaked ledger leaks no redeemable
 * tokens. SHA-256 and not a KDF, again for the badge's reason: the secret is
 * 256 bits of CSPRNG, there is no dictionary to slow down, and the comparison
 * is timing-safe because that is the threat that is real.
 */
export interface PassRecord extends Pass {
  secretHash: string;
}

export interface Desk {
  init(): Promise<void>;

  /** Release whatever the backing holds open — the twin of `Store.close`, and
   * for the same reason: a gRPC channel nobody closes is a process that never
   * exits and a vitest worker that hangs. */
  close(): Promise<void>;

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

  /* ---- reading claims: four questions, four queries ----
   *
   * These replace phase 2's whole-table `claims()`. Each one is a shape a
   * cloud backing can actually serve — a document read, or one indexed query
   * over a denormalized array — and each one answers a DIFFERENT question,
   * which is the point: mechanism 10's lesson is that "the registry" is three
   * kinds of fact with three different scopes, and a single whole-table read
   * hid that by answering all of them at once.
   *
   * The migration shelf rides along in `claimants`, `holdersOf` and
   * `claimsIn` exactly as it rode inside the old table, so a legacy row is
   * seen by "is this name taken" and "was this actor claimed just now" the
   * way it was before the re-key. It belongs to no badge and therefore to no
   * admission, so it is in every scope on the one home that has one.
   */

  /** One badge's claims — its own row, and the definition of "mine". */
  claimsOf(badgeId: string): Promise<ActorClaim[]>;

  /**
   * Every claim on one actor, anywhere on the desk, shelf included. Actor ids
   * are global and never recycled, so this question is deliberately NOT
   * admission-scoped: reincarnating a live actor must be refused however far
   * away its holder sits. Firestore: `where("claimIds", "array-contains",
   * actorId)` over the denormalized id list on each badge.
   */
  claimants(actorId: string): Promise<ActorClaim[]>;

  /**
   * Who holds a claim under this session key — the badge id beside the row,
   * with `SHELF` for a row still on the migration shelf. Answers "is this key
   * claimed on a badge that is not mine?" (the lost-badge recovery route) and
   * "has this legacy key been collected?" (the `agents.json` migration).
   * Firestore: `where("claimKeys", "array-contains", sessionKey)`.
   */
  holdersOf(sessionKey: string): Promise<{ badgeId: string; claim: ActorClaim }[]>;

  /**
   * Every claim held by a badge admitted to any of these canvases, plus the
   * shelf — mechanism 10's name scope. Firestore:
   * `where("admittedTo", "array-contains-any", …)` over the badges.
   *
   * Empty list in, shelf only out: a badge that has never been in a canvas
   * shares a roster with nobody, so there is nobody for its names to collide
   * with. That is the design's answer, not an oversight — late collisions are
   * survivable by construction, because the vocabulary already mints
   * deliberate duplicates (`actor.claim` with `fresh:`) and every client
   * already renders two same-named actors distinguishably.
   */
  claimsIn(canvasIds: readonly string[]): Promise<ActorClaim[]>;

  /** Record that this badge has been in this canvas. No longer policy-free:
   * from phase 7 the door decides whether this is called at all, and the
   * provenance it passes is what phase 9's sweep will grip. */
  admit(badgeId: string, canvasId: string, provenance: Provenance): Promise<void>;

  // ---- grants: who may enter one canvas (mechanisms 3 + 2) ----

  /**
   * Every grant on one canvas, revoked rows included.
   *
   * `where("canvasId", "==", canvasId)` over `grants/{id}` — the architecture's
   * shape, and the query the door takes on every arrival that is not already
   * admitted. Revoked rows come back because the caller's questions differ: the
   * door filters them out (`isLive`), the listing route hides them, and phase
   * 9's sweep needs to READ one to know what it is expelling.
   *
   * No fallback, per the rule above: a canvas with no rows admits nobody.
   */
  grantsFor(canvasId: string): Promise<Grant[]>;

  /** Write one. Used at birth (the standing link grant), by the migration, and
   * by the grant API. A grant id is minted by the caller, so this is a plain
   * document write. */
  putGrant(grant: Grant): Promise<void>;

  /**
   * Stop a grant admitting new arrivals — a tombstone, not a delete (see
   * `Grant.revokedAt`). Returns the revoked row, or null when there is no such
   * grant. Revoking an already-revoked row is a no-op that returns it: the
   * gesture is idempotent because a Share dialog and a CLI verb can both be
   * pointed at the same row by two people at once, and "the link is off" is
   * the same answer either way.
   */
  revokeGrant(grantId: string, at: string, by: string): Promise<Grant | null>;

  // ---- passes: what an admitted badge hands an unadmitted one (phase 8) ----

  /**
   * Write a freshly minted pass. A plain document write at `passes/{id}`: the
   * id is minted by the caller and a pass is never edited except by being
   * redeemed, which is `redeemPass` below.
   */
  putPass(pass: PassRecord): Promise<void>;

  /** The pass behind a presented id, or null for one this home does not know.
   * The desk seam's no-fallback rule in its plainest form: an unknown pass
   * answers nothing, and the route turns that into `unknown-pass`. */
  pass(passId: string): Promise<PassRecord | null>;

  /**
   * **Spend a pass, at most once, ever.**
   *
   * The whole security property of a pass lives in this one method, so its
   * contract is stated rather than implied: two redemptions of one pass
   * racing — two terminals, two tabs, a retry that was not as failed as it
   * looked — must not both win. Exactly one caller gets `redeemed: true`; the
   * other gets `redeemed: false` and the row as the winner left it, so it can
   * say *when* and *by whom* rather than "no".
   *
   * `null` means there is no such pass at all, which is a different answer
   * from "already spent" and must stay one (phase 7's finding: a caller must
   * be able to tell them apart).
   *
   * Expiry is deliberately NOT judged here. It is a pure function of the row
   * and the clock, the caller has both, and a desk method that could refuse
   * for two unrelated reasons is a method whose callers stop reading the
   * answer. `CloudDesk` implements this as a transaction; `FileDesk` gets it
   * from its own serialized write chain.
   */
  redeemPass(
    passId: string,
    at: string,
    by: string,
  ): Promise<{ pass: PassRecord; redeemed: boolean } | null>;

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
