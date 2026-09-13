import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import type {
  ActorClaim,
  Attestation,
  CanvasTakedown,
  Capability,
  Grant,
  GrantSubject,
  Group,
  PurgeCounts,
  SeenMark,
  SeenMarks,
  Space,
  OperatorAct,
  OperatorEnd,
} from "@isocan/core";
import {
  advanceSeen,
  groupSubject,
  inForce,
  isGroupLive,
  isLive,
  isSpaceGrant,
  isSpaceLive,
  narrowed,
  scopeOf,
  SHELF,
  upsertAttestation,
} from "@isocan/core";
import { appendLineDurable, readJson, readJsonLines, writeFileAtomic } from "./fsutil.ts";
import * as p from "./paths.ts";
import { liveAdmission } from "./grants.ts";
import type { Admission, BadgeRecord, Desk, PassRecord, Provenance } from "./desk.ts";

/**
 * The desk on a disk. Layout under `~/.isocan/desk/`:
 *   badges.jsonl — append-only; the durable half. The source of truth.
 *   badges.json  — { lastSeq, badges, shelf, grants, passes } derived
 *                  snapshot. One file for all of the desk's ledgers, because
 *                  they are written by one chain and recovered by one replay.
 *
 * Snapshot-plus-tail, the same idiom as `actors.jsonl`/`actors.json`, for the
 * same reason: a claim row carries authorization now, and a table that is
 * truth with nothing behind it turns "I lost a file" into "I cannot have my
 * own name back until phase 9 ships kill-a-badge". The log is fsynced before
 * a write is acknowledged.
 *
 * WHAT IS LOGGED: mints, claim-list replacements, shelving, adoption, grants
 * and their revocations (phase 7), passes and their redemptions (phase 8),
 * and — from phase 9 — attestations and kills. Everything that would
 * otherwise be unrecoverable. A grant is policy: losing the row that says
 * "the link is off" would quietly turn a closed canvas back on, which is the
 * one direction a lost file must never fail in. A REDEMPTION is the same
 * shape of fact: losing it would un-spend a single-use pass, and a pass that
 * can be used twice is not single-use at all — so the redemption is fsynced
 * before the redeemer is told it worked. **A KILL is the sharpest of the
 * three**: losing it resurrects a stolen laptop's credential, so it is
 * durable before the person who ended it is told it is over. And an
 * ATTESTATION is logged because it is the only record that a holder ever
 * proved anything — an attester is a round trip to somebody else's service,
 * and losing the answer means asking a person to go and prove it again.
 *
 * WHAT IS NOT: `lastSeen` and `admissions`, which re-derive themselves — a
 * badge that lost its admissions re-admits itself on its next request, and
 * paying one fsync per (badge, canvas) pair for that would be ceremony. Phase
 * 7 raises the stakes on that choice without changing it: re-admission now
 * goes through the door, so a badge that lost its admissions gets back in
 * only if a grant still admits it. That is the correct behaviour (it is the
 * door's answer, freshly asked) — but it means a lost SNAPSHOT can expel a
 * badge from a canvas whose link has since been turned off.
 *
 * **Phase 9 re-decided this and left it exactly where it was**, which is
 * worth stating because the sweep looks at first like the thing that would
 * force durable admissions. It is the opposite: losing the admissions is
 * indistinguishable from running the sweep with nothing surviving, because
 * both end at the same question — `admittingGrant`, asked fresh. The one
 * thing a lost snapshot costs that the sweep does not is PROVENANCE, so a
 * badge that re-enters is re-rooted at whatever grant admits it today rather
 * than the one that admitted it a month ago. That is a worse audit trail and
 * an identical door. A kill, by contrast, IS logged, because there is no
 * question anybody could re-ask that would derive it.
 *
 * The desk serializes its own writes on its OWN promise chain, independent of
 * the engine's. Admissions are written by the transport layer and claims by
 * the engine, and those two must not interleave a read-modify-write of one
 * record. It is not the engine's chain because a badge write is not an op and
 * must not be able to stall behind one.
 */

type DeskLogEntry =
  | { seq: number; type: "badge"; badgeId: string; secretHash: string; kind: BadgeRecord["kind"]; at: string }
  | { seq: number; type: "claims"; badgeId: string; claims: ActorClaim[]; at: string }
  | { seq: number; type: "shelve"; rows: Record<string, ActorClaim>; at: string }
  | { seq: number; type: "adopt"; sessionKey: string; badgeId: string; at: string }
  | { seq: number; type: "grant"; grant: Grant; at: string }
  | { seq: number; type: "revoke"; grantId: string; by: string; at: string }
  | { seq: number; type: "pass"; pass: PassRecord; at: string }
  | { seq: number; type: "redeem"; passId: string; by: string; at: string }
  | { seq: number; type: "attest"; badgeId: string; attestation: Attestation; at: string }
  /** A badge ended — by its holder's other surface, or, with `end`, by the
   * operator (operator phase 4): the reason, the address and the act, which
   * the tombstone's sentence is rendered from. */
  | { seq: number; type: "kill"; badgeId: string; by: string; at: string; end?: OperatorEnd }
  /** A space, WHOLE, on every write (roles phase 4): creation, a canvas added
   * or removed, the tombstone. Replayed as a replacement, not a `??=`, because
   * the latest write is the row. Losing one would quietly widen or narrow who
   * may enter every canvas in it, which is the direction a lost file must
   * never fail in. */
  | { seq: number; type: "space"; space: Space; at: string }
  /** A group, WHOLE, on every write (roles phase 5), for the space's reason:
   * losing a member removal would quietly re-admit somebody to every canvas
   * the group reaches. */
  | { seq: number; type: "group"; group: Group; at: string }
  /** **This home's content-signing key** (content-read-auth.md, option A),
   * written exactly once and never again. Logged for the sharpest of the
   * durability reasons on this list: losing it does not lose access, it
   * INVALIDATES every URL already in a living page — every frame on every
   * open tab breaks at once and stays broken until each one re-mints. A key
   * is also the one row here that a replay must never overwrite with a newer
   * one, and it cannot: it is written only when there is none. */
  | { seq: number; type: "contentkey"; key: string; at: string }
  /** One person's mark on one canvas, ALREADY MERGED (#147, #134). The merged
   * value rather than the incoming one, so a replay is a plain replacement
   * and cannot re-derive a different answer from a different starting point;
   * `advanceSeen` is idempotent anyway, which is what makes replaying a tail
   * out of order harmless. Losing one costs a canvas showing as unread that
   * you had read — the only direction this feature is allowed to fail in. */
  | { seq: number; type: "seen"; actorId: string; canvasId: string; mark: SeenMark; at: string }
  /**
   * **One operator act, WHOLE** (operator phase 1), on both writes: the row
   * put down before the act answers, and the same row again when its outcome
   * is settled. Replayed as a replacement rather than a `??=`, for the space's
   * reason — the latest write is the row.
   *
   * It is on this log rather than in a canvas's oplog because an operator act
   * is a desk write and never an op (design, "Not an op"): the vocabulary is
   * closed and isomorphic, the canvas log replicates and belongs to its
   * members, and the log cannot carry authority. And it is LOGGED rather than
   * derived because it is the sharpest kind of unrecoverable there is: an act
   * whose record was lost is a power that was exercised and cannot be
   * accounted for, which is the Firestore hand edit the whole project exists
   * to replace.
   */
  | { seq: number; type: "operator"; act: OperatorAct; at: string }
  /**
   * **A canvas this home stopped serving, and why** (operator phase 2).
   *
   * Logged rather than derived, for the ledger's reason one entry up and a
   * second of its own: this row is what every affected person's sentence is
   * rendered from, so a home that lost it would go on refusing the canvas —
   * the STORE's flag is what refuses — while being unable to say why. A
   * refusal with no sentence is exactly the *not found* the design calls the
   * one thing a takedown must never look like.
   */
  | { seq: number; type: "takedown"; row: CanvasTakedown; at: string };

/** `Omit` over a union collapses it to the shared keys; this distributes. */
type NewEntry<T> = T extends unknown ? Omit<T, "seq"> : never;

interface DeskSnapshot {
  lastSeq: number;
  badges: Record<string, BadgeRecord>;
  /** Pre-badge claims waiting for the sessionKey that will collect them. */
  shelf: Record<string, ActorClaim>;
  /** `grants/{id}`, on a disk: keyed by grant id, exactly as the cloud
   * backing keys its documents, so `grantsFor` is the same walk-or-query
   * split every other read here already has. */
  grants: Record<string, Grant>;
  /** `passes/{id}`, on a disk, keyed the same way. Never queried by anything
   * but id — a pass is presented, never listed — so this needs none of the
   * denormalization the badge documents carry. */
  passes: Record<string, PassRecord>;
  /** `spaces/{id}` (roles phase 4), keyed by space id. Absent in every desk
   * written before spaces, and correctly EMPTY: a canvas whose space was
   * never written is in no space, which is what every canvas was. */
  spaces?: Record<string, Space>;
  /** `groups/{id}` (roles phase 5), keyed by group id. Absent before groups,
   * and correctly EMPTY: a `group:` row whose group was never written admits
   * nobody. */
  groups?: Record<string, Group>;
  /** `seen/{actorId}` (#147, #134), keyed by actor id and holding that
   * person's marks by canvas. Absent in every desk written before seen-marks,
   * and correctly EMPTY: somebody who has never marked anything has seen
   * nothing as far as this home knows, which is what everybody was. */
  seen?: Record<string, SeenMarks>;
  /** The HMAC key this home signs content reads with (content-read-auth.md).
   * Absent on every desk written before it, and absent means "not minted
   * yet" — the first ask mints one. Local homes never ask: loopback content
   * reads carry no signature and need none. */
  contentKey?: string;
  /** `operator/{id}` (operator phase 1), keyed by act id. Absent on every desk
   * written before it, and correctly EMPTY: a home whose ledger has no rows
   * has had no operator act, which is true of every home in this repo. */
  operator?: Record<string, OperatorAct>;
  /** `takedowns/{canvasId}` (operator phase 2), keyed by canvas id and holding
   * lifted rows too. Absent on every desk written before it, and correctly
   * EMPTY: a home with no row has taken nothing down, which is true of every
   * home in this repo. */
  takedowns?: Record<string, CanvasTakedown>;
}

/** How stale `lastSeen` may get before a touch costs a snapshot rewrite. A
 * whole-file write on every request would be absurd for a field nothing reads
 * yet; a minute is plenty for the sweeper phase 9 will hang off it. */
const TOUCH_DEBOUNCE_MS = 60_000;

export class FileDesk implements Desk {
  private state: DeskSnapshot = { lastSeq: 0, badges: {}, shelf: {}, grants: {}, passes: {}, spaces: {}, groups: {}, operator: {}, takedowns: {} };
  private chain: Promise<unknown> = Promise.resolve();

  constructor(readonly home: string) {}

  async init(): Promise<void> {
    await fs.mkdir(p.deskDir(this.home), { recursive: true });
    const snapshot = await readJson<DeskSnapshot>(p.badgesFile(this.home));
    this.state = {
      lastSeq: snapshot?.lastSeq ?? 0,
      badges: snapshot?.badges ?? {},
      shelf: snapshot?.shelf ?? {},
      // Absent in every desk written before phase 7 — and correctly EMPTY
      // rather than "everything is granted": the one-time migration in
      // `migrations.ts` writes the rows, so that a canvas whose grant was
      // never written answers nothing here instead of answering helpfully.
      grants: snapshot?.grants ?? {},
      // Absent in every desk written before phase 8, and empty is the only
      // safe reading: a pass nobody can find is a pass nobody can redeem,
      // which is what an unknown row must always mean here.
      passes: snapshot?.passes ?? {},
      // Absent in every desk written before roles phase 4; empty means every
      // canvas is in no space, which is the truth about all of them.
      spaces: snapshot?.spaces ?? {},
      // Absent before roles phase 5; empty means no group exists, so a
      // `group:` row admits nobody, which is the only safe reading.
      groups: snapshot?.groups ?? {},
      // Absent in every desk written before seen-marks; empty means nobody
      // has looked at anything, which is what an inbox should say about a
      // person this home has never seen read a canvas.
      seen: snapshot?.seen ?? {},
      // Absent on every desk written before the operator; empty means no
      // operator act has ever been taken here, which is the truth about a
      // home that has none.
      operator: snapshot?.operator ?? {},
      // Absent on every desk written before takedowns; empty means this home
      // has taken nothing down, which is the truth about all of them.
      takedowns: snapshot?.takedowns ?? {},
      // Absent until a hosted home first signs a content read. Undefined
      // means "none minted", never "sign with nothing".
      ...(snapshot?.contentKey ? { contentKey: snapshot.contentKey } : {}),
    };
    // Crash recovery: replay any log tail the snapshot doesn't cover.
    let recovered = false;
    for (const entry of await readJsonLines<DeskLogEntry>(p.badgesLogFile(this.home))) {
      if (entry.seq <= this.state.lastSeq) continue;
      this.replay(entry);
      this.state.lastSeq = entry.seq;
      recovered = true;
    }
    if (recovered) await this.writeSnapshot();
  }

  /** Drain the write chain so a shutdown cannot land between a log append and
   * its snapshot; nothing is held open beyond that. */
  async close(): Promise<void> {
    await this.chain;
  }

  async put(badge: BadgeRecord): Promise<void> {
    await this.enqueue(async () => {
      this.state.badges[badge.badgeId] = { ...badge };
      await this.append({
        type: "badge",
        badgeId: badge.badgeId,
        secretHash: badge.secretHash,
        kind: badge.kind,
        at: badge.createdAt,
      });
    });
  }

  /** A killed badge answers null, exactly like one this home never minted —
   * the desk seam's contract, and what turns a kill into `bad-badge` at the
   * next request the holder makes. */
  async badge(badgeId: string): Promise<BadgeRecord | null> {
    const found = this.live(badgeId);
    return found ? { ...found } : null;
  }

  async touch(badgeId: string, at: string): Promise<void> {
    const badge = this.live(badgeId);
    if (!badge) return;
    const drift = Date.parse(at) - Date.parse(badge.lastSeen);
    badge.lastSeen = at;
    if (!(drift >= TOUCH_DEBOUNCE_MS)) return; // in memory only; not worth a write
    await this.enqueue(() => this.writeSnapshot());
  }

  async setClaims(badgeId: string, claims: ActorClaim[]): Promise<void> {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge) return;
      badge.claims = claims;
      await this.append({ type: "claims", badgeId, claims, at: new Date().toISOString() });
    });
  }

  async claimsOf(badgeId: string): Promise<ActorClaim[]> {
    return [...(this.live(badgeId)?.claims ?? [])];
  }

  async claimants(actorId: string): Promise<{ badgeId: string; claim: ActorClaim }[]> {
    const rows: { badgeId: string; claim: ActorClaim }[] = [];
    for (const [badgeId, badge] of Object.entries(this.state.badges)) {
      if (badge.killedAt !== undefined) continue;
      for (const row of badge.claims) if (row.actorId === actorId) rows.push({ badgeId, claim: row });
    }
    for (const row of Object.values(this.state.shelf)) {
      if (row.actorId === actorId) rows.push({ badgeId: SHELF, claim: row });
    }
    return rows;
  }

  async holdersOf(sessionKey: string): Promise<{ badgeId: string; claim: ActorClaim }[]> {
    const held: { badgeId: string; claim: ActorClaim }[] = [];
    for (const [badgeId, badge] of Object.entries(this.state.badges)) {
      if (badge.killedAt !== undefined) continue;
      for (const row of badge.claims) {
        if (row.sessionKey === sessionKey) held.push({ badgeId, claim: row });
      }
    }
    const shelved = this.state.shelf[sessionKey];
    if (shelved) held.push({ badgeId: SHELF, claim: shelved });
    return held;
  }

  async claimsIn(canvasIds: readonly string[]): Promise<ActorClaim[]> {
    // A whole-table scan on a file backing is the honest implementation of a
    // query; what matters is that the SEAM is the query, so the cloud backing
    // can serve it with an index instead of a walk.
    const wanted = new Set(canvasIds);
    const rows: ActorClaim[] = [...Object.values(this.state.shelf)];
    if (wanted.size > 0) {
      for (const badge of Object.values(this.state.badges)) {
        if (badge.killedAt !== undefined) continue;
        if (!badge.admissions.some((a) => wanted.has(a.canvasId))) continue;
        rows.push(...badge.claims);
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
    const badge = this.live(badgeId);
    if (!badge) return;
    /**
     * **An admission that has RUN OUT is replaced, not kept** (operator phase
     * 2).
     *
     * This used to be `some(a => a.canvasId === canvasId)`, which was exactly
     * right while every admission was live until somebody revoked it. The
     * operator's look is the first that ends on its own, and with the old line
     * a second look at the same canvas from the same browser would be written
     * nowhere and refused at the door — a verb that answered "done" and did
     * nothing. Replacing is also what makes a re-entry by a GRANT possible
     * after a look has expired.
     */
    const existing = badge.admissions.find((a) => a.canvasId === canvasId);
    if (existing && liveAdmission(existing)) return;
    const admission: Admission = {
      canvasId,
      provenance,
      at: new Date().toISOString(),
      // Stored whenever it is not edit (`narrowed`, the one place that
      // decides): absent has meant "edit" since before the field existed, and
      // both backings keep that reading.
      ...(narrowed(capability) ? { capability } : {}),
    };
    badge.admissions = [
      ...badge.admissions.filter((a) => a.canvasId !== canvasId),
      admission,
    ];
    await this.enqueue(() => this.writeSnapshot());
  }

  // ---- the sweep, and kill-a-badge ----

  async badgesIn(canvasId: string): Promise<BadgeRecord[]> {
    // A walk is the honest implementation of a query here; the SEAM is the
    // query, so `CloudDesk` serves it from `admittedTo` with an index.
    return Object.values(this.state.badges)
      .filter((badge) => badge.killedAt === undefined)
      .filter((badge) => badge.admissions.some((a) => a.canvasId === canvasId))
      .map((badge) => ({ ...badge }));
  }

  async reroot(
    badgeId: string,
    canvasId: string,
    provenance: Provenance,
    capability?: Capability,
  ): Promise<void> {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      const admission = badge?.admissions.find((a) => a.canvasId === canvasId);
      if (!badge || !admission) return;
      badge.admissions = badge.admissions.map((a) =>
        a.canvasId === canvasId
          ? // Rebuilt rather than spread, so a stale `capability` from the old
            // root cannot survive an upgrade — the new reason says what it
            // admits to, entirely.
            {
              canvasId: a.canvasId,
              at: a.at,
              provenance,
              ...(narrowed(capability) ? { capability } : {}),
            }
          : a,
      );
      await this.writeSnapshot();
    });
  }

  async expel(badgeId: string, canvasId: string): Promise<void> {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge || !badge.admissions.some((a) => a.canvasId === canvasId)) return;
      badge.admissions = badge.admissions.filter((a) => a.canvasId !== canvasId);
      await this.writeSnapshot();
    });
  }

  async killBadge(
    badgeId: string,
    at: string,
    by: string,
    end?: OperatorEnd,
  ): Promise<BadgeRecord | null> {
    return this.enqueue(async () => {
      const badge = this.state.badges[badgeId];
      // Already dead is not an error and is not a second kill: the caller
      // wanted this holder gone and it is, so hand back nothing to sweep.
      if (!badge || badge.killedAt !== undefined) return null;
      // The record as it was ALIVE — admissions and claims intact — because
      // the caller sweeps those canvases and names those actors. Killing the
      // badge is not forgetting where it had been.
      const wasAlive: BadgeRecord = { ...badge };
      badge.killedAt = at;
      badge.killedBy = by;
      if (end) badge.end = end;
      await this.append({ type: "kill", badgeId, by, at, ...(end ? { end } : {}) });
      return wasAlive;
    });
  }

  async endedBadge(badgeId: string): Promise<BadgeRecord | null> {
    // The raw record, not `live`: this is the one read that WANTS the
    // tombstone. A copy, as every read here hands back.
    const badge = this.state.badges[badgeId];
    if (!badge || badge.killedAt === undefined) return null;
    return { ...badge };
  }

  async attest(badgeId: string, attestation: Attestation): Promise<void> {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge) return;
      badge.attestations = upsertAttestation(badge.attestations, attestation);
      await this.append({ type: "attest", badgeId, attestation, at: attestation.at });
    });
  }

  async badgesAttesting(attribute: string): Promise<BadgeRecord[]> {
    // A walk is the honest implementation of a query on a file backing; the
    // SEAM is the query, so `CloudDesk` serves it from `attested` with an
    // index. Killed badges are skipped for `badgesIn`'s reason: a holder the
    // home no longer recognises vouches for nobody.
    return Object.values(this.state.badges)
      .filter((badge) => badge.killedAt === undefined)
      .filter((badge) => (badge.attestations ?? []).some((row) => row.attribute === attribute))
      .map((badge) => ({ ...badge }));
  }

  // ---- grants ----

  async grantsFor(canvasId: string): Promise<Grant[]> {
    // A walk is the honest implementation of a query on a file backing; what
    // matters is that the SEAM is a query, so `CloudDesk` serves it with
    // `where("canvasId", "==", …)` and an index rather than a scan.
    return Object.values(this.state.grants)
      .filter((grant) => !isSpaceGrant(grant) && grant.canvasId === canvasId)
      .map((grant) => ({ ...grant }));
  }

  async grantsForSpace(spaceId: string): Promise<Grant[]> {
    // The other arm of `GrantScope`, the same walk; `CloudDesk` serves it
    // with `where("spaceId", "==", …)`.
    return Object.values(this.state.grants)
      .filter((grant) => isSpaceGrant(grant) && grant.spaceId === spaceId)
      .map((grant) => ({ ...grant }));
  }

  // ---- spaces (roles phase 4) ----

  async putSpace(space: Space): Promise<void> {
    await this.enqueue(async () => {
      this.spaces()[space.id] = { ...space, canvasIds: [...space.canvasIds] };
      await this.append({ type: "space", space, at: new Date().toISOString() });
    });
  }

  async space(spaceId: string): Promise<Space | null> {
    const found = this.spaces()[spaceId];
    return found ? { ...found, canvasIds: [...found.canvasIds] } : null;
  }

  async spaceOf(canvasId: string): Promise<Space | null> {
    // A walk over the spaces, live ones only — the SEAM is the query, and
    // `CloudDesk` serves it from a derived `holding` array with an index.
    const found = Object.values(this.spaces()).find(
      (space) => isSpaceLive(space) && space.canvasIds.includes(canvasId),
    );
    return found ? { ...found, canvasIds: [...found.canvasIds] } : null;
  }

  async spacesFor(badge: BadgeRecord): Promise<Space[]> {
    // The same bounded questions the cloud desk asks, as walks: by creator
    // for each actor the badge claims, and by the live rows whose subject is
    // one of its attested attributes. Never "every space", even here, so
    // the file desk cannot pass a test the cloud desk would fail.
    const seen = new Map<string, Space>();
    const keep = (space: Space | undefined) => {
      if (space && isSpaceLive(space) && !seen.has(space.id)) {
        seen.set(space.id, { ...space, canvasIds: [...space.canvasIds] });
      }
    };
    const spaces = this.spaces();
    const actorIds = new Set(badge.claims.map((claim) => claim.actorId));
    for (const space of Object.values(spaces)) {
      if (actorIds.has(space.createdBy)) keep(space);
    }
    const attributes = new Set((badge.attestations ?? []).map((row) => row.attribute));
    for (const grant of Object.values(this.state.grants)) {
      if (!isLive(grant) || !attributes.has(grant.subject)) continue;
      const scope = scopeOf(grant);
      if (scope.kind === "space") keep(spaces[scope.id]);
    }
    // The third branch (roles phase 5): the live groups holding one of the
    // attributes, then the live rows naming each as `group:<id>` that name a
    // space. The same walk `CloudDesk` serves with `array-contains` on
    // `members` and `subject` equality.
    const inGroups = new Set(
      Object.values(this.groups())
        .filter((group) => isGroupLive(group) && group.members.some((member) => attributes.has(member)))
        .map((group) => groupSubject(group.id)),
    );
    if (inGroups.size > 0) {
      for (const grant of Object.values(this.state.grants)) {
        if (!isLive(grant) || !inGroups.has(grant.subject)) continue;
        const scope = scopeOf(grant);
        if (scope.kind === "space") keep(spaces[scope.id]);
      }
    }
    return [...seen.values()];
  }

  /** The spaces ledger, which a desk from before roles phase 4 lacks. */
  private spaces(): Record<string, Space> {
    return (this.state.spaces ??= {});
  }

  // ---- seen-marks (#147, #134) ----

  async seenOf(actorId: string): Promise<SeenMarks> {
    return { ...(this.seen()[actorId] ?? {}) };
  }

  /**
   * Read-modify-write on the serialized chain, which is what makes the merge
   * safe: two requests racing cannot interleave a read with the other's
   * write, and `advanceSeen` then makes the ORDER they land in irrelevant.
   * `CloudDesk` gets the same property from a transaction.
   */
  async markSeen(actorId: string, canvasId: string, mark: SeenMark): Promise<SeenMark> {
    return this.enqueue(async () => {
      const marks = (this.seen()[actorId] ??= {});
      const merged = advanceSeen(marks[canvasId], mark);
      marks[canvasId] = merged;
      await this.append({ type: "seen", actorId, canvasId, mark: merged, at: merged.at });
      return merged;
    });
  }

  /** The seen ledger, which every desk written before 12 Sep 2026 lacks —
   *  correctly empty, since a person who has never marked anything has seen
   *  nothing as far as this home knows. */
  private seen(): Record<string, SeenMarks> {
    return (this.state.seen ??= {});
  }

  // ---- groups (roles phase 5) ----

  async putGroup(group: Group): Promise<void> {
    await this.enqueue(async () => {
      this.groups()[group.id] = { ...group, members: [...group.members] };
      await this.append({ type: "group", group, at: new Date().toISOString() });
    });
  }

  async group(groupId: string): Promise<Group | null> {
    const found = this.groups()[groupId];
    return found ? { ...found, members: [...found.members] } : null;
  }

  async groupsFor(badge: BadgeRecord): Promise<Group[]> {
    // By creator, for each actor the badge claims — the one bounded question
    // this list answers. Never "every group", and never the groups a badge is
    // merely IN: those are the owner's list, members and all.
    const actorIds = new Set(badge.claims.map((claim) => claim.actorId));
    return Object.values(this.groups())
      .filter((group) => isGroupLive(group) && actorIds.has(group.createdBy))
      .map((group) => ({ ...group, members: [...group.members] }));
  }

  async grantsBySubject(subject: GrantSubject): Promise<Grant[]> {
    // The same walk as `grantsFor`, by subject and live rows only; `CloudDesk`
    // serves it with `where("subject", "==", …)`.
    return Object.values(this.state.grants)
      .filter((grant) => isLive(grant) && grant.subject === subject)
      .map((grant) => ({ ...grant }));
  }

  /** The groups ledger, which a desk from before roles phase 5 lacks. */
  private groups(): Record<string, Group> {
    return (this.state.groups ??= {});
  }

  async putGrant(grant: Grant): Promise<void> {
    await this.enqueue(async () => {
      this.state.grants[grant.id] = { ...grant };
      await this.append({ type: "grant", grant, at: grant.at });
    });
  }

  async revokeGrant(grantId: string, at: string, by: string): Promise<Grant | null> {
    return this.enqueue(async () => {
      const grant = this.state.grants[grantId];
      if (!grant) return null;
      // Idempotent: the first revocation's stamp stands, so two people
      // turning the link off at once do not argue about when it went off.
      if (grant.revokedAt !== undefined) return { ...grant };
      grant.revokedAt = at;
      grant.revokedBy = by;
      await this.append({ type: "revoke", grantId, by, at });
      return { ...grant };
    });
  }

  // ---- passes ----

  async putPass(pass: PassRecord): Promise<void> {
    await this.enqueue(async () => {
      this.state.passes[pass.id] = { ...pass };
      await this.append({ type: "pass", pass, at: pass.createdAt });
    });
  }

  async pass(passId: string): Promise<PassRecord | null> {
    const found = this.state.passes[passId];
    return found ? { ...found } : null;
  }

  async passesMintedBy(badgeId: string): Promise<PassRecord[]> {
    // A walk, for `grantsFor`'s reason: the SEAM is the query, and the cloud
    // backing serves it with an index.
    return Object.values(this.state.passes)
      .filter((pass) => pass.mintedBy === badgeId)
      .map((pass) => ({ ...pass }));
  }

  /**
   * Single-use, and on a file backing the guarantee comes from the desk's own
   * write chain: `enqueue` serializes this read-modify-write against every
   * other desk write, so two redemptions of one pass arriving in the same
   * millisecond are two runs of this function one after the other, and the
   * second one sees `redeemedAt` set.
   *
   * Both halves of the answer are load-bearing. `redeemed` says who won;
   * `pass` is the row as the WINNER left it, so the loser can be told when it
   * was spent rather than merely refused.
   */
  async redeemPass(
    passId: string,
    at: string,
    by: string,
  ): Promise<{ pass: PassRecord; redeemed: boolean } | null> {
    return this.enqueue(async () => {
      const pass = this.state.passes[passId];
      if (!pass) return null;
      if (pass.redeemedAt !== undefined) return { pass: { ...pass }, redeemed: false };
      pass.redeemedAt = at;
      pass.redeemedBy = by;
      await this.append({ type: "redeem", passId, by, at });
      return { pass: { ...pass }, redeemed: true };
    });
  }

  // ---- the migration shelf ----

  async adopt(sessionKey: string, badgeId: string): Promise<ActorClaim | null> {
    return this.enqueue(async () => {
      const row = this.state.shelf[sessionKey];
      const badge = this.live(badgeId);
      if (!row || !badge) return null;
      delete this.state.shelf[sessionKey];
      badge.claims = [...badge.claims.filter((c) => c.actorId !== row.actorId), row];
      await this.append({ type: "adopt", sessionKey, badgeId, at: new Date().toISOString() });
      return { ...row };
    });
  }

  async shelve(rows: Record<string, ActorClaim>): Promise<void> {
    if (Object.keys(rows).length === 0) return;
    await this.enqueue(async () => {
      for (const [key, row] of Object.entries(rows)) this.state.shelf[key] = row;
      await this.append({ type: "shelve", rows, at: new Date().toISOString() });
    });
  }

  /**
   * Mint once, then answer the same key forever. The write chain is what
   * makes "once" true here: two callers racing arrive one after the other,
   * and the second sees the first's key rather than replacing it.
   *
   * 256 bits from the CSPRNG — `mintBadge`'s number, because it is the same
   * kind of secret and there is no reason for this home to hold two opinions
   * about how long a secret is.
   */
  async contentKey(): Promise<string> {
    if (this.state.contentKey) return this.state.contentKey;
    await this.enqueue(async () => {
      if (this.state.contentKey) return;
      const key = randomBytes(32).toString("base64url");
      this.state.contentKey = key;
      await this.append({ type: "contentkey", key, at: new Date().toISOString() });
    });
    return this.state.contentKey!;
  }

  // ---- the operator's ledger (operator phase 1) ----

  async recordOperatorAct(act: OperatorAct): Promise<void> {
    await this.enqueue(async () => {
      this.state.operator![act.id] = { ...act };
      await this.append({ type: "operator", act, at: act.at });
    });
  }

  /**
   * The outcome, onto the row that is already there.
   *
   * Silent when the row is missing rather than throwing, for `touch`'s reason
   * and a sharper one: this runs on the way OUT of an act, and a settle that
   * threw would turn a successful act into a refusal the person reads as the
   * act having failed. A row that is not there stays not there, and the act's
   * own answer is still the truth about what happened.
   */
  async settleOperatorAct(id: string, outcome: string, reach?: unknown): Promise<void> {
    await this.enqueue(async () => {
      const row = this.state.operator![id];
      if (!row) return;
      const settled: OperatorAct = { ...row, outcome, ...(reach !== undefined ? { reach } : {}) };
      this.state.operator![id] = settled;
      await this.append({ type: "operator", act: settled, at: settled.at });
    });
  }

  /**
   * Newest first, in memory: this ledger is small by construction — one row
   * per act a person performed by hand, at a sign-in page — so a sort over all
   * of it costs nothing a query would save. The cloud desk pages instead,
   * because Firestore charges by document read rather than by array length.
   */
  async operatorActs(options: { target?: string | null; limit?: number } = {}): Promise<OperatorAct[]> {
    const target = options.target ?? null;
    return Object.values(this.state.operator ?? {})
      .filter((act) => target === null || act.target === target)
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, options.limit ?? 100)
      .map((act) => ({ ...act }));
  }

  // ---- takedowns (operator phase 2) ----

  async recordTakedown(row: CanvasTakedown): Promise<void> {
    await this.enqueue(async () => {
      (this.state.takedowns ??= {})[row.canvasId] = { ...row };
      await this.append({ type: "takedown", row, at: row.at });
    });
  }

  async liftTakedown(
    canvasId: string,
    lifted: { at: string; by: string; actId: string },
  ): Promise<void> {
    await this.enqueue(async () => {
      const row = this.state.takedowns?.[canvasId];
      if (!row) return;
      const next: CanvasTakedown = {
        ...row,
        liftedAt: lifted.at,
        liftedBy: lifted.by,
        liftedActId: lifted.actId,
      };
      this.state.takedowns![canvasId] = next;
      await this.append({ type: "takedown", row: next, at: lifted.at });
    });
  }

  async markPurged(
    canvasId: string,
    purged: { at: string; actId: string; counts: PurgeCounts },
  ): Promise<void> {
    await this.enqueue(async () => {
      const row = this.state.takedowns?.[canvasId];
      if (!row) return;
      const next: CanvasTakedown = {
        ...row,
        purgedAt: purged.at,
        purgedActId: purged.actId,
        purged: { ...purged.counts },
      };
      this.state.takedowns![canvasId] = next;
      await this.append({ type: "takedown", row: next, at: purged.at });
    });
  }

  async takedownFor(canvasId: string): Promise<CanvasTakedown | null> {
    const row = this.state.takedowns?.[canvasId];
    return row ? { ...row } : null;
  }

  /** In force only — a lifted row is history, and every caller of this wants
   * the set the door and the canvas list act on. `takedownFor` is where the
   * history is read. */
  async takedowns(): Promise<CanvasTakedown[]> {
    return Object.values(this.state.takedowns ?? {})
      .filter(inForce)
      .map((row) => ({ ...row }));
  }

  // ---- internals ----

  /**
   * The badge behind an id, **or nothing if it was killed** — the one lookup
   * every method here goes through, so "a killed badge is a badge nobody
   * holds" is a property of the file rather than a rule each method
   * remembers. `killBadge` and `replay` are the two deliberate exceptions:
   * they are the code that reads the tombstone.
   */
  private live(badgeId: string): BadgeRecord | undefined {
    const badge = this.state.badges[badgeId];
    return badge && badge.killedAt === undefined ? badge : undefined;
  }

  /** Serialize this desk's own writes. Not the engine's chain: a badge write
   * is not an op and must not be able to stall behind one. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.chain.then(work);
    this.chain = result.catch(() => {});
    return result;
  }

  /** Durable first, derived second — the same order the oplog uses. */
  private async append(entry: NewEntry<DeskLogEntry>): Promise<void> {
    const seq = this.state.lastSeq + 1;
    await appendLineDurable(p.badgesLogFile(this.home), JSON.stringify({ seq, ...entry }));
    this.state.lastSeq = seq;
    await this.writeSnapshot();
  }

  private async writeSnapshot(): Promise<void> {
    await writeFileAtomic(p.badgesFile(this.home), JSON.stringify(this.state, null, 2));
  }

  private replay(entry: DeskLogEntry): void {
    switch (entry.type) {
      case "badge": {
        // A recovered badge starts with no admissions: the address admits, so
        // it re-admits itself the moment it asks for something.
        this.state.badges[entry.badgeId] ??= {
          badgeId: entry.badgeId,
          secretHash: entry.secretHash,
          kind: entry.kind,
          createdAt: entry.at,
          lastSeen: entry.at,
          admissions: [],
          claims: [],
        };
        return;
      }
      case "claims": {
        const badge = this.state.badges[entry.badgeId];
        if (badge) badge.claims = entry.claims;
        return;
      }
      case "shelve": {
        for (const [key, row] of Object.entries(entry.rows)) this.state.shelf[key] = row;
        return;
      }
      case "adopt": {
        const row = this.state.shelf[entry.sessionKey];
        const badge = this.state.badges[entry.badgeId];
        if (!row) return;
        delete this.state.shelf[entry.sessionKey];
        if (badge) badge.claims = [...badge.claims.filter((c) => c.actorId !== row.actorId), row];
        return;
      }
      case "grant": {
        this.state.grants[entry.grant.id] ??= { ...entry.grant };
        return;
      }
      case "revoke": {
        const grant = this.state.grants[entry.grantId];
        if (!grant || grant.revokedAt !== undefined) return;
        grant.revokedAt = entry.at;
        grant.revokedBy = entry.by;
        return;
      }
      case "pass": {
        this.state.passes[entry.pass.id] ??= { ...entry.pass };
        return;
      }
      case "redeem": {
        const pass = this.state.passes[entry.passId];
        // The first redemption stands, exactly as the first revocation does:
        // replaying a log must not hand a spent pass to a second badge.
        if (!pass || pass.redeemedAt !== undefined) return;
        pass.redeemedAt = entry.at;
        pass.redeemedBy = entry.by;
        return;
      }
      case "attest": {
        const badge = this.state.badges[entry.badgeId];
        if (badge) badge.attestations = upsertAttestation(badge.attestations, entry.attestation);
        return;
      }
      case "kill": {
        // Reads the raw record rather than `live`, and does not care whether
        // the badge is already dead: replaying a kill over a kill must leave
        // the FIRST stamp standing, exactly as replaying a revoke does.
        const badge = this.state.badges[entry.badgeId];
        if (!badge || badge.killedAt !== undefined) return;
        badge.killedAt = entry.at;
        badge.killedBy = entry.by;
        if (entry.end) badge.end = entry.end;
        return;
      }
      case "space": {
        // A replacement, not `??=`: the log carries the space whole on every
        // write, and the newest write is the row.
        this.spaces()[entry.space.id] = { ...entry.space, canvasIds: [...entry.space.canvasIds] };
        return;
      }
      case "group": {
        // A replacement, like a space's: the newest write is the row.
        this.groups()[entry.group.id] = { ...entry.group, members: [...entry.group.members] };
        return;
      }
      case "seen": {
        // Merged rather than replaced, so a tail replayed in any order lands
        // on the same answer — the property `advanceSeen` exists for.
        const marks = (this.seen()[entry.actorId] ??= {});
        marks[entry.canvasId] = advanceSeen(marks[entry.canvasId], entry.mark);
        return;
      }
      case "operator": {
        // A replacement, not a `??=`: the second write of an act id is its
        // settled outcome, and a replay that kept the first would recover
        // every completed act as `attempted`.
        (this.state.operator ??= {})[entry.act.id] = { ...entry.act };
        return;
      }
      case "takedown": {
        // A replacement, like `operator` above and for the same reason: a lift
        // is a REWRITE of the one row, so a replay that kept the first would
        // recover a lifted canvas as still down — the one direction this
        // mistake must never go.
        (this.state.takedowns ??= {})[entry.row.canvasId] = { ...entry.row };
        return;
      }
      case "contentkey": {
        // `??=`, and it is the strong kind: a key is written once, so a
        // second entry could only come from a log two homes wrote into — and
        // there the FIRST key is the one whose signatures are in flight.
        this.state.contentKey ??= entry.key;
        return;
      }
    }
  }
}
