import { randomBytes } from "node:crypto";
import type { DocumentData, Firestore } from "@google-cloud/firestore";
import type {
  ActorClaim,
  Attestation,
  CanvasTakedown,
  Capability,
  Grant,
  GrantSubject,
  Group,
  HomeRefusal,
  OperatorAct,
  OperatorEnd,
  OperatorRevocation,
  PurgeCounts,
  SeenMark,
  SeenMarks,
  Space,
} from "@isocan/core";
import {
  advanceSeen,
  groupSubject,
  isCapability,
  isGroupLive,
  isLive,
  isSpaceLive,
  narrowed,
  SHELF,
  upsertAttestation,
} from "@isocan/core";
import { liveAdmission } from "@isocan/server";
import type { Admission, BadgeRecord, Desk, PassRecord, Provenance } from "@isocan/server";

export const BADGES = "badges";
/** `grants/{id}` — the architecture's other desk row, one document per grant,
 * queried by `canvasId`. A collection rather than an array on the canvas
 * because the canvas lives in the OTHER ledger entirely: canvas state
 * replicates, the desk's ledgers never leave the home, and a grant that rode
 * on a canvas document would be a grant that travelled. */
export const GRANTS = "grants";
/** `passes/{id}` — the desk's third row (phase 8). A collection for the same
 * reason grants are one, plus a sharper one: a pass is redeemed exactly once,
 * and single-use across two instances of a home has to be a TRANSACTION on
 * one document. A pass that lived inside an array on some other document
 * would be a pass whose spending raced with every other write to that
 * document. */
export const PASSES = "passes";
/**
 * `spaces/{id}` — the desk's fourth row (roles phase 4). A collection for the
 * grants' reason: a space is part of what a grant means, and what a grant
 * means never leaves the home. Queried three ways, each a single-field
 * question Firestore's automatic indexes serve with nothing in
 * `firestore.indexes.json`: `holding array-contains <canvasId>` (`spaceOf`),
 * `createdBy == <actorId>` (`spacesFor`), and by id. `holding` is derived from
 * `canvasIds` by the one writer below and EMPTIED on the tombstone, so a
 * deleted space drops out of `spaceOf` by not being in the index, the way a
 * killed badge drops out of `badgesIn`.
 *
 * **If the hosted home ever needs a composite index here, it is this one:**
 * none today. Every query is one field. A later `where("createdBy").where(
 * "deletedAt")` would be the first, and the note belongs beside the query
 * that needs it.
 */
export const SPACES = "spaces";
/**
 * `groups/{id}` — the desk's fifth row (roles phase 5). Queried two ways,
 * both single-field and served by the automatic indexes with nothing in
 * `firestore.indexes.json`: `createdBy == <actorId>` (`groupsFor`) and
 * `members array-contains <attribute>` (`spacesFor`'s group branch). A
 * tombstone keeps its `members` — the row is the record of who was in it —
 * and is dropped in memory by the one query that could meet it, from a list
 * already bounded to one attribute's groups. The door never queries this
 * collection: it reads one document per `group:` row, by id.
 */
export const GROUPS = "groups";
/**
 * `seen/{actorId}` — the desk's sixth row (#147, #134): what one person has
 * already looked at, `{ marks: { <canvasId>: { seq, at } } }`.
 *
 * **One document per PERSON rather than per (person, canvas)**, and the
 * reason is the read it exists for: the inbox and the switcher both want
 * every mark this person holds, in one go, before they can say anything at
 * all. A row per pair would make that a collection query on every home
 * screen; a document per person is one `get`, and the number of canvases one
 * person visits is small and bounded by their own attention.
 *
 * **Never queried** — only read and written by actor id — so there is no
 * index here and no denormalized array, and there is deliberately no way to
 * ask this collection who has seen a canvas. That absence is the privacy
 * guarantee (D5): the shape of the ledger is what makes read receipts
 * something somebody would have to go and build rather than something they
 * could accidentally expose.
 */
export const SEEN = "seen";
/**
 * `operator/{id}` — the desk's seventh row, and the first one that records a
 * POWER rather than an access (operator phase 1).
 *
 * A collection for the grants' reason and a sharper one: it is append-only by
 * intent — a lift is a new row naming the one it lifts — so it only ever
 * grows, and a ledger that grew inside an array on some other document would
 * eventually stop being writable at all. Queried two ways, both single-field
 * and served by the automatic indexes with nothing in
 * `firestore.indexes.json`: `orderBy("at", "desc")` for the log, and
 * `target == <id>` for one canvas's or one badge's history. See
 * `operatorActs` for why those two are deliberately never combined.
 *
 * Innkeeper-private like every other ledger here, and more so: the operator
 * reads it over the wire and nobody else does.
 */
export const OPERATOR = "operator";

/**
 * `takedowns/{canvasId}` (operator phase 2) — **keyed by the canvas**, which
 * is the one difference from the ledger beside it.
 *
 * The ledger is acts and only grows; this is standing state and there is
 * exactly one answer per canvas, so the document id IS the question. A lift
 * merges onto the same document rather than adding a row: two rows would make
 * "is this canvas down" a query that could return both, and the door asks it
 * on a request path.
 *
 * One query, single-field and served by the automatic index — `liftedAt ==
 * null` for the ones in force. `liftedAt` is therefore written explicitly as
 * `null` rather than omitted, because Firestore cannot query for a field's
 * absence.
 */
export const TAKEDOWNS = "takedowns";

/**
 * `refusals/{subject}` (operator phase 6) — keyed by the subject, for the
 * takedown row's reason: standing state with exactly one answer per subject,
 * so the document id IS the question, and a lift merges onto it.
 *
 * The id is the subject with its one forbidden character escaped: a document
 * id may not contain `/`, and `net:203.0.113.0/24` does. `%2F` is what
 * {@link refusalDocId} writes and nothing reads back — the row carries the
 * subject whole, so the escape is an address and never a spelling.
 *
 * `liftedAt: null` is written explicitly, for `TAKEDOWNS`' reason: the one
 * query, `liftedAt == null`, needs no composite index and no in-memory
 * filter. Expiry is NOT queried here — the desk keeps no clock, and the
 * registry judges `expiresAt` against the one it is handed (see `Desk`).
 */
export const REFUSALS = "refusals";

/** The subject as a document id. */
export function refusalDocId(subject: string): string {
  return subject.replace(/\//g, "%2F");
}
/** The migration shelf: pre-badge claims waiting for the session key that
 * will collect them. It belongs to no badge, so it has no home in
 * `badges/{badgeId}` — one document, keyed by sessionKey, and it dies when it
 * empties. One document is right precisely because it is finite and shrinking;
 * nothing new is ever shelved. */
export const SHELF_DOC = "meta/shelf";
/**
 * `meta/content-key` — the HMAC key this home signs content reads with
 * (`docs/projects/multiuser/content-read-auth.md`, option A). One document,
 * because there is exactly one key; beside the shelf under `meta/` because
 * neither is a ledger of rows, and both belong to the home rather than to
 * anybody in it.
 *
 * **It is the one document here that is created in a transaction for
 * uniqueness rather than for atomicity.** A rollout runs two instances of
 * this home for a few seconds; if both minted a key, half the frames on
 * every open tab would fail to verify until one instance drained. The
 * transaction makes the second minter adopt the first's key instead.
 */
export const CONTENT_KEY_DOC = "meta/content-key";

/**
 * How stale `lastSeen` may get before a touch costs a write.
 *
 * On a disk this is an optimization. Here it is a CORRECTNESS requirement:
 * `touch` runs on every request, `badges/{badgeId}` is a single document, and
 * Firestore sustains roughly one write per second per document. A hosted home
 * that wrote `lastSeen` on every request would contend with itself on the
 * hottest document it has, for a field nothing reads yet.
 */
const TOUCH_DEBOUNCE_MS = 60_000;

/** `array-contains-any` takes at most this many values per query. */
const DISJUNCTION_LIMIT = 30;

/**
 * The desk on Firestore: one document per badge at `badges/{badgeId}`, from
 * phase 7 one per grant at `grants/{id}`, and from phase 8 one per pass at
 * `passes/{id}` — exactly the shapes the architecture draws.
 *
 * ## The denormalized arrays, and the one function every write goes through
 *
 * `claimIds`, `claimKeys`, `admittedTo` and — from phase 9 stage 2 —
 * `attested` are the same data denormalized, one array per question the desk
 * is actually asked, because each is an `array-contains` here and a
 * whole-table scan everywhere else. Phase 3's warning is exact: a CloudDesk
 * that does not write them on every claim and every admission passes the suite
 * on a FileDesk and answers nothing in the cloud.
 *
 * So they cannot be forgotten, structurally: **every write of a badge document
 * passes its record through `denormalize()`**, which derives all four arrays
 * from `claims`, `admissions` and `attestations` on every call. There is no
 * code path that writes a claim and a separate code path that writes an array
 * — they are the same statement.
 *
 * **This used to say "nothing writes a badge except `writeBadge`", and by
 * September that was false** — `mutate`, `killBadge` and the claim transaction
 * had grown their own `tx.set`, four write sites where the sentence promised
 * one. The invariant had not broken; its statement had. That is worse than an
 * ordinary stale comment, because the sentence went on to tell a reviewer
 * their whole job here was to confirm there is one writer: anybody doing that
 * job in September would conclude the file was broken, or add a fifth writer
 * by yet another path and believe it was fine (step 5 of
 * `docs/research/2026-09-06-architecture-review.md`).
 *
 * So it is restated as what it actually is, and given a guard rather than a
 * request: `cloud-desk-arrays.test.ts` reads this source and fails on a
 * `tx.set`/`.set(` of a badge document whose argument does not go through
 * `denormalize`. The next writer cannot skip it quietly.
 *
 * **`lastSeen` is the one exception, and it is exact**: `touch` merges that
 * leaf alone. It is the only thing about a badge that changes without any of
 * the arrays changing, which is what makes a merge safe there and nowhere
 * else.
 *
 * ## And reads are forbidden a fallback
 *
 * `claimants`, `holdersOf` and `claimsIn` are ONLY queries. No "if the query
 * came back empty, scan the collection". A fallback would make a badge whose
 * arrays were never written answer correctly anyway — phase 3's failure mode
 * wearing a helpful face — and would hide the one bug that matters here until
 * it was somebody else's outage. `desk.ts` states this rule; this file obeys
 * it, and `cloud-desk-arrays.test.ts` reads the raw documents to prove no
 * read-side cleverness is faking it.
 */
export class CloudDesk implements Desk {
  private readonly db: Firestore;
  private readonly shutdown: (() => Promise<void>) | undefined;
  /** `lastSeen` as last WRITTEN, per badge — what the debounce measures
   * drift against. Purely an optimization cache: losing it costs one extra
   * write, never a wrong answer. */
  private readonly lastWrittenSeen = new Map<string, number>();
  /** This home's content-signing key, once read. It cannot change while the
   * process is up — see `contentKey`. */
  private cachedContentKey: string | null = null;

  constructor(options: { firestore: Firestore; shutdown?: () => Promise<void> }) {
    this.db = options.firestore;
    this.shutdown = options.shutdown;
  }

  async init(): Promise<void> {}

  async close(): Promise<void> {
    await this.shutdown?.();
  }

  async put(badge: BadgeRecord): Promise<void> {
    await this.writeBadge(badge);
  }

  /** Null for a killed badge, exactly as for one this home never minted —
   * the desk seam's contract, and what turns a kill into `bad-badge` at the
   * killed holder's very next request. */
  async badge(badgeId: string): Promise<BadgeRecord | null> {
    const doc = await this.db.collection(BADGES).doc(badgeId).get();
    if (!doc.exists) return null;
    const record = toRecord(doc.data()!);
    return record.killedAt === undefined ? record : null;
  }

  async touch(badgeId: string, at: string): Promise<void> {
    const stamp = Date.parse(at);
    const written = this.lastWrittenSeen.get(badgeId);
    if (written !== undefined && stamp - written < TOUCH_DEBOUNCE_MS) return;
    const ref = this.db.collection(BADGES).doc(badgeId);
    const doc = await ref.get();
    if (!doc.exists) return;
    if (typeof doc.data()!["killedAt"] === "string") return; // nobody holds it
    const previous = Date.parse((doc.data()!["lastSeen"] as string) ?? at);
    this.lastWrittenSeen.set(badgeId, stamp);
    if (!(stamp - previous >= TOUCH_DEBOUNCE_MS)) return;
    // `lastSeen` is a leaf field on its own: it is the ONE thing about a badge
    // that changes without any of the arrays changing, so it is the one place
    // a merge is safe and `denormalize` is not required. The guard in
    // `cloud-desk-arrays.test.ts` names this line as the single exception.
    await ref.set({ lastSeen: at }, { merge: true });
  }

  async setClaims(badgeId: string, claims: ActorClaim[]): Promise<void> {
    await this.mutate(badgeId, (badge) => ({ ...badge, claims }));
  }

  async claimsOf(badgeId: string): Promise<ActorClaim[]> {
    return (await this.badge(badgeId))?.claims ?? [];
  }

  /** Global, and deliberately not admission-scoped: actor ids never recycle,
   * so reincarnating a live actor must be refused however far away its holder
   * sits. One `array-contains` over `claimIds`, plus the shelf. The badge id
   * rides along because kill-a-badge needs to name your other surfaces and
   * this is the query that already found them (see `Desk.claimants`). */
  async claimants(actorId: string): Promise<{ badgeId: string; claim: ActorClaim }[]> {
    const found = await this.db
      .collection(BADGES)
      .where("claimIds", "array-contains", actorId)
      .get();
    const rows: { badgeId: string; claim: ActorClaim }[] = [];
    for (const doc of found.docs) {
      for (const row of toRecord(doc.data()).claims) {
        if (row.actorId === actorId) rows.push({ badgeId: doc.id, claim: row });
      }
    }
    for (const row of Object.values(await this.shelf())) {
      if (row.actorId === actorId) rows.push({ badgeId: SHELF, claim: row });
    }
    return rows;
  }

  async holdersOf(sessionKey: string): Promise<{ badgeId: string; claim: ActorClaim }[]> {
    const found = await this.db
      .collection(BADGES)
      .where("claimKeys", "array-contains", sessionKey)
      .get();
    const held: { badgeId: string; claim: ActorClaim }[] = [];
    for (const doc of found.docs) {
      for (const row of toRecord(doc.data()).claims) {
        if (row.sessionKey === sessionKey) held.push({ badgeId: doc.id, claim: row });
      }
    }
    const shelved = (await this.shelf())[sessionKey];
    if (shelved) held.push({ badgeId: SHELF, claim: shelved });
    return held;
  }

  /**
   * Mechanism 10's name scope. `array-contains-any` over `admittedTo`, in
   * chunks of thirty because that is the query's ceiling, and de-duplicated
   * by badge id because a badge admitted to two of the named canvases comes
   * back from two chunks.
   *
   * Empty list in, shelf only out — a badge that has been nowhere shares a
   * roster with nobody, which is the design's answer and not an oversight.
   */
  async claimsIn(canvasIds: readonly string[]): Promise<ActorClaim[]> {
    const rows: ActorClaim[] = [...Object.values(await this.shelf())];
    if (canvasIds.length === 0) return rows;
    const seen = new Set<string>();
    for (let i = 0; i < canvasIds.length; i += DISJUNCTION_LIMIT) {
      const chunk = canvasIds.slice(i, i + DISJUNCTION_LIMIT);
      const found = await this.db
        .collection(BADGES)
        .where("admittedTo", "array-contains-any", chunk)
        .get();
      for (const doc of found.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        rows.push(...toRecord(doc.data()).claims);
      }
    }
    return rows;
  }

  async admit(
    badgeId: string,
    canvasId: string,
    provenance: Provenance,
    capability?: Capability,
  ): Promise<void> {
    await this.mutate(badgeId, (badge) => {
      // An admission that has RUN OUT is replaced, not kept — the file desk's
      // comment says why, and the two backings must answer this identically or
      // a look behaves differently on a laptop and on the hosted home.
      const existing = badge.admissions.find((a) => a.canvasId === canvasId);
      if (existing && liveAdmission(existing)) return null;
      // Spread-in whenever it is not edit (`narrowed`): absent means edit
      // everywhere, and Firestore refuses an explicit `undefined` besides.
      const admission: Admission = {
        canvasId,
        provenance,
        at: new Date().toISOString(),
        ...(narrowed(capability) ? { capability } : {}),
      };
      return {
        ...badge,
        admissions: [...badge.admissions.filter((a) => a.canvasId !== canvasId), admission],
      };
    });
  }

  // ---- the sweep, and kill-a-badge (phase 9) ----

  /**
   * `where("admittedTo", "array-contains", canvasId)` — the query the
   * denormalized array has existed for since phase 4, finally asked.
   *
   * Single-field, so Firestore's automatic index serves it and
   * `firestore.indexes.json` needs nothing. Killed badges cannot come back
   * from it by construction rather than by a filter here: `denormalize`
   * writes an empty `admittedTo` for a tombstoned badge, so it is not in the
   * index at all. That is the same "one writer" discipline the class comment
   * describes, doing a second job.
   */
  async badgesIn(canvasId: string): Promise<BadgeRecord[]> {
    const found = await this.db
      .collection(BADGES)
      .where("admittedTo", "array-contains", canvasId)
      .get();
    return found.docs.map((doc) => toRecord(doc.data()));
  }

  async reroot(
    badgeId: string,
    canvasId: string,
    provenance: Provenance,
    capability?: Capability,
  ): Promise<void> {
    await this.mutate(badgeId, (badge) => {
      if (!badge.admissions.some((a) => a.canvasId === canvasId)) return null;
      return {
        ...badge,
        admissions: badge.admissions.map((a) =>
          a.canvasId === canvasId
            ? // Rebuilt, not spread: the new root says what it admits to, and a
              // stale `capability` surviving an upgrade would keep a re-rooted
              // editor read-only.
              {
                canvasId: a.canvasId,
                at: a.at,
                provenance,
                ...(narrowed(capability) ? { capability } : {}),
              }
            : a,
        ),
      };
    });
  }

  async expel(badgeId: string, canvasId: string): Promise<void> {
    await this.mutate(badgeId, (badge) => {
      if (!badge.admissions.some((a) => a.canvasId === canvasId)) return null;
      return { ...badge, admissions: badge.admissions.filter((a) => a.canvasId !== canvasId) };
    });
  }

  /**
   * A transaction, for `revokeGrant`'s reason at higher stakes: two people
   * ending one stolen laptop must not produce two different times of death,
   * and the SECOND of them must be told there was nothing left to sweep
   * rather than sweeping a second time.
   *
   * It cannot go through `mutate`, which refuses to touch a killed badge —
   * this is the one write that reads the tombstone rather than obeying it.
   */
  async killBadge(
    badgeId: string,
    at: string,
    by: string,
    end?: OperatorEnd,
  ): Promise<BadgeRecord | null> {
    const ref = this.db.collection(BADGES).doc(badgeId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const badge = toRecord(doc.data()!);
      if (badge.killedAt !== undefined) return null;
      tx.set(ref, denormalize({ ...badge, killedAt: at, killedBy: by, ...(end ? { end } : {}) }));
      // The record as it was ALIVE: the caller sweeps these admissions and
      // names these actors. Ending the badge is not forgetting where it was.
      return badge;
    });
  }

  /**
   * The tombstone, read straight off the document — the second of the two
   * reads that want it (`killBadge` is the other). `badge()` above answers
   * null for exactly this record, and `mutate` refuses to touch it; this is
   * the read that turns *nobody holds it* into *here is when and by whom*.
   */
  async endedBadge(badgeId: string): Promise<BadgeRecord | null> {
    const doc = await this.db.collection(BADGES).doc(badgeId).get();
    if (!doc.exists) return null;
    const record = toRecord(doc.data()!);
    return record.killedAt === undefined ? null : record;
  }

  async attest(badgeId: string, attestation: Attestation): Promise<void> {
    await this.mutate(badgeId, (badge) => ({
      ...badge,
      attestations: upsertAttestation(badge.attestations, attestation),
    }));
  }

  /**
   * `where("attested", "array-contains", attribute)` — the reverse of
   * `attest`, and the query person resumption is made of.
   *
   * Single-field, so Firestore's automatic index serves it and
   * `firestore.indexes.json` needs nothing. A killed badge derives an empty
   * `attested` in `denormalize`, so it is not in the index at all: a holder
   * the home no longer recognises cannot vouch for anybody, by construction
   * rather than by a filter here.
   */
  async badgesAttesting(attribute: string): Promise<BadgeRecord[]> {
    const found = await this.db
      .collection(BADGES)
      .where("attested", "array-contains", attribute)
      .get();
    return found.docs.map((doc) => toRecord(doc.data()));
  }

  // ---- grants ----

  /**
   * One indexed query, `where("canvasId", "==", canvasId)`, and NO FALLBACK —
   * the rule `desk.ts` states, applied to the row the door now reads. A canvas
   * whose grant was never written comes back empty and admits nobody, loudly,
   * on the first request that asks; anything cleverer here would hide a
   * missing birth-time write until it was somebody's outage.
   *
   * Firestore serves a single-field equality from its automatic index, so this
   * needs no composite index in `firestore.indexes.json`.
   */
  async grantsFor(canvasId: string): Promise<Grant[]> {
    const found = await this.db.collection(GRANTS).where("canvasId", "==", canvasId).get();
    return found.docs.map((doc) => toGrant(doc.data()));
  }

  /**
   * The other arm of `GrantScope`: `where("spaceId", "==", spaceId)`, a
   * single-field equality like `grantsFor`'s, and no fallback for the same
   * reason. A space with no rows admits nobody but its creator.
   */
  async grantsForSpace(spaceId: string): Promise<Grant[]> {
    const found = await this.db.collection(GRANTS).where("spaceId", "==", spaceId).get();
    return found.docs.map((doc) => toGrant(doc.data()));
  }

  async putGrant(grant: Grant): Promise<void> {
    await this.db.collection(GRANTS).doc(grant.id).set(jsonSafe(grant));
  }

  /**
   * `where("subject", "==", subject)` — the query `spacesFor` has run per
   * attribute since roles phase 4, now a method of its own for the group
   * routes (roles phase 5): every live row naming one subject, in either
   * scope, is what a change to a group has to reach. Single-field, automatic
   * index, no fallback.
   */
  async grantsBySubject(subject: GrantSubject): Promise<Grant[]> {
    const found = await this.db.collection(GRANTS).where("subject", "==", subject).get();
    return found.docs.map((doc) => toGrant(doc.data())).filter(isLive);
  }

  // ---- spaces (roles phase 4) ----

  /** THE ONE WRITER of a space document — and unlike a badge, which has four
   * writers sharing `denormalize`, a space really does have just this one: the
   * `holding` array is derived here from `canvasIds` on every write, empty on
   * a tombstone, so "did you remember to update the index?" is never asked. */
  async putSpace(space: Space): Promise<void> {
    await this.db.collection(SPACES).doc(space.id).set(denormalizeSpace(space));
  }

  async space(spaceId: string): Promise<Space | null> {
    const doc = await this.db.collection(SPACES).doc(spaceId).get();
    return doc.exists ? toSpace(doc.data()!) : null;
  }

  /**
   * `where("holding", "array-contains", canvasId)` — the door's one extra
   * read per test. Single-field, so the automatic index serves it; a tombstone
   * derives an empty `holding` and cannot come back, by construction rather
   * than by a filter. No fallback: a space whose array was never written
   * holds nothing.
   */
  async spaceOf(canvasId: string): Promise<Space | null> {
    const found = await this.db
      .collection(SPACES)
      .where("holding", "array-contains", canvasId)
      .limit(1)
      .get();
    const doc = found.docs[0];
    return doc ? toSpace(doc.data()) : null;
  }

  /**
   * Bounded queries, never a scan (roles design, "Routes"): one `createdBy`
   * equality per actor the badge claims, one `subject` equality over the
   * grants per attested attribute — from which the live rows naming a space
   * give the ids to fetch — and nothing else. Both single-field, so the
   * automatic indexes serve them. Tombstones are dropped in memory from a
   * list already bounded to one actor's own spaces, which is not a scan.
   *
   * The group branch (roles phase 5): `where("members", "array-contains",
   * attribute)` over the groups, per attribute, then `subject ==
   * group:<id>` over the grants for each live group found. Two more
   * single-field queries, and the tombstones are dropped from a list already
   * bounded to one attribute's groups.
   */
  async spacesFor(badge: BadgeRecord): Promise<Space[]> {
    const seen = new Map<string, Space>();
    const keep = (space: Space) => {
      if (isSpaceLive(space) && !seen.has(space.id)) seen.set(space.id, space);
    };
    for (const actorId of unique(badge.claims.map((claim) => claim.actorId))) {
      const found = await this.db.collection(SPACES).where("createdBy", "==", actorId).get();
      for (const doc of found.docs) keep(toSpace(doc.data()));
    }
    const named = new Set<string>();
    const attributes = unique((badge.attestations ?? []).map((row) => row.attribute));
    const subjects = new Set<string>(attributes);
    for (const attribute of attributes) {
      const groups = await this.db.collection(GROUPS).where("members", "array-contains", attribute).get();
      for (const doc of groups.docs) {
        const group = toGroup(doc.data());
        if (isGroupLive(group)) subjects.add(groupSubject(group.id));
      }
    }
    for (const subject of subjects) {
      const rows = await this.db.collection(GRANTS).where("subject", "==", subject).get();
      for (const doc of rows.docs) {
        const grant = toGrant(doc.data());
        if (isLive(grant) && "spaceId" in grant) named.add(grant.spaceId);
      }
    }
    for (const spaceId of named) {
      if (seen.has(spaceId)) continue;
      const space = await this.space(spaceId);
      if (space) keep(space);
    }
    return [...seen.values()];
  }

  // ---- groups (roles phase 5) ----

  /** A plain document write: `members` is the array the query reads, so
   * nothing is derived and there is nothing to forget. */
  async putGroup(group: Group): Promise<void> {
    await this.db.collection(GROUPS).doc(group.id).set(jsonSafe(group));
  }

  async group(groupId: string): Promise<Group | null> {
    const doc = await this.db.collection(GROUPS).doc(groupId).get();
    return doc.exists ? toGroup(doc.data()!) : null;
  }

  /** One `createdBy` equality per actor the badge claims; tombstones dropped
   * from that bounded list. Never a scan. */
  async groupsFor(badge: BadgeRecord): Promise<Group[]> {
    const seen = new Map<string, Group>();
    for (const actorId of unique(badge.claims.map((claim) => claim.actorId))) {
      const found = await this.db.collection(GROUPS).where("createdBy", "==", actorId).get();
      for (const doc of found.docs) {
        const group = toGroup(doc.data());
        if (isGroupLive(group) && !seen.has(group.id)) seen.set(group.id, group);
      }
    }
    return [...seen.values()];
  }

  /**
   * A transaction, because two people can turn one link off at once and the
   * first stamp must stand — the same read-modify-write discipline `mutate`
   * gives a badge, on a document that answers the door.
   */
  async revokeGrant(grantId: string, at: string, by: string, via?: OperatorRevocation): Promise<Grant | null> {
    const ref = this.db.collection(GRANTS).doc(grantId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const grant = toGrant(doc.data()!);
      if (grant.revokedAt !== undefined) return grant;
      // The operator's half goes in the same write as the stamp (operator
      // phase 5), so no reader can meet a row that is off with nobody to
      // say why.
      const revoked: Grant = {
        ...grant,
        revokedAt: at,
        revokedBy: by,
        ...(via ? { revokedVia: "operator" as const, revocation: { ...via } } : {}),
      };
      tx.set(ref, jsonSafe(revoked));
      return revoked;
    });
  }

  // ---- passes ----

  async putPass(pass: PassRecord): Promise<void> {
    await this.db.collection(PASSES).doc(pass.id).set(jsonSafe(pass));
  }

  async pass(passId: string): Promise<PassRecord | null> {
    const doc = await this.db.collection(PASSES).doc(passId).get();
    return doc.exists ? toPass(doc.data()!) : null;
  }

  /** `where("mintedBy", "==", badgeId)` — single-field, so the automatic
   * index serves it and `firestore.indexes.json` needs nothing. */
  async passesMintedBy(badgeId: string): Promise<PassRecord[]> {
    const found = await this.db.collection(PASSES).where("mintedBy", "==", badgeId).get();
    return found.docs.map((doc) => toPass(doc.data()));
  }

  /**
   * **Single-use, across instances, in a transaction.**
   *
   * `adopt` is the model and the resemblance is not stylistic: both are
   * first-come read-modify-writes where two winners would be a real bug rather
   * than a lost update. Here the stakes are higher — two badges redeeming one
   * pass would each be admitted to a canvas that was invited to admit exactly
   * one. A `get`-then-`set` outside a transaction would let both reads see an
   * unspent row and both writes succeed, and it would do so precisely under
   * the conditions that matter (a person pasting one command twice, two
   * instances of the home mid-rollout).
   *
   * The loser is handed the row the WINNER wrote, which is what lets the route
   * answer "already redeemed, at 14:02" instead of "no".
   */
  async redeemPass(
    passId: string,
    at: string,
    by: string,
  ): Promise<{ pass: PassRecord; redeemed: boolean } | null> {
    const ref = this.db.collection(PASSES).doc(passId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const pass = toPass(doc.data()!);
      if (pass.redeemedAt !== undefined) return { pass, redeemed: false };
      const spent: PassRecord = { ...pass, redeemedAt: at, redeemedBy: by };
      tx.set(ref, jsonSafe(spent));
      return { pass: spent, redeemed: true };
    });
  }

  // ---- the migration shelf ----

  /**
   * First-come, and it has to be: two badges racing for one shelved key must
   * not both get it. A transaction is the honest primitive — this is a
   * read-modify-write across two documents, which is exactly what
   * transactions are for, and it happens once per legacy key ever rather than
   * once per op.
   */
  async adopt(sessionKey: string, badgeId: string): Promise<ActorClaim | null> {
    const shelfRef = this.db.doc(SHELF_DOC);
    const badgeRef = this.db.collection(BADGES).doc(badgeId);
    return this.db.runTransaction(async (tx) => {
      const [shelfDoc, badgeDoc] = await Promise.all([tx.get(shelfRef), tx.get(badgeRef)]);
      const rows = (shelfDoc.data() ?? {}) as Record<string, ActorClaim>;
      const row = rows[sessionKey];
      if (!row || !badgeDoc.exists) return null;
      const badge = toRecord(badgeDoc.data()!);
      const claims = [...badge.claims.filter((c) => c.actorId !== row.actorId), row];
      const { [sessionKey]: _adopted, ...remaining } = rows;
      tx.set(shelfRef, jsonSafe(remaining));
      tx.set(badgeRef, denormalize({ ...badge, claims }));
      return { ...row };
    });
  }

  async shelve(rows: Record<string, ActorClaim>): Promise<void> {
    if (Object.keys(rows).length === 0) return;
    await this.db.doc(SHELF_DOC).set(jsonSafe(rows), { merge: true });
  }

  /**
   * Mint once, then answer the same key forever — across instances, which is
   * the only reason this is a transaction and not a read-then-write. See
   * `CONTENT_KEY_DOC`.
   *
   * Cached in memory after the first read: it is asked once per mint call on
   * a hot route, it cannot change while the process is up (nothing rewrites
   * the document), and a Firestore read per signature would put the content
   * origin's cost on the app origin's hottest path.
   */
  async contentKey(): Promise<string> {
    if (this.cachedContentKey) return this.cachedContentKey;
    const ref = this.db.doc(CONTENT_KEY_DOC);
    const key = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const existing = doc.data()?.["key"];
      if (typeof existing === "string" && existing.length > 0) return existing;
      const minted = randomBytes(32).toString("base64url");
      tx.set(ref, { key: minted, mintedAt: new Date().toISOString() });
      return minted;
    });
    this.cachedContentKey = key;
    return key;
  }

  // ---- seen-marks (#147, #134) ----

  async seenOf(actorId: string): Promise<SeenMarks> {
    const doc = await this.db.collection(SEEN).doc(actorId).get();
    const marks = doc.data()?.["marks"];
    return (marks ?? {}) as SeenMarks;
  }

  /**
   * A transaction, for `redeemPass`'s reason rather than its own: the merge
   * itself is order-independent (`advanceSeen` is a join on each half), but a
   * read-modify-write that interleaves with another loses one of the two
   * updates entirely, and a lost update is the one way a mark can go
   * backwards.
   */
  async markSeen(actorId: string, canvasId: string, mark: SeenMark): Promise<SeenMark> {
    const ref = this.db.collection(SEEN).doc(actorId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const marks = (doc.data()?.["marks"] ?? {}) as SeenMarks;
      const merged = advanceSeen(marks[canvasId], mark);
      tx.set(ref, { marks: { ...marks, [canvasId]: merged } });
      return merged;
    });
  }

  // ---- the operator's ledger (operator phase 1) ----

  async recordOperatorAct(act: OperatorAct): Promise<void> {
    await this.db.collection(OPERATOR).doc(act.id).set(jsonSafe(act));
  }

  /**
   * A merge onto the row already there, and NOT a transaction.
   *
   * The two writes of one act are strictly ordered by one request in one
   * process — the row goes down, the act runs, the outcome is merged — so
   * there is no second writer to race. That is the difference between this and
   * `markSeen` beside it, which merges two machines' opinions of one number.
   * `{merge: true}` rather than `set`, so a field a later phase adds between
   * the two writes is not erased by the settle.
   */
  async settleOperatorAct(id: string, outcome: string, reach?: unknown): Promise<void> {
    const patch = { outcome, ...(reach !== undefined ? { reach } : {}) };
    // One line, with the collection on it, so `cloud-desk-writers.test.ts` can
    // resolve this write rather than reporting it as one it cannot vouch for.
    await this.db.collection(OPERATOR).doc(id).set(jsonSafe(patch), { merge: true });
  }

  /**
   * Newest first, paged by Firestore rather than in memory.
   *
   * **Two shapes, and neither needs a composite index** — which is the whole
   * care here, because a query that needs one fails in production and nowhere
   * else. Unfiltered is `orderBy("at", "desc")`, a single field. Filtered is
   * `where("target", "==", …)` with the ordering done in memory, because
   * `where` plus `orderBy` on two different fields is exactly the pair
   * Firestore asks for an index for. The filtered list is one target's acts,
   * which is small; `firestore.indexes.json` stays a file this repo does not
   * have.
   */
  async operatorActs(options: { target?: string | null; limit?: number } = {}): Promise<OperatorAct[]> {
    const limit = options.limit ?? 100;
    const target = options.target ?? null;
    if (target !== null) {
      const found = await this.db.collection(OPERATOR).where("target", "==", target).get();
      return found.docs
        .map((doc) => doc.data() as OperatorAct)
        .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
        .slice(0, limit);
    }
    const found = await this.db.collection(OPERATOR).orderBy("at", "desc").limit(limit).get();
    return found.docs.map((doc) => doc.data() as OperatorAct);
  }

  // ---- takedowns (operator phase 2) ----

  /**
   * `liftedAt: null` is written explicitly, and it is the whole reason
   * `takedowns()` below needs no composite index and no in-memory filter:
   * Firestore has no "field is absent" operator, so a row that expressed "in
   * force" by omission could only be found by reading every row.
   */
  async recordTakedown(row: CanvasTakedown): Promise<void> {
    // One line, with the collection on it, so `cloud-desk-writers.test.ts` can
    // resolve this write rather than reporting it as one it cannot vouch for —
    // the same care `settleOperatorAct` takes, and the same reason.
    const at = this.db.collection(TAKEDOWNS).doc(row.canvasId);
    await at.set(jsonSafe({ liftedAt: null, ...row }));
  }

  /**
   * **A transaction, and the read in it is the whole point** — not the
   * atomicity. One operator, at a browser, one act at a time: there is no
   * second writer of this document, which is `settleOperatorAct`'s argument
   * for a bare merge. But `set(…, {merge: true})` on a document that is NOT
   * THERE creates it — with three lift fields and no canvas, no reason, no
   * `by` — and `takedownFor` then answers a row of `undefined`s for a canvas
   * that was never taken down. The desk contract says a lift of nothing is
   * silent (the file desk returns when it finds no row), and CI's emulator run
   * was the first thing able to see the cloud half breaking it: this suite
   * needs Java, and the worktree run skipped it.
   *
   * So: read, and merge only onto a row that exists. `tx.set` with the
   * collection on the binding line, so `cloud-desk-writers.test.ts` resolves
   * the write rather than reporting it as one it cannot vouch for.
   */
  async liftTakedown(
    canvasId: string,
    lifted: { at: string; by: string; actId: string },
  ): Promise<void> {
    const ref = this.db.collection(TAKEDOWNS).doc(canvasId);
    const patch = { liftedAt: lifted.at, liftedBy: lifted.by, liftedActId: lifted.actId };
    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return;
      tx.set(ref, jsonSafe(patch), { merge: true });
    });
  }

  /** A merge onto the row, as a lift is, and never a lift's inverse: a purged
   * row stays purged. Silent on a missing row, for `liftTakedown`'s reason. */
  async markPurged(
    canvasId: string,
    purged: { at: string; actId: string; counts: PurgeCounts },
  ): Promise<void> {
    const at = this.db.collection(TAKEDOWNS).doc(canvasId);
    if (!(await at.get()).exists) return;
    const patch = { purgedAt: purged.at, purgedActId: purged.actId, purged: purged.counts };
    await at.set(jsonSafe(patch), { merge: true });
  }

  async takedownFor(canvasId: string): Promise<CanvasTakedown | null> {
    const doc = await this.db.collection(TAKEDOWNS).doc(canvasId).get();
    return doc.exists ? asTakedown(doc.data()!) : null;
  }

  async takedowns(): Promise<CanvasTakedown[]> {
    const found = await this.db.collection(TAKEDOWNS).where("liftedAt", "==", null).get();
    return found.docs.map((doc) => asTakedown(doc.data()));
  }

  // ---- refusals (operator phase 6) ----

  /** `liftedAt: null` explicitly, for `recordTakedown`'s reason. One line
   * with the collection on it, so `cloud-desk-writers.test.ts` resolves the
   * write. */
  async recordRefusal(row: HomeRefusal): Promise<void> {
    const at = this.db.collection(REFUSALS).doc(refusalDocId(row.subject));
    await at.set(jsonSafe({ liftedAt: null, ...row }));
  }

  /** A transaction, for `liftTakedown`'s reason: a merge onto a document that
   * is not there would CREATE it, and a row of lift fields with no subject
   * would then be answered as a refusal of nothing. Read, and merge only onto
   * a row that exists. */
  async liftRefusal(subject: string, lifted: { at: string; by: string; actId: string }): Promise<void> {
    const ref = this.db.collection(REFUSALS).doc(refusalDocId(subject));
    const patch = { liftedAt: lifted.at, liftedBy: lifted.by, liftedActId: lifted.actId };
    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return;
      tx.set(ref, jsonSafe(patch), { merge: true });
    });
  }

  async refusalFor(subject: string): Promise<HomeRefusal | null> {
    const doc = await this.db.collection(REFUSALS).doc(refusalDocId(subject)).get();
    return doc.exists ? asRefusal(doc.data()!) : null;
  }

  async refusals(): Promise<HomeRefusal[]> {
    const found = await this.db.collection(REFUSALS).where("liftedAt", "==", null).get();
    return found.docs.map((doc) => asRefusal(doc.data()));
  }

  // ---- internals ----

  private async shelf(): Promise<Record<string, ActorClaim>> {
    const doc = await this.db.doc(SHELF_DOC).get();
    return (doc.data() ?? {}) as Record<string, ActorClaim>;
  }

  /**
   * One of the badge writers, and the plainest — the others are `mutate`,
   * `killBadge` and the claim transaction, each of which needs a transaction
   * this one does not. What they share, and what the invariant actually is, is
   * `denormalize`: every array on a badge document is derived there, from the
   * record, on every write, so "did you remember to update `claimIds`?" is not
   * a question anybody has to ask at any of the four.
   */
  private async writeBadge(badge: BadgeRecord): Promise<void> {
    await this.db.collection(BADGES).doc(badge.badgeId).set(denormalize(badge));
    this.lastWrittenSeen.set(badge.badgeId, Date.parse(badge.lastSeen));
  }

  /**
   * Read-modify-write of one badge, in a transaction. The desk is written
   * from two directions — admissions by the transport, claims by the engine —
   * and those two must not interleave a read-modify-write of one record. On a
   * disk `FileDesk` serializes them on its own promise chain; here the
   * document is the thing being serialized on, which is stronger and survives
   * two processes.
   *
   * Returning null from `change` means "nothing to do" and writes nothing.
   *
   * **A killed badge is never mutated here.** One guard rather than one per
   * caller, so "a killed badge is a badge nobody holds" is a property of this
   * function and not a rule six methods have to remember — the same argument
   * `denormalize` makes about the arrays. `killBadge` is the deliberate
   * exception and runs its own transaction.
   */
  private async mutate(
    badgeId: string,
    change: (badge: BadgeRecord) => BadgeRecord | null,
  ): Promise<void> {
    const ref = this.db.collection(BADGES).doc(badgeId);
    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return;
      const current = toRecord(doc.data()!);
      if (current.killedAt !== undefined) return;
      const next = change(current);
      if (!next) return;
      tx.set(ref, denormalize(next));
    });
  }
}

/**
 * A badge document: the record, plus the arrays derived from it.
 *
 * **A killed badge derives EMPTY arrays**, and that one line is how "a killed
 * badge drops out of every query" becomes structural rather than a filter
 * repeated in `claimants`, `holdersOf`, `claimsIn`, `badgesIn` and
 * `badgesAttesting`. The arrays ARE the index; a document that is not in the index cannot come back
 * from a query, whatever a read-side branch does or forgets to do. Its
 * `claims` and `admissions` stay on the document, because the tombstone is
 * the audit record of what that surface could do and where it had been.
 *
 * The equivalent on `FileDesk` is a `live()` helper every method goes
 * through; two backings, one rule, expressed in each one's own grain.
 */
function denormalize(badge: BadgeRecord): DocumentData {
  const dead = badge.killedAt !== undefined;
  return {
    ...jsonSafe(badge),
    claimIds: dead ? [] : unique(badge.claims.map((claim) => claim.actorId)),
    claimKeys: dead
      ? []
      : unique(
          badge.claims
            .map((claim) => claim.sessionKey)
            .filter((key): key is string => typeof key === "string"),
        ),
    admittedTo: dead ? [] : unique(badge.admissions.map((admission) => admission.canvasId)),
    // The fourth array, phase 9 stage 2's: what this holder has PROVED, so
    // "who else is this person" is one indexed query instead of a scan.
    attested: dead ? [] : unique((badge.attestations ?? []).map((row) => row.attribute)),
  };
}

/** A badge document, back as a record. The arrays are derived, so they are
 * dropped rather than read — one direction of truth. */
function toRecord(data: DocumentData): BadgeRecord {
  return {
    badgeId: data["badgeId"] as string,
    secretHash: data["secretHash"] as string,
    kind: data["kind"] as BadgeRecord["kind"],
    createdAt: data["createdAt"] as string,
    lastSeen: data["lastSeen"] as string,
    admissions: (data["admissions"] as Admission[] | undefined) ?? [],
    claims: (data["claims"] as ActorClaim[] | undefined) ?? [],
    // Absent on every badge written before phase 9, and both absences read
    // correctly: nothing proved, and nobody killed it.
    ...(Array.isArray(data["attestations"])
      ? { attestations: data["attestations"] as Attestation[] }
      : {}),
    ...(typeof data["killedAt"] === "string" ? { killedAt: data["killedAt"] } : {}),
    ...(typeof data["killedBy"] === "string" ? { killedBy: data["killedBy"] } : {}),
    // The operator's half of a tombstone (operator phase 4). It MUST come
    // back, for `capability`'s reason below: a field the write kept and every
    // read dropped would turn an end by the operator into one by the holder
    // — the sentence without the address, and a CLI that quietly re-badged.
    ...(data["end"] && typeof data["end"] === "object" ? { end: data["end"] as OperatorEnd } : {}),
  };
}

/** A grant document, back as a row. Nothing is derived here — a grant has no
 * denormalized arrays, because the one question asked of it (`canvasId`) is a
 * plain field. */
function toGrant(data: DocumentData): Grant {
  return {
    id: data["id"] as string,
    // One arm of `GrantScope` (roles phase 4): a row names a canvas or a
    // space. Every row written before spaces has `canvasId`, and a rebuild
    // that dropped `spaceId` would turn a space's row into one on a canvas
    // called `undefined` — the field-picking trap, on the scope itself.
    ...(typeof data["spaceId"] === "string"
      ? { spaceId: data["spaceId"] as string }
      : { canvasId: data["canvasId"] as string }),
    subject: data["subject"] as Grant["subject"],
    grantedBy: data["grantedBy"] as string,
    at: data["at"] as string,
    ...(typeof data["revokedAt"] === "string" ? { revokedAt: data["revokedAt"] } : {}),
    ...(typeof data["revokedBy"] === "string" ? { revokedBy: data["revokedBy"] } : {}),
    // The operator's half (operator phase 5): the same field-picking trap
    // as `capability` and `bars` below. A rebuild that dropped it would turn
    // "turned off by the operator" into a row the Share dialog shows as an
    // owner's own revoke — the sentence gone, the ledger row orphaned.
    ...(data["revokedVia"] === "operator" && isRevocation(data["revocation"])
      ? { revokedVia: "operator" as const, revocation: { ...data["revocation"] } }
      : {}),
    // Written whenever it is not edit (#88, `narrowed`), and it MUST come
    // back: this field-picking rebuild is exactly where a stored `view`
    // silently became `edit` on the hosted home — the write kept it, every
    // read dropped it, and the flip "took" in the response while the door
    // went on admitting editors. A literal test for `view` would do the same
    // to `read` and `own`, so the guard is "is it a rung", not "is it that
    // one". Absent stays absent, which reads as edit.
    ...(isCapability(data["capability"]) && narrowed(data["capability"])
      ? { capability: data["capability"] }
      : {}),
    // A bar (roles phase 3) is the same shape of field, and the same trap:
    // a rebuild that dropped it would turn "kept out" into a row the door
    // reads as an edit invitation. `true` or absent, nothing else.
    ...(data["bars"] === true ? { bars: true as const } : {}),
  };
}

/** The operator's half of a grant tombstone, whole or not at all: three
 * strings, and the reason is checked at the route before it is written. */
function isRevocation(value: unknown): value is OperatorRevocation {
  if (!value || typeof value !== "object") return false;
  const { reason, by, actId } = value as Record<string, unknown>;
  return typeof reason === "string" && typeof by === "string" && typeof actId === "string";
}

/** A pass document, back as a record. Nothing is derived here either: a pass
 * is only ever fetched by id, because it is presented rather than listed. */
function toPass(data: DocumentData): PassRecord {
  return {
    id: data["id"] as string,
    canvasId: data["canvasId"] as string,
    mintedBy: data["mintedBy"] as string,
    secretHash: data["secretHash"] as string,
    createdAt: data["createdAt"] as string,
    expiresAt: data["expiresAt"] as string,
    ...(typeof data["actorId"] === "string" ? { actorId: data["actorId"] } : {}),
    ...(typeof data["redeemedAt"] === "string" ? { redeemedAt: data["redeemedAt"] } : {}),
    ...(typeof data["redeemedBy"] === "string" ? { redeemedBy: data["redeemedBy"] } : {}),
  };
}

/**
 * A takedown document, back as a row — and the `null`s dropped.
 *
 * `liftedAt: null` is a storage detail this query needs (see {@link
 * TAKEDOWNS}); a row handed back with it set would fail `inForce`, which asks
 * whether the field is `undefined`. Field by field rather than a cast, so a
 * `null` that arrives in any of the three lift fields cannot reach a caller
 * that will compare it to a string.
 */
function asTakedown(data: DocumentData): CanvasTakedown {
  return {
    canvasId: data["canvasId"] as string,
    at: data["at"] as string,
    reason: data["reason"] as CanvasTakedown["reason"],
    by: data["by"] as string,
    actId: data["actId"] as string,
    ...(typeof data["note"] === "string" ? { note: data["note"] } : {}),
    ...(typeof data["liftedAt"] === "string" ? { liftedAt: data["liftedAt"] } : {}),
    ...(typeof data["liftedBy"] === "string" ? { liftedBy: data["liftedBy"] } : {}),
    ...(typeof data["liftedActId"] === "string" ? { liftedActId: data["liftedActId"] } : {}),
    ...(typeof data["purgedAt"] === "string" ? { purgedAt: data["purgedAt"] } : {}),
    ...(typeof data["purgedActId"] === "string" ? { purgedActId: data["purgedActId"] } : {}),
    ...(data["purged"] && typeof data["purged"] === "object"
      ? { purged: data["purged"] as PurgeCounts }
      : {}),
  };
}

/** A refusal row from its document, field by field for `asTakedown`'s
 * reason: the explicit `liftedAt: null` must come back as absence. */
function asRefusal(data: DocumentData): HomeRefusal {
  return {
    subject: data["subject"] as string,
    kind: data["kind"] as HomeRefusal["kind"],
    at: data["at"] as string,
    reason: data["reason"] as HomeRefusal["reason"],
    by: data["by"] as string,
    actId: data["actId"] as string,
    ...(typeof data["note"] === "string" ? { note: data["note"] } : {}),
    ...(typeof data["expiresAt"] === "string" ? { expiresAt: data["expiresAt"] } : {}),
    ...(typeof data["liftedAt"] === "string" ? { liftedAt: data["liftedAt"] } : {}),
    ...(typeof data["liftedBy"] === "string" ? { liftedBy: data["liftedBy"] } : {}),
    ...(typeof data["liftedActId"] === "string" ? { liftedActId: data["liftedActId"] } : {}),
  };
}

/** A space document: the record plus `holding`, the array `spaceOf` queries —
 * `canvasIds` while the space stands, EMPTY on a tombstone, so a deleted
 * space is not in the index at all. One writer, like `denormalize`. */
function denormalizeSpace(space: Space): DocumentData {
  return {
    ...jsonSafe(space),
    holding: isSpaceLive(space) ? unique(space.canvasIds) : [],
  };
}

/** A space document, back as a row; `holding` is derived and dropped. */
function toSpace(data: DocumentData): Space {
  return {
    id: data["id"] as string,
    name: data["name"] as string,
    createdBy: data["createdBy"] as string,
    canvasIds: (data["canvasIds"] as string[] | undefined) ?? [],
    at: data["at"] as string,
    ...(typeof data["deletedAt"] === "string" ? { deletedAt: data["deletedAt"] } : {}),
  };
}

/** A group document, back as a row. Nothing is derived: `members` is both
 * the record and the array the query reads. */
function toGroup(data: DocumentData): Group {
  return {
    id: data["id"] as string,
    name: data["name"] as string,
    createdBy: data["createdBy"] as string,
    members: (data["members"] as string[] | undefined) ?? [],
    at: data["at"] as string,
    ...(typeof data["deletedAt"] === "string" ? { deletedAt: data["deletedAt"] } : {}),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** What `JSON.stringify` would have written to a file — Firestore rejects
 * `undefined` outright, and a claim row's `sessionKey` and `canvasId` are
 * both genuinely optional. See the same helper in `cloud-store.ts`. */
function jsonSafe<T>(value: T): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}
