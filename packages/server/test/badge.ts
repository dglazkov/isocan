import { DOOR_ROUTE, formatBadgeToken, type DoorResponse } from "@isocan/core";

/**
 * A badge, for tests that are about something else.
 *
 * The daemon refuses badge-less requests now, so every test that talks to it
 * over HTTP needs one — which is fixture work, not a change in what those
 * tests assert. Node's `fetch` has no cookie jar, so tests use the bearer
 * carrier; both carriers are accepted from anyone, so this is not a fiction.
 */
export interface TestBadge {
  badgeId: string;
  token: string;
  /** Spread into any `fetch` init. */
  headers: Record<string, string>;
}

export async function mintTestBadge(base: string): Promise<TestBadge> {
  const res = await fetch(`${base}${DOOR_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier: "bearer" }),
  });
  if (!res.ok) throw new Error(`the door refused: HTTP ${res.status}`);
  const door = (await res.json()) as DoorResponse;
  const token = formatBadgeToken(door.badgeId, door.secret!);
  return { badgeId: door.badgeId, token, headers: { Authorization: `Bearer ${token}` } };
}
