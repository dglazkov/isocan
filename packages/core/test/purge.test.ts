import { describe, expect, it } from "vitest";
import { OPERATOR_PURGE_ROUTE, purgeNeedsTakedown, replicasHorizon } from "../src/index.ts";

/**
 * **The purge's shared words** — operator phase 3. Two sentences and a route,
 * and each is tested because each is spelled in exactly one place and read on
 * more than one surface.
 */
describe("purge: the shared half", () => {
  it("is a POST under the operator prefix, beside the takedown", () => {
    expect(OPERATOR_PURGE_ROUTE).toBe("/api/operator/canvases/:id/purge");
  });

  it("the refusal is journey 6's sentence, and names the takedown verb", () => {
    const why = purgeNeedsTakedown("prj_reported1");
    expect(why).toMatch(/purge erases; take prj_reported1 down first/);
    expect(why).toMatch(/second of two deliberate acts/);
    expect(why).toContain("isocan operator takedown prj_reported1");
  });

  it("the fourth horizon never closes, and counts what was relaying rather than what is linked", () => {
    const none = replicasHorizon(0);
    expect(none.kind).toBe("replicas");
    expect(none.days).toBeNull();
    expect(none.sentence).toMatch(/members' machines are theirs/);
    expect(none.sentence).toMatch(/none was relaying/);
    expect(replicasHorizon(1).sentence).toMatch(/1 was relaying/);
    expect(replicasHorizon(2).sentence).toMatch(/2 were relaying/);
    // Never "linked": there is no registry of machines that have ever linked.
    expect(replicasHorizon(2).sentence).not.toMatch(/\blinked\b/);
  });
});
