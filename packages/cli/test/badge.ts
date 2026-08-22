import { DOOR_ROUTE, formatBadgeToken, type DoorResponse } from "@isocan/core";

/**
 * A badge, for tests that drive the daemon directly.
 *
 * The CLI gets its own at the door and presents it on every request — that is
 * what these tests are asserting stays invisible — but a test that also pokes
 * the daemon over raw `fetch` to seed a canvas or read a roster is a client
 * like any other, and needs one of its own.
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
