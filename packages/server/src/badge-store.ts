import { promises as fs } from "node:fs";
import type { Actor, BadgeStore, StoredBadge } from "@isocan/core";
import { askTheDoor, normalizeHomeUrl } from "@isocan/core";
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
 * One badge, as `identity.json`'s `auth` block holds it — `StoredBadge`, with
 * the door's knock (`askTheDoor`) and the header it is presented in
 * (`bearerHeader`), lives in `@isocan/core` beside the door vocabulary it
 * speaks (docs/projects/room/design.md): the typed route surface uses all
 * three and must not import this package, and this package calls the knock
 * itself, so neither of the other two could be their home. Re-exported here
 * so every import of them from this file keeps working.
 */
export { askTheDoor, bearerHeader } from "@isocan/core";
export type { BadgeStore, DoorAnswer, StoredBadge } from "@isocan/core";

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
 * **The file-backed badge store** — `identity.json`'s `auth` block for one
 * address, as the two verbs `DaemonRoutes` takes (docs/projects/room/design.md,
 * `routes`). The CLI, the MCP server and every Node holder hand this one over;
 * a host with no disk hands its own.
 */
export function fileBadgeStore(home: string, base: string): BadgeStore {
  return {
    read: () => readBadge(home, base),
    keep: (badge) => writeBadge(home, base, badge),
  };
}
