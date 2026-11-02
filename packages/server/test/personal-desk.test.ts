import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDesk } from "../src/file-desk.ts";
import { badgesFile } from "../src/paths.ts";

it("FileDesk replays private classification, concrete consent and a revoked delegation from its journal", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-desk-"));
  const first = new FileDesk(home); await first.init();
  const at = "2026-09-13T00:00:00Z";
  const intent = { ownerId: "usr_maya", sourceCanvasId: "prj_personal", destinationCanvasId: "prj_shared", itemId: "itm_card", groupId: "itm_context", opId: "op_link", requestId: "gesture-one", createdAt: at };
  const revoked = { agentId: "usr_rowan", allowed: false, at, byOwnerId: "usr_maya" };
  try {
    await first.reservePersonal({ ownerId: "usr_maya", aliases: [], canvasId: "prj_personal", birthOpId: "op_birth", at });
    await first.finishPersonalBirth("prj_personal", "op_birth");
    await first.reservePersonalLink(intent);
    await first.setPersonalDelegation("prj_personal", { ...revoked, allowed: true });
    await first.setPersonalDelegation("prj_personal", revoked);
    await first.recordPersonalReplica("prj_remote", "https://home.acme.test");
    await first.close();
    // Only the derived snapshot is lost. The fsynced journal remains authoritative.
    await fs.rm(badgesFile(home));
    const reopened = new FileDesk(home); await reopened.init();
    try {
      expect((await reopened.personalBinding(["usr_maya"]))!.source).toMatchObject({ canvasId: "prj_personal", birthOpId: "op_birth", birth: "created" });
      expect(await reopened.personalLinkForItem("prj_shared", "itm_card")).toEqual(intent);
      expect(await reopened.reservePersonalLink({ ...intent, itemId: "itm_retry", opId: "op_retry" })).toEqual(intent);
      expect(await reopened.personalDelegations("prj_personal")).toEqual([revoked]);
      expect(await reopened.personalReplica("prj_remote")).toBe("https://home.acme.test");
      expect(await reopened.personalSource("prj_remote")).toBeNull();
      await expect(reopened.recordPersonalReplica("prj_remote", "https://different.acme.test")).rejects.toThrow("authority changed");
    } finally { await reopened.close(); }
  } finally { await first.close(); await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
