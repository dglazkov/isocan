import { describe, expect, it } from "vitest";
import { applyClaim, emptyActorRegistry, type ClaimContext } from "../src/claims.ts";
import type { ActorClaim } from "../src/badge.ts";

/**
 * **Switching the machine's person keeps the one it displaced**
 * (`isocan identity --home --as`, 15 Oct 2026). A badge holding a person under
 * the home key and a second person a pass handed it can make either the
 * default, and back — because re-pointing the home key leaves the displaced
 * person on the badge as a keyless row, the shape `as` accepts as a vouch even
 * while another surface speaks as them.
 */

const NOW = "2026-10-15T12:00:00.000Z";
const EARLIER = "2026-10-15T10:00:00.000Z";
const ADMIRAL = { id: "usr_acme_admiral", name: "Acme Admiral" };
const OWNER = { id: "usr_acme_owner", name: "Acme Owner" };
const HOME = "home:person";

function context(own: ActorClaim[]): ClaimContext {
  const registry = emptyActorRegistry();
  registry.names[ADMIRAL.id] = { name: ADMIRAL.name, at: EARLIER };
  registry.names[OWNER.id] = { name: OWNER.name, at: EARLIER };
  // Both are spoken for by another surface too: without a row on THIS badge,
  // `as` would be refused.
  return { registry, own, scoped: own, claimants: [], held: [], heldElsewhere: true, now: NOW };
}

describe("the home key switches people without dropping one", () => {
  it("makes a handed-over person the default, keeps the old one, and switches back", () => {
    const start: ActorClaim[] = [
      { actorId: ADMIRAL.id, boundAt: EARLIER, sessionKey: HOME },
      { actorId: OWNER.id, boundAt: EARLIER }, // what redeeming a pass writes
    ];
    const switched = applyClaim(context(start), { type: "actor.claim", sessionKey: HOME, as: OWNER.id });
    expect(switched.actor).toEqual(OWNER);
    expect(switched.claims).toEqual([
      { actorId: ADMIRAL.id, boundAt: EARLIER },
      { actorId: OWNER.id, boundAt: NOW, sessionKey: HOME },
    ]);

    const back = applyClaim(context(switched.claims), { type: "actor.claim", sessionKey: HOME, as: ADMIRAL.id });
    expect(back.actor).toEqual(ADMIRAL);
    expect(back.claims).toEqual([
      { actorId: OWNER.id, boundAt: NOW },
      { actorId: ADMIRAL.id, boundAt: NOW, sessionKey: HOME },
    ]);
  });

  it("a coding harness's key re-pointed by `as` still leaves the abandoned actor a stranger", () => {
    const start: ActorClaim[] = [
      { actorId: ADMIRAL.id, boundAt: EARLIER, sessionKey: "claude-code:s-1" },
      { actorId: OWNER.id, boundAt: EARLIER },
    ];
    const switched = applyClaim(context(start), {
      type: "actor.claim",
      sessionKey: "claude-code:s-1",
      as: OWNER.id,
    });
    expect(switched.claims).toEqual([{ actorId: OWNER.id, boundAt: NOW, sessionKey: "claude-code:s-1" }]);
  });
});
