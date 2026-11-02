import { describe, expect, it } from "vitest";
import { CLAIM_REFUSAL, applyClaim, emptyActorRegistry, type ClaimContext } from "../src/claims.ts";
import { OpValidationError } from "../src/errors.ts";

/**
 * **Which refusal of `as` a `name-taken` is** (docs/projects/room/design.md,
 * the claim rule, "Dual-held agents"). A room treats an agent another badge
 * holds as not held here, and retries the refusals that pass on their own, so
 * the refusal says which it is in a field, not only in its sentence.
 */

const NOW = "2026-09-13T12:00:00.000Z";
const JUST_NOW = "2026-09-13T11:59:30.000Z";
const PERCY = { id: "act_percy", name: "Percy" };

function context(extra: Partial<ClaimContext>): ClaimContext {
  const registry = emptyActorRegistry();
  registry.names[PERCY.id] = { name: PERCY.name, at: JUST_NOW };
  return { registry, own: [], scoped: [], claimants: [], held: [], now: NOW, ...extra };
}

function refusal(ctx: ClaimContext): { code: string; reason: string | undefined; message: string } {
  try {
    applyClaim(ctx, { type: "actor.claim", sessionKey: "agent:machine-key", as: PERCY.id });
  } catch (err) {
    if (err instanceof OpValidationError) return { code: err.code, reason: err.reason, message: err.message };
    throw err;
  }
  throw new Error("the claim was allowed");
}

describe("a refused `as` says which refusal it is", () => {
  it("held elsewhere: another badge speaks as the actor under another key", () => {
    expect(refusal(context({ heldElsewhere: true }))).toMatchObject({
      code: "name-taken",
      reason: CLAIM_REFUSAL.heldElsewhere,
      message: expect.stringContaining("another surface already speaks as them"),
    });
  });

  it("claimed just now: another key on this badge claimed it in the last minute", () => {
    const claimants = [{ actorId: PERCY.id, boundAt: JUST_NOW, sessionKey: "agent:Percy" }];
    expect(refusal(context({ claimants }))).toMatchObject({ code: "name-taken", reason: CLAIM_REFUSAL.claimedJustNow });
  });

  it("live: the actor's face is on a canvas", () => {
    const held = [{ actor: PERCY, canvas: "Acme Board", live: true }];
    expect(refusal(context({ held }))).toMatchObject({ code: "name-taken", reason: CLAIM_REFUSAL.live });
  });

  it("held elsewhere wins when it is true beside a refusal that passes, in the field and in the sentence", () => {
    const held = [{ actor: PERCY, canvas: "Acme Board", live: true }];
    expect(refusal(context({ held, heldElsewhere: true }))).toMatchObject({
      reason: CLAIM_REFUSAL.heldElsewhere,
      message: expect.stringContaining("another surface already speaks as them"),
    });
  });
});
