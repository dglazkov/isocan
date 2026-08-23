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
  /**
   * Make this badge speak for an actor.
   *
   * Mechanism 5 checks that a request names only actors its badge claims, so
   * a test that seeds a canvas as `usr_a` has to say who `usr_a` is first.
   * Fixture work, not a change in what anything asserts: `as` plus a name is
   * how a stranded identity is brought in from elsewhere, and it is what the
   * CLI and the browser both send on their own behalf.
   */
  speakAs(actor: { id: string; name: string }, sessionKey?: string): Promise<void>;
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
  const headers = { Authorization: `Bearer ${token}` };
  return {
    badgeId: door.badgeId,
    token,
    headers,
    async speakAs(actor, sessionKey = `test:${actor.id}`) {
      const claimed = await fetch(`${base}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          projectId: null,
          op: { type: "actor.claim", sessionKey, as: actor.id, name: actor.name },
        }),
      });
      if (!claimed.ok) {
        throw new Error(`the desk would not vouch for ${actor.id}: ${await claimed.text()}`);
      }
    },
  };
}
