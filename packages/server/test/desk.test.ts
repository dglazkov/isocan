import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { deskConformance } from "../../../test/conformance/desk-conformance.ts";
import { FileDesk } from "../src/file-desk.ts";

/**
 * The file desk, against the shared `Desk` conformance suite.
 *
 * New in phase 4, and the reason it is new is worth saying: until there were
 * two backings, `claims.test.ts` and `membership.test.ts` were the whole
 * story, and they are about POLICY — who may speak as whom — exercised
 * through a daemon. Conformance is about STORAGE, and it is the only thing
 * that can be pointed at two backings and asked whether they agree.
 */
deskConformance("FileDesk", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-desk-"));
  const desk = new FileDesk(home);
  await desk.init();
  return {
    desk,
    done: async () => {
      await desk.close();
      await fs.rm(home, { recursive: true, force: true });
    },
  };
});
