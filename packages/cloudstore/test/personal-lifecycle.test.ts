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

import { it } from "vitest";
import { CloudDesk } from "../src/cloud-desk.ts";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { personalLifecycleConformance } from "../../../test/conformance/personal-lifecycle.ts";

const gate = cloudGate();
if (!gate.ok && requireEmulator()) it("requires the emulator for personal lifecycle acceptance", () => { throw new Error(gate.skip); });
else personalLifecycleConformance("Cloud", async () => {
  let current = makeCloudStore();
  const { projectId, objects } = current;
  let desk = new CloudDesk({ firestore: current.firestore });
  await current.store.init(); await desk.init();
  return { store: current.store, desk,
    reopen: async () => {
      await desk.close(); await current.store.close();
      current = makeCloudStore({ projectId, objects });
      desk = new CloudDesk({ firestore: current.firestore });
      await current.store.init(); await desk.init();
      return { store: current.store, desk };
    },
    done: async () => { await desk.close(); await current.store.close(); },
  };
}, gate.skip);
