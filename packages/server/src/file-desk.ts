import { promises as fs } from "node:fs";
import type { ActorClaim, Attestation, Capability, Grant, GrantSubject, Group, Space } from "@isocan/core";
import {
  groupSubject,
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
  | { seq: number; type: "kill"; badgeId: string; by: string; at: string }
  /** A space, WHOLE, on every write (roles phase 4): creation, a canvas added
   * or removed, the tombstone. Replayed as a replacement, not a `??=`, because
   * the latest write is the row. Losing one would quietly widen or narrow who
   * may enter every canvas in it, which is the direction a lost file must
   * never fail in. */
  | { seq: number; type: "space"; space: Space; at: string }
  /** A group, WHOLE, on every write (roles phase 5), for the space's reason:
   * losing a member removal would quietly re-admit somebody to every canvas
   * the group reaches. */
  | { seq: number; type: "group"; group: Group; at: string };

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
}

/** How stale `lastSeen` may get before a touch costs a snapshot rewrite. A
 * whole-file write on every request would be absurd for a field nothing reads
 * yet; a minute is plenty for the sweeper phase 9 will hang off it. */
const TOUCH_DEBOUNCE_MS = 60_000;

export class FileDesk implements Desk {
  private state: DeskSnapshot = { lastSeq: 0, badges: {}, shelf: {}, grants: {}, passes: {}, spaces: {}, groups: {} };
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
    if (!badge || badge.admissions.some((a) => a.canvasId === canvasId)) return;
    const admission: Admission = {
      canvasId,
      provenance,
      at: new Date().toISOString(),
      // Stored whenever it is not edit (`narrowed`, the one place that
      // decides): absent has meant "edit" since before the field existed, and
      // both backings keep that reading.
      ...(narrowed(capability) ? { capability } : {}),
    };
    badge.admissions = [...badge.admissions, admission];
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

  async killBadge(badgeId: string, at: string, by: string): Promise<BadgeRecord | null> {
    return this.enqueue(async () => {
      const badge = this.state.badges[badgeId];
      // Already dead is not an error and is not a second kill: the caller
      // wanted this holder gone and it is, so hand back nothing to sweep.
      if (!badge || badge.killedAt !== undefined) return null;
      badge.killedAt = at;
      badge.killedBy = by;
      // The record as it was ALIVE — admissions and claims intact — because
      // the caller sweeps those canvases and names those actors. Killing the
      // badge is not forgetting where it had been.
      const wasAlive: BadgeRecord = { ...badge };
      await this.append({ type: "kill", badgeId, by, at });
      return wasAlive;
    });
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
    }
  }
}
