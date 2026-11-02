import { describe, expect, it } from "vitest";
import { awaitingReply } from "../src/components/MainThreadPanel.tsx";

/**
 * A record in the Chat asks nobody anything — a `/wire` act's account of what
 * it made (wireframes phase 8) is `record: true` — so the Chat must not say
 * "Nobody is parked — this waits on the thread" under it. Seen in the phase 8
 * browser walk, under the first Wire builder record.
 */
describe("awaitingReply", () => {
  const me = { id: "usr_ada" };
  it("waits on an ask that is yours and last", () => {
    expect(awaitingReply({ comments: [{ author: me }] }, me.id)).toBe(true);
  });
  it("does not wait on a record, which summoned nobody", () => {
    expect(awaitingReply({ comments: [{ author: me }, { author: me, record: true }] }, me.id)).toBe(false);
  });
  it("does not wait once somebody else has spoken last", () => {
    expect(awaitingReply({ comments: [{ author: me }, { author: { id: "usr_bot" } }] }, me.id)).toBe(false);
  });
});
