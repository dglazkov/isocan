import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDesk } from "../src/file-desk.ts";
import { FileStore } from "../src/file-store.ts";
import { personalLifecycleConformance } from "../../../test/conformance/personal-lifecycle.ts";

personalLifecycleConformance("File", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-lifecycle-"));
  let store = new FileStore(home);
  let desk = new FileDesk(home);
  await store.init(); await desk.init();
  return { store, desk,
    reopen: async () => {
      await store.close(); await desk.close();
      store = new FileStore(home); desk = new FileDesk(home);
      await store.init(); await desk.init();
      return { store, desk };
    },
    done: async () => {
      await store.close(); await desk.close();
      await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
});
