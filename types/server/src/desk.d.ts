import type { ActorClaim, Attestation, BadgeKind, CanvasTakedown, Capability, Grant, GrantSubject, Group, OperatorAct, OperatorEnd, Pass, PurgeCounts, SeenMark, SeenMarks, Space } from "../../core/src/index.js";
/** Re-exported so `BadgeRecord`'s neighbours keep importing it from here, and
 * so the type has one definition. It moved to core in phase 9 because
 * `BadgeSummary` puts it on the wire — see `core/badge.ts`. */
export type { BadgeKind };
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
{
    root: "created";
}
/**
 * HISTORICAL, and kept because desks in the world are full of it: phase 2
 * through phase 6 wrote this for "the address admitted it", before the
 * link grant existed to point at. Nothing writes it any more. A sweep
 * cannot re-root one of these to a grant it never named, which is the
 * concrete cost of having written provenance before there was any, and the
 * reason phase 7 is careful to write `grant` from the first admission.
 *
 * **Phase 9 measured what that cost actually is, and chose to pay it.** The
 * sweep treats a `link` root as STANDING — it names no grant, so no
 * revocation can find it, and re-testing it against the door would be the
 * sweep inventing a root the desk never wrote. So a badge admitted before
 * phase 7 survives every revocation of every grant on that canvas, and the
 * only thing that reaches it is kill-a-badge. That is a real hole in
 * revocation and it is bounded: it can only ever contain badges minted
 * between phase 2 and phase 7, on a home that has run continuously since,
 * and it shrinks to nothing on any home born after phase 7. Sweeping them
 * anyway was considered and refused — it would mean a revocation expelling
 * holders it cannot name, which is worse than one that visibly cannot reach
 * them.
 */
 | {
    root: "link";
}
/**
 * Redeemed a pass (phase 8). `badgeId` is the badge that MINTED it, which is
 * what makes the chain walkable: a pass-derived admission inherits the root
 * of its minter, one hop at a time, so a sweep that starts at a revoked
 * grant reaches Jordan's daemon and Nico however many passes away they are.
 * Written by `redeemPass` in `passes.ts` and nowhere else.
 */
 | {
    root: "pass";
    badgeId: string;
}
/** Admitted by a grant — the ordinary case from phase 7 on. The row may be
 * on the canvas or on its space (roles phase 4): the provenance names the
 * row's id whichever scope it came from, and the sweep looks in both. */
 | {
    root: "grant";
    grantId: string;
}
/**
 * **Admitted by a space creator's floor** (roles phase 4). The badge claims
 * the actor who made the space this canvas is in, and holds `own` over
 * every canvas in it without a row — the same floor `created` is for the
 * canvas's own creator, with one difference that is the whole reason this
 * is a separate root: a canvas can LEAVE a space, so this admission must be
 * re-asked by every sweep, where `created` is never touched.
 */
 | {
    root: "space";
    spaceId: string;
}
/**
 * **The operator, looking** (operator phase 2; design, "The look").
 *
 * The operator must judge a report and the canvas may be closed to the
 * address, so `isocan operator look` mints — after the proof, and only after
 * it — a pass the home redeems into the operator's browser as this. It is
 * unlike every root above in three ways, and each is deliberate:
 *
 * - **It expires**, and it is the first admission in this system that does.
 *   Everything else is live until somebody revokes it; a look is a window a
 *   person opened for one report, and `until` is what closes it without
 *   anybody remembering to. The door reads it (`liveAdmission` in
 *   `grants.ts`); an expired one falls through to the ordinary door test and
 *   the operator meets the refusal any stranger gets — journey 2 step 3,
 *   which is the whole proof that the look ended.
 * - **The sweep leaves it alone**, as it leaves `created`: it names no grant
 *   row, so no revocation can find it, and re-testing it against the door
 *   would be the sweep inventing a root the desk never wrote.
 * - **It is admitted at `view`**, which is what keeps a look unannounced
 *   without any code that hides anybody: a `view` connection is not in
 *   presence, for every viewer, and that is the rule rather than an
 *   exception made for this one.
 *
 * The ledger, not this row, is the counterweight: the home reads everything
 * it hosts, so a look is never unrecorded even when it is unannounced.
 */
 | {
    root: "operator";
    until: string;
};
export interface Admission {
    canvasId: string;
    provenance: Provenance;
    at: string;
    /**
     * What this admission lets the holder DO (#88) — copied from the admitting
     * grant at the door, because the door test short-circuits on `canvasId ∈
     * admissions` and never consults the grant again: a capability that lived
     * only on the grant row would be read once and then never enforced.
     *
     * Written whenever it is not `edit` (`narrowed` in core); absent is
     * `edit`, which is what every admission written before the field meant.
     * A `created` root is the creator's floor and never narrows; a `pass` root
     * endows what its minter had.
     */
    capability?: Capability;
}
/**
 * One badge, as the desk holds it.
 *
 * Never crosses the wire: this type belongs here the way `LoadedCanvas`
 * belongs in `store.ts`. What a client sees of a badge is its id and, once,
 * its secret — and, from phase 9, a `BadgeSummary` of its own surfaces.
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
     * 2 — phase 3 re-asks `canvasId ∈ admissions` per route, and a phase 3
     * that inherited empty lists would have to backfill them under a check
     * that was already live. */
    admissions: Admission[];
    /** Who this badge may speak as. Several, on purpose: a browser's personas,
     * or everyone a machine's daemon relays. */
    claims: ActorClaim[];
    /**
     * What this holder has PROVED — mechanism 3's "attestations ride the badge",
     * and the field phase 2 refused to write until something could fill it.
     *
     * Phase 2's note read: *"`attestations` is DELIBERATELY absent. Phase 9 owns
     * it, nothing writes it, and an array that is always empty is a speculative
     * clean seam where phase 1's lesson asks for an honest leaky one."* Phase 9
     * earns it — the door genuinely reads this array now (`admittingGrant`), the
     * sweep re-roots on it, and `Desk.attest` genuinely writes it.
     *
     * **What is still empty is the ATTESTER, and that is stated rather than
     * papered over.** Stage 1 ships no code that verifies an email or a GitHub
     * identity; `server/attest.ts` says so out loud and the grant API refuses a
     * subject this home cannot verify. So in a shipped stage-1 home this array
     * is empty in practice — but it is empty because nobody has proved anything
     * yet, which is a different thing from being empty because nothing reads it.
     *
     * Optional, so that every badge document written before phase 9 loads
     * without a migration. An absent array reads as "has proved nothing", which
     * is the truth about every badge that predates attesters and the only safe
     * reading of a missing field at a door.
     */
    attestations?: Attestation[];
    /**
     * When this badge stopped being recognised — kill-a-badge, mechanism 1's
     * enforcement primitive.
     *
     * **A tombstone, never a delete**, for `Grant.revokedAt`'s two reasons and
     * one of its own. Audit: "which surface was ended, when, and by whom" is the
     * question asked after a laptop goes missing. Provenance: a pass-derived
     * admission names its minter by id, and an id that pointed at nothing would
     * be a chain the sweep could not tell from one it had never seen. And
     * reuse: an id that could be minted again is an id a killed badge could come
     * back as.
     *
     * A killed badge is **a badge nobody holds**: `badge()` refuses it, so it can
     * never authenticate again, and it drops out of every query, so its claims
     * stop counting as held and its admissions stop counting as scope.
     */
    killedAt?: string;
    /** Which badge ended it. The holder itself, for a plain sign-out. */
    killedBy?: string;
    /**
     * **The operator's half of the tombstone** (operator phase 4), present
     * only when the operator ended it: the reason category the person is
     * shown, the address that acted, and the ledger row that did it. Absent
     * on every end by the holder, and absent means exactly that — the sentence
     * the 401 carries branches on it, and so does the CLI's re-badge.
     */
    end?: OperatorEnd;
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
     * know — a home that was wiped, and from phase 9 a badge that was killed.
     * The two answer alike on purpose: `bad-badge` already means "throw away
     * what you stored and get a new one", which is exactly what the holder of a
     * killed badge should do. */
    badge(badgeId: string): Promise<BadgeRecord | null>;
    /** Freshen `lastSeen`. Separate from `put` because it happens on every
     * request and a backing may debounce it; the file backing does. */
    touch(badgeId: string, at: string): Promise<void>;
    /** Replace one badge's claim list. Called from the engine's chain, with
     * what `applyClaim` returned. */
    setClaims(badgeId: string, claims: ActorClaim[]): Promise<void>;
    /** One badge's claims — its own row, and the definition of "mine". */
    claimsOf(badgeId: string): Promise<ActorClaim[]>;
    /**
     * Every claim on one actor, anywhere on the desk, shelf included — **with
     * the badge id beside each row**. Actor ids are global and never recycled,
     * so this question is deliberately NOT admission-scoped: reincarnating a
     * live actor must be refused however far away its holder sits. Firestore:
     * `where("claimIds", "array-contains", actorId)` over the denormalized id
     * list on each badge.
     *
     * **The badge id is phase 9's addition, and it is why there is no second
     * method here.** Kill-a-badge needs to name your other surfaces, and "a
     * surface of yours" is exactly "a badge holding a claim on an actor this
     * badge claims" — the same query, with the id the query already walked. A
     * `holdersOfActor` beside this one would be a second spelling of one index,
     * which is the kind of duplication that ends with the two disagreeing.
     * `holdersOf` has answered in this shape since phase 3, `SHELF` and all.
     */
    claimants(actorId: string): Promise<{
        badgeId: string;
        claim: ActorClaim;
    }[]>;
    /**
     * Who holds a claim under this session key — the badge id beside the row,
     * with `SHELF` for a row still on the migration shelf. Answers "is this key
     * claimed on a badge that is not mine?" (the lost-badge recovery route) and
     * "has this legacy key been collected?" (the `agents.json` migration).
     * Firestore: `where("claimKeys", "array-contains", sessionKey)`.
     */
    holdersOf(sessionKey: string): Promise<{
        badgeId: string;
        claim: ActorClaim;
    }[]>;
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
     * provenance it passes is what phase 9's sweep grips. `capability` is
     * stored whenever it is not edit (`narrowed`, #88 widened by the roles
     * ladder); omitted means edit. */
    admit(badgeId: string, canvasId: string, provenance: Provenance, capability?: Capability): Promise<void>;
    /**
     * **Every live badge admitted to one canvas** — the population the sweep
     * walks, and mechanism 1's "who has been here is a per-canvas listing of
     * badges" arriving for the first time.
     *
     * Firestore: `where("admittedTo", "array-contains", canvasId)`, the array
     * `denormalize` has maintained since phase 4 for exactly the queries that
     * had not been written yet. Killed badges are not returned: a badge that can
     * no longer authenticate is not somebody the door has to reconsider, and
     * leaving them in would make every sweep report an expulsion that had
     * already happened.
     *
     * No fallback, per the rule above. A canvas whose badges never wrote
     * `admittedTo` sweeps nobody, loudly, rather than being rescued by a scan.
     */
    badgesIn(canvasId: string): Promise<BadgeRecord[]>;
    /**
     * Rewrite one admission's provenance — **re-rooting**, the half of the sweep
     * that nobody expects and the design insists on. A badge whose attestations
     * satisfy a surviving grant keeps the canvas and comes to be there for a new
     * reason; without this, "turning off the link would expel the very people
     * who were invited by name".
     *
     * A no-op when the badge is not admitted here: two sweeps racing (a person
     * in a browser and an agent at a terminal revoking two grants at once) must
     * not resurrect an admission one of them has just dropped.
     */
    /** The capability is REWRITTEN with the provenance, not carried over: a
     * re-root means "here for a new reason", and the new reason's grant says
     * what it admits to — a viewer re-rooted onto an edit grant is an editor
     * now, and the reverse downgrade is how "the link can only view now"
     * reaches the people already inside. */
    reroot(badgeId: string, canvasId: string, provenance: Provenance, capability?: Capability): Promise<void>;
    /** Drop one admission — the expulsion itself. Idempotent: expelling a badge
     * that is not here is what the second of two racing sweeps does, and it is
     * not an error. */
    expel(badgeId: string, canvasId: string): Promise<void>;
    /**
     * **End this holder's recognition.** Returns the record as it was at the
     * moment it died — the caller needs its admissions to know which canvases to
     * sweep, and its claims to say whose surface it was — or null when there is
     * no such live badge.
     *
     * Idempotent for the same reason `revokeGrant` is: the first stamp stands,
     * so two people ending one stolen laptop do not argue about when it went.
     *
     * `end` is the operator's half (operator phase 4), written onto the
     * tombstone beside the stamp when the operator is the hand; absent for
     * the holder's own end, and read back by `endedBadge`.
     */
    killBadge(badgeId: string, at: string, by: string, end?: OperatorEnd): Promise<BadgeRecord | null>;
    /**
     * **The tombstone behind an id, or null** (operator phase 4) — the one read
     * that answers about a badge nobody holds.
     *
     * `badge()` refuses a killed badge on purpose, and every query drops it, so
     * until this method the tombstone was written and never read back: the 401
     * a dead badge met said *this home does not know that badge*, which is what
     * a wiped home says too, and a pass the dead badge had minted was judged
     * without asking whether its minter lived. Both questions are this one:
     * *was this ended, when, and by whom* — with the operator's reason beside
     * it when there is one.
     *
     * Null for a badge that is alive, and null for one this home never had.
     * Those two answer alike because the caller has already asked `badge()`,
     * which told them apart; this is asked only after that came back empty.
     */
    endedBadge(badgeId: string): Promise<BadgeRecord | null>;
    /**
     * Write a verified attribute onto a badge, replacing any earlier attestation
     * of the SAME attribute.
     *
     * Upsert rather than append, because re-verifying is a thing people do and
     * two rows for one mailbox are not two proofs — they are one proof and a
     * stale copy, and the stale copy is the one a later freshness rule would
     * trip over. The newest `at` wins.
     *
     * **Nothing in stage 1 calls this except tests and the desk's own suite.**
     * That is the honest state of the seam: the attesters are stage 2 and need a
     * cloud resource, so this is the method they will call after they verify,
     * and it is real so that the door's branch above it can be proved without a
     * pretend verifier standing in for one. See `server/attest.ts`.
     */
    attest(badgeId: string, attestation: Attestation): Promise<void>;
    /**
     * **Every live badge that has proved this attribute** — the query person
     * resumption is made of (mechanism 6).
     *
     * A badge attesting `email:jordan@…` and a badge that CLAIMED an actor are
     * the same person when they share that attribute, which is the design's
     * whole sentence about a phone being Jordan. Answering it needs the reverse
     * of `attest`: not "what has this badge proved" (a document read) but "who
     * else has proved this" — one indexed query over the denormalized
     * `attested` array, exactly the shape `badgesIn` takes over `admittedTo`.
     *
     * **Not derived from `claimants` instead**, though it looks like it could
     * be. Going the other way — take the actor, find its claimants, read their
     * attestations — answers the `as` check and nothing else. The surface a
     * person actually needs is the LISTING ("you may be Jordan here"), and that
     * question starts from the attribute, not from an actor id the phone has
     * never seen. One query serves both directions; two would drift.
     *
     * The attribute is compared as stored, so callers pass a normalized one —
     * `upsertAttestation` normalizes on the way in, so the rows are already
     * folded and a raw `Jordan@Acme.Test` would match nothing.
     *
     * No fallback, per this file's rule. A desk whose `attested` index was never
     * written vouches for nobody, loudly, rather than being rescued by a scan —
     * and the failure of THIS index is somebody being told to sign in again,
     * which is a far better failure than a badge resuming an actor it should
     * not.
     */
    badgesAttesting(attribute: string): Promise<BadgeRecord[]>;
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
    /**
     * Every grant on one SPACE, revoked rows included — `grantsFor`'s twin over
     * the other arm of `GrantScope` (roles phase 4). `where("spaceId", "==",
     * spaceId)`, a single-field equality Firestore serves from its automatic
     * index. Kept beside `grantsFor` rather than folded into it, so no caller
     * that asks about one canvas suddenly sees rows it did not ask for; the
     * door merges the two itself. No fallback: a space with no rows admits
     * nobody but its creator.
     */
    grantsForSpace(spaceId: string): Promise<Grant[]>;
    /**
     * **Every LIVE row naming this subject, in either scope** (roles phase 5)
     * — `where("subject", "==", subject)` over the grants, a single-field
     * equality. What a change to a group has to reach: the server walks these
     * rows, takes a canvas row's canvas and a space row's whole list, and
     * sweeps each. Live rows only, because a revoked row reaches nobody and
     * the caller would otherwise sweep canvases that have nothing to
     * recompute. No fallback: a subject nobody granted reaches nothing.
     */
    grantsBySubject(subject: GrantSubject): Promise<Grant[]>;
    /** Write one, whole — creation and every change alike (a canvas added or
     * removed, the tombstone). The id is minted by the caller. */
    putSpace(space: Space): Promise<void>;
    /** The space behind an id, tombstone included, or null for one this home
     * does not know. Deleted spaces come back so a route can tell "gone" from
     * "never was" and a delete can be idempotent; they are nobody's answer to
     * `spaceOf` or `spacesFor`. */
    space(spaceId: string): Promise<Space | null>;
    /**
     * **The live space this canvas is in, or null when it is in none** — the
     * door's one extra read on every test, because a canvas in no space cannot
     * be told apart without asking. Firestore: `where("holding",
     * "array-contains", canvasId)` over the array the space document derives
     * from `canvasIds` while it stands and empties when it is deleted, so a
     * tombstone is not in the index at all. No fallback: a space whose array
     * was never written holds nothing, loudly.
     */
    spaceOf(canvasId: string): Promise<Space | null>;
    /**
     * **The live spaces this badge may see** (roles design, "Routes"): made by
     * an actor it claims, or named by a live row whose subject is one of its
     * attested attributes. Bounded queries and never a scan, per this file's
     * rule: one `createdBy` equality per claimed actor, one `subject` equality
     * over the grants per attested attribute (then the rows' `spaceId`s
     * fetched), and nothing else. A badge that claims nobody and has proved
     * nothing sees no space, which is the truth about it.
     *
     * The third branch (roles phase 5): the live groups whose `members` holds
     * one of the badge's attested attributes — Firestore `array-contains` on
     * `members` — and then the live rows whose subject is `group:<id>` that
     * name a space. One more bounded query per attribute, and nothing else
     * changed shape.
     */
    spacesFor(badge: BadgeRecord): Promise<Space[]>;
    /** Write one, whole — creation, a member added or removed, the tombstone.
     * The id is minted by the caller. */
    putGroup(group: Group): Promise<void>;
    /** The group behind an id, tombstone included, or null for one this home
     * does not know. Deleted groups come back so a route can tell "gone" from
     * "never was"; the door and `spacesFor` skip them, so a deleted group's
     * rows admit nobody. */
    group(groupId: string): Promise<Group | null>;
    /**
     * **The live groups this badge OWNS**: made by an actor it claims. One
     * `createdBy` equality per claimed actor and nothing else — a group a
     * person is merely in is not listed here, because the list is the owner's
     * (members and all) and a member sees a group only through the rows that
     * name it. A badge that claims nobody owns no group.
     */
    groupsFor(badge: BadgeRecord): Promise<Group[]>;
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
     * **Every pass one badge minted** (operator phase 4), spent and unspent —
     * the caller judges expiry and redemption, for `redeemPass`'s reason. The
     * one question asked of a pass by anything but its id, and it is asked by
     * the operator's `end` alone: *what did this badge leave outstanding* is
     * the count the verb prints beside the enrolments. Firestore:
     * `where("mintedBy", "==", badgeId)`, a single-field query the automatic
     * index serves.
     */
    passesMintedBy(badgeId: string): Promise<PassRecord[]>;
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
    redeemPass(passId: string, at: string, by: string): Promise<{
        pass: PassRecord;
        redeemed: boolean;
    } | null>;
    /**
     * **One person's marks, whole** — canvas id → `{ seq, at }`. An actor who
     * has never looked at anything has no row here, and an empty answer is the
     * truth about them rather than a fallback.
     *
     * Keyed by ACTOR and never by badge: a person on two machines holds two
     * badges and one actor, and the whole point is that the second machine
     * finds what the first one saw.
     */
    seenOf(actorId: string): Promise<SeenMarks>;
    /**
     * **Move one mark, monotonically.** The stored row and the incoming one are
     * merged with core's `advanceSeen` — a max on the seq and a max on the
     * instant, independently — and the merged mark is returned, which may be
     * AHEAD of what was passed in because another machine of this person's got
     * there first.
     *
     * The contract that matters is the same one `redeemPass` states: two
     * machines racing must converge, and neither may pull the other backwards.
     * Because the merge is a join on each component, that holds whatever order
     * the writes land in — but each write must still READ-MODIFY-WRITE without
     * interleaving, or a lost update undoes it. `CloudDesk` does that with a
     * transaction, `FileDesk` with its serialized write chain.
     */
    markSeen(actorId: string, canvasId: string, mark: SeenMark): Promise<SeenMark>;
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
    /**
     * **This home's HMAC key for signing content reads**, minted on first ask
     * and the same one ever after.
     *
     * It is on the desk rather than in the environment for the reason every
     * other ledger here is: it is a fact ABOUT this home that must outlive any
     * one process and be identical on every instance of it. A key in a
     * deployment variable is a key somebody must provision before the origin
     * works, forget to copy when they clone the home, and rotate by editing a
     * console — and a signature minted by one Cloud Run instance has to verify
     * on the next, which a per-process random key silently fails at exactly
     * when a second instance appears during a rollout.
     *
     * **It must therefore be create-once across concurrent callers.** Two
     * instances booting together must not mint two keys; the second to write
     * loses and adopts the first one's. `CloudDesk` does that with a
     * transaction, `FileDesk` with its serialized write chain — the same
     * split `redeemPass` has, and for the same reason.
     *
     * Rotation is not here yet, and `content-read-auth.md` names it open: the
     * shape it will take is a second key accepted while the first is still
     * being minted against, which is the badge desk's revocation machinery in
     * miniature. What is decided today is that when that lands, it lands in
     * this ledger.
     */
    contentKey(): Promise<string>;
    /**
     * **Write the act down, before it is answered.**
     *
     * The operator project's one rule for every phase: *every act writes its
     * ledger row before it answers, from the first act in phase 1. A power that
     * exists before its record does is the Firestore hand edit again.* So this
     * is called between "the proof checks out" and "the act runs", and a crash
     * in between leaves a row saying `attempted` — which is the point, and the
     * reason it is not one write at the end.
     *
     * It is a DESK collection and not an op, for the three reasons the design
     * gives and any one of which is sufficient: the op vocabulary is closed and
     * isomorphic, the canvas log replicates and belongs to its members, and the
     * log cannot carry authority. `operator/{id}` on Firestore, a line type in
     * the file desk's log.
     *
     * **Refusals are written too**, which is a decision this method's callers
     * make rather than one it enforces, recorded here because the alternative is
     * a ledger that records only what worked. A refused act is the interesting
     * one: `not-operator` is somebody who proved an address this home does not
     * recognise, at a moment, and a home that kept no record of that would be
     * unable to answer the only question anybody would ask afterwards. Nothing
     * is written before a token VERIFIES, because a token that does not verify
     * proved nothing and named nobody.
     */
    recordOperatorAct(act: OperatorAct): Promise<void>;
    /**
     * **How the act came out**, written onto the row that already exists.
     *
     * Not a second row. "Append-only" in the design is about ACTS — a lift is a
     * new row naming the one it lifts, never an edit of the row it lifts — and
     * settling the outcome of the act you are in the middle of is the other half
     * of writing the row first. A row whose outcome is still `attempted` is a
     * crash, and it can only mean that if a completed act stops saying it.
     */
    settleOperatorAct(id: string, outcome: string, reach?: unknown): Promise<void>;
    /**
     * **The ledger, newest first** — `isocan operator log`.
     *
     * Innkeeper-private, like every ledger on this desk: the operator reads it
     * and nobody else does over the wire. That is enforced by the route, which
     * demands the same proof every other operator act does; this method is the
     * read underneath it.
     *
     * `target` narrows to one canvas, badge, actor or address — the id a report
     * named — and is the only filter, because a filter on the OPERATOR would be
     * a question with one answer at every home that has one operator, and a
     * filter on the outcome is a thing to do to a list you already hold.
     */
    operatorActs(options?: {
        target?: string | null;
        limit?: number;
    }): Promise<OperatorAct[]>;
    /** Write the row. A lift is {@link liftTakedown}, never a second row here. */
    recordTakedown(row: CanvasTakedown): Promise<void>;
    /**
     * Mark the row lifted, keeping it. The row stays because journey 5 step 3
     * wants both halves readable — and because a row that vanished on a lift
     * would leave `isocan operator log`'s two acts pointing at nothing.
     *
     * Silent when there is no row: the caller has already refused a lift on a
     * canvas that is not down, and a throw here would turn a settled act into a
     * failure the operator reads as the lift not having happened.
     */
    liftTakedown(canvasId: string, lifted: {
        at: string;
        by: string;
        actId: string;
    }): Promise<void>;
    /**
     * **Mark the row purged, keeping it** (operator phase 3). The same rewrite a
     * lift is, in the other direction: a purged row is never lifted, and the
     * counts ride on it because the record journey 6 step 3 says stays — *who
     * made it, when it came down, why, and the counts* — is this row and the
     * ledger's act, one lookup apart.
     *
     * Silent when there is no row, for `liftTakedown`'s reason: the route has
     * already refused a purge on a canvas that is not down.
     */
    markPurged(canvasId: string, purged: {
        at: string;
        actId: string;
        counts: PurgeCounts;
    }): Promise<void>;
    /** The row for one canvas, lifted or not — null when there has never been
     * one. Callers ask {@link inForce} about what comes back; a lifted row is
     * still an answer, and "there was one, and it was lifted on the 14th" is a
     * thing an innkeeper is asked. */
    takedownFor(canvasId: string): Promise<CanvasTakedown | null>;
    /**
     * **Every takedown in force at this home.**
     *
     * The whole set rather than a lookup, because that is what its two readers
     * want: the in-memory registry the door consults (loaded at boot, re-read on
     * write — the same shape the design gives home-scope refusals) and the
     * canvas list, which needs the sentence for every row it draws. It is small
     * by construction: a row exists only because a person read a report and
     * acted, and a home with a hundred of them has a different problem.
     */
    takedowns(): Promise<CanvasTakedown[]>;
}
