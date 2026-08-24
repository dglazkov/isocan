import type { DocumentData, Firestore } from "@google-cloud/firestore";
import type { ActorClaim, Attestation, Grant } from "@isocan/core";
import { SHELF, upsertAttestation } from "@isocan/core";
import type { Admission, BadgeRecord, Desk, PassRecord, Provenance } from "@isocan/server";

export const BADGES = "badges";
/** `grants/{id}` — the architecture's other desk row, one document per grant,
 * queried by `canvasId`. A collection rather than an array on the canvas
 * because the canvas lives in the OTHER ledger entirely: canvas state
 * replicates, the desk's ledgers never leave the home, and a grant that rode
 * on a project document would be a grant that travelled. */
export const GRANTS = "grants";
/** `passes/{id}` — the desk's third row (phase 8). A collection for the same
 * reason grants are one, plus a sharper one: a pass is redeemed exactly once,
 * and single-use across two instances of a home has to be a TRANSACTION on
 * one document. A pass that lived inside an array on some other document
 * would be a pass whose spending raced with every other write to that
 * document. */
export const PASSES = "passes";
/** The migration shelf: pre-badge claims waiting for the session key that
 * will collect them. It belongs to no badge, so it has no home in
 * `badges/{badgeId}` — one document, keyed by sessionKey, and it dies when it
 * empties. One document is right precisely because it is finite and shrinking;
 * nothing new is ever shelved. */
export const SHELF_DOC = "meta/shelf";

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
 * ## The three arrays, and why there is exactly one writer
 *
 * `claimIds`, `claimKeys` and `admittedTo` are the same data denormalized,
 * one array per question the desk is actually asked, because each is an
 * `array-contains` here and a whole-table scan everywhere else. Phase 3's
 * warning is exact: a CloudDesk that does not write them on every claim and
 * every admission passes the suite on a FileDesk and answers nothing in the
 * cloud.
 *
 * So they cannot be forgotten, structurally: **nothing writes a badge except
 * `writeBadge`**, and `writeBadge` derives all three from `claims` and
 * `admissions` on every call. There is no code path that writes a claim and a
 * separate code path that writes an array — they are the same statement. A
 * reviewer's whole job on this file is to confirm there is one writer.
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
    // a merge is safe and `writeBadge` is not required.
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

  async admit(badgeId: string, canvasId: string, provenance: Provenance): Promise<void> {
    await this.mutate(badgeId, (badge) => {
      if (badge.admissions.some((a) => a.canvasId === canvasId)) return null;
      const admission: Admission = { canvasId, provenance, at: new Date().toISOString() };
      return { ...badge, admissions: [...badge.admissions, admission] };
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

  async reroot(badgeId: string, canvasId: string, provenance: Provenance): Promise<void> {
    await this.mutate(badgeId, (badge) => {
      if (!badge.admissions.some((a) => a.canvasId === canvasId)) return null;
      return {
        ...badge,
        admissions: badge.admissions.map((a) =>
          a.canvasId === canvasId ? { ...a, provenance } : a,
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
  async killBadge(badgeId: string, at: string, by: string): Promise<BadgeRecord | null> {
    const ref = this.db.collection(BADGES).doc(badgeId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const badge = toRecord(doc.data()!);
      if (badge.killedAt !== undefined) return null;
      tx.set(ref, denormalize({ ...badge, killedAt: at, killedBy: by }));
      // The record as it was ALIVE: the caller sweeps these admissions and
      // names these actors. Ending the badge is not forgetting where it was.
      return badge;
    });
  }

  async attest(badgeId: string, attestation: Attestation): Promise<void> {
    await this.mutate(badgeId, (badge) => ({
      ...badge,
      attestations: upsertAttestation(badge.attestations, attestation),
    }));
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

  async putGrant(grant: Grant): Promise<void> {
    await this.db.collection(GRANTS).doc(grant.id).set(jsonSafe(grant));
  }

  /**
   * A transaction, because two people can turn one link off at once and the
   * first stamp must stand — the same read-modify-write discipline `mutate`
   * gives a badge, on a document that answers the door.
   */
  async revokeGrant(grantId: string, at: string, by: string): Promise<Grant | null> {
    const ref = this.db.collection(GRANTS).doc(grantId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const grant = toGrant(doc.data()!);
      if (grant.revokedAt !== undefined) return grant;
      const revoked: Grant = { ...grant, revokedAt: at, revokedBy: by };
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

  // ---- internals ----

  private async shelf(): Promise<Record<string, ActorClaim>> {
    const doc = await this.db.doc(SHELF_DOC).get();
    return (doc.data() ?? {}) as Record<string, ActorClaim>;
  }

  /**
   * THE ONE WRITER. Every array on a badge document is derived here, from the
   * record, on every write — so "did you remember to update `claimIds`?" is
   * not a question anybody has to ask.
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
   * `writeBadge` makes about the denormalized arrays. `killBadge` is the
   * deliberate exception and runs its own transaction.
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
 * A badge document: the record, plus the three arrays derived from it.
 *
 * **A killed badge derives EMPTY arrays**, and that one line is how "a killed
 * badge drops out of every query" becomes structural rather than a filter
 * repeated in `claimants`, `holdersOf`, `claimsIn` and `badgesIn`. The three
 * arrays ARE the index; a document that is not in the index cannot come back
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
  };
}

/** A grant document, back as a row. Nothing is derived here — a grant has no
 * denormalized arrays, because the one question asked of it (`canvasId`) is a
 * plain field. */
function toGrant(data: DocumentData): Grant {
  return {
    id: data["id"] as string,
    canvasId: data["canvasId"] as string,
    subject: data["subject"] as Grant["subject"],
    grantedBy: data["grantedBy"] as string,
    at: data["at"] as string,
    ...(typeof data["revokedAt"] === "string" ? { revokedAt: data["revokedAt"] } : {}),
    ...(typeof data["revokedBy"] === "string" ? { revokedBy: data["revokedBy"] } : {}),
  };
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** What `JSON.stringify` would have written to a file — Firestore rejects
 * `undefined` outright, and a claim row's `sessionKey` and `projectId` are
 * both genuinely optional. See the same helper in `cloud-store.ts`. */
function jsonSafe<T>(value: T): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}
