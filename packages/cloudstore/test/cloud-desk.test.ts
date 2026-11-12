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
