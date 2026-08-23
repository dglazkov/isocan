import type { DocumentData, Firestore } from "@google-cloud/firestore";
import type { ActorClaim, Grant } from "@isocan/core";
import { SHELF } from "@isocan/core";
import type { Admission, BadgeRecord, Desk, Provenance } from "@isocan/server";

export const BADGES = "badges";
/** `grants/{id}` — the architecture's other desk row, one document per grant,
 * queried by `canvasId`. A collection rather than an array on the canvas
 * because the canvas lives in the OTHER ledger entirely: canvas state
 * replicates, the desk's ledgers never leave the home, and a grant that rode
 * on a project document would be a grant that travelled. */
export const GRANTS = "grants";
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
 * The desk on Firestore: one document per badge at `badges/{badgeId}`, and
 * from phase 7 one per grant at `grants/{id}` — exactly the shapes the
 * architecture draws.
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

  async badge(badgeId: string): Promise<BadgeRecord | null> {
    const doc = await this.db.collection(BADGES).doc(badgeId).get();
    return doc.exists ? toRecord(doc.data()!) : null;
  }

  async touch(badgeId: string, at: string): Promise<void> {
    const stamp = Date.parse(at);
    const written = this.lastWrittenSeen.get(badgeId);
    if (written !== undefined && stamp - written < TOUCH_DEBOUNCE_MS) return;
    const ref = this.db.collection(BADGES).doc(badgeId);
    const doc = await ref.get();
    if (!doc.exists) return;
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
   * sits. One `array-contains` over `claimIds`, plus the shelf. */
  async claimants(actorId: string): Promise<ActorClaim[]> {
    const found = await this.db
      .collection(BADGES)
      .where("claimIds", "array-contains", actorId)
      .get();
    const rows: ActorClaim[] = [];
    for (const doc of found.docs) {
      for (const row of toRecord(doc.data()).claims) {
        if (row.actorId === actorId) rows.push(row);
      }
    }
    for (const row of Object.values(await this.shelf())) {
      if (row.actorId === actorId) rows.push(row);
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
   */
  private async mutate(
    badgeId: string,
    change: (badge: BadgeRecord) => BadgeRecord | null,
  ): Promise<void> {
    const ref = this.db.collection(BADGES).doc(badgeId);
    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return;
      const next = change(toRecord(doc.data()!));
      if (!next) return;
      tx.set(ref, denormalize(next));
    });
  }
}

/** A badge document: the record, plus the three arrays derived from it. */
function denormalize(badge: BadgeRecord): DocumentData {
  return {
    ...jsonSafe(badge),
    claimIds: unique(badge.claims.map((claim) => claim.actorId)),
    claimKeys: unique(
      badge.claims
        .map((claim) => claim.sessionKey)
        .filter((key): key is string => typeof key === "string"),
    ),
    admittedTo: unique(badge.admissions.map((admission) => admission.canvasId)),
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** What `JSON.stringify` would have written to a file — Firestore rejects
 * `undefined` outright, and a claim row's `sessionKey` and `projectId` are
 * both genuinely optional. See the same helper in `cloud-store.ts`. */
function jsonSafe<T>(value: T): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}
