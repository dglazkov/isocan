/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDesk } from "../src/file-desk.ts";
import { FileStore } from "../src/file-store.ts";
import { recapHeadConformance } from "../../../test/conformance/recap-head.ts";

recapHeadConformance("File", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-recap-head-"));
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
