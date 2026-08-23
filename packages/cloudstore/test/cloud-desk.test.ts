import { describe, it } from "vitest";
import { deskConformance } from "../../../test/conformance/desk-conformance.ts";
import { cloudGate, makeCloudDesk, requireEmulator } from "./cloud-fixture.ts";

const gate = cloudGate();

if (!gate.ok && requireEmulator()) {
  describe("CloudDesk", () => {
    it("the Firestore emulator is REQUIRED here and is not available", () => {
      throw new Error(
        `ISOCAN_REQUIRE_EMULATOR=1, but the desk suite cannot run: ${gate.skip}.`,
      );
    });
  });
} else {
  deskConformance(
    "CloudDesk",
    async () => {
      const { desk } = makeCloudDesk();
      await desk.init();
      return { desk, done: () => desk.close() };
    },
    { skip: gate.skip },
  );
}
