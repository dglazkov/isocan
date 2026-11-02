import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDesk } from "../src/file-desk.ts";
import * as paths from "../src/paths.ts";

it("recovers listing and its revocation from the durable desk journal", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-public-replay-"));
  let desk = new FileDesk(home);
  try {
    await desk.init();
    await desk.putGrant({ id: "gnt_public", canvasId: "prj_acme", subject: "link", capability: "view", grantedBy: "bdg_owner", at: "2026-09-13T00:00:00Z" });
    const decision = { listed: true, at: "2026-09-13T01:00:00Z", by: "bdg_owner" };
    await desk.setPublicListing("prj_acme", "gnt_public", decision.listed, decision.at, decision.by);
    await desk.close(); await fs.rm(paths.badgesFile(home));
    desk = new FileDesk(home); await desk.init();
    expect((await desk.listedGrants())[0]?.listing).toEqual(decision);
    const unlisted = { listed: false, at: "2026-09-13T01:10:00Z", by: "bdg_owner" };
    await desk.setPublicListing("prj_acme", "gnt_public", unlisted.listed, unlisted.at, unlisted.by);
    await desk.close(); await fs.rm(paths.badgesFile(home));
    desk = new FileDesk(home); await desk.init();
    expect(await desk.listedGrants()).toEqual([]);
    expect((await desk.grantsFor("prj_acme"))[0]?.listing).toEqual(unlisted);
    expect((await desk.grantsFor("prj_acme"))[0]?.revokedAt).toBeUndefined();
    await desk.setPublicListing("prj_acme", "gnt_public", true, decision.at, decision.by);
    await desk.revokeGrant("gnt_public", "2026-09-13T02:00:00Z", "bdg_revoker");
    await desk.close(); await fs.rm(paths.badgesFile(home));
    desk = new FileDesk(home); await desk.init();
    expect(await desk.listedGrants()).toEqual([]);
    expect((await desk.grantsFor("prj_acme"))[0]?.listing).toEqual({ listed: false, at: "2026-09-13T02:00:00Z", by: "bdg_revoker" });
    const before = await fs.readFile(paths.badgesLogFile(home), "utf8");
    expect(await desk.setPublicListing("prj_acme", "gnt_public", true, decision.at, decision.by)).toBeNull();
    expect(await fs.readFile(paths.badgesLogFile(home), "utf8")).toBe(before);
  } finally {
    await desk.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
