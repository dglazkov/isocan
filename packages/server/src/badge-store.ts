import { promises as fs, type Stats } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Actor, BadgeStore, StoredBadge } from "@isocan/core";
import { askTheDoor, newActorId, normalizeHomeUrl } from "@isocan/core";
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

/** Keep local callers ordered as well as serializing other processes. The lock
 * covers only the physical home's read/choice/atomic replacement, never a door
 * request. An abandoned lock requires explicit inspection, not PID guessing. */
let identityWrites: Promise<unknown> = Promise.resolve();

function hasCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === code;
}

function sameFile(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

async function identityLock(home: string): Promise<() => Promise<void>> {
  const directory = path.join(home, ".identity-write.lock");
  const ownerFile = path.join(directory, "owner.json");
  const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  const deadline = Date.now() + 5_000;
  for (;;) {
    try {
      await fs.mkdir(directory, { mode: 0o700 });
      break;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      if (Date.now() >= deadline) {
        throw new Error(`Identity write is locked at ${directory}. Inspect the owner and recover an abandoned lock explicitly; it was not removed.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  const claimed = await fs.lstat(directory);
  let ownedFile: Stats | undefined;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(ownerFile, "wx", 0o600);
    ownedFile = await handle.stat();
    await handle.writeFile(owner);
    await handle.close();
    handle = undefined;
  } catch (error) {
    await handle?.close().catch(() => {});
    // Only our newly claimed directory and, if created, our own partial file.
    // A replacement/foreign record is never recursively removed.
    if (sameFile(claimed, await fs.lstat(directory))) {
      if (ownedFile && sameFile(ownedFile, await fs.lstat(ownerFile))) await fs.unlink(ownerFile);
      await fs.rmdir(directory);
    }
    throw error;
  }
  return async () => {
    if (!sameFile(claimed, await fs.lstat(directory)) || await fs.readFile(ownerFile, "utf8") !== owner) {
      throw new Error(`Identity lock ownership changed at ${directory}; the lock was not removed.`);
    }
    await fs.unlink(ownerFile);
    await fs.rmdir(directory);
  };
}

function identityObject(value: unknown, file: string): Record<string, unknown> {
  const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!object(value) || ["id", "name", "createdAt"].some((key) => value[key] !== undefined && typeof value[key] !== "string") ||
      (value.auth !== undefined && !object(value.auth))) {
    throw new Error(`Unsupported identity data at ${file}; the existing file was not replaced.`);
  }
  return value;
}

async function updateIdentity<T>(
  home: string,
  update: (current: Record<string, unknown>) => { next?: Record<string, unknown>; result: T },
): Promise<T> {
  const work = identityWrites.then(async () => {
    await fs.mkdir(home, { recursive: true });
    const physicalHome = await fs.realpath(home);
    const release = await identityLock(physicalHome);
    try {
      const file = identityFile(physicalHome);
      let current: Record<string, unknown> = {};
      try {
        current = identityObject(JSON.parse(await fs.readFile(file, "utf8")), file);
      } catch (error) {
        // A fresh machine may have a badge before it has a person. No other
        // read/parse failure grants permission to replace existing data.
        if (!hasCode(error, "ENOENT")) throw error;
      }
      const { next, result } = update(current);
      if (next) {
        const mode = await fs.stat(file).then((stat) => stat.mode & 0o777).catch((error: unknown) => {
          if (!hasCode(error, "ENOENT")) throw error;
          return 0o600;
        });
        await writeFileAtomic(file, JSON.stringify(next, null, 2), mode);
      }
      return result;
    } finally {
      await release();
    }
  });
  identityWrites = work.catch(() => {});
  return work;
}

/** Rename the home person, or explicitly choose a fresh ID, inside the same
 * transaction as credentials and pass adoption. Unknown fields remain intact. */
export async function writeIdentityName(home: string, name: string, fresh = false): Promise<Actor> {
  return updateIdentity(home, (current) => {
    const id = !fresh && current.id && current.name ? current.id as string : newActorId();
    const actor = { id, name };
    return { next: { ...current, ...actor, createdAt: new Date().toISOString() }, result: actor };
  });
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
