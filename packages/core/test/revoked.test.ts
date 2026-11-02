import { describe, expect, it } from "vitest";
import type { Grant } from "../src/grants.ts";
import { operatorTurnedOff, revokedSentence } from "../src/revoked.ts";

/**
 * **The two pure rules of a grant the operator turned off** — operator phase
 * 5. Both are in core because both surfaces need the same answer: the Share
 * dialog and `isocan share` render one sentence, and the home decides which
 * tombstones are the operator's with one function — so neither client can
 * grow its own opinion about whose act a revoke was.
 *
 * Fixtures are synthetic: Acme, Jordan, Olu.
 */

const at = "2026-09-12T10:00:00.000Z";
const later = "2026-09-12T11:00:00.000Z";

const row = (id: string, subject: Grant["subject"], extra: Partial<Grant> = {}): Grant =>
  ({ id, canvasId: "prj_acme", subject, grantedBy: "bdg_priya", at: "2026-09-01T00:00:00.000Z", ...extra }) as Grant;

const byOperator = (id: string, subject: Grant["subject"], revokedAt = at): Grant =>
  row(id, subject, {
    revokedAt,
    revokedBy: "bdg_desk",
    revokedVia: "operator",
    revocation: { reason: "spam", by: "email:olu@example.test", actId: "opr_1" },
  });

const byOwner = (id: string, subject: Grant["subject"], revokedAt = at): Grant =>
  row(id, subject, { revokedAt, revokedBy: "bdg_priya" });

describe("the sentence", () => {
  it("is journey 8 step 3's, dated as the takedown's and naming who to write to", () => {
    expect(revokedSentence(byOperator("gnt_1", "link"))).toBe(
      "Turned off by the operator of this home on 12 September 2026: spam. Write to olu@example.test.",
    );
  });

  it("says nothing about an owner's own revoke, or a row that is live", () => {
    // The owner's act is the owner's: there is no sentence to render about it,
    // and a caller that asked gets nothing rather than words about nobody.
    expect(revokedSentence(byOwner("gnt_1", "link"))).toBeNull();
    expect(revokedSentence(row("gnt_2", "link"))).toBeNull();
  });
});

describe("which tombstones the owner is shown", () => {
  it("the operator's, when nothing live has replaced it", () => {
    const off = operatorTurnedOff([byOperator("gnt_1", "link")]);
    expect(off.map((g) => g.id)).toEqual(["gnt_1"]);
  });

  it("nothing, once the owner has turned it back on — she can, and the notice goes", () => {
    expect(operatorTurnedOff([byOperator("gnt_1", "link"), row("gnt_2", "link")])).toEqual([]);
  });

  it("nothing for the owner's own revokes: the owner's act is the owner's", () => {
    expect(operatorTurnedOff([byOwner("gnt_1", "link"), byOwner("gnt_2", "email:jordan@example.test")])).toEqual([]);
  });

  it("the newest tombstone per subject decides", () => {
    // Operator off, owner on, owner off again: the last word is hers.
    expect(operatorTurnedOff([byOperator("gnt_1", "link"), byOwner("gnt_2", "link", later)])).toEqual([]);
    // Owner off, owner on, operator off: the last word is the home's.
    expect(operatorTurnedOff([byOwner("gnt_1", "link"), byOperator("gnt_2", "link", later)]).map((g) => g.id)).toEqual([
      "gnt_2",
    ]);
  });

  it("is per subject, and a live bar on the subject changes nothing", () => {
    // A bar is not what the owner is being told about: it is a live row that
    // says no, and the sentence is about the invitation that was turned off.
    const rows = [
      byOperator("gnt_1", "email:jordan@example.test"),
      row("gnt_bar", "email:jordan@example.test", { bars: true }),
      row("gnt_link", "link"),
    ];
    expect(operatorTurnedOff(rows).map((g) => g.id)).toEqual(["gnt_1"]);
  });
});
