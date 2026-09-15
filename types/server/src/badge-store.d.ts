import type { Actor, BadgeStore, StoredBadge } from "../../core/src/index.js";
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
export { askTheDoor, bearerHeader } from "../../core/src/index.js";
export type { BadgeStore, DoorAnswer, StoredBadge } from "../../core/src/index.js";
/**
 * The `auth` block `identity.json` has stubbed since the beginning, read.
 *
 * It sits beside the human's name because a machine's credential belongs
 * beside the machine's person — one badge per (client home directory, address)
 * pair, holding the human's claim and each of its agents'.
 */
export declare function readBadge(home: string, base: string): Promise<StoredBadge | null>;
/** Rename the home person, or explicitly choose a fresh ID, inside the same
 * transaction as credentials and pass adoption. Unknown fields remain intact. */
export declare function writeIdentityName(home: string, name: string, fresh?: boolean): Promise<Actor>;
/** Merge a credential without dropping the person, other badges or private fields. */
export declare function writeBadge(home: string, base: string, badge: StoredBadge): Promise<void>;
/** Persist only an actor returned by successful pass redemption. A different
 * person already held by the machine remains its default. The choice and
 * write share the badge queue, so neither can erase the other's fresh fields. */
export declare function adoptIdentity(home: string, actor: Actor): Promise<{
    actor: Actor;
    adopted: boolean;
}>;
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
export declare function knockOnDoor(base: string, timeoutMs?: number): Promise<StoredBadge | null>;
/**
 * **The file-backed badge store** — `identity.json`'s `auth` block for one
 * address, as the two verbs `DaemonRoutes` takes (docs/projects/room/design.md,
 * `routes`). The CLI, the MCP server and every Node holder hand this one over;
 * a host with no disk hands its own.
 */
export declare function fileBadgeStore(home: string, base: string): BadgeStore;
