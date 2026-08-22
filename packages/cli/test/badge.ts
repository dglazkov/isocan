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
