import { describe, expect, it } from "vitest";
import { GRANTS } from "../src/cloud-desk.ts";
import { cloudGate, makeCloudDesk, requireEmulator } from "./cloud-fixture.ts";

const gate = cloudGate();
if (!gate.ok && requireEmulator()) {
  it("requires the Firestore emulator for public listing storage", () => { throw new Error(gate.skip); });
} else describe.skipIf(!gate.ok)("CloudDesk public decisions", () => {
  it("retains valid nested decisions and refuses malformed raw documents", async () => {
    const { desk, firestore } = makeCloudDesk();
    try {
      const base = { id: "gnt_public", canvasId: "prj_public", subject: "link" as const, capability: "read" as const, grantedBy: "bdg_owner", at: "2026-09-13T00:00:00Z" };
      await desk.putGrant(base);
      await desk.setPublicListing(base.canvasId, base.id, true, "2026-09-13T01:00:00Z", "bdg_owner");
      expect((await firestore.collection(GRANTS).doc(base.id).get()).data()?.listing).toEqual({ listed: true, at: "2026-09-13T01:00:00Z", by: "bdg_owner" });
      expect((await desk.listedGrants())[0]?.listing?.listed).toBe(true);
      await firestore.collection(GRANTS).doc("gnt_damaged").set({ ...base, id: "gnt_damaged", listing: { listed: true, at: "invalid", by: "bdg_owner" } });
      expect((await desk.listedGrants()).map((g) => g.id)).toEqual([base.id]);
      expect((await desk.grantsFor(base.canvasId)).find((g) => g.id === "gnt_damaged")?.listing).toBeUndefined();
    } finally { await desk.close(); }
  });
  it("retains an explicit unlist after closing and reopening the backing", async () => {
    const first = makeCloudDesk();
    const row = { id: "gnt_restart", canvasId: "prj_restart", subject: "link" as const, capability: "read" as const, grantedBy: "bdg_owner", at: "2026-09-13T00:00:00Z" };
    await first.desk.putGrant(row);
    await first.desk.setPublicListing(row.canvasId, row.id, true, row.at, row.grantedBy);
    const off = { listed: false, at: "2026-09-13T01:00:00Z", by: row.grantedBy };
    await first.desk.setPublicListing(row.canvasId, row.id, off.listed, off.at, off.by);
    await first.desk.close();
    const reopened = makeCloudDesk(first.projectId);
    try {
      expect(await reopened.desk.listedGrants()).toEqual([]);
      const held = (await reopened.desk.grantsFor(row.canvasId))[0]!;
      expect(held.listing).toEqual(off);
      expect(held.revokedAt).toBeUndefined();
    } finally { await reopened.desk.close(); }
  });
  it("serializes publication and revocation from separate home instances", async () => {
    const first = makeCloudDesk(); const second = makeCloudDesk(first.projectId);
    try {
      const row = { id: "gnt_race", canvasId: "prj_race", subject: "link" as const, capability: "view" as const, grantedBy: "bdg_owner", at: "2026-09-13T00:00:00Z" };
      await first.desk.putGrant(row);
      await Promise.all([
        first.desk.setPublicListing(row.canvasId, row.id, true, "2026-09-13T01:00:00Z", "bdg_owner"),
        second.desk.revokeGrant(row.id, "2026-09-13T02:00:00Z", "bdg_revoker"),
      ]);
      const held = (await first.desk.grantsFor(row.canvasId))[0]!;
      expect(held.revokedAt).toBe("2026-09-13T02:00:00Z");
      expect(held.listing?.listed ?? false).toBe(false);
      expect(await first.desk.listedGrants()).toEqual([]);
      expect(await second.desk.setPublicListing(row.canvasId, row.id, true, "2026-09-13T03:00:00Z", "bdg_stale")).toBeNull();
    } finally { await first.desk.close(); await second.desk.close(); }
  });
});
