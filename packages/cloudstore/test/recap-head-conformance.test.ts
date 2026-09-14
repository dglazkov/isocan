import { it } from "vitest";
import { CloudDesk } from "../src/cloud-desk.ts";
import { cloudGate, makeCloudStore, requireEmulator } from "./cloud-fixture.ts";
import { recapHeadConformance } from "../../../test/conformance/recap-head.ts";

const gate = cloudGate();
if (!gate.ok && requireEmulator()) it("requires the emulator for inherited recap head acceptance", () => { throw new Error(gate.skip); });
else recapHeadConformance("Cloud", async () => {
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
