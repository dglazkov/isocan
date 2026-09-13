import { promises as fs } from "node:fs";
import type { Actor, DoorResponse } from "@isocan/core";
import { BADGE_SCHEME, DOOR_ROUTE, formatBadgeToken, normalizeHomeUrl } from "@isocan/core";
import { writeFileAtomic } from "./fsutil.ts";
import { identityFile } from "./paths.ts";

/**
 * How a bearer holder keeps the badge it was handed, and how it goes back to
 * the door for another.
 *
 * ONE implementation, deliberately, and it lives in `@isocan/server` rather
 * than in the CLI where it grew up. Two holders now need it: the `isocan` CLI
 * talking to its local daemon, and — from phase 6 stage 2 — a local daemon's
 * home connection talking to the hosted home. "How do I get a badge" is
 * exactly the computation house rule 4 forbids having twice: a second copy
 * that drifted by one field would produce a daemon and a CLI that disagree
 * about which credential is in the file, on the same machine, in the same
 * file.
 *
 * `@isocan/server` is the right side of the seam even though the CLI is the
 * older caller: the CLI already imports `paths` and `readConfigFile` from
 * here, `identityFile` is a server path, and the dependency runs cli →
 * server and never back. Core was the other candidate and is wrong — it has
 * no filesystem and must not grow one.
 */

/**
 * One badge, as `identity.json`'s `auth` block holds it.
 *
 * Keyed by home address in that block, which is what makes a second badge
 * free: a machine holds its badge at `http://127.0.0.1:4441` (its own daemon)
 * AND its badge at `https://isocan.io` (the daemon's home) in the same file,
 * under two keys, with neither aware of the other.
 *
 * **From phase 10.3 the key is NORMALIZED** (`normalizeHomeUrl`), and here
 * rather than at each call site — house rule 4's ordinary argument, sharpened
 * by what this file already says: two answers to "which credential is in that
 * file" on one machine is the divergence the module exists to prevent, and a
 * trailing slash would have been exactly that. A daemon holds one badge per
 * home now, so an address that spelled itself two ways would knock on one
 * door twice and hold two badges, of which only one carries the admissions.
 *
 * **No on-disk migration, and that is measured rather than assumed.** The
 * `auth` block was already keyed per address, and the only spellings that
 * CHANGE under normalization are a trailing slash and a mixed-case host. A
 * machine whose config carried one re-badges exactly once: the fresh badge
 * holds no admissions, the local half of the sweep keeps every canvas, and the
 * machine is let back in by a pass. That cost belongs in 10.5's upgrade doc,
 * not in engineering around it.
 */
export interface StoredBadge {
  badgeId: string;
  secret: string;
  at: string;
}

/**
 * The `auth` block `identity.json` has stubbed since the beginning, read.
 *
 * It sits beside the human's name because a machine's credential belongs
 * beside the machine's person — one badge per (client home directory, address)
 * pair, holding the human's claim and each of its agents'.
 */
export async function readBadge(home: string, base: string): Promise<StoredBadge | null> {
  try {
    const raw = JSON.parse(await fs.readFile(identityFile(home), "utf8")) as {
      auth?: Record<string, StoredBadge>;
    };
    const badge = raw.auth?.[normalizeHomeUrl(base)];
    return badge?.badgeId && badge.secret ? badge : null;
  } catch {
    return null;
  }
}

/**
 * One process owns setup's credential writes (#284). Replica setup asks its
 * daemon to adopt the pass-returned actor; direct setup writes here in the
 * same process as its badge client. Both share this read/modify/write queue.
 * This is not a cross-process lock for unrelated identity rename commands.
 */
let identityWrites: Promise<unknown> = Promise.resolve();

async function updateIdentity<T>(
  home: string,
  update: (current: Record<string, unknown>) => { next?: Record<string, unknown>; result: T },
): Promise<T> {
  const work = identityWrites.then(async () => {
    await fs.mkdir(home, { recursive: true });
    const file = identityFile(home);
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    } catch {
      // A fresh machine may have a badge before it has a person.
    }
    const { next, result } = update(current);
    if (next) {
      const mode = await fs.stat(file).then((stat) => stat.mode & 0o777).catch(() => 0o600);
      await writeFileAtomic(file, JSON.stringify(next, null, 2), mode);
    }
    return result;
  });
  identityWrites = work.catch(() => {});
  return work;
}

/** Merge a credential without dropping the person, other badges or private fields. */
export async function writeBadge(home: string, base: string, badge: StoredBadge): Promise<void> {
  return updateIdentity(home, (current) => ({
    next: {
      ...current,
      auth: {
        ...((current.auth as Record<string, StoredBadge>) ?? {}),
        [normalizeHomeUrl(base)]: badge,
      },
    },
    result: undefined,
  }));
}

/** Persist only an actor returned by successful pass redemption. A different
 * person already held by the machine remains its default. The choice and
 * write share the badge queue, so neither can erase the other's fresh fields. */
export async function adoptIdentity(
  home: string,
  actor: Actor,
): Promise<{ actor: Actor; adopted: boolean }> {
  return updateIdentity<{ actor: Actor; adopted: boolean }>(home, (current) => {
    const existing = current.id && current.name
      ? { id: current.id as string, name: current.name as string }
      : null;
    if (existing && existing.id !== actor.id) return { result: { actor: existing, adopted: false } };
    if (!actor.name) return { result: { actor, adopted: false } };
    return {
      next: { ...current, ...actor, createdAt: new Date().toISOString() },
      result: { actor, adopted: true },
    };
  });
}

/**
 * Knock on the door at `base` and keep what it hands over. Null when the door
 * itself refused or could not be reached, so a caller does not loop.
 *
 * The bearer carrier, always: this function exists for holders that set
 * headers. A browser gets its badge on the page load with `Set-Cookie` and
 * never comes here — and a bearer response is the only one that carries a
 * secret in the body at all (returning the cookie's secret in JSON would hand
 * page JavaScript the very credential `HttpOnly` exists to hide).
 */
export async function knockOnDoor(base: string, timeoutMs = 10_000): Promise<StoredBadge | null> {
  const answer = await askTheDoor(base, timeoutMs);
  return "badge" in answer ? answer.badge : null;
}

/**
 * What the door said, refusal and all — the same knock, with the answer kept
 * instead of flattened to null.
 *
 * **Why this exists** (phase 13.7). The door is metered now, and a `null`
 * here becomes, one frame up the stack, the ORIGINAL 401 the caller was
 * recovering from: *"a badge is required — ask the door for one."* Told to a
 * person whose knock was just refused 429, that is this codebase's oldest
 * failure — the cheerful wrong answer — delivered as advice to do the one
 * thing that cannot work. So the refusal travels.
 *
 * `knockOnDoor` keeps its null contract for the callers whose recovery is
 * genuinely "give up quietly" (`HomeLink.ensureBadge`, where the replica's
 * next attempt is the retry), and the CLI takes this form because its caller
 * is a person reading a terminal.
 */
export type DoorAnswer =
  | { badge: StoredBadge }
  | { refused: { status: number; error: string; code?: string } };

export async function askTheDoor(base: string, timeoutMs = 10_000, signal?: AbortSignal): Promise<DoorAnswer> {
  try {
    const res = await fetch(`${base}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
      signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
    });
    const body = (await res.json().catch(() => null)) as (DoorResponse & Refused) | null;
    if (!res.ok) {
      return {
        refused: {
          status: res.status,
          error: body?.error ?? `the door refused: HTTP ${res.status}`,
          ...(body?.code ? { code: body.code } : {}),
        },
      };
    }
    if (!body?.secret) {
      // 200 with no secret is the door answering a caller it already knows —
      // which this function's caller, by construction, is not. Nothing to
      // keep, and nothing a retry improves.
      return { refused: { status: res.status, error: "the door handed back no secret" } };
    }
    return { badge: { badgeId: body.badgeId, secret: body.secret, at: new Date().toISOString() } };
  } catch (err) {
    return { refused: { status: 0, error: `could not reach the door at ${base}: ${(err as Error).message}` } };
  }
}

/** This file's `{error, code}` — the shape every refusal in `http.ts` uses. */
interface Refused {
  error?: string;
  code?: string;
}

/** `Authorization: Bearer <badgeId>.<secret>` — the one place that spelling
 * is written, so a holder cannot get the separator wrong on its own. */
export function bearerHeader(badge: StoredBadge): Record<string, string> {
  return { Authorization: `${BADGE_SCHEME} ${formatBadgeToken(badge.badgeId, badge.secret)}` };
}
