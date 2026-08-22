import { promises as fs } from "node:fs";
import type { ActorClaim } from "@isocan/core";
import { SHELF } from "@isocan/core";
import { appendLineDurable, readJson, readJsonLines, writeFileAtomic } from "./fsutil.ts";
import * as p from "./paths.ts";
import type { Admission, BadgeRecord, Desk, Provenance } from "./desk.ts";

/**
 * The desk on a disk. Layout under `~/.isocan/desk/`:
 *   badges.jsonl — append-only; the durable half. The source of truth.
 *   badges.json  — { lastSeq, badges, shelf } derived snapshot.
 *
 * Snapshot-plus-tail, the same idiom as `actors.jsonl`/`actors.json`, for the
 * same reason: a claim row carries authorization now, and a table that is
 * truth with nothing behind it turns "I lost a file" into "I cannot have my
 * own name back until phase 9 ships kill-a-badge". The log is fsynced before
 * a write is acknowledged.
 *
 * WHAT IS LOGGED: mints, claim-list replacements, shelving, and adoption —
 * everything that would otherwise be unrecoverable. WHAT IS NOT: `lastSeen`
 * and `admissions`, which re-derive themselves. The address admits, so a
 * badge that lost its admissions re-admits itself on its next request; paying
 * one fsync per (badge, canvas) pair for that would be ceremony.
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
  | { seq: number; type: "adopt"; sessionKey: string; badgeId: string; at: string };

/** `Omit` over a union collapses it to the shared keys; this distributes. */
type NewEntry<T> = T extends unknown ? Omit<T, "seq"> : never;

interface DeskSnapshot {
  lastSeq: number;
  badges: Record<string, BadgeRecord>;
  /** Pre-badge claims waiting for the sessionKey that will collect them. */
  shelf: Record<string, ActorClaim>;
}

/** How stale `lastSeen` may get before a touch costs a snapshot rewrite. A
 * whole-file write on every request would be absurd for a field nothing reads
 * yet; a minute is plenty for the sweeper phase 9 will hang off it. */
const TOUCH_DEBOUNCE_MS = 60_000;

export class FileDesk implements Desk {
  private state: DeskSnapshot = { lastSeq: 0, badges: {}, shelf: {} };
  private chain: Promise<unknown> = Promise.resolve();

  constructor(readonly home: string) {}

  async init(): Promise<void> {
    await fs.mkdir(p.deskDir(this.home), { recursive: true });
    const snapshot = await readJson<DeskSnapshot>(p.badgesFile(this.home));
    this.state = {
      lastSeq: snapshot?.lastSeq ?? 0,
      badges: snapshot?.badges ?? {},
      shelf: snapshot?.shelf ?? {},
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

  async badge(badgeId: string): Promise<BadgeRecord | null> {
    const found = this.state.badges[badgeId];
    return found ? { ...found } : null;
  }

  async touch(badgeId: string, at: string): Promise<void> {
    const badge = this.state.badges[badgeId];
    if (!badge) return;
    const drift = Date.parse(at) - Date.parse(badge.lastSeen);
    badge.lastSeen = at;
    if (!(drift >= TOUCH_DEBOUNCE_MS)) return; // in memory only; not worth a write
    await this.enqueue(() => this.writeSnapshot());
  }

  async setClaims(badgeId: string, claims: ActorClaim[]): Promise<void> {
    await this.enqueue(async () => {
      const badge = this.state.badges[badgeId];
      if (!badge) return;
      badge.claims = claims;
      await this.append({ type: "claims", badgeId, claims, at: new Date().toISOString() });
    });
  }

  async claimsOf(badgeId: string): Promise<ActorClaim[]> {
    return [...(this.state.badges[badgeId]?.claims ?? [])];
  }

  async claimants(actorId: string): Promise<ActorClaim[]> {
    const rows: ActorClaim[] = [];
    for (const badge of Object.values(this.state.badges)) {
      for (const row of badge.claims) if (row.actorId === actorId) rows.push(row);
    }
    for (const row of Object.values(this.state.shelf)) {
      if (row.actorId === actorId) rows.push(row);
    }
    return rows;
  }

  async holdersOf(sessionKey: string): Promise<{ badgeId: string; claim: ActorClaim }[]> {
    const held: { badgeId: string; claim: ActorClaim }[] = [];
    for (const [badgeId, badge] of Object.entries(this.state.badges)) {
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
        if (!badge.admissions.some((a) => wanted.has(a.canvasId))) continue;
        rows.push(...badge.claims);
      }
    }
    return rows;
  }

  async admit(badgeId: string, canvasId: string, provenance: Provenance): Promise<void> {
    const badge = this.state.badges[badgeId];
    if (!badge || badge.admissions.some((a) => a.canvasId === canvasId)) return;
    const admission: Admission = { canvasId, provenance, at: new Date().toISOString() };
    badge.admissions = [...badge.admissions, admission];
    await this.enqueue(() => this.writeSnapshot());
  }

  // ---- the migration shelf ----

  async adopt(sessionKey: string, badgeId: string): Promise<ActorClaim | null> {
    return this.enqueue(async () => {
      const row = this.state.shelf[sessionKey];
      const badge = this.state.badges[badgeId];
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
    }
  }
}
