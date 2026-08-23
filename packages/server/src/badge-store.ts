import { promises as fs } from "node:fs";
import type { DoorResponse } from "@isocan/core";
import { BADGE_SCHEME, DOOR_ROUTE, formatBadgeToken } from "@isocan/core";
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
    const badge = raw.auth?.[base];
    return badge?.badgeId && badge.secret ? badge : null;
  } catch {
    return null;
  }
}

/** Read-merge, never clobber: `identity.json` also holds the human's name,
 * and a badge write that rewrote the file from scratch would delete it (and
 * the mirror bug — `isocan identity --name` deleting the badge — is why
 * `writeIdentity` merges too). The same argument now covers a second badge:
 * a daemon writing its home badge must not erase the CLI's local one. */
export async function writeBadge(home: string, base: string, badge: StoredBadge): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await fs.readFile(identityFile(home), "utf8")) as Record<string, unknown>;
  } catch {
    // No identity yet: an agent-only machine gets a file holding just its
    // badge. `readIdentity` returns null without id/name, so nothing
    // mis-resolves.
  }
  const auth = { ...((current.auth as Record<string, StoredBadge>) ?? {}), [base]: badge };
  await fs.writeFile(identityFile(home), JSON.stringify({ ...current, auth }, null, 2));
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
  try {
    const res = await fetch(`${base}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const door = (await res.json()) as DoorResponse;
    if (!door.secret) return null;
    return { badgeId: door.badgeId, secret: door.secret, at: new Date().toISOString() };
  } catch {
    return null;
  }
}

/** `Authorization: Bearer <badgeId>.<secret>` — the one place that spelling
 * is written, so a holder cannot get the separator wrong on its own. */
export function bearerHeader(badge: StoredBadge): Record<string, string> {
  return { Authorization: `${BADGE_SCHEME} ${formatBadgeToken(badge.badgeId, badge.secret)}` };
}
